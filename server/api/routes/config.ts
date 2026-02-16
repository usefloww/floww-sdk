/**
 * Config Route
 *
 * GET /api/config - Public configuration for the frontend and CLI
 */

import { get, json } from '~/server/api/router';
import { settings } from '~/server/settings';
import { getEnvWithSecret } from '~/server/utils/docker-secrets';
import type { AuthConfigResponse } from '@floww/api-contract';

function getBaseUrl(request?: Request): string {
  const publicUrl = settings.general.PUBLIC_API_URL;
  if (publicUrl) return publicUrl.replace(/\/$/, '');

  const backendUrl = settings.general.BACKEND_URL;
  if (backendUrl && backendUrl !== 'http://localhost:8000') return backendUrl.replace(/\/$/, '');

  if (request) {
    const host = request.headers.get('host');
    if (host) {
      const scheme = host.includes('localhost') ? 'http' : 'https';
      return `${scheme}://${host}`;
    }
  }

  return backendUrl.replace(/\/$/, '');
}

async function buildAuthConfig(request?: Request): Promise<AuthConfigResponse> {
  const authType = settings.auth.AUTH_TYPE;
  const baseUrl = getBaseUrl(request);

  switch (authType) {
    case 'password':
      return {
        provider: 'password',
        client_id: 'password-auth',
        device_authorization_endpoint: `${baseUrl}/auth/device/authorize`,
        token_endpoint: `${baseUrl}/auth/device/token`,
        authorization_endpoint: '',
        issuer: 'floww-password-auth',
        jwks_uri: '',
      };

    case 'workos': {
      const clientId = settings.auth.WORKOS_CLIENT_ID ?? '';
      const apiUrl = 'https://api.workos.com';
      return {
        provider: 'workos',
        client_id: clientId,
        device_authorization_endpoint: `${apiUrl}/user_management/authorize/device`,
        token_endpoint: `${apiUrl}/user_management/authenticate`,
        authorization_endpoint: `${apiUrl}/user_management/authorize`,
        issuer: `${apiUrl}/user_management`,
        jwks_uri: `${apiUrl}/.well-known/jwks.json`,
      };
    }

    case 'oidc': {
      const issuerUrl = settings.auth.AUTH_ISSUER_URL;
      if (issuerUrl) {
        try {
          const res = await fetch(`${issuerUrl}/.well-known/openid-configuration`);
          if (res.ok) {
            const oidcConfig = await res.json() as Record<string, string>;
            return {
              provider: 'oidc',
              client_id: settings.auth.AUTH_CLIENT_ID ?? '',
              device_authorization_endpoint: oidcConfig.device_authorization_endpoint,
              token_endpoint: oidcConfig.token_endpoint,
              authorization_endpoint: oidcConfig.authorization_endpoint,
              issuer: oidcConfig.issuer,
              jwks_uri: oidcConfig.jwks_uri,
            };
          }
        } catch {
          // Fall through to defaults
        }
      }
      return {
        provider: 'oidc',
        client_id: settings.auth.AUTH_CLIENT_ID ?? '',
        issuer: issuerUrl,
      };
    }

    case 'none':
    default:
      return {
        provider: authType,
        client_id: '',
      };
  }
}

get('/config', async ({ request }) => {
  const authConfig = await buildAuthConfig(request);

  const centrifugoUrl = settings.centrifugo.CENTRIFUGO_PUBLIC_URL;
  const websocketUrl =
    centrifugoUrl
      .replace('http://', 'ws://')
      .replace('https://', 'wss://') + '/ws/connection/websocket';

  return json({
    auth: authConfig,
    websocket_url: websocketUrl,
    features: {
      billing: settings.general.IS_CLOUD,
      singleOrg: settings.general.SINGLE_ORG_MODE,
      aiBuilder: settings.general.ENABLE_AI_BUILDER,
    },
    limits: {
      maxWorkflows: parseInt(getEnvWithSecret('MAX_WORKFLOWS') ?? '100', 10),
      maxExecutionsPerMonth: parseInt(getEnvWithSecret('MAX_EXECUTIONS_PER_MONTH') ?? '10000', 10),
    },
    version: settings.version.VERSION,
  });
}, false); // No auth required
