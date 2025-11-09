import { spawn, ChildProcess } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import * as pty from "@lydell/node-pty";

export interface File {
  name: string;
  content: string;
}

class BackgroundCommand {
  private process: ChildProcess | pty.IPty;
  private stdoutData = "";
  private stderrData = "";
  private isPty: boolean;
  private exitCode: number | null = null;
  private exitPromise: Promise<number>;
  private exitResolve!: (code: number) => void;

  constructor(process: ChildProcess | pty.IPty, isPty = false) {
    this.process = process;
    this.isPty = isPty;

    // Create promise that resolves when process exits
    this.exitPromise = new Promise((resolve) => {
      this.exitResolve = resolve;
    });

    if (isPty) {
      // PTY mode: all output comes through onData
      const ptyProcess = process as pty.IPty;
      ptyProcess.onData((data) => {
        this.stdoutData += data;
      });

      ptyProcess.onExit(({ exitCode }) => {
        this.exitCode = exitCode;
        this.exitResolve(exitCode);
      });
    } else {
      // Pipe mode: separate stdout and stderr
      const childProcess = process as ChildProcess;
      childProcess.stdout?.on("data", (data) => {
        this.stdoutData += data.toString();
      });

      childProcess.stderr?.on("data", (data) => {
        this.stderrData += data.toString();
      });

      childProcess.on("exit", (code) => {
        this.exitCode = code ?? 0;
        this.exitResolve(code ?? 0);
      });
    }
  }

  stdout(): string {
    return this.stdoutData;
  }

  stderr(): string {
    return this.stderrData;
  }

  /**
   * Write raw input to the process stdin
   * @param input - The input string to write (e.g., "yes\n" or ANSI escape sequences)
   */
  write(input: string): void {
    if (this.isPty) {
      (this.process as pty.IPty).write(input);
    } else {
      const childProcess = this.process as ChildProcess;
      if (!childProcess.stdin) {
        throw new Error("Process stdin is not available");
      }
      childProcess.stdin.write(input);
    }
  }

  /**
   * Close the stdin stream
   */
  end(): void {
    if (!this.isPty) {
      const childProcess = this.process as ChildProcess;
      if (childProcess.stdin) {
        childProcess.stdin.end();
      }
    }
  }

  /**
   * Send arrow up key press (ANSI escape sequence)
   */
  writeArrowUp(): void {
    this.write("\x1B[A");
  }

  /**
   * Send arrow down key press (ANSI escape sequence)
   */
  writeArrowDown(): void {
    this.write("\x1B[B");
  }

  /**
   * Send arrow right key press (ANSI escape sequence)
   */
  writeArrowRight(): void {
    this.write("\x1B[C");
  }

  /**
   * Send arrow left key press (ANSI escape sequence)
   */
  writeArrowLeft(): void {
    this.write("\x1B[D");
  }

  /**
   * Send enter key press
   */
  writeEnter(): void {
    this.write("\r");
  }

  /**
   * Send space key press
   */
  writeSpace(): void {
    this.write(" ");
  }

  /**
   * Get the exit code if the process has exited, otherwise null
   */
  getExitCode(): number | null {
    return this.exitCode;
  }

  /**
   * Wait for the process to exit and return the exit code
   * For internal use only - prefer using waitForExit() from CommandTestHelpers in tests
   */
  waitForExit(timeout?: number): Promise<number> {
    if (timeout) {
      return Promise.race([
        this.exitPromise,
        new Promise<number>((_, reject) =>
          setTimeout(() => reject(new Error(`Process did not exit within ${timeout}ms`)), timeout)
        ),
      ]);
    }
    return this.exitPromise;
  }

  kill(): void {
    if (this.isPty) {
      (this.process as pty.IPty).kill();
    } else {
      (this.process as ChildProcess).kill("SIGTERM");
    }
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

  async setupMockAuth(): Promise<void> {
    if (!this.tempDir) {
      throw new Error("CommandSpace not initialized");
    }
    const configDir = path.join(this.tempDir, ".config", "floww");
    const authFile = path.join(configDir, "auth.json");

    // Ensure config directory exists
    await fs.mkdir(configDir, { recursive: true });

    // Write mock auth tokens (valid for 1 hour)
    const mockAuth = {
      accessToken: "mock-access-token-123",
      refreshToken: "mock-refresh-token-456",
      expiresAt: Date.now() + 3600000, // 1 hour from now
      user: {
        id: "test-user-123",
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
      },
    };

    await fs.writeFile(authFile, JSON.stringify(mockAuth, null, 2));
    await fs.chmod(authFile, 0o600);
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

  backgroundCommand(
    commandString: string,
    options?: { tty?: boolean; env?: Record<string, string> }
  ): BackgroundCommand {
    if (!this.tempDir) {
      throw new Error("CommandSpace not initialized");
    }

    const useTty = options?.tty ?? false;

    // Parse command string - assume it starts with "dev" and extract args
    const args = commandString.split(" ");

    // Use the exact node executable that VS Code is configured to use
    const nodeExecutable =
      process.env.VITEST_NODE_EXECUTABLE || process.execPath;

    // Use tsx binary directly with full node path
    const tsxBin = path.join(
      process.cwd(),
      "node_modules",
      "tsx",
      "dist",
      "cli.mjs"
    );

    // Common environment variables
    const env = {
      ...process.env,
      FLOWW_NAMESPACE_ID: "test-namespace-id",
      PATH:
        path.dirname(nodeExecutable) +
        ":" +
        (process.env.PATH || "") +
        ":" +
        "/Users/toon/.local/share/mise/installs/pnpm/10.9.0/",
      // Use isolated config directory for tests
      XDG_CONFIG_HOME: path.join(this.tempDir, ".config"),
      // Enable colors in prompts for better terminal emulation
      FORCE_COLOR: "1",
      // Merge custom env variables from options
      ...options?.env,
    };

    let command: BackgroundCommand;

    if (useTty) {
      // Use PTY for full terminal emulation (makes process.stdout.isTTY = true)
      const ptyProcess = pty.spawn(
        nodeExecutable,
        [tsxBin, "../../src/cli/index.ts", ...args],
        {
          name: "xterm-color",
          cols: 80,
          rows: 30,
          cwd: this.tempDir,
          env,
        }
      );

      command = new BackgroundCommand(ptyProcess, true);
    } else {
      // Use regular spawn with pipes (process.stdout.isTTY = false)
      const childProcess = spawn(
        nodeExecutable,
        [tsxBin, "../../src/cli/index.ts", ...args],
        {
          cwd: this.tempDir,
          env,
          // Explicitly enable stdin, stdout, stderr as pipes
          stdio: ["pipe", "pipe", "pipe"],
        }
      );

      command = new BackgroundCommand(childProcess, false);
    }

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
