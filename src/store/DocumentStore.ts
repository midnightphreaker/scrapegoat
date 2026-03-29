import type { Document } from "@langchain/core/documents";
import type { Embeddings } from "@langchain/core/embeddings";
import type { Pool } from "pg";
import { measurePerformance } from "../monitoring/decorator";
import type { ScraperOptions } from "../scraper/types";
import type { DocumentMetadata } from "../types";
import {
  SEARCH_OVERFETCH_FACTOR,
  SEARCH_WEIGHT_FTS,
  SEARCH_WEIGHT_VEC,
  VECTOR_DIMENSION,
  VECTOR_SEARCH_MULTIPLIER,
} from "../utils/config";
import { logger } from "../utils/logger";
import { applyMigrations } from "./applyMigrations";
import { EmbeddingConfig, type EmbeddingModelConfig } from "./embeddings/EmbeddingConfig";
import {
  areCredentialsAvailable,
  createEmbeddingModel,
  ModelConfigurationError,
  UnsupportedProviderError,
} from "./embeddings/EmbeddingFactory";
import {
  ConnectionError,
  DimensionError,
  DocumentValidationError,
  MAX_BATCH_CONTENT_LENGTH,
  MAX_DOCUMENT_CONTENT_LENGTH,
  StoreError,
} from "./errors";
import {
  getImageEmbeddingService,
  type ImageEmbeddingResult,
  type ImageMetadata,
} from "./ImageEmbeddingService";
import { PostgresConnection } from "./PostgresConnection";
import type { StoredScraperOptions } from "./types";
import {
  type DbDocument,
  type DbJoinedDocument,
  type DbPage,
  type DbVersionWithLibrary,
  denormalizeVersionName,
  mapDbDocumentToDocument,
  normalizeVersionName,
  type VersionStatus,
} from "./types";

interface RawSearchResult extends DbDocument {
  // Page fields joined from pages table
  url?: string;
  title?: string;
  content_type?: string;
  // Search scoring fields
  vec_score?: number;
  fts_score?: number;
}

interface RankedResult extends RawSearchResult {
  vec_rank?: number;
  fts_rank?: number;
  rrf_score: number;
}

/**
 * Manages document storage and retrieval using PostgreSQL with pgvector and full-text search capabilities.
 * Provides direct access to PostgreSQL with parameterized queries to store and query document
 * embeddings along with their metadata. Supports versioned storage of documents for different
 * libraries, enabling version-specific document retrieval and searches.
 *
 * NOTE: This is a PostgreSQL fork. SQLite support has been completely removed.
 */
export class DocumentStore {
  private readonly connection: PostgresConnection;
  private readonly pool: Pool;
  private embeddings!: Embeddings;
  private readonly dbDimension: number = VECTOR_DIMENSION;
  private modelDimension!: number;
  private readonly embeddingConfig?: EmbeddingModelConfig | null;
  private isVectorSearchEnabled: boolean = false;

  /**
   * Calculates Reciprocal Rank Fusion score for a result with configurable weights
   */
  private calculateRRF(vecRank?: number, ftsRank?: number, k = 60): number {
    let rrf = 0;
    if (vecRank !== undefined) {
      rrf += SEARCH_WEIGHT_VEC / (k + vecRank);
    }
    if (ftsRank !== undefined) {
      rrf += SEARCH_WEIGHT_FTS / (k + ftsRank);
    }
    return rrf;
  }

  /**
   * Assigns ranks to search results based on their scores
   */
  private assignRanks(results: RawSearchResult[]): RankedResult[] {
    // Create maps to store ranks
    const vecRanks = new Map<number, number>();
    const ftsRanks = new Map<number, number>();

    // Sort by vector scores and assign ranks
    results
      .filter((r) => r.vec_score !== undefined)
      .sort((a, b) => (b.vec_score ?? 0) - (a.vec_score ?? 0))
      .forEach((result, index) => {
        vecRanks.set(Number(result.id), index + 1);
      });

    // Sort by BM25 scores and assign ranks
    results
      .filter((r) => r.fts_score !== undefined)
      .sort((a, b) => (b.fts_score ?? 0) - (a.fts_score ?? 0))
      .forEach((result, index) => {
        ftsRanks.set(Number(result.id), index + 1);
      });

    // Combine results with ranks and calculate RRF
    return results.map((result) => ({
      ...result,
      vec_rank: vecRanks.get(Number(result.id)),
      fts_rank: ftsRanks.get(Number(result.id)),
      rrf_score: this.calculateRRF(
        vecRanks.get(Number(result.id)),
        ftsRanks.get(Number(result.id)),
      ),
    }));
  }

  constructor(connectionString: string, embeddingConfig?: EmbeddingModelConfig | null) {
    if (!connectionString) {
      throw new StoreError("Missing required PostgreSQL connection string");
    }

    // Create PostgreSQL connection
    this.connection = new PostgresConnection(connectionString);
    this.pool = this.connection.getPool();

    // Store embedding config for later initialization
    this.embeddingConfig = embeddingConfig;

    logger.debug("DocumentStore created with PostgreSQL connection");
  }

  /**
   * Pads a vector to the fixed database dimension by appending zeros.
   * Throws an error if the input vector is longer than the database dimension.
   */
  private padVector(vector: number[]): number[] {
    if (vector.length > this.dbDimension) {
      throw new Error(
        `Vector dimension ${vector.length} exceeds database dimension ${this.dbDimension}`,
      );
    }
    if (vector.length === this.dbDimension) {
      return vector;
    }
    return [...vector, ...new Array(this.dbDimension - vector.length).fill(0)];
  }

  /**
   * Initialize the embeddings client using the provided config.
   * If no embedding config is provided (null or undefined), embeddings will not be initialized.
   * This allows DocumentStore to be used without embeddings for FTS-only operations.
   *
   * Environment variables per provider:
   * - openai: OPENAI_API_KEY (and optionally OPENAI_API_BASE, OPENAI_ORG_ID)
   * - vertex: GOOGLE_APPLICATION_CREDENTIALS (path to service account JSON)
   * - gemini: GOOGLE_API_KEY
   * - aws: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
   * - microsoft: Azure OpenAI credentials (AZURE_OPENAI_API_*)
   */
  private async initializeEmbeddings(): Promise<void> {
    // If embedding config is explicitly null or undefined, skip embedding initialization
    if (this.embeddingConfig === null || this.embeddingConfig === undefined) {
      logger.debug(
        "Embedding initialization skipped (no config provided - FTS-only mode)",
      );
      return;
    }

    const config = this.embeddingConfig;

    // Check if credentials are available for the provider
    if (!areCredentialsAvailable(config.provider)) {
      logger.warn(
        `⚠️ No credentials found for ${config.provider} embedding provider. Vector search is disabled.\n` +
          `   Only full-text search will be available. To enable vector search, please configure the required\n` +
          `   environment variables for ${config.provider} or choose a different provider.\n` +
          `   See README.md for configuration options or run with --help for more details.`,
      );
      return; // Skip initialization, keep isVectorSearchEnabled = false
    }

    // Create embedding model
    try {
      this.embeddings = createEmbeddingModel(config.modelSpec);

      // Use known dimensions if available, otherwise detect via test query
      if (config.dimensions !== null) {
        this.modelDimension = config.dimensions;
      } else {
        // Fallback: determine the model's actual dimension by embedding a test string
        const testVector = await this.embeddings.embedQuery("test");
        this.modelDimension = testVector.length;

        // Cache the discovered dimensions for future use
        EmbeddingConfig.setKnownModelDimensions(config.model, this.modelDimension);
      }

      if (this.modelDimension > this.dbDimension) {
        throw new DimensionError(config.modelSpec, this.modelDimension, this.dbDimension);
      }

      // If we reach here, embeddings are successfully initialized
      this.isVectorSearchEnabled = true;
      logger.debug(
        `Embeddings initialized: ${config.provider}:${config.model} (${this.modelDimension}d)`,
      );
    } catch (error) {
      // Handle model-related errors with helpful messages
      if (error instanceof Error) {
        if (
          error.message.includes("does not exist") ||
          error.message.includes("MODEL_NOT_FOUND")
        ) {
          throw new ModelConfigurationError(
            `❌ Invalid embedding model: ${config.model}\n` +
              `   The model "${config.model}" is not available or you don't have access to it.\n` +
              "   See README.md for supported models or run with --help for more details.",
          );
        }
        if (
          error.message.includes("API key") ||
          error.message.includes("401") ||
          error.message.includes("authentication")
        ) {
          throw new ModelConfigurationError(
            `❌ Authentication failed for ${config.provider} embedding provider\n` +
              "   Please check your API key configuration.\n" +
              "   See README.md for configuration options or run with --help for more details.",
          );
        }
      }
      // Re-throw other embedding errors (like DimensionError) as-is
      throw error;
    }
  }

