/**
 * TypeScript type definitions for Crawl4AI service communication.
 * These types mirror the Python Pydantic models in services/crawl4ai/app/models.py
 * and match the official Crawl4AI v0.8.0 API.
 */

import type { LinkItem, MediaItem } from "../types";

/**
 * Cache mode options for Crawl4AI v0.8.0
 * Note: "fresh" maps to "bypass" for backward compatibility
 */
export type CacheMode =
  | "enabled"
  | "disabled"
  | "bypass"
  | "write_only"
  | "read_only"
  | "fresh";

/**
 * Screenshot mode - simplified to boolean in Crawl4AI v0.8.0
 * Additional control via screenshot_wait_for and screenshot_height_threshold
 */
export type ScreenshotMode = boolean;

/**
 * Browser type options for Crawl4AI v0.8.0
 * Note: Uses chromium/firefox/webkit - NOT "playwright" or "undetected"
 * For anti-bot detection, use enable_stealth in BrowserConfig instead.
 */
export type BrowserType = "chromium" | "firefox" | "webkit";

/**
 * Proxy configuration for crawling
 */
export interface ProxyConfig {
  server: string;
  username?: string;
  password?: string;
}

/**
 * Browser configuration for Crawl4AI v0.8.0
 * Maps to Crawl4AI's BrowserConfig class
 */
export interface BrowserConfig {
  /** Browser type to use (chromium, firefox, or webkit) */
  browserType?: BrowserType;
  /** Run browser in headless mode */
  headless?: boolean;
  /** Enable verbose logging */
  verbose?: boolean;
  /** Custom user agent string */
  userAgent?: string;
  /** Custom headers to send with requests */
  headers?: Record<string, string>;
  /** Enable stealth mode for anti-bot detection (replaces "undetected" browser type) */
  enableStealth?: boolean;
}

/**
 * Virtual scroll configuration for Crawl4AI v0.8.0
 * Enables automatic scrolling to load dynamic content
 * Based on official Crawl4AI VirtualScrollConfig class
 */
export interface VirtualScrollConfig {
  /** CSS selector for the scrollable container (required) */
  containerSelector: string;
  /** Maximum number of scrolls to perform */
  scrollCount?: number;
  /** Amount to scroll: "container_height", "page_height", or pixel values like "100px" */
  scrollBy?: "container_height" | "page_height" | `${number}px`;
  /** Seconds to wait after each scroll */
  waitAfterScroll?: number;
}

/**
 * Hooks configuration - NOT SUPPORTED via API
 *
 * Hooks in Crawl4AI v0.8.0 are async Python functions that must be
 * defined server-side. They cannot be passed as JavaScript strings.
 *
 * Available server-side hooks (for reference):
 * - on_browser_created: After browser creation
 * - on_page_context_created: After page/context created (ideal for auth)
 * - before_goto: Before navigation
 * - after_goto: After navigation completes
 * - on_user_agent_updated: When user agent changes
 * - on_execution_started: When custom JS execution begins
 * - before_retrieve_html: Before retrieving final HTML
 * - before_return_html: Before returning HTML content
 *
 * @deprecated Hooks are not supported via the client API.
 * **Reason:** Hooks must be implemented server-side in the Python crawler service for security and performance reasons.
 * **Alternative:** Use the `customJs` option for JavaScript execution, or modify the crawler service directly.
 *
 * @see Crawl4AIOptions.customJs for client-side custom JavaScript execution
 */
export type HooksConfig = never;

/**
 * URL pattern configuration for multi-URL crawling
 * Allows different crawl configurations based on URL patterns
 */
export interface UrlPatternConfig {
  /** URL pattern (supports wildcards, e.g., 'https://example.com/docs/*') */
  pattern: string;
  /** Higher priority patterns are checked first (0-100) */
  priority?: number;
  /** Crawl configuration for this pattern */
  config: Crawl4AIConfig;
}

/**
 * Multi-URL crawl configuration with pattern matching
 */
