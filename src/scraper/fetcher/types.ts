import {
  FetcherType as FetcherTypeConst,
  type FetcherTypeValue,
} from "../../utils/constants";

/**
 * Available fetcher types for content retrieval
 * Note: 'browser' has been removed - use 'crawl4ai' instead
 */
export type FetcherType = FetcherTypeValue;

/** Re-export FetcherType constants for convenience */
export { FetcherTypeConst };

/** Type aliases and const imports for Crawl4AI options */
import {
  Crawl4AIBrowserType as Crawl4AIBrowserTypeConst,
  type Crawl4AIBrowserTypeValue,
  Crawl4AICacheMode as Crawl4AICacheModeConst,
  type Crawl4AICacheModeValue,
  Crawl4AIStealthMode as Crawl4AIStealthModeConst,
  type Crawl4AIStealthModeValue,
} from "../../utils/constants";

// Re-export const objects for convenience
export {
  Crawl4AICacheModeConst as Crawl4AICacheMode,
  Crawl4AIBrowserTypeConst as Crawl4AIBrowserType,
  Crawl4AIStealthModeConst as Crawl4AIStealthMode,
};

// Re-export type aliases for convenience
export type {
  Crawl4AICacheModeValue,
  Crawl4AIBrowserTypeValue,
  Crawl4AIStealthModeValue,
};

/**
 * Media item extracted from page
 */
export interface MediaItem {
  type: "image" | "video" | "audio";
  /** URL (may also be returned as "src" from service) */
  url?: string;
  /** Alternate field name that some services return instead of "url" */
  src?: string;
  alt?: string;
  width?: number;
  height?: number;
}

/**
 * Validates that a MediaItem has a valid URL (either url or src field)
 */
export function hasValidMediaUrl(item: MediaItem): item is MediaItem & { url: string } {
  return typeof item.url === "string" && item.url.length > 0;
}

/**
 * Link extracted from page
 */
export interface LinkItem {
  /** URL (may also be returned as "href" from service) */
  url: string;
  /** Link text (may also be returned as "title" from service) */
  text: string;
  /** Alternate field name for URL that some services return */
  href?: string;
  /** Alternate field name for text that some services return */
  title?: string;
  /** Rel attribute */
  rel?: string;
}

/**
 * Validates that a LinkItem has a valid URL (either url or href field)
 */
export function hasValidLinkUrl(item: LinkItem): item is LinkItem & { url: string } {
  return typeof item.url === "string" && item.url.length > 0;
}

/**
 * Extended page metadata
 */
export interface PageMetadata {
  media?: MediaItem[];
  links?: LinkItem[];
  [key: string]: unknown; // Allow other metadata
}

/**
 * Crawl4AI configuration options
 * These options control enhanced content extraction features provided by Crawl4AI v0.8.0
 */
export interface Crawl4AIOptions {
  // Content Enhancement
  /** Enable screenshot capture (default: false) */
  screenshot?: boolean;
  /** Enable media extraction (images/videos/audio with metadata) (default: false) */
  extractMedia?: boolean;
  /** Enable link extraction with context (default: false) */
  enableLinks?: boolean;

  // Legacy options (for backward compatibility)
  /**
   * @deprecated Use `screenshot` instead
   */
  enableScreenshot?: boolean;
  /**
   * @deprecated Use `screenshot` instead. Valid values: "viewport" or "full"
   */
  screenshotMode?: "viewport" | "full";
  /**
   * @deprecated Use `extractMedia` instead
   */
  enableMedia?: boolean;

  // Advanced Scraping
  /** CSS selector to wait for before capture (default: '') */
  waitFor?: string;
  /** Maximum wait time for dynamic content in milliseconds (default: 30000) */
  waitForTimeout?: number;
  /** Custom JavaScript to execute before capture (default: '') */
  customJs?: string;
  /** Control Crawl4AI internal caching (default: 'bypass' for fresh content) */
  cacheMode?: Crawl4AICacheModeValue | keyof typeof Crawl4AICacheModeConst;
  /** Custom HTTP headers for requests (default: {}) */
  headers?: Record<string, string>;
  /** Stealth mode for anti-detection (default: undefined) */
  stealthMode?: Crawl4AIStealthModeValue | keyof typeof Crawl4AIStealthModeConst;

