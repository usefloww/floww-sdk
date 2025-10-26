import { loadProjectConfig } from "../config/projectConfig";
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

export interface DevModeOptions {
  entrypoint: string;
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
  private eventRouter: EventRouter;
  private debugContext?: DebugContext;

  constructor(private options: DevModeOptions) {
    // Initialize debug context if enabled
    if (options.debugMode) {
      this.debugContext = new DebugContext();
      this.debugContext.enableDebug(true, options.debugPort || 9229);
    }

    // Create event router
    this.eventRouter = new EventRouter(
      options.port,
      options.host,
      this.debugContext,
    );
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
    const projectConfig = loadProjectConfig();

    // Step 1: Check workflow exists
    this.workflow = await logger.debugTask(
      "Checking workflow",
      async () => await resolveWorkflow(projectConfig),
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
    await validateProviders(result.usedProviders, { interactive: true });

    // Step 5: Setup event routing
    await logger.debugTask("Starting Flow Engine", async () => {
      await this.eventRouter.start(result.triggers);

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
   * Code change reload: Re-execute from step 3
   *
   * When user code changes, we only need to:
   * - Re-execute userspace with existing provider configs
   * - Update event routing with new triggers
   */
  async handleReload(): Promise<void> {
    if (!this.providerConfigs) {
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
    if (!this.workflow) {
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
    await validateProviders(result.usedProviders, { interactive: true });

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
    await this.eventRouter.stop();

    console.log("✨ Flow Engine stopped. See you next time! 👋");
  }
}
