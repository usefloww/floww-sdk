import { loadProjectConfig, updateProjectConfig, ProviderMappings } from "../config/projectConfig";
import { DebugContext } from "../../codeExecution";
import { EventRouter } from "./EventRouter";
import {
  resolveWorkflow,
  fetchProviderConfigs,
  fetchProviderConfigsByMapping,
  WorkflowConfig,
  ProviderConfig,
} from "./workflow";
import { executeUserCode } from "./userCode";
import { validateProviders } from "./providers";
import { logger } from "../utils/logger";
import { selectOrCreateWorkflow } from "../utils/promptUtils";
import { autoPopulateProviderMappings, refreshProviderMappings } from "./providerMapping";

export interface DevModeOptions {
  entrypoint: string;
  projectDir?: string;
  port: number;
  host: string;
  debugMode?: boolean;
  debugPort?: number;
}

/**
 * Orchestrates the complete dev mode flow
 *
 * This is a CLASS because it:
 * - Coordinates multiple stateful components (EventRouter)
 * - Manages flow state across reload cycles
 * - Handles lifecycle (start/stop/reload)
 *
 * Flow:
 * 1. Check workflow exists
 * 2. Fetch provider configs
 * 3. Execute user code
 * 4. Validate providers (prompt if needed)
 * 5. Setup event routing
 *
 * Reload flows:
 * - Code change: Re-execute from step 3
 * - Provider setup: Re-execute from step 1
 */
export class DevModeOrchestrator {
  private workflow?: WorkflowConfig;
  private providerConfigs?: Map<string, ProviderConfig>;
  private eventRouter?: EventRouter;
  private debugContext?: DebugContext;

  constructor(private options: DevModeOptions) {
    // Initialize debug context if enabled
    if (options.debugMode) {
      this.debugContext = new DebugContext();
      this.debugContext.enableDebug(true, options.debugPort || 9229);
    }

    // EventRouter will be created in start() after workflow is resolved
  }

  /**
   * Run complete flow: Init → Execution → Validation → Event Routing
   *
   * This implements the full dev mode flow as documented in architecture.md:
   * 1. Check that workflow exists
   * 2. Fetch available providers in namespace
   * 3. Initialize userspace with provider configs and execute
   * 4. Verify that all used providers are set up (prompt user if not)
   * 5. Setup event routing to userspace
   */
  async start(): Promise<void> {
    // Load project configuration
    let projectConfig = loadProjectConfig(this.options.projectDir);

    // Step 1: Check workflow exists
    try {
      this.workflow = await logger.debugTask(
        "Checking workflow",
        async () => await resolveWorkflow(projectConfig),
      );
    } catch (error) {
      // Check if it's a 404 (workflow not found) and we're in interactive mode
      const is404 = error instanceof Error && error.message.includes("404");

      if (is404 && logger.interactive) {
        logger.warn(`Workflow not found. Let's select or create a workflow.`);

        try {
          // selectOrCreateWorkflow will first prompt for namespace selection,
          // then prompt for workflow selection/creation
          const { workflowId, workflow: selectedWorkflow } =
            await selectOrCreateWorkflow({
              suggestedName: projectConfig.name,
              allowCreate: true,
              // No namespaceId provided - user will be prompted to select namespace first
            });

          // Update project config with the selected workflow
          projectConfig = updateProjectConfig({ workflowId }, this.options.projectDir);

          // Retry resolving workflow with updated config
          this.workflow = await logger.debugTask(
            "Checking workflow",
            async () => await resolveWorkflow(projectConfig),
          );
        } catch (selectionError) {
          logger.error(
            "Failed to select workflow:",
            selectionError instanceof Error
              ? selectionError.message
              : selectionError
          );
          throw selectionError;
        }
      } else {
        // Re-throw the original error if not interactive or not a 404
        throw error;
      }
    }

    // Create event router now that we have workflow ID
    this.eventRouter = new EventRouter(
      this.options.port,
      this.options.host,
      this.debugContext,
      this.workflow.workflowId,
    );

    // Step 2: Fetch provider configs (using mapping if available)
    this.providerConfigs = await logger.debugTask(
      "Fetching provider configs",
      async () => await this.fetchConfigs(projectConfig.providers),
    );

    // Step 3: Execute userspace
    let result = await logger.debugTask("Loading triggers", async () =>
      executeUserCode(
        this.options.entrypoint,
        this.providerConfigs!,
        this.debugContext,
      ),
    );

    // Step 4: Validate providers
    await validateProviders(result.usedProviders, {
      interactive: true,
      namespaceId: this.workflow.namespaceId,
    });

    // Step 4.1: Auto-populate provider mappings in floww.yaml
    const updatedMappings = await logger.debugTask(
      "Updating provider mappings",
      async () => await refreshProviderMappings(
        result.usedProviders,
        this.options.projectDir,
      ),
    );

    // Step 4.25: Re-fetch provider configs using updated mappings and re-execute
    this.providerConfigs = await logger.debugTask(
      "Re-fetching provider configs",
      async () => {
        const mappings = Object.keys(updatedMappings).length > 0
          ? updatedMappings
          : undefined;
        return await this.fetchConfigs(mappings);
      },
    );

    // Re-execute user code with updated configs
    result = await logger.debugTask("Reloading triggers with updated configs", async () =>
      executeUserCode(
        this.options.entrypoint,
        this.providerConfigs!,
        this.debugContext,
      ),
    );

    // Step 4.5: Sync triggers with backend (deploy webhooks to production)
    try {
      await logger.debugTask("Syncing triggers with backend", async () => {
        await this.syncTriggersWithBackend(result.triggers);
      });
    } catch (error: any) {
      // Check if this is a trigger failure error
      if (error.failedTriggers && Array.isArray(error.failedTriggers)) {
        logger.plain("");
        logger.error("Syncing triggers with backend failed");
        logger.plain("");
        logger.warn("Failed Triggers:");
        for (const trigger of error.failedTriggers) {
          const triggerName = `${trigger.providerType}/${trigger.triggerType}`;
          const errorMsg = trigger.error || "Unknown error";
          // Clean up error message - remove the "For more information" link if present
          const cleanError = errorMsg.split("\nFor more information")[0].trim();
          logger.plain(`  ✗ ${triggerName}: ${cleanError}`);
        }
        logger.plain("");
        throw new Error("Failed to sync triggers with backend");
      }
      // Re-throw other errors
      throw error;
    }

    // Step 5: Setup event routing
    await logger.debugTask("Starting Flow Engine", async () => {
      await this.eventRouter!.start(result.triggers);

      // Start debug inspector if enabled
      if (this.debugContext) {
        try {
          await this.debugContext.startInspector();
        } catch (error) {
          logger.warn("Failed to start inspector:", error);
          logger.plain("   Continuing without inspector integration");
        }
      }
    });
  }

