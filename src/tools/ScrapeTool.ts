import * as semver from "semver";
import type { IPipeline } from "../pipeline/trpc/interfaces";
import type { Crawl4AIOptions } from "../scraper/fetcher/types";
import { DEFAULT_MAX_DEPTH, DEFAULT_MAX_PAGES, rateLimitConfig } from "../utils/config";
import { logger } from "../utils/logger";
import { ValidationError } from "./errors";

export interface ScrapeToolOptions {
  library: string;
  version?: string | null; // Make version optional
  url: string;
  options?: {
    maxPages?: number;
    maxDepth?: number;
    /**
     * Defines the allowed crawling boundary relative to the starting URL
     * - 'subpages': Only crawl URLs on the same hostname and within the same starting path (default)
     * - 'hostname': Crawl any URL on the same hostname, regardless of path
     * - 'domain': Crawl any URL on the same top-level domain, including subdomains
     */
    scope?: "subpages" | "hostname" | "domain";
    /**
     * Controls whether HTTP redirects (3xx responses) should be followed
     * - When true: Redirects are followed automatically (default)
     * - When false: A RedirectError is thrown when a 3xx response is received
     */
    followRedirects?: boolean;
    maxConcurrency?: number; // Note: Concurrency is now set when PipelineManager is created
    ignoreErrors?: boolean;
    /**
     * Patterns for including URLs during scraping. If not set, all are included by default.
     * Regex patterns must be wrapped in slashes, e.g. /pattern/.
     */
    includePatterns?: string[];
    /**
     * Patterns for excluding URLs during scraping. Exclude takes precedence over include.
     * If not specified, default patterns exclude common files (CHANGELOG.md, LICENSE, etc.)
     * and folders (archive, deprecated, i18n locales, etc.).
     * Regex patterns must be wrapped in slashes, e.g. /pattern/.
     */
    excludePatterns?: string[];
    /**
     * Custom HTTP headers to send with each request (e.g., for authentication).
     * Keys are header names, values are header values.
     */
    headers?: Record<string, string>;
    /**
     * Explicit fetcher selection: 'auto', 'http', 'crawl4ai', or 'file'.
     * @default 'auto'
     */
    fetcher?: "auto" | "http" | "crawl4ai" | "file";
    /**
     * Crawl4AI-specific options
     */
    crawl4ai?: Crawl4AIOptions;
  };
  /** If false, returns jobId immediately without waiting. Defaults to true. */
  waitForCompletion?: boolean;
}

export interface ScrapeResult {
  /** Indicates the number of pages scraped if waitForCompletion was true and the job succeeded. May be 0 or inaccurate if job failed or waitForCompletion was false. */
  pagesScraped: number;
}

/** Return type for ScrapeTool.execute */
export type ScrapeExecuteResult = ScrapeResult | { jobId: string };

/**
 * Tool for enqueuing documentation scraping jobs via the pipeline.
 *
 * @remarks
 * This tool manages the scraping and indexing of documentation from web sources.
 * It supports multiple fetchers (HTTP, Crawl4AI) and provides flexible crawling options
 * including scope control, pattern filtering, and custom headers.
 *
 * The tool can operate in two modes:
 * - Synchronous: Waits for job completion and returns page count
 * - Asynchronous: Returns immediately with a job ID for status tracking
 *
 * @example
 * ```typescript
 * const scrapeTool = new ScrapeTool(pipeline);
 *
 * // Basic scraping - waits for completion
 * const result = await scrapeTool.execute({
 *   library: 'react',
 *   version: '18.2.0',
 *   url: 'https://react.dev/learn',
 *   waitForCompletion: true
 * });
 * console.log(`Scraped ${result.pagesScraped} pages`);
 *
 * // Advanced options with Crawl4AI
 * const result = await scrapeTool.execute({
 *   library: 'vue',
 *   url: 'https://vuejs.org/guide/',
 *   options: {
 *     maxPages: 500,
 *     maxDepth: 3,
 *     scope: 'hostname',
 *     fetcher: 'crawl4ai',
 *     crawl4ai: {
 *       enableScreenshots: true,
 *       enableMedia: true
 *     }
 *   }
 * });
 *
 * // Asynchronous - get job ID and poll separately
 * const { jobId } = await scrapeTool.execute({
 *   library: 'nextjs',
 *   url: 'https://nextjs.org/docs',
 *   waitForCompletion: false
 * });
 * ```
 */
export class ScrapeTool {
  private pipeline: IPipeline;

  /**
   * Creates a new ScrapeTool instance.
   *
   * @param pipeline - The pipeline instance for managing scraping jobs
   */
  constructor(pipeline: IPipeline) {
    this.pipeline = pipeline;
  }

