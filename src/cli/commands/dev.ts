import chokidar from "chokidar";
import { FlowEngine, EngineLoadResult } from "../runtime/engine";
import { loadProjectConfig, hasProjectConfig } from "../config/projectConfig";
import path from "path";
import { logger } from "../utils/logger";
import { checkProviderAvailability } from "../providers/availability";
import { setupUnavailableProviders } from "../providers/setup";

interface DevOptions {
  port: string;
  host: string;
  debug?: boolean;
  debugPort?: string;
}

export async function devCommand(
  file: string | undefined,
  options: DevOptions
) {
  const port = parseInt(options.port);
  const host = options.host;
  let debugMode = options.debug || false;
  let debugPort = options.debugPort ? parseInt(options.debugPort) : 9229;

  // Check if running with Bun and warn about debugging limitations
  if (debugMode && process.versions.bun) {
    logger.warn(
      "WARNING: Debugging features are not supported when running with Bun."
    );
    logger.plain.warn(
      "   The Node.js Inspector protocol is not available in Bun runtime."
    );
    logger.plain.warn(
      "   For debugging support, please use Node.js or tsx instead:"
    );
    logger.plain.warn("     node dist/cli.js dev --debug");
    logger.plain.warn("     # or");
    logger.plain.warn("     tsx src/cli/index.ts dev --debug");
    logger.plain.warn("   Continuing in normal mode without debugging...");

    // Disable debug mode when running with Bun
    debugMode = false;
    debugPort = 9229;
  }

  // Determine the file to use
  let entrypoint: string;
  if (file) {
    entrypoint = file;
  } else if (hasProjectConfig()) {
    const config = loadProjectConfig();
    entrypoint = config.entrypoint || "main.ts";
  } else {
    entrypoint = "main.ts";
  }

  // Resolve to absolute path

  logger.info(`Development Mode${debugMode ? " (Debug Enabled)" : ""}`);
  logger.plain(`📂 Watching: ${entrypoint}`);
  if (debugMode) {
    logger.plain(`🐛 Debug mode enabled on port ${debugPort}`);
    logger.plain(`   • Enhanced error reporting`);
    logger.plain(`   • Source map support`);
    logger.plain(`   • Debug utilities available in user code`);
  }

  const engine = new FlowEngine(port, host, debugMode, debugPort);

  // Load triggers and providers
  let loadResult: EngineLoadResult;
  try {
    await logger.task("Loading triggers", async () => {
      loadResult = await engine.load(entrypoint);
    });
  } catch (error) {
    logger.error("Failed to load:", error);
    process.exit(1);
  }

  // Check and setup providers after loading
  try {
    await logger.task("Checking providers", async () => {
      const usedProviders = loadResult.providers.map((p: any) => ({
        type: p.provider,
        alias: p.alias === "default" ? undefined : p.alias,
      }));

      if (usedProviders.length === 0) {
        console.log("✅ No providers used - nothing to configure");
        return;
      }

      console.log(`📋 Found ${usedProviders.length} used provider(s):`);
      usedProviders.forEach((p: any) => {
        console.log(`  • ${p.type}${p.alias ? ` (alias: ${p.alias})` : ""}`);
      });

      const availability = await checkProviderAvailability(usedProviders);

      if (availability && availability.available && availability.available.length > 0) {
        console.log(
          `✅ ${availability.available.length} provider(s) already configured`
        );
      }

      if (availability && availability.unavailable && availability.unavailable.length > 0) {
        console.log(
          `⚠️ ${availability.unavailable.length} provider(s) need configuration`
        );
        await setupUnavailableProviders(availability.unavailable);
      } else {
        console.log("🎉 All providers are already configured!");
      }
    });
  } catch (error) {
    logger.error("Provider setup failed:", error);
    process.exit(1);
  }

  // Start the engine
  try {
    await logger.task("Starting Flow Engine", async () => {
      await engine.start();
    });
  } catch (error) {
    logger.error("Failed to start:", error);
    process.exit(1);
  }

  // Watch for file changes
  const watcher = chokidar.watch(entrypoint, {
    persistent: true,
    ignoreInitial: true,
  });

  watcher.on("change", async (path) => {
    logger.info(`File changed: ${path}`);
    try {
      await logger.task("Reloading triggers", async () => {
        await engine.reload(entrypoint);
      });
    } catch (error) {
      logger.error("Failed to reload:", error);
    }
  });

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    await watcher.close();
    await engine.stop();
    process.exit(0);
  });
}
