/**
 * Centralized constants for Scrapegoat
 * Replaces magic strings throughout the codebase with named constants
 */

// ============================================================================
// Fetcher Types
// ============================================================================

/**
 * Available fetcher types for content retrieval
 */
export const FetcherType = {
  /** Auto-detect based on URL and challenges */
  AUTO: "auto",
  /** Standard HTTP/HTTPS fetcher */
  HTTP: "http",
  /** Crawl4AI-enhanced browser fetcher */
  CRAWL4AI: "crawl4ai",
  /** Local file system fetcher */
  FILE: "file",
} as const;

/** Type alias for fetcher type values */
export type FetcherTypeValue = (typeof FetcherType)[keyof typeof FetcherType];

// ============================================================================
// MIME Types
// ============================================================================

/**
 * Common MIME type constants
 */
export const MimeType = {
  // Text types
  HTML: "text/html",
  XHTML: "application/xhtml+xml",
  MARKDOWN: "text/markdown",
  MARKDOWN_ALT: "text/x-markdown",
  PLAIN: "text/plain",
  CSS: "text/css",
  JAVASCRIPT: "text/javascript",

  // Application types
  JSON: "application/json",
  XML: "application/xml",
  PDF: "application/pdf",

  // Image types
  PNG: "image/png",
  JPEG: "image/jpeg",
  JPG: "image/jpg",
  GIF: "image/gif",
  SVG: "image/svg+xml",
  WEBP: "image/webp",

  // Video types
  MP4: "video/mp4",
  WEBM: "video/webm",

  // Audio types
  MP3: "audio/mpeg",
  WAV: "audio/wav",
  OGG: "audio/ogg",
} as const;

/** Type alias for MIME type values */
export type MimeTypeValue = (typeof MimeType)[keyof typeof MimeType];

// ============================================================================
// HTTP Headers
// ============================================================================

/**
 * Common HTTP header constants
 */
export const HttpHeader = {
  ACCEPT: "Accept",
  CONTENT_TYPE: "Content-Type",
  USER_AGENT: "User-Agent",
  AUTHORIZATION: "Authorization",
  LOCATION: "Location",
  ETAG: "ETag",
  LAST_MODIFIED: "Last-Modified",
} as const;

// ============================================================================
// Version Status
// ============================================================================

/**
 * Version indexing status constants
 */
export const VersionStatus = {
  /** Version created but never indexed */
  NOT_INDEXED: "not_indexed",
  /** Waiting in pipeline queue */
  QUEUED: "queued",
  /** Currently being indexed */
  RUNNING: "running",
  /** Re-indexing existing version */
  UPDATING: "updating",
  /** Successfully indexed */
  COMPLETED: "completed",
  /** Indexing failed */
  FAILED: "failed",
  /** Indexing was cancelled */
  CANCELLED: "cancelled",
} as const;

/** Type alias for version status values */
export type VersionStatusValue = (typeof VersionStatus)[keyof typeof VersionStatus];

// ============================================================================
// Pipeline Job Status
// ============================================================================

/**
 * Pipeline job status constants
 */
export const JobStatus = {
  /** Job is queued */
  QUEUED: "queued",
  /** Job is running */
  RUNNING: "running",
  /** Job completed successfully */
  COMPLETED: "completed",
  /** Job failed */
  FAILED: "failed",
  /** Job is being cancelled */
  CANCELLING: "cancelling",
  /** Job was cancelled */
  CANCELLED: "cancelled",
} as const;

/** Type alias for job status values */
export type JobStatusValue = (typeof JobStatus)[keyof typeof JobStatus];

// ============================================================================
// Crawl4AI Constants
// ============================================================================

/**
 * Crawl4AI cache mode options
 */
export const Crawl4AICacheMode = {
  /** Use cached content when available */
  ENABLED: "enabled",
  /** Bypass cache and fetch fresh content */
  DISABLED: "disabled",
  /** Bypass cache for this request */
  BYPASS: "bypass",
  /** Write to cache but don't read */
  WRITE_ONLY: "write_only",
  /** Read from cache only */
  READ_ONLY: "read_only",
  /** Always fetch fresh content */
  FRESH: "fresh",
} as const;

/** Type alias for cache mode values */
export type Crawl4AICacheModeValue =
  (typeof Crawl4AICacheMode)[keyof typeof Crawl4AICacheMode];

/**
 * Crawl4AI browser type options
 */
export const Crawl4AIBrowserType = {
  /** Chromium browser (default) */
  CHROMIUM: "chromium",
  /** Firefox browser */
  FIREFOX: "firefox",
  /** WebKit browser */
  WEBKIT: "webkit",
} as const;

/** Type alias for browser type values */
export type Crawl4AIBrowserTypeValue =
  (typeof Crawl4AIBrowserType)[keyof typeof Crawl4AIBrowserType];

/**
 * Crawl4AI stealth mode options
 */
export const Crawl4AIStealthMode = {
  /** Stealth mode disabled */
  DISABLED: "disabled",
  /** Basic stealth mode */
  BASIC: "basic",
  /** Advanced stealth mode */
  ADVANCED: "advanced",
} as const;

/** Type alias for stealth mode values */
export type Crawl4AIStealthModeValue =
  (typeof Crawl4AIStealthMode)[keyof typeof Crawl4AIStealthMode];

/**
 * Crawl4AI screenshot mode options
 */
export const Crawl4AIScreenshotMode = {
  /** Viewport screenshot */
  VIEWPORT: "viewport",
  /** Full page screenshot */
  FULL: "full",
} as const;

