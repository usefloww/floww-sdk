import fs from "fs";
import path from "path";
import { getFlowwConfigDir } from "./xdg";
import {
  FlowwConfig,
  CONFIG_SCHEMA,
  ConfigKey,
  ConfigWithSources,
  ConfigSource,
} from "./configTypes";

const CONFIG_FILE = "config.json";
let inMemoryConfig: FlowwConfig | null = null;

function getConfigFilePath(): string {
  return path.join(getFlowwConfigDir(), CONFIG_FILE);
}

function ensureConfigDir(): void {
  const configDir = getFlowwConfigDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

export function getConfig(): FlowwConfig {
  if (!inMemoryConfig) {
    throw new Error("Config not initialized. Call setConfig() first.");
  }
  return inMemoryConfig;
}

export function setConfig(cliOptions: Partial<FlowwConfig> = {}): void {
  const fileConfig = getStoredConfig();
  const config = {} as FlowwConfig;

  for (const key of Object.keys(CONFIG_SCHEMA) as ConfigKey[]) {
    const schema = CONFIG_SCHEMA[key];

    if (cliOptions[key]) {
      config[key] = cliOptions[key];
    } else if (process.env[schema.envVar]) {
      config[key] = process.env[schema.envVar]!;
    } else if (fileConfig[key]) {
      config[key] = fileConfig[key];
    } else {
      config[key] = schema.default;
    }
  }

  inMemoryConfig = config;
}

export function getStoredConfig(): Partial<FlowwConfig> {
  const configPath = getConfigFilePath();
  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    const data = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Failed to load config file:", error);
    return {};
  }
}

export function setStoredConfig(config: Partial<FlowwConfig>): void {
  ensureConfigDir();
  const configPath = getConfigFilePath();

  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    fs.chmodSync(configPath, 0o600);
  } catch (error) {
    console.error("Failed to save config file:", error);
    throw error;
  }
}

export function getConfigValue(key: ConfigKey): string {
  return getConfig()[key];
}

export function getConfigWithSources(): ConfigWithSources {
  const fileConfig = getStoredConfig();
  const configWithSources = {} as ConfigWithSources;

  for (const key of Object.keys(CONFIG_SCHEMA) as ConfigKey[]) {
    const schema = CONFIG_SCHEMA[key];
    let source: ConfigSource["source"] = "default";
    let value: string = schema.default;

    if (fileConfig[key]) {
      source = "config";
      value = fileConfig[key];
    }

    if (process.env[schema.envVar]) {
      source = "env";
      value = process.env[schema.envVar]!;
    }

    configWithSources[key] = { source, value };
  }

  return configWithSources;
}

export function updateStoredConfig(key: ConfigKey, value: string): void {
  const currentConfig = getStoredConfig();
  currentConfig[key] = value;
  setStoredConfig(currentConfig);
}

export function resetConfig(): void {
  const configPath = getConfigFilePath();
  if (fs.existsSync(configPath)) {
    fs.unlinkSync(configPath);
  }
}

export function configExists(): boolean {
  return fs.existsSync(getConfigFilePath());
}

export function getConfigSchema() {
  return CONFIG_SCHEMA;
}

export function getConfigPath(): string {
  return getConfigFilePath();
}
