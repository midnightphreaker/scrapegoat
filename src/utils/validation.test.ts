/**
 * Unit tests for validation utilities
 */

import { describe, expect, it } from "vitest";
import {
  createNumberRangeValidator,
  createRequiredStringValidator,
  createValidationError,
  ValidationErrorCode,
  validateFileSize,
  validateGitHubUrl,
  validateGitHubWikiUrl,
  validateImageSize,
  validateNumberRange,
  validatePort,
  validatePortString,
  validateRequiredString,
  validateSemverVersion,
} from "./validation";

describe("validateRequiredString", () => {
  it("should accept valid non-empty strings", () => {
    expect(() => validateRequiredString("test", "Test field")).not.toThrow();
    expect(() => validateRequiredString("  test  ", "Test field")).not.toThrow();
  });

  it("should reject empty strings", () => {
    expect(() => validateRequiredString("", "Test field")).toThrow(
      "Validation failed for Test field: Required field missing or empty",
    );
  });

  it("should reject whitespace-only strings", () => {
    expect(() => validateRequiredString("   ", "Test field")).toThrow(
      "Validation failed for Test field: Required field missing or empty",
    );
    expect(() => validateRequiredString("\t\n", "Test field")).toThrow(
      "Validation failed for Test field: Required field missing or empty",
    );
  });

  it("should reject non-string values", () => {
    expect(() => validateRequiredString(null, "Test field")).toThrow();
    expect(() => validateRequiredString(undefined, "Test field")).toThrow();
    expect(() => validateRequiredString(123, "Test field")).toThrow();
    expect(() => validateRequiredString({}, "Test field")).toThrow();
    expect(() => validateRequiredString([], "Test field")).toThrow();
  });

  it("should attach metadata to error", () => {
    try {
      validateRequiredString("", "Library name");
      expect.fail("Should have thrown an error");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      const err = error as any;
      expect(err.name).toBe("ValidationError");
      expect(err.field).toBe("Library name");
      expect(err.reason).toBe("Required field missing or empty");
    }
  });
});

describe("validatePort", () => {
  it("should accept valid port numbers", () => {
    expect(validatePort(1)).toBe(1);
    expect(validatePort(80)).toBe(80);
    expect(validatePort(8080)).toBe(8080);
    expect(validatePort(65535)).toBe(65535);
  });

  it("should reject port 0", () => {
    expect(() => validatePort(0)).toThrow(
      "Validation failed for port: Port must be an integer between 1 and 65535",
    );
  });

  it("should reject ports above 65535", () => {
    expect(() => validatePort(65536)).toThrow(
      "Validation failed for port: Port must be an integer between 1 and 65535",
    );
    expect(() => validatePort(70000)).toThrow(
      "Validation failed for port: Port must be an integer between 1 and 65535",
    );
  });

  it("should reject non-integer values", () => {
    expect(() => validatePort(80.5)).toThrow(
      "Validation failed for port: Port must be an integer between 1 and 65535",
    );
    expect(() => validatePort(NaN)).toThrow(
      "Validation failed for port: Port must be an integer between 1 and 65535",
    );
    expect(() => validatePort(Infinity)).toThrow(
      "Validation failed for port: Port must be an integer between 1 and 65535",
    );
  });

  it("should reject negative values", () => {
    expect(() => validatePort(-1)).toThrow(
      "Validation failed for port: Port must be an integer between 1 and 65535",
    );
    expect(() => validatePort(-8080)).toThrow(
      "Validation failed for port: Port must be an integer between 1 and 65535",
    );
  });
});

