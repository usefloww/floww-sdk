import { execSync } from "child_process";
import { logger, ICONS } from "./logger";

export interface DockerBuildResult {
  localImage: string;
}

export function dockerRetagImage(args: { currentTag: string; newTag: string }) {
  execSync(`docker tag "${args.currentTag}" "${args.newTag}"`);
}

export function dockerBuildImage(
  projectConfig: any,
  projectDir: string
): DockerBuildResult {
  const workloadId = projectConfig.workflowId || "unknown";
  const localImage = `floww:${workloadId}`;

  try {
    // Build the image for x86_64 (Lambda architecture)
    // Check if we're in SDK examples (monorepo) - use parent context to access SDK source
    const isInSdkExamples = projectDir.includes('/sdk/examples/');

    let buildCmd: string;
    let buildCwd: string;

    if (isInSdkExamples) {
      // In monorepo: use SDK root as context
      buildCmd = `docker build --platform=linux/amd64 --provenance=false -f "${projectDir}/Dockerfile" -t "${localImage}" .`;
      buildCwd = `${projectDir}/../..`;
    } else {
      // External project: use project directory as context
      buildCmd = `docker build --platform=linux/amd64 --provenance=false -t "${localImage}" .`;
      buildCwd = projectDir;
    }

    execSync(buildCmd, {
      cwd: buildCwd,
      stdio: logger.interactive ? "pipe" : "inherit", // Hide output in interactive mode
    });

    return {
      localImage,
    };
  } catch (error) {
    logger.error("Docker build failed:", error);
    process.exit(1);
  }
}

export function dockerLogin(args: { registryUrl: string; token: string }) {
  logger.info(`Logging in to registry: ${args.registryUrl}`);
  try {
    execSync(
      `echo "${args.token}" | docker login ${args.registryUrl} -u token --password-stdin`,
      {
        stdio: ["pipe", logger.interactive ? "pipe" : "inherit", "inherit"],
      }
    );
  } catch (error) {
    logger.error("Docker registry login failed:", error);
    process.exit(1);
  }
}

export function dockerPushImage(args: { imageUri: string }): void {
  try {
    logger.info(`Pushing image: ${args.imageUri}`);

    // Push both tags
    execSync(`docker push "${args.imageUri}"`, {
      stdio: logger.interactive ? "pipe" : "inherit",
    });

    logger.success("Image pushed successfully!");
  } catch (error) {
    logger.error("Docker push failed:", error);
    process.exit(1);
  }
}

export function dockerGetImageHash(args: { localImage: string }): string {
  let result = execSync(
    `docker image inspect --format='{{.RootFS.Layers}}' ${args.localImage} | sha256sum`,
    {
      encoding: "utf-8",
    }
  );
  result = result.replaceAll("-", "");
  result = result.trim();

  return result;
}
