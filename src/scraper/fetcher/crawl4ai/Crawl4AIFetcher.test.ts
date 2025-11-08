import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScraperError } from "../../../utils/errors";
import { Crawl4AIClient } from "./Crawl4AIClient";
import { Crawl4AIFetcher } from "./Crawl4AIFetcher";
import type { Crawl4AIResponse } from "./types";

// Mock Crawl4AIClient
vi.mock("./Crawl4AIClient");

describe("Crawl4AIFetcher", () => {
  let fetcher: Crawl4AIFetcher;
  let mockClient: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock client
    mockClient = {
      isAvailable: vi.fn(),
      crawl: vi.fn(),
      getCircuitState: vi.fn(),
    };

    // Mock constructor to return our mock client
    vi.mocked(Crawl4AIClient).mockImplementation(() => mockClient);

    fetcher = new Crawl4AIFetcher();
  });

  afterEach(async () => {
    await fetcher.close();
  });

  describe("canFetch", () => {
    it("should return true for HTTP URLs", () => {
      expect(fetcher.canFetch("http://example.com")).toBe(true);
    });

    it("should return true for HTTPS URLs", () => {
      expect(fetcher.canFetch("https://example.com")).toBe(true);
    });

    it("should return false for file URLs", () => {
      expect(fetcher.canFetch("file:///path/to/file")).toBe(false);
    });

    it("should return false for other protocols", () => {
      expect(fetcher.canFetch("ftp://example.com")).toBe(false);
    });
  });

  describe("fetch", () => {
    it("should fetch content successfully", async () => {
      // Setup mocks
      mockClient.isAvailable.mockResolvedValue(true);
      mockClient.crawl.mockResolvedValue({
        success: true,
        data: {
          markdown: "# Test Content",
          fitMarkdown: "# Test Content (filtered)",
          metadata: {
            url: "https://example.com",
            statusCode: 200,
            title: "Test Page",
            crawlTime: 1.5,
          },
        },
      } as Crawl4AIResponse);

      const result = await fetcher.fetch("https://example.com");

      expect(result).toEqual({
        content: Buffer.from("# Test Content (filtered)", "utf-8"),
        mimeType: "text/markdown",
        charset: "utf-8",
        encoding: undefined,
        source: "https://example.com",
      });

      expect(mockClient.isAvailable).toHaveBeenCalled();
      expect(mockClient.crawl).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://example.com",
        }),
        expect.any(Object),
      );
    });

    it("should throw error when service is unavailable", async () => {
      mockClient.isAvailable.mockResolvedValue(false);
      mockClient.getCircuitState.mockReturnValue({
        state: "closed",
        failureCount: 0,
        lastFailureTime: 0,
      });

      await expect(fetcher.fetch("https://example.com")).rejects.toThrow(ScraperError);
      await expect(fetcher.fetch("https://example.com")).rejects.toThrow(
        /service is not available/i,
      );
    });

    it("should throw error when circuit breaker is open", async () => {
      mockClient.isAvailable.mockResolvedValue(false);
      mockClient.getCircuitState.mockReturnValue({
        state: "open",
        failureCount: 5,
        lastFailureTime: Date.now(),
      });

      await expect(fetcher.fetch("https://example.com")).rejects.toThrow(ScraperError);
      await expect(fetcher.fetch("https://example.com")).rejects.toThrow(
        /circuit breaker is open/i,
      );
    });

    it("should throw error when Crawl4AI returns error", async () => {
      mockClient.isAvailable.mockResolvedValue(true);
      mockClient.crawl.mockResolvedValue({
        success: false,
        error: {
          code: "CRAWL_ERROR",
          message: "Failed to crawl page",
        },
      } as Crawl4AIResponse);

      await expect(fetcher.fetch("https://example.com")).rejects.toThrow(ScraperError);
      await expect(fetcher.fetch("https://example.com")).rejects.toThrow(/CRAWL_ERROR/);
    });

    it("should throw error when content is empty", async () => {
      mockClient.isAvailable.mockResolvedValue(true);
      mockClient.crawl.mockResolvedValue({
        success: true,
        data: {
          markdown: "",
          metadata: {
            url: "https://example.com",
            statusCode: 200,
            crawlTime: 1.0,
          },
        },
      } as Crawl4AIResponse);

      await expect(fetcher.fetch("https://example.com")).rejects.toThrow(ScraperError);
      await expect(fetcher.fetch("https://example.com")).rejects.toThrow(
        /empty content/i,
      );
    });

    it("should handle cancellation via AbortSignal", async () => {
      const controller = new AbortController();
      controller.abort();

      mockClient.isAvailable.mockResolvedValue(true);

      await expect(
        fetcher.fetch("https://example.com", { signal: controller.signal }),
      ).rejects.toThrow(ScraperError);
      await expect(
        fetcher.fetch("https://example.com", { signal: controller.signal }),
      ).rejects.toThrow(/cancelled/i);
    });

    it("should prefer fitMarkdown over rawMarkdown", async () => {
      mockClient.isAvailable.mockResolvedValue(true);
      mockClient.crawl.mockResolvedValue({
        success: true,
        data: {
          markdown: "# Regular",
          rawMarkdown: "# Raw",
          fitMarkdown: "# Fit",
          metadata: {
            url: "https://example.com",
            statusCode: 200,
            crawlTime: 1.0,
          },
        },
      } as Crawl4AIResponse);

      const result = await fetcher.fetch("https://example.com");

      expect(result.content.toString("utf-8")).toBe("# Fit");
    });

    it("should use rawMarkdown when fitMarkdown is not available", async () => {
      mockClient.isAvailable.mockResolvedValue(true);
      mockClient.crawl.mockResolvedValue({
        success: true,
        data: {
          markdown: "# Regular",
          rawMarkdown: "# Raw",
          metadata: {
            url: "https://example.com",
            statusCode: 200,
            crawlTime: 1.0,
          },
        },
      } as Crawl4AIResponse);

      const result = await fetcher.fetch("https://example.com");

      expect(result.content.toString("utf-8")).toBe("# Raw");
    });

    it("should use markdown when neither fitMarkdown nor rawMarkdown available", async () => {
      mockClient.isAvailable.mockResolvedValue(true);
      mockClient.crawl.mockResolvedValue({
        success: true,
        data: {
          markdown: "# Regular",
          metadata: {
            url: "https://example.com",
            statusCode: 200,
            crawlTime: 1.0,
          },
        },
      } as Crawl4AIResponse);

      const result = await fetcher.fetch("https://example.com");

      expect(result.content.toString("utf-8")).toBe("# Regular");
    });

    it("should use finalUrl from metadata", async () => {
      mockClient.isAvailable.mockResolvedValue(true);
      mockClient.crawl.mockResolvedValue({
        success: true,
        data: {
          markdown: "# Content",
          metadata: {
            url: "https://example.com/final",
            statusCode: 200,
            crawlTime: 1.0,
          },
        },
      } as Crawl4AIResponse);

      const result = await fetcher.fetch("https://example.com/initial");

      expect(result.source).toBe("https://example.com/final");
    });

    it("should pass timeout from options to Crawl4AI config", async () => {
      mockClient.isAvailable.mockResolvedValue(true);
      mockClient.crawl.mockResolvedValue({
        success: true,
        data: {
          markdown: "# Content",
          metadata: {
            url: "https://example.com",
            statusCode: 200,
            crawlTime: 1.0,
          },
        },
      } as Crawl4AIResponse);

      await fetcher.fetch("https://example.com", { timeout: 60000 });

      expect(mockClient.crawl).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            waitForTimeout: 60000,
          }),
        }),
        expect.objectContaining({
          timeout: 60000,
        }),
      );
    });

    it("should wrap non-ScraperError exceptions", async () => {
      mockClient.isAvailable.mockResolvedValue(true);
      mockClient.crawl.mockRejectedValue(new Error("Network error"));

      await expect(fetcher.fetch("https://example.com")).rejects.toThrow(ScraperError);
      await expect(fetcher.fetch("https://example.com")).rejects.toThrow(/Network error/);
    });
  });

  describe("isAvailable", () => {
    it("should return true when service is available", async () => {
      mockClient.isAvailable.mockResolvedValue(true);

      expect(await fetcher.isAvailable()).toBe(true);
    });

    it("should return false when service is unavailable", async () => {
      mockClient.isAvailable.mockResolvedValue(false);

      expect(await fetcher.isAvailable()).toBe(false);
    });
  });

  describe("getCircuitState", () => {
    it("should return circuit state from client", () => {
      const expectedState = {
        state: "closed" as const,
        failureCount: 0,
        lastFailureTime: 0,
      };
      mockClient.getCircuitState.mockReturnValue(expectedState);

      expect(fetcher.getCircuitState()).toEqual(expectedState);
    });
  });

  describe("close", () => {
    it("should complete without error", async () => {
      await expect(fetcher.close()).resolves.toBeUndefined();
    });
  });
});
