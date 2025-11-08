import type { Document } from "@langchain/core/documents";
import type { Embeddings } from "@langchain/core/embeddings";
import type { Pool } from "pg";
import semver from "semver";
import type { ScraperOptions } from "../scraper/types";
import type { DocumentMetadata } from "../types";
import {
  EMBEDDING_BATCH_CHARS,
  EMBEDDING_BATCH_SIZE,
  SEARCH_OVERFETCH_FACTOR,
  SEARCH_WEIGHT_FTS,
  SEARCH_WEIGHT_VEC,
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
import { ConnectionError, DimensionError, StoreError } from "./errors";
import { PostgresConnection } from "./PostgresConnection";
import type { StoredScraperOptions } from "./types";
import {
  type DbDocument,
  type DbJoinedDocument,
  type DbQueryResult,
  type DbVersion,
  type DbVersionWithLibrary,
  denormalizeVersionName,
  mapDbDocumentToDocument,
  normalizeVersionName,
  VECTOR_DIMENSION,
  type VersionScraperOptions,
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
   * Generates a dual-mode FTS query that combines phrase and keyword matching.
   * Creates a query like: "exact phrase" OR ("word1" OR "word2" OR "word3")
   * This provides better recall by matching both exact phrases and individual terms,
   * while safely handling special FTS keywords by quoting everything.
   */
  private escapeFtsQuery(query: string): string {
    // If the query already contains quotes, respect them and return as-is (escaped)
    if (query.includes('"')) {
      return query.replace(/"/g, '""');
    }

    // Escape internal double quotes for the phrase part
    const escapedQuotes = query.replace(/"/g, '""');
    const phraseQuery = `"${escapedQuotes}"`;

    // Split query into individual terms for keyword matching
    const terms = query
      .trim()
      .split(/\s+/)
      .filter((term) => term.length > 0);

    // If only one term, just return the phrase query
    if (terms.length <= 1) {
      return phraseQuery;
    }

    // Create keyword query with each term safely quoted: ("term1" OR "term2" OR "term3")
    const keywordQuery = terms
      .map((term) => `"${term.replace(/"/g, '""')}"`)
      .join(" OR ");

    // Combine phrase and keyword queries
    return `${phraseQuery} OR (${keywordQuery})`;
  }

  /**
   * Initializes database connection and ensures readiness
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
   * Gracefully closes database connections
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
   * Resolves a library name and version string to version_id.
   * Creates library and version records if they don't exist.
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
      const libraryId = libraryResult.rows[0].id;

      // 2. Get or create version (normalize version name to lowercase for case-insensitive matching)
      const normalizedVersion = normalizeVersionName(version).toLowerCase();
      const versionResult = await this.pool.query(
        `INSERT INTO versions (library_id, name, status)
         VALUES ($1, $2, 'not_indexed')
         ON CONFLICT (library_id, name) DO UPDATE SET library_id = EXCLUDED.library_id
         RETURNING id`,
        [libraryId, normalizedVersion],
      );

      return versionResult.rows[0].id;
    } catch (error) {
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
   * Retrieves versions by their status.
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
   * Stores scraper options for a version to enable reproducible indexing.
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
   * Retrieves stored scraping configuration (source URL and options) for a version.
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
   * Finds versions that were indexed from the same source URL.
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
   * Verifies existence of documents for a specific library version
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

        libraryMap.get(libraryName)!.push({
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
   * Stores documents with library and version metadata, generating embeddings
   * for vector similarity search. Uses pgvector for vector storage.
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
      // 1. Resolve version_id
      const versionId = await this.resolveVersionId(library, version);

      // 2. Group documents by URL
      const docsByUrl = new Map<string, Document[]>();
      for (const doc of documents) {
        const url = (doc.metadata as DocumentMetadata).url || "";
        if (!docsByUrl.has(url)) {
          docsByUrl.set(url, []);
        }
        docsByUrl.get(url)!.push(doc);
      }

      // 3. Process each URL's documents
      for (const [url, urlDocs] of docsByUrl.entries()) {
        // Get metadata from first document
        const firstMeta = urlDocs[0].metadata as DocumentMetadata;

        // Prepare page metadata (media/links from Crawl4AI)
        const pageMetadata: Record<string, unknown> = {};
        if (firstMeta.media) {
          pageMetadata.media = firstMeta.media;
        }
        if (firstMeta.links) {
          pageMetadata.links = firstMeta.links;
        }
        const pageMetadataStr =
          Object.keys(pageMetadata).length > 0 ? JSON.stringify(pageMetadata) : null;

        // Create or update page record (UPSERT)
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
        const pageId = pageResult.rows[0].id;

        // 4. Generate embeddings if enabled
        let embeddings: number[][] | null = null;
        if (this.isVectorSearchEnabled) {
          const texts = urlDocs.map((doc) => doc.pageContent);

          // Batch embedding generation
          embeddings = await this.embeddings.embedDocuments(texts);

          // Pad embeddings to fixed dimension
          embeddings = embeddings.map((emb) => this.padVector(emb));
        }

        // 5. Delete existing documents for this page
        await this.pool.query("DELETE FROM documents WHERE page_id = $1", [pageId]);

        // 6. Insert new documents
        for (let i = 0; i < urlDocs.length; i++) {
          const doc = urlDocs[i];
          const embedding = embeddings ? embeddings[i] : null;
          const embeddingStr = embedding ? `[${embedding.join(",")}]` : null;

          await this.pool.query(
            `INSERT INTO documents (page_id, content, embedding, metadata, sort_order)
             VALUES ($1, $2, $3::vector, $4, $5)`,
            [pageId, doc.pageContent, embeddingStr, JSON.stringify(doc.metadata), i],
          );
        }
      }

      logger.debug(`Stored ${documents.length} documents for ${library}:${version}`);
    } catch (error) {
      throw new StoreError(`Failed to add documents for ${library}:${version}`, error);
    }
  }

  /**
   * Removes documents matching specified library and version
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
   * Removes documents for a specific URL within a library and version
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
   * Completely removes a library version and all associated documents.
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
   * Retrieves a document by its ID.
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
   * Finds documents matching a text query using hybrid search (pgvector + FTS).
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
   * Finds child chunks of a given document based on path hierarchy.
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

      const parentMetadata = JSON.parse(parentResult.rows[0].metadata);
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

      const currentMetadata = JSON.parse(currentResult.rows[0].metadata);
      const currentPath = currentMetadata.path || "";
      const currentChunkId = currentMetadata.chunk_id || 0;
      const currentUrl = currentResult.rows[0].url;

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

      const currentMetadata = JSON.parse(currentResult.rows[0].metadata);
      const currentPath = currentMetadata.path || "";
      const currentChunkId = currentMetadata.chunk_id || 0;
      const currentUrl = currentResult.rows[0].url;

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
   * Finds the parent chunk of a given document.
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

      const currentMetadata = JSON.parse(currentResult.rows[0].metadata);

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
   * Fetches multiple documents by their IDs in a single call.
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
}
