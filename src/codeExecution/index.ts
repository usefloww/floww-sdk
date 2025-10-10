import { VirtualFileSystem } from "./VirtualFileSystem";
import { ModuleSystem } from "./ModuleSystem";
import path from "path";
import { pathToFileURL } from "url";
import fs from 'fs/promises'


export interface ExecuteUserProjectOptions {
  files: Record<string, string>;
  entryPoint: string;
}

async function walkDirectory(
  dir: string,
  baseDir: string,
  excludeDirs: string[],
  filesMap: Record<string, string>
): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    // Skip excluded directories
    if (entry.isDirectory() && excludeDirs.includes(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (entry.isSymbolicLink()) {
      // Skip symlinks to avoid infinite loops
      continue;
    } else if (entry.isDirectory()) {
      // Recursively walk subdirectories
      await walkDirectory(fullPath, baseDir, excludeDirs, filesMap);
    } else if (entry.isFile()) {
      // Read file contents
      const fileContent = await fs.readFile(fullPath, 'utf8');
      filesMap[relativePath] = fileContent;
    }
  }
}

export async function getUserProject(
  filePath: string,
  entryPoint: string
): Promise<ExecuteUserProjectOptions> {

  const filesMap: Record<string, string> = {};

  // Directories to exclude
  const excludeDirs = ['node_modules', '.git', 'dist', 'build', '.next'];

  // Walk directory tree, excluding specified directories and symlinks
  await walkDirectory(process.cwd(), process.cwd(), excludeDirs, filesMap);

  return {
    files: filesMap,
    entryPoint: `${filePath.replace('.ts', '')}.${entryPoint}`,
  };
}

export async function executeUserProject(
  options: ExecuteUserProjectOptions
): Promise<any> {
  const { files, entryPoint } = options;

  const vfs = new VirtualFileSystem(files);
  const moduleSystem = new ModuleSystem(vfs);

  try {
    const [fileAndExport, exportName] = entryPoint.includes(".")
      ? entryPoint.split(".", 2)
      : [entryPoint, "default"];

    // Try to find the file with extensions
    let filePath = fileAndExport;
    if (!vfs.exists(filePath)) {
      const extensions = [".ts", ".js"];
      for (const ext of extensions) {
        if (vfs.exists(filePath + ext)) {
          filePath = filePath + ext;
          break;
        }
      }
    }

    console.log('filePath', filePath);
    const module = moduleSystem.loadModule(filePath);

    if (exportName && exportName !== "default") {
      const exportedFunction = module[exportName];
      if (typeof exportedFunction === "function") {
        return await exportedFunction();
      }
      return exportedFunction;
    }

    if (typeof module === "function") {
      return await module();
    } else if (module.handler && typeof module.handler === "function") {
      return await module.handler();
    } else if (module.default && typeof module.default === "function") {
      return await module.default();
    }

    return module;
  } catch (error) {
    console.error("User code execution failed:", error);
    throw error;
  }
}

export { VirtualFileSystem } from "./VirtualFileSystem";
export { ModuleSystem } from "./ModuleSystem";
