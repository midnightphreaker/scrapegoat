import type { ScraperService } from "../scraper";
import type { ScraperProgress } from "../scraper/types";
import type { DocumentManagementService } from "../store";
import { logger } from "../utils/logger";
import { CancellationError } from "./errors";
import type { InternalPipelineJob, PipelineManagerCallbacks } from "./types";

/**
 * Executes a single document processing job.
 * Handles scraping, storing documents, and reporting progress/errors via callbacks.
 */
export class PipelineWorker {
  // Dependencies are passed in, making the worker stateless regarding specific jobs
  private readonly store: DocumentManagementService;
  private readonly scraperService: ScraperService;

  // Constructor accepts dependencies needed for execution
  constructor(store: DocumentManagementService, scraperService: ScraperService) {
    this.store = store;
    this.scraperService = scraperService;
  }

  /**
   * Executes the given pipeline job.
   * @param job - The job to execute.
   * @param callbacks - Callbacks provided by the manager for reporting.
   */
  async executeJob(
    job: InternalPipelineJob,
    callbacks: PipelineManagerCallbacks,
  ): Promise<void> {
    const {
      id: jobId,
      library,
      version,
      sourceUrl,
      scraperOptions,
      abortController,
    } = job;
    const signal = abortController.signal;

    logger.debug(`[${jobId}] Worker starting job for ${library}@${version}`);

    const addedDocumentUrls = new Set<string>();
    const scrapedUrls = new Set<string>();

    try {
      const rawScope = scraperOptions?.scope;
      const normalizedScope = rawScope
        ? (scraperOptions.scope as string).toLowerCase()
        : undefined;
      const normalizedFetcher = scraperOptions?.fetcher
        ? (scraperOptions.fetcher as string).toLowerCase()
        : undefined;
      const normalizedCrawl4ai = scraperOptions?.crawl4ai
        ? {
            ...scraperOptions.crawl4ai,
            screenshotMode: scraperOptions.crawl4ai.screenshotMode
              ? ((scraperOptions.crawl4ai.screenshotMode as string).toLowerCase() as
                  | "viewport"
                  | "full")
              : undefined,
          }
        : undefined;

      logger.info(
        `[SCOPE] [${jobId}] Worker using scope: "${normalizedScope || "subpages"}" (raw: "${rawScope}"), fetcher: "${normalizedFetcher || "auto"}"`,
      );

      const runtimeOptions = {
        url: sourceUrl ?? "",
        library,
        version,
        ...scraperOptions,
        scope: (normalizedScope || "subpages") as "subpages" | "hostname" | "domain",
        fetcher: normalizedFetcher as "auto" | "http" | "crawl4ai" | "file" | undefined,
        crawl4ai: normalizedCrawl4ai,
      };

      await this.scraperService.scrape(
        runtimeOptions,
        async (progress: ScraperProgress) => {
          if (signal.aborted) {
            throw new CancellationError("Job cancelled during scraping progress");
          }

          await callbacks.onJobProgress?.(job, progress);

          if (progress.document) {
            scrapedUrls.add(progress.document.metadata.url);

            try {
              await this.store.addDocument(library, version, {
                pageContent: progress.document.content,
                metadata: {
                  ...progress.document.metadata,
                  mimeType: progress.document.contentType,
                },
              });
              addedDocumentUrls.add(progress.document.metadata.url);
              logger.debug(
                `[${jobId}] Stored document: ${progress.document.metadata.url}`,
              );
            } catch (docError) {
              logger.error(
                `❌ [${jobId}] Failed to store document ${progress.document.metadata.url}: ${docError}`,
              );
              await callbacks.onJobError?.(
                job,
                docError instanceof Error ? docError : new Error(String(docError)),
                progress.document,
              );
            }
          }
        },
        signal,
      );

      if (signal.aborted) {
        throw new CancellationError("Job cancelled");
      }

      await this.store.removeDocumentsNotInSet(library, version, scrapedUrls);
      logger.info(
        `💾 Cleared old documents for ${library}@${version || "[no version]"}, kept ${scrapedUrls.size} scraped URLs (${addedDocumentUrls.size} stored successfully).`,
      );

      logger.debug(`[${jobId}] Worker finished job successfully.`);
    } catch (error) {
      logger.warn(`⚠️  [${jobId}] Worker encountered error: ${error}`);
      throw error;
    }
  }

  // --- Old methods removed ---
  // process()
  // stop()
  // setCallbacks()
  // handleScrapingProgress()
}
