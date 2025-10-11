import * as vm from 'vm';
import { ModuleSystem } from '../../codeExecution/ModuleSystem';
import { InspectorManager } from './inspectorManager';

export interface Position {
  line: number;
  column: number;
}

export interface SourceMapConsumer {
  originalPositionFor(position: { line: number; column: number }): {
    source: string | null;
    line: number | null;
    column: number | null;
    name: string | null;
  };
}

export class DebugContext {
  private sourceMaps: Map<string, any> = new Map();
  private debugMode: boolean = false;
  private moduleSystem?: ModuleSystem;
  private inspectorManager?: InspectorManager;
  private debugPort: number = 9229;

  enableDebug(enabled: boolean, debugPort?: number): void {
    this.debugMode = enabled;
    if (debugPort) {
      this.debugPort = debugPort;
    }

    if (enabled && !this.inspectorManager) {
      this.inspectorManager = new InspectorManager(this.debugPort);
    }
  }

  isDebugEnabled(): boolean {
    return this.debugMode;
  }

  async startInspector(): Promise<void> {
    if (this.inspectorManager && this.debugMode) {
      await this.inspectorManager.startInspector();
    }
  }

  async stopInspector(): Promise<void> {
    if (this.inspectorManager) {
      await this.inspectorManager.stopInspector();
    }
  }

  setModuleSystem(moduleSystem: ModuleSystem): void {
    this.moduleSystem = moduleSystem;
  }

  registerSourceMap(filename: string, sourceMap: any): void {
    if (this.debugMode && sourceMap) {
      try {
        // Parse the source map if it's a string
        const parsedMap = typeof sourceMap === 'string' ? JSON.parse(sourceMap) : sourceMap;
        this.sourceMaps.set(filename, parsedMap);
      } catch (error) {
        console.warn(`Failed to parse source map for ${filename}:`, error);
      }
    }
  }

  getOriginalPosition(filename: string, line: number, column: number): Position {
    const sourceMap = this.sourceMaps.get(filename);
    if (!sourceMap) {
      return { line, column };
    }

    try {
      // TODO: Implement proper source map parsing with source-map library
      // For now, attempt basic source map analysis
      const parsedMap = typeof sourceMap === 'string' ? JSON.parse(sourceMap) : sourceMap;

      // Basic heuristic: if the source map has mappings, try to estimate position
      if (parsedMap.mappings && parsedMap.sources && parsedMap.sources.length > 0) {
        // Return approximate position (this is a simplified approach)
        // In a real implementation, we'd decode the VLQ mappings
        return {
          line: Math.max(1, line - 2), // Rough offset adjustment
          column: Math.max(0, column)
        };
      }

      return { line, column };
    } catch (error) {
      console.warn(`Failed to parse source map for ${filename}:`, error);
      return { line, column };
    }
  }

  createVMContext(baseContext: any, filePath: string): any {
    const debugUtilities = this.debugMode ? {
      __debugBreak: () => {
        // eslint-disable-next-line no-debugger
        debugger;
      },
      __inspect: (obj: any) => this.inspect(obj),
      __trace: () => this.getStackTrace(),
      __debugLog: (message: string, ...args: any[]) => {
        console.log(`[DEBUG ${filePath}]`, message, ...args);
      }
    } : {};

    return {
      ...baseContext,
      ...debugUtilities,
      console: this.createDebugConsole(filePath)
    };
  }

  private createDebugConsole(filePath: string): Console {
    if (!this.debugMode) {
      return console;
    }

    // Create enhanced console with file context
    return {
      ...console,
      log: (...args: any[]) => {
        console.log(`[${this.getShortPath(filePath)}]`, ...args);
      },
      error: (...args: any[]) => {
        console.error(`[${this.getShortPath(filePath)}]`, ...args);
      },
      warn: (...args: any[]) => {
        console.warn(`[${this.getShortPath(filePath)}]`, ...args);
      },
      debug: (...args: any[]) => {
        if (this.debugMode) {
          console.debug(`[DEBUG ${this.getShortPath(filePath)}]`, ...args);
        }
      }
    };
  }

  private getShortPath(filePath: string): string {
    const parts = filePath.split('/');
    return parts.length > 2 ? `.../${parts.slice(-2).join('/')}` : filePath;
  }

  inspect(obj: any): any {
    if (!this.debugMode) {
      return obj;
    }

    try {
      return {
        type: typeof obj,
        value: obj,
        keys: obj && typeof obj === 'object' ? Object.keys(obj) : [],
        constructor: obj?.constructor?.name || 'unknown'
      };
    } catch (error) {
      return { error: 'Failed to inspect object', value: String(obj) };
    }
  }

  getStackTrace(): string[] {
    if (!this.debugMode) {
      return [];
    }

    const stack = new Error().stack;
    if (!stack) {
      return [];
    }

    return stack.split('\n').slice(1); // Remove the Error message line
  }

