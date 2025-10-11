import chokidar from 'chokidar';
import { FlowEngine } from '../runtime/engine';
import { loadProjectConfig, hasProjectConfig } from '../config/projectConfig';
import path from 'path';

interface DevOptions {
  port: string;
  host: string;
  debug?: boolean;
  debugPort?: string;
}

export async function devCommand(file: string | undefined, options: DevOptions) {
  const port = parseInt(options.port);
  const host = options.host;
  let debugMode = options.debug || false;
  let debugPort = options.debugPort ? parseInt(options.debugPort) : 9229;

  // Check if running with Bun and warn about debugging limitations
  if (debugMode && process.versions.bun) {
    console.warn('⚠️  WARNING: Debugging features are not supported when running with Bun.');
    console.warn('   The Node.js Inspector protocol is not available in Bun runtime.');
    console.warn('   For debugging support, please use Node.js or tsx instead:');
    console.warn('     node dist/cli.js dev --debug');
    console.warn('     # or');
    console.warn('     tsx src/cli/index.ts dev --debug');
    console.warn('   Continuing in normal mode without debugging...\n');

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
    entrypoint = config.entrypoint || 'main.ts';
  } else {
    entrypoint = 'main.ts';
  }

  // Resolve to absolute path

  console.log(`\n🔧 Development Mode${debugMode ? ' (Debug Enabled)' : ''}`);
  console.log(`📂 Watching: ${entrypoint}`);
  if (debugMode) {
    console.log(`🐛 Debug mode enabled on port ${debugPort}`);
    console.log(`   • Enhanced error reporting`);
    console.log(`   • Source map support`);
    console.log(`   • Debug utilities available in user code`);
  }
  console.log();

  const engine = new FlowEngine(port, host, debugMode, debugPort);

  // Load and start triggers
  try {
    await engine.load(entrypoint);
    await engine.start();
  } catch (error) {
    console.error('Failed to start:', error);
    process.exit(1);
  }

  // Watch for file changes
  const watcher = chokidar.watch(entrypoint, {
    persistent: true,
    ignoreInitial: true,
  });

  watcher.on('change', async (path) => {
    console.log(`\n📝 File changed: ${path}`);
    try {
      await engine.reload(entrypoint);
    } catch (error) {
      console.error('Failed to reload:', error);
    }
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await watcher.close();
    await engine.stop();
    process.exit(0);
  });
}
