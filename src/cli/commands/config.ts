import {
  getConfig,
  getConfigWithSources,
  updateStoredConfig,
  resetConfig,
  getConfigPath,
  configExists,
  getConfigSchema,
} from "../config/configUtils";
import { ConfigKey } from "../config/configTypes";
import { logger } from "../utils/logger";

export async function configSetCommand(key: string, value: string) {
  const schema = getConfigSchema();

  // Convert CLI key format to internal key format
  const configKey = Object.entries(schema).find(
    ([, config]) => config.cliKey === key,
  )?.[0] as ConfigKey;

  if (!configKey) {
    logger.error(`Unknown config key: ${key}`);
    logger.plain("\nAvailable keys:");
    Object.entries(schema).forEach(([, config]) => {
      logger.plain(`  ${config.cliKey}`);
    });
    process.exit(1);
  }

  try {
    updateStoredConfig(configKey, value);
    logger.success(`Set ${key} = ${value}`);
  } catch (error) {
    logger.error(`Failed to set config: ${error}`);
    process.exit(1);
  }
}

export async function configGetCommand(key: string) {
  const schema = getConfigSchema();

  // Convert CLI key format to internal key format
  const configKey = Object.entries(schema).find(
    ([, config]) => config.cliKey === key,
  )?.[0] as ConfigKey;

  if (!configKey) {
    console.error(`❌ Unknown config key: ${key}`);
    console.log("\nAvailable keys:");
    Object.entries(schema).forEach(([, config]) => {
      console.log(`  ${config.cliKey}`);
    });
    process.exit(1);
  }

  const configWithSources = getConfigWithSources();
  const { source, value } = configWithSources[configKey];

  console.log(`${key} = ${value} (${source})`);
}

export async function configListCommand() {
  const configWithSources = getConfigWithSources();
  const schema = getConfigSchema();

  console.log("📋 Configuration:");
  console.log("");

  Object.entries(configWithSources).forEach(([key, { source, value }]) => {
    const cliKey = schema[key as ConfigKey].cliKey;
    const sourceEmoji = {
      default: "🏠",
      config: "📁",
      env: "🌍",
      cli: "⚡",
    }[source];

    console.log(`  ${cliKey}: ${value} ${sourceEmoji} ${source}`);
  });

  console.log("");
  console.log("📍 Config file location:");
  console.log(`  ${getConfigPath()}`);

  if (!configExists()) {
    console.log("  (file does not exist - using defaults)");
  }
}

export async function configResetCommand() {
  try {
    resetConfig();
    console.log("✅ Configuration reset to defaults");
    console.log("");

    // Show the defaults
    const schema = getConfigSchema();
    console.log("🏠 Default configuration:");
    Object.entries(schema).forEach(([key, config]) => {
      console.log(`  ${config.cliKey}: ${config.default}`);
    });
  } catch (error) {
    console.error(`❌ Failed to reset config: ${error}`);
    process.exit(1);
  }
}

export async function configHelpCommand() {
  const schema = getConfigSchema();

  console.log("🔧 Floww Configuration");
  console.log("");
  console.log("Available commands:");
  console.log("  floww config set <key> <value>  Set a configuration value");
  console.log("  floww config get <key>          Get a configuration value");
  console.log("  floww config list               List all configuration");
  console.log("  floww config reset              Reset to defaults");
  console.log("");
  console.log("Available configuration keys:");
  Object.entries(schema).forEach(([key, config]) => {
    console.log(`  ${config.cliKey.padEnd(20)} (default: ${config.default})`);
  });
  console.log("");
  console.log("Configuration priority (highest to lowest):");
  console.log("  1. ⚡ CLI flags (--backend-url, --workos-client-id)");
  console.log(
    "  2. 🌍 Environment variables (FLOWW_BACKEND_URL, WORKOS_CLIENT_ID)",
  );
  console.log("  3. 📁 Config file (~/.config/floww/config.json)");
  console.log("  4. 🏠 Built-in defaults");
}
