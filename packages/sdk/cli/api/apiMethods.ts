import { logger } from "../utils/logger";
import { defaultApiClient } from "./client";
import { ConflictError } from "./errors";

// Shared types from the API contract (single source of truth)
import type {
  Namespace,
  Workflow,
  Provider,
  ProviderType,
  ProviderSetupStep,
} from "@floww/api-contract";

// Re-export shared types for consumers
export type { Namespace, Workflow, Provider, ProviderType, ProviderSetupStep };

// ============================================================================
// SDK-specific types (not in the shared contract)
// ============================================================================

export interface RuntimeConfig {
  imageHash: string;
}

export interface RuntimeCreateRequest {
  config: RuntimeConfig;
}

export interface RuntimeCreateResponse {
  id: string;
  config: any;
  creationStatus: string;
  creationLogs: any[];
}

export interface RuntimeStatusResponse {
  id: string;
  config: any;
  creationStatus: string;
  creationLogs: any[];
}

export interface WorkflowDeploymentUserCode {
  files: Record<string, string>;
  entrypoint: string;
}

export interface TriggerMetadata {
  type: string;
  path?: string;
  method?: string;
  expression?: string;
  channel?: string;
}

export interface WebhookInfo {
  id: string;
  url: string;
  path?: string;
  method?: string;
  triggerId?: string;
  triggerType?: string;
  providerType?: string;
  providerAlias?: string;
}

export interface WorkflowDeploymentCreateRequest {
  workflowId: string;
  runtimeId: string;
  code: WorkflowDeploymentUserCode;
  triggers?: TriggerMetadata[];
  providerMappings?: Record<string, Record<string, string>>;
}

export interface WorkflowDeploymentResponse {
  id: string;
  workflowId: string;
  workflowName?: string;
  runtimeId: string;
  runtimeName?: string;
  deployedById?: string;
  status: string;
  deployedAt: string;
  note?: string;
  userCode?: WorkflowDeploymentUserCode;
  webhooks?: WebhookInfo[];
}

export interface PushTokenResponse {
  password: string;
  expiresIn: number;
  imageTag: string;
  registryUrl: string;
}

// ============================================================================
// Namespace API methods
// ============================================================================

export async function fetchNamespaces(): Promise<Namespace[]> {
  const data = await defaultApiClient().apiCall<{ results: Namespace[] }>(
    "/namespaces"
  );
  return data.results;
}

// ============================================================================
// Workflow API methods
// ============================================================================

export async function fetchWorkflows(
  namespaceId?: string
): Promise<Workflow[]> {
  const query = namespaceId ? `?namespaceId=${namespaceId}` : "";
  const data = await defaultApiClient().apiCall<{ results: Workflow[] }>(
    `/workflows${query}`
  );
  return data.results;
}

export async function fetchWorkflow(workflowId: string): Promise<Workflow> {
  return await defaultApiClient().apiCall<Workflow>(`/workflows/${workflowId}`);
}

export async function createWorkflow(
  name: string,
  namespaceId: string,
  description?: string
): Promise<Workflow> {
  return await defaultApiClient().apiCall<Workflow>("/workflows", {
    method: "POST",
    body: {
      name,
      namespaceId,
      description,
    },
  });
}

// ============================================================================
// Helper function to read project files
// ============================================================================

export async function readProjectFiles(
  projectDir: string,
  entrypoint: string
): Promise<WorkflowDeploymentUserCode> {
  const fs = await import("fs/promises");
  const path = await import("path");

  const files: Record<string, string> = {};

  async function readDirectory(dirPath: string, relativePath: string = "") {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativeFilePath = relativePath
        ? path.join(relativePath, entry.name)
        : entry.name;

      if (entry.isDirectory()) {
        if (
          !["node_modules", ".git", "dist", ".floww", "pulumi-state"].includes(
            entry.name
          )
        ) {
          await readDirectory(fullPath, relativeFilePath);
        }
      } else if (entry.isFile()) {
        if (/\.(ts|js|json|yaml|yml)$/.test(entry.name)) {
          try {
            const content = await fs.readFile(fullPath, "utf-8");
            files[relativeFilePath] = content;
          } catch (error) {
            console.warn(`Could not read file: ${relativeFilePath}`);
          }
        }
      }
    }
  }

  await readDirectory(projectDir);

  return {
    files,
    entrypoint,
  };
}

// ============================================================================
// Runtime API methods
// ============================================================================

export class RuntimeAlreadyExistsError extends Error {
  runtimeId: string;

  constructor(runtimeId: string, message: string) {
    super(message);
    this.runtimeId = runtimeId;
    this.name = "RuntimeAlreadyExistsError";
  }
}

