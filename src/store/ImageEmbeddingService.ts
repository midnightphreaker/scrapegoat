/**
 * Image Embedding Service
 *
 * Handles embedding of images/screenshots for multimodal semantic search.
 * Integrates with screenshot storage to load images and generate embeddings.
 */

import { readFile, stat } from "node:fs/promises";
import { join, normalize } from "node:path";
import { LRUCache } from "lru-cache";
import { measurePerformance } from "../monitoring/decorator.js";
import { rateLimitConfig, VECTOR_DIMENSION } from "../utils/config.js";
import { logger } from "../utils/logger.js";
import { validateFileSize, validateImageSize } from "../utils/validation.js";
import { createEmbeddingModel } from "./embeddings/EmbeddingFactory.js";
import type {
  ImageInput,
  MultimodalEmbeddings,
} from "./embeddings/FixedDimensionEmbeddings.js";
import { DimensionError, ImageEmbeddingError } from "./errors.js";

/**
 * Size limits for image processing to prevent API failures and excessive memory usage
 */
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB - maximum buffer size for in-memory processing
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB - maximum file size before loading

/**
 * Cache TTL for image embeddings (1 hour)
 */
const CACHE_TTL = 1000 * 60 * 60;

/**
 * Default timeout for image embedding operations in milliseconds
 */
const IMAGE_EMBEDDING_TIMEOUT = 30000; // 30 seconds

/**
 * Configuration for image embedding service
 */
export interface ImageEmbeddingConfig {
  /** Whether image embedding is enabled */
  enabled: boolean;
  /** Model specification for image embeddings (e.g., "openai:qwen3-text-embedding") */
  model?: string;
  /** Custom base URL for self-hosted models */
  baseURL?: string;
  /** Timeout for embedding operations in milliseconds (default: 30000ms) */
  timeout?: number;
}

/**
 * Image metadata from RawContent
 */
export interface ImageMetadata {
  /** Path to screenshot file */
  screenshotPath?: string;
  /** Media items extracted from Crawl4AI */
  media?: MediaItem[];
}

/**
 * Media item from Crawl4AI
 */
export interface MediaItem {
  type: "image";
  src: string;
  alt?: string;
}

/**
 * Image embedding result with source information
 */
export interface ImageEmbeddingResult {
  /** Image embedding vector */
  embedding: number[];
  /** Source URL or path */
  source: string;
  /** Image type (screenshot or media) */
  type: "screenshot" | "media";
}

/**
 * Progress tracking for batch embedding operations
 */
export interface BatchProgress {
  /** Total number of items to process */
  total: number;
  /** Number of items successfully processed */
  completed: number;
  /** Number of items that failed */
  failed: number;
  /** Current progress percentage (0-100) */
  percentage: number;
  /** Array of error messages from failed items */
  errors: string[];
}

/**
 * Callback function for progress updates during batch processing
 */
export type ProgressCallback = (progress: BatchProgress) => void;

/**
 * Service for generating image embeddings from screenshots and media items.
 *
 * This service integrates with the screenshot storage system to load images
 * and generate embeddings using vision-language models like qwen3-text-embedding.
 */
export class ImageEmbeddingService {
  private embeddings?: MultimodalEmbeddings;
  private config: ImageEmbeddingConfig;
  private screenshotDir: string;
  private embeddingCache: LRUCache<string, number[]>;
  private timeout: number;

  constructor(config?: Partial<ImageEmbeddingConfig>) {
    this.config = {
      enabled: process.env.IMAGE_EMBEDDING_ENABLED === "true",
      model: process.env.IMAGE_EMBEDDING_MODEL,
      baseURL: process.env.OPENAI_API_BASE,
      timeout:
        config?.timeout ||
        Number.parseInt(process.env.IMAGE_EMBEDDING_TIMEOUT || "", 10) ||
        IMAGE_EMBEDDING_TIMEOUT,
    };
    if (config) {
      Object.assign(this.config, config);
    }
    this.timeout = this.config.timeout || IMAGE_EMBEDDING_TIMEOUT;
    this.screenshotDir = process.env.SCREENSHOT_STORAGE_PATH || "./public/screenshots";

    // Initialize LRU cache for image embeddings
    this.embeddingCache = new LRUCache<string, number[]>({
      max: 1000,
      ttl: CACHE_TTL,
    });
  }