export interface MultiUrlCrawlConfig {
  /** Default configuration for URLs that don't match any pattern */
  defaultConfig?: Crawl4AIConfig;
  /** URL-specific configurations with patterns */
  urlPatterns?: UrlPatternConfig[];
}

/**
 * Configuration options for Crawl4AI crawling (v0.8.0)
 * Matches Crawl4AI's CrawlerRunConfig class
 */
export interface Crawl4AIConfig {
  cacheMode?: CacheMode;
  waitFor?: string; // CSS selector to wait for
  waitForTimeout?: number; // 0-60000ms
  useFitMarkdown?: boolean; // Use BM25-filtered markdown
  removeOverlays?: boolean;
  screenshot?: ScreenshotMode;
  extractMedia?: boolean;
  customJs?: string;
  proxy?: ProxyConfig;
  /**
   * @deprecated Use `browser.enableStealth` instead.
   *
   * **Migration Guide:**
   * - Old: `{ stealthMode: 'advanced' }`
   * - New: `{ browser: { enableStealth: true } }`
   *
   * Helps avoid bot detection. 'Disabled' is fastest, 'Advanced' provides best anti-detection.
   * This option is deprecated in favor of the more explicit browser.enableStealth configuration.
   *
   * @default 'disabled'
   * @example
   * // Deprecated
   * { crawl4ai: { stealthMode: 'advanced' } }
   *
   * // New approach
   * { crawl4ai: { browser: { enableStealth: true } } }
   */
  stealthMode?: "disabled" | "basic" | "advanced";

  // v0.8.0 new features
  /** Browser configuration (chromium/firefox/webkit) */
  browser?: BrowserConfig;
  /** Virtual scroll configuration for dynamic content */
  virtualScroll?: VirtualScrollConfig;
  /** Hooks - NOT SUPPORTED via API, must be server-side */
  hooks?: HooksConfig;
}

/**
 * Request to crawl a URL via Crawl4AI service
 */
export interface Crawl4AIRequest {
  url: string;
  config?: Crawl4AIConfig;
  /** Multi-URL configuration for pattern-based crawling */
  multiUrlConfig?: MultiUrlCrawlConfig;
  headers?: Record<string, string>;
}

/**
 * Metadata about the crawl operation (v0.8.0)
 */
export interface Crawl4AIMetadata {
  title?: string;
  description?: string;
  statusCode: number;
  url: string;
  crawlTime: number; // seconds
  /** Path to screenshot file (if saved) */
  screenshotPath?: string;
  /** Type of fetcher used (e.g., 'crawl4ai') */
  fetcherType?: string;
}

/**
 * Successful crawl result data (v0.8.0)
 */
export interface Crawl4AIData {
  markdown: string;
  rawMarkdown?: string;
  fitMarkdown?: string;
  metadata: Crawl4AIMetadata;
  screenshot?: string; // base64 encoded PNG
  media?: MediaItem[];
  links?: LinkItem[];
  /** Structured content extraction */
  extractedContent?: Record<string, unknown>;
  /** Extracted CSS selectors */
  css?: Record<string, string>;
}

/**
 * Error details from Crawl4AI service
 */
export interface Crawl4AIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Response from Crawl4AI /crawl endpoint
 */
export interface Crawl4AIResponse {
  success: boolean;
  data?: Crawl4AIData;
  error?: Crawl4AIError;
}

/**
 * Health check response from Crawl4AI service (v0.8.0)
 */
export interface Crawl4AIHealthResponse {
  status: "ok" | "degraded" | "down";
  version: string;
  uptime: number; // seconds
  /** Crawl4AI version */
  crawl4aiVersion?: string;
}

/**
 * Options for Crawl4AI client operations
 */
export interface Crawl4AIClientOptions {
  /** Base URL of the Crawl4AI service */
  baseUrl?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Base delay between retries in milliseconds */
  retryDelay?: number;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Circuit breaker: number of consecutive failures before opening circuit */
  circuitBreakerThreshold?: number;
  /** Circuit breaker: milliseconds before attempting to recover from open state */
  circuitBreakerResetTimeout?: number;
}
