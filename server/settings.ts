/**
 * Settings Configuration
 *
 * Centralized settings system similar to Python backend's settings.py.
 * Supports Docker secrets via *_FILE environment variables.
 *
 * Priority order (highest to lowest):
 * 1. Docker secrets (from files when *_FILE env vars exist)
 * 2. Environment variables
 * 3. Default values
 */

import { z } from 'zod';
import { getEnvWithSecret } from './utils/docker-secrets';

// ============================================================================
// Database Configuration
// ============================================================================

const DatabaseConfigSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  TEST_DATABASE_URL: z.string().default('postgresql://admin:secret@localhost:5432/floww_test'),
  SESSION_SECRET_KEY: z.string().min(1, 'SESSION_SECRET_KEY is required'),
  ENCRYPTION_KEY: z.string().min(1, 'ENCRYPTION_KEY is required'),
});

function loadDatabaseConfig(): z.infer<typeof DatabaseConfigSchema> {
  // Support constructing DATABASE_URL from parts (for Docker secrets compatibility)
  const dbUrl = getEnvWithSecret('DATABASE_URL');
  const dbUser = getEnvWithSecret('DATABASE_USER') || 'postgres';
  const dbPassword = getEnvWithSecret('DATABASE_PASSWORD');
  const dbHost = getEnvWithSecret('DATABASE_HOST');
  const dbPort = getEnvWithSecret('DATABASE_PORT') || '5432';
  const dbName = getEnvWithSecret('DATABASE_NAME') || 'postgres';

  // If DATABASE_URL is provided, use it; otherwise construct from parts
  let databaseUrl = dbUrl;
  if (!databaseUrl && dbPassword && dbHost) {
    const sslMode = getEnvWithSecret('DATABASE_SSL') || 'require';
    databaseUrl = `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}?sslmode=${sslMode}`;
  }
  databaseUrl = databaseUrl || 'postgresql://admin:secret@localhost:5432/postgres';

  return {
    DATABASE_URL: databaseUrl,
    TEST_DATABASE_URL: getEnvWithSecret('TEST_DATABASE_URL') || 'postgresql://admin:secret@localhost:5432/floww_test',
    SESSION_SECRET_KEY: getEnvWithSecret('SESSION_SECRET_KEY') || 'floww-session-secret-change-in-production',
    ENCRYPTION_KEY: getEnvWithSecret('ENCRYPTION_KEY') || 'OTLHgX6E8_3k-c6rHBsbHDKnuPGtmD1ycNip9CgfiFk=',
  };
}

// ============================================================================
// Auth Configuration
// ============================================================================

const AuthConfigSchema = z.object({
  AUTH_TYPE: z.enum(['workos', 'oidc', 'password', 'none']).default('workos'),
  WORKOS_API_KEY: z.string().optional(),
  WORKOS_CLIENT_ID: z.string().optional(),
  AUTH_CLIENT_ID: z.string().optional(),
  AUTH_CLIENT_SECRET: z.string().optional(),
  AUTH_ISSUER_URL: z.preprocess((val) => (val === '' ? undefined : val), z.string().url().optional()),
  BETTER_AUTH_SECRET: z.string().optional(),
  BETTER_AUTH_URL: z.preprocess((val) => (val === '' ? undefined : val), z.string().url().optional()),
  WORKFLOW_JWT_SECRET: z.string().optional(),
});

function loadAuthConfig(): z.infer<typeof AuthConfigSchema> {
  return {
    AUTH_TYPE: (getEnvWithSecret('AUTH_TYPE') as 'workos' | 'oidc' | 'password' | 'none') || 'workos',
    WORKOS_API_KEY: getEnvWithSecret('WORKOS_API_KEY'),
    WORKOS_CLIENT_ID: getEnvWithSecret('WORKOS_CLIENT_ID'),
    AUTH_CLIENT_ID: getEnvWithSecret('AUTH_CLIENT_ID'),
    AUTH_CLIENT_SECRET: getEnvWithSecret('AUTH_CLIENT_SECRET'),
    AUTH_ISSUER_URL: getEnvWithSecret('AUTH_ISSUER_URL'),
    BETTER_AUTH_SECRET: getEnvWithSecret('BETTER_AUTH_SECRET'),
    BETTER_AUTH_URL: getEnvWithSecret('BETTER_AUTH_URL'),
    WORKFLOW_JWT_SECRET: getEnvWithSecret('WORKFLOW_JWT_SECRET'),
  };
}

// ============================================================================
// Centrifugo Configuration
// ============================================================================

