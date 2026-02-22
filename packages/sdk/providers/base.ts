import { Provider, SecretDefinition, Trigger } from "../common";
import { getProviderConfig, trackProviderUsage } from "../userCode/providers";
import type { ZodType } from "zod";

// ============================================================================
// Server-Side Interfaces for Provider Implementations
// ============================================================================

/**
 * Setup step types for provider configuration UI
 */
export type SetupStep =
  | SetupStepValue
  | SetupStepSecret
  | SetupStepOAuth
  | SetupStepWebhook
  | SetupStepChoice;

export interface SetupStepShowWhen {
  field: string;
  value: string;
}

export interface SetupStepValue {
  type: "value";
  key: string;
  label: string;
  description?: string;
  required: boolean;
  placeholder?: string;
  showWhen?: SetupStepShowWhen;
}

export interface SetupStepSecret {
  type: "secret";
  key: string;
  label: string;
  description?: string;
  required: boolean;
  placeholder?: string;
  showWhen?: SetupStepShowWhen;
}

export interface SetupStepChoice {
  type: "choice";
  key: string;
  label: string;
  description?: string;
  required: boolean;
  options: string[];
}

export interface SetupStepOAuth {
  type: "oauth";
  provider: string;
  scopes: string[];
  description?: string;
}

export interface SetupStepWebhook {
  type: "webhook";
  key: string;
  label: string;
  description: string;
}

/**
 * Context passed to trigger lifecycle create method
 */
export interface TriggerCreateContext<TInput, TSecrets = Record<string, string>> {
  input: TInput;
  webhookUrl: string;
  providerId: string;
  triggerId: string;
  secrets: TSecrets;
}

/**
 * Context passed to trigger lifecycle destroy method
 */
export interface TriggerDestroyContext<TInput, TState, TSecrets = Record<string, string>> {
  input: TInput;
  state: TState;
  providerId: string;
  triggerId: string;
  secrets: TSecrets;
}

/**
 * Context passed to trigger lifecycle refresh method
 */
export interface TriggerRefreshContext<TInput, TState, TSecrets = Record<string, string>> {
  input: TInput;
  state: TState;
  providerId: string;
  triggerId: string;
  secrets: TSecrets;
}

/**
 * Trigger lifecycle methods for managing external resources (webhooks, subscriptions, etc.)
 */
export interface TriggerLifecycle<TInput, TState, TSecrets = Record<string, string>> {
  /** Called when trigger is created - register webhooks with external APIs */
  create(ctx: TriggerCreateContext<TInput, TSecrets>): Promise<TState>;

  /** Called when trigger is destroyed - cleanup external webhooks */
  destroy(ctx: TriggerDestroyContext<TInput, TState, TSecrets>): Promise<void>;

  /** Called periodically to verify trigger state is valid */
  refresh(ctx: TriggerRefreshContext<TInput, TState, TSecrets>): Promise<TState>;
}

/**
 * Incoming webhook request data
 */
export interface WebhookRequest {
  headers: Record<string, string>;
  body: unknown;
  method: string;
  path: string;
}

/**
 * Result of webhook validation (for challenges like Slack URL verification)
 */
export interface WebhookValidationResult {
  valid: boolean;
  /** If true, return the response immediately (e.g., for Slack URL verification) */
  challenge?: boolean;
  /** Response to return for challenge */
  response?: unknown;
  /** HTTP status code for response */
  statusCode?: number;
}

/**
 * Trigger info passed to webhook processor
 */
export interface TriggerInfo {
  id: string;
  triggerType: string;
  input: Record<string, unknown>;
  state: Record<string, unknown>;
}

/**
 * Result of webhook processing - which triggers matched
 */
export interface WebhookMatch {
  triggerId: string;
  /** Normalized event payload to pass to trigger handler */
  event: Record<string, unknown>;
}

/**
 * Webhook processor for handling incoming webhooks
 */
export interface WebhookProcessor {
  /** Validate incoming webhook (e.g., Slack URL verification, signature validation) */
  validateWebhook?(req: WebhookRequest, secrets: Record<string, string>): Promise<WebhookValidationResult>;