  /**
   * Initialize the image embedding model
   * @throws Error if initialization fails
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled || !this.config.model) {
      logger.debug("Image embedding disabled or no model configured");
      return;
    }

    try {
      // Import MultimodalEmbeddings dynamically to avoid circular dependency
      const { MultimodalEmbeddings } = await import(
        "./embeddings/FixedDimensionEmbeddings.js"
      );

      // Create text embeddings (reuse same model or use default)
      const textEmbeddings = createEmbeddingModel(
        process.env.EMBEDDING_MODEL || "text-embedding-3-small",
      );

      // Create image embeddings
      const imageEmbeddings = createEmbeddingModel(this.config.model!);

      // Wrap in MultimodalEmbeddings
      this.embeddings = new MultimodalEmbeddings(textEmbeddings, imageEmbeddings, true);

      logger.info(`Image embedding initialized with model: ${this.config.model}`);
    } catch (error) {
      logger.error(`Failed to initialize image embedding: ${error}`);
      this.config.enabled = false;
      throw error;
    }
  }

  /**
   * Retrieves cached embedding for a screenshot if available.
   * @returns Cached embedding or null if not found
   */
  private getCachedEmbedding(screenshotPath: string): number[] | null {
    const cached = this.embeddingCache.get(screenshotPath);
    if (cached) {
      logger.debug(`Cache hit for image embedding: ${screenshotPath}`);
      return cached;
    }
    return null;
  }

  /**
   * Loads and validates a screenshot file.
   * @returns Image input object or null if loading fails
   */
  private async loadScreenshot(screenshotPath: string): Promise<ImageInput | null> {
    try {
      const fullPath = this.resolveScreenshotPath(screenshotPath);
      const stats = await stat(fullPath);

      // Validate file size before loading
      validateFileSize(stats.size, MAX_FILE_SIZE, "Screenshot file");

      const buffer = await readFile(fullPath);
      // Validate buffer size
      validateImageSize(buffer, MAX_IMAGE_SIZE, "Screenshot buffer");

      return {
        buffer,
        description: "Page screenshot",
        url: screenshotPath,
      };
    } catch (error) {
      logger.warn(`Failed to load screenshot: ${screenshotPath} - ${error}`);
      return null;
    }
  }

  /**
   * Logs media items (currently skips external media).
   */
  private logMediaItems(media: MediaItem[]): void {
    for (const item of media) {
      if (item.type === "image" && item.src) {
        logger.debug(`Skipping external media: ${item.src}`);
      }
    }
  }

  /**
   * Generates embeddings and caches results for screenshots.
   * @returns Array of embedding results
   */
  private async generateAndCacheEmbeddings(
    images: ImageInput[],
    screenshotPath: string | undefined,
  ): Promise<ImageEmbeddingResult[]> {
    const results: ImageEmbeddingResult[] = [];

    if (!this.embeddings) {
      throw new Error("Embeddings not initialized");
    }

    const embeddings = await measurePerformance(
      "embedding",
      "image_generation",
      () =>
        this.withTimeout(
          this.embeddings!.embedImages(images),
          this.timeout,
          "Image embedding generation",
        ),
      {
        context: {
          model: this.config.model,
          batchSize: images.length,
          dimension: VECTOR_DIMENSION,
        },
      },
    );

    for (let i = 0; i < images.length; i++) {
      const embedding = embeddings[i]!;

      if (embedding.length !== VECTOR_DIMENSION) {
        throw new DimensionError(
          this.config.model || "unknown",
          embedding.length,
          VECTOR_DIMENSION,
        );
      }

      const result: ImageEmbeddingResult = {
        embedding: embedding as number[],
        source: images[i]?.url || "unknown",
        type: screenshotPath ? "screenshot" : "media",
      };
      results.push(result);

      if (result.type === "screenshot" && result.source) {
        this.embeddingCache.set(result.source, embedding);
        logger.debug(`Cached image embedding: ${result.source}`);
      }
    }

    return results;
  }

