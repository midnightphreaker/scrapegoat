/**
 * Validation limits for form inputs.
 * These limits are enforced both on the frontend (via maxlength attributes)
 * and on the backend (via validation checks).
 *
 * IMPORTANT: If you update these limits, you must also update:
 * 1. Frontend: ScrapeFormContent.tsx (maxlength attributes)
 * 2. Backend: /web/routes/jobs/new.tsx (validation checks)
 */

export const VALIDATION_LIMITS = {
  /** Maximum URL length (standard browser limit) */
  URL: 2048,

  /** Maximum library name length (reasonable identifier length) */
  LIBRARY: 100,

  /** Maximum version string length (semver format with metadata) */
  VERSION: 50,

  /** Maximum pattern field length (include/exclude patterns) */
  PATTERNS: 2000,

  /** Maximum HTTP header name length */
  HEADER_NAME: 100,

  /** Maximum HTTP header value length */
  HEADER_VALUE: 500,
} as const;

/**
 * Validation error messages for exceeding limits
 */
export const VALIDATION_ERRORS = {
  URL: (length: number) =>
    `URL exceeds maximum length of ${VALIDATION_LIMITS.URL} characters (current: ${length})`,

  LIBRARY: (length: number) =>
    `Library name exceeds maximum length of ${VALIDATION_LIMITS.LIBRARY} characters (current: ${length})`,

  VERSION: (length: number) =>
    `Version exceeds maximum length of ${VALIDATION_LIMITS.VERSION} characters (current: ${length})`,

  PATTERNS: (field: string, length: number) =>
    `${field} patterns exceed maximum length of ${VALIDATION_LIMITS.PATTERNS} characters (current: ${length})`,

  HEADER_NAME: (length: number) =>
    `Header name exceeds maximum length of ${VALIDATION_LIMITS.HEADER_NAME} characters (current: ${length})`,

  HEADER_VALUE: (length: number) =>
    `Header value exceeds maximum length of ${VALIDATION_LIMITS.HEADER_VALUE} characters (current: ${length})`,
} as const;

/**
 * Validates a string against a maximum length
 * @param value The string to validate
 * @param maxLength The maximum allowed length
 * @param fieldName The name of the field (for error messages)
 * @returns Error message if validation fails, null otherwise
 */
export function validateMaxLength(
  value: string,
  maxLength: number,
  fieldName: string,
): string | null {
  if (value && value.length > maxLength) {
    return `${fieldName} exceeds maximum length of ${maxLength} characters (current: ${value.length})`;
  }
  return null;
}

/**
 * Validates all form fields against their maximum lengths
 * @param data The form data to validate
 * @returns ValidationError if validation fails, null otherwise
 */
export function validateFormFields(data: {
  url?: string;
  library?: string;
  version?: string;
  includePatterns?: string;
  excludePatterns?: string;
  headers?: Array<{ name: string; value: string }>;
}): string | null {
  if (data.url && data.url.length > VALIDATION_LIMITS.URL) {
    return VALIDATION_ERRORS.URL(data.url.length);
  }

  if (data.library && data.library.length > VALIDATION_LIMITS.LIBRARY) {
    return VALIDATION_ERRORS.LIBRARY(data.library.length);
  }

  if (data.version && data.version.length > VALIDATION_LIMITS.VERSION) {
    return VALIDATION_ERRORS.VERSION(data.version.length);
  }

  if (data.includePatterns && data.includePatterns.length > VALIDATION_LIMITS.PATTERNS) {
    return VALIDATION_ERRORS.PATTERNS("Include", data.includePatterns.length);
  }

  if (data.excludePatterns && data.excludePatterns.length > VALIDATION_LIMITS.PATTERNS) {
    return VALIDATION_ERRORS.PATTERNS("Exclude", data.excludePatterns.length);
  }

  // Validate header lengths
  if (data.headers) {
    for (let i = 0; i < data.headers.length; i++) {
      const header = data.headers[i];
      if (!header) continue;

      const headerName = header.name ?? "";
      const headerValue = header.value ?? "";

      if (headerName.length > VALIDATION_LIMITS.HEADER_NAME) {
        return `Header ${i + 1} name ${VALIDATION_ERRORS.HEADER_NAME(headerName.length)}`;
      }
      if (headerValue.length > VALIDATION_LIMITS.HEADER_VALUE) {
        return `Header ${i + 1} value ${VALIDATION_ERRORS.HEADER_VALUE(headerValue.length)}`;
      }
    }
  }

  return null;
}
