/**
 * Available fetcher types for content retrieval
 */
export type FetcherType = "auto" | "http" | "browser" | "crawl4ai" | "file";

/**
 * Media item extracted from page
 */
export interface MediaItem {
  type: "image" | "video" | "audio";
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

/**
 * Link extracted from page
 */
export interface LinkItem {
  url: string;
  text: string;
  rel?: string;
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
 */
export interface Crawl4AIOptions {
  /** Enable screenshot capture */
  enableScreenshot?: boolean;
  /** Screenshot mode: viewport or full page */
  screenshotMode?: "viewport" | "full";
  /** Enable media extraction */
  enableMedia?: boolean;
  /** Enable link extraction */
  enableLinks?: boolean;
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
   * @deprecated Use fetcher: 'crawl4ai' instead.
   * Whether to use Crawl4AI for content fetching.
   * When true, AutoDetectFetcher will select Crawl4AIFetcher.
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
