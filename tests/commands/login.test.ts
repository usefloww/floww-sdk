import { describe, it, beforeEach, afterEach } from "vitest";
import { CommandSpace } from "../utils/CommandSpace";
import { waitUntilStdout } from "../utils/CommandTestHelpers";

describe("Dev Mode E2E Tests", () => {
  let commandSpace: CommandSpace;

  beforeEach(async () => {
    commandSpace = new CommandSpace();
    await commandSpace.initialize();
  });

  afterEach(async () => {
    await commandSpace.exit();
  });

  it("should present login flow", async () => {
    const command = commandSpace.backgroundCommand("login");
    await waitUntilStdout(command, "Requesting device authorization");
  });
});
