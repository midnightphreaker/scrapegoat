/**
 * TypeScript type definitions for Crawl4AI service communication.
 * These types mirror the Python Pydantic models in services/crawl4ai/app/models.py
 */

import type { LinkItem, MediaItem } from "../types";

/**
 * Cache mode options for Crawl4AI
 */
export type CacheMode = "enabled" | "disabled" | "bypass";

/**
 * Screenshot mode options
 */
export type ScreenshotMode = false | true | "full" | "viewport";

/**
 * Proxy configuration for crawling
 */
export interface ProxyConfig {
  server: string;
  username?: string;
  password?: string;
}

/**
 * Configuration options for Crawl4AI crawling
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
}

/**
 * Request to crawl a URL via Crawl4AI service
 */
export interface Crawl4AIRequest {
  url: string;
  config?: Crawl4AIConfig;
}

/**
 * Metadata about the crawl operation
 */
export interface Crawl4AIMetadata {
  title?: string;
  description?: string;
  statusCode: number;
  url: string;
  crawlTime: number; // seconds
}

/**
 * Successful crawl result data
 */
export interface Crawl4AIData {
  markdown: string;
  rawMarkdown?: string;
  fitMarkdown?: string;
  metadata: Crawl4AIMetadata;
  screenshot?: string; // base64 encoded
  media?: MediaItem[];
  links?: LinkItem[];
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
 * Health check response from Crawl4AI service
 */
export interface Crawl4AIHealthResponse {
  status: "ok" | "degraded" | "down";
  version: string;
  uptime: number; // seconds
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
}