  // v0.8.0 Browser Configuration
  /** Browser type: 'chromium' (default), 'firefox', or 'webkit' */
  browserType?: Crawl4AIBrowserTypeValue | keyof typeof Crawl4AIBrowserTypeConst;
  /** Run browser in headless mode (default: true) */
  browserHeadless?: boolean;
  /** Enable verbose browser logging (default: false) */
  browserVerbose?: boolean;
  /** Custom user agent string */
  userAgent?: string;

  // v0.8.0 Virtual Scroll (requires containerSelector)
  /** Enable virtual scrolling for dynamic content (default: false) */
  virtualScrollEnabled?: boolean;
  /** CSS selector for the scrollable container (required if virtualScrollEnabled is true) */
  virtualScrollContainerSelector?: string;
  /** Maximum number of scrolls to perform (default: 10) */
  virtualScrollMaxPages?: number;
  /** Delay between scrolls in seconds (default: 0.5) */
  virtualScrollDelay?: number;
  /** Amount to scroll: "container_height", "page_height", or integer pixels (default: "container_height") */
  virtualScrollScrollBy?: string | number;
}

/**
 * Raw content fetched from a source before processing.
 * Includes metadata about the content for proper processing.
 * Now includes optional enhanced features from Crawl4AI.
 */
export interface RawContent {
  /** Raw content as string or buffer */
  content: string | Buffer;
  /**
   * MIME type of the content (e.g., "text/html", "application/json").
   * Does not include parameters like charset.
   */
  mimeType: string;
  /**
   * Character set of the content (e.g., "utf-8"), extracted from Content-Type header.
   */
  charset?: string;
  /**
   * Content encoding (e.g., "gzip", "deflate"), from Content-Encoding header.
   */
  encoding?: string;
  /** Original source location */
  source: string;
  /** Optional screenshot (base64 or buffer) */
  screenshot?: string | Buffer;
  /** Optional extracted media items */
  media?: MediaItem[];
  /** Optional extracted links */
  links?: LinkItem[];
  /** Fetcher type used to retrieve this content */
  fetcherType?: FetcherType;
}

/**
 * Options for configuring content fetching behavior
 */
export interface FetchOptions {
  /** Maximum retry attempts for failed fetches */
  maxRetries?: number;
  /** Base delay between retries in milliseconds */
  retryDelay?: number;
  /** Additional headers for HTTP requests */
  headers?: Record<string, string>;
  /** Timeout in milliseconds */
  timeout?: number;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Whether to follow HTTP redirects (3xx responses) */
  followRedirects?: boolean;
  /**
   * Explicit fetcher selection.
   * Default: 'auto' (auto-detection based on URL and challenges)
   *
   * Priority: fetcher > useCrawl4AI > auto-detection
   */
  fetcher?: FetcherType;
  /**
   * @deprecated Use `fetcher: 'crawl4ai'` instead.
   *
   * **Migration Guide:**
   * - Old: `{ useCrawl4AI: true }`
   * - New: `{ fetcher: 'crawl4ai' }`
   * - For auto-detection: `{ fetcher: 'auto' }`
   *
   * Whether to use Crawl4AI for content fetching.
   * When true, AutoDetectFetcher will select Crawl4AIFetcher.
   *
   * @example
   * // Deprecated
   * { useCrawl4AI: true }
   *
   * // New approach
   * { fetcher: 'crawl4ai' }
   */
  useCrawl4AI?: boolean;
  /** Crawl4AI-specific options */
  crawl4ai?: Crawl4AIOptions;
}

/**
 * Interface for fetching content from different sources
 */
export interface ContentFetcher {
  /**
   * Check if this fetcher can handle the given source
   */
  canFetch(source: string): boolean;

  /**
   * Fetch content from the source
   */
  fetch(source: string, options?: FetchOptions): Promise<RawContent>;
}
