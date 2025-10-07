import * as vm from "vm";
import ts from "typescript";
import { createRequire } from "module";
import { VirtualFileSystem } from "./VirtualFileSystem";

export class ModuleSystem {
  private moduleCache = new Map<string, any>();
  private vfs: VirtualFileSystem;

  constructor(vfs: VirtualFileSystem) {
    this.vfs = vfs;
  }

  createRequire(fromFile: string) {
    return (specifier: string) => {
      if (!specifier.startsWith(".") && !specifier.startsWith("/")) {
        try {
          // Try to load as external module
          const req = createRequire(process.cwd() + '/package.json');
          return req(specifier);
        } catch (e) {
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

    const transpiledCode = this.transpile(source, filePath);

    const moduleExports = {};
    const moduleObject = { exports: moduleExports };

    const context = {
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

    try {
      const script = new vm.Script(transpiledCode, {
        filename: filePath,
        lineOffset: 0,
        columnOffset: 0,
      });

      script.runInNewContext(context);

      const result = moduleObject.exports;
      this.moduleCache.set(filePath, result);
      return result;
    } catch (error) {
      console.error(`Error executing module ${filePath}:`, error);
      throw error;
    }
  }

  private transpile(source: string, _filename: string): string {
    const result = ts.transpile(source, {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      strict: false,
    });

    return result;
  }
}
