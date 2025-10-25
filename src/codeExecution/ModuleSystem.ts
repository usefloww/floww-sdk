import * as vm from "vm";
import ts from "typescript";
import { createRequire } from "module";
import { VirtualFileSystem } from "./VirtualFileSystem";
import { DebugContext } from "../cli/debug/debugContext";

export interface TranspileResult {
  code: string;
  sourceMap?: string;
}

export class ModuleSystem {
  private moduleCache = new Map<string, any>();
  private sourceMaps = new Map<string, any>();
  private vfs: VirtualFileSystem;
  private debugMode: boolean = false;
  private debugContext?: DebugContext;

  constructor(vfs: VirtualFileSystem, debugMode: boolean = false, debugContext?: DebugContext) {
    this.vfs = vfs;
    this.debugMode = debugMode;
    this.debugContext = debugContext;

    if (this.debugContext) {
      this.debugContext.setModuleSystem(this);
    }
  }

  createRequire(fromFile: string) {
    return (specifier: string) => {
      if (!specifier.startsWith(".") && !specifier.startsWith("/")) {
        try {
          // Try to load as external module
          const req = createRequire(process.cwd() + '/package.json');
          return req(specifier);
        } catch (e) {
          // Handle case-insensitive SDK package name
          if (specifier.toLowerCase() === '@developerflows/floww-sdk') {
            try {
              const req = createRequire(process.cwd() + '/package.json');
              return req('@DeveloperFlows/floww-sdk');
            } catch (e2) {
              // Fall through to VFS resolution
            }
          }
          // Not a built-in, try user modules
        }
      }

      const resolved = this.vfs.resolveModule(specifier, fromFile);
      if (!resolved) {
        throw new Error(
          `Cannot resolve module '${specifier}' from '${fromFile}'`
        );
      }

      return this.loadModule(resolved);
    };
  }

  loadModule(filePath: string): any {
    if (this.moduleCache.has(filePath)) {
      return this.moduleCache.get(filePath);
    }

    const source = this.vfs.readFile(filePath);
    if (!source) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Handle JSON files
    if (filePath.endsWith(".json")) {
      try {
        const parsed = JSON.parse(source);
        this.moduleCache.set(filePath, parsed);
        return parsed;
      } catch (error) {
        throw new Error(`Invalid JSON in ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    const transpileResult = this.transpile(source, filePath);
    let transpiledCode = transpileResult.code;

    // For inline source maps, extract and store them for debug context
    if (this.debugMode && this.debugContext) {
      // Try to extract source map from inline comment
      const sourceMapMatch = transpiledCode.match(/\/\/# sourceMappingURL=data:application\/json;base64,(.+)$/m);
      if (sourceMapMatch) {
        try {
          const sourceMapBase64 = sourceMapMatch[1];
          const sourceMapJson = Buffer.from(sourceMapBase64, 'base64').toString('utf8');
          const sourceMap = JSON.parse(sourceMapJson);

          // Store the extracted source map
          this.sourceMaps.set(filePath, sourceMap);
          this.debugContext.registerSourceMap(filePath, sourceMap);

          // Minimal debug logging
          // console.log(`✅ [DEBUG] Source map extracted for ${filePath}`);
        } catch (error) {
          console.warn(`❌ Failed to extract inline source map for ${filePath}:`, error);
        }
      }
    }

    const moduleExports = {};
    const moduleObject = { exports: moduleExports };

    // Import getProvider function from common
    let getProvider;
    try {
      const commonModule = require('../common');
      getProvider = commonModule.getProvider;
    } catch {
      // If common module doesn't exist, create a mock function
      getProvider = (type: string, alias?: string) => {
        console.warn(`getProvider called with ${type}${alias ? ` (${alias})` : ''} but provider system not available`);
        return {};
      };
    }

    const baseContext = {
      ...global,
      module: moduleObject,
      exports: moduleExports,
      require: this.createRequire(filePath),
      __filename: filePath,
      __dirname: filePath.split("/").slice(0, -1).join("/"),
      console,
      setTimeout,
      setInterval,
      Buffer,
      process,
    };

    // Use debugContext to enhance the VM context if available
    const context = this.debugContext
      ? this.debugContext.createVMContext(baseContext, filePath)
      : baseContext;

    try {
      // In debug mode, use the original file path for better debugger integration
      const scriptOptions = {
        filename: this.debugMode ? filePath : filePath,
        lineOffset: 0,
        columnOffset: 0,
        produceCachedData: false,
        // Enable enhanced debugging options if in debug mode
        ...(this.debugMode && {
          displayErrors: true,
          breakOnSigint: true
        })
      };

      // Remove noisy script creation logs
      // if (this.debugMode) {
      //   console.log(`🔧 [DEBUG] Creating script for ${filePath} with inline source maps`);
      // }

      const script = new vm.Script(transpiledCode, scriptOptions);

      script.runInNewContext(context);

      const result = moduleObject.exports;
      this.moduleCache.set(filePath, result);
      return result;
    } catch (error) {
      // Enhanced error reporting with debug context
      if (this.debugContext) {
        this.debugContext.reportError(error, {
          filePath,
          hasSourceMap: this.debugContext.hasSourceMap(filePath)
        });
      } else {
        console.error(`Error executing module ${filePath}:`, error);
      }
      throw error;
    }
  }

  private transpile(source: string, filename: string): TranspileResult {
    if (this.debugMode) {
      // For debugging: use inline source maps for better debugger compatibility
      const result = ts.transpileModule(source, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.CommonJS,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          strict: false,
          sourceMap: false,  // Disable external source map
          inlineSourceMap: true,  // Use inline source map
          inlineSources: true,    // Include source content
          sourceRoot: '',         // Use relative paths
        },
        fileName: filename
      });

      return {
        code: result.outputText,
        sourceMap: undefined  // Inline source map is embedded in code
      };
    } else {
      // Non-debug mode: no source maps
      const result = ts.transpile(source, {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: false,
      });

      return {
        code: result,
        sourceMap: undefined
      };
    }
  }

  // Helper methods for debugging
  getSourceMap(filePath: string): any {
    return this.sourceMaps.get(filePath);
  }

  hasSourceMap(filePath: string): boolean {
    return this.sourceMaps.has(filePath);
  }


}
