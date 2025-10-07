import { defineConfig } from 'tsup';

export default defineConfig([
  // SDK build
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    outDir: 'dist',
    clean: true,
  },
  // CLI build
  {
    entry: { cli: 'src/cli/index.ts' },
    format: ['esm'],
    dts: true,
    outDir: 'dist',
    clean: false,
    external: [
      'tsx',
      'commander',
      'fastify',
      'node-cron',
      'chokidar',
      'pino-pretty',
      'node-fetch',
      'open',
      'inquirer',
    ],
    noExternal: [],
  },
]);
