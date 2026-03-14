import open from "open";
import jwt from "jsonwebtoken";
import { DeviceAuthResponse, StoredAuth, TokenResponse } from "./authTypes";
import { BackendConfig } from "../config/backendConfig";
import { logger } from "../utils/logger";
import { getConfigValue } from "../config/configUtils";

function extractExpirationFromJWT(accessToken: string): number {
  try {
    const decoded = jwt.decode(accessToken) as jwt.JwtPayload;

    if (!decoded || !decoded.exp) {
      throw new Error("JWT missing exp field");
    }

    // Convert from seconds to milliseconds
    return decoded.exp * 1000;
  } catch (error) {
    console.warn("⚠️  Failed to parse JWT expiration, using fallback");
    // Fallback to 30 minutes from now
    return Date.now() + 30 * 60 * 1000;
  }
}

export class CLIAuth {
  private config: BackendConfig;

  constructor(config: BackendConfig) {
    this.config = config;
  }

  async login(): Promise<StoredAuth> {
    logger.info("Starting authentication...");

    // Step 1: Request device authorization (NO API KEY NEEDED)
    const deviceAuth = await logger.task(
      "Requesting device authorization",
      async () => {
        return await this.requestDeviceCode();
      }
    );

    // Step 2: Display instructions to user
    logger.plain(
      `📱 Please visit this URL to authenticate:\n   ${deviceAuth.verification_uri_complete}\n\n   Or visit: ${deviceAuth.verification_uri}\n   And enter code: ${deviceAuth.user_code}`
    );

    // Optionally open browser automatically
    try {
      await open(deviceAuth.verification_uri_complete);
      logger.success("Browser opened automatically");
    } catch (error) {
      // Silent fail if browser can't be opened
    }

    // Step 3: Poll for tokens (NO API KEY NEEDED)
    const tokens = await logger.task("Waiting for authorization", async () => {
      return await this.pollForTokens(
        deviceAuth.device_code,
        deviceAuth.interval,
        deviceAuth.expires_in
      );
    });

    logger.success("Successfully authenticated!");

    // Step 4: Get user info
    let user: any;
    if (tokens.user) {
      user = tokens.user;
    } else {
      user = await this.fetchUserInfo(tokens.access_token);
    }
    const displayEmail = user?.email || user?.id || "unknown";
    logger.plain(`👤 Logged in as: ${displayEmail}`);

    // Extract expiration time from JWT
    const expiresAt = extractExpirationFromJWT(tokens.access_token);

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      user,
      expiresAt,
    };
  }

  private async requestDeviceCode(): Promise<DeviceAuthResponse> {
    if (!this.config.auth.device_authorization_endpoint) {
      throw new Error("Device authorization endpoint not configured");
    }

    const extraParams: Record<string, string> = {};
    if (this.config.auth.audience) {
      extraParams.audience = this.config.auth.audience;
    }
    const response = await fetch(
      this.config.auth.device_authorization_endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: this.config.auth.client_id,
          ...extraParams,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to request device code: ${error}`);
    }

    return (await response.json()) as DeviceAuthResponse;
  }

  private async pollForTokens(
    deviceCode: string,
    interval: number,
    expiresIn: number
  ): Promise<TokenResponse> {
    if (!this.config.auth.token_endpoint) {
      throw new Error("Token endpoint not configured");
    }

    const startTime = Date.now();
    const expirationTime = startTime + expiresIn * 1000;
    let pollInterval = interval;

    while (Date.now() < expirationTime) {
      await this.sleep(pollInterval * 1000);

      try {
        const response = await fetch(this.config.auth.token_endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: this.config.auth.client_id,
            device_code: deviceCode,
            grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          }),
        });

        if (response.ok) {
          return (await response.json()) as TokenResponse;
        }

        const error = (await response.json()) as any;

        if (error.error === "authorization_pending") {
          // User hasn't authorized yet, continue polling
          continue;
        } else if (error.error === "slow_down") {
          // Increase polling interval
          pollInterval += 5;
          continue;
        } else if (
          error.error === "expired_token" ||
          error.error === "access_denied"
        ) {
          throw new Error(
            error.error === "expired_token"
              ? "Authorization expired. Please try again."
              : "Authorization denied."
          );
        } else {
          // Unknown error, continue polling
          continue;
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes("Authorization")) {
          throw error;
        }
        // Network error, continue polling
        continue;
      }
    }

    throw new Error("Authentication timed out");
  }

  async refreshAccessToken(refreshToken: string): Promise<StoredAuth> {
    if (!this.config.auth.token_endpoint) {
      throw new Error("Token endpoint not configured");
    }

    // Use native fetch (Node 18+)
    const response = await fetch(this.config.auth.token_endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: this.config.auth.client_id,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to refresh token");
    }

    const tokens = (await response.json()) as TokenResponse;

    // Fetch user info from /whoami endpoint
    const user = await this.fetchUserInfo(tokens.access_token);

    // Extract expiration time from JWT
    const expiresAt = extractExpirationFromJWT(tokens.access_token);

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      user,
      expiresAt,
    };
  }

  private async fetchUserInfo(accessToken: string): Promise<any> {
    const backendUrl = getConfigValue("backendUrl");
    const whoamiUrl = `${backendUrl}/api/whoami`;

    // Use native fetch (Node 18+)
    const response = await fetch(whoamiUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.statusText}`);
    }

    return await response.json();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
