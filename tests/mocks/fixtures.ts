/**
 * Mock API response fixtures for testing
 * These fixtures provide realistic mock data for all backend API endpoints
 */

import type {
  Namespace,
  Workflow,
  Provider,
  ProviderType,
  DevTriggerSyncResponse,
  RuntimeCreateResponse,
  RuntimeStatusResponse,
  WorkflowDeploymentResponse,
  PushTokenResponse,
} from "../../src/cli/api/apiMethods";

// Mock Namespaces
export const mockNamespace: Namespace = {
  id: "test-namespace-id",
  user_owner_id: "test-user-123",
  organization: {
    id: "test-org-123",
    name: "test-org",
    display_name: "Test Organization",
  },
};

export const mockNamespaces: Namespace[] = [mockNamespace];

// Mock Workflows
export const mockWorkflow: Workflow = {
  id: "test-workflow-123",
  name: "Test Workflow",
  description: "A test workflow for unit testing",
  namespace_id: "test-namespace-id",
  namespace_name: "test-org",
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

export const mockWorkflows: Workflow[] = [mockWorkflow];

// Mock Providers
export const mockSlackProvider: Provider = {
  id: "provider-slack-123",
  namespace_id: "test-namespace-id",
  type: "slack",
  alias: "my-slack",
  config: {
    bot_token: "xoxb-mock-token",
  },
};

export const mockGitlabProvider: Provider = {
  id: "provider-gitlab-123",
  namespace_id: "test-namespace-id",
  type: "gitlab",
  alias: "my-gitlab",
  config: {
    access_token: "glpat-mock-token",
    base_url: "https://gitlab.com",
  },
};

export const mockProviders: Provider[] = [
  mockSlackProvider,
  mockGitlabProvider,
];

// Mock Provider Types (schemas)
export const mockSlackProviderType: ProviderType = {
  provider_type: "slack",
  setup_steps: [
    {
      type: "text",
      title: "Bot Token",
      alias: "bot_token",
      required: true,
      description: "Your Slack bot token (starts with xoxb-)",
      placeholder: "xoxb-...",
    },
  ],
};

export const mockGitlabProviderType: ProviderType = {
  provider_type: "gitlab",
  setup_steps: [
    {
      type: "text",
      title: "Access Token",
      alias: "access_token",
      required: true,
      description: "Your GitLab personal access token",
      placeholder: "glpat-...",
    },
    {
      type: "text",
      title: "Base URL",
      alias: "base_url",
      required: false,
      description: "GitLab instance URL (defaults to gitlab.com)",
      default: "https://gitlab.com",
    },
  ],
};

export const mockGithubProviderType: ProviderType = {
  provider_type: "github",
  setup_steps: [
    {
      type: "text",
      title: "Access Token",
      alias: "access_token",
      required: true,
      description: "Your GitHub personal access token",
      placeholder: "ghp_...",
    },
  ],
};

// Mock Dev Trigger Sync Response
export const mockDevTriggerSyncResponse: DevTriggerSyncResponse = {
  webhooks: [
    {
      id: "webhook-123",
      url: "https://api.usefloww.dev/webhooks/test-webhook-123",
      path: "/webhook",
      method: "POST",
    },
  ],
};

// Mock Runtime Responses
export const mockRuntimeCreateResponse: RuntimeCreateResponse = {
  id: "runtime-123",
  config: { image_hash: "sha256:abcdef123456" },
  creation_status: "pending",
  creation_logs: [],
};

export const mockRuntimeStatusResponse: RuntimeStatusResponse = {
  id: "runtime-123",
  config: { image_hash: "sha256:abcdef123456" },
  creation_status: "ready",
  creation_logs: [
    { timestamp: "2025-01-01T00:00:00Z", message: "Building runtime..." },
    { timestamp: "2025-01-01T00:00:05Z", message: "Runtime ready" },
  ],
};

// Mock Push Token Response
export const mockPushTokenResponse: PushTokenResponse = {
  password: "mock-registry-token",
  expires_in: 3600,
  image_tag: "sha256:abcdef123456",
  registry_url: "registry.usefloww.dev",
};

// Mock Workflow Deployment Response
export const mockWorkflowDeploymentResponse: WorkflowDeploymentResponse = {
  id: "deployment-123",
  workflow_id: "test-workflow-123",
  workflow_name: "Test Workflow",
  runtime_id: "runtime-123",
  runtime_name: "Runtime v1",
  deployed_by_id: "test-user-123",
  status: "deployed",
  deployed_at: "2025-01-01T00:00:00Z",
  note: "Test deployment",
  user_code: {
    files: {
      "index.ts": "export default async function handler() {}",
    },
    entrypoint: "index.ts",
  },
  webhooks: [
    {
      id: "webhook-456",
      url: "https://api.usefloww.dev/webhooks/prod-webhook-456",
      path: "/api/webhook",
      method: "POST",
    },
  ],
};

export const mockWorkflowDeployments: WorkflowDeploymentResponse[] = [
  mockWorkflowDeploymentResponse,
];

// Mock WorkOS Auth Response
export const mockWorkOSTokenResponse = {
  access_token: "mock-access-token-123",
  refresh_token: "mock-refresh-token-456",
  expires_in: 3600,
  token_type: "Bearer",
};

export const mockWorkOSDeviceAuthResponse = {
  device_code: "mock-device-code-123",
  user_code: "MOCK-CODE",
  verification_uri: "https://auth.workos.com/activate",
  expires_in: 600,
  interval: 5,
};

// Helper to create custom mock data
export function createMockNamespace(
  overrides: Partial<Namespace> = {}
): Namespace {
  return { ...mockNamespace, ...overrides };
}

export function createMockWorkflow(
  overrides: Partial<Workflow> = {}
): Workflow {
  return { ...mockWorkflow, ...overrides };
}

export function createMockProvider(
  overrides: Partial<Provider> = {}
): Provider {
  return { ...mockSlackProvider, ...overrides };
}
