import { consola } from "consola";
import {
  spinner,
  confirm,
  select,
  text,
  isCancel,
  cancel,
  log,
} from "@clack/prompts";
import { setTimeout } from "timers/promises";

// Standardized icons for consistent UX
export const ICONS = {
  VERIFY: "🔍",
  SUCCESS: "✅",
  ERROR: "❌",
  WARNING: "⚠️",
  FILE: "📄",
  DOCKER: "🐳",
  DEPLOY: "🚀",
  WAITING: "⏳",
  INFO: "ℹ️",
  BULB: "💡",
} as const;

// Environment detection for interactive vs non-interactive mode
const isInteractive =
  process.stdout.isTTY && !process.env.CI && !process.env.FLOWW_LOG_FORMAT;

// Debug mode detection
const isDebugMode =
  process.env.FLOWW_DEBUG === "1" || process.env.FLOWW_DEBUG === "true";

export interface TaskStep {
  title: string;
  task: () => Promise<void>;
}

export class FlowwLogger {
  private _consola = consola;

  constructor() {
    // Configure consola for structured logging in non-interactive environments
    if (!isInteractive) {
      this._consola = consola.create({
        level: process.env.FLOWW_LOG_LEVEL
          ? parseInt(process.env.FLOWW_LOG_LEVEL)
          : 3,
        formatOptions: {
          date: true,
          colors: false,
        },
      });
    }
  }

  /**
   * Log informational message with verify icon
   */
  info(message: string, details?: any): void {
    const fullMessage = `${ICONS.VERIFY} ${message}`;
    if (isInteractive) {
      log.info(fullMessage);
      if (details) {
        log.info(JSON.stringify(details, null, 2));
      }
    } else {
      if (details) {
        this._consola.info(fullMessage, details);
      } else {
        this._consola.info(fullMessage);
      }
    }
  }

  /**
   * Log success message with checkmark icon
   */
  success(message: string, details?: any): void {
    const fullMessage = `${ICONS.SUCCESS} ${message}`;
    if (isInteractive) {
      log.success(fullMessage);
      if (details) {
        log.info(JSON.stringify(details, null, 2));
      }
    } else {
      if (details) {
        this._consola.success(fullMessage, details);
      } else {
        this._consola.success(fullMessage);
      }
    }
  }

  /**
   * Log error message with X icon
   */
  error(message: string, details?: any): void {
    const fullMessage = `${ICONS.ERROR}  ${message}`;

    if (isDebugMode && details instanceof Error) {
      // In debug mode, show full stack trace
      const debugMessage = `${fullMessage}\n\nFull stack trace:\n${
        details.stack || details.toString()
      }`;

      if (isInteractive) {
        log.error(debugMessage);
      } else {
        this._consola.error(debugMessage);
      }
      return;
    }

    if (isInteractive) {
      log.error(fullMessage);
      if (details) {
        if (details instanceof Error) {
          // Show just the error message, not the full stack in non-debug mode
          log.error(details.message);
        } else {
          log.error(JSON.stringify(details, null, 2));
        }
      }
    } else {
      if (details) {
        if (details instanceof Error) {
          // In non-interactive mode, show more details but still controlled
          this._consola.error(
            fullMessage,
            isDebugMode ? details : details.message,
          );
        } else {
          this._consola.error(fullMessage, details);
        }
      } else {
        this._consola.error(fullMessage);
      }
    }
  }

  /**
   * Log warning message with warning icon
   */
  warn(message: string, details?: any): void {
    const fullMessage = `${ICONS.WARNING}  ${message}`;
    if (isInteractive) {
      log.warn(fullMessage);
      if (details) {
        log.warn(JSON.stringify(details, null, 2));
      }
    } else {
      if (details) {
        this._consola.warn(fullMessage, details);
      } else {
        this._consola.warn(fullMessage);
      }
    }
  }

  /**
   * Execute a task with a spinner in interactive mode, or structured logging in non-interactive
   */
  async task<T>(title: string, task: () => Promise<T>): Promise<T> {
    if (isInteractive) {
      const s = spinner({ indicator: "timer" });
      s.start(title);

      try {
        const result = await task();
        if (typeof result == "string") {
          s.stop(`${ICONS.SUCCESS} ${result}`);
        } else {
          s.stop(`${ICONS.SUCCESS} ${title}`);
        }
        return result;
      } catch (error) {
        s.stop(`${ICONS.ERROR} ${title} failed`);
        if (isDebugMode && error instanceof Error) {
          this._consola.debug(`\nDebug: Full error details for "${title}":`);
          this._consola.debug(error.stack || error.toString());
        }
        throw error;
      }
    } else {
      // Non-interactive mode: log start and end
      console.log(`⏳ ${title}...`);
      try {
        const result = await task();
        console.log(`✅ ${title}`);
        return result;
      } catch (error) {
        console.log(`❌ ${title} failed`);
        if (isDebugMode && error instanceof Error) {
          this._consola.debug(`\nDebug: Full error details for "${title}":`);
          this._consola.debug(error.stack || error.toString());
        }
        throw error;
      }
    }
  }

