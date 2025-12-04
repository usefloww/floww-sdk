/**
 * Runtime trigger invocation
 *
 * This module provides the core trigger execution logic used by runtime images
 * (Docker, Lambda, etc.) to invoke user-defined triggers.
 */

import { getMatchingTriggers } from "../userCode/utils";
import { executeUserProject } from "../codeExecution";
import { LogCapture, StructuredLogEntry } from "./logCapture";

/**
 * Create wrapped project with auto-registration support
 * Injects provider configs and wrapper code to extract registered triggers
 */
function createWrappedProject(
  files: Record<string, string>,
  entrypoint: string,
  providerConfigs: Record<string, any> = {}
) {
  const [fileAndExport] = entrypoint.includes(".")
    ? entrypoint.split(".", 2)
    : [entrypoint, "default"];

  const wrapperCode = `
        const {
            getUsedProviders,
            getRegisteredTriggers,
            clearRegisteredTriggers,
            clearUsedProviders,
            setProviderConfigs
        } = require('floww');

        clearRegisteredTriggers();
        clearUsedProviders();

        const __providerConfigs__ = ${JSON.stringify(providerConfigs)};
        setProviderConfigs(__providerConfigs__);

        const originalModule = require('./${fileAndExport.replace(".ts", "")}');

        const usedProviders = getUsedProviders();
        const registeredTriggers = getRegisteredTriggers();

        module.exports = registeredTriggers;
        module.exports.default = registeredTriggers;
        module.exports.triggers = registeredTriggers;
        module.exports.providers = usedProviders;
        module.exports.originalResult = originalModule;
    `;

  return {
    files: {
      ...files,
      "__wrapper__.js": wrapperCode,
    },
    entryPoint: "__wrapper__",
  };
}

/**
 * Report execution status to the backend
 *
 * Used by runtime images to notify the backend when an execution completes
 * or fails, allowing the backend to track execution status.
 *
 * @param backendUrl - The backend URL to report to
 * @param executionId - The execution ID
 * @param authToken - Authentication token for the backend
 * @param options - Optional error details, logs, and duration
 */
export async function reportExecutionStatus(
  backendUrl: string,
  executionId: string,
  authToken: string,
  options?: {
    error?: { message: string };
    logs?: StructuredLogEntry[];
    duration_ms?: number;
  }
) {
  try {
    const body: {
      error?: { message: string };
      logs?: StructuredLogEntry[];
      duration_ms?: number;
    } = {};
    if (options?.error) {
      body.error = options.error;
    }
    if (options?.logs) {
      body.logs = options.logs;
    }
    if (options?.duration_ms !== undefined) {
      body.duration_ms = options.duration_ms;
    }

    const response = await fetch(
      `${backendUrl}/api/executions/${executionId}/complete`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      console.error(
        `Failed to report execution status: ${response.status} ${response.statusText}`
      );
    }
  } catch (err) {
    console.error("Error reporting execution status:", err);
  }
}

/**
 * Base event interface with type discriminator
 */
export interface BaseEvent {
  type: "invoke_trigger" | "get_definitions";
}

/**
 * Trigger invocation event payload
 *
 * Uses a type-agnostic design with clear separation between:
 * - Trigger identity (provider, trigger_type, input) - used for matching
 * - Event data (data) - passed to trigger handlers
 */
export interface InvokeTriggerEvent extends BaseEvent {
  type: "invoke_trigger";
  // User code to execute
  userCode: {
    files: Record<string, string>;
    entrypoint: string;
  };

  // backend url
  backendUrl?: string;

  // Execution ID and auth token
  // used for reporting execution status to the backend
  executionId?: string;
  authToken?: string;

  // Trigger input details
  // used for matching which trigger to execute
  trigger: {
    provider: {
      type: string;
      alias: string;
    };
    triggerType: string;
    input: any;
  };

  // Trigger event details
  // used for passing the event data to the trigger handler
  data: any;

  // Provider configurations
  // Decrypted provider configs injected into user code execution context
  // Format: "providerType:alias" -> config object
  providerConfigs?: Record<string, any>;
}