  /**
   * Executes a documentation scraping job.
   *
   * @param options - The scraping options
   * @param options.library - Library name for the documentation (e.g., 'react', 'typescript')
   * @param options.version - Optional version string (e.g., '18.2.0', '5.x'). Empty/undefined for unversioned
   * @param options.url - The root URL to start scraping from
   * @param options.options - Optional scraper configuration
   * @param options.options.maxPages - Maximum pages to scrape. Default: 1000
   * @param options.options.maxDepth - Maximum crawl depth. Default: 3
   * @param options.options.scope - Crawling boundary: 'subpages' | 'hostname' | 'domain'. Default: 'subpages'
   * @param options.options.followRedirects - Whether to follow HTTP redirects. Default: true
   * @param options.options.includePatterns - URL inclusion patterns (regex)
   * @param options.options.excludePatterns - URL exclusion patterns (regex)
   * @param options.options.headers - Custom HTTP headers for requests
   * @param options.options.fetcher - Fetcher type: 'auto' | 'http' | 'crawl4ai' | 'file'. Default: 'auto'
   * @param options.options.crawl4ai - Crawl4AI-specific options
   * @param options.waitForCompletion - If true, wait for job completion. Default: true
   *
   * @returns Promise resolving to either:
   * - `{ pagesScraped: number }` when waitForCompletion is true
   * - `{ jobId: string }` when waitForCompletion is false
   *
   * @throws {ValidationError} If version format is invalid
   * @throws {Error} If the job fails and waitForCompletion is true
   *
   * @example
   * ```typescript
   * // Synchronous scraping
   * const result = await scrapeTool.execute({
   *   library: 'angular',
   *   version: '17.0.0',
   *   url: 'https://angular.io/docs',
   *   options: {
   *     maxPages: 500,
   *     excludePatterns: ['/api/', '/tutorial/']
   *   },
   *   waitForCompletion: true
   * });
   * console.log(`Scraped ${result.pagesScraped} pages`);
   *
   * // Asynchronous scraping
   * const { jobId } = await scrapeTool.execute({
   *   library: 'svelte',
   *   url: 'https://svelte.dev/docs',
   *   waitForCompletion: false
   * });
   * console.log(`Job queued: ${jobId}`);
   * ```
   */
  async execute(options: ScrapeToolOptions): Promise<ScrapeExecuteResult> {
    const {
      library,
      version,
      url,
      options: scraperOptions,
      waitForCompletion = true,
    } = options;

    // Store initialization and manager start should happen externally

    let internalVersion: string;
    const partialVersionRegex = /^\d+(\.\d+)?$/; // Matches '1' or '1.2'

    if (version === null || version === undefined) {
      internalVersion = "";
    } else {
      const validFullVersion = semver.valid(version);
      if (validFullVersion) {
        internalVersion = validFullVersion;
      } else if (partialVersionRegex.test(version)) {
        const coercedVersion = semver.coerce(version);
        if (coercedVersion) {
          internalVersion = coercedVersion.version;
        } else {
          throw new ValidationError(
            `Invalid version format for scraping: '${version}'. Use 'X.Y.Z', 'X.Y.Z-prerelease', 'X.Y', 'X', or omit.`,
            "ScrapeTool",
          );
        }
      } else {
        throw new ValidationError(
          `Invalid version format for scraping: '${version}'. Use 'X.Y.Z', 'X.Y.Z-prerelease', 'X.Y', 'X', or omit.`,
          "ScrapeTool",
        );
      }
    }

    internalVersion = internalVersion.toLowerCase();

    // Use the injected pipeline instance
    const pipeline = this.pipeline;

    // Remove internal progress tracking and callbacks
    // let pagesScraped = 0;
    // let lastReportedPages = 0;
    // const reportProgress = ...
    // pipeline.setCallbacks(...)

    // Normalize pipeline version argument: use null for unversioned to be explicit cross-platform
    const enqueueVersion: string | null = internalVersion === "" ? null : internalVersion;

    // Enqueue the job using the injected pipeline
    const jobId = await pipeline.enqueueJob(library, enqueueVersion, {
      url: url,
      library: library,
      version: internalVersion,
      scope: scraperOptions?.scope ?? "subpages",
      followRedirects: scraperOptions?.followRedirects ?? true,
      maxPages: scraperOptions?.maxPages ?? DEFAULT_MAX_PAGES,
      maxDepth: scraperOptions?.maxDepth ?? DEFAULT_MAX_DEPTH,
      maxConcurrency:
        scraperOptions?.maxConcurrency ?? rateLimitConfig.pipeline.pageConcurrency,
      ignoreErrors: scraperOptions?.ignoreErrors ?? true,
      includePatterns: scraperOptions?.includePatterns,
      excludePatterns: scraperOptions?.excludePatterns,
      headers: scraperOptions?.headers, // <-- propagate headers
      fetcher: scraperOptions?.fetcher, // <-- propagate fetcher selection
      crawl4ai: scraperOptions?.crawl4ai, // <-- propagate crawl4ai options
    });

    // Conditionally wait for completion
    if (waitForCompletion) {
      try {
        await pipeline.waitForJobCompletion(jobId);
        // Fetch final job state to get status and potentially final page count
        const finalJob = await pipeline.getJob(jobId);
        const finalPagesScraped = finalJob?.progress?.pagesScraped ?? 0; // Get count from final job state
        logger.debug(
          `Job ${jobId} finished with status ${finalJob?.status}. Pages scraped: ${finalPagesScraped}`,
        );
        return {
          pagesScraped: finalPagesScraped,
        };
      } catch (error) {
        logger.error(`❌ Job ${jobId} failed or was cancelled: ${error}`);
        throw error; // Re-throw so the caller knows it failed
      }
      // No finally block needed to stop pipeline, as it's managed externally
    }

    // If not waiting, return the job ID immediately
    return { jobId };
  }
}
