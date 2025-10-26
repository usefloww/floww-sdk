import { spawn, ChildProcess } from "child_process";
import { promises as fs } from "fs";
import path from "path";

export interface File {
  name: string;
  content: string;
}

class BackgroundCommand {
  private process: ChildProcess;
  private stdoutData = "";
  private stderrData = "";

  constructor(process: ChildProcess) {
    this.process = process;

    process.stdout?.on("data", (data) => {
      this.stdoutData += data.toString();
    });

    process.stderr?.on("data", (data) => {
      this.stderrData += data.toString();
    });
  }

  stdout(): string {
    return this.stdoutData;
  }

  stderr(): string {
    return this.stderrData;
  }

  kill(): void {
    this.process.kill("SIGTERM");
  }
}

export class CommandSpace {
  private tempDir: string | null = null;
  private processes: BackgroundCommand[] = [];

  constructor(private initialFiles: File[] = []) {}

  async initialize(): Promise<void> {
    // Create test directory inside examples/ so relative paths work
    const randomId = Math.random().toString(36).substring(2, 8);
    const examplesDir = path.join(process.cwd(), "examples");
    this.tempDir = path.join(examplesDir, `test_${randomId}`);

    await fs.mkdir(this.tempDir, { recursive: true });

    // Create initial files
    for (const file of this.initialFiles) {
      await this.putFile(file);
    }
  }

  async putFile(file: File): Promise<void> {
    if (!this.tempDir) {
      throw new Error("CommandSpace not initialized");
    }

    const filePath = path.join(this.tempDir, file.name);
    const dir = path.dirname(filePath);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, file.content);
  }

  backgroundCommand(commandString: string): BackgroundCommand {
    if (!this.tempDir) {
      throw new Error("CommandSpace not initialized");
    }

    // Parse command string - assume it starts with "dev" and extract args
    const args = commandString.split(" ");

    // Use the exact node executable that VS Code is configured to use
    const nodeExecutable =
      process.env.VITEST_NODE_EXECUTABLE ||
      "/Users/toon/.local/share/mise/installs/node/22.15.0/bin/node" ||
      process.execPath;

    // Use tsx binary directly with full node path
    const tsxBin = path.join(
      process.cwd(),
      "node_modules",
      "tsx",
      "dist",
      "cli.mjs"
    );

    const childProcess = spawn(
      nodeExecutable,
      [tsxBin, "../../src/cli/index.ts", ...args],
      {
        cwd: this.tempDir,
        env: {
          ...process.env,
          FLOWW_NAMESPACE_ID: "test-namespace-id",
          PATH: path.dirname(nodeExecutable) + ":" + (process.env.PATH || ""),
        },
        stdio: "pipe",
      }
    );

    const command = new BackgroundCommand(childProcess);
    this.processes.push(command);
    return command;
  }

  async exit(): Promise<void> {
    // Kill all processes
    for (const command of this.processes) {
      command.kill();
    }

    // Clean up temp directory
    if (this.tempDir) {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    }

    this.processes.length = 0;
    this.tempDir = null;
  }
}
