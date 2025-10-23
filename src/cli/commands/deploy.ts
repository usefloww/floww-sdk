import fs from "fs";
import path from "path";
import {
  loadProjectConfig,
  hasProjectConfig,
  updateProjectConfig,
} from "../config/projectConfig";
import {
  ImageAlreadyExistsError,
  createRuntime,
  getRuntimeStatus,
  createWorkflowDeployment,
  readProjectFiles,
  fetchWorkflows,
  fetchWorkflow,
  getPushData,
  PushTokenResponse,
  RuntimeAlreadyExistsError,
} from "../api/apiMethods";
import { initCommand } from "./init";
import {
  dockerBuildImage,
  dockerRetagImage,
  dockerLogin,
  dockerPushImage,
  dockerGetImageHash,
} from "../utils/dockerUtils";
import { logger, ICONS } from "../utils/logger";
import { selectOrCreateWorkflow } from "../utils/promptUtils";
import { validateProvidersAvailable } from "../providers/index";

const defaultDockerfileContent = `
FROM base-floww

# ---- deps only ----
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Set entrypoint from config (will be overridden by environment variable in Lambda)
ENV FLOWW_ENTRYPOINT=main.ts

# No source code copying - code will be provided via Lambda event payload
# Uses the universal handler from base-floww image
`;

function ensureDockerfile(projectDir: string, projectConfig: any): string {
  const dockerfilePath = path.join(projectDir, "Dockerfile");

  if (!fs.existsSync(dockerfilePath)) {
    logger.info("No Dockerfile found, creating default...");
    const entrypoint = projectConfig.entrypoint || "main.ts";
    const dockerfileContent = defaultDockerfileContent.replace(
      "ENV FLOWW_ENTRYPOINT=main.ts",
      `ENV FLOWW_ENTRYPOINT=${entrypoint}`
    );
    fs.writeFileSync(dockerfilePath, dockerfileContent.trim());
    logger.success("Created default Dockerfile");
  }

  return dockerfilePath;
}

async function pollRuntimeUntilReady(runtimeId: string): Promise<void> {
  while (true) {
    try {
      const status = await getRuntimeStatus(runtimeId);

      // Check final status
      if (status.creation_status === "completed") {
        return;
      } else if (status.creation_status === "failed") {
        throw new Error("Runtime creation failed");
      }

      // Wait 5 seconds before next poll
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } catch (error) {
      throw error;
    }
  }
}

async function selectWorkflow(): Promise<string> {
  const workflows = await fetchWorkflows();

  if (workflows.length === 0) {
    logger.error(
      "No workflows found. Create one first in the Floww dashboard."
    );
    process.exit(1);
  }

  // Use interactive selection with clack in interactive mode
  if (logger.interactive) {
    const options = workflows.map((workflow) => ({
      value: workflow.id,
      label: workflow.name,
      hint: workflow.namespace_name
        ? `${workflow.namespace_name}${
            workflow.description ? ` - ${workflow.description}` : ""
          }`
        : workflow.description,
    }));

    const selectedId = await logger.select(
      "Select a workflow to deploy to:",
      options
    );
    const selectedWorkflow = workflows.find((w) => w.id === selectedId)!;
    logger.success(`Selected: ${selectedWorkflow.name}`);
    return selectedId;
  } else {
    // Non-interactive mode: return first workflow
    const selectedWorkflow = workflows[0];
    logger.info(`Auto-selected workflow: ${selectedWorkflow.name}`);
    logger.tip('Run "floww init" to set a default workflow for this project');
    return selectedWorkflow.id;
  }
}

/**
 * Deploy the triggers to the server
 *
 * - Check workflow id to deploy to (read from floww.yaml)
 *    - if not provided, ask user to select a workflow from list or create new one
 *    - if provided, check if workflow exists
 *
 * - Update the runtime if needed
 *    - build the runtime docker image (build with default if Dockerfile is not provided)
 *    - get token to push to docker registry
 *    - push the runtime docker image to the docker registry
 *    - create new runtime in backend
 *
 * - Update the triggers
 *    - post request to backend to update code
 */