  /**
   * Generate embeddings for images from screenshot/metadata
   * @param metadata - Image metadata containing screenshot path and media items
   * @returns Array of image embedding results
   *
   * @remarks
   * This method applies a timeout (configurable via ImageEmbeddingConfig.timeout or
   * IMAGE_EMBEDDING_TIMEOUT env var, default 30000ms) to the embedding API call.
   * If the timeout is exceeded, the method logs an error and returns partial or empty results.
   */
  async embedImages(metadata: ImageMetadata): Promise<ImageEmbeddingResult[]> {
    if (!this.config.enabled || !this.embeddings) {
      return [];
    }

    // Check cache for screenshot embeddings
    if (metadata.screenshotPath) {
      const cached = this.getCachedEmbedding(metadata.screenshotPath);
      if (cached) {
        return [
          {
            embedding: cached,
            source: metadata.screenshotPath,
            type: "screenshot",
          },
        ];
      }
    }

    const images: ImageInput[] = [];

    // Load screenshot
    if (metadata.screenshotPath) {
      const screenshot = await this.loadScreenshot(metadata.screenshotPath);
      if (screenshot) {
        images.push(screenshot);
      }
    }

    // Log media items (currently skips external media)
    if (metadata.media) {
      this.logMediaItems(metadata.media);
    }

    // Generate embeddings for all loaded images
    if (images.length > 0) {
      try {
        return await this.generateAndCacheEmbeddings(images, metadata.screenshotPath);
      } catch (error) {
        logger.error(`Failed to generate image embeddings: ${error}`);
        return [];
      }
    }

    return [];
  }

  /**
   * Maximum concurrent image embedding operations
   * Configured via IMAGE_EMBEDDING_MAX_CONCURRENCY environment variable
   */
  private static readonly MAX_CONCURRENT_EMBEDDINGS =
    rateLimitConfig.embedding.maxConcurrency;

  /**
   * Generate embeddings for multiple image metadata items in parallel with concurrency control.
   * This method processes multiple screenshots/media concurrently with a limit on simultaneous
   * operations to prevent overwhelming the API or system resources.
   *
   * @param metadataArray - Array of image metadata to process
   * @param options - Optional configuration for batch processing
   * @returns Map of metadata index to embedding results (empty array for failed items)
   *
   * @example
   * ```ts
   * const metadataList = [
   *   { screenshotPath: "screenshot1.png" },
   *   { screenshotPath: "screenshot2.png" },
   * ];
   *
   * const results = await imageEmbeddingService.embedImagesBatch(metadataList, {
   *   concurrency: 3,
   *   onProgress: (progress) => console.log(`Progress: ${progress.percentage}%`),
   * });
   *
   * // results is a Map<index, ImageEmbeddingResult[]>
   * for (const [index, embeddings] of results.entries()) {
   *   console.log(`Item ${index}: ${embeddings.length} embeddings`);
   * }
   * ```
   */
  async embedImagesBatch(
    metadataArray: ImageMetadata[],
    options?: {
      /** Maximum concurrent operations (default: 5) */
      concurrency?: number;
      /** Optional callback for progress updates */
      onProgress?: ProgressCallback;
    },
  ): Promise<Map<number, ImageEmbeddingResult[]>> {
    if (!this.config.enabled || !this.embeddings) {
      return new Map();
    }

    if (metadataArray.length === 0) {
      return new Map();
    }

    const concurrency =
      options?.concurrency ?? ImageEmbeddingService.MAX_CONCURRENT_EMBEDDINGS;
    const onProgress = options?.onProgress;
    const results = new Map<number, ImageEmbeddingResult[]>();
    const errors: string[] = [];

    let completed = 0;
    let failed = 0;
    const total = metadataArray.length;

    // Initialize progress
    const updateProgress = () => {
      if (onProgress) {
        const percentage = Math.round(((completed + failed) / total) * 100);
        onProgress({
          total,
          completed,
          failed,
          percentage,
          errors: [...errors],
        });
      }
    };

    updateProgress();

    // Process items in batches with concurrency control
    for (let i = 0; i < metadataArray.length; i += concurrency) {
      const batch = metadataArray.slice(i, i + concurrency);
      const batchPromises = batch.map(async (metadata, batchIndex) => {
        const index = i + batchIndex;
        try {
          const embeddingResults = await this.embedImages(metadata);
          completed++;
          return { index, results: embeddingResults, error: null };
        } catch (error) {
          failed++;
          const errorMsg = `Failed to embed images for item ${index}: ${error}`;
          errors.push(errorMsg);
          logger.warn(errorMsg);
          return { index, results: [] as ImageEmbeddingResult[], error: errorMsg };
        }
      });

      // Wait for all items in this batch to complete
      const settledResults = await Promise.allSettled(batchPromises);

      // Process results
      for (const result of settledResults) {
        if (result.status === "fulfilled") {
          const { index, results: embeddingResults } = result.value;
          results.set(index, embeddingResults);
        } else {
          // This shouldn't happen as we catch errors above, but handle just in case
          const batchIndex = batchPromises.indexOf(result as any);
          const index = i + batchIndex;
          failed++;
          const errorMsg = `Unexpected error for item ${index}: ${result.reason}`;
          errors.push(errorMsg);
          results.set(index, []);
        }
      }

      updateProgress();
    }

    // Log summary
    logger.info(
      `Batch image embedding completed: ${completed} succeeded, ${failed} failed out of ${total} total`,
    );

    return results;
  }

