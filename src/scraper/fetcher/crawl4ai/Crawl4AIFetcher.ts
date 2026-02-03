import {
  CRAWL4AI_MAX_RETRIES,
  CRAWL4AI_SERVICE_URL,
  CRAWL4AI_TIMEOUT,
} from "../../../utils/config";
import { FetcherType, MimeType } from "../../../utils/constants";
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
   * Supports enhanced features when enabled via options.crawl4ai:
   * - Screenshot capture (viewport or full page)
   * - Media extraction (images, videos, audio)
   * - Link extraction and categorization
   *
   * @param source - The URL to fetch
   * @param options - Fetch options (timeout, signal, crawl4ai config)
   * @returns RawContent with markdown content and optional enhanced data
   */
  async fetch(source: string, options?: FetchOptions): Promise<RawContent> {
    try {
      // Warn about deprecated stealthMode option early (before health check)
      if (options?.crawl4ai?.stealthMode) {
        logger.warn(
          "The crawl4ai.stealthMode option is deprecated and will be removed in a future version. " +
            "Please use browser.enableStealth instead. " +
            "Example: { crawl4ai: { browser: { enableStealth: true } } }",
        );
      }

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

      // Check environment variables for global defaults
      const envScreenshots = process.env.CRAWL4AI_ENABLE_SCREENSHOTS === "true";
      const envMedia = process.env.CRAWL4AI_ENABLE_MEDIA === "true";
      const envLinks = process.env.CRAWL4AI_ENABLE_LINKS === "true";
      const envScreenshotMode = (process.env.CRAWL4AI_SCREENSHOT_MODE || "viewport") as
        | "viewport"
        | "full";

      // Merge options: explicit options > environment defaults > false
      const enableScreenshot = options?.crawl4ai?.enableScreenshot ?? envScreenshots;
      const screenshotMode: "viewport" | "full" =
        options?.crawl4ai?.screenshotMode === "full"
          ? "full"
          : (options?.crawl4ai?.screenshotMode ?? envScreenshotMode);
      const enableMedia = options?.crawl4ai?.enableMedia ?? envMedia;
      const enableLinks = options?.crawl4ai?.enableLinks ?? envLinks;

      // Normalize cacheMode and stealthMode from uppercase keys to lowercase values
      const normalizedCacheMode = options?.crawl4ai?.cacheMode
        ? (options.crawl4ai.cacheMode as string).toLowerCase()
        : "fresh";
      const normalizedStealthMode = options?.crawl4ai?.stealthMode
        ? (options.crawl4ai.stealthMode as string).toLowerCase()
        : undefined;

      // Build Crawl4AI request with all options from Section 0
      const crawl4aiConfig: Crawl4AIConfig = {
        cacheMode: normalizedCacheMode as
          | "enabled"
          | "disabled"
          | "bypass"
          | "write_only"
          | "read_only"
          | "fresh",
        useFitMarkdown: true, // Hardcoded: BM25-filtered markdown (CURRENT_PLAN.md Section 0, option 15)
        removeOverlays: true, // Hardcoded: Auto-remove popups/modals (Section 0, option 14)
        screenshot: enableScreenshot,
        extractMedia: enableMedia,
        waitFor: options?.crawl4ai?.waitFor, // CSS selector to wait for (default: undefined)
        waitForTimeout: options?.crawl4ai?.waitForTimeout ?? 30000, // Default: 30000ms per Section 0
        stealthMode: normalizedStealthMode as
          | "disabled"
          | "basic"
          | "advanced"
          | undefined,
        customJs: options?.crawl4ai?.customJs, // Custom JavaScript (default: undefined)
      };

      const request: Crawl4AIRequest = {
        url: source,
        config: crawl4aiConfig,
        headers: options?.crawl4ai?.headers, // Custom HTTP headers (default: undefined)
      };

      const featuresLog = [
        enableScreenshot && `screenshot(${screenshotMode})`,
        enableMedia && "media",
        enableLinks && "links",
      ]
        .filter(Boolean)
        .join(", ");

      logger.debug(
        `Fetching ${source} via Crawl4AI service${featuresLog ? ` with ${featuresLog}` : ""}...`,
      );

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

      // Build enhanced RawContent with optional features
      const rawContent: RawContent = {
        content: Buffer.from(markdown, "utf-8"),
        mimeType: MimeType.MARKDOWN,
        charset: "utf-8",
        encoding: undefined,
        source: finalUrl,
        fetcherType: FetcherType.CRAWL4AI,
      };

      // Add screenshot if captured
      if (enableScreenshot && data.screenshot) {
        rawContent.screenshot = data.screenshot;
        logger.debug(
          `Screenshot captured: ${typeof data.screenshot === "string" ? "base64" : "buffer"} (${screenshotMode} mode)`,
        );
      }

      // Add media if extracted
      if (
        enableMedia &&
        data.media &&
        Array.isArray(data.media) &&
        data.media.length > 0
      ) {
        rawContent.media = data.media.map((item: any) => ({
          type: item.type || "image",
          url: item.url || item.src,
          alt: item.alt,
          width: item.width,
          height: item.height,
        }));
        logger.debug(`Extracted ${rawContent.media.length} media items`);
      }

      // Add links if extracted (Crawl4AI always extracts links, we just control storage)
      if (
        enableLinks &&
        data.links &&
        Array.isArray(data.links) &&
        data.links.length > 0
      ) {
        rawContent.links = data.links.map((link: any) => ({
          url: link.url || link.href,
          text: link.text || link.title || "",
          rel: link.rel,
        }));
        logger.debug(`Extracted ${rawContent.links.length} links`);
      }

      return rawContent;
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
