import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export interface ProjectConfig {
  namespaceId: string;
  workflowId?: string;
  name: string;
  description?: string;
  version?: string;
}

const CONFIG_FILENAME = 'floww.yaml';

/**
 * Get the path to the project config file
 */
export function getProjectConfigPath(dir: string = process.cwd()): string {
  return path.join(dir, CONFIG_FILENAME);
}

/**
 * Check if a project config file exists
 */
export function hasProjectConfig(dir: string = process.cwd()): boolean {
  const configPath = getProjectConfigPath(dir);
  return fs.existsSync(configPath);
}

/**
 * Load the project config from floww.yaml
 * @throws Error if config file doesn't exist or is invalid
 */
export function loadProjectConfig(dir: string = process.cwd()): ProjectConfig {
  const configPath = getProjectConfigPath(dir);

  if (!fs.existsSync(configPath)) {
    throw new Error(
      `No floww.yaml found in ${dir}. Run 'floww init' to create one.`
    );
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = yaml.load(content) as ProjectConfig;

    // Validate required fields
    if (!config.namespaceId) {
      throw new Error('floww.yaml is missing required field: namespaceId');
    }
    if (!config.name) {
      throw new Error('floww.yaml is missing required field: name');
    }

    return config;
  } catch (error) {
    if (error instanceof yaml.YAMLException) {
      throw new Error(`Invalid YAML in floww.yaml: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Try to load project config, return null if it doesn't exist
 */
export function tryLoadProjectConfig(dir: string = process.cwd()): ProjectConfig | null {
  try {
    return loadProjectConfig(dir);
  } catch (error) {
    return null;
  }
}

/**
 * Save project config to floww.yaml
 */
export function saveProjectConfig(
  config: ProjectConfig,
  dir: string = process.cwd()
): void {
  const configPath = getProjectConfigPath(dir);

  // Validate required fields before saving
  if (!config.namespaceId) {
    throw new Error('Cannot save config: namespaceId is required');
  }
  if (!config.name) {
    throw new Error('Cannot save config: name is required');
  }

  const content = yaml.dump(config, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
  });
  fs.writeFileSync(configPath, content, 'utf-8');
}

/**
 * Initialize a new project config file
 * @throws Error if config file already exists
 */
export function initProjectConfig(
  config: ProjectConfig,
  dir: string = process.cwd(),
  force: boolean = false
): void {
  const configPath = getProjectConfigPath(dir);

  if (fs.existsSync(configPath) && !force) {
    throw new Error(
      `floww.yaml already exists in ${dir}. Use --force to overwrite.`
    );
  }

  saveProjectConfig(config, dir);
}

/**
 * Update specific fields in the project config
 */
export function updateProjectConfig(
  updates: Partial<ProjectConfig>,
  dir: string = process.cwd()
): ProjectConfig {
  const config = loadProjectConfig(dir);
  const updatedConfig = { ...config, ...updates };
  saveProjectConfig(updatedConfig, dir);
  return updatedConfig;
}
