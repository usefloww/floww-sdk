import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 30000, // 30 seconds for E2E tests
    hookTimeout: 30000, // 30 seconds for setup/teardown
    globalSetup: ['./tests/setup/run-migrations.ts'], // Runs ONCE before all tests
    setupFiles: [
      './tests/setup/global-setup.ts', // MUST be first - creates test DB connection
      './tests/setup/db-mock.ts',       // MUST be second - mocks getDb() to use test DB
    ],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Run tests serially for transaction control
      },
    },
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      './e2e/**', // Exclude Playwright e2e tests (root e2e directory only)
      '**/.{idea,git,cache,output,temp}/**',
    ],
  },
  resolve: {
    alias: {
      // Map SDK subpath exports to source files so tests don't require a build
      'floww/providers/server': path.resolve(__dirname, './packages/sdk/providers/server/index.ts'),
      'floww/providers/constants': path.resolve(__dirname, './packages/sdk/providers/constants/index.ts'),
      'floww/providers': path.resolve(__dirname, './packages/sdk/providers/index.ts'),
      'floww/ai': path.resolve(__dirname, './packages/sdk/ai/index.ts'),
      'floww/runtime': path.resolve(__dirname, './packages/sdk/runtime/index.ts'),
      'floww/kv': path.resolve(__dirname, './packages/sdk/kv/index.ts'),
      'floww/codeExecution': path.resolve(__dirname, './packages/sdk/codeExecution/index.ts'),
      'floww/testing': path.resolve(__dirname, './packages/sdk/testing/index.ts'),
      'floww': path.resolve(__dirname, './packages/sdk/index.ts'),
      '@': path.resolve(__dirname, './src'),
      '~': path.resolve(__dirname, './'),
    },
  },
});