  /**
   * Generate embedding for a single image
   * @param imagePath - Path or URL to the image
   * @param description - Optional description/caption
   * @returns Image embedding result
   * @throws ImageEmbeddingError if embedding fails, service is not ready, or timeout is exceeded
   *
   * @remarks
   * This method applies a timeout (configurable via ImageEmbeddingConfig.timeout or
   * IMAGE_EMBEDDING_TIMEOUT env var, default 30000ms) to the embedding API call.
   * If the timeout is exceeded, an ImageEmbeddingError is thrown with details about the timeout.
   */
  async embedSingleImage(
    imagePath: string,
    description?: string,
  ): Promise<ImageEmbeddingResult> {
    if (!this.config.enabled || !this.embeddings) {
      throw new ImageEmbeddingError(`Image embedding is not enabled or not initialized`);
    }

    // Check cache first
    const cached = this.embeddingCache.get(imagePath);
    if (cached) {
      logger.debug(`Cache hit for image embedding: ${imagePath}`);
      return {
        embedding: cached,
        source: imagePath,
        type: "screenshot",
      };
    }

    try {
      const fullPath = this.resolveScreenshotPath(imagePath);
      // Validate file size before loading
      const stats = await stat(fullPath);
      validateFileSize(stats.size, MAX_FILE_SIZE, "Screenshot file");

      const buffer = await readFile(fullPath);
      validateImageSize(buffer, MAX_IMAGE_SIZE, "Screenshot buffer");

      const embedding = await this.withTimeout(
        this.embeddings.embedImage({
          buffer,
          description,
          url: imagePath,
        }),
        this.timeout,
        `Image embedding for ${imagePath}`,
      );
      // Validate embedding dimension
      if (embedding.length !== VECTOR_DIMENSION) {
        throw new DimensionError(
          this.config.model || "unknown",
          embedding.length,
          VECTOR_DIMENSION,
        );
      }

      // Cache the embedding
      this.embeddingCache.set(imagePath, embedding);
      logger.debug(`Cached image embedding: ${imagePath}`);

      return {
        embedding,
        source: imagePath,
        type: "screenshot",
      };
    } catch (error) {
      throw new ImageEmbeddingError(`Failed to embed image ${imagePath}`, error);
    }
  }

  /**
   * Check if image embedding is enabled and ready
   */
  isReady(): boolean {
    return this.config.enabled && !!this.embeddings;
  }

  /**
   * Resolve screenshot path relative to screenshot storage directory
   * @param path - Screenshot path (may be relative or absolute)
   * @returns Resolved absolute path
   */
  private resolveScreenshotPath(path: string): string {
    const resolved = path.startsWith("/") ? path : join(this.screenshotDir, path);

    // Validate path is within allowed directory (security)
    const normalized = normalize(resolved);
    const normalizedDir = normalize(this.screenshotDir);
    if (!normalized.startsWith(normalizedDir)) {
      throw new Error(`Invalid screenshot path: outside allowed directory`);
    }

    return normalized;
  }

  /**
   * Wrap a promise with a timeout to prevent indefinite hangs
   * @param promise - The promise to wrap
   * @param timeoutMs - Timeout in milliseconds
   * @param operation - Description of the operation for error message
   * @returns The promise result or throws timeout error
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operation: string,
  ): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)),
        timeoutMs,
      ),
    );
    return Promise.race([promise, timeout]);
  }

  /**
   * Get the embedding model specification
   */
  getModel(): string | undefined {
    return this.config.model;
  }

  /**
   * Get the configured timeout for embedding operations
   * @returns Timeout in milliseconds
   */
  getTimeout(): number {
    return this.timeout;
  }
}

/**
 * Create a singleton instance of the image embedding service
 */
let imageEmbeddingServiceInstance: ImageEmbeddingService | null = null;

export function getImageEmbeddingService(): ImageEmbeddingService {
  if (!imageEmbeddingServiceInstance) {
    imageEmbeddingServiceInstance = new ImageEmbeddingService();
  }
  return imageEmbeddingServiceInstance;
}

export function resetImageEmbeddingService(): void {
  imageEmbeddingServiceInstance = null;
}
