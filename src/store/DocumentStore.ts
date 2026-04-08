import type { Embeddings } from "@langchain/core/embeddings";
import type { PoolClient } from "pg";
import type { ScrapeResult, ScraperOptions } from "../scraper/types";
import type { AppConfig } from "../utils/config";
import { logger } from "../utils/logger";
import { compareVersionsDescending } from "../utils/version";
import { applyMigrations } from "./applyMigrations";
import { EmbeddingConfig, type EmbeddingModelConfig } from "./embeddings/EmbeddingConfig";
import {
  areCredentialsAvailable,
  createEmbeddingModel,
  ModelConfigurationError,
  UnsupportedProviderError,
} from "./embeddings/EmbeddingFactory";
import { FixedDimensionEmbeddings } from "./embeddings/FixedDimensionEmbeddings";
import {
  ConnectionError,
  DimensionError,
  EmbeddingModelChangedError,
  StoreError,
} from "./errors";
import type { PostgresConnection } from "./PostgresConnection";
import type { DbChunkMetadata, DbChunkRank, StoredScraperOptions } from "./types";
import {
  type DbChunk,
  type DbPage,
  type DbPageChunk,
  type DbQueryResult,
  type DbVersion,
  type DbVersionWithLibrary,
  denormalizeVersionName,
  normalizeVersionName,
  type VersionScraperOptions,
  type VersionStatus,
} from "./types";

interface RawSearchResult extends DbChunk {
  url?: string;
  title?: string | null;
  source_content_type?: string | null;
  content_type?: string | null;
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
 * Provides parameterized queries to store and query document embeddings along with their metadata.
 * Supports versioned storage of documents for different libraries, enabling version-specific
 * document retrieval and hybrid search combining vector similarity with full-text ranking.
 */
export class DocumentStore {
  private readonly config: AppConfig;
  private readonly connection: PostgresConnection;
  private embeddings!: Embeddings;
  private readonly dbDimension: number;
  private readonly searchWeightVec: number;
  private readonly searchWeightFts: number;
  private readonly searchOverfetchFactor: number;
  private readonly vectorSearchMultiplier: number;
  private readonly splitterMaxChunkSize: number;
  private readonly embeddingBatchSize: number;
  private readonly embeddingBatchChars: number;
  private readonly embeddingInitTimeoutMs: number;
  private modelDimension!: number;
  private readonly embeddingConfig?: EmbeddingModelConfig | null;
  private isVectorSearchEnabled: boolean = false;

  /**
   * Returns the active embedding configuration if vector search is enabled,
   * or null if embeddings are disabled (no config provided or credentials unavailable).
   */
  getActiveEmbeddingConfig(): EmbeddingModelConfig | null {
    if (!this.isVectorSearchEnabled || !this.embeddingConfig) {
      return null;
    }
    return this.embeddingConfig;
  }

  /**
   * Calculates Reciprocal Rank Fusion score for a result with configurable weights
   */
  private calculateRRF(vecRank?: number, ftsRank?: number, k = 60): number {
    let rrf = 0;
    if (vecRank !== undefined) {
      rrf += this.searchWeightVec / (k + vecRank);
    }
    if (ftsRank !== undefined) {
      rrf += this.searchWeightFts / (k + ftsRank);
    }
    return rrf;
  }

