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
    esbuildOptions: (options) => {
      options.jsx = 'automatic';
      return options;
    },
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
      'react',
    ],
    noExternal: [],
  },
  // AI module build
  {
    entry: ['src/ai/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    outDir: 'dist/ai',
    clean: false,
  },
]);
