/**
 * API Request Body Schemas
 *
 * Re-exports from @floww/api-contract — the single source of truth.
 * This file exists for backward compatibility so existing server imports continue to work.
 */

// Organization schemas
export {
  createOrganizationSchema,
  updateOrganizationSchema,
  addMemberSchema,
  updateMemberRoleSchema,
} from '@floww/api-contract';

// Workflow schemas
export {
  createWorkflowSchema,
  updateWorkflowSchema,
  createFolderSchema,
  importN8nWorkflowSchema,
  workflowBuilderChatSchema,
} from '@floww/api-contract';

// Deployment schemas
export { createDeploymentSchema } from '@floww/api-contract';

// Trigger schemas
export { syncTriggersSchema, executeTriggerSchema } from '@floww/api-contract';

// Provider schemas
export { createProviderSchema, updateProviderSchema } from '@floww/api-contract';

// Subscription schemas
export { subscribeSchema, createPortalSessionSchema } from '@floww/api-contract';

// Runtime schemas
export { createRuntimeSchema } from '@floww/api-contract';

// Execution schemas
export { completeExecutionSchema } from '@floww/api-contract';

// Access Control schemas
export {
  grantAccessSchema,
  grantProviderAccessSchema,
  updateAccessRoleSchema,
} from '@floww/api-contract';

// Device Auth schemas
export { deviceTokenSchema, refreshTokenSchema } from '@floww/api-contract';

// Config response schemas
export { authConfigResponseSchema, backendConfigResponseSchema } from '@floww/api-contract';

// Service Account schemas
export {
  createServiceAccountSchema,
  updateServiceAccountSchema,
  createApiKeySchema,
} from '@floww/api-contract';

// KV Store schemas
export { setKvValueSchema, setKvPermissionsSchema } from '@floww/api-contract';

// Centrifugo schemas
export { centrifugoConnectSchema, centrifugoSubscribeSchema } from '@floww/api-contract';

// Secret schemas
export { createSecretSchema } from '@floww/api-contract';

// Type exports
export type {
  CreateOrganizationInput,
  UpdateOrganizationInput,
  AddMemberInput,
  UpdateMemberRoleInput,
  CreateWorkflowInput,
  UpdateWorkflowInput,
  CreateDeploymentInput,
  CreateProviderInput,
  UpdateProviderInput,
  SubscribeInput,
  CreatePortalSessionInput,
  CreateRuntimeInput,
  CreateSecretInput,
  SyncTriggersInput,
  ExecuteTriggerInput,
  AuthConfigResponse,
  BackendConfigResponse,
} from '@floww/api-contract';
