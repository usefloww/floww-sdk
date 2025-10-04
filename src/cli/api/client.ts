import fetch from 'node-fetch';
import { loadTokens, saveTokens } from '../auth/authUtils';
import { CLIAuth } from '../auth/auth';
import { StoredAuth } from '../auth/authTypes';
import { getConfig } from '../config/configUtils';
import { FlowwConfig } from '../config/configTypes';

export interface ApiCallOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  headers?: Record<string, string>;
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
}

export class ApiClient {
  private baseUrl: string;
  private clientId: string;

  constructor(baseUrl: string, clientId: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.clientId = clientId;
  }

  /**
   * Make an authenticated API call to the backend
   */
  async apiCall<T = any>(
    endpoint: string,
    options: ApiCallOptions = {}
  ): Promise<ApiResponse<T>> {
    const { method = 'GET', body, headers = {} } = options;

    // Get authentication token
    const auth = await this.getValidAuth();
    if (!auth) {
      return {
        status: 401,
        error: 'Authentication required. Please run `floww auth login` first.'
      };
    }

    console.log(auth.accessToken);

    // Prepare request
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${auth.accessToken}`,
      ...headers
    };

    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined
      });

      const responseData = await response.json().catch(() => null);

      if (response.status === 401) {
        // Token might be expired, try to refresh
        const refreshedAuth = await this.refreshToken(auth);
        if (refreshedAuth) {
          // Retry the request with new token
          requestHeaders['Authorization'] = `Bearer ${refreshedAuth.accessToken}`;
          const retryResponse = await fetch(url, {
            method,
            headers: requestHeaders,
            body: body ? JSON.stringify(body) : undefined
          });

          const retryData = await retryResponse.json().catch(() => null);
          return {
            status: retryResponse.status,
            data: retryData,
            error: retryResponse.ok ? undefined : (retryData?.detail || retryData?.error || 'Request failed')
          };
        }

        return {
          status: 401,
          error: 'Authentication failed. Please run `floww auth login` again.'
        };
      }

      return {
        status: response.status,
        data: responseData,
        error: response.ok ? undefined : (responseData?.detail || responseData?.error || 'Request failed')
      };

    } catch (error) {
      return {
        status: 500,
        error: error instanceof Error ? error.message : 'Network error occurred'
      };
    }
  }

  /**
   * Get valid authentication, refreshing if necessary
   */
  private async getValidAuth(): Promise<StoredAuth | null> {
    const auth = loadTokens();
    if (!auth) {
      return null;
    }

    // Check if token is expired (with 5 minute buffer)
    const isExpired = Date.now() >= (auth.expiresAt - 5 * 60 * 1000);

    if (isExpired && auth.refreshToken) {
      return await this.refreshToken(auth);
    }

    return auth;
  }

  /**
   * Refresh the access token using refresh token
   */
  private async refreshToken(auth: StoredAuth): Promise<StoredAuth | null> {
    if (!auth.refreshToken) {
      return null;
    }

    try {
      const cliAuth = new CLIAuth(this.clientId);
      const refreshedAuth = await cliAuth.refreshAccessToken(auth.refreshToken);

      // Save the new tokens
      saveTokens(refreshedAuth);

      return refreshedAuth;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      return null;
    }
  }
}

/**
 * Create API client with config system
 */
function createApiClient(cliOptions: Partial<FlowwConfig> = {}): ApiClient {
  const config = getConfig(cliOptions);
  return new ApiClient(config.backendUrl, config.workosClientId);
}

/**
 * Convenience function for making API calls with configuration
 */
export async function apiCall<T = any>(
  endpoint: string,
  options: ApiCallOptions = {},
  cliOptions: Partial<FlowwConfig> = {}
): Promise<ApiResponse<T>> {
  const client = createApiClient(cliOptions);
  return client.apiCall<T>(endpoint, options);
}

// Default client instance (backwards compatibility)
export const defaultApiClient = createApiClient();