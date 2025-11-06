import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CommandSpace } from "../utils/CommandSpace";
import { waitUntilStdout } from "../utils/CommandTestHelpers";

describe("Deploy Command Tests", () => {
  let commandSpace: CommandSpace;

  beforeEach(async () => {
    commandSpace = new CommandSpace();
    await commandSpace.initialize();
    await commandSpace.setupRealAuth();
  });

  afterEach(async () => {
    await commandSpace.exit();
  });

  it("should deploy a workflow to production", async () => {
    const command = commandSpace.backgroundCommand("deploy", { tty: true });
    await waitUntilStdout(command, "Deploying workflow...");
  });

  it.todo("should handle deployment failures gracefully");
  it.todo("should show deployment status");
});
