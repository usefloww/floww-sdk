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
          const lines = originalStack.split('\n');
          const relevantLines = lines.slice(2); // Skip "Error" and this function
          error.stack = `${error.message}\n${relevantLines.join('\n')}`;
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
}

export function waitUntilStdout(command: BackgroundCommand, pattern: string, timeout = 5000) {
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
          `📝 Current stdout (${stdout.length} chars):\n${stdout.slice(-1000)}\n\n` +
          `📝 Current stderr (${stderr.length} chars):\n${stderr.slice(-500)}`
        );

        // Replace the stack to show where waitUntilStdout was called from
        if (originalStack) {
          const lines = originalStack.split('\n');
          const relevantLines = lines.slice(2); // Skip "Error" and this function
          error.stack = `${error.message}\n${relevantLines.join('\n')}`;
        }
        reject(error);
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

export function waitUntilStderr(command: BackgroundCommand, pattern: string, timeout = 5000) {
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
          `📝 Current stderr (${stderr.length} chars):\n${stderr.slice(-500)}\n\n` +
          `📝 Current stdout (${stdout.length} chars):\n${stdout.slice(-1000)}`
        );

        // Replace the stack to show where waitUntilStderr was called from
        if (originalStack) {
          const lines = originalStack.split('\n');
          const relevantLines = lines.slice(2); // Skip "Error" and this function
          error.stack = `${error.message}\n${relevantLines.join('\n')}`;
        }
        reject(error);
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}
