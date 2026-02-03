/**
 * Shared validation utilities for the scrapegoat project.
 * Provides common validation functions to reduce code duplication.
 *
 * @module utils/validation
 */

import { URL } from "node:url";
import { InvalidUrlError, ValidationError } from "./errors";

/**
 * Validates that a value is a non-empty string.
 *
 * @param value - The value to validate
 * @param fieldName - The name of the field (for error messages)
 * @throws {ValidationError} If validation fails
 * @example
 * ```typescript
 * validateRequiredString(library, "Library name");
 * ```
 */
export function validateRequiredString(value: unknown, fieldName: string): void {
  if (!value || typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(fieldName, value, "Required field missing or empty");
  }
}

/**
 * Validates that a port number is within the valid range (1-65535).
 *
 * @param port - The port number to validate
 * @returns The validated port number
 * @throws {ValidationError} If port is invalid
 * @example
 * ```typescript
 * const port = validatePort(8080); // Returns 8080
 * validatePort(0); // Throws error
 * validatePort(70000); // Throws error
 * ```
 */
export function validatePort(port: number): number {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ValidationError(
      "port",
      port,
      "Port must be an integer between 1 and 65535",
    );
  }
  return port;
}

/**
 * Validates a port from a string value (e.g., from CLI args or env vars).
 *
 * @param value - The string value to parse and validate
 * @returns The validated port as a string
 * @throws {ValidationError} If the value cannot be parsed or is invalid
 * @example
 * ```typescript
 * const port = validatePortString("8080"); // Returns "8080"
 * validatePortString("invalid"); // Throws error
 * ```
 */
export function validatePortString(value: string): string {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ValidationError(
      "port",
      value,
      "Port must be an integer between 1 and 65535",
    );
  }
  return String(port);
}

/**
 * Validates that a URL is a GitHub URL.
 *
 * @param urlString - The URL string to validate
 * @returns The parsed URL object
 * @throws {InvalidUrlError} If the URL is invalid or not a GitHub URL
 * @example
 * ```typescript
 * const url = validateGitHubUrl("https://github.com/owner/repo");
 * validateGitHubUrl("https://example.com"); // Throws error
 * ```
 */
export function validateGitHubUrl(urlString: string): URL {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new InvalidUrlError(urlString);
  }

  if (!url.hostname.includes("github.com")) {
    throw new InvalidUrlError(urlString, new Error("URL must be a GitHub URL"));
  }

  return url;
}

/**
 * Validates that a URL is a GitHub wiki URL.
 *
 * @param urlString - The URL string to validate
 * @returns The parsed URL object
 * @throws {InvalidUrlError} If the URL is invalid or not a GitHub wiki URL
 * @example
 * ```typescript
 * const url = validateGitHubWikiUrl("https://github.com/owner/repo/wiki");
 * validateGitHubWikiUrl("https://github.com/owner/repo"); // Throws error
 * ```
 */
export function validateGitHubWikiUrl(urlString: string): URL {
  const url = validateGitHubUrl(urlString);

  if (!url.pathname.includes("/wiki")) {
    throw new InvalidUrlError(urlString, new Error("URL must be a GitHub wiki URL"));
  }

  return url;
}

/**
 * Validates that a buffer's size is within the maximum allowed size.
 *
 * @param buffer - The buffer to validate
 * @param maxSize - The maximum allowed size in bytes
 * @param context - Optional context for error messages (e.g., "Screenshot", "Image")
 * @throws {Error} If the buffer exceeds the maximum size
 * @example
 * ```typescript
 * validateImageSize(buffer, 10 * 1024 * 1024, "Screenshot");
 * ```
 */
export function validateImageSize(
  buffer: Buffer,
  maxSize: number,
  context: string = "Image",
): void {
  if (buffer.length > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
    const actualSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
    throw new Error(
      `${context} buffer too large: ${actualSizeMB}MB (max: ${maxSizeMB}MB)`,
    );
  }
}

/**
 * Validates that a file's size is within the maximum allowed size.
 *
 * @param fileSize - The file size in bytes
 * @param maxSize - The maximum allowed size in bytes
 * @param context - Optional context for error messages (e.g., "Screenshot file")
 * @throws {Error} If the file exceeds the maximum size
 * @example
 * ```typescript
 * validateFileSize(stats.size, 10 * 1024 * 1024, "Screenshot file");
 * ```
 */
