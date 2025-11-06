import { describe, it, beforeEach, afterEach } from "vitest";
import { CommandSpace } from "../utils/CommandSpace";
import {
  selectOption,
  wait,
  waitUntilStdout,
} from "../utils/CommandTestHelpers";

describe("Init Command Tests", () => {
  let commandSpace: CommandSpace;

  beforeEach(async () => {
    commandSpace = new CommandSpace();
    await commandSpace.initialize();
    await commandSpace.setupRealAuth();
  });

  afterEach(async () => {
    await commandSpace.exit();
  });

  it("current directory", async () => {
    const command = commandSpace.backgroundCommand("init", { tty: true });
    await waitUntilStdout(command, "Initializing new Floww project");
    await waitUntilStdout(command, "How would you like to initialize?");

    await wait(100);
    command.writeEnter(); // select "Initialize in current directory"

    await waitUntilStdout(command, "Workflow name:");
    command.write("my-workflow");
    command.writeEnter(); // select "my-workflow"

    await waitUntilStdout(command, "Select a namespace:");
    command.writeEnter(); // Select first one

    await waitUntilStdout(command, "Choose workflow option");
    command.writeEnter(); // Select first one

    await waitUntilStdout(command, "Created floww.yaml");
    await waitUntilStdout(command, "Create example main.ts file?");
    command.writeEnter(); // Select "Yes"
  });

  it("new directory", async () => {
    const command = commandSpace.backgroundCommand("init", { tty: true });
    await waitUntilStdout(command, "Initializing new Floww project");
    await waitUntilStdout(command, "How would you like to initialize?");

    await wait(100);
    command.writeArrowDown();
    command.writeEnter(); // select "Create new scaffolded project"
  });
});
