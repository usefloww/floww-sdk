import { BaseProvider, BaseProviderConfig } from "./base";
import { executionContextManager } from "../cli/runtime/ExecutionContextManager";
import type {
  KVItem,
  Permission,
  TableListResponse,
  KeyListResponse,
  KeysWithValuesResponse,
  GrantPermissionRequest,
} from "../kv/types";
import { KVError } from "../kv/types";

export type KVStoreConfig = BaseProviderConfig;

/**
 * Represents a typed table in the KV store
 */
export class KVTable<T = any> {
  constructor(
    private client: KVClient,
    private tableName: string
  ) {}

  /**
   * Get a value from the table
   * Returns undefined if the key doesn't exist
   */
  async get(key: string): Promise<T | undefined> {
    return this.client.get<T>(this.tableName, key);
  }

  /**
   * Set a value in the table
   */
  async set(key: string, value: T): Promise<void> {
    return this.client.set<T>(this.tableName, key, value);
  }

  /**
   * Delete a key from the table
   */
  async delete(key: string): Promise<void> {
    return this.client.delete(this.tableName, key);
  }

  /**
   * List all keys in the table
   */
  async listKeys(): Promise<string[]> {
    return this.client.listKeys(this.tableName);
  }

  /**
   * List all items in the table with their values
   */
  async listItems(): Promise<KVItem<T>[]> {
    return this.client.listItems<T>(this.tableName);
  }

  /**
   * List permissions for this table
   */
  async listPermissions(): Promise<Permission[]> {
    return this.client.listPermissions(this.tableName);
  }

  /**
   * Grant permission to a workflow for this table
   */
  async grantPermission(
    workflowId: string,
    options: { read?: boolean; write?: boolean } = {}
  ): Promise<Permission> {
    return this.client.grantPermission(this.tableName, workflowId, options);
  }

  /**
   * Revoke permission from a workflow for this table
   */
  async revokePermission(workflowId: string): Promise<void> {
    return this.client.revokePermission(this.tableName, workflowId);
  }
}

/**
 * Internal client for making KV API requests
 */
class KVClient {
  constructor(
    private backendUrl: string,
    private providerCredential: string
  ) {}