  /**
   * Initializes the DocumentStore by establishing database connection and preparing resources.
   * Performs the following initialization steps:
   * - Tests PostgreSQL database connectivity
   * - Checks and installs pgvector extension if needed
   * - Verifies database permissions for table creation
   * - Runs database migrations to ensure schema is up-to-date
   * - Initializes the embeddings client for vector search
   * - Initializes the image embedding service
   *
   * @throws {ConnectionError} If database connection fails or cannot be established
   * @throws {StoreError} If database permissions are insufficient or migration fails
   * @throws {ModelConfigurationError} If embedding model configuration is invalid
   * @throws {UnsupportedProviderError} If the embedding provider is not supported
   * @returns {Promise<void>} Resolves when initialization is complete
   *
   * @example
   * ```typescript
   * const store = new DocumentStore(connectionString, embeddingConfig);
   * await store.initialize();
   * console.log("DocumentStore ready");
   * ```
   */
  async initialize(): Promise<void> {
    try {
      logger.info("🔧 Initializing DocumentStore with PostgreSQL...");

      // 1. Test database connectivity
      logger.debug("Testing PostgreSQL connection...");
      await this.connection.testConnection();

      // 2. Check and install pgvector extension
      logger.debug("Checking pgvector extension...");
      const { installed } = await this.connection.checkPgvectorExtension();

      if (!installed) {
        logger.info("Installing pgvector extension...");
        await this.connection.installPgvectorExtension();
      }

      // 3. Check permissions
      logger.debug("Checking database permissions...");
      const permissions = await this.connection.checkPermissions();

      if (!permissions.canCreateTables) {
        throw new StoreError(
          "❌ Insufficient database permissions. Cannot create tables.\n" +
            "   Please grant the following permissions:\n" +
            "   GRANT CREATE ON SCHEMA public TO your_user;\n" +
            "   GRANT ALL ON ALL TABLES IN SCHEMA public TO your_user;",
        );
      }

      // 4. Run database migrations
      logger.debug("Running database migrations...");
      await applyMigrations(this.pool);

      // 5. Initialize embeddings client
      logger.debug("Initializing embeddings...");
      await this.initializeEmbeddings();

      // 5.5. Initialize image embedding service
      logger.debug("Initializing image embeddings...");
      try {
        const imageEmbeddingService = getImageEmbeddingService();
        await imageEmbeddingService.initialize();
      } catch (error) {
        logger.warn(
          `Image embedding initialization failed: ${error}. Image search will be disabled.`,
        );
      }

      // Log pool statistics
      const stats = this.connection.getPoolStats();
      logger.info(
        `✅ DocumentStore initialized successfully (pool: ${stats.total} total, ${stats.idle} idle)`,
      );
    } catch (error) {
      // Re-throw StoreError, ModelConfigurationError, and UnsupportedProviderError directly
      if (
        error instanceof StoreError ||
        error instanceof ModelConfigurationError ||
        error instanceof UnsupportedProviderError
      ) {
        throw error;
      }
      throw new ConnectionError("Failed to initialize database connection", error);
    }
  }

  /**
   * Gracefully closes the database connection and releases all resources.
   * Should be called when the DocumentStore is no longer needed to prevent
   * connection leaks and ensure clean shutdown.
   *
   * @throws {Error} If an error occurs while closing the database connection
   * @returns {Promise<void>} Resolves when shutdown is complete
   *
   * @example
   * ```typescript
   * await store.shutdown();
   * console.log("DocumentStore shut down successfully");
   * ```
   */
  async shutdown(): Promise<void> {
    try {
      await this.connection.close();
      logger.info("DocumentStore shutdown complete");
    } catch (error) {
      logger.error(`Error during DocumentStore shutdown: ${error}`);
      throw error;
    }
  }

  /**
   * Resolves a library name and version string to a database version_id.
   * Creates library and version records if they don't already exist.
   * Library names are normalized to lowercase for case-insensitive matching.
   *
   * @param {string} library - The library name (case-insensitive, will be normalized to lowercase)
   * @param {string} version - The version string (will be normalized for consistent storage)
   * @returns {Promise<number>} The database version_id for the resolved library:version
   * @throws {StoreError} If database query fails or version cannot be resolved
   *
   * @example
   * ```typescript
   * const versionId = await store.resolveVersionId("react", "18.2.0");
   * console.log(`Version ID: ${versionId}`);
   * ```
   */
  async resolveVersionId(library: string, version: string): Promise<number> {
    try {
      // 1. Get or create library (normalize to lowercase for case-insensitive matching)
      const normalizedLibrary = library.toLowerCase();
      const libraryResult = await this.pool.query(
        `INSERT INTO libraries (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [normalizedLibrary],
      );
      // INSERT...RETURNING always returns a row for INSERT/UPDATE operations
      const libraryId = libraryResult.rows[0]?.id;
      if (libraryId === undefined) {
        throw new StoreError(`Failed to resolve library ID for ${library}`);
      }

      // 2. Get or create version (normalize version name to lowercase for case-insensitive matching)
      const normalizedVersion = normalizeVersionName(version).toLowerCase();
      const versionResult = await this.pool.query(
        `INSERT INTO versions (library_id, name, status)
         VALUES ($1, $2, 'not_indexed')
         ON CONFLICT (library_id, name) DO UPDATE SET library_id = EXCLUDED.library_id
         RETURNING id`,
        [libraryId, normalizedVersion],
      );
      // INSERT...RETURNING always returns a row for INSERT/UPDATE operations
      const versionId = versionResult.rows[0]?.id;
      if (versionId === undefined) {
        throw new StoreError(`Failed to resolve version ID for ${library}:${version}`);
      }

      return versionId;
    } catch (error) {
      throw new StoreError(
        `Failed to resolve version ID for ${library}:${version}`,
        error,
      );
    }
  }

  /**
   * Retrieves all unique version strings for a specific library.
   * Versions are returned in descending order by creation date (newest first).
   * Version strings are denormalized to their original format.
   *
   * @param {string} library - The library name to query versions for (case-insensitive)
   * @returns {Promise<string[]>} Array of version strings, sorted by creation date (newest first)
   * @throws {StoreError} If database query fails
   *
   * @example
   * ```typescript
   * const versions = await store.queryUniqueVersions("react");
   * console.log(`Available versions: ${versions.join(", ")}`);
   * // Output: ["18.2.0", "18.1.0", "17.0.2"]
   * ```
   */
  async queryUniqueVersions(library: string): Promise<string[]> {
    try {
      const result = await this.pool.query(
        `SELECT v.name
         FROM versions v
         INNER JOIN libraries l ON v.library_id = l.id
         WHERE LOWER(l.name) = LOWER($1)
         ORDER BY v.created_at DESC`,
        [library],
      );

      return result.rows.map((row) => denormalizeVersionName(row.name));
    } catch (error) {
      throw new StoreError(`Failed to query versions for library ${library}`, error);
    }
  }

  /**
   * Updates the status of a version record in the database.
   * Tracks the indexing state of a library version (e.g., "indexing", "indexed", "failed").
   *
   * @param {number} versionId - The database ID of the version to update
   * @param {VersionStatus} status - The new status value (e.g., "not_indexed", "indexing", "indexed", "failed")
   * @param {string} [errorMessage] - Optional error message if status is "failed"
   * @returns {Promise<void>} Resolves when the status is updated
   * @throws {StoreError} If database query fails
   *
   * @example
   * ```typescript
   * await store.updateVersionStatus(versionId, "indexing");
   * // ... perform indexing ...
   * await store.updateVersionStatus(versionId, "indexed");
   * ```
   * @example
   * ```typescript
   * try {
   *   await store.updateVersionStatus(versionId, "indexed");
   * } catch (error) {
   *   await store.updateVersionStatus(versionId, "failed", error.message);
   * }
   * ```
   */
  async updateVersionStatus(
    versionId: number,
    status: VersionStatus,
    errorMessage?: string,
  ): Promise<void> {
    try {
      await this.pool.query(
        `UPDATE versions
         SET status = $1, error_message = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [status, errorMessage || null, versionId],
      );
    } catch (error) {
      throw new StoreError(
        `Failed to update version status for version ${versionId}`,
        error,
      );
    }
  }

  /**
   * Updates the progress counters for a version being indexed.
   * Tracks how many pages have been processed out of the total expected pages.
   * Useful for showing indexing progress to users.
   *
   * @param {number} versionId - The database ID of the version being indexed
   * @param {number} pages - The number of pages that have been processed so far
   * @param {number} maxPages - The total number of pages expected to be processed
   * @returns {Promise<void>} Resolves when progress is updated
   * @throws {StoreError} If database query fails
   *
   * @example
   * ```typescript
   * const totalPages = urls.length;
   * for (let i = 0; i < urls.length; i++) {
   *   await indexPage(urls[i]);
   *   await store.updateVersionProgress(versionId, i + 1, totalPages);
   * }
   * ```
   */
  async updateVersionProgress(
    versionId: number,
    pages: number,
    maxPages: number,
  ): Promise<void> {
    try {
      await this.pool.query(
        `UPDATE versions
         SET progress_pages = $1, progress_max_pages = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [pages, maxPages, versionId],
      );
    } catch (error) {
      throw new StoreError(
        `Failed to update version progress for version ${versionId}`,
        error,
      );
    }
  }

  /**
   * Retrieves versions that match any of the specified statuses.
   * Useful for finding versions that need indexing, retrying failed versions, etc.
   * Results are sorted by update date (most recently updated first).
   *
   * @param {VersionStatus[]} statuses - Array of status values to filter by (e.g., ["not_indexed", "failed"])
   * @returns {Promise<DbVersionWithLibrary[]>} Array of version records with library name included
   * @throws {StoreError} If database query fails
   * @returns {Promise<DbVersionWithLibrary[]>} Empty array if no versions match or if statuses array is empty
   *
   * @example
   * ```typescript
   * // Find versions that need indexing
   * const notIndexed = await store.getVersionsByStatus(["not_indexed"]);
   * for (const version of notIndexed) {
   *   console.log(`Indexing ${version.library_name}:${version.name}`);
   *   await indexVersion(version);
   * }
   * ```
   */
  async getVersionsByStatus(statuses: VersionStatus[]): Promise<DbVersionWithLibrary[]> {
    try {
      if (statuses.length === 0) {
        return [];
      }

      const result = await this.pool.query(
        `SELECT v.*, l.name as library_name
         FROM versions v
         INNER JOIN libraries l ON v.library_id = l.id
         WHERE v.status = ANY($1)
         ORDER BY v.updated_at DESC`,
        [statuses],
      );

      return result.rows as DbVersionWithLibrary[];
    } catch (error) {
      throw new StoreError("Failed to query versions by status", error);
    }
  }

  /**
   * Stores scraper configuration options for a version to enable reproducible indexing.
   * Persists the scraping configuration so that the same indexing operation can be
   * replayed or audited later. This is important for debugging and reproducibility.
   *
   * @param {number} versionId - The database ID of the version to store options for
   * @param {ScraperOptions} options - The scraper options to store (includes fetcher type, scope, depth, etc.)
   * @returns {Promise<void>} Resolves when options are stored
   * @throws {StoreError} If database query fails or options cannot be serialized
   *
   * @example
   * ```typescript
   * const options: ScraperOptions = {
   *   fetcherType: "auto",
   *   scope: "subpages",
   *   maxDepth: 3,
   *   maxPages: 100
   * };
   * await store.storeScraperOptions(versionId, options);
   * ```
   */
  async storeScraperOptions(versionId: number, options: ScraperOptions): Promise<void> {
    try {
      await this.pool.query(
        `UPDATE versions
         SET scraper_options = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [JSON.stringify(options), versionId],
      );
    } catch (error) {
      throw new StoreError(
        `Failed to store scraper options for version ${versionId}`,
        error,
      );
    }
  }

