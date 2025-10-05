import { loadTokens, saveTokens } from './authUtils';
import { CLIAuth } from './auth';
import { StoredAuth } from './authTypes';
import { getConfig } from '../config/configUtils';

/**
 * Get a valid authentication token, refreshing if necessary
 */
export async function getAuthToken(): Promise<string | null> {
  const auth = await getValidAuth();
  return auth?.accessToken || null;
}

/**
 * Get valid authentication, refreshing if necessary
 */
export async function getValidAuth(): Promise<StoredAuth | null> {
  const auth = loadTokens();
  if (!auth) {
    return null;
  }

  // Check if token is expired (with 5 minute buffer)
  const isExpired = Date.now() >= (auth.expiresAt - 5 * 60 * 1000);

  if (isExpired && auth.refreshToken) {
    return await refreshToken(auth);
  }

  return auth;
}

/**
 * Refresh the access token using refresh token
 */
async function refreshToken(auth: StoredAuth): Promise<StoredAuth | null> {
  if (!auth.refreshToken) {
    return null;
  }

  try {
    const config = getConfig();
    const cliAuth = new CLIAuth(config.workosClientId);
    const refreshedAuth = await cliAuth.refreshAccessToken(auth.refreshToken);

    // Save the new tokens
    saveTokens(refreshedAuth);

    return refreshedAuth;
  } catch (error) {
    console.error('Failed to refresh token:', error);
    return null;
  }
}