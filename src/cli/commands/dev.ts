import chokidar from "chokidar";
import { DevModeOrchestrator } from "../runtime/DevModeOrchestrator";
import { loadProjectConfig, hasProjectConfig } from "../config/projectConfig";
import { logger } from "../utils/logger";

interface DevOptions {
  port: string;
  host: string;
  debug?: boolean;
  debugPort?: string;
}

/**
 * Dev Mode Command - Run workflow locally with hot-reload
 *
 * Flow (as documented in architecture.md):
 *
 * Init:
 * 1. Check that workflow exists
 *
 * Execution:
 * 2. Fetch available providers in namespace
 * 3. Initialize userspace with provider configs and execute
 * 4. Verify that all used providers are set up (prompt user if not)
 * 5. Setup event routing to userspace (websocket + local events)
 *
 * Reload Cycles:
 * - Code change: Re-execute from step 3
 * - Provider setup: Re-execute from step 1
 *
 * The DevModeOrchestrator handles this entire flow internally.
 */
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
    logger.console.warn(
      "   The Node.js Inspector protocol is not available in Bun runtime."
    );
    logger.console.warn(
      "   For debugging support, please use Node.js or tsx instead:"
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

  console.log(`🚀 Development Mode${debugMode ? " (Debug Enabled)" : ""}`);
  console.log(`📂 Watching: ${entrypoint}`);
  if (debugMode) {
    console.log(`🐛 Debug mode enabled on port ${debugPort}`);
    logger.debugInfo(`   • Enhanced error reporting`);
    logger.debugInfo(`   • Source map support`);
    logger.debugInfo(`   • Debug utilities available in user code`);
  }

  // Create orchestrator
  const orchestrator = new DevModeOrchestrator({
    entrypoint,
    port,
    host,
    debugMode,
    debugPort,
  });

  // Start dev mode
  try {
    await orchestrator.start();
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
        await orchestrator.handleReload();
      });
      console.log("✅ Reloaded successfully");
    } catch (error) {
      logger.error("Failed to reload:", error);
    }
  });

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    await watcher.close();
    await orchestrator.stop();
    process.exit(0);
  });
}
