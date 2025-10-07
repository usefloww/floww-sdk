export interface DeviceAuthResponse {
    device_code: string;
    user_code: string;
    verification_uri: string;
    verification_uri_complete: string;
    expires_in: number;
    interval: number;
  }
  
  export interface TokenResponse {
    access_token: string;
    refresh_token?: string;
    token_type: string;
    expires_in?: number; // Optional because WorkOS might not always return it
    user: {
      id: string;
      email: string;
      first_name?: string;
      last_name?: string;
    };
  }
  
  export interface StoredAuth {
    accessToken: string;
    refreshToken?: string;
    user: any;
    expiresAt: number;
  }