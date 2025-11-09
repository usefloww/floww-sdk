import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CommandSpace } from "../utils/CommandSpace";
import {
  randomExampleFiles,
  waitUntilProgress,
  waitUntilStdout,
} from "../utils/CommandTestHelpers";

describe("Deploy Command Tests", () => {
  let commandSpace: CommandSpace;

  beforeEach(async () => {
    commandSpace = new CommandSpace(randomExampleFiles());
    await commandSpace.initialize();
    await commandSpace.setupRealAuth();
  });

  afterEach(async () => {
    await commandSpace.exit();
  });

  it("full build and deploy test", async () => {
    // deploy without existing runtime
    let command = commandSpace.backgroundCommand("deploy", { tty: true });
    await waitUntilStdout(command, "Starting deployment", 5000);
    await waitUntilStdout(command, "Building runtime image", 5000);

    await waitUntilProgress(command, "Building runtime image", 3000, 30);
    await waitUntilStdout(command, "✅ 📦 Building runtime image", 100);

    await waitUntilProgress(
      command,
      "Uploading runtime image (this may take a moment)",
      1000,
      60
    );
    await waitUntilStdout(command, "✅ ☁️  Uploading runtime image", 100);
    await waitUntilStdout(command, "Deploying workflow", 3000);
    await waitUntilStdout(command, "Deployment successful!", 1000);

    // deploy with existing runtime
    command = commandSpace.backgroundCommand("deploy", { tty: true });
    await waitUntilStdout(command, "Starting deployment", 5000);
    await waitUntilStdout(command, "Building runtime image", 5000);
    await waitUntilStdout(command, "Setting up runtime environment", 5000);
    await waitUntilStdout(command, "Deploying workflow", 5000);
    await waitUntilStdout(command, "Deployment successful!", 5000);
  });

  it.todo("should handle deployment failures gracefully");
  it.todo("should show deployment status");
});
