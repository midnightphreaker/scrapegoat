/**
 * Tests for deprecation warnings in fetcher options
 *
 * These tests verify that deprecated options trigger appropriate warnings
 * and guide users to the new API.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "../../../utils/logger";
import { AutoDetectFetcher } from "../AutoDetectFetcher";
import { Crawl4AIFetcher } from "../crawl4ai/Crawl4AIFetcher";

// Mock the logger to capture warnings
vi.mock("../../../utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Deprecation Warnings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AutoDetectFetcher", () => {
    it("should warn when useCrawl4AI is true", async () => {
      const fetcher = new AutoDetectFetcher();
      const warnSpy = vi.spyOn(logger, "warn");

      // This should trigger a deprecation warning
      try {
        await fetcher.fetch("https://example.com", {
          useCrawl4AI: true,
        });
      } catch (_error) {
        // Expected to fail since Crawl4AI service might not be running
      }

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("useCrawl4AI option is deprecated"),
      );
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('fetcher="crawl4ai"'));
    });

    it("should warn when fetcher='browser' is used", async () => {
      const fetcher = new AutoDetectFetcher();
      const warnSpy = vi.spyOn(logger, "warn");

      // This should trigger a deprecation warning
      try {
        await fetcher.fetch("https://example.com", {
          fetcher: "browser" as any,
        });
      } catch (_error) {
        // Expected to fail since Crawl4AI service might not be running
      }

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('fetcher="browser" is deprecated'),
      );
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('fetcher="crawl4ai"'));
    });

    it("should NOT warn when using fetcher='crawl4ai'", async () => {
      const fetcher = new AutoDetectFetcher();
      const warnSpy = vi.spyOn(logger, "warn");

      try {
        await fetcher.fetch("https://example.com", {
          fetcher: "crawl4ai",
        });
      } catch (_error) {
        // Expected to fail since Crawl4AI service might not be running
      }

      // Should not warn about useCrawl4AI
      const useCrawl4AIWarnings = warnSpy.mock.calls.filter((call) =>
        call[0]?.toString().includes("useCrawl4AI"),
      );
      expect(useCrawl4AIWarnings.length).toBe(0);
    });
  });

  describe("Crawl4AIFetcher", () => {
    it("should warn when stealthMode is used", async () => {
      const fetcher = new Crawl4AIFetcher();
      const warnSpy = vi.spyOn(logger, "warn");

      // This should trigger a deprecation warning
      try {
        await fetcher.fetch("https://example.com", {
          crawl4ai: {
            stealthMode: "advanced",
          },
        });
      } catch (_error) {
        // Expected to fail since Crawl4AI service might not be running
      }

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("stealthMode option is deprecated"),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("browser.enableStealth"),
      );
    });

    it("should NOT warn when using browser.enableStealth", async () => {
      const fetcher = new Crawl4AIFetcher();
      const warnSpy = vi.spyOn(logger, "warn");

      try {
        await fetcher.fetch("https://example.com", {
          crawl4ai: {
            browserType: "chromium",
            browser: {
              enableStealth: true,
            },
          },
        });
      } catch (_error) {
        // Expected to fail since Crawl4AI service might not be running
      }

      // Should not warn about stealthMode
      const stealthModeWarnings = warnSpy.mock.calls.filter((call) =>
        call[0]?.toString().includes("stealthMode"),
      );
      expect(stealthModeWarnings.length).toBe(0);
    });
  });

  describe("Migration guidance", () => {
    it("should provide clear migration examples in warnings", async () => {
      const fetcher = new AutoDetectFetcher();
      const warnSpy = vi.spyOn(logger, "warn");

      try {
        await fetcher.fetch("https://example.com", {
          useCrawl4AI: true,
        });
      } catch (_error) {
        // Expected to fail
      }

      const warning = warnSpy.mock.calls.find((call) =>
        call[0]?.toString().includes("useCrawl4AI"),
      );

      expect(warning?.[0]).toMatch(/Example:/);
      expect(warning?.[0]).toMatch(/fetcher.*crawl4ai/);
    });
  });
});
