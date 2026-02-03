import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { logger } from "../../../utils/logger";
import { Crawl4AIFetcher } from "./Crawl4AIFetcher";

/**
 * Integration tests for Crawl4AIFetcher.
 *
 * These tests require the Crawl4AI Python service to be running.
 * Run with: npm test -- Crawl4AIFetcher.integration.test.ts
 *
 * Prerequisites:
 * - Python service running at http://localhost:8001
 * - Service health endpoint responding
 */
describe("Crawl4AIFetcher Integration Tests", () => {
  let fetcher: Crawl4AIFetcher;
  let isServiceAvailable = false;

  beforeAll(async () => {
    fetcher = new Crawl4AIFetcher();

    // Check if service is available
    isServiceAvailable = await fetcher.isAvailable();

    if (!isServiceAvailable) {
      console.warn(
        "⚠️  Crawl4AI service not available. Integration tests will be skipped.",
      );
      console.warn(
        "   Start the service with: cd services/crawl4ai && docker-compose up",
      );
    }
  });

  afterAll(async () => {
    await fetcher.close();
  });

  it("should skip tests if service is not available", () => {
    if (!isServiceAvailable) {
      expect(isServiceAvailable).toBe(false);
    }
  });

  it("should fetch real webpage content", async () => {
    if (!isServiceAvailable) {
      logger.debug("Skipping - Crawl4AI service not available");
      return;
    }

    // Use a simple, reliable test URL
    const url = "https://example.com";
    const result = await fetcher.fetch(url);

    expect(result).toBeDefined();
    expect(result.mimeType).toBe("text/markdown");
    expect(result.content).toBeInstanceOf(Buffer);
    expect(result.content.length).toBeGreaterThan(0);

    const markdown = result.content.toString("utf-8");
    expect(markdown).toContain("Example Domain");
  }, 30000); // 30s timeout for real network request

  it("should handle redirects correctly", async () => {
    if (!isServiceAvailable) {
      logger.debug("Skipping - Crawl4AI service not available");
      return;
    }

    const url = "http://example.com"; // Should redirect to https
    const result = await fetcher.fetch(url);

    expect(result.source).toMatch(/^https:\/\//);
  }, 30000);

  it("should return circuit breaker state", () => {
    const state = fetcher.getCircuitState();

    expect(state).toHaveProperty("state");
    expect(state).toHaveProperty("failureCount");
    expect(state).toHaveProperty("lastFailureTime");
  });

  it("should respect timeout option", async () => {
    if (!isServiceAvailable) {
      logger.debug("Skipping - Crawl4AI service not available");
      return;
    }

    const url = "https://example.com";
    const result = await fetcher.fetch(url, { timeout: 60000 });

    expect(result).toBeDefined();
    expect(result.mimeType).toBe("text/markdown");
  }, 60000);

  it("should handle cancellation via AbortSignal", async () => {
    if (!isServiceAvailable) {
      logger.debug("Skipping - Crawl4AI service not available");
      return;
    }

    const controller = new AbortController();
    const url = "https://example.com";

    // Abort immediately
    setTimeout(() => controller.abort(), 100);

    await expect(fetcher.fetch(url, { signal: controller.signal })).rejects.toThrow(
      /cancelled/i,
    );
  }, 10000);
});
