import type { Document } from "@langchain/core/documents";
import type { Embeddings } from "@langchain/core/embeddings";
// PostgreSQL imports will be added in Phase 3
// import { Pool, type PoolClient } from "pg";
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
// applyMigrations will be reimplemented for PostgreSQL in Phase 2
// import { applyMigrations } from "./applyMigrations";
import { EmbeddingConfig, type EmbeddingModelConfig } from "./embeddings/EmbeddingConfig";
import {
  areCredentialsAvailable,
  createEmbeddingModel,
  ModelConfigurationError,
  UnsupportedProviderError,
} from "./embeddings/EmbeddingFactory";
import { ConnectionError, DimensionError, StoreError } from "./errors";
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
  // PostgreSQL connection will be implemented in Phase 3
  // private readonly pool: Pool;
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

    // PostgreSQL connection will be established in Phase 3
    // this.pool = new Pool({ connectionString });

    // Store embedding config for later initialization
    this.embeddingConfig = embeddingConfig;

    logger.warn(
      "⚠️ DocumentStore initialized but PostgreSQL implementation is pending (Phase 3)",
    );
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
   * PostgreSQL-specific implementation will be added in Phase 2-3
   */
  async initialize(): Promise<void> {
    try {
      // Phase 2-3: PostgreSQL connection and migration implementation
      // 1. Create connection pool
      // 2. Check pgvector extension
      // 3. Run migrations
      // 4. Initialize embeddings

      await this.initializeEmbeddings();

      throw new StoreError(
        "PostgreSQL implementation pending (Phase 2-3). SQLite has been removed.",
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
    // PostgreSQL pool shutdown will be implemented in Phase 3
    // await this.pool.end();
    logger.debug("DocumentStore shutdown (PostgreSQL implementation pending)");
  }

  /**
   * Resolves a library name and version string to version_id.
   * Creates library and version records if they don't exist.
   * PostgreSQL implementation pending in Phase 3.
   */
  async resolveVersionId(library: string, version: string): Promise<number> {
    throw new StoreError("PostgreSQL implementation pending (Phase 3)");
  }

  /**
   * Retrieves all unique versions for a specific library
   * PostgreSQL implementation pending in Phase 3.
   */
  async queryUniqueVersions(library: string): Promise<string[]> {
    throw new StoreError("PostgreSQL implementation pending (Phase 3)");
  }

  /**
   * Updates the status of a version record in the database.
   * PostgreSQL implementation pending in Phase 3.
   */
  async updateVersionStatus(
    versionId: number,
    status: VersionStatus,
    errorMessage?: string,
  ): Promise<void> {
    throw new StoreError("PostgreSQL implementation pending (Phase 3)");
  }

  /**
   * Updates the progress counters for a version being indexed.
   * PostgreSQL implementation pending in Phase 3.
   */
  async updateVersionProgress(
    versionId: number,
    pages: number,
    maxPages: number,
  ): Promise<void> {
    throw new StoreError("PostgreSQL implementation pending (Phase 3)");
  }

  /**
   * Retrieves versions by their status.
   * PostgreSQL implementation pending in Phase 3.
   */
  async getVersionsByStatus(statuses: VersionStatus[]): Promise<DbVersionWithLibrary[]> {
    throw new StoreError("PostgreSQL implementation pending (Phase 3)");
  }

  /**
   * Stores scraper options for a version to enable reproducible indexing.
   * PostgreSQL implementation pending in Phase 3.
   */
  async storeScraperOptions(versionId: number, options: ScraperOptions): Promise<void> {
    throw new StoreError("PostgreSQL implementation pending (Phase 3)");
  }

  /**
   * Retrieves stored scraping configuration (source URL and options) for a version.
   * PostgreSQL implementation pending in Phase 3.
   */
  async getScraperOptions(versionId: number): Promise<StoredScraperOptions | null> {
    throw new StoreError("PostgreSQL implementation pending (Phase 3)");
  }

  /**
   * Finds versions that were indexed from the same source URL.
   * PostgreSQL implementation pending in Phase 3.
   */
  async findVersionsBySourceUrl(url: string): Promise<DbVersionWithLibrary[]> {
    throw new StoreError("PostgreSQL implementation pending (Phase 3)");
  }

  /**
   * Verifies existence of documents for a specific library version
   * PostgreSQL implementation pending in Phase 3.
   */
  async checkDocumentExists(library: string, version: string): Promise<boolean> {
    throw new StoreError("PostgreSQL implementation pending (Phase 3)");
  }

  /**
   * Retrieves a mapping of all libraries to their available versions with details.
   * PostgreSQL implementation pending in Phase 3.
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
    throw new StoreError("PostgreSQL implementation pending (Phase 3)");
  }

  /**
   * Stores documents with library and version metadata, generating embeddings
   * for vector similarity search. Uses pgvector for vector storage.
   * PostgreSQL implementation pending in Phase 3.
   */
  async addDocuments(
    library: string,
    version: string,
    documents: Document[],
  ): Promise<void> {
    throw new StoreError("PostgreSQL implementation pending (Phase 3)");
  }

  /**
   * Removes documents matching specified library and version
   * PostgreSQL implementation pending in Phase 3.
   */
  async deleteDocuments(library: string, version: string): Promise<number> {
    throw new StoreError("PostgreSQL implementation pending (Phase 3)");
  }

  /**
   * Removes documents for a specific URL within a library and version
   * PostgreSQL implementation pending in Phase 3.
   */
  async deleteDocumentsByUrl(
    library: string,
    version: string,
    url: string,
  ): Promise<number> {
    throw new StoreError("PostgreSQL implementation pending (Phase 3)");
  }

  /**
   * Completely removes a library version and all associated documents.
   * PostgreSQL implementation pending in Phase 3.
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
    throw new StoreError("PostgreSQL implementation pending (Phase 3)");
  }

  /**
   * Retrieves a document by its ID.
   * PostgreSQL implementation pending in Phase 3.
   */
  async getById(id: string): Promise<Document | null> {
    throw new StoreError("PostgreSQL implementation pending (Phase 3)");
  }

  /**
   * Finds documents matching a text query using hybrid search (pgvector + FTS).
   * PostgreSQL implementation pending in Phase 3.
   */
  async findByContent(
    library: string,
    version: string,
    query: string,
    limit: number,
  ): Promise<Document[]> {
    throw new StoreError("PostgreSQL implementation pending (Phase 3)");
  }

  /**
   * Finds child chunks of a given document based on path hierarchy.
   * PostgreSQL implementation pending in Phase 3.
   */
  async findChildChunks(
    library: string,
    version: string,
    id: string,
    limit: number,
  ): Promise<Document[]> {
    throw new StoreError("PostgreSQL implementation pending (Phase 3)");
  }

  /**
   * Finds preceding sibling chunks of a given document.
   * PostgreSQL implementation pending in Phase 3.
   */
  async findPrecedingSiblingChunks(
    library: string,
    version: string,
    id: string,
    limit: number,
  ): Promise<Document[]> {
    throw new StoreError("PostgreSQL implementation pending (Phase 3)");
  }

  /**
   * Finds subsequent sibling chunks of a given document.
   * PostgreSQL implementation pending in Phase 3.
   */
  async findSubsequentSiblingChunks(
    library: string,
    version: string,
    id: string,
    limit: number,
  ): Promise<Document[]> {
    throw new StoreError("PostgreSQL implementation pending (Phase 3)");
  }

  /**
   * Finds the parent chunk of a given document.
   * PostgreSQL implementation pending in Phase 3.
   */
  async findParentChunk(
    library: string,
    version: string,
    id: string,
  ): Promise<Document | null> {
    throw new StoreError("PostgreSQL implementation pending (Phase 3)");
  }

  /**
   * Fetches multiple documents by their IDs in a single call.
   * PostgreSQL implementation pending in Phase 3.
   */
  async findChunksByIds(
    library: string,
    version: string,
    ids: string[],
  ): Promise<Document[]> {
    throw new StoreError("PostgreSQL implementation pending (Phase 3)");
  }

  /**
   * Fetches all document chunks for a specific URL within a library and version.
   * PostgreSQL implementation pending in Phase 3.
   */
  async findChunksByUrl(
    library: string,
    version: string,
    url: string,
  ): Promise<Document[]> {
    throw new StoreError("PostgreSQL implementation pending (Phase 3)");
  }
}
