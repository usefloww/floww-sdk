import { execa } from "execa";
import { logger, ICONS } from "./logger";

export interface DockerBuildResult {
  localImage: string;
}

export async function dockerRetagImage(args: {
  currentTag: string;
  newTag: string;
}) {
  await execa("docker", ["tag", args.currentTag, args.newTag]);
}

export async function dockerBuildImage(
  projectConfig: any,
  projectDir: string,
): Promise<DockerBuildResult> {
  const workloadId = projectConfig.workflowId || "unknown";
  const localImage = `floww:${workloadId}`;

  try {
    // Build the image for x86_64 (Lambda architecture)
    // Check if we're in SDK examples (monorepo) - use parent context to access SDK source
    const isInSdkExamples = projectDir.includes("/examples/");

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

    // Run Docker build asynchronously and stream output
    const subprocess = execa(buildCmd, {
      cwd: buildCwd,
      shell: true,
      all: true,
    });

    for await (const chunk of subprocess.all!) {
      const line = chunk.toString();
      // optionally print debug info
      if (logger.debug) logger.debugInfo(line.trim());
      await new Promise((r) => setTimeout(r, 0)); // yield to event loop
    }

    await subprocess; // wait for process to finish

    return {
      localImage,
    };
  } catch (error) {
    logger.error("Docker build failed:", error);
    process.exit(1);
  }
}

export async function dockerLogin(args: {
  registryUrl: string;
  token: string;
}) {
  logger.debugInfo(`Logging in to registry: ${args.registryUrl}`);
  try {
    await execa(
      "bash",
      [
        "-c",
        `echo "${args.token}" | docker login ${args.registryUrl} -u token --password-stdin`,
      ],
      {
        all: true,
      },
    );
  } catch (error) {
    logger.error("Docker registry login failed:", error);
    process.exit(1);
  }
}

export async function dockerPushImage(args: {
  imageUri: string;
}): Promise<void> {
  try {
    logger.debugInfo(`Pushing image: ${args.imageUri}`);

    // Push both tags
    const subprocess = execa("docker", ["push", args.imageUri], {
      all: true,
    });

    for await (const chunk of subprocess.all!) {
      const line = chunk.toString();
      if (logger.debug) logger.debugInfo(line.trim());
      await new Promise((r) => setTimeout(r, 0));
    }

    await subprocess;

    logger.debugInfo("Image pushed successfully!");
  } catch (error) {
    logger.error("Docker push failed:", error);
    process.exit(1);
  }
}

export async function dockerGetImageHash(args: {
  localImage: string;
}): Promise<string> {
  const { stdout } = await execa("bash", [
    "-c",
    `docker image inspect --format='{{.RootFS.Layers}}' ${args.localImage} | sha256sum`,
  ]);
  let result = stdout;
  result = result.replaceAll("-", "");
  result = result.trim();

  return result;
}
