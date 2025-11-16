import fs from "fs";
import path from "path";
import {
  initProjectConfig,
  hasProjectConfig,
  getProjectConfigPath,
  updateProjectConfig,
  BuildConfig,
} from "../config/projectConfig";
import { fetchNamespaces } from "../api/apiMethods";
import { logger } from "../utils/logger";
import { setupWorkflow } from "../utils/promptUtils";
import { getValidAuth } from "../auth/tokenUtils";

interface InitOptions {
  force?: boolean;
  name?: string;
  namespace?: string;
  description?: string;
  silent?: boolean; // For internal use when called from deploy
}

export async function initCommand(
  options: InitOptions = {}
): Promise<string | null> {
  if (!options.silent) {
    logger.info("Initializing new Floww project");
  }

  // Ask user to choose initialization mode
  let initMode: "current" | "new" = "current";
  let projectDir = process.cwd();

  if (!options.silent) {
    initMode = await logger.select("How would you like to initialize?", [
      {
        value: "new" as const,
        label: "Create new scaffolded project",
        hint: "Generate complete project structure",
      },
      {
        value: "current" as const,
        label: "Initialize in current directory",
        hint: "Add floww.yaml to existing project",
      },
    ]);

    // If creating new project, ask for directory name
    if (initMode === "new") {
      const dirName = await logger.text(
        "Project directory name:",
        "my-floww-project"
      );
      if (!dirName) {
        logger.error("Directory name is required");
        return null;
      }
      if (!/^[a-zA-Z0-9\-_]+$/.test(dirName)) {
        logger.error(
          "Directory name can only contain letters, numbers, hyphens, and underscores"
        );
        return null;
      }
      projectDir = path.join(process.cwd(), dirName);

      // Check if directory already exists
      if (fs.existsSync(projectDir)) {
        logger.error(`Directory '${dirName}' already exists`);
        return null;
      }

      // Create the directory
      fs.mkdirSync(projectDir, { recursive: true });
      logger.success(`Created directory: ${dirName}`);
    }
  }

  // Check if config already exists (in target directory)
  if (hasProjectConfig(projectDir) && !options.force) {
    if (!options.silent) {
      logger.error("floww.yaml already exists in this directory.");
      logger.error(
        "   Use --force to overwrite or run this command in a different directory."
      );
    }
    return null;
  }

  try {
    // Get workflow name
    let name = options.name;
    if (!name) {
      name = await logger.text("Workflow name:", "my-workflow");
      if (!name) {
        logger.error("Workflow name is required");
        return null;
      }
      if (name.length < 2) {
        logger.error("Name must be at least 2 characters");
        return null;
      }
      if (!/^[a-zA-Z0-9\-_\s]+$/.test(name)) {
        logger.error(
          "Name can only contain letters, numbers, spaces, hyphens, and underscores"
        );
        return null;
      }
    }

    // Check if user is authenticated
    const auth = await getValidAuth();
    let workflowId: string | undefined;

    if (auth) {
      // User is authenticated - create workflow via API
      const result = await setupWorkflow({
        suggestedName: name,
        allowCreate: true,
      });
      workflowId = result.workflowId;
    } else {
      // User is not authenticated - skip API calls
      if (!options.silent) {
        logger.warn("Not logged in - creating local project only");
      }
      workflowId = undefined;
    }

    // Create config
    const config = {
      ...(workflowId && { workflowId }),
      name,
      ...(options.description && { description: options.description }),
      version: "1.0.0",
      entrypoint: "main.ts",
    };

    // Save config
    initProjectConfig(config, projectDir, options.force);

    if (!options.silent) {
      logger.success("Created floww.yaml");
      logger.plain(`   Workflow: ${name}`);
      if (workflowId) {
        logger.plain(`   Workflow ID: ${workflowId}`);
      } else {
        logger.plain("   Workflow ID: (not set - login required)");
      }
    }

    if (initMode === "new" && !options.silent) {
      await scaffoldProject(projectDir, name);
    } else {
      const exampleFile = path.join(projectDir, "main.ts");
      if (!fs.existsSync(exampleFile) && !options.silent) {
        const shouldCreateExample = await logger.confirm(
          "Create example main.ts file?"
        );
        if (shouldCreateExample) {
          createExampleWorkflow(exampleFile);
          logger.success("Created main.ts");
        }
      }
    }

    if (!options.silent) {
      logger.success("Project initialized successfully!");

      if (initMode === "new") {
        const dirName = path.basename(projectDir);
        logger.plain("\nCreated files:");
        logger.plain("  - floww.yaml");
        logger.plain("  - main.ts");
        logger.plain("  - package.json");
        logger.plain("  - Dockerfile");
        logger.plain("  - .dockerignore");
        logger.plain("  - .gitignore");

        if (!workflowId) {
          logger.plain("\nNext steps:");
          logger.plain(`  1. cd ${dirName}`);
          logger.plain("  2. npm install");
          logger.plain("  3. Edit your workflow in main.ts");
          logger.plain("  4. Login: floww login");
          logger.plain("  5. Deploy: floww deploy");
          logger.plain("  6. Start building! 🚀\n");
        } else {
          logger.plain("\nNext steps:");
          logger.plain(`  1. cd ${dirName}`);
          logger.plain("  2. npm install");
          logger.plain("  3. Edit your workflow in main.ts");
          logger.plain("  4. Run: floww dev main.ts");
          logger.plain("  5. Deploy: floww deploy");
          logger.plain("  6. Start building! 🚀\n");
        }
      } else {
        if (!workflowId) {
          logger.plain("\nNext steps:");
          logger.plain("  1. Edit your workflow in main.ts");
          logger.plain("  2. Login: floww login");
          logger.plain("  3. Deploy: floww deploy");
          logger.plain("  4. Start building! 🚀\n");
        } else {
          logger.plain("\nNext steps:");
          logger.plain("  1. Edit your workflow in main.ts");
          logger.plain("  2. Run: floww dev main.ts");
          logger.plain("  3. Deploy: floww deploy");
          logger.plain("  4. Start building! 🚀\n");
        }
      }
    }

    return workflowId || null;
  } catch (error) {
    logger.error("Failed to initialize project", error);
    if (options.silent) {
      throw error;
    }
    process.exit(1);
  }
}