/**
 * Trigger invocation result
 */
export interface InvokeTriggerResult {
  success: boolean;
  triggersProcessed: number;
  triggersExecuted: number;
  error?: {
    message: string;
    stack?: string;
  };
}

/**
 * Get definitions event payload
 *
 * Requests the trigger and provider definitions from user code
 * without executing any triggers
 */
export interface GetDefinitionsEvent extends BaseEvent {
  type: "get_definitions";

  // User code to analyze
  userCode: {
    files: Record<string, string>;
    entrypoint: string;
  };

  // Provider configurations (optional)
  // Used to inject provider configs during code interpretation
  providerConfigs?: Record<string, any>;
}

/**
 * Get definitions result
 */
export interface GetDefinitionsResult {
  success: boolean;
  triggers: Array<{
    provider: {
      type: string;
      alias: string;
    };
    triggerType: string;
    input: any;
  }>;
  providers: Array<{
    type: string;
    alias: string;
  }>;
  error?: {
    message: string;
    stack?: string;
  };
}

/**
 * Get trigger and provider definitions from user code
 *
 * This function:
 * 1. Wraps user code with provider config injection
 * 2. Executes the wrapped project to extract registered triggers and providers
 * 3. Returns definitions in a standardized format
 *
 * @param event - The get definitions event payload
 * @returns Definitions result with triggers and providers
 */
export async function handleGetDefinitions(
  event: GetDefinitionsEvent
): Promise<GetDefinitionsResult> {
  try {
    console.log("🔍 Floww Runtime - Getting definitions");

    // Extract user code from the event
    if (!event.userCode) {
      throw new Error("No userCode provided in event payload");
    }

    // Extract files and entrypoint
    const files = event.userCode.files;
    const entrypoint = event.userCode.entrypoint || "main.ts";

    if (!files) {
      throw new Error(
        'userCode must have a "files" property with the code files'
      );
    }

    console.log(`📂 Loading entrypoint: ${entrypoint}`);

    // Extract provider configs from event (if provided)
    const providerConfigs = event.providerConfigs || {};

    // Create wrapped project with auto-registration support
    const wrappedProject = createWrappedProject(
      files,
      entrypoint,
      providerConfigs
    );

    // Execute wrapped project
    const module = await executeUserProject(wrappedProject);
    const triggers = module.triggers || module.default || [];
    const providers = module.providers || {};

    console.log(`✅ Found ${triggers.length} trigger(s)`);
    console.log(`✅ Found ${Object.keys(providers).length} provider(s)`);

    // Convert triggers to standardized format
    const triggerDefinitions = triggers.map((trigger: any) => ({
      provider: {
        type: trigger._providerMeta.type,
        alias: trigger._providerMeta.alias,
      },
      triggerType: trigger._providerMeta.triggerType,
      input: trigger._providerMeta.input,
    }));

    // Convert providers to standardized format
    const providerDefinitions = Object.values(providers).map((value: any) => ({
      type: value.type,
      alias: value.alias,
    }));

    return {
      success: true,
      triggers: triggerDefinitions,
      providers: providerDefinitions,
    };
  } catch (error: any) {
    console.error("❌ Get definitions failed:", error);

    return {
      success: false,
      triggers: [],
      providers: [],
      error: {
        message: error.message,
        stack: error.stack,
      },
    };
  }
}

/**
 * Invoke trigger execution for a given event
 *
 * This function:
 * 1. Wraps user code with provider config injection
 * 2. Executes the wrapped project to extract registered triggers
 * 3. Routes the event to matching trigger handlers using provider-aware matching
 * 4. Reports execution status to backend if credentials provided
 * 5. Returns execution results
 *
 * @param event - The trigger event payload
 * @returns Execution result with status and metadata
 */
