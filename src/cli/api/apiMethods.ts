import { logger } from "../utils/logger";
import { defaultApiClient } from "./client";
import { ConflictError } from "./errors";

// Type definitions for API responses
export interface Namespace {
  id: string;
  user_owner_id?: string;
  organization_owner_id?: string;
  organization?: {
    id: string;
    name: string;
    display_name: string;
  };
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  namespace_id: string;
  namespace_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RuntimeConfig {
  image_hash: string;
}

export interface RuntimeCreateRequest {
  config: RuntimeConfig;
}

export interface RuntimeCreateResponse {
  id: string;
  config: any;
  creation_status: string;
  creation_logs: any[];
}

export interface RuntimeStatusResponse {
  id: string;
  config: any;
  creation_status: string;
  creation_logs: any[];
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
  trigger_id?: string;
  trigger_type?: string;
  provider_type?: string;
  provider_alias?: string;
}

export interface WorkflowDeploymentCreateRequest {
  workflow_id: string;
  runtime_id: string;
  code: WorkflowDeploymentUserCode;
  triggers?: TriggerMetadata[];
}

export interface WorkflowDeploymentResponse {
  id: string;
  workflow_id: string;
  workflow_name?: string;
  runtime_id: string;
  runtime_name?: string;
  deployed_by_id?: string;
  status: string;
  deployed_at: string;
  note?: string;
  user_code?: WorkflowDeploymentUserCode;
  webhooks?: WebhookInfo[];
}

export interface PushTokenRequest {
  image_name: string;
  tag: string;
}

export interface PushTokenResponse {
  password: string;
  expires_in: number;
  image_tag: string;
  registry_url: string;
}

// Namespace API methods
export async function fetchNamespaces(): Promise<Namespace[]> {
  const data = await defaultApiClient().apiCall<{ results: Namespace[] }>(
    "/namespaces"
  );
  return data.results;
}

// Workflow API methods
export async function fetchWorkflows(): Promise<Workflow[]> {
  const data = await defaultApiClient().apiCall<{ results: Workflow[] }>(
    "/workflows"
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
      namespace_id: namespaceId,
      description,
    },
  });
}

// Helper function to read project files
export async function readProjectFiles(
  projectDir: string,
  entrypoint: string
): Promise<WorkflowDeploymentUserCode> {
  // Import fs and path dynamically to handle bundling issues
  const fs = await import("fs/promises");
  const path = await import("path");

  // Read all files in the project directory recursively
  const files: Record<string, string> = {};

  async function readDirectory(dirPath: string, relativePath: string = "") {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativeFilePath = relativePath
        ? path.join(relativePath, entry.name)
        : entry.name;

      // Skip node_modules, .git, and other common directories
      if (entry.isDirectory()) {
        if (
          !["node_modules", ".git", "dist", ".floww", "pulumi-state"].includes(
            entry.name
          )
        ) {
          await readDirectory(fullPath, relativeFilePath);
        }
      } else if (entry.isFile()) {
        // Include source files (.ts, .js, .json, etc.)
        if (/\.(ts|js|json|yaml|yml)$/.test(entry.name)) {
          try {
            const content = await fs.readFile(fullPath, "utf-8");
            files[relativeFilePath] = content;
          } catch (error) {
            console.warn(`⚠️ Could not read file: ${relativeFilePath}`);
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

export class RuntimeAlreadyExistsError extends Error {
  runtimeId: string;

  constructor(runtimeId: string, message: string) {
    super(message);
    this.runtimeId = runtimeId;
    this.name = "RuntimeAlreadyExistsError";
  }
}

// Runtime API methods
export async function getPushData(
  image_hash: string
): Promise<PushTokenResponse | null> {
  try {
    return await defaultApiClient().apiCall<PushTokenResponse>(
      "/runtimes/push_token",
      {
        method: "POST",
        body: { image_hash },
      }
    );
  } catch (error) {
    if (error instanceof ConflictError) {
      // Image already exists in registry, return null to indicate no push needed
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

export async function createWorkflowDeployment(
  deploymentData: WorkflowDeploymentCreateRequest
): Promise<WorkflowDeploymentResponse> {
  try {
    return await defaultApiClient().apiCall<WorkflowDeploymentResponse>(
      "/workflow_deployments",
      {
        method: "POST",
        body: deploymentData,
      }
    );
  } catch (error: any) {
    // Check if this is a trigger failure error
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
  const queryParams = workflowId ? `?workflow_id=${workflowId}` : "";
  const data = await defaultApiClient().apiCall<{
    results: WorkflowDeploymentResponse[];
  }>(`/workflow_deployments${queryParams}`);
  return data.results;
}

// Provider API types and methods
export interface ProviderSetupStep {
  type: string;
  title: string;
  alias: string;
  required: boolean;
  description?: string;
  placeholder?: string;
  default?: string;
  // Info step fields
  message?: string;
  action_text?: string;
  action_url?: string;
}

export interface ProviderType {
  provider_type: string;
  setup_steps: ProviderSetupStep[];
}

export interface Provider {
  id: string;
  namespace_id: string;
  type: string;
  alias: string;
  config: Record<string, any>;
}

export interface ProviderCreateRequest {
  namespace_id: string;
  type: string;
  alias: string;
  config: Record<string, any>;
}

export interface ProviderUpdateRequest {
  type?: string;
  alias?: string;
  config?: Record<string, any>;
}

// Provider API methods
export async function fetchProviders(): Promise<Provider[]> {
  const data = await defaultApiClient().apiCall<{ results: Provider[] }>(
    "/providers"
  );
  return data.results;
}

export async function fetchProviderType(
  providerType: string
): Promise<ProviderType> {
  return await defaultApiClient().apiCall<ProviderType>(
    `/provider_types/${providerType}`
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

// Dev Mode API methods
export interface DevTriggerSyncRequest {
  workflow_id: string;
  triggers: any[]; // TriggerMetadata[]
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
    // Check if this is a trigger failure error
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
