import { CLIAuth } from "../auth/auth";
import { clearTokens, loadTokens, saveTokens } from "../auth/authUtils";
import { getConfigValue } from "../config/configUtils";

async function loginCommand() {
  // Get client ID from config system
  const clientId = getConfigValue('workosClientId');

  if (!clientId) {
    console.error('❌ WorkOS client ID not configured. Please set it first:');
    console.error('   floww config set workos-client-id <your-client-id>');
    process.exit(1);
  }

  const auth = new CLIAuth(clientId);

  try {
    const tokens = await auth.login();
    saveTokens(tokens);
    console.log("🎫 Credentials saved securely\n");
  } catch (error) {
    console.error("❌ Login failed:", error);
    process.exit(1);
  }
}

async function logoutCommand() {
  clearTokens();
  console.log("✅ Logged out successfully");
}

async function whoamiCommand() {
  const tokens = loadTokens();
  if (!tokens) {
    console.error('❌ Not logged in. Run "floww login" first.');
    process.exit(1);
  }

  console.log(`👤 Logged in as: ${tokens.user.email}`);
  console.log(`📧 User ID: ${tokens.user.id}`);
  console.log(
    `⏰ Token expires: ${new Date(tokens.expiresAt).toLocaleString()}`
  );
}

export { loginCommand, logoutCommand, whoamiCommand };