export async function invokeTrigger(
  event: InvokeTriggerEvent
): Promise<InvokeTriggerResult> {
  const logCapture = new LogCapture();
  let durationMs: number | undefined;

  try {
    console.log("🚀 Floww Runtime - Processing event");

    // Extract user code from the event
    if (!event.userCode) {
      throw new Error("No userCode provided in event payload");
    }

    // Extract files and entrypoint
    const files = event.userCode.files;
    const entrypoint = event.userCode.entrypoint || "main.ts";

    if (!files) {
      throw new Error(
        'userCode must have a "files" property with the code files'
      );
    }

    console.log(`📂 Loading entrypoint: ${entrypoint}`);

    // Extract provider configs from event (if provided)
    // Backend decrypts and sends provider credentials for this namespace
    const providerConfigs = event.providerConfigs || {};

    // Create wrapped project with auto-registration support
    const wrappedProject = createWrappedProject(
      files,
      entrypoint,
      providerConfigs
    );

    // Execute wrapped project
    const module = await executeUserProject(wrappedProject);
    const triggers = module.triggers || module.default || [];

    if (!Array.isArray(triggers) || triggers.length === 0) {
      throw new Error(
        "No triggers were auto-registered. Make sure you are creating triggers using builtin.triggers.onWebhook() or similar methods."
      );
    }

    console.log(`✅ Loaded ${triggers.length} trigger(s)`);

    const matchingTriggers = getMatchingTriggers(triggers, {
      type: event.trigger.provider.type,
      alias: event.trigger.provider.alias,
      triggerType: event.trigger.triggerType,
      input: event.trigger.input,
    });

    if (matchingTriggers.length === 0) {
      console.log(
        `⚠️ No matching triggers found for provider: ${event.trigger.provider.type}:${event.trigger.provider.alias}, ` +
          `trigger_type: ${event.trigger.triggerType}, input: ${JSON.stringify(
            event.trigger.input
          )}`
      );
    }

    // Execute all matching triggers
    // Start log capture and timing just before user code execution
    let executedCount = 0;
    for (const trigger of matchingTriggers) {
      console.log(
        `🎯 Executing trigger: ${event.trigger.provider.type}:${event.trigger.provider.alias}.${event.trigger.triggerType}`
      );

      // Start capturing logs and measure duration only for user code
      const startTime = Date.now();
      logCapture.start();

      // Pass event data directly to handler
      await trigger.handler({}, event.data);

      logCapture.stop();
      durationMs = Date.now() - startTime;
      executedCount++;
    }

    const logs = logCapture.getStructuredLogs();

    // Report successful execution to backend if credentials provided
    if (event.backendUrl && event.executionId && event.authToken) {
      await reportExecutionStatus(
        event.backendUrl,
        event.executionId,
        event.authToken,
        { logs, duration_ms: durationMs }
      );
    }

    return {
      success: true,
      triggersProcessed: triggers.length,
      triggersExecuted: executedCount,
    };
  } catch (error: any) {
    console.error("❌ Trigger execution failed:", error);

    // Stop capturing if still active
    logCapture.stop();
    const logs = logCapture.getStructuredLogs();

    const errorDetails = {
      message: error.message,
    };

    // Report failed execution to backend if credentials provided
    if (event.backendUrl && event.executionId && event.authToken) {
      await reportExecutionStatus(
        event.backendUrl,
        event.executionId,
        event.authToken,
        {
          error: errorDetails,
          logs,
          duration_ms: durationMs,
        }
      );
    }

    return {
      success: false,
      triggersProcessed: 0,
      triggersExecuted: 0,
      error: errorDetails,
    };
  }
}

/**
 * Handle any runtime event by dispatching to the appropriate handler
 *
 * This is the main entry point for all runtime events. It routes events
 * to the correct handler based on the event type.
 *
 * @param event - The runtime event (with type discriminator)
 * @returns The appropriate result based on the event type
 */
export async function handleEvent(
  event: InvokeTriggerEvent | GetDefinitionsEvent
): Promise<InvokeTriggerResult | GetDefinitionsResult> {
  switch (event.type) {
    case "invoke_trigger":
      return await invokeTrigger(event);
    case "get_definitions":
      return await handleGetDefinitions(event);
    default:
      throw new Error(`Unknown event type: ${(event as any).type}`);
  }
}
