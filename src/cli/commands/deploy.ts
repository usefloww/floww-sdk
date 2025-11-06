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
import { resolveWorkflow, fetchProviderConfigs } from "../runtime/workflow";
import { executeUserCode } from "../runtime/userCode";
import { validateProviders } from "../runtime/providers";

const defaultDockerfileContent = `
FROM base-floww

# Install project dependencies (including SDK)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Set entrypoint from config
ENV FLOWW_ENTRYPOINT=main.ts

# No source code copying - code will be provided via Lambda event payload
# SDK must be listed in package.json dependencies
`;

function ensureDockerfile(projectDir: string, projectConfig: any): string {
  const dockerfilePath = path.join(projectDir, "Dockerfile");

  if (!fs.existsSync(dockerfilePath)) {
    logger.debugInfo("No Dockerfile found, creating default...");
    const entrypoint = projectConfig.entrypoint || "main.ts";
    const dockerfileContent = defaultDockerfileContent.replace(
      "ENV FLOWW_ENTRYPOINT=main.ts",
      `ENV FLOWW_ENTRYPOINT=${entrypoint}`
    );
    fs.writeFileSync(dockerfilePath, dockerfileContent.trim());
    logger.debugInfo("Created default Dockerfile");
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
    logger.debugInfo(`Auto-selected workflow: ${selectedWorkflow.name}`);
    logger.tip('Run "floww init" to set a default workflow for this project');
    return selectedWorkflow.id;
  }
}

function convertTriggersToMetadata(triggers: any[]): any[] {
  if (!Array.isArray(triggers)) {
    logger.warn("Triggers is not an array, returning empty metadata");
    return [];
  }

  return triggers.map((trigger: any) => {
    const metadata: any = { type: trigger.type };

    // Add provider metadata if available (for provider-managed triggers)
    if (trigger._providerMeta) {
      metadata.provider_type = trigger._providerMeta.type;
      metadata.provider_alias = trigger._providerMeta.alias;
      metadata.trigger_type = trigger._providerMeta.triggerType;
      metadata.input = trigger._providerMeta.input;
    }

    if (trigger.type === "webhook") {
      // Only include path if explicitly set by user
      // Provider webhooks (without path) will get auto-generated UUID paths
      if (trigger.path) {
        metadata.path = trigger.path;
      }
      metadata.method = trigger.method || "POST";
    } else if (trigger.type === "cron") {
      metadata.expression = trigger.expression;
    } else if (trigger.type === "realtime") {
      metadata.channel = trigger.channel;
    }

    return metadata;
  });
}

/**
 * Deploy Command - Build and deploy workflow to production
 *
 * Flow:
 *
 * Prerequisites:
 * 1. Auto-initialize project if needed (floww.yaml)
 * 2. Resolve workflow from config (verify it exists)
 *
 * Checks:
 * 3. Execute user code to extract triggers and providers
 * 4. Validate all providers are configured (fail if not)
 *
 * Deploy:
 * 5. Build and push runtime Docker image
 * 6. Create runtime environment in backend
 * 7. Deploy code and trigger metadata
 */
