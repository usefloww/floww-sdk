/**
 * Unit tests for API client methods
 * These tests verify API client functionality without spawning CLI commands
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  fetchNamespaces,
  fetchWorkflows,
  fetchWorkflow,
  createWorkflow,
  fetchProviders,
  fetchProviderType,
  createProvider,
  updateProvider,
  deleteProvider,
  syncDevTriggers,
  getPushData,
  createRuntime,
  getRuntimeStatus,
  createWorkflowDeployment,
  listWorkflowDeployments,
} from "../../src/cli/api/apiMethods";

describe("API Client Unit Tests", () => {
  describe("Namespace API", () => {
    it("should fetch namespaces", async () => {
      const namespaces = await fetchNamespaces();

      expect(namespaces).toBeInstanceOf(Array);
      expect(namespaces.length).toBeGreaterThan(0);
      expect(namespaces[0]).toHaveProperty("id");
      expect(namespaces[0].id).toBe("test-namespace-id");
    });
  });

  describe("Workflow API", () => {
    it("should fetch workflows", async () => {
      const workflows = await fetchWorkflows();

      expect(workflows).toBeInstanceOf(Array);
      expect(workflows.length).toBeGreaterThan(0);
      expect(workflows[0]).toHaveProperty("id");
      expect(workflows[0]).toHaveProperty("name");
    });

    it("should fetch a single workflow by ID", async () => {
      const workflow = await fetchWorkflow("test-workflow-123");

      expect(workflow).toHaveProperty("id", "test-workflow-123");
      expect(workflow).toHaveProperty("name", "Test Workflow");
      expect(workflow).toHaveProperty("namespace_id", "test-namespace-id");
    });

    it("should create a new workflow", async () => {
      const newWorkflow = await createWorkflow(
        "New Test Workflow",
        "test-namespace-id",
        "A new workflow for testing"
      );

      expect(newWorkflow).toHaveProperty("name", "New Test Workflow");
      expect(newWorkflow).toHaveProperty("namespace_id", "test-namespace-id");
      expect(newWorkflow).toHaveProperty("description", "A new workflow for testing");
    });
  });

  describe("Provider API", () => {
    it("should fetch providers", async () => {
      const providers = await fetchProviders();

      expect(providers).toBeInstanceOf(Array);
      expect(providers.length).toBeGreaterThan(0);
      expect(providers[0]).toHaveProperty("type");
      expect(providers[0]).toHaveProperty("alias");
    });

    it("should fetch provider type schema for slack", async () => {
      const providerType = await fetchProviderType("slack");

      expect(providerType).toHaveProperty("provider_type", "slack");
      expect(providerType).toHaveProperty("setup_steps");
      expect(providerType.setup_steps).toBeInstanceOf(Array);
      expect(providerType.setup_steps.length).toBeGreaterThan(0);
    });

    it("should fetch provider type schema for gitlab", async () => {
      const providerType = await fetchProviderType("gitlab");

      expect(providerType).toHaveProperty("provider_type", "gitlab");
      expect(providerType.setup_steps).toBeInstanceOf(Array);
    });

    it("should fetch provider type schema for github", async () => {
      const providerType = await fetchProviderType("github");

      expect(providerType).toHaveProperty("provider_type", "github");
      expect(providerType.setup_steps).toBeInstanceOf(Array);
    });

    it("should create a new provider", async () => {
      const newProvider = await createProvider({
        namespace_id: "test-namespace-id",
        type: "slack",
        alias: "my-new-slack",
        config: {
          bot_token: "xoxb-test-token",
        },
      });

      expect(newProvider).toHaveProperty("type", "slack");
      expect(newProvider).toHaveProperty("alias", "my-new-slack");
      expect(newProvider).toHaveProperty("namespace_id", "test-namespace-id");
    });

    it("should update a provider", async () => {
      const updatedProvider = await updateProvider("provider-slack-123", {
        alias: "updated-slack-alias",
      });

      expect(updatedProvider).toHaveProperty("id", "provider-slack-123");
    });

    it("should delete a provider", async () => {
      // Should not throw
      await expect(deleteProvider("provider-slack-123")).resolves.not.toThrow();
    });
  });

  describe("Dev Mode API", () => {
    it("should sync dev triggers and get webhook URLs", async () => {
      const response = await syncDevTriggers({
        workflow_id: "test-workflow-123",
        triggers: [
          {
            type: "webhook",
            path: "/test",
            method: "POST",
          },
        ],
      });

      expect(response).toHaveProperty("webhooks");
      expect(response.webhooks).toBeInstanceOf(Array);
      expect(response.webhooks.length).toBeGreaterThan(0);
      expect(response.webhooks[0]).toHaveProperty("url");
      expect(response.webhooks[0]).toHaveProperty("id");
    });
  });

  describe("Runtime API", () => {
    it("should get push token for Docker registry", async () => {
      const pushData = await getPushData("sha256:test-hash");

      expect(pushData).not.toBeNull();
      expect(pushData).toHaveProperty("password");
      expect(pushData).toHaveProperty("registry_url");
      expect(pushData).toHaveProperty("expires_in");
      expect(pushData).toHaveProperty("image_tag");
    });

    it("should return null when image already exists (409)", async () => {
      const pushData = await getPushData("sha256:already-exists");

      expect(pushData).toBeNull();
    });

    it("should create a new runtime", async () => {
      const runtime = await createRuntime({
        config: {
          image_hash: "sha256:new-image-hash",
        },
      });

      expect(runtime).toHaveProperty("id");
      expect(runtime).toHaveProperty("creation_status");
      expect(runtime).toHaveProperty("config");
    });

    it("should get runtime status", async () => {
      const status = await getRuntimeStatus("runtime-123");

      expect(status).toHaveProperty("id", "runtime-123");
      expect(status).toHaveProperty("creation_status");
    });
  });

  describe("Workflow Deployment API", () => {
    it("should create a workflow deployment", async () => {
      const deployment = await createWorkflowDeployment({
        workflow_id: "test-workflow-123",
        runtime_id: "runtime-123",
        code: {
          files: {
            "index.ts": "export default async function handler() {}",
          },
          entrypoint: "index.ts",
        },
        triggers: [
          {
            type: "webhook",
            path: "/api/webhook",
            method: "POST",
          },
        ],
      });

      expect(deployment).toHaveProperty("id");
      expect(deployment).toHaveProperty("workflow_id", "test-workflow-123");
      expect(deployment).toHaveProperty("runtime_id", "runtime-123");
      expect(deployment).toHaveProperty("status");
    });

    it("should list workflow deployments", async () => {
      const deployments = await listWorkflowDeployments();

      expect(deployments).toBeInstanceOf(Array);
      expect(deployments.length).toBeGreaterThan(0);
    });

    it("should list workflow deployments filtered by workflow ID", async () => {
      const deployments = await listWorkflowDeployments("test-workflow-123");

      expect(deployments).toBeInstanceOf(Array);
    });
  });
});