const CentrifugoConfigSchema = z.object({
  CENTRIFUGO_PUBLIC_URL: z.string().url().default('http://localhost:8000'),
  CENTRIFUGO_API_KEY: z.string().min(1, 'CENTRIFUGO_API_KEY is required'),
  CENTRIFUGO_JWT_SECRET: z.string().min(1, 'CENTRIFUGO_JWT_SECRET is required'),
});

function loadCentrifugoConfig(): z.infer<typeof CentrifugoConfigSchema> {
  return {
    CENTRIFUGO_PUBLIC_URL: getEnvWithSecret('CENTRIFUGO_PUBLIC_URL') || 'http://localhost:8000',
    CENTRIFUGO_API_KEY: getEnvWithSecret('CENTRIFUGO_API_KEY') || 'floww-api-key-dev',
    CENTRIFUGO_JWT_SECRET: getEnvWithSecret('CENTRIFUGO_JWT_SECRET') || 'floww-dev-jwt-secret-key-change-in-production',
  };
}

// ============================================================================
// Stripe Configuration
// ============================================================================

const StripeConfigSchema = z.object({
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_PRICE_ID_HOBBY: z.string().optional(),
  STRIPE_PRICE_ID_TEAM: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  TRIAL_PERIOD_DAYS: z.number().default(0),
  GRACE_PERIOD_DAYS: z.number().default(7),
});

function loadStripeConfig(): z.infer<typeof StripeConfigSchema> {
  const trialPeriod = getEnvWithSecret('TRIAL_PERIOD_DAYS');
  const gracePeriod = getEnvWithSecret('GRACE_PERIOD_DAYS');
  return {
    STRIPE_SECRET_KEY: getEnvWithSecret('STRIPE_SECRET_KEY'),
    STRIPE_PUBLISHABLE_KEY: getEnvWithSecret('STRIPE_PUBLISHABLE_KEY'),
    STRIPE_PRICE_ID_HOBBY: getEnvWithSecret('STRIPE_PRICE_ID_HOBBY'),
    STRIPE_PRICE_ID_TEAM: getEnvWithSecret('STRIPE_PRICE_ID_TEAM'),
    STRIPE_WEBHOOK_SECRET: getEnvWithSecret('STRIPE_WEBHOOK_SECRET'),
    TRIAL_PERIOD_DAYS: trialPeriod ? parseInt(trialPeriod, 10) : 0,
    GRACE_PERIOD_DAYS: gracePeriod ? parseInt(gracePeriod, 10) : 7,
  };
}

// ============================================================================
// General Configuration
// ============================================================================

const GeneralConfigSchema = z.object({
  BACKEND_URL: z.string().url().default('http://localhost:8000'),
  PUBLIC_API_URL: z.preprocess((val) => (val === '' ? undefined : val), z.string().url().optional()),
  ENABLE_ADMIN: z.boolean().default(true),
  SINGLE_ORG_MODE: z.boolean().default(false),
  SINGLE_ORG_NAME: z.string().default('default'),
  SINGLE_ORG_DISPLAY_NAME: z.string().default('Default Organization'),
  IS_CLOUD: z.boolean().default(false),
  SENTRY_DSN: z.preprocess((val) => (val === '' ? undefined : val), z.string().url().optional()),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_RELEASE: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.number().min(0).max(1).optional(),
  SENTRY_PROFILES_SAMPLE_RATE: z.number().min(0).max(1).optional(),
});

function loadGeneralConfig(): z.infer<typeof GeneralConfigSchema> {
  const enableAdmin = getEnvWithSecret('ENABLE_ADMIN');
  const singleOrgMode = getEnvWithSecret('SINGLE_ORG_MODE');
  const isCloud = getEnvWithSecret('IS_CLOUD');
  const tracesSampleRate = getEnvWithSecret('SENTRY_TRACES_SAMPLE_RATE');
  const profilesSampleRate = getEnvWithSecret('SENTRY_PROFILES_SAMPLE_RATE');

  return {
    BACKEND_URL: getEnvWithSecret('BACKEND_URL') || 'http://localhost:8000',
    PUBLIC_API_URL: getEnvWithSecret('PUBLIC_API_URL'),
    ENABLE_ADMIN: enableAdmin !== 'false' && enableAdmin !== '0',
    SINGLE_ORG_MODE: singleOrgMode === 'true' || singleOrgMode === '1',
    SINGLE_ORG_NAME: getEnvWithSecret('SINGLE_ORG_NAME') || 'default',
    SINGLE_ORG_DISPLAY_NAME: getEnvWithSecret('SINGLE_ORG_DISPLAY_NAME') || 'Default Organization',
    IS_CLOUD: isCloud === 'true' || isCloud === '1',
    SENTRY_DSN: getEnvWithSecret('SENTRY_DSN'),
    SENTRY_ENVIRONMENT: getEnvWithSecret('SENTRY_ENVIRONMENT') || getEnvWithSecret('NODE_ENV') || 'development',
    SENTRY_RELEASE: getEnvWithSecret('SENTRY_RELEASE') || getEnvWithSecret('npm_package_version'),
    SENTRY_TRACES_SAMPLE_RATE: tracesSampleRate ? parseFloat(tracesSampleRate) : undefined,
    SENTRY_PROFILES_SAMPLE_RATE: profilesSampleRate ? parseFloat(profilesSampleRate) : undefined,
  };
}

