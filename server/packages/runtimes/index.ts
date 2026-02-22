/**
 * Runtimes Package
 *
 * Factory for creating runtime instances based on configuration.
 */

import { LambdaClient } from '@aws-sdk/client-lambda';
import type { Runtime } from './runtime-types';
import { DockerRuntime, type DockerRuntimeConfig } from './implementations/docker-runtime';
import { LambdaRuntime, type LambdaRuntimeConfig } from './implementations/lambda-runtime';
import { LocalRuntime } from './implementations/local-runtime';
import { settings } from '~/server/settings';

export * from './runtime-types';
export { DockerRuntime, type DockerRuntimeConfig } from './implementations/docker-runtime';
export { LambdaRuntime, type LambdaRuntimeConfig } from './implementations/lambda-runtime';
export { LocalRuntime, type LocalRuntimeConfig } from './implementations/local-runtime';

// Re-export utility functions for direct access if needed
export * as dockerUtils from './utils/docker';
export * as lambdaUtils from './utils/aws-lambda';

export type RuntimeType = 'docker' | 'lambda' | 'kubernetes' | 'local';

export interface RuntimeFactoryConfig {
  runtimeType?: RuntimeType;
  repositoryName?: string;
  registryUrl?: string;
  lambdaClient?: LambdaClient;
  executionRoleArn?: string;
  backendUrl?: string;
  awsRegion?: string;
}

/**
 * Create a runtime instance with the given configuration
 */
export function createRuntime(config: RuntimeFactoryConfig = {}): Runtime {
  const runtimeType = config.runtimeType ?? settings.runtime.RUNTIME_TYPE;

  switch (runtimeType) {
    case 'docker': {
      const dockerConfig: DockerRuntimeConfig = {
        repositoryName: config.repositoryName ?? settings.runtime.REGISTRY_REPOSITORY_NAME,
        registryUrl: config.registryUrl ?? settings.runtime.REGISTRY_URL_RUNTIME ?? '',
      };
      return new DockerRuntime(dockerConfig);
    }

    case 'lambda': {
      const lambdaClientConfig: {
        region: string;
        credentials?: { accessKeyId: string; secretAccessKey: string };
      } = {
        region: config.awsRegion ?? settings.runtime.AWS_REGION,
      };

      if (settings.runtime.AWS_ACCESS_KEY_ID && settings.runtime.AWS_SECRET_ACCESS_KEY) {
        lambdaClientConfig.credentials = {
          accessKeyId: settings.runtime.AWS_ACCESS_KEY_ID,
          secretAccessKey: settings.runtime.AWS_SECRET_ACCESS_KEY,
        };
      }

      const lambdaClient = config.lambdaClient ?? new LambdaClient(lambdaClientConfig);
      const backendUrl = config.backendUrl ?? settings.general.PUBLIC_API_URL ?? settings.general.BACKEND_URL;

      const lambdaConfig: LambdaRuntimeConfig = {
        lambdaClient,
        executionRoleArn: config.executionRoleArn ?? settings.runtime.LAMBDA_EXECUTION_ROLE_ARN!,
        registryUrl: config.registryUrl ?? settings.runtime.REGISTRY_URL_RUNTIME!,
        repositoryName: config.repositoryName ?? settings.runtime.REGISTRY_REPOSITORY_NAME,
        backendUrl,
      };
      return new LambdaRuntime(lambdaConfig);
    }

    case 'local': {
      const backendUrl = config.backendUrl ?? settings.general.PUBLIC_API_URL ?? settings.general.BACKEND_URL;
      return new LocalRuntime({ backendUrl });
    }

    case 'kubernetes':
      throw new Error('Kubernetes runtime not yet implemented');

    default:
      throw new Error(`Unknown runtime type: ${runtimeType}`);
  }
}

// Singleton instance
let runtimeInstance: Runtime | null = null;

/**
 * Get the runtime singleton (lazily initialized)
 */
export function getRuntime(): Runtime {
  if (!runtimeInstance) {
    runtimeInstance = createRuntime();
  }
  return runtimeInstance;
}

/**
 * Reset the runtime singleton (useful for testing)
 */
export function resetRuntime(): void {
  runtimeInstance = null;
}
