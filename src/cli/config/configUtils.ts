import fs from 'fs';
import path from 'path';
import { getFlowwConfigDir } from './xdg';
import { FlowwConfig, CONFIG_SCHEMA, ConfigKey, ConfigWithSources, ConfigSource } from './configTypes';

const CONFIG_FILE = 'config.json';

function getConfigFilePath(): string {
  return path.join(getFlowwConfigDir(), CONFIG_FILE);
}

function ensureConfigDir(): void {
  const configDir = getFlowwConfigDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

function loadConfigFile(): Partial<FlowwConfig> {
  const configPath = getConfigFilePath();
  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    const data = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to load config file:', error);
    return {};
  }
}

function saveConfigFile(config: Partial<FlowwConfig>): void {
  ensureConfigDir();
  const configPath = getConfigFilePath();

  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    fs.chmodSync(configPath, 0o600); // Secure permissions
  } catch (error) {
    console.error('Failed to save config file:', error);
    throw error;
  }
}

// Priority: CLI > ENV > CONFIG FILE > DEFAULT
export function getConfig(cliOptions: Partial<FlowwConfig> = {}): FlowwConfig {
  const fileConfig = loadConfigFile();
  const config = {} as FlowwConfig;

  // Apply each config key in priority order
  for (const key of Object.keys(CONFIG_SCHEMA) as ConfigKey[]) {
    const schema = CONFIG_SCHEMA[key];

    // 1. CLI options (highest priority)
    if (cliOptions[key]) {
      config[key] = cliOptions[key];
      continue;
    }

    // 2. Environment variables
    if (process.env[schema.envVar]) {
      config[key] = process.env[schema.envVar]!;
      continue;
    }

    // 3. Config file
    if (fileConfig[key]) {
      config[key] = fileConfig[key];
      continue;
    }

    // 4. Default value
    config[key] = schema.default;
  }

  return config;
}

export function getConfigWithSources(cliOptions: Partial<FlowwConfig> = {}): ConfigWithSources {
  const fileConfig = loadConfigFile();
  const configWithSources = {} as ConfigWithSources;

  for (const key of Object.keys(CONFIG_SCHEMA) as ConfigKey[]) {
    const schema = CONFIG_SCHEMA[key];
    let source: ConfigSource['source'] = 'default';
    let value = schema.default;

    // Check each source in reverse priority order
    if (fileConfig[key]) {
      source = 'config';
      value = fileConfig[key];
    }

    if (process.env[schema.envVar]) {
      source = 'env';
      value = process.env[schema.envVar]!;
    }

    if (cliOptions[key]) {
      source = 'cli';
      value = cliOptions[key];
    }

    configWithSources[key] = { source, value };
  }

  return configWithSources;
}

export function setConfig(key: ConfigKey, value: string): void {
  const currentConfig = loadConfigFile();
  currentConfig[key] = value;
  saveConfigFile(currentConfig);
}

export function getConfigValue(key: ConfigKey, cliOptions: Partial<FlowwConfig> = {}): string {
  return getConfig(cliOptions)[key];
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