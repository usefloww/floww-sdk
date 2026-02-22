/**
 * Runtime Types Package
 *
 * Defines the interface for runtime implementations (Lambda, Docker, K8s).
 * This is a self-contained package.
 */

import { logger } from '~/server/utils/logger';

export interface RuntimeConfig {
  runtimeId: string;
  imageDigest: string;
}

export interface RuntimeLogEntry {
  timestamp: string;
  message: string;
  level?: 'info' | 'warn' | 'error' | 'debug';
}

export interface RuntimeCreationStatus {
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  newLogs: RuntimeLogEntry[];
}

export interface RuntimePayload {
  trigger: {
    provider: { type: string; alias: string };
    triggerType: string;
    input: Record<string, unknown>;
  };
  data: Record<string, unknown>;
  authToken: string;
  executionId: string;
  providerConfigs: Record<string, Record<string, unknown>>;
  policyRules?: Record<string, unknown>;
}

export interface UserCode {
  files: Record<string, string>;
  entrypoint: string;
}

export interface DefinitionsResult {
  success: boolean;
  triggers?: Array<{
    provider: { type: string; alias: string };
    triggerType: string;
    input: Record<string, unknown>;
  }>;
  providers?: Array<{
    type: string;
    alias: string;
  }>;
  error?: {
    message: string;
    stack?: string;
  };
}

/**
 * Runtime interface that all runtime implementations must follow
 */
export interface Runtime {
  /**
   * Runtime type identifier
   */
  readonly type: 'lambda' | 'docker' | 'kubernetes' | 'local';

  /**
   * Create a runtime environment (e.g., Lambda function, Docker container)
   */
  createRuntime(config: RuntimeConfig): Promise<RuntimeCreationStatus>;

  /**
   * Get the status of a runtime creation
   */
  getRuntimeStatus(runtimeId: string): Promise<RuntimeCreationStatus>;

  /**
   * Invoke a trigger on the runtime (fire-and-forget)
   */
  invokeTrigger(
    triggerId: string,
    runtimeConfig: RuntimeConfig,
    userCode: UserCode,
    payload: RuntimePayload
  ): Promise<void>;

  /**
   * Get trigger and provider definitions from user code
   */
  getDefinitions(
    runtimeConfig: RuntimeConfig,
    userCode: UserCode,
    providerConfigs: Record<string, unknown>
  ): Promise<DefinitionsResult>;

  /**
   * Destroy a runtime environment
   */
  destroyRuntime(config: RuntimeConfig): Promise<void>;

  /**
   * Check if a runtime is healthy
   */
  isHealthy(config: RuntimeConfig): Promise<boolean>;

  /**
   * Clean up unused/idle runtimes
   */
  teardownUnusedRuntimes(): Promise<void>;
}

/**
 * Base runtime class with common functionality
 */
export abstract class BaseRuntime implements Runtime {
  abstract readonly type: 'lambda' | 'docker' | 'kubernetes' | 'local';

  abstract createRuntime(config: RuntimeConfig): Promise<RuntimeCreationStatus>;
  abstract getRuntimeStatus(runtimeId: string): Promise<RuntimeCreationStatus>;
  abstract invokeTrigger(
    triggerId: string,
    runtimeConfig: RuntimeConfig,
    userCode: UserCode,
    payload: RuntimePayload
  ): Promise<void>;
  abstract getDefinitions(
    runtimeConfig: RuntimeConfig,
    userCode: UserCode,
    providerConfigs: Record<string, unknown>
  ): Promise<DefinitionsResult>;
  abstract destroyRuntime(config: RuntimeConfig): Promise<void>;
  abstract isHealthy(config: RuntimeConfig): Promise<boolean>;
  abstract teardownUnusedRuntimes(): Promise<void>;

  protected log(message: string, context?: Record<string, unknown>): void {
    logger.info(`[${this.type}] ${message}`, context);
  }

  protected error(message: string, context?: Record<string, unknown>): void {
    logger.error(`[${this.type}] ${message}`, context);
  }
}