describe("validatePortString", () => {
  it("should accept valid port strings and return as string", () => {
    expect(validatePortString("1")).toBe("1");
    expect(validatePortString("80")).toBe("80");
    expect(validatePortString("8080")).toBe("8080");
    expect(validatePortString("65535")).toBe("65535");
  });

  it("should reject port 0", () => {
    expect(() => validatePortString("0")).toThrow(
      "Validation failed for port: Port must be an integer between 1 and 65535",
    );
  });

  it("should reject ports above 65535", () => {
    expect(() => validatePortString("65536")).toThrow(
      "Validation failed for port: Port must be an integer between 1 and 65535",
    );
    expect(() => validatePortString("70000")).toThrow(
      "Validation failed for port: Port must be an integer between 1 and 65535",
    );
  });

  it("should reject non-numeric strings", () => {
    expect(() => validatePortString("abc")).toThrow(
      "Validation failed for port: Port must be an integer between 1 and 65535",
    );
    expect(() => validatePortString("80abc")).toThrow(
      "Validation failed for port: Port must be an integer between 1 and 65535",
    );
    expect(() => validatePortString("")).toThrow(
      "Validation failed for port: Port must be an integer between 1 and 65535",
    );
  });

  it("should reject decimal strings", () => {
    // Note: Number("80.5") returns 80.5, which is not an integer
    expect(() => validatePortString("80.5")).toThrow(); // Throws ValidationError
  });
});

describe("validateGitHubUrl", () => {
  it("should accept valid GitHub URLs", () => {
    const url1 = validateGitHubUrl("https://github.com/owner/repo");
    expect(url1.hostname).toBe("github.com");
    expect(url1.pathname).toBe("/owner/repo");

    const url2 = validateGitHubUrl("https://github.com/owner/repo/wiki");
    expect(url2.hostname).toBe("github.com");

    const url3 = validateGitHubUrl("http://github.com/owner/repo");
    expect(url3.hostname).toBe("github.com");
  });

  it("should reject non-GitHub URLs", () => {
    expect(() => validateGitHubUrl("https://example.com")).toThrow(
      "Invalid URL: https://example.com",
    );
    expect(() => validateGitHubUrl("https://gitlab.com/owner/repo")).toThrow(
      "Invalid URL: https://gitlab.com/owner/repo",
    );
    expect(() => validateGitHubUrl("https://github.io")).toThrow(
      "Invalid URL: https://github.io",
    );
  });

  it("should reject invalid URLs", () => {
    expect(() => validateGitHubUrl("not-a-url")).toThrow("Invalid URL: not-a-url");
    expect(() => validateGitHubUrl("")).toThrow("Invalid URL: ");
    expect(() => validateGitHubUrl("github.com/owner/repo")).toThrow(); // Invalid URL format
  });
});

describe("validateGitHubWikiUrl", () => {
  it("should accept valid GitHub wiki URLs", () => {
    const url1 = validateGitHubWikiUrl("https://github.com/owner/repo/wiki");
    expect(url1.pathname).toContain("/wiki");

    const url2 = validateGitHubWikiUrl("https://github.com/owner/repo/wiki/Page");
    expect(url2.pathname).toContain("/wiki");
  });

  it("should reject non-wiki GitHub URLs", () => {
    expect(() => validateGitHubWikiUrl("https://github.com/owner/repo")).toThrow(
      "Invalid URL: https://github.com/owner/repo",
    );
    expect(() => validateGitHubWikiUrl("https://github.com/owner/repo/issues")).toThrow(
      "Invalid URL: https://github.com/owner/repo/issues",
    );
  });

  it("should reject non-GitHub URLs", () => {
    expect(() => validateGitHubWikiUrl("https://example.com/wiki")).toThrow(
      "Invalid URL: https://example.com/wiki",
    );
  });

  it("should reject invalid URLs", () => {
    expect(() => validateGitHubWikiUrl("not-a-url")).toThrow("Invalid URL: not-a-url");
  });
});

describe("validateImageSize", () => {
  const maxSize = 10 * 1024 * 1024; // 10MB

  it("should accept images within size limit", () => {
    const buffer = Buffer.alloc(1024); // 1KB
    expect(() => validateImageSize(buffer, maxSize)).not.toThrow();
  });

  it("should accept images exactly at size limit", () => {
    const buffer = Buffer.alloc(maxSize);
    expect(() => validateImageSize(buffer, maxSize)).not.toThrow();
  });

  it("should reject images exceeding size limit", () => {
    const buffer = Buffer.alloc(maxSize + 1);
    expect(() => validateImageSize(buffer, maxSize, "Screenshot")).toThrow(
      "Screenshot buffer too large",
    );
  });

  it("should include context in error message", () => {
    const buffer = Buffer.alloc(maxSize + 1);
    expect(() => validateImageSize(buffer, maxSize, "Avatar")).toThrow(
      /Avatar buffer too large/,
    );
  });

  it("should show sizes in MB in error message", () => {
    const buffer = Buffer.alloc(20 * 1024 * 1024); // 20MB
    expect(() => validateImageSize(buffer, maxSize, "Image")).toThrow(
      /Image buffer too large: 20\.00MB \(max: 10\.00MB\)/,
    );
  });

  it("should use 'Image' as default context", () => {
    const buffer = Buffer.alloc(maxSize + 1);
    expect(() => validateImageSize(buffer, maxSize)).toThrow(/Image buffer too large/);
  });
});

