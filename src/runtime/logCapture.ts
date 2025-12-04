/**
 * Log capture utility for runtime execution
 *
 * Intercepts console output during user code execution while
 * still printing to real stdout/stderr (tee behavior).
 */

const LOG_LEVELS = ["log", "info", "warn", "error", "debug"] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

export interface StructuredLogEntry {
  timestamp: string;
  level: string;
  message: string;
}

export class LogCapture {
  private logs: StructuredLogEntry[] = [];
  private originalConsole: Record<LogLevel, typeof console.log> = {} as any;
  private isCapturing = false;

  constructor() {
    for (const level of LOG_LEVELS) {
      this.originalConsole[level] = console[level].bind(console);
    }
  }

  private formatArgs(args: any[]): string {
    return args
      .map((arg) => {
        if (typeof arg === "string") return arg;
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      })
      .join(" ");
  }

  private intercept(level: LogLevel, args: any[]): void {
    const timestamp = new Date().toISOString();
    const message = this.formatArgs(args);
    this.logs.push({ timestamp, level, message });
    this.originalConsole[level](...args);
  }

  start(): void {
    if (this.isCapturing) return;
    this.isCapturing = true;
    this.logs = [];

    for (const level of LOG_LEVELS) {
      console[level] = (...args: any[]) => this.intercept(level, args);
    }
  }

  stop(): void {
    if (!this.isCapturing) return;
    this.isCapturing = false;

    for (const level of LOG_LEVELS) {
      console[level] = this.originalConsole[level];
    }
  }

  getStructuredLogs(): StructuredLogEntry[] {
    return [...this.logs];
  }

  clear(): void {
    this.logs = [];
  }
}
