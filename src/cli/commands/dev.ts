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
  options: DevOptions,
) {
  const port = parseInt(options.port);
  const host = options.host;
  let debugMode = options.debug || false;
  let debugPort = options.debugPort ? parseInt(options.debugPort) : 9229;

  // Check if running with Bun and warn about debugging limitations
  if (debugMode && process.versions.bun) {
    logger.warn(
      "WARNING: Debugging features are not supported when running with Bun.",
    );
    logger.console.warn(
      "   The Node.js Inspector protocol is not available in Bun runtime.",
    );
    logger.console.warn(
      "   For debugging support, please use Node.js or tsx instead:",
    );
    logger.console.warn("     node dist/cli.js dev --debug");
    logger.console.warn("     # or");
    logger.console.warn("     tsx src/cli/index.ts dev --debug");
    logger.console.warn("   Continuing in normal mode without debugging...");

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

  console.log(`🚀 Development Mode${debugMode ? " (Debug Enabled)" : ""}`);
  console.log(`📂 Watching: ${entrypoint}`);
  if (debugMode) {
    console.log(`🐛 Debug mode enabled on port ${debugPort}`);
    logger.debugInfo(`   • Enhanced error reporting`);
    logger.debugInfo(`   • Source map support`);
    logger.debugInfo(`   • Debug utilities available in user code`);
  }

  const engine = new FlowEngine(port, host, debugMode, debugPort);

  // Load triggers and providers
  let loadResult: EngineLoadResult;
  try {
    loadResult = await logger.debugTask("Loading triggers", async () => {
      return await engine.load(entrypoint);
    });
  } catch (error) {
    logger.error("Failed to load:", error);
    process.exit(1);
  }

  // Check and setup providers after loading
  try {
    const usedProviders = loadResult.providers.map((p: any) => ({
      type: p.provider,
      alias: p.alias === "default" ? undefined : p.alias,
    }));

    if (usedProviders.length === 0) {
      logger.debugInfo("No providers used - nothing to configure");
    } else {
      logger.debugInfo(
        `Found ${usedProviders.length} used provider(s):`,
        usedProviders,
      );

      const availability = await checkProviderAvailability(usedProviders);

      if (
        availability &&
        availability.available &&
        availability.available.length > 0
      ) {
        logger.debugInfo(
          `${availability.available.length} provider(s) already configured`,
        );
      }

      if (
        availability &&
        availability.unavailable &&
        availability.unavailable.length > 0
      ) {
        console.log(
          `⚠️  ${availability.unavailable.length} provider(s) need configuration`,
        );
        await setupUnavailableProviders(availability.unavailable);
      } else {
        logger.debugInfo("All providers are already configured!");
      }
    }
  } catch (error) {
    logger.error("Provider setup failed:", error);
    process.exit(1);
  }

  // Start the engine
  try {
    await logger.debugTask("Starting Flow Engine", async () => {
      await engine.start();
    });
    // Show user-friendly message when ready
    console.log("🚀 Development server is ready!");
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
    console.log(); // Add line above file change for visual separation
    console.log(`🔄 File changed: ${path}`);
    try {
      await logger.debugTask("Reloading triggers", async () => {
        await engine.reload(entrypoint);
      });
      console.log("✅ Reloaded successfully");
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