  /** Process webhook and return matching triggers with normalized events */
  processWebhook(
    req: WebhookRequest,
    triggers: TriggerInfo[],
    secrets: Record<string, string>
  ): Promise<WebhookMatch[]>;
}

/**
 * Definition of a trigger type with its schema and lifecycle
 */
export interface TriggerDefinition<TInput = unknown, TState = unknown, TSecrets = Record<string, string>> {
  /** Zod schema for validating trigger input */
  inputSchema: ZodType<TInput>;
  /** Zod schema for validating trigger state */
  stateSchema: ZodType<TState>;
  /** Lifecycle methods for managing trigger resources */
  lifecycle: TriggerLifecycle<TInput, TState, TSecrets>;
}

/**
 * Complete provider definition for server-side operations
 */
export interface ProviderDefinition<TSecrets = Record<string, string>> {
  /** Provider type identifier (e.g., "github", "slack") */
  providerType: string;
  /** Setup steps for provider configuration UI */
  setupSteps: SetupStep[];
  /** Webhook processor for handling incoming webhooks (optional) */
  webhookProcessor?: WebhookProcessor;
  /** Trigger definitions with their schemas and lifecycles */
  triggerDefinitions: Record<string, TriggerDefinition<unknown, unknown, TSecrets>>;
}

// ============================================================================
// Client-Side Provider Base Class (existing)
// ============================================================================

export type BaseProviderConfig = {
  credential?: string;
  [key: string]: any; // Allow additional config properties
};

export abstract class BaseProvider implements Provider {
  providerType: string;
  credentialName: string;
  secretDefinitions?: SecretDefinition[];
  abstract triggers: Record<string, (...args: any[]) => Trigger>;
  abstract actions: any;

  protected config: Record<string, any> = {};
  private secrets: Record<string, string> = {};

  constructor(providerType: string, config?: BaseProviderConfig | string) {
    this.providerType = providerType;

    // Support both old string pattern and new object pattern
    if (typeof config === "string") {
      this.credentialName = config;
    } else if (config) {
      this.credentialName = config.credential || "default";
      const { credential, ...rest } = config;
      this.config = rest;
    } else {
      this.credentialName = "default";
    }

    // Initialize immediately - providerType is now available
    this.initialize();
  }

  /**
   * Initialize provider - tracks usage and merges backend config.
   * Called automatically by constructor. Subclasses can override to
   * set secretDefinitions before tracking.
   */
  protected initialize(): void {
    // Track provider usage for deployment validation
    trackProviderUsage(
      this.providerType,
      this.credentialName,
      this.secretDefinitions
    );

    // Auto-fetch and merge backend configuration
    const backendConfig = getProviderConfig(
      this.providerType,
      this.credentialName
    );
    if (backendConfig) {
      // Backend config should not override explicit config passed to constructor
      this.config = { ...backendConfig, ...this.config };
    }
  }

  configure(secrets: Record<string, string>): void {
    console.log("Secrets", secrets);
    this.secrets = secrets;
  }

  protected getSecret(key: string): string {
    // Check secrets first (from backend credentials)
    const secretValue = this.secrets[key];
    if (secretValue) {
      return secretValue;
    }

    // Fallback to config (allows passing API keys directly)
    const configValue = this.config[key];
    if (configValue) {
      return configValue;
    }

    // Finally check environment variables (e.g., OPENAI_API_KEY)
    const envKey = `${this.providerType.toUpperCase()}_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
    const envValue = process.env[envKey];
    if (envValue) {
      return envValue;
    }

    throw new Error(
      `${this.providerType} credential '${this.credentialName}' not configured. Missing secret: ${key}`,
    );
  }

  protected hasSecret(key: string): boolean {
    return !!this.secrets[key];
  }

  protected getConfig<T = any>(key: string, defaultValue?: T): T | undefined {
    return this.config[key] !== undefined ? this.config[key] : defaultValue;
  }
}