export async function getPushData(
  imageHash: string
): Promise<PushTokenResponse | null> {
  try {
    return await defaultApiClient().apiCall<PushTokenResponse>(
      "/runtimes/push_token",
      {
        method: "POST",
        body: { image_hash: imageHash },
      }
    );
  } catch (error) {
    if (error instanceof ConflictError) {
      return null;
    }
    throw error;
  }
}

export async function createRuntime(
  runtimeData: RuntimeCreateRequest
): Promise<RuntimeCreateResponse> {
  try {
    return await defaultApiClient().apiCall<RuntimeCreateResponse>(
      "/runtimes",
      {
        method: "POST",
        body: runtimeData,
      }
    );
  } catch (error) {
    if (error instanceof ConflictError) {
      logger.debugInfo("Runtime already exists");
      return await getRuntimeStatus(error.details.detail.runtime_id);
    }
    throw error;
  }
}

export async function getRuntimeStatus(
  runtimeId: string
): Promise<RuntimeStatusResponse> {
  return await defaultApiClient().apiCall<RuntimeStatusResponse>(
    `/runtimes/${runtimeId}`
  );
}

// ============================================================================
// Deployment API methods
// ============================================================================

export async function createWorkflowDeployment(
  deploymentData: WorkflowDeploymentCreateRequest
): Promise<WorkflowDeploymentResponse> {
  try {
    return await defaultApiClient().apiCall<WorkflowDeploymentResponse>(
      "/workflow-deployments",
      {
        method: "POST",
        body: deploymentData,
      }
    );
  } catch (error: any) {
    if (error.details?.detail?.failed_triggers) {
      const triggerError = new Error(
        error.details.detail.message || "Failed to create triggers"
      );
      (triggerError as any).failedTriggers =
        error.details.detail.failed_triggers;
      throw triggerError;
    }
    throw error;
  }
}

export async function listWorkflowDeployments(
  workflowId?: string
): Promise<WorkflowDeploymentResponse[]> {
  const queryParams = workflowId ? `?workflowId=${workflowId}` : "";
  const data = await defaultApiClient().apiCall<{
    results: WorkflowDeploymentResponse[];
  }>(`/workflow-deployments${queryParams}`);
  return data.results;
}

// ============================================================================
// Provider API methods
// ============================================================================

export interface ProviderCreateRequest {
  namespaceId: string;
  type: string;
  alias: string;
  config: Record<string, any>;
}

export interface ProviderUpdateRequest {
  type?: string;
  alias?: string;
  config?: Record<string, any>;
}

export async function fetchProviders(
  namespaceId?: string
): Promise<Provider[]> {
  const query = namespaceId ? `?namespaceId=${namespaceId}` : "";
  const data = await defaultApiClient().apiCall<{ results: Provider[] }>(
    `/providers${query}`
  );
  return data.results;
}

export async function fetchProviderById(
  providerId: string
): Promise<Provider> {
  return await defaultApiClient().apiCall<Provider>(
    `/providers/${providerId}`
  );
}

export async function fetchProviderType(
  providerType: string
): Promise<ProviderType> {
  return await defaultApiClient().apiCall<ProviderType>(
    `/provider-types/${providerType}`
  );
}

export async function createProvider(
  providerData: ProviderCreateRequest
): Promise<Provider> {
  return await defaultApiClient().apiCall<Provider>("/providers", {
    method: "POST",
    body: providerData,
  });
}

export async function updateProvider(
  providerId: string,
  updateData: ProviderUpdateRequest
): Promise<Provider> {
  return await defaultApiClient().apiCall<Provider>(
    `/providers/${providerId}`,
    {
      method: "PATCH",
      body: updateData,
    }
  );
}

export async function deleteProvider(providerId: string): Promise<void> {
  await defaultApiClient().apiCall<void>(`/providers/${providerId}`, {
    method: "DELETE",
  });
}

// ============================================================================
// Dev Mode API methods
// ============================================================================

export interface DevTriggerSyncRequest {
  workflowId: string;
  triggers: any[];
  providerMappings?: Record<string, Record<string, string>>;
}

export interface DevTriggerSyncResponse {
  webhooks: WebhookInfo[];
}

export async function syncDevTriggers(
  data: DevTriggerSyncRequest
): Promise<DevTriggerSyncResponse> {
  try {
    return await defaultApiClient().apiCall<DevTriggerSyncResponse>(
      "/dev/sync-triggers",
      {
        method: "POST",
        body: data,
      }
    );
  } catch (error: any) {
    if (error.details?.detail?.failed_triggers) {
      const triggerError = new Error(
        error.details.detail.message || "Failed to create triggers"
      );
      (triggerError as any).failedTriggers =
        error.details.detail.failed_triggers;
      throw triggerError;
    }
    throw error;
  }
}