  /**
   * Retrieves the stored scraping configuration for a version.
   * Returns both the source URL and scraper options used during indexing.
   * Useful for re-indexing or auditing previous indexing operations.
   *
   * @param {number} versionId - The database ID of the version to get options for
   * @returns {Promise<StoredScraperOptions | null>} The stored scraper options including source URL, or null if version doesn't exist
   * @throws {StoreError} If database query fails or options cannot be deserialized
   *
   * @example
   * ```typescript
   * const options = await store.getScraperOptions(versionId);
   * if (options) {
   *   console.log(`Source URL: ${options.sourceUrl}`);
   *   console.log(`Fetcher: ${options.options?.fetcherType}`);
   *   // Re-index with same configuration
   *   await scrapeAndIndex(options.sourceUrl, options.options);
   * }
   * ```
   */
  async getScraperOptions(versionId: number): Promise<StoredScraperOptions | null> {
    try {
      const result = await this.pool.query(
        `SELECT source_url, scraper_options
         FROM versions
         WHERE id = $1`,
        [versionId],
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        sourceUrl: row.source_url,
        options: row.scraper_options ? JSON.parse(row.scraper_options) : null,
      };
    } catch (error) {
      throw new StoreError(
        `Failed to get scraper options for version ${versionId}`,
        error,
      );
    }
  }

  /**
   * Finds all library versions that were indexed from the same source URL.
   * Useful for detecting duplicate indexing or finding alternative versions of the same documentation.
   * Results are sorted by creation date (newest first).
   *
   * @param {string} url - The source URL to search for
   * @returns {Promise<DbVersionWithLibrary[]>} Array of versions indexed from the specified URL
   * @throws {StoreError} If database query fails
   *
   * @example
   * ```typescript
   * const versions = await store.findVersionsBySourceUrl("https://docs.example.com");
   * console.log(`Found ${versions.length} versions from this URL`);
   * for (const v of versions) {
   *   console.log(`- ${v.library_name} ${v.name}`);
   * }
   * ```
   */
  async findVersionsBySourceUrl(url: string): Promise<DbVersionWithLibrary[]> {
    try {
      const result = await this.pool.query(
        `SELECT v.*, l.name as library_name
         FROM versions v
         INNER JOIN libraries l ON v.library_id = l.id
         WHERE v.source_url = $1
         ORDER BY v.created_at DESC`,
        [url],
      );

      return result.rows as DbVersionWithLibrary[];
    } catch (error) {
      throw new StoreError(`Failed to find versions by source URL: ${url}`, error);
    }
  }

  /**
   * Verifies whether any documents exist for a specific library version.
   * Useful for checking if a version has already been indexed before
   * starting a new indexing operation.
   *
   * @param {string} library - The library name (case-insensitive)
   * @param {string} version - The version string (will be normalized for comparison)
   * @returns {Promise<boolean>} True if documents exist for this library:version, false otherwise
   * @throws {StoreError} If database query fails
   *
   * @example
   * ```typescript
   * const hasDocs = await store.checkDocumentExists("react", "18.2.0");
   * if (hasDocs) {
   *   console.log("Already indexed, skipping");
   * } else {
   *   await scrapeAndIndex("https://react.dev", library, version);
   * }
   * ```
   */
  async checkDocumentExists(library: string, version: string): Promise<boolean> {
    try {
      const normalizedVersion = normalizeVersionName(version);
      const result = await this.pool.query(
        `SELECT EXISTS (
           SELECT 1
           FROM documents d
           INNER JOIN pages p ON d.page_id = p.id
           INNER JOIN versions v ON p.version_id = v.id
           INNER JOIN libraries l ON v.library_id = l.id
           WHERE LOWER(l.name) = LOWER($1) AND LOWER(v.name) = LOWER($2)
         ) as exists`,
        [library, normalizedVersion],
      );

      return result.rows[0].exists;
    } catch (error) {
      throw new StoreError(
        `Failed to check document existence for ${library}:${version}`,
        error,
      );
    }
  }

  /**
   * Retrieves a comprehensive mapping of all libraries to their available versions with detailed metadata.
   * Returns information including indexing status, progress, document counts, and timestamps.
   * Useful for displaying library/version listings in UI or for bulk operations.
   *
   * @returns {Promise<Map<string, Array<{
   *   version: string;
   *   versionId: number;
   *   status: VersionStatus;
   *   progressPages: number;
   *   progressMaxPages: number;
   *   sourceUrl: string | null;
   *   documentCount: number;
   *   uniqueUrlCount: number;
   *   indexedAt: string | null;
   * }>>>} A Map where keys are library names and values are arrays of version details
   * @throws {StoreError} If database query fails
   *
   * @example
   * ```typescript
   * const libraries = await store.queryLibraryVersions();
   * for (const [libName, versions] of libraries.entries()) {
   *   console.log(`Library: ${libName}`);
   *   for (const v of versions) {
   *     console.log(`  ${v.version}: ${v.status} (${v.documentCount} docs)`);
   *   }
   * }
   * ```
   */
  async queryLibraryVersions(): Promise<
    Map<
      string,
      Array<{
        version: string;
        versionId: number;
        status: VersionStatus;
        progressPages: number;
        progressMaxPages: number;
        sourceUrl: string | null;
        documentCount: number;
        uniqueUrlCount: number;
        indexedAt: string | null;
      }>
    >
  > {
    try {
      const result = await this.pool.query(`
        SELECT
          l.name as library_name,
          v.id as version_id,
          v.name as version_name,
          v.status,
          v.progress_pages,
          v.progress_max_pages,
          v.source_url,
          v.updated_at as indexed_at,
          COUNT(DISTINCT d.id) as document_count,
          COUNT(DISTINCT p.url) as unique_url_count
        FROM libraries l
        INNER JOIN versions v ON l.id = v.library_id
        LEFT JOIN pages p ON v.id = p.version_id
        LEFT JOIN documents d ON p.id = d.page_id
        GROUP BY l.name, v.id, v.name, v.status, v.progress_pages, v.progress_max_pages, v.source_url, v.updated_at
        ORDER BY l.name, v.created_at DESC
      `);

      const libraryMap = new Map<string, Array<any>>();

      for (const row of result.rows) {
        const libraryName = row.library_name;
        if (!libraryMap.has(libraryName)) {
          libraryMap.set(libraryName, []);
        }

        const versions = libraryMap.get(libraryName);
        if (versions === undefined) {
          // Should never happen since we just checked has(), but type safety requires it
          continue;
        }

        versions.push({
          version: denormalizeVersionName(row.version_name),
          versionId: row.version_id,
          status: row.status,
          progressPages: row.progress_pages,
          progressMaxPages: row.progress_max_pages,
          sourceUrl: row.source_url,
          documentCount: Number(row.document_count),
          uniqueUrlCount: Number(row.unique_url_count),
          indexedAt: row.indexed_at,
        });
      }

      return libraryMap;
    } catch (error) {
      throw new StoreError("Failed to query library versions", error);
    }
  }

  /**
   * Validates the total batch content size against maximum allowed size.
   * @throws {DocumentValidationError} If batch size exceeds maximum
   */
  private validateBatchSize(documents: Document[]): void {
    const totalBatchSize = documents.reduce(
      (sum, doc) => sum + doc.pageContent.length,
      0,
    );
    if (totalBatchSize > MAX_BATCH_CONTENT_LENGTH) {
      throw new DocumentValidationError(
        "Batch content exceeds maximum allowed size",
        totalBatchSize,
        MAX_BATCH_CONTENT_LENGTH,
        undefined,
        documents.length,
      );
    }
  }

  /**
   * Validates individual document sizes against maximum allowed size.
   * @throws {DocumentValidationError} If any document exceeds maximum size
   */
  private validateIndividualDocuments(documents: Document[]): void {
    for (const doc of documents) {
      const docSize = doc.pageContent.length;
      if (docSize > MAX_DOCUMENT_CONTENT_LENGTH) {
        const url = (doc.metadata as DocumentMetadata).url || "unknown";
        throw new DocumentValidationError(
          "Document content exceeds maximum allowed size",
          docSize,
          MAX_DOCUMENT_CONTENT_LENGTH,
          url,
        );
      }
    }
  }

  /**
   * Groups documents by their URL for batch processing.
   * @returns Map of URL to array of documents for that URL
   */
  private groupDocumentsByUrl(documents: Document[]): Map<string, Document[]> {
    const docsByUrl = new Map<string, Document[]>();
    for (const doc of documents) {
      const url = (doc.metadata as DocumentMetadata).url || "";
      if (!docsByUrl.has(url)) {
        docsByUrl.set(url, []);
      }
      const urlDocs = docsByUrl.get(url);
      if (urlDocs) {
        urlDocs.push(doc);
      }
    }
    return docsByUrl;
  }

