import chokidar from 'chokidar';
import { FlowEngine } from '../runtime/engine';
import { loadProjectConfig, hasProjectConfig } from '../config/projectConfig';
import path from 'path';

interface DevOptions {
  port: string;
  host: string;
}

export async function devCommand(file: string | undefined, options: DevOptions) {
  const port = parseInt(options.port);
  const host = options.host;

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

  console.log(`\n🔧 Development Mode`);
  console.log(`📂 Watching: ${entrypoint}\n`);

  const engine = new FlowEngine(port, host);

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
