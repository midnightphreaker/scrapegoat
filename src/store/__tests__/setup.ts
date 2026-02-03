/**
 * Global test setup file
 * Runs before all tests to configure the test environment
 */

import { resolve } from "node:path";
import { config } from "dotenv";

// Load test environment variables from .env.test
config({ path: resolve(process.cwd(), ".env.test") });

// Set test environment
process.env.NODE_ENV = "test";

// Disable telemetry in tests
process.env.TELEMETRY_ENABLED = "false";

// Set default test database URL if not provided
if (!process.env.TEST_DATABASE_URL) {
  process.env.TEST_DATABASE_URL =
    "postgresql://postgres:postgres@localhost:5433/postgres";
}

// Increase test timeout for slower machines
if (!process.env.TEST_TIMEOUT) {
  process.env.TEST_TIMEOUT = "30000";
}

// Test environment configuration is logged via the logger when LOG_LEVEL is set
// These console.log statements have been removed to use proper logging infrastructure
// Run tests with LOG_LEVEL=INFO to see test environment details