export async function deployCommand() {
  const projectDir = process.cwd();

  // Auto-initialize if no config exists
  if (!hasProjectConfig()) {
    logger.info(
      "No project configuration found. Let's set up your project first!"
    );

    try {
      await initCommand({ silent: false });
      logger.info("Continuing with deployment...");
    } catch (error) {
      logger.error(
        "Initialization failed:",
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  }

  // Load project config
  let projectConfig = loadProjectConfig();

  // Handle workflow selection if workflowId is missing (fallback)
  if (!projectConfig.workflowId) {
    logger.info("No workflowId specified, selecting workflow...");

    try {
      const selectedWorkflowId = await selectWorkflow();

      // Update floww.yaml with selected workflow
      projectConfig = updateProjectConfig({ workflowId: selectedWorkflowId });
      logger.success("Workflow saved to floww.yaml");
    } catch (error) {
      logger.error(
        "Workflow selection failed:",
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  }

  // 1. Verify workflow exists
  let workflow;
  try {
    workflow = await fetchWorkflow(projectConfig.workflowId!);
  } catch (error) {
    // Check if it's a 404 (workflow not found) and we're in interactive mode
    const is404 = error instanceof Error && error.message.includes("404");

    if (is404 && logger.interactive) {
      logger.warn(`Workflow not found. Let's select or create a workflow.`);

      try {
        const { workflowId, workflow: selectedWorkflow } =
          await selectOrCreateWorkflow({
            suggestedName: projectConfig.name,
            allowCreate: true,
          });

        // Update project config with the selected workflow
        projectConfig = updateProjectConfig({ workflowId });
        workflow = selectedWorkflow;
      } catch (selectionError) {
        logger.error(
          "Failed to select workflow:",
          selectionError instanceof Error
            ? selectionError.message
            : selectionError
        );
        process.exit(1);
      }
    } else {
      logger.error(
        "Workflow not found or inaccessible:",
        error instanceof Error ? error.message : error
      );
      logger.tip('Run "floww init" to select a different workflow');
      process.exit(1);
    }
  }

  // 2. Validate providers are configured (non-interactive check for deploy)
  const entrypoint = projectConfig.entrypoint || "main.ts";
  const providerValidation = await logger.task("Validating providers", async () => {
    return validateProvidersAvailable(entrypoint, 'triggers');
  });

  if (!providerValidation.valid) {
    logger.error("Missing providers detected:", providerValidation.missing);
    logger.tip('Run "floww dev" to set up missing providers interactively');
    process.exit(1);
  }

  // 3. Ensure Dockerfile exists
  ensureDockerfile(projectDir, projectConfig);

  // 4. Build Docker image
  const buildResult = await logger.task("Building Docker image", async () => {
    return dockerBuildImage(projectConfig, projectDir);
  });

  const imageHash = dockerGetImageHash({ localImage: buildResult.localImage });

  let shouldPush = true;
  let pushData: PushTokenResponse = {} as any;

  try {
    pushData = await getPushData(imageHash);
  } catch (error) {
    if (error instanceof ImageAlreadyExistsError) {
      shouldPush = false;
    } else {
      logger.error(
        "Failed to get push data:",
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  }

  // 5. Push images to registry (only if needed)
  if (shouldPush) {
    await logger.task("Pushing image", async () => {
      const imageUri = `${pushData.registry_url}:${imageHash}`;
      dockerRetagImage({
        currentTag: buildResult.localImage,
        newTag: imageUri,
      });
      dockerLogin({
        registryUrl: pushData.registry_url,
        token: pushData.password,
      });
      dockerPushImage({ imageUri: imageUri });
    });
  }

  // 6. Create and prepare runtime
  const runtimeResult = await logger.task("Setting up runtime", async () => {
    try {
      const runtime = await createRuntime({
        config: {
          image_hash: imageHash,
        },
      });
      await pollRuntimeUntilReady(runtime.id);
      return runtime;
    } catch (error) {
      if (error instanceof RuntimeAlreadyExistsError) {
        // Fetch the existing runtime status and wait for it to be ready
        const runtime = await getRuntimeStatus(error.runtimeId);
        await pollRuntimeUntilReady(runtime.id);
        return runtime;
      } else {
        logger.error(
          "Failed to create runtime:",
          error instanceof Error ? error.message : error
        );
        process.exit(1);
      }
    }
  });

  // 7. Read project files and create workflow deployment
  const userCode = await readProjectFiles(projectDir, entrypoint);

  await logger.task("Deploying workflow", async () => {
    return "Deployed workflow";
    await createWorkflowDeployment({
      workflow_id: projectConfig.workflowId!,
      runtime_id: runtimeResult.id,
      code: userCode,
    });
  });
}