// ============================================================================
// AI Configuration
// ============================================================================

const AIConfigSchema = z.object({
  OPENROUTER_API_KEY: z.string().optional(),
  AI_MODEL_CODEGEN: z.string().default('anthropic/claude-sonnet-4.5'),
});

function loadAIConfig(): z.infer<typeof AIConfigSchema> {
  return {
    OPENROUTER_API_KEY: getEnvWithSecret('OPENROUTER_API_KEY'),
    AI_MODEL_CODEGEN: getEnvWithSecret('AI_MODEL_CODEGEN') || 'anthropic/claude-sonnet-4.5',
  };
}

// ============================================================================
// Worker Configuration
// ============================================================================

const WorkerConfigSchema = z.object({
  ENABLE_WORKER: z.boolean().default(false),
  WORKER_ONLY: z.boolean().default(false),
});

function loadWorkerConfig(): z.infer<typeof WorkerConfigSchema> {
  const enableWorker = getEnvWithSecret('ENABLE_WORKER');
  const workerOnly = getEnvWithSecret('WORKER_ONLY');

  return {
    ENABLE_WORKER: enableWorker === 'true' || enableWorker === '1',
    WORKER_ONLY: workerOnly === 'true' || workerOnly === '1',
  };
}

// ============================================================================
// Runtime Configuration
// ============================================================================

const RuntimeConfigSchema = z.object({
  RUNTIME_TYPE: z.enum(['docker', 'lambda', 'kubernetes', 'local']).default('docker'),
  DEFAULT_RUNTIME_IMAGE: z.string().optional(),
  REGISTRY_URL: z.string().optional(),
  REGISTRY_URL_RUNTIME: z.string().optional(),
  REGISTRY_REPOSITORY_NAME: z.string().default('floww-runtime'),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  LAMBDA_EXECUTION_ROLE_ARN: z.string().optional(),
});

function loadRuntimeConfig(): z.infer<typeof RuntimeConfigSchema> {
  const registryUrl = getEnvWithSecret('REGISTRY_URL');
  const registryUrlRuntime = getEnvWithSecret('REGISTRY_URL_RUNTIME');

  return {
    RUNTIME_TYPE: (getEnvWithSecret('RUNTIME_TYPE') as 'docker' | 'lambda' | 'kubernetes' | 'local') || 'docker',
    DEFAULT_RUNTIME_IMAGE: getEnvWithSecret('DEFAULT_RUNTIME_IMAGE'),
    REGISTRY_URL: registryUrl,
    REGISTRY_URL_RUNTIME: registryUrlRuntime || registryUrl,
    REGISTRY_REPOSITORY_NAME: getEnvWithSecret('REGISTRY_REPOSITORY_NAME') || 'floww-runtime',
    AWS_REGION: getEnvWithSecret('AWS_REGION') || 'us-east-1',
    AWS_ACCESS_KEY_ID: getEnvWithSecret('AWS_ACCESS_KEY_ID'),
    AWS_SECRET_ACCESS_KEY: getEnvWithSecret('AWS_SECRET_ACCESS_KEY'),
    LAMBDA_EXECUTION_ROLE_ARN: getEnvWithSecret('LAMBDA_EXECUTION_ROLE_ARN'),
  };
}

// ============================================================================
// OAuth Configuration
// ============================================================================

const OAuthConfigSchema = z.object({
  GOOGLE_OAUTH_CLIENT_ID: z.string().default(''),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().default(''),
});

function loadOAuthConfig(): z.infer<typeof OAuthConfigSchema> {
  return {
    GOOGLE_OAUTH_CLIENT_ID: getEnvWithSecret('GOOGLE_OAUTH_CLIENT_ID') || '',
    GOOGLE_OAUTH_CLIENT_SECRET: getEnvWithSecret('GOOGLE_OAUTH_CLIENT_SECRET') || '',
  };
}

// ============================================================================
// Registry Configuration
// ============================================================================

const RegistryConfigSchema = z.object({
  REGISTRY_TYPE: z.enum(['dockerhub', 'ecr', 'gcr', 'generic']).default('dockerhub'),
  REGISTRY_URL: z.string(),
  REGISTRY_USERNAME: z.string().optional(),
  REGISTRY_PASSWORD: z.string().optional(),
  REGISTRY_TOKEN: z.string().optional(),
});

