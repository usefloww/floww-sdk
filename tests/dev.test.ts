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
});
