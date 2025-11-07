import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    // Define PostHog API key for telemetry - empty for tests
    __POSTHOG_API_KEY__: JSON.stringify(""),
  },
  test: {
    globals: true,
    environment: "node",
    testTimeout: 30000, // 30 seconds for database operations
    hookTimeout: 30000, // 30 seconds for setup/teardown hooks
    include: ["src/**/*.test.ts"],
    exclude: ["test/**/*", "node_modules/**/*"],
    // Load test environment variables
    env: {
      NODE_ENV: "test",
    },
    // Setup file for global test configuration
    setupFiles: ["./src/store/__tests__/setup.ts"],
    // Allow sequential execution for database tests to avoid conflicts
    // Can be changed to parallel once test isolation is verified
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: false, // Allow parallel execution
      },
    },
    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/types.ts",
        "**/__tests__/**",
        "**/node_modules/**",
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },
    },
  },
});