  /**
   * Assigns ranks to search results based on their scores
   */
  private assignRanks(results: RawSearchResult[]): RankedResult[] {
    const vecRanks = new Map<number, number>();
    const ftsRanks = new Map<number, number>();

    results
      .filter((r) => r.vec_score !== undefined)
      .sort((a, b) => (b.vec_score ?? 0) - (a.vec_score ?? 0))
      .forEach((result, index) => {
        vecRanks.set(Number(result.id), index + 1);
      });

    results
      .filter((r) => r.fts_score !== undefined)
      .sort((a, b) => (b.fts_score ?? 0) - (a.fts_score ?? 0))
      .forEach((result, index) => {
        ftsRanks.set(Number(result.id), index + 1);
      });

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

  constructor(connection: PostgresConnection, appConfig: AppConfig) {
    this.connection = connection;
    this.config = appConfig;
    this.dbDimension = this.config.database.vectorDimension;
    this.searchWeightVec = this.config.search.weightVec;
    this.searchWeightFts = this.config.search.weightFts;
    this.searchOverfetchFactor = this.config.search.overfetchFactor;
    this.vectorSearchMultiplier = this.config.search.vectorMultiplier;
    this.splitterMaxChunkSize = this.config.splitter.maxChunkSize;
    this.embeddingBatchSize = this.config.embeddings.batchSize;
    this.embeddingBatchChars = this.config.embeddings.batchChars;
    this.embeddingInitTimeoutMs = this.config.embeddings.initTimeoutMs;

    this.embeddingConfig = this.resolveEmbeddingConfig(appConfig.app.embeddingModel);
  }

  private resolveEmbeddingConfig(modelSpec: string): EmbeddingModelConfig | null {
    const resolvedSpec = modelSpec;
    if (!resolvedSpec) {
      logger.debug("No embedding model specified. Embeddings are disabled.");
      return null;
    }

    try {
      logger.debug(`Resolving embedding configuration for model: ${resolvedSpec}`);
      return EmbeddingConfig.parseEmbeddingConfig(resolvedSpec);
    } catch (error) {
      logger.debug(`Failed to resolve embedding configuration: ${error}`);
      return null;
    }
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
   * Reads the stored embedding model and dimension from the metadata table.
   * Returns null for each value that doesn't exist (e.g., first run or pre-metadata database).
   */
  async getEmbeddingMetadata(): Promise<{
    model: string | null;
    dimension: string | null;
  }> {
    const pool = this.connection.getPool();
    const modelResult = await pool.query<{ value: string }>(
      "SELECT value FROM metadata WHERE key = $1",
      ["embedding_model"],
    );
    const dimensionResult = await pool.query<{ value: string }>(
      "SELECT value FROM metadata WHERE key = $1",
      ["embedding_dimension"],
    );
    return {
      model: modelResult.rows[0]?.value ?? null,
      dimension: dimensionResult.rows[0]?.value ?? null,
    };
  }

  /**
   * Persists the active embedding model and dimension to the metadata table.
   * Uses upsert so it works for both first-run and subsequent updates.
   */
  async setEmbeddingMetadata(model: string, dimension: number): Promise<void> {
    const pool = this.connection.getPool();
    await pool.query(
      "INSERT INTO metadata (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
      ["embedding_model", model],
    );
    await pool.query(
      "INSERT INTO metadata (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
      ["embedding_dimension", String(dimension)],
    );
  }

  /**
   * Compares the configured embedding model and dimension against stored metadata.
   * Throws EmbeddingModelChangedError if either has changed since the last run.
   *
   * Skipped when:
   * - No metadata exists (first run / upgrade from pre-metadata DB → silent initialization)
   * - No embedding model is configured (FTS-only mode)
   * - Credentials are unavailable for the configured provider (will fall back to FTS-only)
   */
  async checkEmbeddingModelChange(): Promise<void> {
    if (!this.embeddingConfig) {
      return;
    }

    if (!areCredentialsAvailable(this.embeddingConfig.provider)) {
      return;
    }

    const stored = await this.getEmbeddingMetadata();

    if (stored.model === null) {
      return;
    }

    const currentModel = this.config.app.embeddingModel;
    const currentDimension = String(this.config.database.vectorDimension);

    const modelChanged = stored.model !== currentModel;
    const dimensionChanged =
      stored.dimension !== null && stored.dimension !== currentDimension;

    if (modelChanged || dimensionChanged) {
      throw new EmbeddingModelChangedError(
        stored.model,
        stored.dimension ?? "unknown",
        currentModel,
        currentDimension,
      );
    }
  }

  /**
   * Invalidates all existing embedding vectors after a confirmed model/dimension change.
   * Sets all document embeddings to NULL and updates the metadata with the new model and dimension.
   *
   * After invalidation, FTS search continues working; vector search returns no results
   * until libraries are re-scraped.
   */
  async invalidateAllVectors(newModel: string, newDimension: number): Promise<void> {
    logger.warn(
      "⚠️  Invalidating all embedding vectors due to model/dimension change.\n" +
        "   All libraries must be re-scraped to restore vector search.\n" +
        "   Full-text search remains available for all existing documents.",
    );

    const pool = this.connection.getPool();
    await pool.query("UPDATE documents SET embedding = NULL");
    await this.setEmbeddingMetadata(newModel, newDimension);

    logger.info(
      `✅ Embedding vectors invalidated. Metadata updated to: ${newModel} (${newDimension}d)`,
    );
  }

  /**
   * Initialize the embeddings client using the provided config.
   * If no embedding config is provided (null or undefined), embeddings will not be initialized.
   * This allows DocumentStore to be used without embeddings for FTS-only operations.
   */
  private async initializeEmbeddings(): Promise<void> {
    if (this.embeddingConfig === null || this.embeddingConfig === undefined) {
      logger.debug(
        "Embedding initialization skipped (no config provided - FTS-only mode)",
      );
      return;
    }

    const config = this.embeddingConfig;

    if (!areCredentialsAvailable(config.provider)) {
      logger.warn(
        `⚠️  No credentials found for ${config.provider} embedding provider. Vector search is disabled.\n` +
          `   Only full-text search will be available. To enable vector search, please configure the required\n` +
          `   environment variables for ${config.provider} or choose a different provider.\n` +
          `   See README.md for configuration options or run with --help for more details.`,
      );
      return;
    }

    try {
      this.embeddings = createEmbeddingModel(config.modelSpec, {
        requestTimeoutMs: this.config.embeddings.requestTimeoutMs,
        vectorDimension: this.dbDimension,
      });

      if (config.dimensions !== null) {
        this.modelDimension = config.dimensions;
      } else {
        const testPromise = this.embeddings.embedQuery("test");
        let timeoutId: NodeJS.Timeout | undefined;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(
              new Error(
                `Embedding service connection timed out after ${this.embeddingInitTimeoutMs / 1000} seconds`,
              ),
            );
          }, this.embeddingInitTimeoutMs);
        });

        try {
          const testVector = await Promise.race([testPromise, timeoutPromise]);
          this.modelDimension = testVector.length;
        } finally {
          if (timeoutId !== undefined) {
            clearTimeout(timeoutId);
          }
        }

        EmbeddingConfig.setKnownModelDimensions(config.model, this.modelDimension);
      }

      if (
        this.embeddings instanceof FixedDimensionEmbeddings &&
        this.embeddings.allowTruncate
      ) {
        this.modelDimension = Math.min(this.modelDimension, this.dbDimension);
      }

      if (this.modelDimension > this.dbDimension) {
        throw new DimensionError(config.modelSpec, this.modelDimension, this.dbDimension);
      }

      this.isVectorSearchEnabled = true;
      logger.debug(
        `Embeddings initialized: ${config.provider}:${config.model} (${this.modelDimension}d)`,
      );