  /**
   * Sync triggers with backend - create real webhooks in production
   * but route events back to local dev session via websocket
   */
  private async syncTriggersWithBackend(triggers: any[]): Promise<void> {
    if (!this.workflow) {
      return;
    }

    const {syncDevTriggers} = await import("../api/apiMethods");

    // Load current provider mappings from floww.yaml
    const currentConfig = loadProjectConfig(this.options.projectDir);
    const currentMappings = currentConfig.providers;

    // Convert triggers to metadata format (similar to deploy)
    const triggersMetadata = triggers.map((trigger: any) => {
      const metadata: any = { type: trigger.type };

      // Add provider metadata if available
      if (trigger._providerMeta) {
        metadata.providerType = trigger._providerMeta.type;
        metadata.providerAlias = trigger._providerMeta.alias;
        metadata.triggerType = trigger._providerMeta.triggerType;
        metadata.input = trigger._providerMeta.input;
      }

      if (trigger.type === "webhook") {
        if (trigger.path) {
          metadata.path = trigger.path;
        }
        metadata.method = trigger.method || "POST";
      } else if (trigger.type === "cron") {
        metadata.expression = trigger.expression;
      } else if (trigger.type === "realtime") {
        metadata.channel = trigger.channel;
      }

      return metadata;
    });

    // Sync with backend (include provider mappings if available)
    const response = await syncDevTriggers({
      workflowId: this.workflow.workflowId,
      triggers: triggersMetadata,
      providerMappings: currentMappings && Object.keys(currentMappings).length > 0
        ? currentMappings
        : undefined,
    });

    const webhooks = response.webhooks || [];
    logger.debugInfo(`Synced ${webhooks.length} webhook(s) with backend`);

    if (webhooks.length > 0) {
      console.log();
      console.log("🛰️ Remote webhook endpoints (backend):");
      for (const webhook of webhooks) {
        const methodLabel = (webhook.method || "POST").toUpperCase().padEnd(6);
        let triggerLabel = "webhook trigger";

        if (webhook.providerType) {
          const aliasPart = webhook.providerAlias
            ? `:${webhook.providerAlias}`
            : "";
          const triggerType = webhook.triggerType || "webhook";
          triggerLabel = `${webhook.providerType}${aliasPart}.${triggerType}`;
        } else if (webhook.triggerType) {
          triggerLabel = webhook.triggerType;
        }

        console.log(`   ${methodLabel} ${webhook.url} — ${triggerLabel}`);
      }
      console.log();
    }
  }

