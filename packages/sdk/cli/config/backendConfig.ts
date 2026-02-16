import type { AuthConfigResponse, BackendConfigResponse } from '@floww/api-contract';

export type AuthConfig = AuthConfigResponse;

/**
 * Minimal config shape used by CLIAuth — only the fields it actually needs.
 * The full BackendConfigResponse from the server is a superset of this.
 */
export interface BackendConfig {
  auth: AuthConfig;
  websocket_url: string;
}

/** Full config response from the server's /api/config endpoint. */
export type FullBackendConfig = BackendConfigResponse;

export async function fetchBackendConfig(
  backendUrl: string
): Promise<FullBackendConfig> {
  const configUrl = `${backendUrl}/api/config`;

  try {
    const response = await fetch(configUrl);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch config from ${configUrl}: ${response.statusText}`
      );
    }

    const config = (await response.json()) as FullBackendConfig;
    return config;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Could not connect to Floww backend at ${backendUrl}: ${error.message}\n` +
          `Please check that the backend URL is correct and the server is running.`
      );
    }
    throw error;
  }
}
