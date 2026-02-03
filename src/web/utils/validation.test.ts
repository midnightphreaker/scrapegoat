import { describe, expect, it } from "vitest";
import {
  VALIDATION_ERRORS,
  VALIDATION_LIMITS,
  validateFormFields,
  validateMaxLength,
} from "./validation";

describe("Validation Utilities", () => {
  describe("VALIDATION_LIMITS", () => {
    it("should have correct limit values", () => {
      expect(VALIDATION_LIMITS.URL).toBe(2048);
      expect(VALIDATION_LIMITS.LIBRARY).toBe(100);
      expect(VALIDATION_LIMITS.VERSION).toBe(50);
      expect(VALIDATION_LIMITS.PATTERNS).toBe(2000);
      expect(VALIDATION_LIMITS.HEADER_NAME).toBe(100);
      expect(VALIDATION_LIMITS.HEADER_VALUE).toBe(500);
    });
  });

  describe("VALIDATION_ERRORS", () => {
    it("should generate correct error messages", () => {
      expect(VALIDATION_ERRORS.URL(2050)).toContain("2048");
      expect(VALIDATION_ERRORS.URL(2050)).toContain("2050");

      expect(VALIDATION_ERRORS.LIBRARY(150)).toContain("100");
      expect(VALIDATION_ERRORS.LIBRARY(150)).toContain("150");

      expect(VALIDATION_ERRORS.VERSION(60)).toContain("50");
      expect(VALIDATION_ERRORS.VERSION(60)).toContain("60");

      expect(VALIDATION_ERRORS.PATTERNS("Include", 2500)).toContain("2000");
      expect(VALIDATION_ERRORS.PATTERNS("Include", 2500)).toContain("2500");

      expect(VALIDATION_ERRORS.HEADER_NAME(150)).toContain("100");
      expect(VALIDATION_ERRORS.HEADER_NAME(150)).toContain("150");

      expect(VALIDATION_ERRORS.HEADER_VALUE(600)).toContain("500");
      expect(VALIDATION_ERRORS.HEADER_VALUE(600)).toContain("600");
    });
  });

  describe("validateMaxLength", () => {
    it("should return null for valid lengths", () => {
      expect(validateMaxLength("test", 10, "Test Field")).toBeNull();
      expect(validateMaxLength("a".repeat(100), 100, "Test Field")).toBeNull();
      expect(validateMaxLength("", 10, "Test Field")).toBeNull();
      expect(validateMaxLength(undefined as any, 10, "Test Field")).toBeNull();
    });

    it("should return error message for exceeded lengths", () => {
      const result = validateMaxLength("a".repeat(150), 100, "Test Field");
      expect(result).toBeTruthy();
      expect(result).toContain("Test Field");
      expect(result).toContain("100");
      expect(result).toContain("150");
    });
  });

  describe("validateFormFields", () => {
    it("should return null for valid data", () => {
      const result = validateFormFields({
        url: "https://example.com",
        library: "test-lib",
        version: "1.0.0",
        includePatterns: "docs/*",
        excludePatterns: "api/*\nprivate/*",
        headers: [
          { name: "Authorization", value: "Bearer token" },
          { name: "Accept", value: "application/json" },
        ],
      });
      expect(result).toBeNull();
    });

    it("should validate URL length", () => {
      const result = validateFormFields({
        url: `https://example.com/${"a".repeat(2100)}`,
        library: "test-lib",
      });
      expect(result).toBeTruthy();
      expect(result).toContain("URL");
      expect(result).toContain("2048");
    });

    it("should validate library name length", () => {
      const result = validateFormFields({
        url: "https://example.com",
        library: "a".repeat(150),
      });
      expect(result).toBeTruthy();
      expect(result).toContain("Library name");
      expect(result).toContain("100");
    });

    it("should validate version length", () => {
      const result = validateFormFields({
        url: "https://example.com",
        library: "test-lib",
        version: "a".repeat(60),
      });
      expect(result).toBeTruthy();
      expect(result).toContain("Version");
      expect(result).toContain("50");
    });

    it("should validate include patterns length", () => {
      const result = validateFormFields({
        url: "https://example.com",
        library: "test-lib",
        includePatterns: "a".repeat(2500),
      });
      expect(result).toBeTruthy();
      expect(result).toContain("Include");
      expect(result).toContain("patterns");
      expect(result).toContain("2000");
    });

    it("should validate exclude patterns length", () => {
      const result = validateFormFields({
        url: "https://example.com",
        library: "test-lib",
        excludePatterns: "a".repeat(2500),
      });
      expect(result).toBeTruthy();
      expect(result).toContain("Exclude");
      expect(result).toContain("patterns");
      expect(result).toContain("2000");
    });

    it("should validate header name length", () => {
      const result = validateFormFields({
        url: "https://example.com",
        library: "test-lib",
        headers: [{ name: "a".repeat(150), value: "test" }],
      });
      expect(result).toBeTruthy();
      expect(result).toContain("Header 1");
      expect(result).toContain("name");
      expect(result).toContain("100");
    });

    it("should validate header value length", () => {
      const result = validateFormFields({
        url: "https://example.com",
        library: "test-lib",
        headers: [{ name: "Authorization", value: "a".repeat(600) }],
      });
      expect(result).toBeTruthy();
      expect(result).toContain("Header 1");
      expect(result).toContain("value");
      expect(result).toContain("500");
    });

    it("should handle missing optional fields", () => {
      const result = validateFormFields({
        url: "https://example.com",
        library: "test-lib",
      });
      expect(result).toBeNull();
    });

    it("should handle empty headers array", () => {
      const result = validateFormFields({
        url: "https://example.com",
        library: "test-lib",
        headers: [],
      });
      expect(result).toBeNull();
    });
  });
});
