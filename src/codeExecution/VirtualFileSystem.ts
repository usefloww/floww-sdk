export class VirtualFileSystem {
  private files = new Map<string, string>();
  private resolveCache = new Map<string, string | null>();

  constructor(files: Record<string, string>) {
    Object.entries(files).forEach(([path, content]) => {
      this.files.set(path, content);
    });
  }

  readFile(path: string): string | undefined {
    const normalized = this.normalizePath(path);
    return this.files.get(normalized);
  }

  exists(path: string): boolean {
    return this.files.has(this.normalizePath(path));
  }

  private normalizePath(path: string): string {
    // Handle relative paths properly
    const parts = path.split("/");
    const resolved: string[] = [];

    for (const part of parts) {
      if (part === "." || part === "") {
        continue;
      } else if (part === "..") {
        resolved.pop();
      } else {
        resolved.push(part);
      }
    }

    return resolved.join("/");
  }

  resolveModule(specifier: string, fromFile: string): string | null {
    const cacheKey = `${fromFile}:${specifier}`;

    if (this.resolveCache.has(cacheKey)) {
      return this.resolveCache.get(cacheKey)!;
    }

    let resolved: string | null = null;

    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      const fromDir = fromFile.split("/").slice(0, -1).join("/");
      const combined = fromDir ? `${fromDir}/${specifier}` : specifier;
      resolved = this.normalizePath(combined);
    } else {
      resolved = this.normalizePath(specifier);
    }

    // Try exact match first
    if (this.exists(resolved)) {
      this.resolveCache.set(cacheKey, resolved);
      return resolved;
    }

    // Try with extensions
    const extensions = [".ts", ".js", ".json", "/index.ts", "/index.js"];
    for (const ext of extensions) {
      const withExt = resolved + ext;
      if (this.exists(withExt)) {
        resolved = withExt;
        this.resolveCache.set(cacheKey, resolved);
        return resolved;
      }
    }

    // Not found
    this.resolveCache.set(cacheKey, null);
    return null;
  }
}
