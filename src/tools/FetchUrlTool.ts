import type { AutoDetectFetcher, RawContent } from "../scraper/fetcher";
import { HtmlPipeline } from "../scraper/pipelines/HtmlPipeline";
import { MarkdownPipeline } from "../scraper/pipelines/MarkdownPipeline";
import { TextPipeline } from "../scraper/pipelines/TextPipeline";
import type { ContentPipeline, ProcessedContent } from "../scraper/pipelines/types";
import { convertToString } from "../scraper/utils/buffer";
import { resolveCharset } from "../scraper/utils/charset";
import { logger } from "../utils/logger";
import { ToolError, ValidationError } from "./errors";

export interface FetchUrlToolOptions {
  /**
   * The URL to fetch and convert to markdown.
   * Must be a valid HTTP/HTTPS URL or file:// URL.
   */
  url: string;

  /**
   * Whether to follow HTTP redirects.
   * @default true
   */
  followRedirects?: boolean;

  /**
   * Custom HTTP headers to send with the request (e.g., for authentication).
   * Keys are header names, values are header values.
   */
  headers?: Record<string, string>;

  /**
   * Explicit fetcher selection: 'auto', 'http', 'crawl4ai', or 'file'.
   * @default 'auto'
   */
  fetcher?: "auto" | "http" | "crawl4ai" | "file";
}

/**
 * Tool for fetching a single URL and converting its content to Markdown.
 *
 * @remarks
 * Unlike scrape_docs, this tool only processes one page without crawling
 * or storing the content. It's designed for quick, one-off content retrieval.
 *
 * Key features:
 * - Supports HTTP/HTTPS URLs with automatic charset detection
 * - Supports local file URLs (file://)
 * - Automatic content type detection (HTML, Markdown, plain text)
 * - Custom HTTP headers support for authenticated requests
 * - Multiple fetcher options (auto, http, crawl4ai, file)
 * - Proper cleanup of resources after processing
 *
 * Use cases:
 * - Quick preview of a documentation page
 * - Testing content extraction before full indexing
 * - Fetching individual pages without storing
 * - Converting local files to Markdown
 *
 * @example
 * ```typescript
 * const fetchTool = new FetchUrlTool(new AutoDetectFetcher());
 *
 * // Simple web fetch
 * const markdown = await fetchTool.execute({
 *   url: 'https://example.com/docs/api-reference'
 * });
 * console.log(markdown);
 *
 * // With custom headers (e.g., for authentication)
 * const markdown = await fetchTool.execute({
 *   url: 'https://private.docs.com/page',
 *   headers: {
 *     'Authorization': 'Bearer token123',
 *     'API-Key': 'secret-key'
 *   }
 * });
 *
 * // Local file
 * const markdown = await fetchTool.execute({
 *   url: 'file:///path/to/local/docs.md'
 * });
 *
 * // Using Crawl4AI fetcher
 * const markdown = await fetchTool.execute({
 *   url: 'https://example.com',
 *   fetcher: 'crawl4ai'
 * });
 * ```
 */
export class FetchUrlTool {
  /**
   * AutoDetectFetcher handles all URL types and fallback logic automatically.
   */
  private readonly fetcher: AutoDetectFetcher;
  /**
   * Collection of pipelines that will be tried in order for processing content.
   * The first pipeline that can process the content type will be used.
   * Currently includes HtmlPipeline, MarkdownPipeline, and TextPipeline (as fallback).
   */
  private readonly pipelines: ContentPipeline[];

  /**
   * Creates a new FetchUrlTool instance.
   *
   * @param fetcher - The fetcher to use for retrieving content
   */
  constructor(fetcher: AutoDetectFetcher) {
    this.fetcher = fetcher;
    const htmlPipeline = new HtmlPipeline();
    const markdownPipeline = new MarkdownPipeline();
    const textPipeline = new TextPipeline();
    // Order matters: more specific pipelines first, fallback (text) pipeline last
    this.pipelines = [htmlPipeline, markdownPipeline, textPipeline];
  }

