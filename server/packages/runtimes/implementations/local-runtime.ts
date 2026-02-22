/**
 * Local Runtime Implementation
 *
 * Executes workflows by forking child processes with a clean environment.
 * Each invocation spawns a short-lived process that imports handleEvent
 * from floww/runtime, providing process-level isolation from backend secrets.
 */

import { fork } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import {
  BaseRuntime,
  type RuntimeConfig,
  type RuntimeCreationStatus,
  type RuntimePayload,
  type UserCode,
  type DefinitionsResult,
} from '../runtime-types';

export interface LocalRuntimeConfig {
  backendUrl: string;
}

const EXECUTION_TIMEOUT_MS = 60_000;

export class LocalRuntime extends BaseRuntime {
  readonly type = 'local' as const;

  private backendUrl: string;
  private workerPath: string;

  constructor(config: LocalRuntimeConfig) {
    super();
    this.backendUrl = config.backendUrl;
    this.workerPath = this.resolveWorkerPath();
  }

  private resolveWorkerPath(): string {
    const thisDir = path.dirname(fileURLToPath(import.meta.url));

    // In production (compiled), look for .js first
    const jsPath = path.resolve(thisDir, '../utils/local-worker.js');
    if (fs.existsSync(jsPath)) {
      return jsPath;
    }

    // In development (tsx), use .ts
    const tsPath = path.resolve(thisDir, '../utils/local-worker.ts');
    if (fs.existsSync(tsPath)) {
      return tsPath;
    }

    throw new Error(`Local worker not found at ${jsPath} or ${tsPath}`);
  }

  private forkWorker(event: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const child = fork(this.workerPath, [], {
        // Clean environment: only pass minimal vars
        env: {
          NODE_ENV: process.env.NODE_ENV,
          BACKEND_URL: this.backendUrl,
        },
        // Inherit execArgv so tsx's loader works in development
        execArgv: process.execArgv,
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      });

      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`Local runtime execution timed out after ${EXECUTION_TIMEOUT_MS}ms`));
      }, EXECUTION_TIMEOUT_MS);

      let stderr = '';

      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('message', (msg: { success: boolean; result?: unknown; error?: { message: string; stack?: string } }) => {
        clearTimeout(timeout);
        if (msg.success) {
          resolve(msg.result);
        } else {
          const err = new Error(msg.error?.message ?? 'Unknown worker error');
          if (msg.error?.stack) err.stack = msg.error.stack;
          reject(err);
        }
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      child.on('exit', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          reject(new Error(`Local worker exited with code ${code}${stderr ? `: ${stderr}` : ''}`));
        }
      });

      child.send(event);
    });
  }

  async createRuntime(_config: RuntimeConfig): Promise<RuntimeCreationStatus> {
    this.log('Local runtime requires no deployment');
    return {
      status: 'COMPLETED',
      newLogs: [
        {
          timestamp: new Date().toISOString(),
          message: 'Local runtime ready (no deployment needed)',
          level: 'info',
        },
      ],
    };
  }

  async getRuntimeStatus(_runtimeId: string): Promise<RuntimeCreationStatus> {
    return {
      status: 'COMPLETED',
      newLogs: [
        {
          timestamp: new Date().toISOString(),
          message: 'Local runtime is always ready',
          level: 'info',
        },
      ],
    };
  }

  async invokeTrigger(
    triggerId: string,
    _runtimeConfig: RuntimeConfig,
    userCode: UserCode,
    payload: RuntimePayload
  ): Promise<void> {
    this.log('Invoking trigger via local process', { triggerId });

    const event = {
      type: 'invoke_trigger',
      userCode,
      backendUrl: this.backendUrl,
      ...payload,
    };

    await this.forkWorker(event);
  }

  async getDefinitions(
    _runtimeConfig: RuntimeConfig,
    userCode: UserCode,
    providerConfigs: Record<string, unknown>
  ): Promise<DefinitionsResult> {
    this.log('Getting definitions via local process');

    const event = {
      type: 'get_definitions',
      userCode,
      providerConfigs,
    };

    const result = await this.forkWorker(event);
    return result as DefinitionsResult;
  }

  async destroyRuntime(_config: RuntimeConfig): Promise<void> {
    // No-op: local runtime has no persistent resources to clean up
  }

  async isHealthy(_config: RuntimeConfig): Promise<boolean> {
    return true;
  }

  async teardownUnusedRuntimes(): Promise<void> {
    // No-op: each invocation is a short-lived child process
  }
}