export async function deployCommand() {
  const projectDir = process.cwd();

  // ============================================================================
  // PREREQUISITES: Initialize project and resolve workflow
  // ============================================================================

  // Auto-initialize if no config exists
  if (!hasProjectConfig()) {
    console.log("🔧 Setting up project configuration...");

    try {
      await initCommand({ silent: false });
      console.log("✅ Project configured, continuing with deployment");
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
    console.log("🎯 Selecting deployment workflow...");

    try {
      const selectedWorkflowId = await selectWorkflow();

      // Update floww.yaml with selected workflow
      projectConfig = updateProjectConfig({ workflowId: selectedWorkflowId });
      logger.debugInfo("Workflow saved to floww.yaml");
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

  // ============================================================================
  // CHECKS: Execute user code and validate providers
  // ============================================================================

  const entrypoint = projectConfig.entrypoint || "main.ts";

  // Resolve workflow first so we can use namespaceId later
  const workflowConfig = await logger.debugTask(
    "Resolving workflow",
    async () => await resolveWorkflow(projectConfig)
  );

  // Execute user code once to get both triggers and providers
  const executionResult = await logger.debugTask(
    "Executing user code",
    async () => {
      // Fetch provider configs
      const providerConfigs = await fetchProviderConfigs(
        workflowConfig.namespaceId
      );

      // Execute user code to get triggers and provider usage
      return await executeUserCode(entrypoint, providerConfigs);
    }
  );

  // Validate all providers are configured
  if (executionResult.usedProviders.length > 0) {
    await logger.debugTask("Validating providers", async () => {
      await validateProviders(executionResult.usedProviders, {
        interactive: logger.interactive,
        namespaceId: workflowConfig.namespaceId,
      });
    });
  }

  // ============================================================================
  // DEPLOY: Build runtime and deploy code
  // ============================================================================

  console.log("🚀 Starting deployment...");

  // 3. Ensure Dockerfile exists
  ensureDockerfile(projectDir, projectConfig);

  // 3.5. Pre-build SDK if in monorepo (for faster Docker builds)
  const isInSdkExamples = projectDir.includes("/examples/");
  if (isInSdkExamples) {
    await logger.debugTask("Pre-building SDK", async () => {
      const { execSync } = await import("child_process");
      const sdkDir = `${projectDir}/../..`;

      // Install and build SDK, remove self-referential link, and pack
      execSync(
        `
        pnpm install &&
        pnpm build &&
        node -e "const fs=require('fs'); const pkg=JSON.parse(fs.readFileSync('package.json','utf8')); delete pkg.dependencies['@DeveloperFlows/floww-sdk']; delete pkg.dependencies['floww']; fs.writeFileSync('package.json',JSON.stringify(pkg,null,2));" &&
        pnpm pack --pack-destination ./ &&
        git checkout package.json
      `,
        {
          cwd: sdkDir,
          stdio: logger.interactive ? "pipe" : "inherit",
          shell: "/bin/bash",
        }
      );
    });
  }

  // 4. Build Docker image
  const buildResult = await logger.task(
    "📦 Building runtime image",
    async () => {
      return await dockerBuildImage(projectConfig, projectDir);
    }
  );

  const imageHash = await dockerGetImageHash({
    localImage: buildResult.localImage,
  });

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
    await logger.task(
      "☁️  Uploading runtime image (this may take a moment)",
      async () => {
        const imageUri = `${pushData.registry_url}:${imageHash}`;
        await dockerRetagImage({
          currentTag: buildResult.localImage,
          newTag: imageUri,
        });
        await dockerLogin({
          registryUrl: pushData.registry_url,
          token: pushData.password,
        });
        await dockerPushImage({ imageUri: imageUri });
      }
    );
  } else {
    logger.debugInfo("Runtime image already exists, skipping upload");
  }

  // 6. Create and prepare runtime
  const runtimeResult = await logger.task(
    "⚙️  Setting up runtime environment",
    async () => {
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
    }
  );

  // 7. Read project files
  const userCode = await readProjectFiles(projectDir, entrypoint);

  // Convert triggers to metadata format for API
  const triggersMetadata = convertTriggersToMetadata(executionResult.triggers);

  // 8. Create workflow deployment with triggers metadata
  try {
    const deployment = await logger.task("🚀 Deploying workflow", async () => {
      return await createWorkflowDeployment({
        workflow_id: projectConfig.workflowId!,
        runtime_id: runtimeResult.id,
        code: userCode,
        triggers: triggersMetadata,
      });
    });

    console.log("\n✨ Deployment successful!");

    // Display webhook URLs if available
    if (deployment.webhooks && deployment.webhooks.length > 0) {
      console.log("\n📌 Webhook URLs:");
      for (const webhook of deployment.webhooks) {
        const pathInfo = webhook.path
          ? ` ${webhook.method || "POST"} ${webhook.path}`
          : "";
        console.log(`  ${pathInfo}`);
        console.log(`     → ${webhook.url}`);
      }
    }
  } catch (error: any) {
    // Check if this is a trigger failure error
    if (error.failedTriggers && Array.isArray(error.failedTriggers)) {
      console.log("\n❌ Deployment failed: Trigger creation errors");
      console.log("\n⚠️  Failed Triggers:");
      for (const trigger of error.failedTriggers) {
        const triggerName = `${trigger.provider_type}/${trigger.trigger_type}`;
        const errorMsg = trigger.error || "Unknown error";
        // Clean up error message - remove the "For more information" link if present
        const cleanError = errorMsg.split("\nFor more information")[0].trim();
        console.log(`  ✗ ${triggerName}: ${cleanError}`);
      }
      process.exit(1);
    }
    
    // Re-throw other errors
    throw error;
  }
}