  private async request<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<T> {
    const url = `${this.backendUrl}/api${path}`;
    const executionContext = executionContextManager.getContext();
    const authToken = executionContext.getAuthToken();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${authToken || ""}`,
    };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as any;
      throw new KVError(
        errorData.detail || `KV store request failed: ${response.statusText}`,
        response.status,
        errorData
      );
    }

    return response.json() as Promise<T>;
  }

  // Table operations
  async listTables(): Promise<string[]> {
    const result = await this.request<TableListResponse>("GET", `/kv/${this.providerCredential}`);
    return result.tables;
  }

  // Key operations
  async listKeys(table: string): Promise<string[]> {
    const result = await this.request<KeyListResponse>("GET", `/kv/${this.providerCredential}/${table}`);
    return result.keys;
  }

  async listItems<T = any>(table: string): Promise<KVItem<T>[]> {
    const result = await this.request<KeysWithValuesResponse<T>>(
      "GET",
      `/kv/${this.providerCredential}/${table}?include_values=true`
    );
    return result.items;
  }

  // Value operations
  async get<T = any>(table: string, key: string): Promise<T | undefined> {
    try {
      const result = await this.request<KVItem<T>>("GET", `/kv/${this.providerCredential}/${table}/${key}`);
      return result.value;
    } catch (error) {
      // Return undefined if key doesn't exist (404)
      if (error instanceof KVError && error.statusCode === 404) {
        return undefined;
      }
      // Re-throw other errors
      throw error;
    }
  }

  async set<T = any>(table: string, key: string, value: T): Promise<void> {
    await this.request("PUT", `/kv/${this.providerCredential}/${table}/${key}`, { value });
  }

  async delete(table: string, key: string): Promise<void> {
    await this.request("DELETE", `/kv/${this.providerCredential}/${table}/${key}`);
  }

  // Permission operations
  async listPermissions(table: string): Promise<Permission[]> {
    return this.request<Permission[]>("GET", `/kv/${this.providerCredential}/permissions/${table}`);
  }

  async grantPermission(
    table: string,
    workflowId: string,
    options: { read?: boolean; write?: boolean } = {}
  ): Promise<Permission> {
    const request: GrantPermissionRequest = {
      workflow_id: workflowId,
      can_read: options.read ?? true,
      can_write: options.write ?? false,
    };
    return this.request<Permission>("POST", `/kv/${this.providerCredential}/permissions/${table}`, request);
  }

  async revokePermission(table: string, workflowId: string): Promise<void> {
    await this.request("DELETE", `/kv/${this.providerCredential}/permissions/${table}/${workflowId}`);
  }
}

/**
 * KVStore provider for key-value storage.
 * Each provider instance represents a namespace for KV data.
 * Tables exist within the provider namespace.
 *
 * @example
 * ```typescript
 * import { KVStore } from 'floww';
 *
 * const kv = new KVStore('my-kv');
 *
 * // Get a typed table reference
 * interface User {
 *   name: string;
 *   email: string;
 * }
 * const users = kv.getTable<User>('users');
 *
 * // Store data
 * await users.set('user-123', { name: 'Alice', email: 'alice@example.com' });
 *
 * // Retrieve data (returns undefined if not found)
 * const user = await users.get('user-123');
 * if (user) {
 *   console.log(user.name); // Type-safe!
 * }
 *
 * // List all keys in table
 * const keys = await users.listKeys();
 *
 * // List tables
 * const tables = await kv.listTables();
 * ```
 */
export class KVStore extends BaseProvider {
  private client?: KVClient;

  constructor(config?: KVStoreConfig | string) {
    super("kvstore", config);
  }

  /**
   * Get a typed table reference for easier operations
   *
   * @example
   * ```typescript
   * interface User {
   *   name: string;
   *   email: string;
   * }
   * const users = kv.getTable<User>('users');
   * await users.set('user-123', { name: 'Alice', email: 'alice@example.com' });
   *
   * const user = await users.get('user-123'); // Type: User | undefined
   * if (user) {
   *   console.log(user.name); // Type-safe access
   * }
   * ```
   */
  getTable<T = any>(tableName: string): KVTable<T> {
    return new KVTable<T>(this.getClient(), tableName);
  }

  private getClient(): KVClient {
    if (!this.client) {
      // Check if execution context is available
      if (!executionContextManager.hasContext()) {
        throw new Error(
          "KVStore can only be used within a handler (webhook, cron, or realtime). " +
          "Make sure you're calling KV methods inside your handler function, not at module level."
        );
      }

      const executionContext = executionContextManager.getContext();

      // Get backend URL from context
      const backendUrl = executionContext.getBackendUrl();
      if (!backendUrl) {
        throw new Error(
          "Backend URL not available in execution context. " +
          "This should be set automatically from the event or environment variable FLOWW_BACKEND_URL."
        );
      }

      // Get auth token from context
      const authToken = executionContext.getAuthToken();
      if (!authToken) {
        throw new Error(
          "Auth token not available in execution context. " +
          "In development, make sure you're authenticated with 'floww auth login'. " +
          "In production, the backend should include auth_token in event payloads."
        );
      }

      this.client = new KVClient(backendUrl, this.credentialName);
    }
    return this.client;
  }

  // No triggers for now
  triggers = {};

  // KV actions exposed as methods
  /**
   * List all tables in this KV namespace
   */
  async listTables(): Promise<string[]> {
    return this.getClient().listTables();
  }

  /**
   * List all keys in a table
   */
  async listKeys(table: string): Promise<string[]> {
    return this.getClient().listKeys(table);
  }

  /**
   * List all items in a table with their values
   */
  async listItems<T = any>(table: string): Promise<KVItem<T>[]> {
    return this.getClient().listItems<T>(table);
  }

  /**
   * Get a value from the KV store
   * Returns undefined if the key doesn't exist
   */
  async get<T = any>(table: string, key: string): Promise<T | undefined> {
    return this.getClient().get<T>(table, key);
  }

  /**
   * Set a value in the KV store
   */
  async set<T = any>(table: string, key: string, value: T): Promise<void> {
    return this.getClient().set<T>(table, key, value);
  }

  /**
   * Delete a key from the KV store
   */
  async delete(table: string, key: string): Promise<void> {
    return this.getClient().delete(table, key);
  }

  /**
   * List permissions for a table
   */
  async listPermissions(table: string): Promise<Permission[]> {
    return this.getClient().listPermissions(table);
  }

  /**
   * Grant permission to a workflow for a table
   */
  async grantPermission(
    table: string,
    workflowId: string,
    options: { read?: boolean; write?: boolean } = {}
  ): Promise<Permission> {
    return this.getClient().grantPermission(table, workflowId, options);
  }

  /**
   * Revoke permission from a workflow for a table
   */
  async revokePermission(table: string, workflowId: string): Promise<void> {
    return this.getClient().revokePermission(table, workflowId);
  }

  // Required by BaseProvider but KVStore doesn't use traditional actions pattern
  actions = {};
}
