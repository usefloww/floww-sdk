import {
  executeUserProject,
  getUserProject,
  ExecuteUserProjectOptions,
  DebugContext,
} from "@/codeExecution";
import { SecretDefinition, Trigger } from "../../common";
import { ProviderConfig } from "./workflow";
import { logger } from "../utils/logger";

export interface UsedProvider {
  type: string;
  alias?: string;
  secretDefinitions?: SecretDefinition[];
}

export interface UserCodeResult {
  triggers: Trigger[];
  usedProviders: UsedProvider[];
}

/**
 * Execute userspace and return triggers and provider usage.
 *
 * Initializes userspace with provider configs before execution.
 * This function:
 * - Loads all user project files
 * - Injects provider configurations into execution context
 * - Executes user TypeScript code in isolated environment
 * - Extracts auto-registered triggers and provider usage
 *
 * @param entrypoint - Path to the user code entrypoint file
 * @param providerConfigs - Provider configurations from backend
 * @param debugContext - Optional debug context for debugging features
 * @returns Triggers and providers discovered in user code
 * @throws {Error} If user code execution fails or no triggers registered
 */
export async function executeUserCode(
  entrypoint: string,
  providerConfigs: Map<string, ProviderConfig>,
  debugContext?: DebugContext
): Promise<UserCodeResult> {
  logger.debugInfo(`Executing user code: ${entrypoint}`);

  // Load user project files
  const userProject = await getUserProject(entrypoint, "default");

  // Inject provider configs via wrapper code
  const wrappedProject = injectProviderConfigs(userProject, providerConfigs);

  // Execute user code in isolated context
  const module = await executeUserProject({
    ...wrappedProject,
    debugMode: !!debugContext,
    debugContext,
  });

  // Extract results from module exports
  const triggers = module.default || [];
  const usedProviders = module.providers || [];

  if (!Array.isArray(triggers)) {
    throw new Error(
      "No triggers were auto-registered. Make sure you're creating triggers using builtin.triggers.onCron() or similar methods."
    );
  }

  logger.debugInfo(`Found ${triggers.length} trigger(s)`);
  logger.debugInfo(`Found ${usedProviders.length} used provider(s)`);

  return {
    triggers,
    usedProviders,
  };
}

/**
 * Helper: Create wrapper code with provider config injection
 *
 * This wraps user code with boilerplate that:
 * - Clears previous registrations (for hot-reload)
 * - Injects provider configurations from backend
 * - Imports user module to trigger auto-registration
 * - Exports triggers and providers for engine consumption
 *
 * @param project - User project files and entrypoint
 * @param providerConfigs - Provider configurations to inject
 * @returns Modified project with wrapper entrypoint
 */
function injectProviderConfigs(
  project: ExecuteUserProjectOptions,
  providerConfigs: Map<string, ProviderConfig>
): ExecuteUserProjectOptions {
  // Serialize provider configs for injection
  const configsObj = Object.fromEntries(providerConfigs);

  // Parse original entrypoint
  const [fileAndExport] = project.entryPoint.includes(".")
    ? project.entryPoint.split(".", 2)
    : [project.entryPoint, "default"];

  // Create wrapper code
  const wrapperCode = `
    // Import auto-registration functions from floww package
    const { getUsedProviders, getRegisteredTriggers, clearRegisteredTriggers, clearUsedProviders, setProviderConfigs } = require('floww');

    // Clear previously registered data to prevent duplication on reload
    clearRegisteredTriggers();
    clearUsedProviders();

    // Inject provider configs from backend
    const __providerConfigs__ = ${JSON.stringify(configsObj)};
    setProviderConfigs(__providerConfigs__);

    // Import the original user module to trigger auto-registration
    const originalModule = require('./${fileAndExport.replace(".ts", "")}');

    // Capture auto-registered data
    const usedProviders = getUsedProviders();
    const registeredTriggers = getRegisteredTriggers();

    // Export auto-registered triggers as default (for engine compatibility)
    module.exports = registeredTriggers;
    module.exports.default = registeredTriggers;

    // Also expose other data for systems that need it
    module.exports.triggers = registeredTriggers;
    module.exports.providers = usedProviders;
    module.exports.originalResult = originalModule;
  `;

  // Return wrapped project
  return {
    ...project,
    files: {
      ...project.files,
      "__wrapper__.js": wrapperCode,
    },
    entryPoint: "__wrapper__",
  };
}
