/**
 * Unit tests for input sanitization utilities.
 * Tests security-focused sanitization functions for XSS, injection, and other attacks.
 */

import { describe, expect, it } from "vitest";
import {
  sanitizeHeaders,
  sanitizeLibraryName,
  sanitizePatterns,
  sanitizeScrapeFormData,
  sanitizeString,
  sanitizeUrl,
  sanitizeVersion,
} from "./sanitization";

describe("sanitizeString", () => {
  it("should encode HTML entities to prevent XSS", () => {
    expect(sanitizeString('<script>alert("XSS")</script>')).toBe(
      "&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;",
    );
  });

  it("should encode ampersands", () => {
    expect(sanitizeString("Tom & Jerry")).toBe("Tom &amp; Jerry");
  });

  it("should encode single quotes", () => {
    expect(sanitizeString("It's a test")).toBe("It&#x27;s a test");
  });

  it("should handle empty strings", () => {
    expect(sanitizeString("")).toBe("");
  });

  it("should handle null and undefined", () => {
    expect(sanitizeString(null as unknown as string)).toBe("");
    expect(sanitizeString(undefined as unknown as string)).toBe("");
  });

  it("should encode forward slashes", () => {
    expect(sanitizeString("<script/>")).toBe("&lt;script&#x2F;&gt;");
  });
});

describe("sanitizeLibraryName", () => {
  it("should allow valid library names", () => {
    expect(sanitizeLibraryName("react")).toBe("react");
    expect(sanitizeLibraryName("vue-router")).toBe("vue-router");
    expect(sanitizeLibraryName("lodash.debounce")).toBe("lodash.debounce");
    expect(sanitizeLibraryName("my_library")).toBe("my_library");
  });

  it("should convert to lowercase", () => {
    expect(sanitizeLibraryName("React-DOM")).toBe("react-dom");
  });

  it("should remove special characters", () => {
    expect(sanitizeLibraryName("vue@3")).toBe("vue3");
    expect(sanitizeLibraryName("my library")).toBe("mylibrary");
    expect(sanitizeLibraryName("test!@#$%")).toBe("test");
  });

  it("should trim whitespace", () => {
    expect(sanitizeLibraryName("  react  ")).toBe("react");
  });

  it("should remove consecutive separators", () => {
    expect(sanitizeLibraryName("test--lib")).toBe("test.lib");
    expect(sanitizeLibraryName("test...lib")).toBe("test.lib");
  });

  it("should remove leading and trailing separators", () => {
    expect(sanitizeLibraryName(".react.")).toBe("react");
    expect(sanitizeLibraryName("-test-")).toBe("test");
  });

  it("should handle empty strings", () => {
    expect(sanitizeLibraryName("")).toBe("");
  });
});

describe("sanitizeVersion", () => {
  it("should accept valid semver versions", () => {
    expect(sanitizeVersion("1.0.0")).toBe("1.0.0");
    expect(sanitizeVersion("18.2.0")).toBe("18.2.0");
    expect(sanitizeVersion("1.0.0-alpha")).toBe("1.0.0-alpha");
    expect(sanitizeVersion("1.0.0-beta.1")).toBe("1.0.0-beta.1");
    expect(sanitizeVersion("1.0.0+build123")).toBe("1.0.0+build123");
  });

  it("should strip 'v' prefix", () => {
    expect(sanitizeVersion("v1.0.0")).toBe("1.0.0");
    expect(sanitizeVersion("V18.2.0")).toBe("18.2.0");
  });

  it("should handle whitespace", () => {
    expect(sanitizeVersion("  1.0.0  ")).toBe("1.0.0");
  });

  it("should return undefined for invalid versions", () => {
    expect(sanitizeVersion("invalid")).toBeUndefined();
    expect(sanitizeVersion("1.0")).toBe("1.0.0"); // Fallback: adds .0
    expect(sanitizeVersion("")).toBeUndefined();
  });

  it("should extract numbers from invalid versions as fallback", () => {
    expect(sanitizeVersion("version 18.2.0")).toBe("18.2.0");
    expect(sanitizeVersion("v18 beta")).toBeUndefined(); // Only 1 number, need at least 2
  });

  it("should return undefined for null/undefined", () => {
    expect(sanitizeVersion(null as unknown as string)).toBeUndefined();
    expect(sanitizeVersion(undefined as unknown as string)).toBeUndefined();
  });
});

