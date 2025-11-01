/**
 * MSW (Mock Service Worker) request handlers
 * These handlers intercept HTTP requests and return mock responses
 */

import { http, HttpResponse } from "msw";
import {
  mockNamespaces,
  mockWorkflows,
  mockWorkflow,
  mockProviders,
  mockSlackProviderType,
  mockGitlabProviderType,
  mockGithubProviderType,
  mockDevTriggerSyncResponse,
  mockRuntimeCreateResponse,
  mockRuntimeStatusResponse,
  mockPushTokenResponse,
  mockWorkflowDeploymentResponse,
  mockWorkflowDeployments,
  mockWorkOSTokenResponse,
  mockWorkOSDeviceAuthResponse,
  createMockWorkflow,
  createMockProvider,
} from "./fixtures";

// Backend API base URL (from configTypes.ts default)
const BACKEND_URL = "https://api.usefloww.dev";
const WORKOS_URL = "https://api.workos.com";

/**
 * MSW handlers for all backend API endpoints
 */
export const handlers = [
  // ===== Namespace API =====
  http.get(`${BACKEND_URL}/api/namespaces`, () => {
    return HttpResponse.json({ results: mockNamespaces });
  }),

  // ===== Workflow API =====
  http.get(`${BACKEND_URL}/api/workflows`, () => {
    return HttpResponse.json({ results: mockWorkflows });
  }),

  http.get(`${BACKEND_URL}/api/workflows/:id`, ({ params }) => {
    const { id } = params;
    const workflow = mockWorkflows.find((w) => w.id === id) || mockWorkflow;
    return HttpResponse.json(workflow);
  }),

  http.post(`${BACKEND_URL}/api/workflows`, async ({ request }) => {
    const body = (await request.json()) as any;
    const newWorkflow = createMockWorkflow({
      id: `workflow-${Date.now()}`,
      name: body.name,
      description: body.description,
      namespace_id: body.namespace_id,
    });
    return HttpResponse.json(newWorkflow, { status: 201 });
  }),

  // ===== Provider API =====
  http.get(`${BACKEND_URL}/api/providers`, () => {
    return HttpResponse.json({ results: mockProviders });
  }),

  http.get(`${BACKEND_URL}/api/provider_types/:type`, ({ params }) => {
    const { type } = params;

    // Return appropriate provider type schema based on the type
    const providerTypeMap: Record<string, any> = {
      slack: mockSlackProviderType,
      gitlab: mockGitlabProviderType,
      github: mockGithubProviderType,
    };

    const providerType = providerTypeMap[type as string];

    if (!providerType) {
      return HttpResponse.json(
        { error: `Provider type '${type}' not found` },
        { status: 404 }
      );
    }

    return HttpResponse.json(providerType);
  }),

  http.post(`${BACKEND_URL}/api/providers`, async ({ request }) => {
    const body = (await request.json()) as any;
    const newProvider = createMockProvider({
      id: `provider-${Date.now()}`,
      type: body.type,
      alias: body.alias,
      namespace_id: body.namespace_id,
      config: body.config,
    });
    return HttpResponse.json(newProvider, { status: 201 });
  }),

  http.patch(
    `${BACKEND_URL}/api/providers/:id`,
    async ({ params, request }) => {
      const { id } = params;
      const body = (await request.json()) as any;
      const existingProvider = mockProviders.find((p) => p.id === id);

      const updatedProvider = createMockProvider({
        ...existingProvider,
        ...body,
        id: id as string,
      });

      return HttpResponse.json(updatedProvider);
    }
  ),

  http.delete(`${BACKEND_URL}/api/providers/:id`, () => {
    return HttpResponse.json({}, { status: 204 });
  }),

  // ===== Dev Mode API =====
  http.post(`${BACKEND_URL}/api/dev/sync-triggers`, async ({ request }) => {
    const body = (await request.json()) as any;

    // Generate webhook URLs for each trigger
    const webhooks = body.triggers.map((_trigger: any, index: number) => ({
      id: `webhook-${Date.now()}-${index}`,
      url: `${BACKEND_URL}/webhooks/dev-${Date.now()}-${index}`,
      path: _trigger.path || "/webhook",
      method: _trigger.method || "POST",
    }));

    return HttpResponse.json({ webhooks });
  }),

  // ===== Runtime API =====
  http.post(`${BACKEND_URL}/api/runtimes/push_token`, async ({ request }) => {
    const body = (await request.json()) as any;

    // Simulate image already exists error occasionally
    if (body.image_hash === "sha256:already-exists") {
      return HttpResponse.json(
        { error: "Image already exists" },
        { status: 409 }
      );
    }

    return HttpResponse.json(mockPushTokenResponse);
  }),

  http.post(`${BACKEND_URL}/api/runtimes`, async ({ request }) => {
    const body = (await request.json()) as any;

    // Simulate runtime already exists error
    if (body.config?.image_hash === "sha256:existing-runtime") {
      return HttpResponse.json(
        {
          error: "Runtime already exists",
          detail: { runtime_id: "runtime-existing-123" },
        },
        { status: 409 }
      );
    }

    return HttpResponse.json(mockRuntimeCreateResponse, { status: 201 });
  }),

  http.get(`${BACKEND_URL}/api/runtimes/:id`, ({ params }) => {
    return HttpResponse.json(mockRuntimeStatusResponse);
  }),

  // ===== Workflow Deployment API =====
  http.post(`${BACKEND_URL}/api/workflow_deployments`, async ({ request }) => {
    const body = (await request.json()) as any;

    const newDeployment = {
      ...mockWorkflowDeploymentResponse,
      id: `deployment-${Date.now()}`,
      workflow_id: body.workflow_id,
      runtime_id: body.runtime_id,
      user_code: body.code,
      deployed_at: new Date().toISOString(),
    };

    return HttpResponse.json(newDeployment, { status: 201 });
  }),

  http.get(`${BACKEND_URL}/api/workflow_deployments`, ({ request }) => {
    const url = new URL(request.url);
    const workflowId = url.searchParams.get("workflow_id");

    let deployments = mockWorkflowDeployments;

    if (workflowId) {
      deployments = deployments.filter((d) => d.workflow_id === workflowId);
    }

    return HttpResponse.json({ results: deployments });
  }),

  // ===== WorkOS Authentication API =====
  http.post(`${WORKOS_URL}/user_management/authenticate/device`, () => {
    return HttpResponse.json(mockWorkOSDeviceAuthResponse);
  }),

  http.post(`${WORKOS_URL}/user_management/authorize/device`, () => {
    return HttpResponse.json(mockWorkOSDeviceAuthResponse);
  }),

  http.post(`${WORKOS_URL}/user_management/token`, async ({ request }) => {
    const body = await request.text();

    // Parse form data
    const params = new URLSearchParams(body);
    const grantType = params.get("grant_type");

    // Handle different grant types
    if (grantType === "refresh_token") {
      return HttpResponse.json(mockWorkOSTokenResponse);
    }

    if (grantType === "urn:ietf:params:oauth:grant-type:device_code") {
      const deviceCode = params.get("device_code");

      // Simulate pending authorization
      if (deviceCode === "pending-device-code") {
        return HttpResponse.json(
          { error: "authorization_pending" },
          { status: 400 }
        );
      }

      return HttpResponse.json(mockWorkOSTokenResponse);
    }

    return HttpResponse.json(mockWorkOSTokenResponse);
  }),

  // Catch-all handler for unhandled requests (useful for debugging)
  http.get("*", ({ request }) => {
    console.warn(`Unhandled GET request: ${request.url}`);
    return HttpResponse.json({ error: "Not mocked" }, { status: 404 });
  }),

  http.post("*", ({ request }) => {
    console.warn(`Unhandled POST request: ${request.url}`);
    return HttpResponse.json({ error: "Not mocked" }, { status: 404 });
  }),
];

/**
 * Error response helpers for testing error scenarios
 */
export const errorHandlers = {
  unauthorized: http.get(`${BACKEND_URL}/api/*`, () => {
    return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
  }),

  serverError: http.get(`${BACKEND_URL}/api/*`, () => {
    return HttpResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }),

  networkError: http.get(`${BACKEND_URL}/api/*`, () => {
    return HttpResponse.error();
  }),
};
