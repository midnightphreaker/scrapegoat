import { describe, expect, it } from "vitest";
import { scraperOptionsInputSchema } from "./router";

describe("Pipeline tRPC router input validation", () => {
  describe("scraperOptionsInputSchema", () => {
    const validOptions = {
      url: "https://example.com/docs",
      library: "react",
      version: "18.0.0",
    };

    it("accepts valid ScraperOptions with required fields only", () => {
      const result = scraperOptionsInputSchema.safeParse(validOptions);
      expect(result.success).toBe(true);
    });

    it("accepts valid ScraperOptions with all optional fields", () => {
      const result = scraperOptionsInputSchema.safeParse({
        ...validOptions,
        maxPages: 100,
        maxDepth: 3,
        scope: "domain",
        followRedirects: true,
        maxConcurrency: 2,
        ignoreErrors: true,
        excludeSelectors: [".sidebar"],
        includePatterns: ["/guide/.*"],
        excludePatterns: ["/blog/.*"],
        scrapeMode: "playwright",
        headers: { "X-Custom": "value" },
        isRefresh: false,
        clear: true,
        preserveHashes: false,
      });
      expect(result.success).toBe(true);
    });

    it("rejects a string where an object is expected", () => {
      const result = scraperOptionsInputSchema.safeParse("not an object");
      expect(result.success).toBe(false);
    });

    it("rejects a number where an object is expected", () => {
      const result = scraperOptionsInputSchema.safeParse(42);
      expect(result.success).toBe(false);
    });

    it("rejects an object missing required url", () => {
      const result = scraperOptionsInputSchema.safeParse({
        library: "react",
        version: "18.0.0",
      });
      expect(result.success).toBe(false);
    });

    it("rejects an object with empty url", () => {
      const result = scraperOptionsInputSchema.safeParse({
        ...validOptions,
        url: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects an object with empty library", () => {
      const result = scraperOptionsInputSchema.safeParse({
        ...validOptions,
        library: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects an object with wrong type for maxPages", () => {
      const result = scraperOptionsInputSchema.safeParse({
        ...validOptions,
        maxPages: "many",
      });
      expect(result.success).toBe(false);
    });

    it("rejects an object with invalid scope", () => {
      const result = scraperOptionsInputSchema.safeParse({
        ...validOptions,
        scope: "galaxy",
      });
      expect(result.success).toBe(false);
    });

    it("rejects an object with invalid scrapeMode", () => {
      const result = scraperOptionsInputSchema.safeParse({
        ...validOptions,
        scrapeMode: "puppeteer",
      });
      expect(result.success).toBe(false);
    });

    it("rejects an object with wrong type for headers", () => {
      const result = scraperOptionsInputSchema.safeParse({
        ...validOptions,
        headers: "Authorization: Bearer token",
      });
      expect(result.success).toBe(false);
    });
  });
});
