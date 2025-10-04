import { CLIAuth } from "../auth/auth";
import { clearTokens, loadTokens, saveTokens } from "../auth/authUtils";

const clientId = "client_01K6QQP8Q721ZX1YM1PBV3EWMR";

async function loginCommand() {
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
    console.error('❌ Not logged in. Run "mycli login" first.');
    process.exit(1);
  }

  console.log(`👤 Logged in as: ${tokens.user.email}`);
  console.log(`📧 User ID: ${tokens.user.id}`);
  console.log(
    `⏰ Token expires: ${new Date(tokens.expiresAt).toLocaleString()}`
  );
}

export { loginCommand, logoutCommand, whoamiCommand };
