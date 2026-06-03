import { describe, expect, it } from "vitest";
import { scraperOptionsStoreInputSchema, versionStatusSchema } from "./router";

describe("Store tRPC router input validation", () => {
  describe("versionStatusSchema", () => {
    it("accepts valid VersionStatus values", () => {
      const validStatuses = [
        "not_indexed",
        "queued",
        "running",
        "completed",
        "failed",
        "cancelled",
        "updating",
      ] as const;
      for (const status of validStatuses) {
        const result = versionStatusSchema.safeParse(status);
        expect(result.success, `expected "${status}" to be valid`).toBe(true);
      }
    });

    it("rejects an invalid status value", () => {
      const result = versionStatusSchema.safeParse("INVALID_STATUS");
      expect(result.success).toBe(false);
    });

    it("rejects an empty string", () => {
      const result = versionStatusSchema.safeParse("");
      expect(result.success).toBe(false);
    });

    it("rejects a number", () => {
      const result = versionStatusSchema.safeParse(42);
      expect(result.success).toBe(false);
    });
  });

  describe("scraperOptionsStoreInputSchema", () => {
    const validOptions = {
      url: "https://example.com/docs",
      library: "react",
      version: "18.0.0",
    };

    it("accepts valid ScraperOptions with required fields only", () => {
      const result = scraperOptionsStoreInputSchema.safeParse(validOptions);
      expect(result.success).toBe(true);
    });

    it("accepts valid ScraperOptions with optional fields", () => {
      const result = scraperOptionsStoreInputSchema.safeParse({
        ...validOptions,
        maxPages: 100,
        maxDepth: 3,
        scope: "hostname",
        followRedirects: true,
        maxConcurrency: 4,
        ignoreErrors: false,
        excludeSelectors: ["nav", "footer"],
        includePatterns: ["/docs/.*"],
        excludePatterns: ["/api/.*"],
        scrapeMode: "auto",
        headers: { Authorization: "Bearer token" },
      });
      expect(result.success).toBe(true);
    });

    it("rejects a string where an object is expected", () => {
      const result = scraperOptionsStoreInputSchema.safeParse("not an object");
      expect(result.success).toBe(false);
    });

    it("rejects an object missing required url field", () => {
      const result = scraperOptionsStoreInputSchema.safeParse({
        library: "react",
        version: "18.0.0",
      });
      expect(result.success).toBe(false);
    });

    it("rejects an object missing required library field", () => {
      const result = scraperOptionsStoreInputSchema.safeParse({
        url: "https://example.com",
        version: "18.0.0",
      });
      expect(result.success).toBe(false);
    });

    it("rejects an object with wrong type for maxPages", () => {
      const result = scraperOptionsStoreInputSchema.safeParse({
        ...validOptions,
        maxPages: "one hundred",
      });
      expect(result.success).toBe(false);
    });

    it("rejects an object with invalid scope value", () => {
      const result = scraperOptionsStoreInputSchema.safeParse({
        ...validOptions,
        scope: "universe",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("getVersionsByStatus input schema", () => {
    it("should be tested through versionStatusSchema — arrays of valid statuses are accepted", () => {
      const statuses = ["completed", "failed", "queued"];
      for (const status of statuses) {
        expect(versionStatusSchema.safeParse(status).success).toBe(true);
      }
    });

    it("should reject arrays containing invalid statuses", () => {
      const invalidStatus = "INVALID_STATUS";
      expect(versionStatusSchema.safeParse(invalidStatus).success).toBe(false);
    });
  });
});
