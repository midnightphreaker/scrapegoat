/**
 * Tests for web server host binding.
 *
 * Validates that startWebServer uses the configured host value
 * (config.server.host) instead of a hardcoded default.
 */

import { describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../utils/config";
import { DEFAULT_CONFIG } from "../utils/config";

// Capture the listen args from the mock server
let capturedListenArgs: { port: number; host: string } | undefined;

// Create a mock server that tracks listen arguments
function createMockServer() {
  capturedListenArgs = undefined;
  return {
    register: vi.fn(async () => {}),
    listen: vi.fn(async (opts: { port: number; host: string }) => {
      capturedListenArgs = opts;
      return `http://${opts.host}:${opts.port}`;
    }),
    close: vi.fn(async () => {}),
    addresses: vi.fn(() => []),
  };
}

// Mock fastify to return our instrumented server
const mockServer = createMockServer();
vi.mock("fastify", () => ({
  default: vi.fn(() => mockServer),
}));

// Mock all route modules and heavy dependencies
vi.mock("./routes/index", () => ({
  registerIndexRoute: vi.fn(),
}));
vi.mock("./routes/jobs/cancel", () => ({
  registerCancelJobRoute: vi.fn(),
}));
vi.mock("./routes/jobs/clear-completed", () => ({
  registerClearCompletedJobsRoute: vi.fn(),
}));
vi.mock("./routes/jobs/list", () => ({
  registerJobListRoutes: vi.fn(),
}));
vi.mock("./routes/jobs/new", () => ({
  registerNewJobRoutes: vi.fn(),
}));
vi.mock("./routes/jobs/source-selection", () => ({
  registerSourceSelectionRoute: vi.fn(),
}));
vi.mock("./routes/libraries/detail", () => ({
  registerLibraryDetailRoutes: vi.fn(),
}));
vi.mock("./routes/libraries/list", () => ({
  registerLibrariesRoutes: vi.fn(),
}));
vi.mock("./routes/upload/index", () => ({
  registerUploadRoutes: vi.fn(),
}));
vi.mock("./routes/health", () => ({
  registerHealthRoute: vi.fn(),
}));
vi.mock("@fastify/static", () => ({
  default: vi.fn(async (_instance: unknown, _opts: unknown, done: () => void) => done()),
}));
vi.mock("@fastify/formbody", () => ({
  default: vi.fn(async (_instance: unknown, _opts: unknown, done: () => void) => done()),
}));

import { startWebServer } from "./web";

/** Creates a minimal AppConfig with overridden values. */
function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
  } as AppConfig;
}

describe("startWebServer host binding", () => {
  it("should pass the configured host to server.listen", async () => {
    const expectedHost = "192.168.1.100";
    const config = createTestConfig({
      server: {
        ...DEFAULT_CONFIG.server,
        host: expectedHost,
      },
    });

    const docServiceStub = {} as never;
    const pipelineManagerStub = {} as never;

    await startWebServer(0, docServiceStub, pipelineManagerStub, config);

    expect(capturedListenArgs).toBeDefined();
    expect(capturedListenArgs?.host).toBe(expectedHost);
  });

  it("should use default host from config when no override is set", async () => {
    const config = createTestConfig(); // default config has host: "127.0.0.1"

    const docServiceStub = {} as never;
    const pipelineManagerStub = {} as never;

    await startWebServer(0, docServiceStub, pipelineManagerStub, config);

    expect(capturedListenArgs).toBeDefined();
    expect(capturedListenArgs?.host).toBe("127.0.0.1");
  });
});