export function validateFileSize(
  fileSize: number,
  maxSize: number,
  context: string = "File",
): void {
  if (fileSize > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
    const actualSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
    throw new Error(`${context} too large: ${actualSizeMB}MB (max: ${maxSizeMB}MB)`);
  }
}

/**
 * Validates that a number is within a specified range.
 *
 * @param value - The number to validate
 * @param min - The minimum allowed value (inclusive)
 * @param max - The maximum allowed value (inclusive)
 * @param fieldName - The name of the field (for error messages)
 * @returns The validated number
 * @throws {Error} If the number is outside the range
 * @example
 * ```typescript
 * validateNumberRange(limit, 1, 100, "Limit"); // limit must be between 1 and 100
 * ```
 */
export function validateNumberRange(
  value: number,
  min: number,
  max: number,
  fieldName: string = "Value",
): number {
  if (typeof value !== "number" || value < min || value > max) {
    throw new Error(`${fieldName} must be a number between ${min} and ${max}`);
  }
  return value;
}

/**
 * Validates a version string format (semver with optional prerelease).
 * Supports formats: X.Y.Z, X.Y.Z-prerelease, X.Y, X
 *
 * @param version - The version string to validate
 * @returns The validated version string
 * @throws {Error} If the version format is invalid
 * @example
 * ```typescript
 * validateSemverVersion("1.2.3"); // Valid
 * validateSemverVersion("1.2.3-alpha.1"); // Valid
 * validateSemverVersion("1.2"); // Valid
 * validateSemverVersion("invalid"); // Throws error
 * ```
 */
export function validateSemverVersion(version: string): string {
  // Allow X.Y.Z, X.Y.Z-prerelease, X.Y, X formats
  const semverRegex =
    /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+]([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

  if (!semverRegex.test(version)) {
    throw new Error(
      `Invalid version format: '${version}'. Use 'X.Y.Z', 'X.Y.Z-prerelease', 'X.Y', or 'X'`,
    );
  }

  return version;
}

/**
 * Creates a reusable validator for required string fields.
 * Useful for consistent validation across multiple tools.
 *
 * @param fieldName - The name of the field to validate
 * @returns A validation function that takes a value and throws if invalid
 * @example
 * ```typescript
 * const validateLibraryName = createRequiredStringValidator("Library name");
 * validateLibraryName(library); // Throws if library is invalid
 * ```
 */
export function createRequiredStringValidator(fieldName: string) {
  return (value: unknown): void => validateRequiredString(value, fieldName);
}

/**
 * Creates a reusable validator for number range fields.
 *
 * @param min - Minimum value
 * @param max - Maximum value
 * @param fieldName - Field name for error messages
 * @returns A validation function
 * @example
 * ```typescript
 * const validateLimit = createNumberRangeValidator(1, 100, "Limit");
 * validateLimit(50); // Valid
 * validateLimit(150); // Throws error
 * ```
 */
export function createNumberRangeValidator(min: number, max: number, fieldName: string) {
  return (value: number): number => validateNumberRange(value, min, max, fieldName);
}

/**
 * Validation error types for categorization.
 */
export enum ValidationErrorCode {
  REQUIRED_FIELD_MISSING = "REQUIRED_FIELD_MISSING",
  INVALID_FORMAT = "INVALID_FORMAT",
  OUT_OF_RANGE = "OUT_OF_RANGE",
  EXCEEDS_MAXIMUM = "EXCEEDS_MAXIMUM",
  INVALID_URL = "INVALID_URL",
}

/**
 * Creates a structured validation error with code and context.
 * Useful for API responses and user-facing error messages.
 *
 * @param code - The error code from ValidationErrorCode
 * @param message - Human-readable error message
 * @param field - The field that failed validation
 * @param value - The invalid value
 * @returns An error object with structured information
 * @example
 * ```typescript
 * const error = createValidationError(
 *   ValidationErrorCode.REQUIRED_FIELD_MISSING,
 *   "Library name is required",
 *   "library",
 *   ""
 * );
 * ```
 */
export function createValidationError(
  code: ValidationErrorCode,
  message: string,
  field?: string,
  value?: unknown,
): { code: string; message: string; field?: string; value?: unknown } {
  return {
    code,
    message,
    field,
    value,
  };
}
