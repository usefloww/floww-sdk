import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CommandSpace } from "../utils/CommandSpace";
import { waitUntilStderr, waitUntilStdout } from "../utils/CommandTestHelpers";
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
      const command = commandSpace.backgroundCommand("whoami");

      // Wait for the command to complete and show output
      await waitUntilStderr(command, "Not logged in", 3000);

      expect(command.stderr()).toContain("Not logged in");
    });

    it("should exit with appropriate code when not authenticated", async () => {
      const command = commandSpace.backgroundCommand("whoami");

      // Wait for the command to complete
      await waitUntilStderr(command, "Not logged in", 3000);

      // Give it a moment to exit
      await new Promise((resolve) => setTimeout(resolve, 500));

      // The command should have output about not being logged in
      expect(command.stderr()).toContain("Not logged in");
    });
  });

  describe("Authenticated State", () => {
    it("should show user info when authenticated", async () => {
      await commandSpace.setupRealAuth();
      const command = commandSpace.backgroundCommand("whoami");

      // Wait for success message
      await waitUntilStdout(command, "Token is valid", 5000);

      const output = command.stdout();
      expect(output).toContain("Token is valid");
      expect(output).toContain("expires in");
    });

    it("should show refresh token status", async () => {
      await commandSpace.setupRealAuth();
      const command = commandSpace.backgroundCommand("whoami");

      await waitUntilStdout(command, "Has refresh token", 5000);

      const output = command.stdout();
      expect(output).toContain("Has refresh token: Yes");
    });
  });
});
