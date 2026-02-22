import { z } from 'zod';

// ============================================================================
// Request schemas (migrated from server/api/schemas.ts)
// ============================================================================

export const createProviderSchema = z.object({
  namespaceId: z.string().min(1, 'namespaceId is required'),
  type: z.string().min(1, 'type is required'),
  alias: z.string().min(1, 'alias is required'),
  config: z.record(z.string(), z.unknown()).optional().default({}),
});

export const updateProviderSchema = z.object({
  type: z.string().optional(),
  alias: z.string().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

// ============================================================================
// Response schemas (from src/types/api.ts)
// ============================================================================

export const providerSetupStepSchema = z.object({
  type: z.string(),
  title: z.string(),
  description: z.string().optional(),
  alias: z.string(),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  default: z.string().optional(),
  options: z.array(z.string()).optional(),
  providerName: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  redirectUri: z.string().optional(),
  message: z.string().optional(),
  actionText: z.string().optional(),
  actionUrl: z.string().optional(),
  showWhen: z.object({ field: z.string(), value: z.string() }).optional(),
});

export const providerTypeSchema = z.object({
  providerType: z.string(),
  setupSteps: z.array(providerSetupStepSchema),
});

export const providerSchema = z.object({
  id: z.string(),
  alias: z.string(),
  type: z.string(),
  namespaceId: z.string(),
  config: z.record(z.string(), z.unknown()),
  status: z.enum(['connected', 'disconnected', 'pending']).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  lastUsedAt: z.string().optional(),
  name: z.string().optional(),
  configuration: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

// ============================================================================
// Inferred types
// ============================================================================

export type CreateProviderInput = z.infer<typeof createProviderSchema>;
export type UpdateProviderInput = z.infer<typeof updateProviderSchema>;

export type ProviderSetupStep = z.infer<typeof providerSetupStepSchema>;
export type ProviderType = z.infer<typeof providerTypeSchema>;
export type Provider = z.infer<typeof providerSchema>;
export type ProviderCreate = CreateProviderInput;
export type ProviderUpdate = UpdateProviderInput;