  /**
   * Execute multiple steps with progress indication
   */
  async steps(steps: TaskStep[]): Promise<void> {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const progress = `(${i + 1}/${steps.length})`;
      await this.task(`${progress} ${step.title}`, step.task);
    }
  }

  /**
   * Show confirmation prompt in interactive mode
   */
  async confirm(
    message: string,
    defaultValue: boolean = true,
  ): Promise<boolean> {
    if (!isInteractive) {
      // In non-interactive mode, return default value
      this.info(`${message} (auto-confirmed: ${defaultValue ? "yes" : "no"})`);
      return defaultValue;
    }

    const result = await confirm({
      message,
      initialValue: defaultValue,
    });

    if (isCancel(result)) {
      cancel("Operation cancelled.");
      process.exit(0);
    }

    return result;
  }

  /**
   * Show selection prompt in interactive mode
   */
  async select<T extends string>(
    message: string,
    options: Array<{ value: T; label: string; hint?: string }>,
  ): Promise<T> {
    if (!isInteractive) {
      // In non-interactive mode, return first option
      const firstOption = options[0];
      this.info(`${message} (auto-selected: ${firstOption.label})`);
      return firstOption.value;
    }

    const result = await select({
      message,
      options,
    });

    if (isCancel(result)) {
      cancel("Operation cancelled.");
      process.exit(0);
    }

    return result as T;
  }

  /**
   * Show text input prompt in interactive mode
   */
  async text(
    message: string,
    placeholder?: string,
    defaultValue?: string,
  ): Promise<string> {
    if (!isInteractive) {
      // In non-interactive mode, return default value or placeholder
      const value = defaultValue || placeholder || "default";
      this.info(`${message} (auto-filled: ${value})`);
      return value;
    }

    const result = await text({
      message,
      placeholder,
      defaultValue,
    });

    if (isCancel(result)) {
      cancel("Operation cancelled.");
      process.exit(0);
    }

    return result;
  }

  /**
   * Show a tip or suggestion message
   */
  tip(message: string): void {
    const fullMessage = `${ICONS.BULB} ${message}`;
    if (isInteractive) {
      log.info(fullMessage);
    } else {
      this._consola.info(fullMessage);
    }
  }

  /**
   * Show plain informational message without icons
   */
  plain(message: string): void {
    if (isInteractive) {
      log.info(message);
    } else {
      this._consola.info(message);
    }
  }

  /**
   * Direct access to consola methods for cleaner logging without clack
   */
  get console() {
    return {
      info: (message: string, ...args: any[]) =>
        this._consola.info(message, ...args),
      success: (message: string, ...args: any[]) =>
        this._consola.success(message, ...args),
      warn: (message: string, ...args: any[]) =>
        this._consola.warn(message, ...args),
      error: (message: string, ...args: any[]) =>
        this._consola.error(message, ...args),
      debug: (message: string, ...args: any[]) =>
        this._consola.debug(message, ...args),
      log: (message: string, ...args: any[]) =>
        this._consola.log(message, ...args),
    };
  }

  /**
   * Raw consola instance for advanced usage
   */
  get consola() {
    return this._consola;
  }

  /**
   * Check if running in interactive mode
   */
  get interactive() {
    return isInteractive;
  }

  /**
   * Check if running in debug mode
   */
  get debug() {
    return isDebugMode;
  }

  /**
   * Log debug information only when debug mode is enabled
   */
  debugInfo(message: string, details?: any): void {
    if (!isDebugMode) return;

    const fullMessage = `🐛 DEBUG: ${message}`;
    if (isInteractive) {
      log.info(fullMessage);
      if (details) {
        this._consola.debug(details);
      }
    } else {
      if (details) {
        this._consola.debug(fullMessage, details);
      } else {
        this._consola.debug(fullMessage);
      }
    }
  }

  /**
   * Execute a task silently with debug logging only
   */
  async debugTask<T>(title: string, task: () => Promise<T>): Promise<T> {
    if (isDebugMode) {
      // In debug mode, show the task
      return this.task(title, task);
    } else {
      // In normal mode, just execute silently
      try {
        const result = await task();
        return result;
      } catch (error) {
        console.log(`❌ ${title} failed`);
        logger.debugInfo(`Error details for ${title}:`, error);
        throw error;
      }
    }
  }
}

// Export singleton instance
export const logger = new FlowwLogger();

// Setup global error handlers in debug mode
if (isDebugMode) {
  process.on("uncaughtException", (error) => {
    logger.consola.error("\n🐛 DEBUG: Uncaught Exception:");
    logger.consola.error(error.stack || error.toString());
    process.exit(1);
  });

  process.on("unhandledRejection", (reason, promise) => {
    logger.consola.error(
      "\n🐛 DEBUG: Unhandled Promise Rejection at:",
      promise,
    );
    logger.consola.error("Reason:", reason);
    if (reason instanceof Error) {
      logger.consola.error("Stack:", reason.stack);
    }
    process.exit(1);
  });
}
