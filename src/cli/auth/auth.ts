import fetch from 'node-fetch';
import open from 'open';
import { DeviceAuthResponse, StoredAuth, TokenResponse } from './authTypes';


export class CLIAuth {
  private clientId: string;
  private apiUrl = 'https://api.workos.com';

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  async login(): Promise<StoredAuth> {
    console.log('🔐 Starting authentication...\n');

    // Step 1: Request device authorization (NO API KEY NEEDED)
    const deviceAuth = await this.requestDeviceCode();

    // Step 2: Display instructions to user
    console.log('📱 Please visit this URL to authenticate:');
    console.log(`   ${deviceAuth.verification_uri_complete}\n`);
    console.log('   Or visit: ' + deviceAuth.verification_uri);
    console.log('   And enter code: ' + deviceAuth.user_code + '\n');

    // Optionally open browser automatically
    try {
      await open(deviceAuth.verification_uri_complete);
      console.log('✓ Browser opened automatically\n');
    } catch (error) {
      // Silent fail if browser can't be opened
    }

    console.log('⏳ Waiting for authorization...\n');

    // Step 3: Poll for tokens (NO API KEY NEEDED)
    const tokens = await this.pollForTokens(
      deviceAuth.device_code,
      deviceAuth.interval,
      deviceAuth.expires_in
    );

    console.log('✅ Successfully authenticated!');
    console.log(`👤 Logged in as: ${tokens.user.email}\n`);

    // Calculate expiration time
    // WorkOS tokens typically expire in 1800 seconds (30 minutes)
    const expiresInSeconds = tokens.expires_in || 1800; // Default to 30 min if not provided
    const expiresAt = Date.now() + expiresInSeconds * 1000;

    // Debug logging
    if (!tokens.expires_in) {
      console.warn('⚠️  Token response missing expires_in, using default 30 minutes');
    }

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      user: tokens.user,
      expiresAt,
    };
  }

  private async requestDeviceCode(): Promise<DeviceAuthResponse> {
    const response = await fetch(`${this.apiUrl}/user_management/authorize/device`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to request device code: ${error}`);
    }

    return await response.json() as DeviceAuthResponse;
  }

  private async pollForTokens(
    deviceCode: string,
    interval: number,
    expiresIn: number
  ): Promise<TokenResponse> {
    const startTime = Date.now();
    const expirationTime = startTime + expiresIn * 1000;
    let pollInterval = interval;

    while (Date.now() < expirationTime) {
      await this.sleep(pollInterval * 1000);

      try {
        const response = await fetch(`${this.apiUrl}/user_management/authenticate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: this.clientId,
            device_code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          }),
        });

        if (response.ok) {
          return await response.json() as TokenResponse;
        }

        const error = await response.json() as any;

        if (error.error === 'authorization_pending') {
          // User hasn't authorized yet, continue polling
          continue;
        } else if (error.error === 'slow_down') {
          // Increase polling interval
          pollInterval += 5;
          continue;
        } else if (error.error === 'expired_token' || error.error === 'access_denied') {
          throw new Error(
            error.error === 'expired_token'
              ? 'Authorization expired. Please try again.'
              : 'Authorization denied.'
          );
        } else {
          // Unknown error, continue polling
          continue;
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('Authorization')) {
          throw error;
        }
        // Network error, continue polling
        continue;
      }
    }

    throw new Error('Authentication timed out');
  }

  async refreshAccessToken(refreshToken: string): Promise<StoredAuth> {
    const response = await fetch(`${this.apiUrl}/user_management/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const tokens = await response.json() as TokenResponse;
    const expiresInSeconds = tokens.expires_in || 1800; // Default to 30 min if not provided
    const expiresAt = Date.now() + expiresInSeconds * 1000;

    if (!tokens.expires_in) {
      console.warn('⚠️  Token refresh response missing expires_in, using default 30 minutes');
    }

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      user: tokens.user,
      expiresAt,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}