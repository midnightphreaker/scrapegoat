import { metricsCollector } from "../../monitoring/metrics";
import { appConfig } from "../../utils/config";
import { ChallengeError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import { Crawl4AIFetcher } from "./crawl4ai/Crawl4AIFetcher";
import { FileFetcher } from "./FileFetcher";
import { HttpFetcher } from "./HttpFetcher";
import type { ContentFetcher, FetcherType, FetchOptions, RawContent } from "./types";

/**
 * AutoDetectFetcher automatically selects the appropriate fetcher based on URL type
 * and handles fallbacks for challenge detection.
 *
 * Supports explicit fetcher selection via the `fetcher` option parameter, or
 * falls back to auto-detection if not specified.
 *
 * Priority: fetcher option > useCrawl4AI flag > auto-detection
 */
export class AutoDetectFetcher implements ContentFetcher {
  private readonly httpFetcher = new HttpFetcher();
  private readonly fileFetcher = new FileFetcher();
  private readonly crawl4aiFetcher = new Crawl4AIFetcher();

  /**
   * Check if this fetcher can handle the given source.
   * Returns true for any URL that any of the underlying fetchers can handle.
   */
  canFetch(source: string): boolean {
    return (
      this.httpFetcher.canFetch(source) ||
      this.fileFetcher.canFetch(source) ||
      this.crawl4aiFetcher.canFetch(source)
    );
  }

  /**
   * Fetch content from the source, automatically selecting the appropriate fetcher
   * based on explicit options or auto-detection.
   *
   * Supports explicit fetcher selection via options.fetcher:
   * - 'auto': Use auto-detection (default)
   * - 'http': Force HTTP fetcher
   * - 'crawl4ai': Force Crawl4AI fetcher
   * - 'file': Force file fetcher
   *
   * Note: 'browser' is deprecated and automatically redirects to 'crawl4ai'
   */
  async fetch(source: string, options?: FetchOptions): Promise<RawContent> {
    const fetcherType = this.determineFetcherType(source, options);
    const startTime = Date.now();
    const metricsEnabled = appConfig.monitoring.enabled;

    try {
      let result: RawContent;

      // Route to appropriate fetcher
      switch (fetcherType) {
        case "file":
          logger.debug(`Using FileFetcher for: ${source}`);
          result = await this.fileFetcher.fetch(source, options);
          break;

        case "http":
          logger.debug(`Using HttpFetcher (explicit) for: ${source}`);
          result = await this.httpFetcher.fetch(source, options);
          break;

        case "crawl4ai":
          logger.debug(`Using Crawl4AIFetcher (explicit) for: ${source}`);
          result = await this.crawl4aiFetcher.fetch(source, options);
          break;

        case "auto":
          result = await this.autoDetect(source, options);
          break;

        default:
          throw new Error(`Unknown fetcher type: ${fetcherType}`);
      }

      // Record successful fetch metrics
      if (metricsEnabled) {
        const responseTime = Date.now() - startTime;
        const actualFetcher = result.fetcherType || fetcherType;
        metricsCollector.recordFetch(actualFetcher, true, responseTime);
      }

      return result;
    } catch (error) {
      // Record failed fetch metrics
      if (metricsEnabled) {
        const responseTime = Date.now() - startTime;
        metricsCollector.recordFetch(fetcherType, false, responseTime, error as Error);
      }

      throw error;
    }
  }

  /**
   * Determine which fetcher to use based on options and URL.
   * Priority: explicit fetcher > useCrawl4AI flag > auto-detection
   */
  private determineFetcherType(source: string, options?: FetchOptions): FetcherType {
    // Priority 1: Explicit fetcher parameter
    if (options?.fetcher) {
      // Backward compatibility: redirect 'browser' to 'crawl4ai'
      // This is needed because 'browser' is no longer a valid FetcherType
      // but we cast it here for runtime compatibility
      if ((options.fetcher as string) === "browser") {
        logger.warn(
          'fetcher="browser" is deprecated and has been removed. Using "crawl4ai" instead. ' +
            'Please update your code to use fetcher="crawl4ai".',
        );
        return "crawl4ai";
      }

      // Validate that fetcher can handle this URL
      if (!this.canFetcherHandleSource(options.fetcher, source)) {
        throw new Error(
          `Fetcher '${options.fetcher}' cannot handle URL: ${source}. ` +
            `Expected ${this.getExpectedProtocol(options.fetcher)} URL. ` +
            `Use 'auto' or choose a compatible fetcher.`,
        );
      }
      return options.fetcher;
    }

    // Priority 2: Backward compatibility with useCrawl4AI flag
    if (options?.useCrawl4AI === true) {
      return "crawl4ai";
    }

    // Priority 3: Auto-detection
    return "auto";
  }

  /**
   * Check if a specific fetcher can handle the given source URL
   */
  private canFetcherHandleSource(fetcher: FetcherType, source: string): boolean {
    switch (fetcher) {
      case "auto":
        return true; // Auto can handle anything
      case "file":
        return this.fileFetcher.canFetch(source);
      case "http":
        return this.httpFetcher.canFetch(source);
      case "crawl4ai":
        return this.crawl4aiFetcher.canFetch(source);
      default:
        return false;
    }
  }

  /**
   * Get expected protocol for a fetcher type (for error messages)
   */
  private getExpectedProtocol(fetcher: FetcherType): string {
    switch (fetcher) {
      case "file":
        return "file://";
      case "http":
      case "crawl4ai":
        return "http:// or https://";
      case "auto":
        return "any";
      default:
        return "unknown";
    }
  }

  /**
   * Auto-detect the appropriate fetcher based on URL and fallback logic
   */
  private async autoDetect(source: string, options?: FetchOptions): Promise<RawContent> {
    // For file:// URLs, use FileFetcher
    if (this.fileFetcher.canFetch(source)) {
      logger.debug(`Auto-detected FileFetcher for: ${source}`);
      return this.fileFetcher.fetch(source, options);
    }

    // For HTTP(S) URLs, try HttpFetcher first, fallback to Crawl4AI on challenge
    if (this.httpFetcher.canFetch(source)) {
      try {
        logger.debug(`Auto-detected HttpFetcher for: ${source}`);
        return await this.httpFetcher.fetch(source, options);
      } catch (error) {
        if (error instanceof ChallengeError) {
          logger.info(`🔄 Challenge detected for ${source}, falling back to Crawl4AI...`);
          return this.crawl4aiFetcher.fetch(source, options);
        }
        throw error;
      }
    }

    // If we get here, no fetcher can handle this URL
    throw new Error(`No suitable fetcher found for URL: ${source}`);
  }

  /**
   * Close all underlying fetchers to prevent resource leaks.
   */
  async close(): Promise<void> {
    await Promise.allSettled([
      this.crawl4aiFetcher.close(),
      // HttpFetcher and FileFetcher don't need explicit cleanup
    ]);
  }
}
