import * as inspector from "inspector";
import * as vm from "vm";

export interface BreakpointLocation {
  lineNumber: number;
  columnNumber?: number;
}

export interface InspectorSessionCallbacks {
  onBreakpoint?: (params: any) => void;
  onConsoleApiCalled?: (params: any) => void;
  onExceptionThrown?: (params: any) => void;
  onScriptParsed?: (params: any) => void;
}

export class InspectorManager {
  private session?: inspector.Session;
  private isRunning: boolean = false;
  private debugPort: number;
  private callbacks: InspectorSessionCallbacks = {};
  private breakpoints: Map<string, BreakpointLocation[]> = new Map();

  constructor(debugPort: number = 9229) {
    this.debugPort = debugPort;
  }

  async startInspector(): Promise<void> {
    if (this.isRunning) {
      console.warn("Inspector is already running");
      return;
    }

    try {
      // Open the inspector on the specified port
      const url = inspector.url();
      if (!url) {
        inspector.open(this.debugPort);
        // Minimal inspector startup log - already shown in engine
        // console.log(`🔍 Node.js Inspector started on port ${this.debugPort}`);
      }

      this.session = new inspector.Session();
      this.session.connect();

      this.isRunning = true;

      // Set up event handlers
      this.setupInspectorEvents();

      // Enable required domains
      await this.enableInspectorDomains();

      // Remove verbose inspector logs - users just need to know it's working
      // console.log('✅ Inspector session established');
    } catch (error) {
      console.error("Failed to start inspector:", error);
      throw error;
    }
  }

  async stopInspector(): Promise<void> {
    if (!this.isRunning || !this.session) {
      return;
    }

    try {
      this.session.disconnect();
      inspector.close();
      this.isRunning = false;
      console.log("🔍 Inspector stopped");
    } catch (error) {
      console.error("Error stopping inspector:", error);
    }
  }

  private setupInspectorEvents(): void {
    if (!this.session) return;

    this.session.on("Debugger.paused", (params: any) => {
      console.log("🔍 Debugger paused:", params.reason || "unknown reason");
      if (this.callbacks.onBreakpoint) {
        this.callbacks.onBreakpoint(params);
      }
    });

    this.session.on("Runtime.consoleAPICalled", (params) => {
      if (this.callbacks.onConsoleApiCalled) {
        this.callbacks.onConsoleApiCalled(params);
      }
    });

    this.session.on("Runtime.exceptionThrown", (params: any) => {
      console.error(
        "🐛 Exception in debugger:",
        params.exceptionDetails || params,
      );
      if (this.callbacks.onExceptionThrown) {
        this.callbacks.onExceptionThrown(params);
      }
    });

    this.session.on("Debugger.scriptParsed", (params) => {
      if (this.callbacks.onScriptParsed) {
        this.callbacks.onScriptParsed(params);
      }
    });
  }

  private async enableInspectorDomains(): Promise<void> {
    if (!this.session) return;

    return new Promise((resolve, reject) => {
      let enabledCount = 0;
      const totalDomains = 2;

      const checkComplete = () => {
        enabledCount++;
        if (enabledCount === totalDomains) {
          resolve();
        }
      };

      // Enable Runtime domain
      this.session!.post("Runtime.enable", (err) => {
        if (err) {
          reject(err);
        } else {
          // console.log('✓ Runtime domain enabled');
          checkComplete();
        }
      });

      // Enable Debugger domain
      this.session!.post("Debugger.enable", (err) => {
        if (err) {
          reject(err);
        } else {
          // console.log('✓ Debugger domain enabled');
          checkComplete();
        }
      });
    });
  }

  async setBreakpoint(
    scriptId: string,
    lineNumber: number,
    columnNumber?: number,
  ): Promise<any> {
    if (!this.session) {
      throw new Error("Inspector session not established");
    }

    return new Promise((resolve, reject) => {
      this.session!.post(
        "Debugger.setBreakpoint",
        {
          location: {
            scriptId,
            lineNumber,
            columnNumber,
          },
        },
        (err, result) => {
          if (err) {
            reject(err);
          } else {
            console.log(
              `🔴 Breakpoint set at ${scriptId}:${lineNumber}${columnNumber ? `:${columnNumber}` : ""}`,
            );

            // Store breakpoint information
            const breakpoints = this.breakpoints.get(scriptId) || [];
            breakpoints.push({ lineNumber, columnNumber });
            this.breakpoints.set(scriptId, breakpoints);

            resolve(result);
          }
        },
      );
    });
  }