function createExampleWorkflow(filePath: string) {
  const template = `import { Builtin } from 'floww';

const builtin = new Builtin();

export default [
  builtin.triggers.onCron({
    expression: '*/5 * * * * *', // Every 5 seconds
    handler: (ctx, event) => {
      console.log('Hello from your workflow! 👋');
      console.log('Triggered at:', event.scheduledTime);
    }
  })
];
`;

  fs.writeFileSync(filePath, template, "utf-8");
}

/**
 * Search for existing Dockerfile in parent directories up to git root
 * @returns Absolute path to Dockerfile if found, null otherwise
 */
function findDockerfileInParents(startDir: string): string | null {
  let currentDir = startDir;

  while (true) {
    // Check for Dockerfile in current directory
    const dockerfilePath = path.join(currentDir, "Dockerfile");
    if (fs.existsSync(dockerfilePath)) {
      return dockerfilePath;
    }

    // Check for .git to stop at git root
    const gitPath = path.join(currentDir, ".git");
    if (fs.existsSync(gitPath)) {
      // Reached git root without finding Dockerfile
      return null;
    }

    // Move up one directory
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached filesystem root without finding Dockerfile
      return null;
    }
    currentDir = parentDir;
  }
}

/**
 * Scaffold a complete new project with all necessary files
 */
