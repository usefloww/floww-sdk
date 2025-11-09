import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CommandSpace } from "../utils/CommandSpace";
import {
  waitUntilStderr,
  waitUntilStdout,
  waitForExit,
} from "../utils/CommandTestHelpers";
import fs from "fs";
import path from "path";

describe("Whoami Command Tests", () => {
  let commandSpace: CommandSpace;

  beforeEach(async () => {
    commandSpace = new CommandSpace([]);
    await commandSpace.initialize();
  });

  afterEach(async () => {
    await commandSpace.exit();
  });

  describe("Unauthenticated State", () => {
    it("should show not logged in message when user is not authenticated", async () => {
      const command = commandSpace.backgroundCommand("whoami", {
        env: { FLOWW_TOKEN: "" },
      });

      // Wait for the command to complete and show output
      await waitUntilStderr(command, "No authentication found", 3000);

      // Wait for process to exit and check exit code
      const exitCode = await waitForExit(command, 5000);
      expect(exitCode).toBe(1);
    });
  });

  describe("Authenticated State", () => {
    it("should show user info when authenticated", async () => {
      const command = commandSpace.backgroundCommand("whoami");

      // Wait for success message
      await waitUntilStdout(command, "User Information", 5000);

      const output = command.stdout();
      expect(output).toContain("service_account");

      // Wait for process to exit and check exit code
      const exitCode = await waitForExit(command, 5000);
      expect(exitCode).toBe(0);
    });
  });
});
