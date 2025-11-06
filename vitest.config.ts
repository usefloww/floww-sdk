import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 30000, // 30 seconds for E2E tests
    hookTimeout: 30000, // 30 seconds for setup/teardown
    // setupFiles: ["./tests/setup.ts"], // Global test setup (MSW, mocks)
  },
});
