import { ProjectConfig } from "../config/projectConfig";
import { fetchWorkflow, fetchProviders, Provider } from "../api/apiMethods";
import { logger } from "../utils/logger";

export interface WorkflowConfig {
  workflowId: string;
  namespaceId: string;
  name: string;
}

export type ProviderConfig = Record<string, any>;

/**
 * Check that workflow exists and resolve namespace.
 *
 * Resolves workflow details and namespace ID from project configuration.
 *
 * @param projectConfig - The loaded floww.yaml configuration
 * @returns Workflow configuration with resolved namespace ID
 * @throws {Error} If workflow ID is missing or workflow not found
 */
export async function resolveWorkflow(
  projectConfig: ProjectConfig,
): Promise<WorkflowConfig> {
  if (!projectConfig.workflowId) {
    throw new Error(
      'No workflowId found in floww.yaml. Run "floww init" to configure your project.',
    );
  }

  try {
    const workflow = await fetchWorkflow(projectConfig.workflowId);

    logger.debugInfo(`Resolved workflow: ${workflow.name}`);
    logger.debugInfo(`Namespace ID: ${workflow.namespace_id}`);

    return {
      workflowId: workflow.id,
      namespaceId: workflow.namespace_id,
      name: workflow.name || workflow.id,
    };
  } catch (error) {
    throw new Error(
      `Failed to fetch workflow "${projectConfig.workflowId}": ${
        error instanceof Error ? error.message : error
      }`,
    );
  }
}

/**
 * Fetch available providers in namespace.
 *
 * Fetches all provider configurations from the backend and prepares them
 * for injection into user code execution context.
 *
 * @param namespaceId - The namespace ID to fetch providers for
 * @returns Map of provider configs keyed by "type:alias"
 * @throws {Error} If provider fetch fails
 */
export async function fetchProviderConfigs(
  namespaceId: string,
): Promise<Map<string, ProviderConfig>> {
  try {
    const providers = await fetchProviders();

    const configs = new Map<string, ProviderConfig>();

    for (const provider of providers) {
      const key = `${provider.type}:${provider.alias}`;
      configs.set(key, provider.config);

      logger.debugInfo(`Loaded provider config: ${key}`);
    }

    logger.debugInfo(`Total provider configs loaded: ${configs.size}`);

    return configs;
  } catch (error) {
    // Non-fatal: continue without provider configs
    logger.warn(
      `Could not fetch provider configs: ${
        error instanceof Error ? error.message : error
      }`,
    );
    logger.plain("   Continuing without backend provider configurations");

    return new Map();
  }
}
