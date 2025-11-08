import {
  CRAWL4AI_MAX_RETRIES,
  CRAWL4AI_SERVICE_URL,
  CRAWL4AI_TIMEOUT,
} from "../../../utils/config";
import { ScraperError } from "../../../utils/errors";
import { logger } from "../../../utils/logger";
import type { ContentFetcher, FetchOptions, RawContent } from "../types";
import { Crawl4AIClient } from "./Crawl4AIClient";
import type { Crawl4AIConfig, Crawl4AIRequest } from "./types";

/**
 * Fetches content using the Crawl4AI Python service.
 *
 * This fetcher communicates with a separate Python service that uses Crawl4AI
 * for advanced web scraping with JavaScript rendering and anti-bot bypass.
 *
 * Features:
 * - JavaScript rendering via Playwright
 * - Anti-bot detection bypass
 * - BM25-filtered markdown (removes boilerplate/ads)
 * - Screenshot capture
 * - Media extraction
 *
 * Usage:
 * ```typescript
 * const fetcher = new Crawl4AIFetcher();
 * const content = await fetcher.fetch('https://example.com');
 * ```
 */
export class Crawl4AIFetcher implements ContentFetcher {
  private readonly client: Crawl4AIClient;

  constructor(baseUrl?: string) {
    this.client = new Crawl4AIClient({
      baseUrl: baseUrl || CRAWL4AI_SERVICE_URL,
      timeout: CRAWL4AI_TIMEOUT,
      maxRetries: CRAWL4AI_MAX_RETRIES,
    });
  }

  /**
   * Check if this fetcher can handle the given source.
   * Crawl4AIFetcher supports HTTP and HTTPS URLs.
   */
  canFetch(source: string): boolean {
    return source.startsWith("http://") || source.startsWith("https://");
  }

  /**
   * Fetch content from the source using Crawl4AI service.
   *
   * @param source - The URL to fetch
   * @param options - Fetch options (timeout, signal, etc.)
   * @returns RawContent with markdown content
   */
  async fetch(source: string, options?: FetchOptions): Promise<RawContent> {
    try {
      // Check if service is available first
      const isAvailable = await this.client.isAvailable();
      if (!isAvailable) {
        const circuitState = this.client.getCircuitState();
        if (circuitState.state === "open") {
          throw new ScraperError(
            `Crawl4AI service circuit breaker is open. Service appears to be unavailable. Try again later.`,
            false,
          );
        }
        throw new ScraperError(
          `Crawl4AI service is not available at ${CRAWL4AI_SERVICE_URL}. Ensure the Python service is running.`,
          false,
        );
      }

      // Build Crawl4AI request
      const crawl4aiConfig: Crawl4AIConfig = {
        cacheMode: "enabled",
        useFitMarkdown: true, // Use BM25-filtered markdown for better quality
        removeOverlays: true,
        screenshot: false,
        extractMedia: false,
        waitForTimeout: options?.timeout || CRAWL4AI_TIMEOUT,
      };

      const request: Crawl4AIRequest = {
        url: source,
        config: crawl4aiConfig,
      };

      logger.debug(`Fetching ${source} via Crawl4AI service...`);

      // Make request to Crawl4AI service
      const response = await this.client.crawl(request, {
        signal: options?.signal,
        timeout: options?.timeout || CRAWL4AI_TIMEOUT,
      });

      // Handle unsuccessful response
      if (!response.success || !response.data) {
        const errorMsg = response.error
          ? `${response.error.code}: ${response.error.message}`
          : "Unknown error";
        throw new ScraperError(
          `Crawl4AI service returned error for ${source}: ${errorMsg}`,
          false,
        );
      }

      const data = response.data;

      // Select the best markdown variant
      // Priority: fitMarkdown (BM25-filtered) > rawMarkdown > markdown
      const markdown = data.fitMarkdown || data.rawMarkdown || data.markdown;

      if (!markdown || markdown.trim().length === 0) {
        throw new ScraperError(`Crawl4AI returned empty content for ${source}`, false);
      }

      // Use the final URL from metadata (handles redirects)
      const finalUrl = data.metadata.url || source;

      logger.debug(
        `Crawl4AI fetch successful: ${source} -> ${finalUrl} (${markdown.length} chars, ${data.metadata.crawlTime.toFixed(2)}s)`,
      );

      // Return as RawContent with markdown mime type
      return {
        content: Buffer.from(markdown, "utf-8"),
        mimeType: "text/markdown",
        charset: "utf-8",
        encoding: undefined,
        source: finalUrl,
      };
    } catch (error) {
      // Handle cancellation
      if (options?.signal?.aborted) {
        throw new ScraperError("Crawl4AI fetch cancelled", false);
      }

      // Re-throw ScraperErrors as-is
      if (error instanceof ScraperError) {
        throw error;
      }

      // Wrap other errors
      logger.error(`Crawl4AI fetch failed for ${source}: ${error}`);
      throw new ScraperError(
        `Crawl4AI fetch failed for ${source}: ${error instanceof Error ? error.message : String(error)}`,
        false,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Check if the Crawl4AI service is available.
   * Useful for health checks and graceful degradation.
   */
  async isAvailable(): Promise<boolean> {
    return this.client.isAvailable();
  }

  /**
   * Get current circuit breaker state (for monitoring/debugging).
   */
  getCircuitState() {
    return this.client.getCircuitState();
  }

  /**
   * No cleanup needed for HTTP client.
   */
  async close(): Promise<void> {
    // No-op: HTTP client doesn't need cleanup
  }
}