      await this.setEmbeddingMetadata(config.modelSpec, this.dbDimension);
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.message.includes("does not exist") ||
          error.message.includes("MODEL_NOT_FOUND")
        ) {
          throw new ModelConfigurationError(
            `Invalid embedding model: ${config.model}\n` +
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
            `Authentication failed for ${config.provider} embedding provider\n` +
              "   Please check your API key configuration.\n" +
              "   See README.md for configuration options or run with --help for more details.",
          );
        }
        if (
          error.message.includes("timed out") ||
          error.message.includes("ECONNREFUSED") ||
          error.message.includes("ENOTFOUND") ||
          error.message.includes("ETIMEDOUT") ||
          error.message.includes("ECONNRESET") ||
          error.message.includes("network") ||
          error.message.includes("fetch failed")
        ) {
          throw new ModelConfigurationError(
            `Failed to connect to ${config.provider} embedding service\n` +
              `   ${error.message}\n` +
              `   Please check that the embedding service is running and accessible.\n` +
              `   If using a local model (e.g., Ollama), ensure the service is started.`,
          );
        }
      }
      throw error;
    }
  }

  /**
   * Initializes database connection and ensures readiness
   */
  async initialize(): Promise<void> {
    try {
      await this.connection.initialize();
      await applyMigrations(this.connection, {
        maxRetries: this.config.db.migrationMaxRetries,
        retryDelayMs: this.config.db.migrationRetryDelayMs,
      });
      await this.checkEmbeddingModelChange();
      await this.initializeEmbeddings();
    } catch (error) {
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
   * Resolves a model change by invalidating all vectors and completing initialization.
   * Called by the CLI layer after the user confirms a model/dimension change.
   */
  async resolveModelChange(): Promise<void> {
    const currentModel = this.config.app.embeddingModel;
    const currentDimension = this.config.database.vectorDimension;

    await this.invalidateAllVectors(currentModel, currentDimension);
    await this.initializeEmbeddings();
  }

  /**
   * Gracefully closes database connections
   */
  async shutdown(): Promise<void> {
    await this.connection.close();
  }

  /**
   * Resolves a library name and version string to version_id.
   * Creates library and version records if they don't exist.
   */
  async resolveVersionId(library: string, version: string): Promise<number> {
    const pool = this.connection.getPool();
    const normalizedLibrary = library.toLowerCase();
    const normalizedVersion = denormalizeVersionName(version.toLowerCase());

    try {
      const libraryResult = await pool.query(
        `INSERT INTO libraries (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [normalizedLibrary],
      );
      const libraryId = libraryResult.rows[0]?.id;
      if (libraryId === undefined) {
        throw new StoreError(`Failed to resolve library_id for library: ${library}`);
      }

      const versionResult = await pool.query(
        `INSERT INTO versions (library_id, name, status)
         VALUES ($1, $2, 'not_indexed')
         ON CONFLICT (library_id, name) DO UPDATE SET library_id = EXCLUDED.library_id
         RETURNING id`,
        [libraryId, normalizedVersion],
      );
      const versionId = versionResult.rows[0]?.id;
      if (versionId === undefined) {
        throw new StoreError(
          `Failed to resolve version_id for library: ${library}, version: ${version}`,
        );
      }

      return versionId;
    } catch (error) {
      if (error instanceof StoreError) throw error;
      throw new StoreError(
        `Failed to resolve version ID for ${library}:${version}`,
        error,
      );
    }
  }

  /**
   * Retrieves all unique versions for a specific library
   */
  async queryUniqueVersions(library: string): Promise<string[]> {
    try {
      const pool = this.connection.getPool();
      const result = await pool.query(
        `SELECT v.name
         FROM versions v
         JOIN libraries l ON v.library_id = l.id
         WHERE l.name = $1
         ORDER BY v.name`,
        [library.toLowerCase()],
      );
      return result.rows.map((row: { name: string | null }) =>
        normalizeVersionName(row.name),
      );
    } catch (error) {
      throw new ConnectionError("Failed to query versions", error);
    }
  }

  /**
   * Updates the status of a version record in the database.
   */
  async updateVersionStatus(
    versionId: number,
    status: VersionStatus,
    errorMessage?: string,
  ): Promise<void> {
    try {
      const pool = this.connection.getPool();
      await pool.query(
        "UPDATE versions SET status = $1, error_message = $2, updated_at = NOW() WHERE id = $3",
        [status, errorMessage ?? null, versionId],
      );
    } catch (error) {
      throw new StoreError(`Failed to update version status: ${error}`);
    }
  }

  /**
   * Updates the progress counters for a version being indexed.
   */
  async updateVersionProgress(
    versionId: number,
    pages: number,
    maxPages: number,
  ): Promise<void> {
    try {
      const pool = this.connection.getPool();
      await pool.query(
        "UPDATE versions SET progress_pages = $1, progress_max_pages = $2, updated_at = NOW() WHERE id = $3",
        [pages, maxPages, versionId],
      );
    } catch (error) {
      throw new StoreError(`Failed to update version progress: ${error}`);
    }
  }

  /**
   * Retrieves versions by their status.
   */
  async getVersionsByStatus(statuses: VersionStatus[]): Promise<DbVersionWithLibrary[]> {
    try {
      if (statuses.length === 0) {
        return [];
      }
      const pool = this.connection.getPool();
      const result = await pool.query(
        `SELECT v.*, l.name as library_name
         FROM versions v
         JOIN libraries l ON v.library_id = l.id
         WHERE v.status = ANY($1)
         ORDER BY v.updated_at DESC`,
        [statuses],
      );
      return result.rows as DbVersionWithLibrary[];
    } catch (error) {
      throw new StoreError(`Failed to get versions by status: ${error}`);
    }
  }

  /**
   * Retrieves a version by its ID.
   */
  async getVersionById(versionId: number): Promise<DbVersion | null> {
    try {
      const pool = this.connection.getPool();
      const result = await pool.query("SELECT * FROM versions WHERE id = $1", [
        versionId,
      ]);
      return (result.rows[0] as DbVersion | undefined) ?? null;
    } catch (error) {
      throw new StoreError(`Failed to get version by ID: ${error}`);
    }
  }

  /**
   * Retrieves a library by its ID.
   */
  async getLibraryById(libraryId: number): Promise<{ id: number; name: string } | null> {
    try {
      const pool = this.connection.getPool();
      const result = await pool.query("SELECT * FROM libraries WHERE id = $1", [
        libraryId,
      ]);
      const row = result.rows[0] as { id: number; name: string } | undefined;
      return row ?? null;
    } catch (error) {
      throw new StoreError(`Failed to get library by ID: ${error}`);
    }
  }

  /**
   * Retrieves a library by its name.
   */
  async getLibrary(name: string): Promise<{ id: number; name: string } | null> {
    try {
      const pool = this.connection.getPool();
      const normalizedName = name.toLowerCase();
      const result = await pool.query("SELECT id FROM libraries WHERE name = $1", [
        normalizedName,
      ]);
      const row = result.rows[0] as { id: number } | undefined;
      if (!row) {
        return null;
      }
      return { id: row.id, name: normalizedName };
    } catch (error) {
      throw new StoreError(`Failed to get library by name: ${error}`);
    }
  }

  /**
   * Deletes a library by its ID.
   */
  async deleteLibrary(libraryId: number): Promise<void> {
    try {
      const pool = this.connection.getPool();
      await pool.query("DELETE FROM libraries WHERE id = $1", [libraryId]);
    } catch (error) {
      throw new StoreError(`Failed to delete library: ${error}`);
    }
  }

  /**
   * Stores scraper options for a version to enable reproducible indexing.
   */
  async storeScraperOptions(versionId: number, options: ScraperOptions): Promise<void> {
    try {
      const {
        url: source_url,
        library: _library,
        version: _version,
        signal: _signal,
        initialQueue: _initialQueue,
        isRefresh: _isRefresh,
        ...scraper_options
      } = options;

      const optionsJson = JSON.stringify(scraper_options);
      const pool = this.connection.getPool();
      await pool.query(
        "UPDATE versions SET source_url = $1, scraper_options = $2, updated_at = NOW() WHERE id = $3",
        [source_url, optionsJson, versionId],
      );
    } catch (error) {
      throw new StoreError(`Failed to store scraper options: ${error}`);
    }
  }

  /**
   * Retrieves stored scraping configuration (source URL and options) for a version.
   * Returns null when no source URL is recorded (not re-indexable).
   */
  async getScraperOptions(versionId: number): Promise<StoredScraperOptions | null> {
    try {
      const pool = this.connection.getPool();
      const result = await pool.query("SELECT * FROM versions WHERE id = $1", [
        versionId,
      ]);
      const row = result.rows[0] as DbVersion | undefined;

      if (!row?.source_url) {
        return null;
      }

      let parsed: VersionScraperOptions = {} as VersionScraperOptions;
      if (row.scraper_options) {
        try {
          parsed = JSON.parse(row.scraper_options) as VersionScraperOptions;
        } catch (e) {
          logger.warn(`⚠️  Invalid scraper_options JSON for version ${versionId}: ${e}`);
          parsed = {} as VersionScraperOptions;
        }
      }

      return { sourceUrl: row.source_url, options: parsed };
    } catch (error) {
      throw new StoreError(`Failed to get scraper options: ${error}`);
    }
  }

  /**
   * Finds versions that were indexed from the same source URL.
   */
  async findVersionsBySourceUrl(url: string): Promise<DbVersionWithLibrary[]> {
    try {
      const pool = this.connection.getPool();
      const result = await pool.query(
        `SELECT v.*, l.name as library_name
         FROM versions v
         JOIN libraries l ON v.library_id = l.id
         WHERE v.source_url = $1
         ORDER BY v.created_at DESC`,
        [url],
      );
      return result.rows as DbVersionWithLibrary[];
    } catch (error) {
      throw new StoreError(`Failed to find versions by source URL: ${error}`);
    }
  }

  /**
   * Verifies existence of documents for a specific library version
   */
  async checkDocumentExists(library: string, version: string): Promise<boolean> {
    try {
      const pool = this.connection.getPool();
      const normalizedVersion = version.toLowerCase();
      const result = await pool.query(
        `SELECT EXISTS (
           SELECT 1
           FROM documents d
           JOIN pages p ON d.page_id = p.id
           JOIN versions v ON p.version_id = v.id
           JOIN libraries l ON v.library_id = l.id
           WHERE l.name = $1 AND COALESCE(v.name, '') = COALESCE($2, '')
         ) as exists`,
        [library.toLowerCase(), normalizedVersion],
      );
      return result.rows[0].exists;
    } catch (error) {
      throw new ConnectionError("Failed to check document existence", error);
    }
  }

  /**
   * Retrieves a mapping of all libraries to their available versions with details.
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
      const pool = this.connection.getPool();
      const result = await pool.query(`
        SELECT
          l.name as library,
          COALESCE(v.name, '') as version,
          v.id as "versionId",
          v.status as status,
          v.progress_pages as "progressPages",
          v.progress_max_pages as "progressMaxPages",
          v.source_url as "sourceUrl",
          MIN(p.created_at) as "indexedAt",
          COUNT(d.id) as "documentCount",
          COUNT(DISTINCT p.url) as "uniqueUrlCount"
        FROM versions v
        JOIN libraries l ON v.library_id = l.id
        LEFT JOIN pages p ON p.version_id = v.id
        LEFT JOIN documents d ON d.page_id = p.id
        GROUP BY v.id, l.name
        ORDER BY l.name, version
      `);

      const libraryMap = new Map<
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
      >();

      for (const row of result.rows) {
        const library = row.library as string;
        if (!libraryMap.has(library)) {
          libraryMap.set(library, []);
        }

        const indexedAtISO = row.indexedAt ? new Date(row.indexedAt).toISOString() : null;

        libraryMap.get(library)?.push({
          version: row.version,
          versionId: row.versionId,
          status: row.status,
          progressPages: Number(row.progressPages),
          progressMaxPages: Number(row.progressMaxPages),
          sourceUrl: row.sourceUrl,
          documentCount: Number(row.documentCount),
          uniqueUrlCount: Number(row.uniqueUrlCount),
          indexedAt: indexedAtISO,
        });
      }

      for (const versions of libraryMap.values()) {
        versions.sort((a, b) => compareVersionsDescending(a.version, b.version));
      }

      return libraryMap;
    } catch (error) {
      throw new ConnectionError("Failed to query library versions", error);
    }
  }

  /**
   * Helper method to detect if an error is related to input size limits.
   */
  private isInputSizeError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    const message = error.message.toLowerCase();
    return (
      message.includes("maximum context length") ||
      message.includes("too long") ||
      message.includes("token limit") ||
      message.includes("input is too large") ||
      message.includes("exceeds") ||
      (message.includes("max") && message.includes("token"))
    );
  }

  /**
   * Creates embeddings for an array of texts with automatic retry logic for size-related errors.
   */
  private async embedDocumentsWithRetry(
    texts: string[],
    isRetry = false,
  ): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    try {
      return await this.embeddings.embedDocuments(texts);
    } catch (error) {
      if (this.isInputSizeError(error)) {
        if (texts.length > 1) {
          const midpoint = Math.floor(texts.length / 2);
          const firstHalf = texts.slice(0, midpoint);
          const secondHalf = texts.slice(midpoint);

          if (!isRetry) {
            logger.warn(
              `⚠️  Batch of ${texts.length} texts exceeded size limit, splitting into ${firstHalf.length} + ${secondHalf.length}`,
            );
          }

          const [firstEmbeddings, secondEmbeddings] = await Promise.all([
            this.embedDocumentsWithRetry(firstHalf, true),
            this.embedDocumentsWithRetry(secondHalf, true),
          ]);

          return [...firstEmbeddings, ...secondEmbeddings];
        } else {
          const text = texts[0];
          const midpoint = Math.floor(text.length / 2);
          const firstHalf = text.substring(0, midpoint);

          if (!isRetry) {
            logger.warn(
              `⚠️  Single text exceeded embedding size limit (${text.length} chars).`,
            );
          }

          try {
            const embedding = await this.embedDocumentsWithRetry([firstHalf], true);
            return embedding;
          } catch (retryError) {
            logger.error(
              `❌ Failed to embed even after splitting. Original length: ${text.length}`,
            );
            throw retryError;
          }
        }
      }

      throw error;
    }
  }

  /**
   * Stores documents with library and version metadata, generating embeddings
   * for vector similarity search. Uses atomic transactions via PoolClient.
   */
  async addDocuments(
    library: string,
    version: string,
    depth: number,
    result: ScrapeResult,
  ): Promise<void> {
    try {
      const { title, url, chunks } = result;
      if (chunks.length === 0) {
        return;
      }

      let paddedEmbeddings: number[][] = [];

      if (this.isVectorSearchEnabled) {
        const texts = chunks.map((chunk) => {
          const header = `<title>${title}</title>\n<url>${url}</url>\n<path>${(chunk.section.path || []).join(" / ")}</path>\n`;
          return `${header}${chunk.content}`;
        });

        for (let i = 0; i < chunks.length; i++) {
          const bodySize = chunks[i].content.length;
          if (bodySize > this.splitterMaxChunkSize) {
            logger.warn(
              `⚠️  Chunk ${i + 1}/${chunks.length} body exceeds max size: ${bodySize} > ${this.splitterMaxChunkSize} chars (URL: ${url})`,
            );
          }
        }

        const maxBatchChars = this.embeddingBatchChars;
        const rawEmbeddings: number[][] = [];

        let currentBatch: string[] = [];
        let currentBatchSize = 0;
        let batchCount = 0;

        for (const text of texts) {
          const textSize = text.length;

          if (currentBatchSize + textSize > maxBatchChars && currentBatch.length > 0) {
            batchCount++;
            logger.debug(
              `Processing embedding batch ${batchCount}: ${currentBatch.length} texts, ${currentBatchSize} chars`,
            );
            const batchEmbeddings = await this.embedDocumentsWithRetry(currentBatch);
            rawEmbeddings.push(...batchEmbeddings);
            currentBatch = [];
            currentBatchSize = 0;
          }

          currentBatch.push(text);
          currentBatchSize += textSize;

          if (currentBatch.length >= this.embeddingBatchSize) {
            batchCount++;
            logger.debug(
              `Processing embedding batch ${batchCount}: ${currentBatch.length} texts, ${currentBatchSize} chars`,
            );
            const batchEmbeddings = await this.embedDocumentsWithRetry(currentBatch);
            rawEmbeddings.push(...batchEmbeddings);
            currentBatch = [];
            currentBatchSize = 0;
          }
        }

        if (currentBatch.length > 0) {
          batchCount++;
          logger.debug(
            `Processing final embedding batch ${batchCount}: ${currentBatch.length} texts, ${currentBatchSize} chars`,
          );
          const batchEmbeddings = await this.embedDocumentsWithRetry(currentBatch);
          rawEmbeddings.push(...batchEmbeddings);
        }
        paddedEmbeddings = rawEmbeddings.map((vector) => this.padVector(vector));
      }

      const versionId = await this.resolveVersionId(library, version);

      const pool = this.connection.getPool();

      const existingPageResult = await pool.query(
        "SELECT id FROM pages WHERE version_id = $1 AND url = $2",
        [versionId, url],
      );

      if (existingPageResult.rows.length > 0) {
        const pageId = existingPageResult.rows[0].id;
        const deleteResult = await pool.query(
          "DELETE FROM documents WHERE page_id = $1",
          [pageId],
        );
        if ((deleteResult.rowCount ?? 0) > 0) {
          logger.debug(
            `Deleted ${deleteResult.rowCount} existing documents for URL: ${url}`,
          );
        }
      }

      const client: PoolClient = await pool.connect();
      try {
        await client.query("BEGIN");

        const sourceContentType = result.sourceContentType || result.contentType || null;
        const contentType = result.contentType || result.sourceContentType || null;
        const etag = result.etag || null;
        const lastModified = result.lastModified || null;

        const pageResult = await client.query(
          `INSERT INTO pages (version_id, url, title, etag, last_modified, source_content_type, content_type, depth)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (version_id, url) DO UPDATE SET
             title = EXCLUDED.title,
             source_content_type = EXCLUDED.source_content_type,
             content_type = EXCLUDED.content_type,
             etag = EXCLUDED.etag,
             last_modified = EXCLUDED.last_modified,
             depth = EXCLUDED.depth,
             updated_at = NOW()
           RETURNING id`,
          [
            versionId,
            url,
            title || "",
            etag,
            lastModified,
            sourceContentType,
            contentType,
            depth,
          ],
        );

        const pageId = pageResult.rows[0]?.id;
        if (pageId === undefined) {
          throw new StoreError(`Failed to create/update page for URL: ${url}`);
        }

        let docIndex = 0;
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const metadataJson = JSON.stringify({
            types: chunk.types,
            level: chunk.section.level,
            path: chunk.section.path,
          } satisfies DbChunkMetadata);

          const embeddingStr =
            this.isVectorSearchEnabled && paddedEmbeddings.length > 0
              ? `[${paddedEmbeddings[docIndex].join(",")}]`
              : null;

          await client.query(
            `INSERT INTO documents (page_id, content, metadata, sort_order, embedding)
             VALUES ($1, $2, $3, $4, $5::vector)`,
            [pageId, chunk.content, metadataJson, i, embeddingStr],
          );

          docIndex++;
        }

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      throw new ConnectionError("Failed to add documents to store", error);
    }
  }

  /**
   * Removes documents and pages matching specified library and version.
   * @returns Number of documents deleted
   */
  async deletePages(library: string, version: string): Promise<number> {
    try {
      const pool = this.connection.getPool();
      const normalizedVersion = version.toLowerCase();

      const result = await pool.query(
        `DELETE FROM documents
         WHERE page_id IN (
           SELECT p.id FROM pages p
           JOIN versions v ON p.version_id = v.id
           JOIN libraries l ON v.library_id = l.id
           WHERE l.name = $1 AND COALESCE(v.name, '') = COALESCE($2, '')
         )`,
        [library.toLowerCase(), normalizedVersion],
      );

      await pool.query(
        `DELETE FROM pages
         WHERE version_id IN (
           SELECT v.id FROM versions v
           JOIN libraries l ON v.library_id = l.id
           WHERE l.name = $1 AND COALESCE(v.name, '') = COALESCE($2, '')
         )`,
        [library.toLowerCase(), normalizedVersion],
      );

      return result.rowCount ?? 0;
    } catch (error) {
      throw new ConnectionError("Failed to delete documents", error);
    }
  }

  /**
   * Deletes a page and all its associated document chunks.
   */
  async deletePage(pageId: number): Promise<void> {
    try {
      const pool = this.connection.getPool();
      const docResult = await pool.query("DELETE FROM documents WHERE page_id = $1", [
        pageId,
      ]);
      logger.debug(`Deleted ${docResult.rowCount} document(s) for page ID ${pageId}`);

      const pageResult = await pool.query("DELETE FROM pages WHERE id = $1", [pageId]);
      if ((pageResult.rowCount ?? 0) > 0) {
        logger.debug(`Deleted page record for page ID ${pageId}`);
      }
    } catch (error) {
      throw new ConnectionError(`Failed to delete page ${pageId}`, error);
    }
  }

  /**
   * Retrieves all pages for a specific version ID with their metadata.
   */
  async getPagesByVersionId(versionId: number): Promise<DbPage[]> {
    try {
      const pool = this.connection.getPool();
      const result = await pool.query("SELECT * FROM pages WHERE version_id = $1", [
        versionId,
      ]);
      return result.rows as DbPage[];
    } catch (error) {
      throw new ConnectionError("Failed to get pages by version ID", error);
    }
  }

  /**
   * Completely removes a library version and all associated documents.
   * Optionally removes the library if no other versions remain.
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
      const pool = this.connection.getPool();
      const normalizedLibrary = library.toLowerCase();
      const normalizedVersion = version.toLowerCase();

      const versionResult = await pool.query(
        `SELECT v.id, v.library_id
         FROM versions v
         JOIN libraries l ON v.library_id = l.id
         WHERE l.name = $1 AND COALESCE(v.name, '') = COALESCE($2, '')`,
        [normalizedLibrary, normalizedVersion],
      );

      if (versionResult.rows.length === 0) {
        return { documentsDeleted: 0, versionDeleted: false, libraryDeleted: false };
      }

      const versionId = versionResult.rows[0].id as number;
      const libraryId = versionResult.rows[0].library_id as number;

      const countResult = await pool.query(
        `SELECT COUNT(*) as count
         FROM documents d
         JOIN pages p ON d.page_id = p.id
         WHERE p.version_id = $1`,
        [versionId],
      );
      const documentsDeleted = Number(countResult.rows[0].count);

      const versionDeleteResult = await pool.query("DELETE FROM versions WHERE id = $1", [
        versionId,
      ]);
      const versionDeleted = (versionDeleteResult.rowCount ?? 0) > 0;

      let libraryDeleted = false;
      if (removeLibraryIfEmpty && versionDeleted) {
        const remainingResult = await pool.query(
          "SELECT COUNT(*) as count FROM versions WHERE library_id = $1",
          [libraryId],
        );
        const remainingVersions = Number(remainingResult.rows[0].count);

        if (remainingVersions === 0) {
          const libraryDeleteResult = await pool.query(
            "DELETE FROM libraries WHERE id = $1",
            [libraryId],
          );
          libraryDeleted = (libraryDeleteResult.rowCount ?? 0) > 0;
        }
      }

      return { documentsDeleted, versionDeleted, libraryDeleted };
    } catch (error) {
      throw new ConnectionError("Failed to remove version", error);
    }
  }

  /**
   * Parses the metadata field from a JSON string to an object.
   */
  private parseMetadata<M extends {}, T extends { metadata: M }>(row: T): T {
    if (row.metadata && typeof row.metadata === "string") {
      try {
        row.metadata = JSON.parse(row.metadata) as M;
      } catch (error) {
        logger.warn(`Failed to parse metadata JSON: ${error}`);
        row.metadata = {} as M;
      }
    }
    return row;
  }

  /**
   * Parses metadata for an array of rows.
   */
  private parseMetadataArray<M extends {}, T extends { metadata: M }>(rows: T[]): T[] {
    return rows.map((row) => this.parseMetadata(row));
  }

  /**
   * Retrieves a document by its ID.
   */
  async getById(id: string): Promise<DbPageChunk | null> {
    try {
      const pool = this.connection.getPool();
      const result = await pool.query(
        `SELECT d.id, d.page_id, d.content, d.metadata, d.sort_order, d.embedding, d.created_at,
                p.url, p.title, p.source_content_type, p.content_type
         FROM documents d
         JOIN pages p ON d.page_id = p.id
         WHERE d.id = $1`,
        [Number(id)],
      );

      const row = result.rows[0] as DbQueryResult<DbPageChunk>;
      if (!row) {
        return null;
      }

      return this.parseMetadata(row);
    } catch (error) {
      throw new ConnectionError(`Failed to get document by ID ${id}`, error);
    }
  }

  /**
   * Finds documents matching a text query using hybrid search when vector search is enabled,
   * or falls back to full-text search only when vector search is disabled.
   * Uses Reciprocal Rank Fusion for hybrid search or simple FTS ranking for fallback mode.
   */
  async findByContent(
    library: string,
    version: string,
    query: string,
    limit: number,
  ): Promise<(DbPageChunk & DbChunkRank)[]> {
    try {
      if (!query || typeof query !== "string" || query.trim().length === 0) {
        return [];
      }

      const pool = this.connection.getPool();
      const normalizedVersion = version.toLowerCase();
      const normalizedLibrary = library.toLowerCase();

      if (this.isVectorSearchEnabled) {
        const rawEmbedding = await this.embeddings.embedQuery(query);
        const embedding = this.padVector(rawEmbedding);
        const embeddingStr = `[${embedding.join(",")}]`;

        const overfetchLimit = Math.max(1, limit * this.searchOverfetchFactor);
        const vectorSearchK = overfetchLimit * this.vectorSearchMultiplier;

        const vecResult = await pool.query(
          `SELECT d.id, d.content, d.metadata, p.url, p.title,
                  p.source_content_type, p.content_type,
                  1 - (d.embedding <=> $1::vector) as vec_score
           FROM documents d
           JOIN pages p ON d.page_id = p.id
           JOIN versions v ON p.version_id = v.id
           JOIN libraries l ON v.library_id = l.id
           WHERE l.name = $2
             AND COALESCE(v.name, '') = COALESCE($3, '')
             AND d.embedding IS NOT NULL
           ORDER BY d.embedding <=> $1::vector
           LIMIT $4`,
          [embeddingStr, normalizedLibrary, normalizedVersion, vectorSearchK],
        );
        const vectorResults = vecResult.rows as RawSearchResult[];

        const ftsResult = await pool.query(
          `SELECT d.id, d.content, d.metadata, p.url, p.title,
                  p.source_content_type, p.content_type,
                  ts_rank(to_tsvector('english', d.content), plainto_tsquery('english', $1)) as fts_score
           FROM documents d
           JOIN pages p ON d.page_id = p.id
           JOIN versions v ON p.version_id = v.id
           JOIN libraries l ON v.library_id = l.id
           WHERE l.name = $2
             AND COALESCE(v.name, '') = COALESCE($3, '')
             AND to_tsvector('english', d.content) @@ plainto_tsquery('english', $1)
             AND NOT EXISTS (
               SELECT 1 FROM jsonb_array_elements_text((d.metadata)::jsonb->'types') t
               WHERE t = 'structural'
             )
           ORDER BY fts_score DESC
           LIMIT $4`,
          [query, normalizedLibrary, normalizedVersion, overfetchLimit],
        );
        const ftsResults = ftsResult.rows as RawSearchResult[];

        const allResults = new Map<number, RawSearchResult>();
        for (const r of vectorResults) {
          allResults.set(Number(r.id), r);
        }
        for (const r of ftsResults) {
          const existing = allResults.get(Number(r.id));
          if (existing) {
            existing.fts_score = r.fts_score;
          } else {
            allResults.set(Number(r.id), r);
          }
        }

        const filteredResults = Array.from(allResults.values()).filter((r) => {
          const metadata =
            typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata;
          const types: string[] = metadata?.types ?? [];
          return !types.includes("structural");
        });

        const rankedResults = this.assignRanks(filteredResults);
        const topResults = rankedResults
          .sort((a, b) => b.rrf_score - a.rrf_score)
          .slice(0, limit);

        return topResults.map((row) => {
          const parsedRow = this.parseMetadata({
            id: row.id,
            page_id: row.page_id,
            content: row.content,
            metadata: row.metadata,
            sort_order: row.sort_order,
            embedding: row.embedding,
            created_at: row.created_at,
            url: row.url || "",
            title: row.title ?? null,
            source_content_type: row.source_content_type ?? null,
            content_type: row.content_type ?? null,
          });

          return Object.assign(parsedRow, {
            score: row.rrf_score,
            vec_rank: row.vec_rank,
            fts_rank: row.fts_rank,
          });
        });
      } else {
        const result = await pool.query(
          `SELECT d.id, d.content, d.metadata, d.sort_order, d.page_id, d.embedding, d.created_at,
                  p.url, p.title, p.source_content_type, p.content_type,
                  ts_rank(to_tsvector('english', d.content), plainto_tsquery('english', $1)) as fts_score
           FROM documents d
           JOIN pages p ON d.page_id = p.id
           JOIN versions v ON p.version_id = v.id
           JOIN libraries l ON v.library_id = l.id
           WHERE l.name = $2
             AND COALESCE(v.name, '') = COALESCE($3, '')
             AND to_tsvector('english', d.content) @@ plainto_tsquery('english', $1)
             AND NOT EXISTS (
               SELECT 1 FROM jsonb_array_elements_text((d.metadata)::jsonb->'types') t
               WHERE t = 'structural'
             )
           ORDER BY fts_score DESC
           LIMIT $4`,
          [query, normalizedLibrary, normalizedVersion, limit],
        );

        return result.rows.map(
          (row: RawSearchResult & { fts_score: number }, index: number) => {
            const parsedRow = this.parseMetadata({
              id: row.id,
              page_id: row.page_id,
              content: row.content,
              metadata: row.metadata,
              sort_order: row.sort_order,
              embedding: row.embedding,
              created_at: row.created_at,
              url: row.url || "",
              title: row.title ?? null,
              source_content_type: row.source_content_type ?? null,
              content_type: row.content_type ?? null,
            });

            return Object.assign(parsedRow, {
              score: row.fts_score,
              fts_rank: index + 1,
            });
          },
        );
      }
    } catch (error) {
      throw new ConnectionError(
        `Failed to find documents by content with query "${query}"`,
        error,
      );
    }
  }

  /**
   * Finds child chunks of a given document based on path hierarchy.
   */
  async findChildChunks(
    library: string,
    version: string,
    id: string,
    limit: number,
  ): Promise<DbPageChunk[]> {
    try {
      const parent = await this.getById(id);
      if (!parent) {
        return [];
      }

      const pool = this.connection.getPool();
      const parentPath = parent.metadata.path ?? [];
      const normalizedVersion = version.toLowerCase();
      const parentPathJson = JSON.stringify(parentPath);

      const result = await pool.query(
        `SELECT d.id, d.page_id, d.content, d.metadata, d.sort_order, d.embedding, d.created_at,
                p.url, p.title, p.source_content_type, p.content_type
         FROM documents d
         JOIN pages p ON d.page_id = p.id
         JOIN versions v ON p.version_id = v.id
         JOIN libraries l ON v.library_id = l.id
         WHERE l.name = $1
           AND COALESCE(v.name, '') = COALESCE($2, '')
           AND p.url = $3
           AND jsonb_array_length((d.metadata)::jsonb->'path') = $4
           AND (d.metadata)::jsonb->>'path' LIKE $5 || '%'
           AND d.sort_order > (SELECT sort_order FROM documents WHERE id = $6)
         ORDER BY d.sort_order
         LIMIT $7`,
        [
          library.toLowerCase(),
          normalizedVersion,
          parent.url,
          parentPath.length + 1,
          parentPathJson,
          Number(id),
          limit,
        ],
      );

      return this.parseMetadataArray(result.rows as DbPageChunk[]);
    } catch (error) {
      throw new ConnectionError(`Failed to find child chunks for ID ${id}`, error);
    }
  }

  /**
   * Finds preceding sibling chunks of a given document.
   */
  async findPrecedingSiblingChunks(
    library: string,
    version: string,
    id: string,
    limit: number,
  ): Promise<DbPageChunk[]> {
    try {
      const reference = await this.getById(id);
      if (!reference) {
        return [];
      }

      const pool = this.connection.getPool();
      const normalizedVersion = version.toLowerCase();
      const pathJson = JSON.stringify(reference.metadata.path);

      const result = await pool.query(
        `SELECT d.id, d.page_id, d.content, d.metadata, d.sort_order, d.embedding, d.created_at,
                p.url, p.title, p.source_content_type, p.content_type
         FROM documents d
         JOIN pages p ON d.page_id = p.id
         JOIN versions v ON p.version_id = v.id
         JOIN libraries l ON v.library_id = l.id
         WHERE l.name = $1
           AND COALESCE(v.name, '') = COALESCE($2, '')
           AND p.url = $3
           AND d.sort_order < (SELECT sort_order FROM documents WHERE id = $4)
           AND (d.metadata)::jsonb->>'path' = $5
         ORDER BY d.sort_order DESC
         LIMIT $6`,
        [
          library.toLowerCase(),
          normalizedVersion,
          reference.url,
          Number(id),
          pathJson,
          limit,
        ],
      );

      return this.parseMetadataArray(result.rows as DbPageChunk[]).reverse();
    } catch (error) {
      throw new ConnectionError(
        `Failed to find preceding sibling chunks for ID ${id}`,
        error,
      );
    }
  }

  /**
   * Finds subsequent sibling chunks of a given document.
   */
  async findSubsequentSiblingChunks(
    library: string,
    version: string,
    id: string,
    limit: number,
  ): Promise<DbPageChunk[]> {
    try {
      const reference = await this.getById(id);
      if (!reference) {
        return [];
      }

      const pool = this.connection.getPool();
      const normalizedVersion = version.toLowerCase();
      const pathJson = JSON.stringify(reference.metadata.path);

      const result = await pool.query(
        `SELECT d.id, d.page_id, d.content, d.metadata, d.sort_order, d.embedding, d.created_at,
                p.url, p.title, p.source_content_type, p.content_type
         FROM documents d
         JOIN pages p ON d.page_id = p.id
         JOIN versions v ON p.version_id = v.id
         JOIN libraries l ON v.library_id = l.id
         WHERE l.name = $1
           AND COALESCE(v.name, '') = COALESCE($2, '')
           AND p.url = $3
           AND d.sort_order > (SELECT sort_order FROM documents WHERE id = $4)
           AND (d.metadata)::jsonb->>'path' = $5
         ORDER BY d.sort_order
         LIMIT $6`,
        [
          library.toLowerCase(),
          normalizedVersion,
          reference.url,
          Number(id),
          pathJson,
          limit,
        ],
      );

      return this.parseMetadataArray(result.rows as DbPageChunk[]);
    } catch (error) {
      throw new ConnectionError(
        `Failed to find subsequent sibling chunks for ID ${id}`,
        error,
      );
    }
  }

  /**
   * Finds the parent chunk of a given document.
   */
  async findParentChunk(
    library: string,
    version: string,
    id: string,
  ): Promise<DbPageChunk | null> {
    try {
      const child = await this.getById(id);
      if (!child) {
        return null;
      }

      const path = child.metadata.path ?? [];
      const parentPath = path.slice(0, -1);

      if (parentPath.length === 0) {
        return null;
      }

      const pool = this.connection.getPool();
      const normalizedVersion = version.toLowerCase();
      const parentPathJson = JSON.stringify(parentPath);

      const result = await pool.query(
        `SELECT d.id, d.page_id, d.content, d.metadata, d.sort_order, d.embedding, d.created_at,
                p.url, p.title, p.source_content_type, p.content_type
         FROM documents d
         JOIN pages p ON d.page_id = p.id
         JOIN versions v ON p.version_id = v.id
         JOIN libraries l ON v.library_id = l.id
         WHERE l.name = $1
           AND COALESCE(v.name, '') = COALESCE($2, '')
           AND p.url = $3
           AND (d.metadata)::jsonb->>'path' = $4
           AND d.sort_order < (SELECT sort_order FROM documents WHERE id = $5)
         ORDER BY d.sort_order DESC
         LIMIT 1`,
        [library.toLowerCase(), normalizedVersion, child.url, parentPathJson, Number(id)],
      );

      const row = result.rows[0] as DbPageChunk | undefined;
      if (!row) {
        return null;
      }

      return this.parseMetadata(row);
    } catch (error) {
      logger.warn(`Failed to find parent chunk for ID ${id}: ${error}`);
      return null;
    }
  }

  /**
   * Fetches multiple documents by their IDs in a single call.
   */
  async findChunksByIds(
    library: string,
    version: string,
    ids: string[],
  ): Promise<DbPageChunk[]> {
    if (!ids.length) return [];
    try {
      const pool = this.connection.getPool();
      const normalizedVersion = version.toLowerCase();
      const numericIds = ids.map((id) => Number(id));

      const result = await pool.query(
        `SELECT d.id, d.page_id, d.content, d.metadata, d.sort_order, d.embedding, d.created_at,
                p.url, p.title, p.source_content_type, p.content_type
         FROM documents d
         JOIN pages p ON d.page_id = p.id
         JOIN versions v ON p.version_id = v.id
         JOIN libraries l ON v.library_id = l.id
         WHERE l.name = $1
           AND COALESCE(v.name, '') = COALESCE($2, '')
           AND d.id = ANY($3::int[])
         ORDER BY d.sort_order`,
        [library.toLowerCase(), normalizedVersion, numericIds],
      );
      return this.parseMetadataArray(result.rows as DbPageChunk[]);
    } catch (error) {
      throw new ConnectionError("Failed to fetch documents by IDs", error);
    }
  }

  /**
   * Fetches all document chunks for a specific URL within a library and version.
   */
  async findChunksByUrl(
    library: string,
    version: string,
    url: string,
  ): Promise<DbPageChunk[]> {
    try {
      const pool = this.connection.getPool();
      const normalizedVersion = version.toLowerCase();

      const result = await pool.query(
        `SELECT d.id, d.page_id, d.content, d.metadata, d.sort_order, d.embedding, d.created_at,
                p.url, p.title, p.source_content_type, p.content_type
         FROM documents d
         JOIN pages p ON d.page_id = p.id
         JOIN versions v ON p.version_id = v.id
         JOIN libraries l ON v.library_id = l.id
         WHERE l.name = $1
           AND COALESCE(v.name, '') = COALESCE($2, '')
           AND p.url = $3
         ORDER BY d.sort_order`,
        [library.toLowerCase(), normalizedVersion, url],
      );
      return this.parseMetadataArray(result.rows as DbPageChunk[]);
    } catch (error) {
      throw new ConnectionError(`Failed to fetch documents by URL ${url}`, error);
    }
  }
}