describe("sanitizePatterns", () => {
  it("should allow glob patterns", () => {
    const result = sanitizePatterns("docs/*, test/*.md");
    expect(result).toEqual(["docs/*", "test/*.md"]);
  });

  it("should allow regex patterns wrapped in slashes", () => {
    const result = sanitizePatterns("/api/v\\d+.*/");
    expect(result).toEqual(["/api/v\\d+.*/"]);
  });

  it("should handle newline-separated patterns", () => {
    const result = sanitizePatterns("docs/*\ntest/*.md\n*.pdf");
    expect(result).toEqual(["docs/*", "test/*.md", "*.pdf"]);
  });

  it("should sanitize glob patterns by removing dangerous chars", () => {
    const result = sanitizePatterns("docs/*, <script>alert(1)</script>");
    // Forward slashes are allowed in glob patterns (valid for paths)
    // Angle brackets and script tags are removed
    expect(result).toEqual(["docs/*", "scriptalert1/script"]);
  });

  it("should remove protocol injection attempts", () => {
    const result = sanitizePatterns("javascript:alert(1), docs/*");
    expect(result).toEqual(["javascriptalert1", "docs/*"]);
  });

  it("should handle invalid regex patterns", () => {
    const result = sanitizePatterns("/[invalid(/");
    // Should remove slashes and sanitize as glob
    expect(result).toBeDefined();
    expect(result![0]).not.toContain("/");
  });

  it("should return undefined for empty input", () => {
    expect(sanitizePatterns("")).toBeUndefined();
    expect(sanitizePatterns("   ")).toBeUndefined();
  });

  it("should handle null/undefined", () => {
    expect(sanitizePatterns(null as unknown as string)).toBeUndefined();
    expect(sanitizePatterns(undefined as unknown as string)).toBeUndefined();
  });
});

describe("sanitizeUrl", () => {
  it("should accept valid http URLs", () => {
    expect(sanitizeUrl("https://docs.example.com")).toBe("https://docs.example.com");
    expect(sanitizeUrl("http://example.com")).toBe("http://example.com");
  });

  it("should accept valid file URLs", () => {
    expect(sanitizeUrl("file:///path/to/docs")).toBe("file:///path/to/docs");
  });

  it("should trim whitespace", () => {
    expect(sanitizeUrl("  https://example.com  ")).toBe("https://example.com");
  });

  it("should reject dangerous protocols", () => {
    expect(() => sanitizeUrl("javascript:alert(1)")).toThrow();
    expect(() => sanitizeUrl("data:text/html,<script>")).toThrow();
    expect(() => sanitizeUrl("vbscript:msgbox(1)")).toThrow();
    expect(() => sanitizeUrl("ftp://example.com")).toThrow();
  });

  it("should reject URL-encoded malicious content", () => {
    // Test URL-encoded script tags
    expect(() => sanitizeUrl("https://example.com/?q=%3Cscript%3E")).toThrow();
    expect(() => sanitizeUrl("https://example.com/%26%23x3C;")).toThrow();
  });

  it("should reject invalid URL formats", () => {
    expect(() => sanitizeUrl("not-a-url")).toThrow();
    expect(() => sanitizeUrl("")).toThrow();
  });

  it("should warn but allow private IP addresses", () => {
    // Should not throw, but logs warning
    expect(sanitizeUrl("http://localhost:8181")).toBe("http://localhost:8181");
    expect(sanitizeUrl("http://127.0.0.1")).toBe("http://127.0.0.1");
  });

  it("should require path in file URLs", () => {
    expect(() => sanitizeUrl("file://")).toThrow();
  });
});

