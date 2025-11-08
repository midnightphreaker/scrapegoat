import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    // Define PostHog API key for telemetry - empty for tests
    __POSTHOG_API_KEY__: JSON.stringify(""),
  },
  test: {
    globals: true,
    environment: "node",
    testTimeout: 60000, // 60 seconds for E2E tests (scraping, embedding, etc.)
    hookTimeout: 60000, // 60 seconds for setup/teardown hooks
    include: ["test/**/*-e2e.test.ts"],
    exclude: ["node_modules/**/*"],
    // Load test environment variables
    env: {
      NODE_ENV: "test",
    },
    // Setup file for global test configuration
    setupFiles: ["./src/store/__tests__/setup.ts"],
    // Sequential execution for E2E tests to avoid conflicts
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true, // Run E2E tests sequentially
      },
    },
  },
});
