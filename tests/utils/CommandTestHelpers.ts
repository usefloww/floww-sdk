export function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function waitUntil(condition: () => boolean, timeout = 3000) {
  return new Promise((resolve, reject) => {
    // Capture the original call stack
    const originalStack = new Error().stack;
    const start = Date.now();

    const check = () => {
      if (condition()) {
        resolve(true);
      } else if (Date.now() - start > timeout) {
        const error = new Error(`Timeout after ${timeout}ms`);
        // Replace the stack to show where waitUntil was called from
        if (originalStack) {
          const lines = originalStack.split("\n");
          const relevantLines = lines.slice(2); // Skip "Error" and this function
          error.stack = `${error.message}\n${relevantLines.join("\n")}`;
        }
        reject(error);
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  });
}

interface BackgroundCommand {
  stdout(): string;
  stderr(): string;
  writeArrowUp(): void;
  writeArrowDown(): void;
  writeEnter(): void;
  getExitCode(): number | null;
  waitForExit(timeout?: number): Promise<number>;
}

export function waitUntilStdout(
  command: BackgroundCommand,
  pattern: string,
  timeout = 2000
) {
  return new Promise((resolve, reject) => {
    // Capture the original call stack
    const originalStack = new Error().stack;
    const start = Date.now();

    const check = () => {
      const stdout = command.stdout();
      const stderr = command.stderr();

      if (stdout.includes(pattern)) {
        resolve(true);
      } else if (Date.now() - start > timeout) {
        const error = new Error(
          `Timeout after ${timeout}ms waiting for pattern: "${pattern}"\n\n` +
            `📝 Current stdout (${stdout.length} chars):\n${stdout}\n\n` +
            `📝 Current stderr (${stderr.length} chars):\n${stderr}`
        );

        // Replace the stack to show where waitUntilStdout was called from
        if (originalStack) {
          const lines = originalStack.split("\n");
          const relevantLines = lines.slice(2); // Skip "Error" and this function
          error.stack = `${error.message}\n${relevantLines.join("\n")}`;
        }
        reject(error);
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

export function waitUntilStderr(
  command: BackgroundCommand,
  pattern: string,
  timeout = 5000
) {
  return new Promise((resolve, reject) => {
    // Capture the original call stack
    const originalStack = new Error().stack;
    const start = Date.now();

    const check = () => {
      const stdout = command.stdout();
      const stderr = command.stderr();

      if (stderr.includes(pattern)) {
        resolve(true);
      } else if (Date.now() - start > timeout) {
        const error = new Error(
          `Timeout after ${timeout}ms waiting for pattern in stderr: "${pattern}"\n\n` +
            `📝 Current stderr (${stderr.length} chars):\n${stderr}\n\n` +
            `📝 Current stdout (${stdout.length} chars):\n${stdout}`
        );

        // Replace the stack to show where waitUntilStderr was called from
        if (originalStack) {
          const lines = originalStack.split("\n");
          const relevantLines = lines.slice(2); // Skip "Error" and this function
          error.stack = `${error.message}\n${relevantLines.join("\n")}`;
        }
        reject(error);
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

/**
 * Wait for the process to exit and return its exit code
 * @param command - The background command to wait for
 * @param timeout - Maximum time to wait in milliseconds (default: 5000ms)
 * @returns The exit code of the process
 */
export function waitForExit(
  command: BackgroundCommand,
  timeout = 5000
): Promise<number> {
  return new Promise((resolve, reject) => {
    // Capture the original call stack
    const originalStack = new Error().stack;
    const start = Date.now();

    const check = () => {
      const exitCode = command.getExitCode();

      if (exitCode !== null) {
        resolve(exitCode);
      } else if (Date.now() - start > timeout) {
        const error = new Error(
          `Timeout after ${timeout}ms waiting for process to exit\n\n` +
            `📝 Current stdout:\n${command.stdout()}\n\n` +
            `📝 Current stderr:\n${command.stderr()}`
        );

        // Replace the stack to show where waitForExit was called from
        if (originalStack) {
          const lines = originalStack.split("\n");
          const relevantLines = lines.slice(2); // Skip "Error" and this function
          error.stack = `${error.message}\n${relevantLines.join("\n")}`;
        }
        reject(error);
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

/**
 * Like waitUntilStdout but returns false on timeout instead of throwing
 * Useful for optional patterns that may or may not appear
 */
export function waitUntilStdoutOptional(
  command: BackgroundCommand,
  pattern: string,
  timeout = 2000
): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now();

    const check = () => {
      const stdout = command.stdout();

      if (stdout.includes(pattern)) {
        resolve(true);
      } else if (Date.now() - start > timeout) {
        resolve(false);
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

export async function waitUntilProgress(
  command: BackgroundCommand,
  pattern: string,
  initialTimeout = 3000,
  maxSeconds = 30
) {
  // Uploading runtime image (this may take a moment) [0s]
  // Uploading runtime image (this may take a moment) [1s]

  await waitUntilStdout(command, `${pattern} [0s]`, 3000);
  for (let i = 1; i < maxSeconds; i++) {
    const found = await waitUntilStdoutOptional(
      command,
      `${pattern} [${i}s]`,
      1300
    );
    if (!found) break;
  }
}

/**
 * Wait for any of the provided patterns to appear in stdout
 * Returns the matched pattern, or null if timeout
 */
export function waitUntilAnyMatch(
  command: BackgroundCommand,
  patterns: string[],
  timeout = 2000
): Promise<string | null> {
  return new Promise((resolve) => {
    const start = Date.now();

    const check = () => {
      const stdout = command.stdout();

      for (const pattern of patterns) {
        if (stdout.includes(pattern)) {
          resolve(pattern);
          return;
        }
      }

      if (Date.now() - start > timeout) {
        resolve(null);
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

/**
 * Parse CLI select prompt output to find options and currently selected index
 * @param output - The stdout text containing the prompt
 * @returns Object with options array and currentIndex, or null if not parseable
 */
function parseSelectPrompt(
  output: string
): { options: string[]; currentIndex: number } | null {
  const lines = output.split("\n");
  const options: string[] = [];
  let currentIndex = -1;

  for (const line of lines) {
    // Look for lines with bullets (● selected, ○ unselected)
    // Match patterns like "│  ● Some option text" or "  ○ Some option text"
    // Account for box-drawing characters (│, ┃, etc.) that may precede the bullet
    const selectedMatch = line.match(/^[│┃\s]*[●◉⬤]\s+(.+)$/);
    const unselectedMatch = line.match(/^[│┃\s]*[○◯⭕]\s+(.+)$/);

    if (selectedMatch) {
      currentIndex = options.length;
      // Extract just the main text, handling optional parenthetical descriptions
      const fullText = selectedMatch[1].trim();
      options.push(fullText);
    } else if (unselectedMatch) {
      const fullText = unselectedMatch[1].trim();
      options.push(fullText);
    }
  }

  if (options.length === 0 || currentIndex === -1) {
    return null;
  }

  return { options, currentIndex };
}

/**
 * Select an option from a CLI select prompt by its text
 * Navigates using arrow keys and confirms with enter
 *
 * @param command - The background command
 * @param optionText - The text of the option to select (partial match supported)
 * @param timeout - Maximum time to wait for the option to become available (default: 5000ms)
 *
 * @example
 * await selectOption(command, "Initialize in current directory");
 * // or partial match:
 * await selectOption(command, "current directory");
 */
export async function selectOption(
  command: BackgroundCommand,
  optionText: string,
  timeout = 5000
): Promise<void> {
  const originalStack = new Error().stack;
  const start = Date.now();

  // Wait for the options to be parseable
  await new Promise<void>((resolve, reject) => {
    const check = () => {
      const stdout = command.stdout();
      const parsed = parseSelectPrompt(stdout);

      if (parsed) {
        resolve();
      } else if (Date.now() - start > timeout) {
        const error = new Error(
          `Timeout after ${timeout}ms waiting for select prompt to appear\n\n` +
            `📝 Current stdout:\n${stdout}`
        );
        if (originalStack) {
          const lines = originalStack.split("\n");
          const relevantLines = lines.slice(2);
          error.stack = `${error.message}\n${relevantLines.join("\n")}`;
        }
        reject(error);
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  });

  // Parse the current state
  const stdout = command.stdout();
  const parsed = parseSelectPrompt(stdout);

  if (!parsed) {
    throw new Error("Failed to parse select prompt");
  }

  // Find the target option index (support partial matching)
  const targetIndex = parsed.options.findIndex((option) =>
    option.toLowerCase().includes(optionText.toLowerCase())
  );

  if (targetIndex === -1) {
    throw new Error(
      `Option "${optionText}" not found in available options:\n` +
        parsed.options.map((opt, i) => `  ${i}: ${opt}`).join("\n")
    );
  }

  // Calculate how many steps to move
  const steps = targetIndex - parsed.currentIndex;

  // Navigate to the target option
  if (steps > 0) {
    // Move down
    for (let i = 0; i < steps; i++) {
      command.writeArrowDown();
      // Small delay to allow the UI to update
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  } else if (steps < 0) {
    // Move up
    for (let i = 0; i < Math.abs(steps); i++) {
      command.writeArrowUp();
      // Small delay to allow the UI to update
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  // Small delay before confirming
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Confirm selection
  command.writeEnter();
}

export function writeArrowDown(command: BackgroundCommand) {
  command.writeArrowDown();
}

export function randomExampleFiles() {
  // random name like test-project-123456
  const name = `test-project-${Math.random().toString(36).substring(2, 15)}`;
  return [
    {
      name: "Dockerfile",
      content: `
FROM base-floww

# Build context is SDK root, copy pre-built SDK tarball
COPY floww-*.tgz /tmp/

# Setup /var/task with SDK
WORKDIR /var/task
# Create a minimal package.json for npm to work correctly
RUN echo '{"type":"module","dependencies":{"floww":"*"}}' > package.json && \
    npm install /tmp/floww-*.tgz && \
    rm -rf /tmp/*.tgz

# Set entrypoint from config
ENV FLOWW_ENTRYPOINT=main.ts
RUN echo ${name} > cache-buster.txt

# No source code copying - code will be provided via Lambda event payload
# Uses the universal handler from base-floww image
`,
    },
    {
      name: "main.ts",
      content: `import { Builtin } from "floww";
  
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
    "name": "${name}",
    "version": "1.0.0",
    "type": "module",
    "dependencies": {
      "floww": "0.0.8"
    }
  }
  `,
    },
    {
      name: "floww.yaml",
      content: `workflowId: 799e43a6-a238-4d7f-baa4-fe0ff223f786
name: Test Workflow
version: 1.0.0
entrypoint: main.ts
  `,
    },
  ];
}

export const simpleExampleFiles = [
  {
    name: "main.ts",
    content: `import { Builtin } from "floww";

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
    "floww": "0.0.8"
  }
}
`,
  },
  {
    name: "floww.yaml",
    content: `workflowId: 799e43a6-a238-4d7f-baa4-fe0ff223f786
name: Test Workflow
version: 1.0.0
entrypoint: main.ts
`,
  },
];
