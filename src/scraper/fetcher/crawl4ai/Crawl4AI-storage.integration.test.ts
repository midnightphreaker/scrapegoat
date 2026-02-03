import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { logger } from "../../../utils/logger";
import { AutoDetectFetcher } from "../AutoDetectFetcher";
import { Crawl4AIFetcher } from "./Crawl4AIFetcher";

/**
 * Integration tests for Crawl4AI storage pipeline.
 *
 * Tests the complete flow:
 * 1. ScraperOptions.useCrawl4AI flag
 * 2. Flag propagation through WebScraperStrategy
 * 3. AutoDetectFetcher selection of Crawl4AIFetcher
 * 4. Content fetching and storage
 *
 * Prerequisites:
 * - Crawl4AI Python service running at http://localhost:8001
 * - Service health endpoint responding
 *
 * Run with:
 * npm test -- Crawl4AI-storage.integration.test.ts
 */
describe("Crawl4AI Storage Integration", () => {
  let fetcher: Crawl4AIFetcher;
  let autoDetectFetcher: AutoDetectFetcher;
  let isServiceAvailable = false;

  beforeAll(async () => {
    fetcher = new Crawl4AIFetcher();
    autoDetectFetcher = new AutoDetectFetcher();

    // Check if Crawl4AI service is available
    isServiceAvailable = await fetcher.isAvailable();

    if (!isServiceAvailable) {
      console.warn(
        "⚠️  Crawl4AI service not available. Integration tests will be skipped.",
      );
      console.warn("   Start the service with: docker-compose up -d crawl4ai");
    }
  });

  afterAll(async () => {
    await fetcher.close();
    await autoDetectFetcher.close();
  });

  describe("Feature Flag Integration", () => {
    it("should skip tests if service is not available", () => {
      if (!isServiceAvailable) {
        expect(isServiceAvailable).toBe(false);
      }
    });

    it("should select Crawl4AIFetcher when useCrawl4AI flag is true", async () => {
      if (!isServiceAvailable) {
        logger.debug("Skipping - Crawl4AI service not available");
        return;
      }

      const url = "https://example.com";

      // Fetch with useCrawl4AI flag enabled
      const result = await autoDetectFetcher.fetch(url, {
        useCrawl4AI: true,
      });

      // Verify Crawl4AI was used (returns markdown)
      expect(result).toBeDefined();
      expect(result.mimeType).toBe("text/markdown");
      expect(result.content).toBeInstanceOf(Buffer);

      const markdown = result.content.toString("utf-8");
      expect(markdown.length).toBeGreaterThan(0);
      expect(markdown).toContain("Example Domain");
    }, 30000);

    it("should use standard fetcher when useCrawl4AI flag is false", async () => {
      const url = "https://example.com";

      // Fetch without useCrawl4AI flag (standard HTTP)
      const result = await autoDetectFetcher.fetch(url, {
        useCrawl4AI: false,
      });

      // Standard HTTP fetcher returns HTML, not markdown
      expect(result).toBeDefined();
      expect(result.mimeType).toBe("text/html");
    }, 10000);

    it("should use standard fetcher when useCrawl4AI flag is omitted", async () => {
      const url = "https://example.com";

      // Fetch without flag (defaults to standard)
      const result = await autoDetectFetcher.fetch(url);

      // Standard HTTP fetcher returns HTML, not markdown
      expect(result).toBeDefined();
      expect(result.mimeType).toBe("text/html");
    }, 10000);
  });

  describe("Content Quality", () => {
    it("should return BM25-filtered markdown from Crawl4AI", async () => {
      if (!isServiceAvailable) {
        logger.debug("Skipping - Crawl4AI service not available");
        return;
      }

      const url = "https://example.com";

      const result = await autoDetectFetcher.fetch(url, {
        useCrawl4AI: true,
      });

      const markdown = result.content.toString("utf-8");

      // BM25-filtered markdown should be cleaner (no script tags, etc.)
      expect(markdown).not.toContain("<script");
      expect(markdown).not.toContain("<style");

      // Should contain actual content
      expect(markdown).toContain("Example Domain");
    }, 30000);

    it("should handle redirects correctly with Crawl4AI", async () => {
      if (!isServiceAvailable) {
        logger.debug("Skipping - Crawl4AI service not available");
        return;
      }

      const url = "http://example.com"; // HTTP may redirect to HTTPS

      const result = await autoDetectFetcher.fetch(url, {
        useCrawl4AI: true,
      });

      // Should return a valid URL (may or may not follow redirect depending on service config)
      expect(result.source).toMatch(/^https?:\/\//);
      expect(result.mimeType).toBe("text/markdown");
    }, 30000);
  });

  describe("Error Handling", () => {
    it("should handle invalid URLs gracefully", async () => {
      if (!isServiceAvailable) {
        logger.debug("Skipping - Crawl4AI service not available");
        return;
      }

      const invalidUrl = "https://this-domain-does-not-exist-12345.com";

      await expect(
        autoDetectFetcher.fetch(invalidUrl, {
          useCrawl4AI: true,
        }),
      ).rejects.toThrow();
    }, 30000);

    it("should handle cancellation via AbortSignal", async () => {
      if (!isServiceAvailable) {
        logger.debug("Skipping - Crawl4AI service not available");
        return;
      }

      const url = "https://example.com";
      const controller = new AbortController();

      // Cancel immediately
      controller.abort();

      await expect(
        autoDetectFetcher.fetch(url, {
          useCrawl4AI: true,
          signal: controller.signal,
        }),
      ).rejects.toThrow();
    }, 10000);
  });

  describe("Resource Management", () => {
    it("should cleanup Crawl4AI resources on close", async () => {
      const tempFetcher = new AutoDetectFetcher();

      // Cleanup should not throw
      await expect(tempFetcher.close()).resolves.toBeUndefined();
    });

    it("should include Crawl4AI in canFetch check", () => {
      expect(autoDetectFetcher.canFetch("https://example.com")).toBe(true);
      expect(autoDetectFetcher.canFetch("http://example.com")).toBe(true);
      expect(autoDetectFetcher.canFetch("file:///path/to/file")).toBe(true);
    });
  });

  describe("Performance Characteristics", () => {
    it("should complete Crawl4AI fetch within timeout", async () => {
      if (!isServiceAvailable) {
        logger.debug("Skipping - Crawl4AI service not available");
        return;
      }

      const url = "https://example.com";
      const startTime = Date.now();

      await autoDetectFetcher.fetch(url, {
        useCrawl4AI: true,
        timeout: 30000,
      });

      const duration = Date.now() - startTime;

      // Should complete in reasonable time (< 30s)
      expect(duration).toBeLessThan(30000);

      // Note: Crawl4AI is typically slower than HTTP (2-5x)
      // This is expected and documented
      logger.debug(`Crawl4AI fetch completed in ${duration}ms`);
    }, 35000);
  });
});