  async removeBreakpoint(breakpointId: string): Promise<void> {
    if (!this.session) {
      throw new Error("Inspector session not established");
    }

    return new Promise((resolve, reject) => {
      this.session!.post(
        "Debugger.removeBreakpoint",
        {
          breakpointId,
        },
        (err) => {
          if (err) {
            reject(err);
          } else {
            console.log(`🟢 Breakpoint removed: ${breakpointId}`);
            resolve();
          }
        },
      );
    });
  }

  async resume(): Promise<void> {
    if (!this.session) {
      throw new Error("Inspector session not established");
    }

    return new Promise((resolve, reject) => {
      this.session!.post("Debugger.resume", (err) => {
        if (err) {
          reject(err);
        } else {
          console.log("▶️  Execution resumed");
          resolve();
        }
      });
    });
  }

  async stepOver(): Promise<void> {
    if (!this.session) {
      throw new Error("Inspector session not established");
    }

    return new Promise((resolve, reject) => {
      this.session!.post("Debugger.stepOver", (err) => {
        if (err) {
          reject(err);
        } else {
          console.log("⏭️  Step over");
          resolve();
        }
      });
    });
  }

  async stepInto(): Promise<void> {
    if (!this.session) {
      throw new Error("Inspector session not established");
    }

    return new Promise((resolve, reject) => {
      this.session!.post("Debugger.stepInto", (err) => {
        if (err) {
          reject(err);
        } else {
          console.log("⬇️  Step into");
          resolve();
        }
      });
    });
  }

  async stepOut(): Promise<void> {
    if (!this.session) {
      throw new Error("Inspector session not established");
    }

    return new Promise((resolve, reject) => {
      this.session!.post("Debugger.stepOut", (err) => {
        if (err) {
          reject(err);
        } else {
          console.log("⬆️  Step out");
          resolve();
        }
      });
    });
  }

  async evaluateExpression(
    expression: string,
    contextId?: number,
  ): Promise<any> {
    if (!this.session) {
      throw new Error("Inspector session not established");
    }

    return new Promise((resolve, reject) => {
      this.session!.post(
        "Runtime.evaluate",
        {
          expression,
          contextId,
          returnByValue: true,
          generatePreview: true,
        },
        (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        },
      );
    });
  }

  async attachToVMContext(vmContext: vm.Context): Promise<void> {
    // Note: Direct VM context attachment is complex in Node.js
    // This is a placeholder for potential future implementation
    console.log("ℹ️  VM Context attachment is not directly supported");
    console.log(
      "   Use --inspect flag with node directly for full VM debugging",
    );
  }

  setCallbacks(callbacks: InspectorSessionCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  isInspectorRunning(): boolean {
    return this.isRunning;
  }

  getDebuggerUrl(): string | null {
    return inspector.url() || null;
  }

  getBreakpoints(): Map<string, BreakpointLocation[]> {
    return new Map(this.breakpoints);
  }

  async getScripts(): Promise<any[]> {
    if (!this.session) {
      throw new Error("Inspector session not established");
    }

    return new Promise((resolve, reject) => {
      this.session!.post("Debugger.getScriptSource", {}, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result ? [result] : []);
        }
      });
    });
  }

  // Helper method to enable profiling
  async enableProfiling(): Promise<void> {
    if (!this.session) {
      throw new Error("Inspector session not established");
    }

    return new Promise((resolve, reject) => {
      this.session!.post("Profiler.enable", (err) => {
        if (err) {
          reject(err);
        } else {
          console.log("📊 Profiler enabled");
          resolve();
        }
      });
    });
  }

  async startProfiling(title?: string): Promise<void> {
    if (!this.session) {
      throw new Error("Inspector session not established");
    }

    return new Promise((resolve, reject) => {
      this.session!.post("Profiler.start", { title }, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`📈 Profiling started${title ? `: ${title}` : ""}`);
          resolve();
        }
      });
    });
  }

  async stopProfiling(): Promise<any> {
    if (!this.session) {
      throw new Error("Inspector session not established");
    }

    return new Promise((resolve, reject) => {
      this.session!.post("Profiler.stop", (err, result) => {
        if (err) {
          reject(err);
        } else {
          console.log("📉 Profiling stopped");
          resolve(result);
        }
      });
    });
  }
}