  /**
   * Code change reload: Re-execute from step 3
   *
   * When user code changes, we only need to:
   * - Re-execute userspace with existing provider configs
   * - Update event routing with new triggers
   */
  async handleReload(): Promise<void> {
    if (!this.providerConfigs || !this.eventRouter) {
      throw new Error(
        "Cannot reload: orchestrator not initialized. Call start() first.",
      );
    }

    // Re-execute userspace
    const result = await executeUserCode(
      this.options.entrypoint,
      this.providerConfigs,
      this.debugContext,
    );

    // Sync triggers with backend
    try {
      await this.syncTriggersWithBackend(result.triggers);
    } catch (error: any) {
      // Check if this is a trigger failure error
      if (error.failedTriggers && Array.isArray(error.failedTriggers)) {
        logger.plain("");
        logger.error("Syncing triggers with backend failed");
        logger.plain("");
        logger.warn("Failed Triggers:");
        for (const trigger of error.failedTriggers) {
          const triggerName = `${trigger.providerType}/${trigger.triggerType}`;
          const errorMsg = trigger.error || "Unknown error";
          // Clean up error message - remove the "For more information" link if present
          const cleanError = errorMsg.split("\nFor more information")[0].trim();
          logger.plain(`  ✗ ${triggerName}: ${cleanError}`);
        }
        logger.plain("");
        throw new Error("Failed to sync triggers with backend");
      }
      // Re-throw other errors
      throw error;
    }

    // Update event routing with new triggers
    await this.eventRouter.updateTriggers(result.triggers);
  }

  /**
   * Provider setup: Re-execute from step 1
   *
   * When providers are set up, we need to:
   * - Re-fetch provider configs (they may have changed)
   * - Re-execute userspace
   * - Re-validate providers
   * - Update event routing
   */
  async handleProviderSetup(): Promise<void> {
    if (!this.workflow || !this.eventRouter) {
      throw new Error(
        "Cannot handle provider setup: orchestrator not initialized. Call start() first.",
      );
    }

    // Refresh provider mappings (picks up newly created providers)
    const projectConfig = loadProjectConfig(this.options.projectDir);
    const updatedMappings = await refreshProviderMappings(
      [], // Will be populated after execution
      this.options.projectDir,
    );

    // Re-fetch provider configs using mappings
    const mappings = Object.keys(updatedMappings).length > 0
      ? updatedMappings
      : projectConfig.providers;
    this.providerConfigs = await this.fetchConfigs(mappings);

    // Re-execute userspace
    const result = await executeUserCode(
      this.options.entrypoint,
      this.providerConfigs,
      this.debugContext,
    );

    // Auto-populate any new mappings from used providers
    await refreshProviderMappings(
      result.usedProviders,
      this.options.projectDir,
    );

    // Re-validate providers
    await validateProviders(result.usedProviders, {
      interactive: true,
      namespaceId: this.workflow!.namespaceId,
    });

    // Update event routing
    await this.eventRouter.updateTriggers(result.triggers);
  }

  /**
   * Fetch provider configs, using ID-based mapping if available,
   * falling back to namespace-wide type:alias lookup.
   */
  private async fetchConfigs(
    mappings?: ProviderMappings,
  ): Promise<Map<string, ProviderConfig>> {
    if (mappings && Object.keys(mappings).length > 0) {
      return await fetchProviderConfigsByMapping(
        mappings,
        this.workflow!.namespaceId,
      );
    }
    return await fetchProviderConfigs(this.workflow!.namespaceId);
  }

  /**
   * Stop the orchestrator and cleanup resources
   */
  async stop(): Promise<void> {
    console.log();
    console.log("🛑 Stopping Flow Engine...");

    // Stop debug inspector
    if (this.debugContext) {
      try {
        await this.debugContext.stopInspector();
      } catch (error) {
        logger.debugInfo("Error stopping inspector:", error);
      }
    }

    // Stop event routing
    if (this.eventRouter) {
      await this.eventRouter.stop();
    }

    console.log("✨ Flow Engine stopped. See you next time! 👋");
  }
}