  /**
   * Collects metadata for image embedding from documents grouped by URL.
   * @returns Array of URL and metadata pairs that need image embedding
   */
  private collectImageEmbeddingMetadata(
    docsByUrl: Map<string, Document[]>,
  ): Array<{ url: string; metadata: ImageMetadata }> {
    const metadataForEmbedding: Array<{ url: string; metadata: ImageMetadata }> = [];
    for (const [url, urlDocs] of Array.from(docsByUrl.entries())) {
      if (urlDocs.length === 0) continue;
      const firstMeta = urlDocs[0]?.metadata as DocumentMetadata | undefined;
      if (firstMeta && firstMeta.screenshotPath) {
        metadataForEmbedding.push({
          url,
          metadata: {
            screenshotPath: firstMeta.screenshotPath as string,
            media: firstMeta.media as ImageMetadata["media"],
          },
        });
      }
    }
    return metadataForEmbedding;
  }

  /**
   * Batch generates image embeddings for all URLs with screenshots.
   * @returns Map of URL to image embeddings for that URL
   */
  private async generateImageEmbeddingsForBatch(
    docsByUrl: Map<string, Document[]>,
  ): Promise<Map<string, ImageEmbeddingResult[]>> {
    const urlImageEmbeddings = new Map<string, ImageEmbeddingResult[]>();
    const imageEmbeddingService = getImageEmbeddingService();

    if (!imageEmbeddingService.isReady()) {
      return urlImageEmbeddings;
    }

    const metadataForEmbedding = this.collectImageEmbeddingMetadata(docsByUrl);

    if (metadataForEmbedding.length === 0) {
      return urlImageEmbeddings;
    }

    try {
      const embeddingResults = await imageEmbeddingService.embedImagesBatch(
        metadataForEmbedding.map((m) => m.metadata),
        {
          concurrency: 5,
          onProgress: (progress) => {
            if (progress.percentage % 25 === 0 || progress.percentage === 100) {
              logger.debug(
                `Image embedding progress: ${progress.percentage}% ` +
                  `(${progress.completed}/${progress.total} completed, ${progress.failed} failed)`,
              );
            }
          },
        },
      );

      for (const [index, embeddings] of Array.from(embeddingResults.entries())) {
        const item = metadataForEmbedding[index];
        if (item) {
          urlImageEmbeddings.set(item.url, embeddings);
        }
      }

      logger.info(
        `Batch image embedding completed: ${embeddingResults.size} URLs processed ` +
          `(${metadataForEmbedding.length} total)`,
      );
    } catch (error) {
      logger.warn(`Failed to batch generate image embeddings: ${error}`);
    }

    return urlImageEmbeddings;
  }

  /**
   * Prepares page metadata JSON string from document metadata.
   * @returns JSON string or null if no metadata to store
   */
  private preparePageMetadata(metadata: DocumentMetadata): string | null {
    const pageMetadata: Record<string, unknown> = {};
    if (metadata.media) {
      pageMetadata.media = metadata.media;
    }
    if (metadata.links) {
      pageMetadata.links = metadata.links;
    }
    return Object.keys(pageMetadata).length > 0 ? JSON.stringify(pageMetadata) : null;
  }

  /**
   * Generates text embeddings for a batch of documents if vector search is enabled.
   * @returns Array of embeddings or null if vector search is disabled
   */
  private async generateTextEmbeddings(
    documents: Document[],
  ): Promise<number[][] | null> {
    if (!this.isVectorSearchEnabled) {
      return null;
    }

    const texts = documents.map((doc) => doc.pageContent);

    // Track embedding generation performance
    const embeddings = await measurePerformance(
      "embedding",
      "text_generation",
      async () => await this.embeddings.embedDocuments(texts),
      {
        context: {
          batchSize: documents.length,
          totalChars: texts.reduce((sum, text) => sum + text.length, 0),
          dimension: this.modelDimension,
        },
      },
    );

    return embeddings.map((emb) => this.padVector(emb));
  }

