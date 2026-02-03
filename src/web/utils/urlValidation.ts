/**
 * URL validation utilities for client-side form validation.
 * Provides real-time feedback for URL input fields.
 */

export interface UrlValidationResult {
  isValid: boolean;
  errorMessage?: string;
  errorType?: "empty" | "invalid" | "unsupported" | "inaccessible";
}

/**
 * Validates a URL string for common issues.
 * Provides detailed error messages for different validation failures.
 *
 * @param url - The URL string to validate
 * @returns UrlValidationResult with validation status and optional error message
 */
export function validateUrlInput(url: string): UrlValidationResult {
  // Check if empty
  if (!url || url.trim().length === 0) {
    return {
      isValid: false,
      errorMessage: "URL is required",
      errorType: "empty",
    };
  }

  const trimmedUrl = url.trim();

  // Basic URL format validation using native URL constructor
  try {
    new URL(trimmedUrl);
  } catch (_error) {
    return {
      isValid: false,
      errorMessage:
        "Invalid URL format. Please enter a valid URL (e.g., https://docs.example.com)",
      errorType: "invalid",
    };
  }

  const parsedUrl = new URL(trimmedUrl);

  // Check for supported protocols
  const supportedProtocols = ["http:", "https:", "file:"];
  if (!supportedProtocols.includes(parsedUrl.protocol)) {
    return {
      isValid: false,
      errorMessage: `Unsupported protocol "${parsedUrl.protocol}". Please use http://, https://, or file://`,
      errorType: "unsupported",
    };
  }

  // For file:// URLs, add specific guidance
  if (parsedUrl.protocol === "file:") {
    // Check if file URL has a valid path
    if (!parsedUrl.pathname || parsedUrl.pathname === "/") {
      return {
        isValid: false,
        errorMessage: "File URL must include a valid path (e.g., file:///path/to/docs)",
        errorType: "invalid",
      };
    }
  }

  // For http/https URLs, validate hostname
  if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
    if (!parsedUrl.hostname) {
      return {
        isValid: false,
        errorMessage: "URL must include a valid hostname (e.g., docs.example.com)",
        errorType: "invalid",
      };
    }

    // Warn about localhost (but don't block it)
    if (
      parsedUrl.hostname === "localhost" ||
      parsedUrl.hostname === "127.0.0.1" ||
      parsedUrl.hostname.startsWith("192.168.") ||
      parsedUrl.hostname.startsWith("10.") ||
      parsedUrl.hostname.startsWith("172.16.")
    ) {
      // This is valid but may need special handling
      // Return valid but could show a warning
    }
  }

  // URL is valid
  return {
    isValid: true,
  };
}

/**
 * Gets CSS classes for URL input field based on validation state.
 *
 * @param validationResult - The validation result from validateUrlInput
 * @param hasUserInteracted - Whether the user has interacted with the field
 * @returns CSS classes string
 */
export function getUrlInputClasses(
  validationResult: UrlValidationResult,
  hasUserInteracted: boolean,
): string {
  const baseClasses =
    "block w-full px-3 py-2 border rounded-xl shadow-sm focus:outline-none focus:ring-2 transition-colors duration-150 text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100";

  if (!hasUserInteracted) {
    return `${baseClasses} border-stone-300 dark:border-stone-600 focus:ring-primary-600 focus:border-primary-600`;
  }

  if (validationResult.isValid) {
    return `${baseClasses} border-green-500 dark:border-green-600 focus:ring-green-600 focus:border-green-600`;
  }

  // Invalid state
  return `${baseClasses} border-red-500 dark:border-red-600 focus:ring-red-600 focus:border-red-600`;
}

/**
 * Checks if a URL has a path component (for showing scope-related info).
 *
 * @param url - The URL string to check
 * @returns true if URL has a non-root path
 */
export function urlHasPath(url: string): boolean {
  try {
    const parsedUrl = new URL(url.trim());
    return (
      parsedUrl.pathname !== "/" &&
      parsedUrl.pathname !== "" &&
      parsedUrl.pathname !== "/"
    );
  } catch {
    return false;
  }
}

/**
 * Checks if a URL is a file:// URL.
 *
 * @param url - The URL string to check
 * @returns true if URL uses file:// protocol
 */
export function isFileUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url.trim());
    return parsedUrl.protocol === "file:";
  } catch {
    return false;
  }
}
