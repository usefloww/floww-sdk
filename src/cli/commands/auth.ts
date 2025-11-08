import { CLIAuth } from "../auth/auth";
import {
  clearTokens,
  loadActiveProfile,
  loadTokens,
  saveProfile,
  saveTokens,
  setActiveProfile,
} from "../auth/authUtils";
import { fetchBackendConfig } from "../config/backendConfig";
import { getConfigValue } from "../config/configUtils";
import { logger } from "../utils/logger";
import { defaultApiClient } from "../api/client";
import chalk from "chalk";

async function loginCommand() {
  const backendUrl = getConfigValue("backendUrl");

  logger.info(`Connecting to ${backendUrl}...`);

  try {
    const config = await fetchBackendConfig(backendUrl);
    logger.success(`Connected to backend (provider: ${config.auth.provider})`);

    const auth = new CLIAuth(config);
    const tokens = await auth.login();

    saveProfile(backendUrl, config, tokens);
    setActiveProfile(backendUrl);

    logger.success("Credentials saved securely");
    logger.plain(`Active profile: ${new URL(backendUrl).hostname}`);
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
  const profile = loadActiveProfile();
  if (!profile) {
    const oldTokens = loadTokens();
    if (oldTokens) {
      logger.warn(
        "Found old-style auth. Please login again to use the new profile system."
      );
    }
    logger.error('Not logged in. Run "floww login" first.');
    process.exit(1);
  }

  try {
    const client = defaultApiClient();
    const response = await client.apiCall("/whoami");

    if (response.error || !response.data) {
      logger.error(
        response.error || "Failed to fetch user information from backend"
      );
      process.exit(1);
    }

    const user = response.data;

    // Helper function to format labels with consistent width
    const formatLabel = (label: string) => {
      return chalk.gray(label.padEnd(12));
    };

    // Display user information in a nice format
    console.log("\n" + chalk.bold.cyan("👤 User Information"));
    console.log(chalk.gray("─".repeat(50)));

    // Don't show email for service accounts
    if (user.user_type !== "service_account") {
      console.log(
        `  ${formatLabel("Email:")}${
          user.email ? chalk.white.bold(user.email) : chalk.dim("N/A")
        }`
      );
    }

    if (user.first_name || user.last_name) {
      const fullName = [user.first_name, user.last_name]
        .filter(Boolean)
        .join(" ");
      console.log(`  ${formatLabel("Name:")}${chalk.white(fullName)}`);
    }

    console.log(`  ${formatLabel("User ID:")}${chalk.dim(user.id)}`);

    if (user.user_type) {
      const userTypeColor =
        user.user_type === "human" ? chalk.green : chalk.blue;
      console.log(`  ${formatLabel("Type:")}${userTypeColor(user.user_type)}`);
    }

    if (user.created_at) {
      const createdAt = new Date(user.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      console.log(`  ${formatLabel("Created on:")}${chalk.white(createdAt)}`);
    }

    console.log(chalk.gray("─".repeat(50)));
    console.log(chalk.bold.cyan("\n🔗 Connection"));
    console.log(chalk.gray("─".repeat(50)));
    console.log(
      `  ${formatLabel("Backend:")}${chalk.cyan(profile.backendUrl)}`
    );
    console.log(`  ${formatLabel("Profile:")}${chalk.white(profile.name)}`);
    console.log();
  } catch (error) {
    logger.error("Failed to fetch user information:", error);
    process.exit(1);
  }
}

export { loginCommand, logoutCommand, whoamiCommand };