function loadRegistryConfig(): z.infer<typeof RegistryConfigSchema> {
  return {
    REGISTRY_TYPE: (getEnvWithSecret('REGISTRY_TYPE') as 'dockerhub' | 'ecr' | 'gcr' | 'generic') || 'dockerhub',
    REGISTRY_URL: getEnvWithSecret('REGISTRY_URL') || 'https://registry-1.docker.io',
    REGISTRY_USERNAME: getEnvWithSecret('REGISTRY_USERNAME'),
    REGISTRY_PASSWORD: getEnvWithSecret('REGISTRY_PASSWORD'),
    REGISTRY_TOKEN: getEnvWithSecret('REGISTRY_TOKEN'),
  };
}

// ============================================================================
// Version Configuration
// ============================================================================

const VersionConfigSchema = z.object({
  VERSION: z.string().default('0.0.0'),
});

function loadVersionConfig(): z.infer<typeof VersionConfigSchema> {
  return {
    VERSION: getEnvWithSecret('npm_package_version') || getEnvWithSecret('VERSION') || '0.0.0',
  };
}

// ============================================================================
// Combined Settings Schema
// ============================================================================

const SettingsSchema = z.object({
  database: DatabaseConfigSchema,
  auth: AuthConfigSchema,
  centrifugo: CentrifugoConfigSchema,
  stripe: StripeConfigSchema,
  general: GeneralConfigSchema,
  ai: AIConfigSchema,
  worker: WorkerConfigSchema,
  runtime: RuntimeConfigSchema,
  oauth: OAuthConfigSchema,
  registry: RegistryConfigSchema,
  version: VersionConfigSchema,
});

type Settings = z.infer<typeof SettingsSchema>;

// ============================================================================
// Settings Loader and Validation
// ============================================================================

function loadSettings(): Settings {
  const rawSettings = {
    database: loadDatabaseConfig(),
    auth: loadAuthConfig(),
    centrifugo: loadCentrifugoConfig(),
    stripe: loadStripeConfig(),
    general: loadGeneralConfig(),
    ai: loadAIConfig(),
    worker: loadWorkerConfig(),
    runtime: loadRuntimeConfig(),
    oauth: loadOAuthConfig(),
    registry: loadRegistryConfig(),
    version: loadVersionConfig(),
  };

  // Validate settings
  const result = SettingsSchema.safeParse(rawSettings);

  if (!result.success) {
    // Use console.error here to avoid circular dependency with logger
    console.error('Settings validation failed:', result.error.format());
    throw new Error(`Invalid settings configuration: ${result.error.message}`);
  }

  // Validate AUTH_TYPE='none' requires SINGLE_ORG_MODE=true
  if (result.data.auth.AUTH_TYPE === 'none' && !result.data.general.SINGLE_ORG_MODE) {
    throw new Error(
      "AUTH_TYPE='none' (anonymous authentication) requires SINGLE_ORG_MODE=true. " +
        'Anonymous authentication is only supported in single-organization mode.'
    );
  }

  // Validate Lambda runtime configuration
  if (result.data.runtime.RUNTIME_TYPE === 'lambda') {
    if (!result.data.runtime.LAMBDA_EXECUTION_ROLE_ARN) {
      throw new Error(
        "RUNTIME_TYPE='lambda' requires LAMBDA_EXECUTION_ROLE_ARN to be set. " +
          'Please provide a valid Lambda execution role ARN.'
      );
    }
    if (!result.data.runtime.REGISTRY_URL_RUNTIME) {
      throw new Error(
        "RUNTIME_TYPE='lambda' requires REGISTRY_URL_RUNTIME (or REGISTRY_URL) to be set. " +
          'Please provide a valid ECR registry URL.'
      );
    }
  }

  return result.data;
}

// ============================================================================
// Export Singleton Settings Instance
// ============================================================================

export const settings: Settings = loadSettings();

// Export types for use in other modules
export type { Settings };
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
export type AuthConfig = z.infer<typeof AuthConfigSchema>;
export type CentrifugoConfig = z.infer<typeof CentrifugoConfigSchema>;
export type StripeConfig = z.infer<typeof StripeConfigSchema>;
export type GeneralConfig = z.infer<typeof GeneralConfigSchema>;
export type AIConfig = z.infer<typeof AIConfigSchema>;
export type WorkerConfig = z.infer<typeof WorkerConfigSchema>;
export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>;
export type OAuthConfig = z.infer<typeof OAuthConfigSchema>;
export type RegistryConfig = z.infer<typeof RegistryConfigSchema>;
export type VersionConfig = z.infer<typeof VersionConfigSchema>;
