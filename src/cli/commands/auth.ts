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

  const now = Date.now();
  const expiresIn = Math.floor((tokens.expiresAt - now) / 1000); // seconds
  const isExpired = now >= tokens.expiresAt;

  console.log(`👤 Logged in as: ${tokens.user.email}`);
  console.log(`📧 User ID: ${tokens.user.id}`);
  console.log(`⏰ Token expires: ${new Date(tokens.expiresAt).toLocaleString()}`);

  if (isExpired) {
    console.log(`⚠️  Token is EXPIRED (expired ${Math.abs(expiresIn)} seconds ago)`);
  } else {
    console.log(`✅ Token is valid (expires in ${expiresIn} seconds / ${Math.floor(expiresIn / 60)} minutes)`);
  }

  console.log(`🔑 Has refresh token: ${tokens.refreshToken ? 'Yes' : 'No'}`);
}

export { loginCommand, logoutCommand, whoamiCommand };
