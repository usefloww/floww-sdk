import { defineConfig } from 'tsup';

export default defineConfig([
  // SDK build
  {
    entry: ['index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    outDir: 'dist',
    clean: true,
    tsconfig: './tsconfig.json',
    noExternal: ['@floww/api-contract'],
  },
  // CLI build
  {
    entry: { cli: 'cli/index.ts' },
    format: ['esm'],
    dts: true,
    outDir: 'dist',
    clean: false,
    tsconfig: './tsconfig.json',
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
    noExternal: ['@floww/api-contract'],
  },
  // AI module build
  {
    entry: ['ai/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    outDir: 'dist/ai',
    clean: false,
    tsconfig: './tsconfig.json',
  },
  // Runtime module build
  {
    entry: ['runtime/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    outDir: 'dist/runtime',
    clean: false,
    tsconfig: './tsconfig.json',
  },
  // KV module build
  {
    entry: ['kv/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    outDir: 'dist/kv',
    clean: false,
    tsconfig: './tsconfig.json',
  },
  // Providers module build
  {
    entry: ['providers/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    outDir: 'dist/providers',
    clean: false,
    tsconfig: './tsconfig.json',
  },
  // Providers server module build
  {
    entry: ['providers/server/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    outDir: 'dist/providers/server',
    clean: false,
    tsconfig: './tsconfig.json',
  },
  // Providers constants module build
  {
    entry: ['providers/constants/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    outDir: 'dist/providers/constants',
    clean: false,
    tsconfig: './tsconfig.json',
  },
  // Code execution module build
  {
    entry: ['codeExecution/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    outDir: 'dist/codeExecution',
    clean: false,
    tsconfig: './tsconfig.json',
  },
  // Policies module build
  {
    entry: ['policies/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    outDir: 'dist/policies',
    clean: false,
    tsconfig: './tsconfig.json',
  },
  // Testing module build
  {
    entry: ['testing/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    outDir: 'dist/testing',
    clean: false,
    tsconfig: './tsconfig.json',
  },
]);
