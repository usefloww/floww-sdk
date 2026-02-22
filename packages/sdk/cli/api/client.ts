import { loadActiveProfile } from "../auth/authUtils";
import { getConfig } from "../config/configUtils";
import { ApiClient } from "./types";
import { UserApiClient } from "./UserApiClient";
import { TokenApiClient } from "./TokenApiClient";

function createApiClient(): ApiClient {
  // Priority 1: FLOWW_TOKEN environment variable
  if (process.env.FLOWW_TOKEN) {
    const config = getConfig();
    return new TokenApiClient(config.backendUrl, process.env.FLOWW_TOKEN);
  }

  // Priority 2: Active user profile
  const profile = loadActiveProfile();
  if (profile) {
    return new UserApiClient(profile.backendUrl);
  }

  // No authentication found
  throw new Error(
    "No authentication found. Run `npx floww login` or set FLOWW_TOKEN environment variable."
  );
}

// Default client instance (singleton pattern)
let _defaultApiClient: ApiClient | undefined;
export const defaultApiClient = (): ApiClient => {
  if (!_defaultApiClient) {
    _defaultApiClient = createApiClient();
  }
  return _defaultApiClient;
};