describe("validateFileSize", () => {
  const maxSize = 5 * 1024 * 1024; // 5MB

  it("should accept files within size limit", () => {
    expect(() => validateFileSize(1024, maxSize)).not.toThrow();
  });

  it("should accept files exactly at size limit", () => {
    expect(() => validateFileSize(maxSize, maxSize)).not.toThrow();
  });

  it("should reject files exceeding size limit", () => {
    expect(() => validateFileSize(maxSize + 1, maxSize)).toThrow("too large");
  });

  it("should include context in error message", () => {
    expect(() => validateFileSize(maxSize + 1, maxSize, "Screenshot file")).toThrow(
      /Screenshot file too large/,
    );
  });

  it("should show sizes in MB in error message", () => {
    const fileSize = 10 * 1024 * 1024; // 10MB
    expect(() => validateFileSize(fileSize, maxSize, "File")).toThrow(
      /File too large: 10\.00MB \(max: 5\.00MB\)/,
    );
  });

  it("should use 'File' as default context", () => {
    expect(() => validateFileSize(maxSize + 1, maxSize)).toThrow(/File too large/);
  });
});

describe("validateNumberRange", () => {
  it("should accept numbers within range", () => {
    expect(validateNumberRange(5, 1, 10)).toBe(5);
    expect(validateNumberRange(1, 1, 10)).toBe(1);
    expect(validateNumberRange(10, 1, 10)).toBe(10);
  });

  it("should reject numbers below minimum", () => {
    expect(() => validateNumberRange(0, 1, 10, "Limit")).toThrow(
      "Limit must be a number between 1 and 10",
    );
    expect(() => validateNumberRange(-5, 1, 10)).toThrow(
      "Value must be a number between 1 and 10",
    );
  });

  it("should reject numbers above maximum", () => {
    expect(() => validateNumberRange(11, 1, 10, "Limit")).toThrow(
      "Limit must be a number between 1 and 10",
    );
    expect(() => validateNumberRange(100, 1, 10)).toThrow(
      "Value must be a number between 1 and 10",
    );
  });

  it("should reject non-number values", () => {
    expect(() => validateNumberRange("5" as any, 1, 10)).toThrow(
      "Value must be a number between 1 and 10",
    );
    expect(() => validateNumberRange(null as any, 1, 10)).toThrow(
      "Value must be a number between 1 and 10",
    );
    expect(() => validateNumberRange(undefined as any, 1, 10)).toThrow(
      "Value must be a number between 1 and 10",
    );
  });

  it("should use 'Value' as default field name", () => {
    expect(() => validateNumberRange(0, 1, 10)).toThrow(
      "Value must be a number between 1 and 10",
    );
  });
});

