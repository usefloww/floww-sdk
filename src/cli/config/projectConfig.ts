import fs from "fs";
import path from "path";
import yaml from "js-yaml";

export interface BuildConfig {
  type: "docker"; // Future-proof for other build types
  context?: string; // Relative path to build context (default: ".")
  dockerfile?: string; // Relative path to Dockerfile (default: "./Dockerfile")
  extra_options?: string[]; // Additional Docker CLI flags
}

export interface ProjectConfig {
  workflowId?: string;
  name: string;
  description?: string;
  version?: string;
  entrypoint?: string;
  build?: BuildConfig; // Optional build configuration
}

const CONFIG_FILENAME = "floww.yaml";

/**
 * Get the path to the project config file
 */
export function getProjectConfigPath(dir: string = process.cwd()): string {
  return path.join(dir, CONFIG_FILENAME);
}

/**
 * Find the project directory by searching upward from a given path for floww.yaml
 * @param startPath - The path to start searching from (file or directory)
 * @returns The directory containing floww.yaml, or null if not found
 */
export function findProjectDirectory(startPath: string): string | null {
  let currentDir = fs.statSync(startPath).isDirectory()
    ? path.resolve(startPath)
    : path.resolve(path.dirname(startPath));

  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    if (hasProjectConfig(currentDir)) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  // Check root directory
  if (hasProjectConfig(root)) {
    return root;
  }

  return null;
}

/**
 * Detect the project directory from an entrypoint file path or current directory
 * @param entrypointPath - Optional path to the entrypoint file
 * @returns The detected project directory, or process.cwd() if not found
 */
export function detectProjectDirectory(entrypointPath?: string): string {
  if (entrypointPath) {
    const absolutePath = path.isAbsolute(entrypointPath)
      ? entrypointPath
      : path.resolve(process.cwd(), entrypointPath);

    if (fs.existsSync(absolutePath)) {
      const projectDir = findProjectDirectory(absolutePath);
      if (projectDir) {
        return projectDir;
      }
    }
  }

  // Fallback: check if current directory has floww.yaml
  if (hasProjectConfig(process.cwd())) {
    return process.cwd();
  }

  // Last resort: use current working directory
  return process.cwd();
}

/**
 * Check if a project config file exists
 */
export function hasProjectConfig(dir: string = process.cwd()): boolean {
  const configPath = getProjectConfigPath(dir);
  return fs.existsSync(configPath);
}

/**
 * Validate build configuration paths and options
 * @throws Error if validation fails
 */
function validateBuildConfig(
  buildConfig: BuildConfig,
  projectDir: string,
): void {
  // Validate build type
  if (buildConfig.type !== "docker") {
    throw new Error(
      `Unsupported build type: ${buildConfig.type}. Only 'docker' is supported.`,
    );
  }

  // Validate context path if specified
  if (buildConfig.context) {
    const contextPath = path.resolve(projectDir, buildConfig.context);
    if (!fs.existsSync(contextPath)) {
      throw new Error(
        `Build context not found: ${buildConfig.context} (resolved to ${contextPath})`,
      );
    }
    if (!fs.statSync(contextPath).isDirectory()) {
      throw new Error(
        `Build context must be a directory: ${buildConfig.context}`,
      );
    }
  }

  // Validate dockerfile path if specified
  if (buildConfig.dockerfile) {
    const dockerfilePath = path.resolve(projectDir, buildConfig.dockerfile);
    if (!fs.existsSync(dockerfilePath)) {
      throw new Error(
        `Dockerfile not found: ${buildConfig.dockerfile} (resolved to ${dockerfilePath})`,
      );
    }
    if (!fs.statSync(dockerfilePath).isFile()) {
      throw new Error(
        `Dockerfile must be a file: ${buildConfig.dockerfile}`,
      );
    }
  }

  // Validate extra_options is an array if specified
  if (
    buildConfig.extra_options &&
    !Array.isArray(buildConfig.extra_options)
  ) {
    throw new Error("build.extra_options must be an array of strings");
  }
}

/**
 * Load the project config from floww.yaml
 * @throws Error if config file doesn't exist or is invalid
 */
export function loadProjectConfig(dir: string = process.cwd()): ProjectConfig {
  const configPath = getProjectConfigPath(dir);

  if (!fs.existsSync(configPath)) {
    throw new Error(
      `No floww.yaml found in ${dir}. Run 'floww init' to create one.`,
    );
  }

  try {
    const content = fs.readFileSync(configPath, "utf-8");
    const config = yaml.load(content) as ProjectConfig;

    // Validate required fields
    if (!config.name) {
      throw new Error("floww.yaml is missing required field: name");
    }

    // Validate build config if present
    if (config.build) {
      validateBuildConfig(config.build, dir);
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
export function tryLoadProjectConfig(
  dir: string = process.cwd(),
): ProjectConfig | null {
  try {
    return loadProjectConfig(dir);
  } catch (error) {
    return null;
  }
}

/**
 * Load raw YAML config without validation (for partial configs)
 * Returns the raw object with all fields preserved, including custom ones
 */
export function loadRawProjectConfig(
  dir: string = process.cwd(),
): Record<string, any> | null {
  const configPath = getProjectConfigPath(dir);

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(configPath, "utf-8");
    const config = yaml.load(content) as Record<string, any>;
    return config || {};
  } catch (error) {
    // If YAML is invalid, return null so init can handle it
    return null;
  }
}

/**
 * Save project config to floww.yaml
 * @param preserveCustomFields - If true, merges with existing config to preserve custom fields
 */
export function saveProjectConfig(
  config: ProjectConfig | Record<string, any>,
  dir: string = process.cwd(),
  preserveCustomFields: boolean = false,
): void {
  const configPath = getProjectConfigPath(dir);

  // Validate required fields before saving
  if (!config.name) {
    throw new Error("Cannot save config: name is required");
  }

  let configToSave: Record<string, any> = config;

  // If preserving custom fields, merge with existing config
  if (preserveCustomFields && fs.existsSync(configPath)) {
    const existing = loadRawProjectConfig(dir);
    if (existing) {
      // Merge: existing fields are preserved, new fields override
      configToSave = { ...existing, ...config };
    }
  }

  const content = yaml.dump(configToSave, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
  });
  fs.writeFileSync(configPath, content, "utf-8");
}

/**
 * Initialize a new project config file
 * @throws Error if config file already exists
 */
export function initProjectConfig(
  config: ProjectConfig,
  dir: string = process.cwd(),
  force: boolean = false,
): void {
  const configPath = getProjectConfigPath(dir);

  if (fs.existsSync(configPath) && !force) {
    throw new Error(
      `floww.yaml already exists in ${dir}. Use --force to overwrite.`,
    );
  }

  saveProjectConfig(config, dir);
}

/**
 * Update specific fields in the project config
 * Preserves custom fields that aren't part of the ProjectConfig interface
 */
export function updateProjectConfig(
  updates: Partial<ProjectConfig>,
  dir: string = process.cwd(),
): ProjectConfig {
  const existing = loadRawProjectConfig(dir);
  const config = loadProjectConfig(dir);
  const updatedConfig = { ...existing, ...config, ...updates };
  saveProjectConfig(updatedConfig, dir, true);
  return updatedConfig as ProjectConfig;
}