describe("sanitizeHeaders", () => {
  it("should accept valid headers", () => {
    const result = sanitizeHeaders([{ name: "Authorization", value: "Bearer token123" }]);
    expect(result).toEqual([{ name: "Authorization", value: "Bearer token123" }]);
  });

  it("should trim whitespace", () => {
    const result = sanitizeHeaders([
      { name: "  Content-Type  ", value: "  application/json  " },
    ]);
    expect(result).toEqual([{ name: "Content-Type", value: "application/json" }]);
  });

  it("should sanitize header names", () => {
    const result = sanitizeHeaders([{ name: "Custom Header", value: "test" }]);
    expect(result).toEqual([{ name: "CustomHeader", value: "test" }]);
  });

  it("should prevent newline injection in header values", () => {
    const result = sanitizeHeaders([
      { name: "X-Test", value: "value\r\nInjected: true" },
    ]);
    // Newlines are replaced with spaces, but we keep the space after replacement
    expect(result).toEqual([{ name: "X-Test", value: "value  Injected: true" }]);
  });

  it("should remove control characters", () => {
    const result = sanitizeHeaders([{ name: "X-Test", value: "test\x00value" }]);
    expect(result).toEqual([{ name: "X-Test", value: "testvalue" }]);
  });

  it("should reject CRLF injection attempts", () => {
    expect(() =>
      sanitizeHeaders([{ name: "X-Test", value: "test%0D%0AInjected: true" }]),
    ).toThrow();
  });

  it("should reject dangerous header names", () => {
    expect(() => sanitizeHeaders([{ name: "Host", value: "evil.com" }])).toThrow();
    expect(() => sanitizeHeaders([{ name: "Content-Length", value: "9999" }])).toThrow();
  });

  it("should skip empty headers", () => {
    const result = sanitizeHeaders([
      { name: "", value: "" },
      { name: "Valid", value: "test" },
    ]);
    expect(result).toEqual([{ name: "Valid", value: "test" }]);
  });

  it("should handle empty/null input", () => {
    expect(sanitizeHeaders([])).toEqual([]);
    expect(sanitizeHeaders(null as unknown as any[])).toEqual([]);
    expect(sanitizeHeaders(undefined as unknown as any[])).toEqual([]);
  });
});

describe("sanitizeScrapeFormData", () => {
  it("should sanitize all form fields", () => {
    const result = sanitizeScrapeFormData({
      url: "https://docs.example.com",
      library: "React-DOM",
      version: "v18.2.0",
      includePatterns: "docs/*, /api/v\\d+.*/",
      excludePatterns: "*.pdf",
      headers: [{ name: "Authorization", value: "Bearer token" }],
    });

    expect(result.url).toBe("https://docs.example.com");
    expect(result.library).toBe("react-dom");
    expect(result.version).toBe("18.2.0");
    expect(result.includePatterns).toEqual(["docs/*", "/api/v\\d+.*/"]);
    expect(result.excludePatterns).toEqual(["*.pdf"]);
    expect(result.headers).toEqual([{ name: "Authorization", value: "Bearer token" }]);
  });

  it("should generate warnings for modified input", () => {
    const result = sanitizeScrapeFormData({
      url: "https://docs.example.com",
      library: "My_Library@2",
      version: "v1.0.0",
      headers: [],
    });

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes("Library name"))).toBe(true);
    expect(result.warnings.some((w) => w.includes("Version"))).toBe(true);
  });

  it("should handle optional fields", () => {
    const result = sanitizeScrapeFormData({
      url: "https://docs.example.com",
      library: "react",
      headers: [],
    });

    expect(result.version).toBeUndefined();
    expect(result.includePatterns).toBeUndefined();
    expect(result.excludePatterns).toBeUndefined();
  });

  it("should reject invalid URLs", () => {
    expect(() =>
      sanitizeScrapeFormData({
        url: "javascript:alert(1)",
        library: "test",
        headers: [],
      }),
    ).toThrow();
  });

  it("should reject malicious headers", () => {
    expect(() =>
      sanitizeScrapeFormData({
        url: "https://example.com",
        library: "test",
        headers: [{ name: "Host", value: "evil.com" }],
      }),
    ).toThrow();
  });
});