describe("validateSemverVersion", () => {
  it("should accept valid X.Y.Z format", () => {
    expect(validateSemverVersion("1.0.0")).toBe("1.0.0");
    expect(validateSemverVersion("10.20.30")).toBe("10.20.30");
    expect(validateSemverVersion("0.0.1")).toBe("0.0.1");
  });

  it("should accept valid X.Y.Z-prerelease format", () => {
    expect(validateSemverVersion("1.0.0-alpha")).toBe("1.0.0-alpha");
    expect(validateSemverVersion("1.0.0-alpha.1")).toBe("1.0.0-alpha.1");
    expect(validateSemverVersion("1.0.0-beta")).toBe("1.0.0-beta");
    expect(validateSemverVersion("1.0.0-rc.1")).toBe("1.0.0-rc.1");
    expect(validateSemverVersion("2.0.0+build")).toBe("2.0.0+build");
  });

  it("should accept valid X.Y format", () => {
    expect(validateSemverVersion("1.0")).toBe("1.0");
    expect(validateSemverVersion("10.20")).toBe("10.20");
    expect(validateSemverVersion("0.1")).toBe("0.1");
  });

  it("should accept valid X format", () => {
    expect(validateSemverVersion("1")).toBe("1");
    expect(validateSemverVersion("10")).toBe("10");
    expect(validateSemverVersion("0")).toBe("0");
  });

  it("should reject invalid formats", () => {
    expect(() => validateSemverVersion("")).toThrow();
    expect(() => validateSemverVersion("v1.0.0")).toThrow();
    expect(() => validateSemverVersion("1.0.0.0")).toThrow();
    expect(() => validateSemverVersion("abc")).toThrow();
    expect(() => validateSemverVersion("1.0.0-")).toThrow();
    expect(() => validateSemverVersion(".1.0")).toThrow();
    expect(() => validateSemverVersion("1.0.")).toThrow();
  });

  it("should provide helpful error message", () => {
    expect(() => validateSemverVersion("invalid")).toThrow(
      "Invalid version format: 'invalid'. Use 'X.Y.Z', 'X.Y.Z-prerelease', 'X.Y', or 'X'",
    );
  });
});

describe("createRequiredStringValidator", () => {
  it("should create a validator function", () => {
    const validateLibraryName = createRequiredStringValidator("Library name");
    expect(typeof validateLibraryName).toBe("function");
  });

  it("should validate using provided field name", () => {
    const validateLibrary = createRequiredStringValidator("Library");
    expect(() => validateLibrary("test")).not.toThrow();
    expect(() => validateLibrary("")).toThrow(
      "Validation failed for Library: Required field missing or empty",
    );
  });

  it("should attach field name to error", () => {
    const validateLibrary = createRequiredStringValidator("Library name");
    try {
      validateLibrary("");
      expect.fail("Should have thrown");
    } catch (error) {
      expect((error as any).field).toBe("Library name");
    }
  });
});

describe("createNumberRangeValidator", () => {
  it("should create a validator function", () => {
    const validateLimit = createNumberRangeValidator(1, 100, "Limit");
    expect(typeof validateLimit).toBe("function");
  });

  it("should validate using provided range and field name", () => {
    const validateLimit = createNumberRangeValidator(1, 100, "Limit");
    expect(validateLimit(50)).toBe(50);
    expect(() => validateLimit(0)).toThrow("Limit must be a number between 1 and 100");
    expect(() => validateLimit(101)).toThrow("Limit must be a number between 1 and 100");
  });

  it("should use default field name if not provided", () => {
    const validateValue = createNumberRangeValidator(0, 10);
    expect(() => validateValue(-1)).toThrow("Value must be a number between 0 and 10");
  });
});

describe("createValidationError", () => {
  it("should create error object with all properties", () => {
    const error = createValidationError(
      ValidationErrorCode.REQUIRED_FIELD_MISSING,
      "Field is required",
      "library",
      "",
    );

    expect(error).toEqual({
      code: "REQUIRED_FIELD_MISSING",
      message: "Field is required",
      field: "library",
      value: "",
    });
  });

  it("should create error without optional fields", () => {
    const error = createValidationError(
      ValidationErrorCode.INVALID_FORMAT,
      "Invalid format",
    );

    expect(error).toEqual({
      code: "INVALID_FORMAT",
      message: "Invalid format",
    });
    expect(error.field).toBeUndefined();
    expect(error.value).toBeUndefined();
  });

  it("should support all error codes", () => {
    const codes = [
      ValidationErrorCode.REQUIRED_FIELD_MISSING,
      ValidationErrorCode.INVALID_FORMAT,
      ValidationErrorCode.OUT_OF_RANGE,
      ValidationErrorCode.EXCEEDS_MAXIMUM,
      ValidationErrorCode.INVALID_URL,
    ];

    codes.forEach((code) => {
      const error = createValidationError(code, "Test");
      expect(error.code).toBe(code);
      expect(error.message).toBe("Test");
    });
  });
});
