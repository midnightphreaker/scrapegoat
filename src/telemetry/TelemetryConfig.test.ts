import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveStorePath } from "../utils/paths";
import {
  generateInstallationId,
  shouldEnableTelemetry,
  TelemetryConfig,
} from "./TelemetryConfig";

// Mock fs and path utilities
vi.mock("node:fs");
vi.mock("../utils/paths", () => ({
  resolveStorePath: vi.fn(() => "/mock/data/path"),
}));

describe("TelemetryConfig", () => {
  let originalArgv: string[];
  let originalEnv: NodeJS.ProcessEnv;
  let originalApiKey: string;

  beforeEach(() => {
    originalArgv = [...process.argv];
    originalEnv = { ...process.env };
    originalApiKey = (globalThis as Record<string, unknown>)
      .__POSTHOG_API_KEY__ as string;
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.env = originalEnv;
    (globalThis as Record<string, unknown>).__POSTHOG_API_KEY__ = originalApiKey;
  });

  it("should be enabled by default when API key is present", () => {
    (globalThis as Record<string, unknown>).__POSTHOG_API_KEY__ = "test-api-key";
    const config = TelemetryConfig.getInstance();
    config.setEnabled(true);
    expect(config.isEnabled()).toBe(true);
  });

  it("should be disabled when enabled flag is true but API key is missing", () => {
    (globalThis as Record<string, unknown>).__POSTHOG_API_KEY__ = "";
    const config = TelemetryConfig.getInstance();
    config.setEnabled(true);
    expect(config.isEnabled()).toBe(false);
  });

  it("should be disabled when enabled flag is false regardless of API key", () => {
    (globalThis as Record<string, unknown>).__POSTHOG_API_KEY__ = "test-api-key";
    const config = TelemetryConfig.getInstance();
    config.setEnabled(false);
    expect(config.isEnabled()).toBe(false);
  });

  it("should be enabled when enabled flag is true and API key is present", () => {
    (globalThis as Record<string, unknown>).__POSTHOG_API_KEY__ = "valid-api-key";
    const config = TelemetryConfig.getInstance();
    config.setEnabled(true);
    expect(config.isEnabled()).toBe(true);
  });

  it("should allow runtime enable/disable", () => {
    (globalThis as Record<string, unknown>).__POSTHOG_API_KEY__ = "test-api-key";
    const config = TelemetryConfig.getInstance();
    config.setEnabled(false);
    expect(config.isEnabled()).toBe(false);

    config.setEnabled(true);
    expect(config.isEnabled()).toBe(true);
  });
});

describe("generateInstallationId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should generate new UUID when file does not exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});
    vi.mocked(fs.mkdirSync).mockImplementation(() => "");

    const id = generateInstallationId();

    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(fs.mkdirSync).toHaveBeenCalledWith("/mock/data/path", { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join("/mock/data/path", "installation.id"),
      id,
      "utf8",
    );
  });

  it("should read existing UUID from file", () => {
    const existingId = "12345678-1234-4567-8901-123456789012";
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(existingId);

    const id = generateInstallationId();

    expect(id).toBe(existingId);
    expect(fs.readFileSync).toHaveBeenCalledWith(
      path.join("/mock/data/path", "installation.id"),
      "utf8",
    );
  });

  it("should use custom store path when provided", async () => {
    const customPath = "/custom/store/path";

    // Mock resolveStorePath to return the custom path
    vi.mocked(resolveStorePath).mockReturnValueOnce(customPath);

    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});
    vi.mocked(fs.mkdirSync).mockImplementation(() => "");

    const id = generateInstallationId(customPath);

    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(fs.mkdirSync).toHaveBeenCalledWith(customPath, { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join(customPath, "installation.id"),
      id,
      "utf8",
    );
  });
});

describe("shouldEnableTelemetry", () => {
  let originalArgv: string[];
  let originalEnv: NodeJS.ProcessEnv;
  let originalApiKey: string;

  beforeEach(() => {
    originalArgv = [...process.argv];
    originalEnv = { ...process.env };
    originalApiKey = (globalThis as Record<string, unknown>)
      .__POSTHOG_API_KEY__ as string;
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.env = originalEnv;
    (globalThis as Record<string, unknown>).__POSTHOG_API_KEY__ = originalApiKey;
  });

  it("should return true when telemetry is enabled and API key is present", () => {
    delete process.env.SCRAPEGOAT_TELEMETRY;
    process.argv = ["node", "script.js"];
    (globalThis as Record<string, unknown>).__POSTHOG_API_KEY__ = "test-api-key";

    const result = shouldEnableTelemetry();
    expect(result).toBe(true);
  });

  it("should return false when API key is missing", () => {
    delete process.env.SCRAPEGOAT_TELEMETRY;
    process.argv = ["node", "script.js"];
    (globalThis as Record<string, unknown>).__POSTHOG_API_KEY__ = "";

    const result = shouldEnableTelemetry();
    expect(result).toBe(false);
  });
});
