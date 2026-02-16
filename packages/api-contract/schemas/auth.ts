import { z } from 'zod';

// ============================================================================
// Request schemas (migrated from server/api/schemas.ts)
// ============================================================================

export const deviceTokenSchema = z.object({
  deviceCode: z.string().min(1),
  grantType: z.string().min(1),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

// ============================================================================
// Request schemas (from server/api/schemas.ts -- centrifugo)
// ============================================================================

export const centrifugoConnectSchema = z.object({
  client: z.string().optional(),
});

export const centrifugoSubscribeSchema = z.object({
  channel: z.string().min(1),
});

// ============================================================================
// Config response schemas (shared between server and SDK)
// ============================================================================

export const authConfigResponseSchema = z.object({
  provider: z.string(),
  client_id: z.string(),
  device_authorization_endpoint: z.string().optional(),
  token_endpoint: z.string().optional(),
  authorization_endpoint: z.string().optional(),
  issuer: z.string().optional(),
  jwks_uri: z.string().optional(),
  audience: z.string().optional(),
});

export const backendConfigResponseSchema = z.object({
  auth: authConfigResponseSchema,
  websocket_url: z.string(),
  features: z.object({
    billing: z.boolean(),
    singleOrg: z.boolean(),
    aiBuilder: z.boolean(),
  }),
  limits: z.object({
    maxWorkflows: z.number(),
    maxExecutionsPerMonth: z.number(),
  }),
  version: z.string(),
});

export type AuthConfigResponse = z.infer<typeof authConfigResponseSchema>;
export type BackendConfigResponse = z.infer<typeof backendConfigResponseSchema>;

// ============================================================================
// Inferred types
// ============================================================================

export type DeviceTokenInput = z.infer<typeof deviceTokenSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type CentrifugoConnectInput = z.infer<typeof centrifugoConnectSchema>;
export type CentrifugoSubscribeInput = z.infer<typeof centrifugoSubscribeSchema>;
