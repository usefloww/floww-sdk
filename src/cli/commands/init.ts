import fs from "fs";
import path from "path";
import {
  initProjectConfig,
  hasProjectConfig,
  getProjectConfigPath,
} from "../config/projectConfig";
import { fetchNamespaces } from "../api/apiMethods";
import { logger } from "../utils/logger";
import { selectOrCreateWorkflow } from "../utils/promptUtils";

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
    initMode = await logger.select(
      "How would you like to initialize?",
      [
        {
          value: "current" as const,
          label: "Initialize in current directory",
          hint: "Add floww.yaml to existing project",
        },
        {
          value: "new" as const,
          label: "Create new scaffolded project",
          hint: "Generate complete project structure",
        },
      ],
    );

    // If creating new project, ask for directory name
    if (initMode === "new") {
      const dirName = await logger.text(
        "Project directory name:",
        "my-floww-project",
      );
      if (!dirName) {
        logger.error("Directory name is required");
        return null;
      }
      if (!/^[a-zA-Z0-9\-_]+$/.test(dirName)) {
        logger.error(
          "Directory name can only contain letters, numbers, hyphens, and underscores",
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

    // Select or create workflow using shared utility
    const { workflowId } = await selectOrCreateWorkflow({
      suggestedName: name,
      allowCreate: true,
    });

    // Create config
    const config = {
      workflowId,
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
      logger.plain(`   Workflow ID: ${workflowId}`);
    }

    if (initMode === "new" && !options.silent) {
      await scaffoldProject(projectDir, name);
    } else {
      const exampleFile = path.join(projectDir, "main.ts");
      if (!fs.existsSync(exampleFile) && !options.silent) {
        const shouldCreateExample = await logger.confirm(
          "Create example main.ts file?",
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
        logger.plain("  - .gitignore");
        logger.plain("\nNext steps:");
        logger.plain(`  1. cd ${dirName}`);
        logger.plain("  2. npm install");
        logger.plain("  3. Edit your workflow in main.ts");
        logger.plain("  4. Run: floww dev main.ts");
        logger.plain("  5. Deploy: floww deploy");
        logger.plain("  6. Start building! 🚀\n");
      } else {
        logger.plain("\nNext steps:");
        logger.plain("  1. Edit your workflow in main.ts");
        logger.plain("  2. Run: floww dev main.ts");
        logger.plain("  3. Deploy: floww deploy");
        logger.plain("  4. Start building! 🚀\n");
      }
    }

    return workflowId;
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

  // Create Dockerfile
  const dockerfilePath = path.join(projectDir, "Dockerfile");
  createDockerfile(dockerfilePath);
  logger.success("Created Dockerfile");

  // Create .gitignore
  const gitignorePath = path.join(projectDir, ".gitignore");
  createGitignore(gitignorePath);
  logger.success("Created .gitignore");
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
      "floww": "*",
    },
    devDependencies: {
      "@types/node": "^22.0.0",
      typescript: "^5.7.3",
      tsx: "^4.19.2",
    },
  };

  fs.writeFileSync(filePath, JSON.stringify(packageJson, null, 2) + "\n", "utf-8");
}

/**
 * Create optimized Dockerfile for Node.js with minimal image size
 */
function createDockerfile(filePath: string) {
  const dockerfile = `# Use official Node.js slim image for minimal size
FROM node:20-slim AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* pnpm-lock.yaml* ./

# Install dependencies (production only)
RUN npm ci --only=production || npm install --only=production

# Final stage
FROM node:20-slim

# Set working directory
WORKDIR /var/task

# Copy dependencies from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY . .

# Set environment variable for entrypoint
ENV FLOWW_ENTRYPOINT=main.ts

# Clean up to reduce image size
RUN rm -rf /root/.npm && \\
    rm -rf /tmp/* && \\
    apt-get clean && \\
    rm -rf /var/lib/apt/lists/*

# Run the workflow
CMD ["node", "main.ts"]
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