  reportError(error: any, context?: any): void {
    if (!this.debugMode) {
      return;
    }

    console.error('\n🐛 ENHANCED DEBUG ERROR REPORT');
    console.error('================================================================');

    // Basic error information
    console.error(`💥 Error Type: ${error.constructor?.name || 'Unknown'}`);
    console.error(`📝 Message: ${error.message || 'No message'}`);

    // Enhanced stack trace with source map information
    if (error.stack) {
      console.error('\n📊 Stack Trace with Source Mapping:');
      const stackLines = error.stack.split('\n');

      stackLines.forEach((stackLine: string, index: number) => {
        if (index === 0) {
          console.error(`   ${stackLine}`); // Error message line
          return;
        }

        // Try to extract file information from stack line
        const fileMatch = stackLine.match(/at .* \((.+):(\d+):(\d+)\)/) ||
                          stackLine.match(/at (.+):(\d+):(\d+)/);

        if (fileMatch) {
          const [, filePath, lineNum, colNum] = fileMatch;
          const line = parseInt(lineNum);
          const column = parseInt(colNum);

          // Try to get original position if we have source maps
          const originalPos = this.getOriginalPosition(filePath, line, column);

          if (originalPos.line !== line || originalPos.column !== column) {
            console.error(`   ${stackLine} → Original: ${filePath}:${originalPos.line}:${originalPos.column}`);
          } else {
            console.error(`   ${stackLine}`);
          }

          // Show source context if available
          if (this.hasSourceMap(filePath)) {
            const sourceContext = this.getSourceContext(filePath, originalPos.line, 2);
            if (sourceContext.length > 0) {
              console.error('     Source context:');
              sourceContext.forEach(contextLine => console.error(`       ${contextLine}`));
            }
          }
        } else {
          console.error(`   ${stackLine}`);
        }
      });
    } else {
      console.error('❌ No stack trace available');
    }

    // Context information
    if (context) {
      console.error('\n🔍 Execution Context:');
      const contextInfo = this.inspect(context);
      console.error(`   Type: ${contextInfo.type}`);
      console.error(`   Keys: [${contextInfo.keys.join(', ')}]`);

      // Show relevant context properties
      if (context.eventType) console.error(`   Event Type: ${context.eventType}`);
      if (context.triggerType) console.error(`   Trigger Type: ${context.triggerType}`);
      if (context.filePath) console.error(`   File Path: ${context.filePath}`);
      if (context.hasSourceMap) console.error(`   Source Map Available: ${context.hasSourceMap}`);
    }

    // Source map availability
    const sourceMapsCount = this.sourceMaps.size;
    console.error(`\n🗺️  Source Maps: ${sourceMapsCount} files mapped`);
    if (sourceMapsCount > 0) {
      console.error('   Mapped files:');
      for (const filePath of this.sourceMaps.keys()) {
        console.error(`     • ${this.getShortPath(filePath)}`);
      }
    }

    console.error('================================================================\n');
  }

  getSourceContext(filePath: string, line: number, contextLines: number = 3): string[] {
    try {
      // Try to read the actual source file if it exists in the file system
      const fs = require('fs');
      const path = require('path');

      // Resolve the file path relative to the current working directory
      const fullPath = path.resolve(process.cwd(), filePath);

      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');

        const startLine = Math.max(0, line - contextLines - 1);
        const endLine = Math.min(lines.length, line + contextLines);

        const context: string[] = [];

        for (let i = startLine; i < endLine; i++) {
          const lineNumber = i + 1;
          const prefix = lineNumber === line ? '→' : ' ';
          const formattedLine = `${prefix} ${lineNumber.toString().padStart(3)}: ${lines[i] || ''}`;
          context.push(formattedLine);
        }

        return context;
      }

      // Fallback: check if we have the source in our VFS (if moduleSystem is available)
      if (this.moduleSystem) {
        return [
          `// Source context for ${filePath}:${line}`,
          '// (File not found on disk, would need VFS access)'
        ];
      }

      return [
        `// Source context for ${filePath}:${line}`,
        '// (Source file not accessible)'
      ];
    } catch (error) {
      return [
        `// Error reading source context for ${filePath}:${line}`,
        `// ${error instanceof Error ? error.message : 'Unknown error'}`
      ];
    }
  }

  hasSourceMap(filePath: string): boolean {
    return this.sourceMaps.has(filePath);
  }

  getSourceMap(filePath: string): any {
    return this.sourceMaps.get(filePath);
  }

  getInspectorManager(): InspectorManager | undefined {
    return this.inspectorManager;
  }

  getDebuggerUrl(): string | null {
    return this.inspectorManager?.getDebuggerUrl() || null;
  }

  async setBreakpoint(scriptId: string, lineNumber: number, columnNumber?: number): Promise<any> {
    if (!this.inspectorManager) {
      throw new Error('Inspector not initialized');
    }
    return this.inspectorManager.setBreakpoint(scriptId, lineNumber, columnNumber);
  }

  async evaluateExpression(expression: string): Promise<any> {
    if (!this.inspectorManager) {
      throw new Error('Inspector not initialized');
    }
    return this.inspectorManager.evaluateExpression(expression);
  }
}