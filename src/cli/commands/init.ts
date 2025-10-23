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

  // Check if config already exists
  if (hasProjectConfig() && !options.force) {
    if (!options.silent) {
      logger.error("floww.yaml already exists in this directory.");
      logger.plain.error(
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
    initProjectConfig(config, process.cwd(), options.force);

    if (!options.silent) {
      logger.success("Created floww.yaml");
      logger.plain(`   Workflow: ${name}`);
      logger.plain(`   Workflow ID: ${workflowId}`);
    }

    // Create example workflow file if it doesn't exist
    const exampleFile = path.join(process.cwd(), "main.ts");
    if (!fs.existsSync(exampleFile) && !options.silent) {
      const shouldCreateExample = await logger.confirm(
        "Create example main.ts file?"
      );
      if (shouldCreateExample) {
        createExampleWorkflow(exampleFile);
        logger.success("Created main.ts");
      }
    }

    if (!options.silent) {
      logger.success("Project initialized successfully!");
      logger.plain("\nNext steps:");
      logger.plain("  1. Edit your workflow in main.ts");
      logger.plain("  2. Run: floww dev main.ts");
      logger.plain("  3. Deploy: floww deploy");
      logger.plain("  4. Start building! 🚀\n");
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
  const template = `import { Builtin } from '@DeveloperFlows/floww-sdk';

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
