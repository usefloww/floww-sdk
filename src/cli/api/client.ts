import fetch from 'node-fetch';
import { getValidAuth } from '../auth/tokenUtils';
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
    this.baseUrl = baseUrl.replace(/\/$/, '') + '/api'; // Remove trailing slash
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
    const auth = await getValidAuth();
    if (!auth) {
      return {
        status: 401,
        error: 'Authentication required. Please run `floww auth login` first.'
      };
    }

    // Prepare request
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${auth.accessToken}`,
      ...headers
    };
    console.log(url)

    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined
      });

      const responseData = await response.json().catch(() => null);

      if (response.status === 401) {
        // Token might be expired, try to refresh
        const refreshedAuth = await getValidAuth();
        if (refreshedAuth && refreshedAuth.accessToken !== auth.accessToken) {
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

}

/**
 * Create API client with config system
 */
function createApiClient(): ApiClient {
  const config = getConfig();
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
let _defaultApiClient: ApiClient | undefined;
export const defaultApiClient = (): ApiClient => {
  if (!_defaultApiClient) {
    _defaultApiClient = createApiClient();
  }
  return _defaultApiClient;
};
