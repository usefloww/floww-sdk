import {
  loadActiveProfile,
  loadTokens,
  saveProfile,
  saveTokens,
} from "./authUtils";
import { CLIAuth } from "./auth";
import { StoredAuth } from "./authTypes";
import { getConfig } from "../config/configUtils";

export async function getAuthToken(): Promise<string | null> {
  const auth = await getValidAuth();
  return auth?.accessToken || null;
}

export async function getValidAuth(): Promise<StoredAuth | null> {
  // Check for FLOWW_TOKEN environment variable first (takes priority over all other auth methods)
  const flowwToken = process.env.FLOWW_TOKEN;
  if (flowwToken) {
    // Return a minimal StoredAuth object for API key authentication
    // API keys don't expire (they're revoked instead), so set a far-future expiration
    // to prevent refresh attempts
    return {
      accessToken: flowwToken,
      refreshToken: undefined,
      user: {}, // Minimal user object (not critical for API key auth)
      expiresAt: new Date("2100-01-01").getTime(), // Far-future timestamp
    };
  }

  const profile = loadActiveProfile();

  if (profile) {
    const auth = profile.auth;
    const bufferMs = 10 * 60 * 1000;
    const isExpired = Date.now() >= auth.expiresAt - bufferMs;

    if (isExpired && auth.refreshToken) {
      return await refreshTokenWithProfile(profile);
    }

    return auth;
  }

  const auth = loadTokens();
  if (!auth) {
    return null;
  }

  const bufferMs = 10 * 60 * 1000;
  const isExpired = Date.now() >= auth.expiresAt - bufferMs;

  if (isExpired && auth.refreshToken) {
    return await refreshTokenLegacy(auth);
  }

  return auth;
}

async function refreshTokenWithProfile(
  profile: any
): Promise<StoredAuth | null> {
  if (!profile.auth.refreshToken) {
    return null;
  }

  try {
    const cliAuth = new CLIAuth(profile.config);
    const refreshedAuth = await cliAuth.refreshAccessToken(
      profile.auth.refreshToken
    );

    saveProfile(profile.backendUrl, profile.config, refreshedAuth);

    return refreshedAuth;
  } catch (error) {
    console.error("Failed to refresh token:", error);
    return null;
  }
}

async function refreshTokenLegacy(
  auth: StoredAuth
): Promise<StoredAuth | null> {
  if (!auth.refreshToken) {
    return null;
  }

  try {
    const config = getConfig();
    const apiUrl = config.workosApiUrl || "https://api.workos.com";

    const cliAuth = new CLIAuth({
      auth: {
        provider: "workos",
        client_id: config.workosClientId,
        device_authorization_endpoint: `${apiUrl}/user_management/authorize/device`,
        token_endpoint: `${apiUrl}/user_management/authenticate`,
        authorization_endpoint: `${apiUrl}/user_management/authorize`,
        issuer: `${apiUrl}/user_management`,
      },
      websocket_url:
        config.websocketUrl || "wss://ws.usefloww.dev/connection/websocket",
    });
    const refreshedAuth = await cliAuth.refreshAccessToken(auth.refreshToken);

    saveTokens(refreshedAuth);

    return refreshedAuth;
  } catch (error) {
    console.error("Failed to refresh token:", error);
    return null;
  }
}
