import { metricsCollector } from "../../monitoring/metrics";
import { appConfig } from "../../utils/config";
import { FetcherType, type FetcherTypeValue } from "../../utils/constants";
import { ChallengeError, ScraperError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import { Crawl4AIFetcher } from "./crawl4ai/Crawl4AIFetcher";
import { FileFetcher } from "./FileFetcher";
import { HttpFetcher } from "./HttpFetcher";
import type { ContentFetcher, FetchOptions, RawContent } from "./types";

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
        case FetcherType.FILE:
          logger.debug(`Using FileFetcher for: ${source}`);
          result = await this.fileFetcher.fetch(source, options);
          break;

        case FetcherType.HTTP:
          logger.debug(`Using HttpFetcher (explicit) for: ${source}`);
          result = await this.httpFetcher.fetch(source, options);
          break;

        case FetcherType.CRAWL4AI:
          logger.debug(`Using Crawl4AIFetcher (explicit) for: ${source}`);
          result = await this.crawl4aiFetcher.fetch(source, options);
          break;

        case FetcherType.AUTO:
          result = await this.autoDetect(source, options);
          break;

        default:
          throw new ScraperError(`Unknown fetcher type: ${fetcherType}`, false);
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
  private determineFetcherType(source: string, options?: FetchOptions): FetcherTypeValue {
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
        return FetcherType.CRAWL4AI;
      }

      // Validate that fetcher can handle this URL
      if (!this.canFetcherHandleSource(options.fetcher, source)) {
        throw new ScraperError(
          `Fetcher '${options.fetcher}' cannot handle URL: ${source}. ` +
            `Expected ${this.getExpectedProtocol(options.fetcher)} URL. ` +
            `Use 'auto' or choose a compatible fetcher.`,
          false,
        );
      }
      return options.fetcher;
    }

    // Priority 2: Backward compatibility with useCrawl4AI flag
    if (options?.useCrawl4AI === true) {
      logger.warn(
        "The useCrawl4AI option is deprecated and will be removed in a future version. " +
          'Please use fetcher="crawl4ai" or fetcher="auto" instead. ' +
          'Example: { fetcher: "crawl4ai" } or { fetcher: "auto" }',
      );
      return FetcherType.CRAWL4AI;
    }

    // Priority 3: Auto-detection
    return FetcherType.AUTO;
  }

  /**
   * Check if a specific fetcher can handle the given source URL
   */
  private canFetcherHandleSource(fetcher: FetcherTypeValue, source: string): boolean {
    switch (fetcher) {
      case FetcherType.AUTO:
        return true; // Auto can handle anything
      case FetcherType.FILE:
        return this.fileFetcher.canFetch(source);
      case FetcherType.HTTP:
        return this.httpFetcher.canFetch(source);
      case FetcherType.CRAWL4AI:
        return this.crawl4aiFetcher.canFetch(source);
      default:
        return false;
    }
  }

  /**
   * Get expected protocol for a fetcher type (for error messages)
   */
  private getExpectedProtocol(fetcher: FetcherTypeValue): string {
    switch (fetcher) {
      case FetcherType.FILE:
        return "file://";
      case FetcherType.HTTP:
      case FetcherType.CRAWL4AI:
        return "http:// or https://";
      case FetcherType.AUTO:
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
    throw new ScraperError(`No suitable fetcher found for URL: ${source}`, false);
  }

  /**
   * Close all underlying fetchers to prevent resource leaks.
   */
  async close(): Promise<void> {
    const results = await Promise.allSettled([
      this.crawl4aiFetcher.close(),
      // HttpFetcher and FileFetcher don't need explicit cleanup
    ]);

    // Log any cleanup failures
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        const fetcherName = index === 0 ? "Crawl4AIFetcher" : "Unknown";
        logger.warn(`Failed to close ${fetcherName}: ${result.reason}`);
      }
    });
  }
}
