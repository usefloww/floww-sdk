/**
 * Runtime trigger invocation
 *
 * This module provides the core trigger execution logic used by runtime images
 * (Docker, Lambda, etc.) to invoke user-defined triggers.
 */

import { executeUserProject } from "../codeExecution";

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
 * @param error - Optional error details if execution failed
 */
export async function reportExecutionStatus(
  backendUrl: string,
  executionId: string,
  authToken: string,
  error?: { message: string; stack?: string }
) {
  try {
    const response = await fetch(
      `${backendUrl}/api/executions/${executionId}/complete`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(error ? { error } : {}),
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
 * Trigger invocation event payload
 *
 * Uses a type-agnostic design with clear separation between:
 * - Trigger identity (provider, trigger_type, input) - used for matching
 * - Event data (data) - passed to trigger handlers
 */
export interface InvokeTriggerEvent {
  // User code to execute
  userCode: {
    files: Record<string, string>;
    entrypoint: string;
  };

  // Execution ID and auth token
  // used for reporting execution status to the backend
  execution_id?: string;
  auth_token?: string;

  // Trigger input details
  // used for matching which trigger to execute
  trigger: {
    provider: {
      type: string;
      alias: string;
    };
    trigger_type: string;
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
  const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";

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

    // Provider-aware trigger matching
    // Match triggers by provider metadata (type, alias, trigger_type, input)
    const matchingTriggers = triggers.filter((t: any) => {
      // Skip triggers without provider metadata
      if (!t._providerMeta) {
        console.log(`⚠️ Trigger without provider metadata, skipping`);
        return false;
      }

      // Match on provider type, alias, trigger type, and input parameters
      const typeMatch = t._providerMeta.type === event.trigger.provider.type;
      const aliasMatch = t._providerMeta.alias === event.trigger.provider.alias;
      const triggerTypeMatch = t._providerMeta.triggerType === event.trigger.trigger_type;

      // Deep equality check for input parameters
      const inputMatch = JSON.stringify(t._providerMeta.input) === JSON.stringify(event.trigger.input);

      return typeMatch && aliasMatch && triggerTypeMatch && inputMatch;
    });

    if (matchingTriggers.length === 0) {
      console.log(
        `⚠️ No matching triggers found for provider: ${event.trigger.provider.type}:${event.trigger.provider.alias}, ` +
        `trigger_type: ${event.trigger.trigger_type}, input: ${JSON.stringify(event.trigger.input)}`
      );
    }

    // Execute all matching triggers
    let executedCount = 0;
    for (const trigger of matchingTriggers) {
      console.log(
        `🎯 Executing trigger: ${event.trigger.provider.type}:${event.trigger.provider.alias}.${event.trigger.trigger_type}`
      );

      // Pass event data directly to handler
      await trigger.handler({}, event.data);
      executedCount++;
    }

    // Report successful execution to backend if credentials provided
    if (backendUrl && event.execution_id && event.auth_token) {
      await reportExecutionStatus(
        backendUrl,
        event.execution_id,
        event.auth_token
      );
    }

    return {
      success: true,
      triggersProcessed: triggers.length,
      triggersExecuted: executedCount,
    };
  } catch (error: any) {
    console.error("❌ Trigger execution failed:", error);

    const errorDetails = {
      message: error.message,
      stack: error.stack,
    };

    // Report failed execution to backend if credentials provided
    if (backendUrl && event.execution_id && event.auth_token) {
      await reportExecutionStatus(
        backendUrl,
        event.execution_id,
        event.auth_token,
        errorDetails
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
