/**
 * Input sanitization utilities for scrapegoat web interface.
 * Provides security-focused sanitization functions to prevent:
 * - XSS attacks
 * - Command injection
 * - Header injection
 * - URL protocol attacks
 * - Path traversal
 *
 * All user input should be sanitized before processing.
 *
 * @module utils/sanitization
 */

import {
  InvalidHeaderError,
  MaliciousUrlError,
  ValidationError,
} from "../../utils/errors";

/**
 * Sanitizes a string by removing or escaping dangerous characters.
 * Prevents XSS by encoding HTML entities and removing script injection patterns.
 *
 * @param input - The string to sanitize
 * @returns Sanitized string with HTML entities encoded and dangerous patterns removed
 */
export function sanitizeString(input: string): string {
  if (!input) return "";

  const str = String(input);

  // Encode HTML entities to prevent XSS
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Sanitizes library names according to package naming conventions.
 * Allows only alphanumeric characters, hyphens, underscores, and dots.
 * Removes spaces, special characters, and potentially dangerous symbols.
 *
 * Allowed pattern: ^[a-zA-Z0-9._-]+$
 *
 * @param libraryName - The library name to sanitize
 * @returns Sanitized library name
 * @example
 * sanitizeLibraryName("react-dom") // "react-dom"
 * sanitizeLibraryName("vue@3") // "vue3"
 * sanitizeLibraryName("my library") // "mylibrary"
 */
export function sanitizeLibraryName(libraryName: string): string {
  if (!libraryName) return "";

  // Remove leading/trailing whitespace and convert to lowercase
  let sanitized = libraryName.trim().toLowerCase();

  // Remove all characters except alphanumeric, hyphen, underscore, dot
  // This prevents injection attacks and ensures valid package names
  sanitized = sanitized.replace(/[^a-z0-9._-]/g, "");

  // Remove consecutive dots/hyphens/underscores
  sanitized = sanitized.replace(/[._-]{2,}/g, ".");

  // Remove leading/trailing dots, hyphens, underscores
  sanitized = sanitized.replace(/^[._-]+|[._-]+$/g, "");

  return sanitized;
}

/**
 * Sanitizes version strings according to semantic versioning (semver) format.
 * Allows versions in format: X.Y.Z, X.Y.Z-prerelease, X.Y.Z+metadata
 * Removes 'v' prefix and invalid characters.
 *
 * Allowed pattern: ^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$
 *
 * @param version - The version string to sanitize
 * @returns Sanitized version string, or undefined if invalid
 * @example
 * sanitizeVersion("18.2.0") // "18.2.0"
 * sanitizeVersion("v18.2.0") // "18.2.0"
 * sanitizeVersion("18.2.0-beta.1") // "18.2.0-beta.1"
 * sanitizeVersion("invalid") // undefined
 */
export function sanitizeVersion(version: string): string | undefined {
  if (!version || typeof version !== "string") {
    return undefined;
  }

  let sanitized = version.trim();

  // Remove 'v' prefix if present (common user mistake)
  if (sanitized.toLowerCase().startsWith("v")) {
    sanitized = sanitized.substring(1);
  }

  // Validate semver format: X.Y.Z with optional prerelease and metadata
  // Strict semver regex from semver.org
  const semverRegex =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

  if (!semverRegex.test(sanitized)) {
    // If not valid semver, try to extract numbers as fallback
    const numbers = sanitized.match(/\d+/g);
    if (numbers && numbers.length >= 3) {
      // Only extract if we have at least 3 numbers for X.Y.Z format
      return numbers.slice(0, 3).join(".");
    } else if (numbers && numbers.length >= 2) {
      // For X.Y format, add .0 as patch
      return `${numbers[0]}.${numbers[1]}.0`;
    }
    return undefined;
  }

  return sanitized;
}

/**
 * Sanitizes URL patterns (include/exclude patterns).
 * Allows glob patterns and regex (wrapped in /) but prevents injection attacks.
 * For regex patterns, validates they are valid before accepting.
 *
 * @param patterns - Comma-separated or newline-separated patterns
 * @returns Array of sanitized pattern strings, or undefined if input is empty
 */
export function sanitizePatterns(patterns: string): string[] | undefined {
  if (!patterns || typeof patterns !== "string") {
    return undefined;
  }

  // Split by newline or comma
  const patternList = patterns
    .split(/\n|,/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (patternList.length === 0) {
    return undefined;
  }

  const sanitized: string[] = [];

  for (const pattern of patternList) {
    let sanitizedPattern = pattern;

    // Check if it's a regex pattern (wrapped in /)
    if (pattern.startsWith("/") && pattern.endsWith("/")) {
      const regexBody = pattern.slice(1, -1);

      // Try to validate the regex
      try {
        new RegExp(regexBody);
        // If valid, keep as-is (user takes responsibility for regex)
        sanitizedPattern = pattern;
      } catch (_e) {
        // Invalid regex, remove slashes and sanitize as glob
        sanitizedPattern = regexBody.replace(/[^a-zA-Z0-9*?[\]{}().|\\]/g, "");
      }
    } else {
      // For glob patterns, remove dangerous characters but keep glob syntax
      // Allow: alphanumeric, *, ?, [, ], {, }, ., /, -, _
      sanitizedPattern = pattern.replace(/[^a-zA-Z0-9*?[{}\]./\-_]/g, "");
    }

    // Prevent protocol injection in patterns
    // Remove any :// or javascript:, data:, etc.
    sanitizedPattern = sanitizedPattern.replace(
      /(javascript|data|vbscript|file|http|https):/gi,
      "",
    );

    if (sanitizedPattern.length > 0) {
      sanitized.push(sanitizedPattern);
    }
  }

  return sanitized.length > 0 ? sanitized : undefined;
}

/**
 * Enhanced URL sanitization with protocol validation and malicious input detection.
 * Blocks dangerous protocols and validates URL structure.
 *
 * @param url - The URL to sanitize
 * @returns Sanitized URL string
 * @throws Error if URL contains malicious content or invalid protocol
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== "string") {
    throw new ValidationError("url", url, "URL is required");
  }

  const trimmed = url.trim();

  // Block URL-encoded malicious content
  // Check for common XSS patterns in URL encoding
  const encodedXssPatterns = [
    /%3[Cc]%53[Aa]%74[Cc]%72 [Ii]%50[Pp]%74/, // <script> encoded
    /%3[Ee]/, // > encoded
    /%26%23x?3[Cc]/, // < encoded (various forms)
    /%3[Cc]/, // < encoded
  ];

  for (const pattern of encodedXssPatterns) {
    if (pattern.test(trimmed)) {
      throw new MaliciousUrlError(
        trimmed,
        "contains potentially malicious encoded content",
      );
    }
  }

  // Check for dangerous protocols (case-insensitive)
  // Note: file: will be validated separately below
  const dangerousProtocols = [
    "javascript:",
    "data:",
    "vbscript:",
    "ftp:",
    "mailto:",
    "sms:",
    "tel:",
  ];

  const lowerUrl = trimmed.toLowerCase();
  for (const protocol of dangerousProtocols) {
    if (lowerUrl.startsWith(protocol)) {
      throw new MaliciousUrlError(
        trimmed,
        `dangerous protocol "${protocol}" is not allowed`,
      );
    }
  }

  // Validate URL format using URL constructor
  try {
    const parsed = new URL(trimmed);

    // Only allow http, https, and file protocols
    const allowedProtocols = ["http:", "https:", "file:"];
    if (!allowedProtocols.includes(parsed.protocol)) {
      throw new MaliciousUrlError(
        trimmed,
        `unsupported protocol "${parsed.protocol}". Only http, https, and file are allowed`,
      );
    }

    // For file:// URLs, validate the path structure
    if (parsed.protocol === "file:") {
      // Ensure file URL has a valid path
      if (!parsed.pathname || parsed.pathname === "/") {
        throw new MaliciousUrlError(trimmed, "file URL must include a valid path");
      }
    }

    // For http/https URLs, do additional hostname validation
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      if (!parsed.hostname) {
        throw new MaliciousUrlError(trimmed, "must include a valid hostname");
      }

      // Warn about private IP addresses (but don't block)
      const privateIpPatterns = [
        /^localhost$/,
        /^127\./,
        /^192\.168\./,
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[01])\./,
      ];

      if (privateIpPatterns.some((pattern) => pattern.test(parsed.hostname))) {
        // Log warning but allow - useful for development
        console.warn(`URL contains private IP address: ${parsed.hostname}`);
      }
    }

    return trimmed;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new MaliciousUrlError(trimmed, "invalid URL format");
  }
}

/**
 * Sanitizes HTTP headers according to RFC 7230 standards.
 * Validates header names and values, preventing injection attacks.
 *
 * @param headers - Array of header objects with name and value
 * @returns Array of sanitized header objects
 * @throws Error if headers contain invalid or malicious content
 */
export function sanitizeHeaders(
  headers: Array<{ name: string; value: string }>,
): Array<{ name: string; value: string }> {
  if (!headers || !Array.isArray(headers)) {
    return [];
  }

  const sanitized: Array<{ name: string; value: string }> = [];

  for (const header of headers) {
    const name = header.name?.trim();
    const value = header.value?.trim();

    if (!name || !value) {
      continue; // Skip empty headers
    }

    // Validate header name: alphanumeric and hyphens only (RFC 7230)
    const sanitizedName = name.replace(/[^a-zA-Z0-9-]/g, "");
    if (!sanitizedName) {
      throw new InvalidHeaderError(name, value, "invalid header name format");
    }

    // Prevent header injection: remove newlines and carriage returns
    const sanitizedValue = value.replace(/[\r\n]/g, " ").trim();

    // Validate header value: allow printable ASCII, remove control characters
    // According to RFC 7230, header values should be printable ASCII
    const validatedValue = sanitizedValue.replace(/[\x00-\x1F\x7F]/g, "");

    // Check for CRLF injection attempts
    if (/%0[dD]%0[aA]|%0[aA]%0[dD]/i.test(value)) {
      throw new InvalidHeaderError(
        name,
        value,
        "contains potential CRLF injection attempt",
      );
    }

    // Block dangerous header names that could override security headers
    const dangerousHeaders = [
      "host",
      "content-length",
      "transfer-encoding",
      "connection",
      "upgrade",
    ];

    if (dangerousHeaders.includes(sanitizedName.toLowerCase())) {
      throw new InvalidHeaderError(
        name,
        value,
        `setting "${sanitizedName}" header is not allowed for security reasons`,
      );
    }

    sanitized.push({
      name: sanitizedName,
      value: validatedValue,
    });
  }

  return sanitized;
}

/**
 * Comprehensive sanitization result object.
 * Contains both the sanitized values and warnings about modifications made.
 */
export interface SanitizationResult {
  url: string;
  library: string;
  version?: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  headers: Array<{ name: string; value: string }>;
  warnings: string[];
}

/**
 * Sanitizes all form inputs for a scrape job request.
 * Provides comprehensive sanitization and returns warnings for any modifications.
 *
 * @param formData - The raw form data from the request
 * @returns SanitizationResult with sanitized values and any warnings
 */
export function sanitizeScrapeFormData(formData: {
  url: string;
  library: string;
  version?: string;
  includePatterns?: string;
  excludePatterns?: string;
  headers?: Array<{ name: string; value: string }>;
}): SanitizationResult {
  const warnings: string[] = [];

  // Sanitize URL (throws if invalid)
  const sanitizedUrl = sanitizeUrl(formData.url);

  // Sanitize library name
  const sanitizedLibrary = sanitizeLibraryName(formData.library);
  if (sanitizedLibrary !== formData.library.trim()) {
    warnings.push(
      `Library name was sanitized: "${formData.library}" → "${sanitizedLibrary}"`,
    );
  }

  // Sanitize version
  let sanitizedVersion: string | undefined;
  if (formData.version) {
    sanitizedVersion = sanitizeVersion(formData.version);
    if (sanitizedVersion && sanitizedVersion !== formData.version.trim()) {
      warnings.push(
        `Version was sanitized: "${formData.version}" → "${sanitizedVersion}"`,
      );
    }
    if (!sanitizedVersion) {
      warnings.push(
        `Invalid version "${formData.version}" was ignored. Using latest version.`,
      );
    }
  }

  // Sanitize patterns
  const sanitizedIncludePatterns = formData.includePatterns
    ? sanitizePatterns(formData.includePatterns)
    : undefined;

  const sanitizedExcludePatterns = formData.excludePatterns
    ? sanitizePatterns(formData.excludePatterns)
    : undefined;

  // Sanitize headers
  const sanitizedHeaders = formData.headers ? sanitizeHeaders(formData.headers) : [];

  return {
    url: sanitizedUrl,
    library: sanitizedLibrary,
    version: sanitizedVersion,
    includePatterns: sanitizedIncludePatterns,
    excludePatterns: sanitizedExcludePatterns,
    headers: sanitizedHeaders,
    warnings,
  };
}