  /**
   * Fetches content from a URL and converts it to Markdown.
   *
   * @param options - The fetch options
   * @param options.url - The URL to fetch (HTTP/HTTPS or file://)
   * @param options.followRedirects - Whether to follow HTTP redirects. Default: true
   * @param options.headers - Optional custom HTTP headers
   * @param options.fetcher - Fetcher type: 'auto' | 'http' | 'crawl4ai' | 'file'. Default: 'auto'
   *
   * @returns Promise resolving to the processed Markdown content
   *
   * @throws {ValidationError} If the URL is invalid
   * @throws {ToolError} If fetching or processing fails
   *
   * @example
   * ```typescript
   * try {
   *   const markdown = await fetchTool.execute({
   *     url: 'https://react.dev/learn',
   *     followRedirects: true
   *   });
   *   console.log('Content fetched successfully');
   *   console.log(markdown);
   * } catch (error) {
   *   console.error('Failed to fetch:', error.message);
   * }
   * ```
   */
  async execute(options: FetchUrlToolOptions): Promise<string> {
    const { url, headers, fetcher } = options;

    if (!this.fetcher.canFetch(url)) {
      throw new ValidationError(
        `Invalid URL: ${url}. Must be an HTTP/HTTPS URL or a file:// URL.`,
        this.constructor.name,
      );
    }

    try {
      logger.info(`📡 Fetching ${url}...`);

      const fetchOptions = {
        followRedirects: options.followRedirects ?? true,
        maxRetries: 3,
        headers, // propagate custom headers
        fetcher, // propagate fetcher selection
      };

      // AutoDetectFetcher handles all fallback logic automatically
      const rawContent: RawContent = await this.fetcher.fetch(url, fetchOptions);

      logger.info("🔄 Processing content...");

      let processed: Awaited<ProcessedContent> | undefined;
      for (const pipeline of this.pipelines) {
        if (pipeline.canProcess(rawContent)) {
          processed = await pipeline.process(
            rawContent,
            {
              url,
              library: "",
              version: "",
              maxDepth: 0,
              maxPages: 1,
              maxConcurrency: 1,
              scope: "subpages",
              followRedirects: options.followRedirects ?? true,
              excludeSelectors: undefined,
              ignoreErrors: false,
              headers, // propagate custom headers
              fetcher, // propagate fetcher selection
            },
            this.fetcher,
          );
          break;
        }
      }

      if (!processed) {
        logger.warn(
          `⚠️  Unsupported content type "${rawContent.mimeType}" for ${url}. Returning raw content.`,
        );
        // Use proper charset detection for unsupported content types
        const resolvedCharset = resolveCharset(
          rawContent.charset,
          rawContent.content,
          rawContent.mimeType,
        );
        const contentString = convertToString(rawContent.content, resolvedCharset);
        return contentString;
      }

      for (const err of processed.errors) {
        logger.warn(`⚠️  Processing error for ${url}: ${err.message}`);
      }

      if (typeof processed.textContent !== "string" || !processed.textContent.trim()) {
        throw new ToolError(
          `Processing resulted in empty content for ${url}`,
          this.constructor.name,
        );
      }

      logger.info(`✅ Successfully processed ${url}`);
      return processed.textContent;
    } catch (error) {
      // Preserve ToolError as it already has user-friendly messages, wrap others
      if (error instanceof ToolError) {
        throw error;
      }

      throw new ToolError(
        `Unable to fetch or process the URL "${url}". Please verify the URL is correct and accessible.`,
        this.constructor.name,
      );
    } finally {
      // Cleanup all pipelines and fetcher to prevent resource leaks
      await Promise.allSettled([
        ...this.pipelines.map((pipeline) => pipeline.close()),
        this.fetcher.close(),
      ]);
    }
  }
}