  /**
   * Inserts a batch of documents for a specific page.
   */
  private async insertDocumentBatch(
    pageId: number,
    documents: Document[],
    embeddings: number[][] | null,
    imageEmbeddings: ImageEmbeddingResult[] | null,
  ): Promise<void> {
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      if (!doc) {
        continue;
      }
      const embedding = embeddings ? embeddings[i] : null;
      const embeddingStr = embedding ? `[${embedding.join(",")}]` : null;

      const docMetadata = { ...doc.metadata };
      if (imageEmbeddings && imageEmbeddings.length > 0) {
        docMetadata.imageEmbeddings = imageEmbeddings.map((img) => ({
          embedding: img.embedding,
          source: img.source,
          type: img.type,
        }));
      }

      await this.pool.query(
        `INSERT INTO documents (page_id, content, embedding, metadata, sort_order)
         VALUES ($1, $2, $3::vector, $4, $5)`,
        [pageId, doc.pageContent, embeddingStr, JSON.stringify(docMetadata), i],
      );
    }
  }

  /**
   * Processes all documents for a single URL: creates/updates page, generates embeddings, inserts documents.
   */
  private async processUrlDocuments(
    versionId: number,
    url: string,
    urlDocs: Document[],
    imageEmbeddings: ImageEmbeddingResult[] | null,
  ): Promise<void> {
    if (urlDocs.length === 0) {
      return;
    }

    const firstMeta = urlDocs[0]?.metadata as DocumentMetadata;
    const pageMetadataStr = this.preparePageMetadata(firstMeta);

    const pageResult = await this.pool.query(
      `INSERT INTO pages (version_id, url, title, etag, last_modified, content_type, screenshot_path, fetcher_type, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (version_id, url) DO UPDATE SET
         title = EXCLUDED.title,
         etag = EXCLUDED.etag,
         last_modified = EXCLUDED.last_modified,
         content_type = EXCLUDED.content_type,
         screenshot_path = EXCLUDED.screenshot_path,
         fetcher_type = EXCLUDED.fetcher_type,
         metadata = EXCLUDED.metadata
       RETURNING id`,
      [
        versionId,
        url,
        firstMeta.title || null,
        firstMeta.etag || null,
        firstMeta.last_modified || null,
        firstMeta.content_type || null,
        firstMeta.screenshotPath || null,
        firstMeta.fetcherType || null,
        pageMetadataStr,
      ],
    );

    const pageId = pageResult.rows[0]?.id;
    if (pageId === undefined) {
      throw new StoreError(`Failed to create/update page for URL: ${url}`);
    }

    const embeddings = await this.generateTextEmbeddings(urlDocs);

    if (imageEmbeddings && imageEmbeddings.length > 0) {
      logger.debug(
        `Using pre-generated image embeddings for ${url}: ${imageEmbeddings.length} embeddings`,
      );
    }

    await this.pool.query("DELETE FROM documents WHERE page_id = $1", [pageId]);
    await this.insertDocumentBatch(pageId, urlDocs, embeddings, imageEmbeddings);
  }

  /**
   * Stores documents with library and version metadata, generating embeddings for vector similarity search.
   * Documents are grouped by URL and stored with page-level metadata (title, content type, etc.).
   * Vector embeddings are generated if enabled, and image embeddings are generated for screenshots.
   *
   * @param {string} library - The library name for the documents
   * @param {string} version - The version string for the documents
   * @param {Document[]} documents - Array of Langchain Document objects to store (each contains pageContent and metadata)
   * @returns {Promise<void>} Resolves when all documents are stored
   * @throws {StoreError} If database operation fails, embedding generation fails, or version cannot be resolved
   *
   * @example
   * ```typescript
   * const docs = [
   *   new Document({
   *     pageContent: "React is a JavaScript library...",
   *     metadata: { url: "https://react.dev/learn", title: "Learn React" }
   *   })
   * ];
   * await store.addDocuments("react", "18.2.0", docs);
   * ```
   * @remarks
   * - Documents are grouped by URL and stored with page-level records
   * - Existing documents for the same URL are replaced (upsert operation)
   * - Vector embeddings are padded to the fixed database dimension
   * - Image embeddings are generated if screenshots are available
   */
  async addDocuments(
    library: string,
    version: string,
    documents: Document[],
  ): Promise<void> {
    if (documents.length === 0) {
      return;
    }

    try {
      this.validateBatchSize(documents);
      this.validateIndividualDocuments(documents);

      const versionId = await this.resolveVersionId(library, version);
      const docsByUrl = this.groupDocumentsByUrl(documents);
      const urlImageEmbeddings = await this.generateImageEmbeddingsForBatch(docsByUrl);

      for (const [url, urlDocs] of Array.from(docsByUrl.entries())) {
        const imageEmbeddings = urlImageEmbeddings.get(url) || null;
        await this.processUrlDocuments(versionId, url, urlDocs, imageEmbeddings);
      }

      logger.debug(`Stored ${documents.length} documents for ${library}:${version}`);
    } catch (error) {
      throw new StoreError(`Failed to add documents for ${library}:${version}`, error);
    }
  }

  /**
   * Removes all documents matching the specified library and version.
   * Deletes all document chunks associated with the library:version combination.
   * Note: This does not delete the version or library records, only the documents.
   *
   * @param {string} library - The library name (case-insensitive)
   * @param {string} version - The version string (will be normalized)
   * @returns {Promise<number>} The number of documents deleted
   * @throws {StoreError} If database operation fails
   *
   * @example
   * ```typescript
   * const deletedCount = await store.deleteDocuments("react", "18.2.0");
   * console.log(`Deleted ${deletedCount} documents`);
   * ```
   */
  async deleteDocuments(library: string, version: string): Promise<number> {
    try {
      const normalizedVersion = normalizeVersionName(version);
      const result = await this.pool.query(
        `DELETE FROM documents
         WHERE page_id IN (
           SELECT p.id
           FROM pages p
           INNER JOIN versions v ON p.version_id = v.id
           INNER JOIN libraries l ON v.library_id = l.id
           WHERE LOWER(l.name) = LOWER($1) AND LOWER(v.name) = LOWER($2)
         )`,
        [library, normalizedVersion],
      );

      return result.rowCount || 0;
    } catch (error) {
      throw new StoreError(`Failed to delete documents for ${library}:${version}`, error);
    }
  }

  /**
   * Removes documents for a specific URL within a library and version.
   * Useful for selectively re-indexing a single page without affecting
   * other documents in the same version.
   *
   * @param {string} library - The library name (case-insensitive)
   * @param {string} version - The version string (will be normalized)
   * @param {string} url - The exact URL to delete documents for
   * @returns {Promise<number>} The number of documents deleted
   * @throws {StoreError} If database operation fails
   *
   * @example
   * ```typescript
   * // Re-index a single page
   * await store.deleteDocumentsByUrl("react", "18.2.0", "https://react.dev/learn");
   * const newDocs = await scrapePage("https://react.dev/learn");
   * await store.addDocuments("react", "18.2.0", newDocs);
   * ```
   */
  async deleteDocumentsByUrl(
    library: string,
    version: string,
    url: string,
  ): Promise<number> {
    try {
      const normalizedVersion = normalizeVersionName(version);
      const result = await this.pool.query(
        `DELETE FROM documents
         WHERE page_id IN (
           SELECT p.id
           FROM pages p
           INNER JOIN versions v ON p.version_id = v.id
           INNER JOIN libraries l ON v.library_id = l.id
           WHERE l.name = $1 AND v.name = $2 AND p.url = $3
         )`,
        [library, normalizedVersion, url],
      );

      return result.rowCount || 0;
    } catch (error) {
      throw new StoreError(
        `Failed to delete documents for ${library}:${version} URL: ${url}`,
        error,
      );
    }
  }

  /**
   * Removes all pages (and their documents) whose URLs are NOT in the provided set.
   * This is used for atomic rescrape: after successfully scraping new documents,
   * delete all old pages that weren't part of this scrape.
   *
   * @param {string} library - The library name (case-insensitive)
   * @param {string} version - The version string (will be normalized)
   * @param {Set<string>} urlsToKeep - Set of URLs that should be preserved
   * @returns {Promise<number>} The number of pages deleted
   * @throws {StoreError} If database operation fails
   *
   * @example
   * ```typescript
   * const scrapedUrls = new Set(["https://react.dev/learn", "https://react.dev/api"]);
   * const deleted = await store.deletePagesNotInUrls("react", "18.2.0", scrapedUrls);
   * console.log(`Cleaned up ${deleted} old pages`);
   * ```
   */
  async deletePagesNotInUrls(
    library: string,
    version: string,
    urlsToKeep: Set<string>,
  ): Promise<number> {
    try {
      const normalizedVersion = normalizeVersionName(version);

      if (urlsToKeep.size === 0) {
        return 0;
      }

      const urlArray = Array.from(urlsToKeep);
      const placeholders = urlArray.map((_, i) => `$${i + 3}`).join(", ");

      const result = await this.pool.query(
        `DELETE FROM pages
         WHERE version_id IN (
           SELECT v.id
           FROM versions v
           INNER JOIN libraries l ON v.library_id = l.id
           WHERE LOWER(l.name) = LOWER($1) AND LOWER(v.name) = LOWER($2)
         )
         AND url NOT IN (${placeholders})`,
        [library, normalizedVersion, ...urlArray],
      );

      return result.rowCount || 0;
    } catch (error) {
      throw new StoreError(`Failed to delete old pages for ${library}:${version}`, error);
    }
  }

  /**
   * Completely removes a library version and all associated documents.
   * Optionally removes the library record if it has no remaining versions.
   * This is a destructive operation that cannot be undone.
   *
   * @param {string} library - The library name (case-insensitive)
   * @param {string} version - The version string (will be normalized)
   * @param {boolean} [removeLibraryIfEmpty=true] - Whether to delete the library record if it has no versions left
   * @returns {Promise<{
   *   documentsDeleted: number;
   *   versionDeleted: boolean;
   *   libraryDeleted: boolean;
   * }>} Object containing counts and status of deletion operations
   * @throws {StoreError} If database operation fails
   *
   * @example
   * ```typescript
   * const result = await store.removeVersion("react", "18.2.0");
   * console.log(`Deleted ${result.documentsDeleted} documents`);
   * console.log(`Version deleted: ${result.versionDeleted}`);
   * console.log(`Library deleted: ${result.libraryDeleted}`);
   * ```
   */
  async removeVersion(
    library: string,
    version: string,
    removeLibraryIfEmpty = true,
  ): Promise<{
    documentsDeleted: number;
    versionDeleted: boolean;
    libraryDeleted: boolean;
  }> {
    try {
      const normalizedVersion = normalizeVersionName(version);

      // 1. Count documents to be deleted
      const countResult = await this.pool.query(
        `SELECT COUNT(*) as count
         FROM documents d
         INNER JOIN pages p ON d.page_id = p.id
         INNER JOIN versions v ON p.version_id = v.id
         INNER JOIN libraries l ON v.library_id = l.id
         WHERE l.name = $1 AND v.name = $2`,
        [library, normalizedVersion],
      );
      const documentsDeleted = Number(countResult.rows[0].count);

      // 2. Delete version (CASCADE will delete pages and documents)
      const versionDeleteResult = await this.pool.query(
        `DELETE FROM versions
         WHERE id IN (
           SELECT v.id
           FROM versions v
           INNER JOIN libraries l ON v.library_id = l.id
           WHERE l.name = $1 AND v.name = $2
         )`,
        [library, normalizedVersion],
      );
      const versionDeleted = (versionDeleteResult.rowCount || 0) > 0;

      // 3. Optionally delete library if it has no versions left
      let libraryDeleted = false;
      if (removeLibraryIfEmpty && versionDeleted) {
        const libraryDeleteResult = await this.pool.query(
          `DELETE FROM libraries
           WHERE name = $1
           AND NOT EXISTS (
             SELECT 1 FROM versions WHERE library_id = libraries.id
           )`,
          [library],
        );
        libraryDeleted = (libraryDeleteResult.rowCount || 0) > 0;
      }

      return {
        documentsDeleted,
        versionDeleted,
        libraryDeleted,
      };
    } catch (error) {
      throw new StoreError(`Failed to remove version ${library}:${version}`, error);
    }
  }

  /**
   * Renames a version within a library.
   * The version ID stays the same, so all documents remain linked via foreign key.
   *
   * @param {string} library - The library name (case-insensitive)
   * @param {string} oldVersion - The current version name (will be normalized)
   * @param {string} newVersion - The new version name (will be normalized)
   * @returns {Promise<boolean>} True if renamed, false if version not found
   * @throws {StoreError} If new version name already exists (UNIQUE constraint violation)
   *
   * @example
   * ```typescript
   * const renamed = await store.renameVersion("react", "18.0.0", "18.2.0");
   * if (renamed) {
   *   console.log("Version renamed successfully");
   * } else {
   *   console.log("Version not found");
   * }
   * ```
   */
  async renameVersion(
    library: string,
    oldVersion: string,
    newVersion: string,
  ): Promise<boolean> {
    try {
      // Preserve case for new version name (mixed-case support)
      const normalizedOldVersion = normalizeVersionName(oldVersion);
      const normalizedNewVersion = normalizeVersionName(newVersion);

      // Check if new version name already exists (excluding the version we're renaming)
      const duplicateCheck = await this.pool.query(
        `SELECT v.id
         FROM versions v
         INNER JOIN libraries l ON v.library_id = l.id
         WHERE LOWER(l.name) = LOWER($1) 
           AND LOWER(v.name) = LOWER($2)
           AND LOWER(v.name) != LOWER($3)`,
        [library, normalizedNewVersion, normalizedOldVersion],
      );

      if (duplicateCheck.rows.length > 0) {
        throw new StoreError(
          `Cannot rename version: version "${newVersion}" already exists in library "${library}"`,
        );
      }

      // Update version name (case-insensitive match for old version to handle existing lowercase data)
      const result = await this.pool.query(
        `UPDATE versions
         SET name = $1, updated_at = CURRENT_TIMESTAMP
         WHERE library_id = (SELECT id FROM libraries WHERE LOWER(name) = LOWER($2))
         AND LOWER(name) = LOWER($3)`,
        [normalizedNewVersion, library, normalizedOldVersion],
      );

      return (result.rowCount || 0) > 0;
    } catch (error) {
      if (error instanceof StoreError) {
        throw error;
      }
      throw new StoreError(
        `Failed to rename version from ${oldVersion} to ${newVersion} in library ${library}`,
        error,
      );
    }
  }

  /**
   * Renames a library in the store.
   * The library ID stays the same, so all versions and documents remain linked via foreign key.
   *
   * @param {string} library - The library name (case-insensitive)
   * @param {string} newName - The new library name
   * @returns {Promise<boolean>} True if renamed, false if library not found
   * @throws {StoreError} If new library name already exists or database operation fails
   *
   * @example
   * ```typescript
   * const renamed = await store.renameLibrary("react", "react-dom");
   * if (renamed) {
   *   console.log("Library renamed successfully");
   * } else {
   *   console.log("Library not found");
   * }
   * ```
   */
  async renameLibrary(library: string, newName: string): Promise<boolean> {
    try {
      const existing = await this.pool.query(
        "SELECT id FROM libraries WHERE LOWER(name) = LOWER($1)",
        [newName],
      );
      if (existing.rows.length > 0) {
        throw new StoreError(
          `Cannot rename library: library "${newName}" already exists`,
        );
      }

      const result = await this.pool.query(
        "UPDATE libraries SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE LOWER(name) = LOWER($2) RETURNING id",
        [newName, library],
      );

      return (result.rowCount || 0) > 0;
    } catch (error) {
      if (error instanceof StoreError) {
        throw error;
      }
      throw new StoreError(
        `Failed to rename library from ${library} to ${newName}`,
        error,
      );
    }
  }

  /**
   * Retrieves a single document by its database ID.
   * Returns the document with all metadata including URL, title, and content type.
   *
   * @param {string} id - The document's database ID
   * @returns {Promise<Document | null>} The document if found, or null if no document exists with the given ID
   * @throws {StoreError} If database query fails
   *
   * @example
   * ```typescript
   * const doc = await store.getById("12345");
   * if (doc) {
   *   console.log(`Found: ${doc.metadata.title}`);
   *   console.log(doc.pageContent);
   * } else {
   *   console.log("Document not found");
   * }
   * ```
   */
  async getById(id: string): Promise<Document | null> {
    try {
      const result = await this.pool.query(
        `SELECT d.id, d.content, d.metadata, p.url, p.title, p.content_type
         FROM documents d
         INNER JOIN pages p ON d.page_id = p.id
         WHERE d.id = $1`,
        [id],
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return mapDbDocumentToDocument(row as DbJoinedDocument);
    } catch (error) {
      throw new StoreError(`Failed to get document by ID: ${id}`, error);
    }
  }

  /**
   * Finds documents matching a text query using hybrid search combining vector similarity and full-text search.
   * Uses Reciprocal Rank Fusion (RRF) to combine results from both search methods:
   * - Vector search: Finds semantically similar documents using pgvector cosine similarity
   * - Full-text search: Finds exact keyword matches using PostgreSQL's ts_rank
   *
   * The hybrid approach provides both semantic understanding and exact keyword matching.
   * Results include metadata with RRF score, vector rank, and FTS rank for transparency.
   *
   * @param {string} library - The library name to search within (case-insensitive)
   * @param {string} version - The version string to search within (will be normalized)
   * @param {string} query - The search query text
   * @param {number} limit - Maximum number of results to return
   * @returns {Promise<Document[]>} Array of matching documents sorted by relevance (RRF score).
   *   Each document's metadata includes: `id`, `score` (RRF), `vec_rank`, `fts_rank`
   * @throws {StoreError} If database query fails or embedding generation fails
   *
   * @example
   * ```typescript
   * const results = await store.findByContent("react", "18.2.0", "how to use hooks", 5);
   * for (const doc of results) {
   *   console.log(`Score: ${doc.metadata.score} - ${doc.metadata.title}`);
   *   console.log(doc.pageContent);
   * }
   * ```
   * @remarks
   * - Vector search is only performed if embeddings are enabled and available
   * - Full-text search always works (no embeddings required)
   * - Query text is safely escaped to prevent SQL injection
   * - Results are over-fetched internally and re-ranked using RRF for optimal relevance
   */
  async findByContent(
    library: string,
    version: string,
    query: string,
    limit: number,
  ): Promise<Document[]> {
    try {
      const normalizedVersion = normalizeVersionName(version);
      // Use plain query text - plainto_tsquery() will handle escaping

      // Generate query embedding if vector search is enabled
      let queryEmbedding: number[] | null = null;
      if (this.isVectorSearchEnabled) {
        queryEmbedding = await this.embeddings.embedQuery(query);
        queryEmbedding = this.padVector(queryEmbedding);
      }

      // Perform hybrid search with RRF (Reciprocal Rank Fusion)
      const vectorResults: RawSearchResult[] = [];
      const ftsResults: RawSearchResult[] = [];

      // Vector search
      if (queryEmbedding) {
        const vecResult = await this.pool.query(
          `SELECT d.id, d.content, d.metadata, d.sort_order,
                  p.url, p.title, p.content_type,
                  1 - (d.embedding <=> $1::vector) as vec_score
           FROM documents d
           INNER JOIN pages p ON d.page_id = p.id
           INNER JOIN versions v ON p.version_id = v.id
           INNER JOIN libraries l ON v.library_id = l.id
           WHERE LOWER(l.name) = LOWER($2) AND LOWER(v.name) = LOWER($3) AND d.embedding IS NOT NULL
           ORDER BY d.embedding <=> $1::vector
           LIMIT $4`,
          [
            `[${queryEmbedding.join(",")}]`,
            library,
            normalizedVersion,
            limit * VECTOR_SEARCH_MULTIPLIER,
          ],
        );
        vectorResults.push(...vecResult.rows);
      }

      // Full-text search using plainto_tsquery for safe plain text queries
      const ftsResult = await this.pool.query(
        `SELECT d.id, d.content, d.metadata, d.sort_order,
                p.url, p.title, p.content_type,
                ts_rank(to_tsvector('english', d.content), plainto_tsquery('english', $1)) as fts_score
         FROM documents d
         INNER JOIN pages p ON d.page_id = p.id
         INNER JOIN versions v ON p.version_id = v.id
         INNER JOIN libraries l ON v.library_id = l.id
         WHERE LOWER(l.name) = LOWER($2) AND LOWER(v.name) = LOWER($3)
           AND to_tsvector('english', d.content) @@ plainto_tsquery('english', $1)
         ORDER BY fts_score DESC
         LIMIT $4`,
        [query, library, normalizedVersion, limit * SEARCH_OVERFETCH_FACTOR],
      );
      ftsResults.push(...ftsResult.rows);

      // Merge and rank results using RRF
      const allResults = new Map<number, RawSearchResult>();
      for (const result of [...vectorResults, ...ftsResults]) {
        const id = Number(result.id);
        if (allResults.has(id)) {
          // Merge scores
          const existing = allResults.get(id)!;
          existing.vec_score = existing.vec_score || result.vec_score;
          existing.fts_score = existing.fts_score || result.fts_score;
        } else {
          allResults.set(id, result);
        }
      }

      // Assign ranks and calculate RRF scores
      const rankedResults = this.assignRanks(Array.from(allResults.values()));

      // Sort by RRF score and limit
      const topResults = rankedResults
        .sort((a, b) => b.rrf_score - a.rrf_score)
        .slice(0, limit);

      // Convert to Document objects with search metadata
      return topResults.map((row) => {
        const doc = mapDbDocumentToDocument(row as DbJoinedDocument);
        // Add search-specific metadata
        doc.metadata.id = String(row.id);
        doc.metadata.score = row.rrf_score;
        if (row.vec_rank !== undefined) {
          doc.metadata.vec_rank = row.vec_rank;
        }
        if (row.fts_rank !== undefined) {
          doc.metadata.fts_rank = row.fts_rank;
        }
        return doc;
      });
    } catch (error) {
      throw new StoreError(`Failed to search documents for ${library}:${version}`, error);
    }
  }

  /**
   * Finds documents similar to a query image using visual similarity search.
   * Compares the query image's embedding against image embeddings stored in document metadata.
   * Uses cosine similarity to rank results by visual similarity.
   *
   * Image embeddings are generated from:
   * - Page screenshots (stored as screenshot_path)
   * - Media elements (images, videos) extracted from the page
   *
   * @param {string} library - The library name to search within (case-insensitive)
   * @param {string} version - The version string to search within (will be normalized)
   * @param {string} imagePath - Path or URL to the query image to compare against
   * @param {number} limit - Maximum number of results to return
   * @returns {Promise<Document[]>} Array of matching documents sorted by visual similarity.
   *   Each document's metadata includes: `id`, `score` (cosine similarity 0-1), `search_type`
   * @throws {StoreError} If image embedding service is not enabled, query fails, or database operation fails
   *
   * @example
   * ```typescript
   * // Find pages that contain similar UI components
   * const results = await store.findByImage("react", "18.2.0", "/path/to/button.png", 10);
   * for (const doc of results) {
   *   console.log(`Similarity: ${doc.metadata.score.toFixed(2)} - ${doc.metadata.title}`);
   * }
   * ```
   * @remarks
   * - Requires the image embedding service to be initialized and configured
   * - Similarity scores range from 0 (no similarity) to 1 (identical)
   * - Multiple images per document are supported; the highest similarity is used
   */
  async findByImage(
    library: string,
    version: string,
    imagePath: string,
    limit: number,
  ): Promise<Document[]> {
    const imageEmbeddingService = getImageEmbeddingService();
    if (!imageEmbeddingService.isReady()) {
      throw new StoreError("Image embedding is not enabled or configured");
    }

    try {
      const normalizedVersion = normalizeVersionName(version);

      // Generate embedding for query image
      const queryResult = await imageEmbeddingService.embedSingleImage(imagePath);
      if (!queryResult) {
        throw new StoreError(
          `Failed to generate embedding for query image: ${imagePath}`,
        );
      }
      const queryEmbedding = queryResult.embedding;

      // Fetch all documents with image embeddings
      const result = await this.pool.query(
        `SELECT d.id, d.content, d.metadata, d.sort_order,
                p.url, p.title, p.content_type, p.screenshot_path
         FROM documents d
         INNER JOIN pages p ON d.page_id = p.id
         INNER JOIN versions v ON p.version_id = v.id
         INNER JOIN libraries l ON v.library_id = l.id
         WHERE LOWER(l.name) = LOWER($1) AND LOWER(v.name) = LOWER($2)
           AND d.metadata::text LIKE '%imageEmbeddings%'`,
        [library, normalizedVersion],
      );

      // Calculate cosine similarity for each document's image embeddings
      const scoredResults: Array<{
        id: number;
        content: string;
        metadata: string;
        sort_order: number;
        url?: string;
        title?: string;
        content_type?: string;
        screenshot_path?: string;
        similarity: number;
        page_id: number;
        embedding: Buffer | null;
        created_at: string;
        score: number | null;
      }> = [];

      for (const row of result.rows) {
        try {
          const docMetadata = JSON.parse(row.metadata as string) as Record<
            string,
            unknown
          >;
          const imageEmbeddings = docMetadata.imageEmbeddings as Array<{
            embedding: number[];
            source: string;
            type: string;
          }>;

          if (!imageEmbeddings || imageEmbeddings.length === 0) {
            continue;
          }

          // Calculate max similarity across all images in this document
          let maxSimilarity = 0;
          for (const imgEmb of imageEmbeddings) {
            if (!imgEmb.embedding) continue;
            const similarity = cosineSimilarity(queryEmbedding, imgEmb.embedding);
            if (similarity > maxSimilarity) {
              maxSimilarity = similarity;
            }
          }

          scoredResults.push({
            id: row.id,
            content: row.content,
            metadata: row.metadata,
            sort_order: row.sort_order,
            url: row.url,
            title: row.title,
            content_type: row.content_type,
            screenshot_path: row.screenshot_path,
            similarity: maxSimilarity,
            page_id: 0, // Not available in this query, will be ignored
            embedding: null, // Not available in this query, will be ignored
            created_at: "", // Not available in this query, will be ignored
            score: null, // Will be replaced by similarity
          });
        } catch (parseError) {
          logger.warn(`Failed to parse metadata for document ${row.id}: ${parseError}`);
        }
      }

      // Sort by similarity (descending) and limit
      scoredResults.sort((a, b) => b.similarity - a.similarity);
      const topResults = scoredResults.slice(0, limit);

      // Convert to Document objects with search metadata
      return topResults.map((row) => {
        const doc = mapDbDocumentToDocument(row as unknown as DbJoinedDocument);
        // Add search-specific metadata
        doc.metadata.id = String(row.id);
        doc.metadata.score = row.similarity;
        doc.metadata.search_type = "image_similarity";
        return doc;
      });
    } catch (error) {
      throw new StoreError(`Failed to search by image for ${library}:${version}`, error);
    }
  }

  /**
   * Finds child chunks of a given document based on path hierarchy.
   * Child chunks are documents whose path starts with the parent document's path.
   * This enables hierarchical document navigation (e.g., section → subsections → content).
   *
   * @param {string} library - The library name (case-insensitive)
   * @param {string} version - The version string (will be normalized)
   * @param {string} id - The document ID to find children for
   * @param {number} limit - Maximum number of child chunks to return
   * @returns {Promise<Document[]>} Array of child documents, sorted by path and sort_order
   * @throws {StoreError} If database query fails or parent document doesn't exist
   *
   * @example
   * ```typescript
   * // Find all subsections under a section
   * const children = await store.findChildChunks("react", "18.2.0", sectionId, 10);
   * for (const child of children) {
   *   console.log(`${child.metadata.path}: ${child.metadata.title}`);
   * }
   * ```
   */
  async findChildChunks(
    library: string,
    version: string,
    id: string,
    limit: number,
  ): Promise<Document[]> {
    try {
      const normalizedVersion = normalizeVersionName(version);

      // Get the parent document's path
      const parentResult = await this.pool.query(
        `SELECT d.metadata
         FROM documents d
         INNER JOIN pages p ON d.page_id = p.id
         INNER JOIN versions v ON p.version_id = v.id
         INNER JOIN libraries l ON v.library_id = l.id
         WHERE l.name = $1 AND v.name = $2 AND d.id = $3`,
        [library, normalizedVersion, id],
      );

      if (parentResult.rows.length === 0) {
        return [];
      }

      let parentMetadata: Record<string, unknown>;
      try {
        parentMetadata = JSON.parse(parentResult.rows[0]?.metadata ?? "{}");
      } catch (parseError) {
        logger.warn(`Failed to parse metadata for document ${id}: ${parseError}`);
        return [];
      }
      const parentPath = parentMetadata.path || "";

      // Find child documents where path starts with parent path + "/"
      const result = await this.pool.query(
        `SELECT d.id, d.content, d.metadata, d.sort_order,
                p.url, p.title, p.content_type
         FROM documents d
         INNER JOIN pages p ON d.page_id = p.id
         INNER JOIN versions v ON p.version_id = v.id
         INNER JOIN libraries l ON v.library_id = l.id
         WHERE l.name = $1 AND v.name = $2
           AND d.id != $3
           AND (d.metadata)::jsonb->>'path' LIKE $4
         ORDER BY (d.metadata)::jsonb->>'path', d.sort_order
         LIMIT $5`,
        [library, normalizedVersion, id, `${parentPath}/%`, limit],
      );

      return result.rows.map((row) => mapDbDocumentToDocument(row as DbJoinedDocument));
    } catch (error) {
      throw new StoreError(
        `Failed to find child chunks for ${library}:${version}`,
        error,
      );
    }
  }

  /**
   * Finds preceding sibling chunks of a given document.
   * Sibling chunks share the same path and URL but have different chunk IDs.
   * Returns chunks with lower chunk IDs (earlier in the document), sorted descending.
   *
   * Useful for displaying context before a specific chunk or implementing
   * "previous" navigation through a document.
   *
   * @param {string} library - The library name (case-insensitive)
   * @param {string} version - The version string (will be normalized)
   * @param {string} id - The document ID to find preceding siblings for
   * @param {number} limit - Maximum number of preceding siblings to return
   * @returns {Promise<Document[]>} Array of preceding sibling documents, sorted by chunk_id (descending, closest first)
   * @throws {StoreError} If database query fails or document doesn't exist
   *
   * @example
   * ```typescript
   * // Get the 3 chunks before the current one for context
   * const preceding = await store.findPrecedingSiblingChunks("react", "18.2.0", docId, 3);
   * const context = [...preceding.reverse(), currentDoc]; // Include current doc
   * ```
   */
  async findPrecedingSiblingChunks(
    library: string,
    version: string,
    id: string,
    limit: number,
  ): Promise<Document[]> {
    try {
      const normalizedVersion = normalizeVersionName(version);

      // Get current document's path and chunk_id
      const currentResult = await this.pool.query(
        `SELECT d.metadata, p.url
         FROM documents d
         INNER JOIN pages p ON d.page_id = p.id
         INNER JOIN versions v ON p.version_id = v.id
         INNER JOIN libraries l ON v.library_id = l.id
         WHERE l.name = $1 AND v.name = $2 AND d.id = $3`,
        [library, normalizedVersion, id],
      );

      if (currentResult.rows.length === 0) {
        return [];
      }

      let currentMetadata: Record<string, unknown>;
      try {
        currentMetadata = JSON.parse(currentResult.rows[0]?.metadata ?? "{}");
      } catch (parseError) {
        logger.warn(`Failed to parse metadata for document ${id}: ${parseError}`);
        return [];
      }
      const currentPath = (currentMetadata.path as string | undefined) ?? "";
      const currentChunkId = (currentMetadata.chunk_id as number | undefined) ?? 0;
      const currentUrl = currentResult.rows[0]?.url;
      if (!currentUrl) {
        return [];
      }

      // Find siblings with same path/url but lower chunk_id
      const result = await this.pool.query(
        `SELECT d.id, d.content, d.metadata, d.sort_order,
                p.url, p.title, p.content_type
         FROM documents d
         INNER JOIN pages p ON d.page_id = p.id
         INNER JOIN versions v ON p.version_id = v.id
         INNER JOIN libraries l ON v.library_id = l.id
         WHERE l.name = $1 AND v.name = $2
           AND p.url = $3
           AND (d.metadata)::jsonb->>'path' = $4
           AND CAST((d.metadata)::jsonb->>'chunk_id' AS INTEGER) < $5
         ORDER BY CAST((d.metadata)::jsonb->>'chunk_id' AS INTEGER) DESC
         LIMIT $6`,
        [library, normalizedVersion, currentUrl, currentPath, currentChunkId, limit],
      );

      return result.rows.map((row) => mapDbDocumentToDocument(row as DbJoinedDocument));
    } catch (error) {
      throw new StoreError(
        `Failed to find preceding siblings for ${library}:${version}`,
        error,
      );
    }
  }

  /**
   * Finds subsequent sibling chunks of a given document.
   * Sibling chunks share the same path and URL but have different chunk IDs.
   * Returns chunks with higher chunk IDs (later in the document), sorted ascending.
   *
   * Useful for displaying context after a specific chunk or implementing
   * "next" navigation through a document.
   *
   * @param {string} library - The library name (case-insensitive)
   * @param {string} version - The version string (will be normalized)
   * @param {string} id - The document ID to find subsequent siblings for
   * @param {number} limit - Maximum number of subsequent siblings to return
   * @returns {Promise<Document[]>} Array of subsequent sibling documents, sorted by chunk_id (ascending, closest first)
   * @throws {StoreError} If database query fails or document doesn't exist
   *
   * @example
   * ```typescript
   * // Get the next 3 chunks after the current one
   * const subsequent = await store.findSubsequentSiblingChunks("react", "18.2.0", docId, 3);
   * const context = [currentDoc, ...subsequent]; // Include current doc
   * ```
   */
  async findSubsequentSiblingChunks(
    library: string,
    version: string,
    id: string,
    limit: number,
  ): Promise<Document[]> {
    try {
      const normalizedVersion = normalizeVersionName(version);

      // Get current document's path and chunk_id
      const currentResult = await this.pool.query(
        `SELECT d.metadata, p.url
         FROM documents d
         INNER JOIN pages p ON d.page_id = p.id
         INNER JOIN versions v ON p.version_id = v.id
         INNER JOIN libraries l ON v.library_id = l.id
         WHERE l.name = $1 AND v.name = $2 AND d.id = $3`,
        [library, normalizedVersion, id],
      );

      if (currentResult.rows.length === 0) {
        return [];
      }

      let currentMetadata: Record<string, unknown>;
      try {
        currentMetadata = JSON.parse(currentResult.rows[0]?.metadata ?? "{}");
      } catch (parseError) {
        logger.warn(`Failed to parse metadata for document ${id}: ${parseError}`);
        return [];
      }
      const currentPath = (currentMetadata.path as string | undefined) ?? "";
      const currentChunkId = (currentMetadata.chunk_id as number | undefined) ?? 0;
      const currentUrl = currentResult.rows[0]?.url;
      if (!currentUrl) {
        return [];
      }

      // Find siblings with same path/url but higher chunk_id
      const result = await this.pool.query(
        `SELECT d.id, d.content, d.metadata, d.sort_order,
                p.url, p.title, p.content_type
         FROM documents d
         INNER JOIN pages p ON d.page_id = p.id
         INNER JOIN versions v ON p.version_id = v.id
         INNER JOIN libraries l ON v.library_id = l.id
         WHERE l.name = $1 AND v.name = $2
           AND p.url = $3
           AND (d.metadata)::jsonb->>'path' = $4
           AND CAST((d.metadata)::jsonb->>'chunk_id' AS INTEGER) > $5
         ORDER BY CAST((d.metadata)::jsonb->>'chunk_id' AS INTEGER) ASC
         LIMIT $6`,
        [library, normalizedVersion, currentUrl, currentPath, currentChunkId, limit],
      );

      return result.rows.map((row) => mapDbDocumentToDocument(row as DbJoinedDocument));
    } catch (error) {
      throw new StoreError(
        `Failed to find subsequent siblings for ${library}:${version}`,
        error,
      );
    }
  }

  /**
   * Finds the parent chunk of a given document based on path hierarchy.
   * The parent is the document whose path matches the current document's path
   * with the last segment removed (e.g., "docs/api/hooks" → "docs/api").
   *
   * Supports both string paths ("docs/api/hooks") and array paths (["docs", "api", "hooks"]).
   * Returns null if the document has no parent (is at the root level).
   *
   * @param {string} library - The library name (case-insensitive)
   * @param {string} version - The version string (will be normalized)
   * @param {string} id - The document ID to find the parent for
   * @returns {Promise<Document | null>} The parent document if found, or null if no parent exists
   * @throws {StoreError} If database query fails or document doesn't exist
   *
   * @example
   * ```typescript
   * const parent = await store.findParentChunk("react", "18.2.0", childId);
   * if (parent) {
   *   console.log(`Parent: ${parent.metadata.title} (${parent.metadata.path})`);
   * } else {
   *   console.log("Already at root level");
   * }
   * ```
   */
  async findParentChunk(
    library: string,
    version: string,
    id: string,
  ): Promise<Document | null> {
    try {
      const normalizedVersion = normalizeVersionName(version);

      // Get current document's path
      const currentResult = await this.pool.query(
        `SELECT d.metadata, p.url
         FROM documents d
         INNER JOIN pages p ON d.page_id = p.id
         INNER JOIN versions v ON p.version_id = v.id
         INNER JOIN libraries l ON v.library_id = l.id
         WHERE l.name = $1 AND v.name = $2 AND d.id = $3`,
        [library, normalizedVersion, id],
      );

      if (currentResult.rows.length === 0) {
        return null;
      }

      let currentMetadata: Record<string, unknown>;
      try {
        currentMetadata = JSON.parse(currentResult.rows[0]?.metadata ?? "{}");
      } catch (parseError) {
        logger.warn(`Failed to parse metadata for document ${id}: ${parseError}`);
        return null;
      }

      // Handle both string and array path formats
      let pathParts: string[];
      if (Array.isArray(currentMetadata.path)) {
        // Path is already an array of segments
        pathParts = currentMetadata.path.filter((part: string) => part.length > 0);
      } else if (typeof currentMetadata.path === "string") {
        // Path is a string, split it
        pathParts = currentMetadata.path
          .split("/")
          .filter((part: string) => part.length > 0);
      } else {
        // No path available
        pathParts = [];
      }
      if (pathParts.length === 0) {
        return null; // No parent
      }

      pathParts.pop(); // Remove last segment
      const parentPath = pathParts.join("/");

      // Find parent document with exact parent path
      const result = await this.pool.query(
        `SELECT d.id, d.content, d.metadata, d.sort_order,
                p.url, p.title, p.content_type
         FROM documents d
         INNER JOIN pages p ON d.page_id = p.id
         INNER JOIN versions v ON p.version_id = v.id
         INNER JOIN libraries l ON v.library_id = l.id
         WHERE l.name = $1 AND v.name = $2
           AND (d.metadata)::jsonb->>'path' = $3
         LIMIT 1`,
        [library, normalizedVersion, parentPath],
      );

      if (result.rows.length === 0) {
        return null;
      }

      return mapDbDocumentToDocument(result.rows[0] as DbJoinedDocument);
    } catch (error) {
      throw new StoreError(
        `Failed to find parent chunk for ${library}:${version}`,
        error,
      );
    }
  }

  /**
   * Fetches multiple documents by their IDs in a single optimized database call.
   * More efficient than calling getById() multiple times.
   * Results are returned in sort_order, not necessarily in the order of the input IDs.
   *
   * @param {string} library - The library name (case-insensitive)
   * @param {string} version - The version string (will be normalized)
   * @param {string[]} ids - Array of document IDs to fetch
   * @returns {Promise<Document[]>} Array of matching documents, sorted by sort_order. Returns empty array if no IDs provided or no matches found.
   * @throws {StoreError} If database query fails
   *
   * @example
   * ```typescript
   * // Fetch related chunks in one call
   * const chunks = await store.findChunksByIds("react", "18.2.0", [
   *   "chunk1",
   *   "chunk2",
   *   "chunk3"
   * ]);
   * for (const chunk of chunks) {
   *   console.log(chunk.pageContent);
   * }
   * ```
   */
  async findChunksByIds(
    library: string,
    version: string,
    ids: string[],
  ): Promise<Document[]> {
    if (ids.length === 0) {
      return [];
    }

    try {
      const normalizedVersion = normalizeVersionName(version);
      const result = await this.pool.query(
        `SELECT d.id, d.content, d.metadata, d.sort_order,
                p.url, p.title, p.content_type
         FROM documents d
         INNER JOIN pages p ON d.page_id = p.id
         INNER JOIN versions v ON p.version_id = v.id
         INNER JOIN libraries l ON v.library_id = l.id
         WHERE l.name = $1 AND v.name = $2 AND d.id = ANY($3)
         ORDER BY d.sort_order`,
        [library, normalizedVersion, ids],
      );

      return result.rows.map((row) => mapDbDocumentToDocument(row as DbJoinedDocument));
    } catch (error) {
      throw new StoreError(
        `Failed to find chunks by IDs for ${library}:${version}`,
        error,
      );
    }
  }

  /**
   * Fetches all document chunks for a specific URL within a library and version.
   * Returns all chunks associated with a single page URL, sorted by their sort_order.
   * Useful for retrieving all chunks of a long page that was split into multiple documents.
   *
   * @param {string} library - The library name (case-insensitive)
   * @param {string} version - The version string (will be normalized)
   * @param {string} url - The exact URL to fetch chunks for
   * @returns {Promise<Document[]>} Array of all chunks for the specified URL, sorted by sort_order
   * @throws {StoreError} If database query fails
   *
   * @example
   * ```typescript
   * // Get all chunks from a long page
   * const chunks = await store.findChunksByUrl("react", "18.2.0", "https://react.dev/learn");
   * console.log(`Found ${chunks.length} chunks from this page`);
   * const fullContent = chunks.map(c => c.pageContent).join("\n\n");
   * ```
   */
  async findChunksByUrl(
    library: string,
    version: string,
    url: string,
  ): Promise<Document[]> {
    try {
      const normalizedVersion = normalizeVersionName(version);
      const result = await this.pool.query(
        `SELECT d.id, d.content, d.metadata, d.sort_order,
                p.url, p.title, p.content_type
         FROM documents d
         INNER JOIN pages p ON d.page_id = p.id
         INNER JOIN versions v ON p.version_id = v.id
         INNER JOIN libraries l ON v.library_id = l.id
         WHERE l.name = $1 AND v.name = $2 AND p.url = $3
         ORDER BY d.sort_order`,
        [library, normalizedVersion, url],
      );

      return result.rows.map((row) => mapDbDocumentToDocument(row as DbJoinedDocument));
    } catch (error) {
      throw new StoreError(
        `Failed to find chunks by URL for ${library}:${version} URL: ${url}`,
        error,
      );
    }
  }

  /**
   * Get the screenshot path for a specific page.
   * Used by the web server to serve screenshots.
   *
   * @param pageId - The page ID to query
   * @returns The screenshot path or null if not found
   */
  async getScreenshotPath(pageId: number): Promise<string | null> {
    try {
      const result = await this.pool.query<DbPage>(
        "SELECT screenshot_path FROM pages WHERE id = $1",
        [pageId],
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return row?.screenshot_path ?? null;
    } catch (error) {
      throw new StoreError(`Failed to get screenshot path for page ID: ${pageId}`, error);
    }
  }

  /**
   * Get page metadata including fetcher type and screenshot info.
   * Used by the web server to display page details.
   *
   * @param pageId - The page ID to query
   * @returns Page metadata or null if not found
   */
  async getPageMetadata(pageId: number): Promise<{
    metadata: Record<string, unknown>;
    fetcherType: string | null;
    hasScreenshot: boolean;
    screenshotPath: string | null;
  } | null> {
    try {
      const result = await this.pool.query<DbPage>(
        "SELECT metadata, fetcher_type, screenshot_path FROM pages WHERE id = $1",
        [pageId],
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0]!;
      const metadata = row.metadata ? JSON.parse(row.metadata) : {};

      return {
        metadata,
        fetcherType: row.fetcher_type,
        hasScreenshot: !!row.screenshot_path,
        screenshotPath: row.screenshot_path,
      };
    } catch (error) {
      throw new StoreError(`Failed to get page metadata for page ID: ${pageId}`, error);
    }
  }
}

/**
 * Calculates cosine similarity between two vectors.
 * Returns a value between -1 and 1, where 1 means identical vectors.
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Cosine similarity score
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dotProduct += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 0; // Both vectors are zero vectors
  }

  return dotProduct / denominator;
}
