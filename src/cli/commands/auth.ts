import { CLIAuth } from "../auth/auth";
import { clearTokens, loadTokens, saveTokens } from "../auth/authUtils";
import { getConfigValue } from "../config/configUtils";
import { logger } from "../utils/logger";

async function loginCommand() {
  // Get client ID from config system
  const clientId = getConfigValue("workosClientId");

  if (!clientId) {
    logger.error("WorkOS client ID not configured. Please set it first:");
    logger.plain.error("   floww config set workos-client-id <your-client-id>");
    process.exit(1);
  }

  const auth = new CLIAuth(clientId);

  try {
    const tokens = await auth.login();
    saveTokens(tokens);
    logger.success("Credentials saved securely");
  } catch (error) {
    logger.error("Login failed:", error);
    process.exit(1);
  }
}

async function logoutCommand() {
  clearTokens();
  logger.success("Logged out successfully");
}

async function whoamiCommand() {
  const tokens = loadTokens();
  if (!tokens) {
    logger.error('Not logged in. Run "floww login" first.');
    process.exit(1);
  }

  const now = Date.now();
  const expiresIn = Math.floor((tokens.expiresAt - now) / 1000); // seconds
  const isExpired = now >= tokens.expiresAt;

  logger.plain(`👤 Logged in as: ${tokens.user.email}`);
  logger.plain(`📧 User ID: ${tokens.user.id}`);
  logger.plain(
    `⏰ Token expires: ${new Date(tokens.expiresAt).toLocaleString()}`,
  );

  if (isExpired) {
    logger.warn(
      `Token is EXPIRED (expired ${Math.abs(expiresIn)} seconds ago)`,
    );
  } else {
    logger.success(
      `Token is valid (expires in ${expiresIn} seconds / ${Math.floor(
        expiresIn / 60,
      )} minutes)`,
    );
  }

  logger.plain(`🔑 Has refresh token: ${tokens.refreshToken ? "Yes" : "No"}`);
}

export { loginCommand, logoutCommand, whoamiCommand };
