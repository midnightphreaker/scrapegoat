/**
 * LocalImportStrategy handles processing of locally uploaded documentation files
 * that were staged through the WebUI upload/import flow.
 *
 * It handles `file:///import/<library>/<version>/` URLs by mapping them to the
 * actual staging directory on disk. Files are walked recursively, and each
 * ingestible file is processed through the standard content pipelines.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { ensureWithinBase } from "../../upload/security";
import type { AppConfig } from "../../utils/config";
import { ScraperError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import { MimeTypeUtils } from "../../utils/mimeTypeUtils";
import { detectZipBackedDocumentFormat } from "../../utils/zipBackedDocument";
import { FileFetcher } from "../fetcher";
import { FetchStatus, type RawContent } from "../fetcher/types";
import { PipelineFactory } from "../pipelines/PipelineFactory";
import type { ContentPipeline, PipelineResult } from "../pipelines/types";
import type { QueueItem, ScraperOptions } from "../types";
import { BaseScraperStrategy, type ProcessItemResult } from "./BaseScraperStrategy";

/**
 * Strategy for processing locally uploaded/imported documentation files.
 *
 * Handles URLs of the form `file:///import/<library>/<version>/<path>` where
 * `<path>` is resolved against the staging directory provided in
 * `options.localImportStagingPath`. The strategy walks the staging directory
 * recursively and processes each file through the standard content pipeline.
 */
export class LocalImportStrategy extends BaseScraperStrategy {
  private readonly fileFetcher = new FileFetcher();
  private readonly pipelines: ContentPipeline[];

  constructor(config: AppConfig) {
    super(config);
    this.pipelines = PipelineFactory.createStandardPipelines(config);
  }

  canHandle(url: string): boolean {
    return url.startsWith("file:///import/");
  }

  /**
   * Resolves a virtual import URL to the actual file path in the staging directory.
   *
   * @param url - The virtual URL (e.g., `file:///import/mylib/1.0/docs/api.md`)
   * @param stagingPath - The absolute path to the staging directory
   * @returns The resolved absolute file path
   */
  private resolveFilePath(url: string, stagingPath: string): string {
    // Strip file:///import/ prefix and URL-decode
    const urlPath = decodeURIComponent(url.replace(/^file:\/\/\/import\//, ""));

    // The path includes <library>/<version>/ prefix — extract just the relative path after version
    // Split into segments: first segment is library, second is version, rest is the actual file path
    const segments = urlPath.split("/");
    if (segments.length < 2) {
      throw new Error(`Invalid import URL format: ${url}`);
    }
    // Skip library and version segments to get the file's relative path
    const relativePath = segments.slice(2).join("/");

    if (!relativePath) {
      // This is a directory URL (library/version root), return stagingPath
      return stagingPath;
    }

    const resolvedPath = path.resolve(stagingPath, relativePath);
    ensureWithinBase(resolvedPath, stagingPath);
    return resolvedPath;
  }

  /**
   * Recursively walks a directory, returning all file paths relative to the base directory.
   */
  private async walkDirectory(dirPath: string, basePath: string): Promise<string[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        const subFiles = await this.walkDirectory(fullPath, basePath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        files.push(path.relative(basePath, fullPath));
      }
    }

    return files;
  }

  /**
   * Extracts library and version from a `file:///import/<library>/<version>/` URL.
   */
  private parseImportUrl(url: string): { library: string; version: string } | null {
    const urlPath = decodeURIComponent(url.replace(/^file:\/\/\/import\//, ""));
    const segments = urlPath.split("/");
    if (segments.length < 2) {
      return null;
    }
    return { library: segments[0], version: segments[1] };
  }

  protected override async processItem(
    item: QueueItem,
    options: ScraperOptions,
    _signal?: AbortSignal,
  ): Promise<ProcessItemResult> {
    const stagingPath = options.localImportStagingPath;
    if (!stagingPath) {
      throw new Error("localImportStagingPath is required for LocalImportStrategy");
    }

    const resolvedPath = this.resolveFilePath(item.url, stagingPath);
    const parsed = this.parseImportUrl(item.url);
    if (!parsed) {
      return { url: item.url, links: [], status: FetchStatus.NOT_FOUND };
    }

    // Check if path is a directory — return links to children
    let stats: Awaited<ReturnType<typeof fs.stat>> | null = null;
    try {
      stats = await fs.stat(resolvedPath);
    } catch {
      throw new ScraperError(
        `Local import file not found: ${resolvedPath}. The file may not have been extracted from the archive.`,
        false, // non-retryable — the file won't appear on retry
      );
    }

    if (stats.isDirectory()) {
      const entries = await fs.readdir(resolvedPath, {
        withFileTypes: true,
      });
      const directoryUrl = item.url.endsWith("/") ? item.url : `${item.url}/`;
      const links = entries
        .map((entry) => {
          const encodedName = encodeURIComponent(entry.name);
          return `${directoryUrl}${entry.isDirectory() ? `${encodedName}/` : encodedName}`;
        })
        .filter((url) => this.shouldProcessUrl(url, options));

      logger.debug(`Found ${links.length} entries in import directory: ${resolvedPath}`);
      return { url: item.url, links, status: FetchStatus.SUCCESS };
    }

    // Process as a file — read content and run through pipeline
    const contentBuffer = await fs.readFile(resolvedPath);
    const zipBackedDocument = await detectZipBackedDocumentFormat(contentBuffer);
    const mimeType =
      zipBackedDocument?.mimeType ??
      MimeTypeUtils.detectMimeTypeFromPath(resolvedPath) ??
      "application/octet-stream";
    const rawContent: RawContent = {
      source: item.url,
      content: contentBuffer,
      mimeType,
      status: FetchStatus.SUCCESS,
      lastModified: new Date().toISOString(),
      etag: undefined,
    };

    return this.processContent(item.url, resolvedPath, rawContent, options);
  }

  /**
   * Process file content through the pipeline, following the same pattern as LocalFileStrategy.
   */
  private async processContent(
    _url: string,
    displayPath: string,
    rawContent: RawContent,
    options: ScraperOptions,
  ): Promise<ProcessItemResult> {
    let processed: PipelineResult | undefined;

    for (const pipeline of this.pipelines) {
      if (pipeline.canProcess(rawContent.mimeType, rawContent.content)) {
        logger.debug(
          `Selected ${pipeline.constructor.name} for content type "${rawContent.mimeType}" (${displayPath})`,
        );
        processed = await pipeline.process(rawContent, options, this.fileFetcher);
        break;
      }
    }

    if (!processed) {
      logger.debug(
        `Skipping unsupported content type "${rawContent.mimeType}" for file ${displayPath}`,
      );
      return { url: rawContent.source, links: [], status: FetchStatus.SUCCESS };
    }

    for (const err of processed.errors ?? []) {
      logger.warn(`Processing error for ${displayPath}: ${err.message}`);
    }

    const filename = path.basename(displayPath);
    const title = processed.title?.trim() || filename || null;

    return {
      url: rawContent.source,
      title,
      etag: rawContent.etag,
      lastModified: rawContent.lastModified,
      sourceContentType: rawContent.mimeType,
      contentType: processed.contentType || rawContent.mimeType,
      content: processed,
      links: [],
      status: FetchStatus.SUCCESS,
    };
  }

  /**
   * Cleanup pipeline resources after scrape completes.
   */
  override async cleanup(): Promise<void> {
    await Promise.allSettled(this.pipelines.map((pipeline) => pipeline.close()));
  }
}