/** Type alias for screenshot mode values */
export type Crawl4AIScreenshotModeValue =
  (typeof Crawl4AIScreenshotMode)[keyof typeof Crawl4AIScreenshotMode];

/**
 * Crawl4AI virtual scroll options
 */
export const Crawl4AIVirtualScroll = {
  /** Default scroll by container height */
  CONTAINER_HEIGHT: "container_height",
  /** Scroll by page height */
  PAGE_HEIGHT: "page_height",
} as const;

/** Type alias for virtual scroll values */
export type Crawl4AIVirtualScrollValue =
  (typeof Crawl4AIVirtualScroll)[keyof typeof Crawl4AIVirtualScroll];

// ============================================================================
// Scraper Scope Options
// ============================================================================

/**
 * Scraper scope constants for defining crawl boundaries
 */
export const ScraperScope = {
  /** Only crawl subpages of the URL */
  SUBPAGES: "subpages",
  /** Crawl within the same hostname */
  HOSTNAME: "hostname",
  /** Crawl within the same domain */
  DOMAIN: "domain",
} as const;

/** Type alias for scraper scope values */
export type ScraperScopeValue = (typeof ScraperScope)[keyof typeof ScraperScope];

// ============================================================================
// Error Messages
// ============================================================================

/**
 * Common error message templates
 */
export const ErrorMessages = {
  /** Generic fetcher error message */
  FETCHER_NOT_AVAILABLE: (fetcher: string) => `Fetcher "${fetcher}" is not available`,
  /** Service not available error */
  SERVICE_NOT_AVAILABLE: (service: string, url: string) =>
    `${service} service is not available at ${url}. Ensure the service is running.`,
  /** Circuit breaker open error */
  CIRCUIT_BREAKER_OPEN: (service: string, resetTimeout: number) =>
    `${service} service circuit breaker is open. Service appears to be unavailable. Try again in ${Math.ceil(resetTimeout / 1000)}s`,
  /** Content validation error */
  EMPTY_CONTENT: (source: string) => `No content retrieved from ${source}`,
  /** Timeout error */
  TIMEOUT: (source: string, timeout: number) =>
    `Request to ${source} timed out after ${timeout}ms`,
  /** Network error */
  NETWORK_ERROR: (source: string, error: string) =>
    `Network error fetching ${source}: ${error}`,
} as const;

// ============================================================================
// Environment Variable Names
// ============================================================================

/**
 * Environment variable name constants
 */
export const EnvVar = {
  /** Crawl4AI service URL */
  CRAWL4AI_SERVICE_URL: "CRAWL4AI_SERVICE_URL",
  /** Qdrant URL */
  QDRANT_URL: "QDRANT_URL",
  /** Database URL */
  DATABASE_URL: "DATABASE_URL",
  /** OpenAI API Key */
  OPENAI_API_KEY: "OPENAI_API_KEY",
  /** Cohere API Key */
  COHERE_API_KEY: "COHERE_API_KEY",
  /** HuggingFace API Key */
  HUGGINGFACE_API_KEY: "HUGGINGFACE_API_KEY",
  /** Embedding provider */
  EMBEDDING_PROVIDER: "EMBEDDING_PROVIDER",
  /** Embedding model */
  EMBEDDING_MODEL: "EMBEDDING_MODEL",
  /** Log level */
  LOG_LEVEL: "LOG_LEVEL",
  /** MCP port */
  MCP_PORT: "MCP_PORT",
  /** Web server port */
  WEB_PORT: "WEB_PORT",
  /** Enable screenshots */
  ENABLE_SCREENSHOTS: "ENABLE_SCREENSHOTS",
  /** Enable media extraction */
  ENABLE_MEDIA: "ENABLE_MEDIA",
  /** Enable link extraction */
  ENABLE_LINKS: "ENABLE_LINKS",
} as const;

// ============================================================================
// Content Type Aliases
// ============================================================================

/**
 * Content type to file extension mapping
 */
export const FileExtensions = {
  [MimeType.HTML]: ".html",
  [MimeType.MARKDOWN]: ".md",
  [MimeType.JSON]: ".json",
  [MimeType.XML]: ".xml",
  [MimeType.PDF]: ".pdf",
  [MimeType.PNG]: ".png",
  [MimeType.JPEG]: ".jpg",
  [MimeType.GIF]: ".gif",
  [MimeType.SVG]: ".svg",
  [MimeType.CSS]: ".css",
  [MimeType.JAVASCRIPT]: ".js",
} as const;

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default configuration values
 */
export const Defaults = {
  /** Default HTTP timeout in milliseconds */
  HTTP_TIMEOUT: 30000,
  /** Default Crawl4AI timeout in milliseconds */
  CRAWL4AI_TIMEOUT: 60000,
  /** Default max retries */
  MAX_RETRIES: 3,
  /** Default retry delay in milliseconds */
  RETRY_DELAY: 1000,
  /** Default max concurrent requests */
  MAX_CONCURRENCY: 5,
  /** Default max pages to scrape */
  MAX_PAGES: 100,
  /** Default max depth */
  MAX_DEPTH: 3,
  /** Default wait for selector timeout */
  WAIT_FOR_TIMEOUT: 30000,
  /** Default virtual scroll delay */
  VIRTUAL_SCROLL_DELAY: 0.5,
  /** Default virtual scroll max pages */
  VIRTUAL_SCROLL_MAX_PAGES: 10,
} as const;