async function scaffoldProject(projectDir: string, projectName: string) {
  // Create main.ts
  const mainFile = path.join(projectDir, "main.ts");
  createScaffoldedWorkflow(mainFile);
  logger.success("Created main.ts");

  // Create package.json
  const packageJsonPath = path.join(projectDir, "package.json");
  createPackageJson(packageJsonPath, projectName);
  logger.success("Created package.json");

  // Check for existing Dockerfile in parent directories
  const existingDockerfile = findDockerfileInParents(path.dirname(projectDir));
  let shouldUseExisting = false;

  if (existingDockerfile) {
    const relativeDockerfilePath = path.relative(projectDir, existingDockerfile);
    logger.info(`Found Dockerfile at: ${relativeDockerfilePath}`);
    shouldUseExisting = await logger.confirm(
      "Would you like to use this existing Dockerfile?"
    );
  }

  if (shouldUseExisting && existingDockerfile) {
    // Calculate relative paths for build config
    const dockerfileDir = path.dirname(existingDockerfile);
    const relativeDockerfilePath = path.relative(projectDir, existingDockerfile);
    const relativeContextPath = path.relative(projectDir, dockerfileDir);

    // Update floww.yaml with build config
    const buildConfig: BuildConfig = {
      type: "docker",
      context: relativeContextPath,
      dockerfile: relativeDockerfilePath,
    };

    updateProjectConfig({ build: buildConfig }, projectDir);
    logger.success(
      `Configured to use existing Dockerfile at ${relativeDockerfilePath}`
    );
  } else {
    // Create new Dockerfile in project directory
    const dockerfilePath = path.join(projectDir, "Dockerfile");
    createDockerfile(dockerfilePath);
    logger.success("Created Dockerfile");
  }

  // Create .gitignore
  const gitignorePath = path.join(projectDir, ".gitignore");
  createGitignore(gitignorePath);
  logger.success("Created .gitignore");

  // Create .dockerignore
  const dockerignorePath = path.join(projectDir, ".dockerignore");
  createDockerignore(dockerignorePath);
  logger.success("Created .dockerignore");
}

/**
 * Create a simple cron workflow example (based on examples/1_cron)
 */
function createScaffoldedWorkflow(filePath: string) {
  const template = `import { Builtin } from "floww";

const builtin = new Builtin();

builtin.triggers.onCron({
  expression: "*/1 * * * * *", // Every second
  handler: (ctx, event) => {
    console.log("Hello from your workflow! 👋");
    console.log("Triggered at:", event.scheduledTime);
  },
});
`;

  fs.writeFileSync(filePath, template, "utf-8");
}

/**
 * Create package.json with Floww SDK and TypeScript dependencies
 */
function createPackageJson(filePath: string, projectName: string) {
  const packageJson = {
    name: projectName,
    version: "1.0.0",
    type: "module",
    scripts: {
      dev: "floww dev main.ts",
      deploy: "floww deploy",
    },
    dependencies: {
      floww: "*",
    },
    devDependencies: {
      "@types/node": "^22.0.0",
      typescript: "^5.7.3",
      tsx: "^4.19.2",
    },
  };

  fs.writeFileSync(
    filePath,
    JSON.stringify(packageJson, null, 2) + "\n",
    "utf-8"
  );
}

/**
 * Create Dockerfile for Lambda deployment with Floww runtime image
 */
function createDockerfile(filePath: string) {
  const dockerfile = `FROM ghcr.io/usefloww/lambda-runtime:latest

# Install project dependencies (including SDK)
COPY package-lock.json* pnpm-lock.yaml* ./
RUN npm install --omit=dev

# Set entrypoint from config
ENV FLOWW_ENTRYPOINT=main.ts

# No source code copying - code will be provided via Lambda event payload
# SDK must be listed in package.json dependencies
`;

  fs.writeFileSync(filePath, dockerfile, "utf-8");
}

/**
 * Create .gitignore file
 */
function createGitignore(filePath: string) {
  const gitignore = `# Dependencies
node_modules/

# Environment variables
.env
.env.local
.env.*.local

# Build outputs
dist/
build/
*.log

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Floww
.floww/
`;

  fs.writeFileSync(filePath, gitignore, "utf-8");
}

/**
 * Create .dockerignore file
 */
function createDockerignore(filePath: string) {
  const dockerignore = `node_modules
npm-debug.log
.git
.gitignore
.env
.env.local
dist
build
*.log
`;

  fs.writeFileSync(filePath, dockerignore, "utf-8");
}
