/**
 * Unit tests for dev mode functionality
 * These tests verify dev mode trigger synchronization and WebSocket handling
 */

import { describe, it, expect, vi } from "vitest";
import { syncDevTriggers } from "../../src/cli/api/apiMethods";
import { MockCentrifuge } from "../setup";

describe("Dev Mode Unit Tests", () => {
  describe("Trigger Synchronization", () => {
    it("should sync triggers and return webhook URLs", async () => {
      const result = await syncDevTriggers({
        workflow_id: "test-workflow-123",
        triggers: [
          {
            type: "webhook",
            path: "/test",
            method: "POST",
          },
        ],
      });

      expect(result).toHaveProperty("webhooks");
      expect(result.webhooks).toBeInstanceOf(Array);
      expect(result.webhooks.length).toBeGreaterThan(0);

      // Verify webhook structure
      const webhook = result.webhooks[0];
      expect(webhook).toHaveProperty("id");
      expect(webhook).toHaveProperty("url");
      expect(webhook.url).toContain("https://");
    });

    it("should handle multiple triggers", async () => {
      const result = await syncDevTriggers({
        workflow_id: "test-workflow-123",
        triggers: [
          {
            type: "webhook",
            path: "/webhook1",
            method: "POST",
          },
          {
            type: "webhook",
            path: "/webhook2",
            method: "GET",
          },
          {
            type: "cron",
            expression: "*/5 * * * *",
          },
        ],
      });

      expect(result.webhooks).toBeInstanceOf(Array);
      expect(result.webhooks.length).toBe(3);
    });

    it("should preserve trigger metadata in webhooks", async () => {
      const result = await syncDevTriggers({
        workflow_id: "test-workflow-123",
        triggers: [
          {
            type: "webhook",
            path: "/custom-path",
            method: "PUT",
          },
        ],
      });

      const webhook = result.webhooks[0];
      expect(webhook.path).toBe("/custom-path");
      expect(webhook.method).toBe("PUT");
    });

    it("should handle cron triggers", async () => {
      const result = await syncDevTriggers({
        workflow_id: "test-workflow-123",
        triggers: [
          {
            type: "cron",
            expression: "*/1 * * * * *",
          },
        ],
      });

      expect(result.webhooks).toBeInstanceOf(Array);
      expect(result.webhooks.length).toBeGreaterThan(0);
    });

    it("should handle empty trigger list", async () => {
      const result = await syncDevTriggers({
        workflow_id: "test-workflow-123",
        triggers: [],
      });

      expect(result.webhooks).toBeInstanceOf(Array);
      expect(result.webhooks.length).toBe(0);
    });
  });

  describe("WebSocket Connection (Mocked)", () => {
    it("should create a Centrifuge connection", () => {
      const centrifuge = new MockCentrifuge("wss://test-server.com/ws");

      expect(centrifuge).toBeDefined();
      expect(typeof centrifuge.connect).toBe("function");
      expect(typeof centrifuge.disconnect).toBe("function");
    });

    it("should emit connected event when connected", () => {
      const centrifuge = new MockCentrifuge("wss://test-server.com/ws");
      const onConnected = vi.fn();

      centrifuge.on("connected", onConnected);
      centrifuge.connect();

      expect(onConnected).toHaveBeenCalledTimes(1);
    });

    it("should emit disconnected event when disconnected", () => {
      const centrifuge = new MockCentrifuge("wss://test-server.com/ws");
      const onDisconnected = vi.fn();

      centrifuge.on("disconnected", onDisconnected);
      centrifuge.connect();
      centrifuge.disconnect();

      expect(onDisconnected).toHaveBeenCalledTimes(1);
    });

    it("should create subscriptions", () => {
      const centrifuge = new MockCentrifuge("wss://test-server.com/ws");
      const subscription = centrifuge.newSubscription("test-channel");

      expect(subscription).toBeDefined();
      expect(typeof subscription.subscribe).toBe("function");
      expect(typeof subscription.unsubscribe).toBe("function");
    });

    it("should emit subscribed event when subscription succeeds", () => {
      const centrifuge = new MockCentrifuge("wss://test-server.com/ws");
      const subscription = centrifuge.newSubscription("test-channel");
      const onSubscribed = vi.fn();

      subscription.on("subscribed", onSubscribed);
      subscription.subscribe();

      expect(onSubscribed).toHaveBeenCalledTimes(1);
      expect(onSubscribed).toHaveBeenCalledWith(
        expect.objectContaining({ channel: "test-channel" })
      );
    });

    it("should handle multiple subscriptions", () => {
      const centrifuge = new MockCentrifuge("wss://test-server.com/ws");

      const sub1 = centrifuge.newSubscription("channel-1");
      const sub2 = centrifuge.newSubscription("channel-2");

      const onSub1 = vi.fn();
      const onSub2 = vi.fn();

      sub1.on("subscribed", onSub1);
      sub2.on("subscribed", onSub2);

      sub1.subscribe();
      sub2.subscribe();

      expect(onSub1).toHaveBeenCalledTimes(1);
      expect(onSub2).toHaveBeenCalledTimes(1);
    });

    it("should receive messages on subscribed channel", () => {
      const centrifuge = new MockCentrifuge("wss://test-server.com/ws");
      const subscription = centrifuge.newSubscription("test-channel");
      const onMessage = vi.fn();

      subscription.on("publication", onMessage);
      subscription.subscribe();

      // Simulate receiving a message
      (subscription as any).__simulateMessage({ event: "trigger_fired" });

      expect(onMessage).toHaveBeenCalledTimes(1);
      expect(onMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: "test-channel",
          data: { event: "trigger_fired" },
        })
      );
    });

    it("should unsubscribe from channels", () => {
      const centrifuge = new MockCentrifuge("wss://test-server.com/ws");
      const subscription = centrifuge.newSubscription("test-channel");
      const onUnsubscribed = vi.fn();

      subscription.on("unsubscribed", onUnsubscribed);
      subscription.subscribe();
      subscription.unsubscribe();

      expect(onUnsubscribed).toHaveBeenCalledTimes(1);
    });
  });

  describe("Dev Mode Workflow", () => {
    it("should support complete dev mode lifecycle", async () => {
      // 1. Sync triggers
      const syncResult = await syncDevTriggers({
        workflow_id: "test-workflow-123",
        triggers: [
          {
            type: "webhook",
            path: "/test",
            method: "POST",
          },
        ],
      });

      expect(syncResult.webhooks.length).toBeGreaterThan(0);

      // 2. Create WebSocket connection
      const centrifuge = new MockCentrifuge(
        "wss://ws.usefloww.dev/connection/websocket"
      );
      centrifuge.connect();

      // 3. Subscribe to workflow channel
      const subscription = centrifuge.newSubscription(
        `workflow:test-workflow-123`
      );
      const onTriggerFired = vi.fn();

      subscription.on("publication", onTriggerFired);
      subscription.subscribe();

      // 4. Simulate trigger event
      (subscription as any).__simulateMessage({
        type: "trigger_fired",
        triggerId: "trigger-123",
        timestamp: Date.now(),
      });

      expect(onTriggerFired).toHaveBeenCalledTimes(1);

      // 5. Cleanup
      subscription.unsubscribe();
      centrifuge.disconnect();
    });
  });

  describe("Error Scenarios", () => {
    it("should handle empty workflow ID", async () => {
      const result = await syncDevTriggers({
        workflow_id: "",
        triggers: [],
      });

      expect(result).toHaveProperty("webhooks");
    });

    it("should handle WebSocket disconnection gracefully", () => {
      const centrifuge = new MockCentrifuge("wss://test-server.com/ws");
      const onConnected = vi.fn();
      const onDisconnected = vi.fn();

      centrifuge.on("connected", onConnected);
      centrifuge.on("disconnected", onDisconnected);

      centrifuge.connect();
      expect(onConnected).toHaveBeenCalledTimes(1);

      centrifuge.disconnect();
      expect(onDisconnected).toHaveBeenCalledTimes(1);
    });

    it("should handle resubscription", () => {
      const centrifuge = new MockCentrifuge("wss://test-server.com/ws");
      const subscription = centrifuge.newSubscription("test-channel");
      const onSubscribed = vi.fn();

      subscription.on("subscribed", onSubscribed);

      subscription.subscribe();
      expect(onSubscribed).toHaveBeenCalledTimes(1);

      subscription.unsubscribe();
      subscription.subscribe();
      expect(onSubscribed).toHaveBeenCalledTimes(2);
    });
  });

  describe("Webhook URL Format", () => {
    it("should return valid HTTPS URLs", async () => {
      const result = await syncDevTriggers({
        workflow_id: "test-workflow-123",
        triggers: [
          {
            type: "webhook",
            path: "/test",
            method: "POST",
          },
        ],
      });

      const webhook = result.webhooks[0];
      expect(webhook.url).toMatch(/^https:\/\//);
    });

    it("should include webhook ID in response", async () => {
      const result = await syncDevTriggers({
        workflow_id: "test-workflow-123",
        triggers: [
          {
            type: "webhook",
            path: "/test",
            method: "POST",
          },
        ],
      });

      const webhook = result.webhooks[0];
      expect(webhook.id).toBeDefined();
      expect(typeof webhook.id).toBe("string");
      expect(webhook.id.length).toBeGreaterThan(0);
    });
  });
});
