import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CommandSpace } from "../utils/CommandSpace";
import {
  simpleExampleFiles,
  waitUntil,
  waitUntilStdout,
} from "../utils/CommandTestHelpers";
import fs from "fs";
import path from "path";

describe("Dev Mode E2E Tests", () => {
  let commandSpace: CommandSpace;

  beforeEach(async () => {
    commandSpace = new CommandSpace(simpleExampleFiles);
    await commandSpace.initialize();
  });

  afterEach(async () => {
    await commandSpace.exit();
  });

  it("should start dev mode and show development message", async () => {
    const command = commandSpace.backgroundCommand("dev");

    await waitUntilStdout(command, "Watching:");

    expect(command.stdout()).toContain("Watching:");
  });

  it("should load triggers", async () => {
    const command = commandSpace.backgroundCommand("dev");
    await waitUntilStdout(command, "Watching:");
    await waitUntilStdout(command, "Event routing started with 1 trigger(s)");
  });

  it.todo("should reload when file changes", async () => {
    const command = commandSpace.backgroundCommand("dev");

    // Wait for dev mode to fully start
    await waitUntilStdout(command, "Watching:");
    await waitUntilStdout(command, "Event routing started with 1 trigger(s)");

    // Change file
    await commandSpace.putFile({
      name: "main.ts",
      content: `import { Builtin } from "floww";

export const builtin = new Builtin();

export default [
  builtin.triggers.onCron({
    expression: "*/2 * * * * *",
    handler: (ctx, event) => {
      console.log("UPDATED: Cron triggered", event.scheduledTime);
    },
  }),
];
`,
    });

    await waitUntilStdout(command, "File changed", 5000);

    // Wait for the updated trigger to actually execute
    await waitUntilStdout(command, "UPDATED: Cron triggered", 8000);

    expect(command.stdout()).toContain("File changed");
    expect(command.stdout()).toContain("UPDATED: Cron triggered");
  });

  it.todo(
    "should trigger provider setup flow for missing providers",
    async () => {
      // Create files with a provider that doesn't exist in our mocks
      // Using "github" which is not in mockProviders (slack and gitlab are)
      const filesWithProvider = [
        {
          name: "main.ts",
          content: `import { getProvider, Builtin } from "floww";

const github = getProvider("github");
const builtin = new Builtin();

export default [
  builtin.triggers.onCron({
    expression: "*/1 * * * * *",
    handler: async (ctx, event) => {
      // Use the github provider in the handler
      console.log("Using github:", await github);
    },
  }),
];
`,
        },
        ...files.slice(1), // Keep package.json and floww.yaml
      ];

      // Reset command space with new files and re-setup auth
      await commandSpace.exit();
      commandSpace = new CommandSpace(filesWithProvider);
      await commandSpace.initialize();

      // Recreate auth tokens in the new temp directory
      const configDir = path.join(commandSpace.tempDir, ".config", "floww");
      const authFile = path.join(configDir, "auth.json");
      fs.mkdirSync(configDir, { recursive: true });
      const mockAuth = {
        accessToken: "mock-access-token-123",
        refreshToken: "mock-refresh-token-456",
        expiresAt: Date.now() + 3600000,
        user: {
          id: "test-user-123",
          email: "test@example.com",
          firstName: "Test",
          lastName: "User",
        },
      };
      fs.writeFileSync(authFile, JSON.stringify(mockAuth, null, 2));
      fs.chmodSync(authFile, 0o600);

      const command = commandSpace.backgroundCommand("dev");

      // Should detect the missing github provider and show setup prompt
      await waitUntilStdout(command, "Provider Setup Required", 10000);
      await waitUntilStdout(command, "github", 5000);

      expect(command.stdout()).toContain("Provider Setup Required");
      expect(command.stdout()).toContain("github");
    }
  );
});
