import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CommandSpace } from "./utils/CommandSpace";
import { waitUntil, waitUntilStdout } from "./utils/CommandTestHelpers";

const files = [
  {
    name: "main.ts",
    content: `import { Builtin } from "@developerflows/floww-sdk";

export const builtin = new Builtin();

export default [
  builtin.triggers.onCron({
    expression: "*/1 * * * * *",
    handler: (ctx, event) => {
      console.log("Cron triggered", event.scheduledTime);
    },
  }),
];
`,
  },
  {
    name: "package.json",
    content: `{
  "name": "test-project",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@developerflows/floww-sdk": "file:../../.."
  }
}
`,
  },
  {
    name: "floww.yaml",
    content: `workflowId: 12345678-1234-1234-1234-123456789abc
name: Test Workflow
version: 1.0.0
entrypoint: main.ts
`,
  },
];

describe("Dev Mode E2E Tests", () => {
  let commandSpace: CommandSpace;

  beforeEach(async () => {
    commandSpace = new CommandSpace(files);
    await commandSpace.initialize();
  });

  afterEach(async () => {
    await commandSpace.exit();
  });

  it("should start dev mode and show development message", async () => {
    const command = commandSpace.backgroundCommand("dev");

    await waitUntilStdout(command, "Development Mode");

    expect(command.stdout()).toContain("Development Mode");
  });

  it("should reload when file changes", async () => {
    const command = commandSpace.backgroundCommand("dev");

    // Wait for dev mode to fully start
    await waitUntilStdout(command, "Flow Engine running");

    // Change file
    await commandSpace.putFile({
      name: "main.ts",
      content: `import { Builtin } from "@developerflows/floww-sdk";

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

    await waitUntilStdout(command, "Reloading triggers", 5000);

    // Wait for the updated trigger to actually execute
    await waitUntilStdout(command, "UPDATED: Cron triggered", 8000);

    expect(command.stdout()).toContain("Reloading triggers");
    expect(command.stdout()).toContain("UPDATED: Cron triggered");
  });

  it("should trigger provider setup flow for missing providers", async () => {
    // Create files with a provider that doesn't exist
    const filesWithProvider = [
      {
        name: "main.ts",
        content: `import { getProvider, Builtin } from "@developerflows/floww-sdk";

const gitlab = getProvider("gitlab");
const builtin = new Builtin();

export default [
  builtin.triggers.onCron({
    expression: "*/1 * * * * *",
    handler: async (ctx, event) => {
      // Use the gitlab provider in the handler
      console.log("Using gitlab:", await gitlab);
    },
  }),
];
`,
      },
      ...files.slice(1), // Keep package.json and floww.yaml
    ];

    // Reset command space with new files
    await commandSpace.exit();
    commandSpace = new CommandSpace(filesWithProvider);
    await commandSpace.initialize();

    const command = commandSpace.backgroundCommand("dev");

    // Should detect the missing gitlab provider and show setup prompt
    await waitUntilStdout(command, "Provider Setup Required", 10000);
    await waitUntilStdout(command, "gitlab", 5000);

    expect(command.stdout()).toContain("Provider Setup Required");
    expect(command.stdout()).toContain("gitlab");
  });
});
