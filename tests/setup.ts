/**
 * Global test setup file
 * This file is loaded before all tests via vitest.config.ts setupFiles
 */

import { beforeAll, afterEach, afterAll, vi } from "vitest";
import { setupServer } from "msw/node";
import { handlers } from "./mocks/handlers";

// Create MSW server instance with handlers
export const server = setupServer(...handlers);

// Start MSW server before all tests
beforeAll(() => {
  server.listen({
    onUnhandledRequest: "warn", // Warn about unhandled requests instead of failing
  });
});

// Reset handlers after each test to ensure test isolation
afterEach(() => {
  server.resetHandlers();
});

// Clean up after all tests are done
afterAll(() => {
  server.close();
});

// ===== Mock getValidAuth() =====
// This ensures tests don't require real authentication tokens

vi.mock("../src/cli/auth/tokenUtils", () => ({
  getValidAuth: vi.fn(async () => ({
    accessToken: "mock-access-token-123",
    refreshToken: "mock-refresh-token-456",
    expiresAt: Date.now() + 3600000, // 1 hour from now
    user: {
      id: "test-user-123",
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
    },
  })),
  saveAuth: vi.fn(async () => {}),
  clearAuth: vi.fn(async () => {}),
}));

// ===== Mock Centrifuge WebSocket Client =====
// This prevents tests from trying to establish real WebSocket connections

class MockCentrifuge {
  private subscriptions = new Map<string, any>();
  private connected = false;
  private listeners = new Map<string, Set<Function>>();

  constructor(_url: string, _options?: any) {
    // Mock constructor - doesn't actually connect
  }

  connect() {
    this.connected = true;
    this.emit("connected", {});
    return this;
  }

  disconnect() {
    this.connected = false;
    this.emit("disconnected", {});
    return this;
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return this;
  }

  off(event: string, callback?: Function) {
    if (callback) {
      this.listeners.get(event)?.delete(callback);
    } else {
      this.listeners.delete(event);
    }
    return this;
  }

  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => cb(data));
    }
  }

  newSubscription(channel: string, _options?: any) {
    const subscription = new MockSubscription(channel, this);
    this.subscriptions.set(channel, subscription);
    return subscription;
  }

  getSubscription(channel: string) {
    return this.subscriptions.get(channel);
  }

  // Helper for tests to simulate events
  __simulateEvent(event: string, data: any) {
    this.emit(event, data);
  }
}

class MockSubscription {
  private channel: string;
  private centrifuge: MockCentrifuge;
  private subscribed = false;
  private listeners = new Map<string, Set<Function>>();

  constructor(channel: string, centrifuge: MockCentrifuge) {
    this.channel = channel;
    this.centrifuge = centrifuge;
  }

  subscribe() {
    this.subscribed = true;
    this.emit("subscribed", { channel: this.channel });
    return this;
  }

  unsubscribe() {
    this.subscribed = false;
    this.emit("unsubscribed", { channel: this.channel });
    return this;
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return this;
  }

  off(event: string, callback?: Function) {
    if (callback) {
      this.listeners.get(event)?.delete(callback);
    } else {
      this.listeners.delete(event);
    }
    return this;
  }

  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => cb(data));
    }
  }

  publish(data: any) {
    // Mock publish - emit it locally for testing
    this.emit("publication", { channel: this.channel, data });
    return Promise.resolve();
  }

  // Helper for tests to simulate incoming messages
  __simulateMessage(data: any) {
    this.emit("publication", { channel: this.channel, data });
  }
}

// Mock the centrifuge module
vi.mock("centrifuge", () => ({
  Centrifuge: MockCentrifuge,
  default: MockCentrifuge,
}));

// ===== Mock node-fetch to work with MSW =====
// MSW intercepts fetch calls, so we need to ensure the CLI uses the global fetch

// No additional mocking needed - MSW handles fetch interception automatically

// ===== Environment setup =====
// Set test environment variables
process.env.FLOWW_NAMESPACE_ID = "test-namespace-id";
process.env.NODE_ENV = "test";

// Initialize config for unit tests
import { setConfig } from "../src/cli/config/configUtils";

setConfig({
  workosClientId: "client_test",
  backendUrl: "https://api.usefloww.dev",
  workosApiUrl: "https://api.workos.com",
  websocketUrl: "wss://ws.usefloww.dev/connection/websocket",
  registryUrl: "registry.usefloww.dev",
});

// Suppress console logs during tests (optional - uncomment if needed)
// vi.spyOn(console, "log").mockImplementation(() => {});
// vi.spyOn(console, "warn").mockImplementation(() => {});
// vi.spyOn(console, "error").mockImplementation(() => {});

/**
 * Export helpers for tests to use
 */
export { MockCentrifuge, MockSubscription };
