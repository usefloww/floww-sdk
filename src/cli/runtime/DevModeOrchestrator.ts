import { loadProjectConfig, updateProjectConfig } from "../config/projectConfig";
import { DebugContext } from "@/codeExecution";
import { EventRouter } from "./EventRouter";
import {
  resolveWorkflow,
  fetchProviderConfigs,
  WorkflowConfig,
  ProviderConfig,
} from "./workflow";
import { executeUserCode } from "./userCode";
import { validateProviders } from "./providers";
import { logger } from "../utils/logger";
import { selectOrCreateWorkflow } from "../utils/promptUtils";

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

    // Step 2: Fetch provider configs
    this.providerConfigs = await logger.debugTask(
      "Fetching provider configs",
      async () => await fetchProviderConfigs(this.workflow!.namespaceId),
    );

    // Step 3: Execute userspace
    const result = await logger.debugTask("Loading triggers", async () =>
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
          const triggerName = `${trigger.provider_type}/${trigger.trigger_type}`;
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

    // Convert triggers to metadata format (similar to deploy)
    const triggersMetadata = triggers.map((trigger: any) => {
      const metadata: any = { type: trigger.type };

      // Add provider metadata if available
      if (trigger._providerMeta) {
        metadata.provider_type = trigger._providerMeta.type;
        metadata.provider_alias = trigger._providerMeta.alias;
        metadata.trigger_type = trigger._providerMeta.triggerType;
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

    // Sync with backend
    const response = await syncDevTriggers({
      workflow_id: this.workflow.workflowId,
      triggers: triggersMetadata,
    });

    logger.debugInfo(`Synced ${response.webhooks.length} webhook(s) with backend`);

    if (response.webhooks.length > 0) {
      console.log();
      console.log("🛰️ Remote webhook endpoints (backend):");
      for (const webhook of response.webhooks) {
        const methodLabel = (webhook.method || "POST").toUpperCase().padEnd(6);
        let triggerLabel = "webhook trigger";

        if (webhook.provider_type) {
          const aliasPart = webhook.provider_alias
            ? `:${webhook.provider_alias}`
            : "";
          const triggerType = webhook.trigger_type || "webhook";
          triggerLabel = `${webhook.provider_type}${aliasPart}.${triggerType}`;
        } else if (webhook.trigger_type) {
          triggerLabel = webhook.trigger_type;
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
          const triggerName = `${trigger.provider_type}/${trigger.trigger_type}`;
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

    // Re-fetch provider configs
    this.providerConfigs = await fetchProviderConfigs(
      this.workflow.namespaceId,
    );

    // Re-execute userspace
    const result = await executeUserCode(
      this.options.entrypoint,
      this.providerConfigs,
      this.debugContext,
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
