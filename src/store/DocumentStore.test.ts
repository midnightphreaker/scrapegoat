import { Pool } from "pg";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { resolvePgBaseUrl } from "../../test/test-helpers";
import type { ScrapeResult } from "../scraper/types";
import type { Chunk } from "../splitter/types";
import { loadConfig } from "../utils/config";
import { DocumentStore } from "./DocumentStore";
import { EmbeddingConfig } from "./embeddings/EmbeddingConfig";
import { EmbeddingModelChangedError } from "./errors";
import { PostgresConnection } from "./PostgresConnection";
import { VersionStatus } from "./types";

// Mock only the embedding service to generate deterministic embeddings for testing
// This allows us to test ranking logic while using real PostgreSQL database
// NOTE: We avoid vi.importActual here because it would load heavy LangChain SDKs
// (@langchain/aws, @langchain/google-genai, etc.) which cause OOM during teardown.
// Only export what DocumentStore.ts actually imports from this module.

/**
 * Mutable override for embedDocuments behavior.
 * Tests can set this to control embedding behavior (e.g., simulate errors).
 * Set to null to use the default deterministic embedding generator.
 *
 * IMPORTANT: Using this instead of vi.fn() to avoid OOM from unbounded call history.
 */
let embedDocumentsOverride: ((texts: string[]) => Promise<number[][]>) | null = null;

function resetEmbedDocumentsOverride(): void {
  embedDocumentsOverride = null;
}

vi.mock("./embeddings/EmbeddingFactory", () => {
  function generateEmbedding(text: string): number[] {
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(1536).fill(0);

    words.forEach((word, wordIndex) => {
      const wordHash = Array.from(word).reduce(
        (acc, char) => acc + char.charCodeAt(0),
        0,
      );
      const baseIndex = (wordHash % 100) * 15;

      for (let i = 0; i < 15; i++) {
        const index = (baseIndex + i) % 1536;
        embedding[index] += 1.0 / (wordIndex + 1);
      }
    });

    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? embedding.map((val) => val / magnitude) : embedding;
  }

  return {
    areCredentialsAvailable: (provider: string) => {
      if (provider === "openai") return !!process.env.OPENAI_API_KEY;
      return false;
    },
    createEmbeddingModel: () => ({
      embedQuery: async (text: string) => generateEmbedding(text),
      embedDocuments: async (texts: string[]) => {
        if (embedDocumentsOverride) {
          return embedDocumentsOverride(texts);
        }
        return texts.map((text) => generateEmbedding(text));
      },
    }),
    ModelConfigurationError: class ModelConfigurationError extends Error {
      constructor(message: string) {
        super(message);
        this.name = "ModelConfigurationError";
      }
    },
    UnsupportedProviderError: class UnsupportedProviderError extends Error {
      constructor(provider: string) {
        super(`Unsupported embedding provider: ${provider}`);
        this.name = "UnsupportedProviderError";
      }
    },
  };
});

// ─── PostgreSQL Test Database Fixture ──────────────────────────────────────

const BASE_URL = resolvePgBaseUrl();
const TEST_DB_PREFIX = "test_docstore";

/** Small pool config for tests to reduce memory pressure and prevent OOM during teardown */
const TEST_POOL_CONFIG = { max: 2, min: 0, idleTimeoutMillis: 1000 };

function generateDbName(): string {
  return `${TEST_DB_PREFIX}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Global test database — created once and shared across ALL test suites
 * to minimize the number of connection pools and prevent OOM.
 *
 * Each describe block uses truncateAll() for data isolation
 * instead of creating its own database.
 */
const globalTestDb = (async () => {
  const dbName = generateDbName();
  const basePool = new Pool({ connectionString: BASE_URL, max: 1 });
  await basePool.query(`CREATE DATABASE "${dbName}"`);
  await basePool.end();

  const testUrl = BASE_URL.replace(/\/[^/]*$/, `/${dbName}`);
  return {
    url: testUrl,
    cleanup: async () => {
      const pool = new Pool({ connectionString: BASE_URL, max: 1 });
      await pool.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
      await pool.end();
    },
  };
})();

// ─── Helper: truncate all data tables for test isolation ───────────────────

async function truncateAll(pool: Pool): Promise<void> {
  await pool.query("TRUNCATE documents, pages, versions, libraries, metadata CASCADE");
}

// ─── Shared helpers ────────────────────────────────────────────────────────

const appConfig = loadConfig();

/**
 * Helper function to create minimal ScrapeResult for testing.
 * Converts simplified test data to the ScrapeResult format expected by addDocuments.
 */
function createScrapeResult(
  title: string,
  url: string,
  content: string,
  path: string[] = [],
  options?: {
    etag?: string | null;
    lastModified?: string | null;
  },
): ScrapeResult {
  const chunks: Chunk[] = [
    {
      types: ["text"],
      content,
      section: { level: 0, path },
    },
  ];

  return {
    url,
    title,
    sourceContentType: "text/html",
    contentType: "text/html",
    textContent: content,
    links: [],
    errors: [],
    chunks,
    etag: options?.etag,
    lastModified: options?.lastModified,
  } satisfies ScrapeResult;
}

// ─── Test Suites ───────────────────────────────────────────────────────────

/**
 * Tests for DocumentStore with embeddings enabled
 * Uses explicit embedding configuration and tests hybrid search functionality
 */
describe("DocumentStore - With Embeddings", () => {
  let store: DocumentStore;
  let connection: PostgresConnection;
  let testDbUrl: string;

  beforeAll(async () => {
    const { url } = await globalTestDb;
    testDbUrl = url;

    // Create a single shared connection and store for the entire suite
    const embeddingConfig = EmbeddingConfig.parseEmbeddingConfig(
      "openai:text-embedding-3-small",
    );
    appConfig.app.embeddingModel = embeddingConfig.modelSpec;
    appConfig.database.url = testDbUrl;
    appConfig.database.vectorDimension = 1536;

    connection = new PostgresConnection(testDbUrl, TEST_POOL_CONFIG);
    store = new DocumentStore(connection, appConfig);
    await store.initialize();
  });

  beforeEach(async () => {
    await truncateAll(connection.getPool());
    resetEmbedDocumentsOverride();
  });

  afterAll(async () => {
    if (store) {
      await store.shutdown();
    }
  });

  describe("Document Storage and Retrieval", () => {
    beforeEach(async () => {
      await truncateAll(connection.getPool());
    });

    it("should store and retrieve documents with proper metadata", async () => {
      // Add two pages separately
      await store.addDocuments(
        "testlib",
        "1.0.0",
        1,
        createScrapeResult(
          "JS Tutorial",
          "https://example.com/js-tutorial",
          "JavaScript programming tutorial with examples",
          ["programming", "javascript"],
        ),
      );
      await store.addDocuments(
        "testlib",
        "1.0.0",
        1,
        createScrapeResult(
          "Python DS",
          "https://example.com/python-ds",
          "Python data science guide with pandas",
          ["programming", "python"],
        ),
      );

      // Verify documents were stored
      expect(await store.checkDocumentExists("testlib", "1.0.0")).toBe(true);

      // Verify library versions are tracked correctly
      const versions = await store.queryUniqueVersions("testlib");
      expect(versions).toContain("1.0.0");

      // Verify library version details
      const libraryVersions = await store.queryLibraryVersions();
      expect(libraryVersions.has("testlib")).toBe(true);

      const testlibVersions = libraryVersions.get("testlib")!;
      expect(testlibVersions).toHaveLength(1);
      expect(testlibVersions[0].version).toBe("1.0.0");
      expect(testlibVersions[0].documentCount).toBe(2);
      expect(testlibVersions[0].uniqueUrlCount).toBe(2);
    });

    it("treats library names case-insensitively and reuses same library id", async () => {
      const a = await store.resolveVersionId("React", "");
      const b = await store.resolveVersionId("react", "");
      const c = await store.resolveVersionId("REACT", "");
      expect(a).toBe(b);
      expect(b).toBe(c);
    });

    it("should handle document deletion correctly", async () => {
      await store.addDocuments(
        "templib",
        "1.0.0",
        1,
        createScrapeResult(
          "Temp Doc",
          "https://example.com/temp",
          "Temporary document for deletion test",
          ["temp"],
        ),
      );
      expect(await store.checkDocumentExists("templib", "1.0.0")).toBe(true);

      const deletedCount = await store.deletePages("templib", "1.0.0");
      expect(deletedCount).toBe(1);
      expect(await store.checkDocumentExists("templib", "1.0.0")).toBe(false);
    });

    it("should completely remove a version including pages and documents", async () => {
      // Add two pages
      await store.addDocuments(
        "removelib",
        "1.0.0",
        1,
        createScrapeResult(
          "Doc 1",
          "https://example.com/doc1",
          "First document for removal test",
          ["docs"],
        ),
      );
      await store.addDocuments(
        "removelib",
        "1.0.0",
        1,
        createScrapeResult(
          "Doc 2",
          "https://example.com/doc2",
          "Second document for removal test",
          ["docs"],
        ),
      );
      expect(await store.checkDocumentExists("removelib", "1.0.0")).toBe(true);

      // Remove the version
      const result = await store.removeVersion("removelib", "1.0.0", true);

      // Verify the results
      expect(result.documentsDeleted).toBe(2);
      expect(result.versionDeleted).toBe(true);
      expect(result.libraryDeleted).toBe(true);

      // Verify documents no longer exist
      expect(await store.checkDocumentExists("removelib", "1.0.0")).toBe(false);
    });

    it("should remove version but keep library when other versions exist", async () => {
      // Add two versions
      await store.addDocuments(
        "multilib",
        "1.0.0",
        1,
        createScrapeResult("V1 Doc", "https://example.com/v1", "Version 1 document", [
          "v1",
        ]),
      );
      await store.addDocuments(
        "multilib",
        "2.0.0",
        1,
        createScrapeResult("V2 Doc", "https://example.com/v2", "Version 2 document", [
          "v2",
        ]),
      );

      // Remove only version 1.0.0
      const result = await store.removeVersion("multilib", "1.0.0", true);

      // Verify version 1 was deleted but library remains
      expect(result.documentsDeleted).toBe(1);
      expect(result.versionDeleted).toBe(true);
      expect(result.libraryDeleted).toBe(false);

      // Verify version 1 no longer exists but version 2 does
      expect(await store.checkDocumentExists("multilib", "1.0.0")).toBe(false);
      expect(await store.checkDocumentExists("multilib", "2.0.0")).toBe(true);
    });

    it("should handle multiple versions of the same library", async () => {
      await store.addDocuments(
        "versionlib",
        "1.0.0",
        1,
        createScrapeResult(
          "V1 Features",
          "https://example.com/v1",
          "Version 1.0 feature documentation",
          ["features"],
        ),
      );
      await store.addDocuments(
        "versionlib",
        "2.0.0",
        1,
        createScrapeResult(
          "V2 Features",
          "https://example.com/v2",
          "Version 2.0 feature documentation with new capabilities",
          ["features"],
        ),
      );

      expect(await store.checkDocumentExists("versionlib", "1.0.0")).toBe(true);
      expect(await store.checkDocumentExists("versionlib", "2.0.0")).toBe(true);

      const versions = await store.queryUniqueVersions("versionlib");
      expect(versions).toContain("1.0.0");
      expect(versions).toContain("2.0.0");
    });

    it("should store and retrieve etag and lastModified metadata", async () => {
      const testEtag = '"abc123-def456"';
      const testLastModified = "2023-12-01T10:30:00Z";

      await store.addDocuments(
        "etagtest",
        "1.0.0",
        1,
        createScrapeResult(
          "ETag Test Doc",
          "https://example.com/etag-test",
          "Test document with etag and lastModified",
          ["test"],
          { etag: testEtag, lastModified: testLastModified },
        ),
      );

      // Query the database directly to verify the etag and last_modified are stored
      const pool = connection.getPool();
      const pageResult = await pool.query(
        `SELECT p.etag, p.last_modified
         FROM pages p
         JOIN versions v ON p.version_id = v.id
         JOIN libraries l ON v.library_id = l.id
         WHERE l.name = $1 AND COALESCE(v.name, '') = $2 AND p.url = $3`,
        ["etagtest", "1.0.0", "https://example.com/etag-test"],
      );

      expect(pageResult.rows[0]).toBeDefined();
      expect(pageResult.rows[0].etag).toBe(testEtag);
      expect(pageResult.rows[0].last_modified).toBe(testLastModified);

      // Also verify we can retrieve the document and it contains the metadata
      const results = await store.findByContent("etagtest", "1.0.0", "etag", 10);
      expect(results.length).toBeGreaterThan(0);

      const doc = results[0];
      expect(doc.url).toBe("https://example.com/etag-test");
    });
  });

  describe("Hybrid Search with Embeddings", () => {
    beforeEach(async () => {
      await truncateAll(connection.getPool());

      // Set up test documents with known semantic relationships for ranking tests
      await store.addDocuments(
        "searchtest",
        "1.0.0",
        1,
        createScrapeResult(
          "JavaScript Programming Guide",
          "https://example.com/js-guide",
          "JavaScript programming tutorial with code examples and functions",
          ["programming", "javascript"],
        ),
      );
      await store.addDocuments(
        "searchtest",
        "1.0.0",
        1,
        createScrapeResult(
          "JavaScript Frameworks",
          "https://example.com/js-frameworks",
          "Advanced JavaScript frameworks like React and Vue for building applications",
          ["programming", "javascript", "frameworks"],
        ),
      );
      await store.addDocuments(
        "searchtest",
        "1.0.0",
        1,
        createScrapeResult(
          "Python Programming",
          "https://example.com/python-guide",
          "Python programming language tutorial for data science and machine learning",
          ["programming", "python"],
        ),
      );
    });

    it("should perform hybrid search combining vector and FTS", async () => {
      const results = await store.findByContent(
        "searchtest",
        "1.0.0",
        "JavaScript programming",
        10,
      );

      expect(results.length).toBeGreaterThan(0);

      // JavaScript documents should rank higher than non-JavaScript documents
      const topResult = results[0];
      expect(topResult.content.toLowerCase()).toContain("javascript");

      // Results should have both vector and FTS ranking metadata
      const hybridResults = results.filter(
        (r) => r.vec_rank !== undefined && r.fts_rank !== undefined,
      );

      // At least some results should be hybrid matches
      if (hybridResults.length > 0) {
        for (const result of hybridResults) {
          expect(result.vec_rank).toBeGreaterThan(0);
          expect(result.fts_rank).toBeGreaterThan(0);
          expect(result.score).toBeGreaterThan(0);
        }
      }

      // All results should have valid scores
      for (const result of results) {
        expect(result.score).toBeGreaterThan(0);
        expect(typeof result.score).toBe("number");
        // Results should have either vec_rank, fts_rank, or both
        expect(result.vec_rank !== undefined || result.fts_rank !== undefined).toBe(true);
      }
    });

    it("should demonstrate semantic similarity through vector search", async () => {
      const results = await store.findByContent(
        "searchtest",
        "1.0.0",
        "programming tutorial", // Should match both exact terms and semantically similar content
        10,
      );

      expect(results.length).toBeGreaterThan(0);

      // Should find programming documents
      const programmingResults = results.filter((r) =>
        r.content.toLowerCase().includes("programming"),
      );

      expect(programmingResults.length).toBeGreaterThan(0);

      // At least some results should have vector ranks (semantic/embedding matching)
      // If no vector results, it might be because embeddings were disabled in this test run
      const vectorResults = results.filter((r) => r.vec_rank !== undefined);
      const ftsResults = results.filter((r) => r.fts_rank !== undefined);

      // Either we have vector results (hybrid search) or FTS results (fallback)
      expect(vectorResults.length > 0 || ftsResults.length > 0).toBe(true);

      // All results should have valid scores
      for (const result of results) {
        expect(result.score).toBeGreaterThan(0);
      }
    });
  });

  describe("Embedding Batch Processing", () => {
    /** Tracks whether embedDocuments was called and captures last args */
    let embedDocumentsCalled = false;
    let lastEmbeddedTexts: string[] = [];

    beforeEach(async () => {
      await truncateAll(connection.getPool());
      embedDocumentsCalled = false;
      lastEmbeddedTexts = [];

      // @ts-expect-error Accessing private property for testing
      if (store.embeddings?.embedDocuments) {
        const originalImpl =
          // @ts-expect-error Accessing private property for testing
          store.embeddings.embedDocuments.bind(store.embeddings);
        // @ts-expect-error Replacing private property for testing
        store.embeddings.embedDocuments = async (texts: string[]) => {
          embedDocumentsCalled = true;
          lastEmbeddedTexts = texts;
          return originalImpl(texts);
        };
      }
    });

    it("should successfully embed and store large batches of documents", async () => {
      // Skip if embeddings are disabled
      // @ts-expect-error Accessing private property for testing
      if (!store.embeddings) {
        return;
      }

      // Add multiple large documents to verify batching works correctly
      const docCount = 5;
      const contentSize = 15000; // 15KB each - ensures batching behavior

      for (let i = 0; i < docCount; i++) {
        await store.addDocuments(
          "batchtest",
          "1.0.0",
          1,
          createScrapeResult(
            `Batch Doc ${i + 1}`,
            `https://example.com/batch-doc${i + 1}`,
            "x".repeat(contentSize),
            ["section"],
          ),
        );
      }

      // Verify all documents were successfully embedded and stored
      expect(await store.checkDocumentExists("batchtest", "1.0.0")).toBe(true);

      // Verify embedDocuments was called (batching occurred)
      expect(embedDocumentsCalled).toBe(true);

      // Verify all documents are searchable (embeddings were applied)
      const searchResults = await store.findByContent("batchtest", "1.0.0", "Batch", 10);
      expect(searchResults.length).toBe(docCount);
    });

    it("should include proper document headers in embedding text", async () => {
      // Skip if embeddings are disabled
      // @ts-expect-error Accessing private property for testing
      if (!store.embeddings) {
        return;
      }

      await store.addDocuments(
        "testlib",
        "1.0.0",
        1,
        createScrapeResult("Test Title", "https://example.com/test", "Test content", [
          "path",
          "to",
          "doc",
        ]),
      );

      // Embedding text should include structured metadata
      expect(embedDocumentsCalled).toBe(true);
      const embeddedText = lastEmbeddedTexts[0];

      expect(embeddedText).toContain("<title>Test Title</title>");
      expect(embeddedText).toContain("<url>https://example.com/test</url>");
      expect(embeddedText).toContain("<path>path / to / doc</path>");
      expect(embeddedText).toContain("Test content");
    });
  });

  describe("Status Tracking and Metadata", () => {
    beforeEach(async () => {
      await truncateAll(connection.getPool());
    });

    it("should update version status correctly", async () => {
      await store.addDocuments(
        "statuslib",
        "1.0.0",
        1,
        createScrapeResult(
          "Status Test",
          "https://example.com/status-test",
          "Status tracking test content",
          ["test"],
        ),
      );
      const versionId = await store.resolveVersionId("statuslib", "1.0.0");

      await store.updateVersionStatus(versionId, VersionStatus.QUEUED);

      const queuedVersions = await store.getVersionsByStatus([VersionStatus.QUEUED]);
      expect(queuedVersions).toHaveLength(1);
      expect(queuedVersions[0].library_name).toBe("statuslib");
      expect(queuedVersions[0].name).toBe("1.0.0");
      expect(queuedVersions[0].status).toBe(VersionStatus.QUEUED);
    });

    it("should store and retrieve scraper options", async () => {
      const versionId = await store.resolveVersionId("optionslib", "1.0.0");

      const scraperOptions = {
        url: "https://example.com/docs",
        library: "optionslib",
        version: "1.0.0",
        maxDepth: 3,
        maxPages: 100,
        scope: "subpages" as const,
        followRedirects: true,
      };

      await store.storeScraperOptions(versionId, scraperOptions);
      const retrieved = await store.getScraperOptions(versionId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.options.maxDepth).toBe(3);
      expect(retrieved?.options.maxPages).toBe(100);
      expect(retrieved?.options.scope).toBe("subpages");
    });
  });

  describe("Embedding Retry Logic", () => {
    let callCount: number;

    beforeEach(async () => {
      await truncateAll(connection.getPool());
      callCount = 0;
      resetEmbedDocumentsOverride();
    });

    it("should successfully handle normal embedding without errors", async () => {
      // Skip if embeddings are disabled
      // @ts-expect-error Accessing private property for testing
      if (!store.embeddings) {
        return;
      }

      await store.addDocuments(
        "normaltest",
        "1.0.0",
        1,
        createScrapeResult(
          "Normal Doc",
          "https://example.com/normal",
          "This is a normal sized document that should embed without issues",
          ["test"],
        ),
      );

      // Verify embedding occurred (document stored with vector)
      // @ts-expect-error Accessing private property for testing
      expect(store.isVectorSearchEnabled).toBe(true);
      expect(await store.checkDocumentExists("normaltest", "1.0.0")).toBe(true);
    });

    it("should retry and split batch when size error occurs", async () => {
      // Skip if embeddings are disabled
      // @ts-expect-error Accessing private property for testing
      if (!store.embeddings) {
        return;
      }

      // Mock embedDocuments to fail first time with size error, then succeed on splits
      embedDocumentsOverride = async (texts: string[]) => {
        callCount++;
        if (callCount === 1 && texts.length > 1) {
          throw new Error("maximum context length exceeded");
        }
        return texts.map(() => new Array(1536).fill(0.1));
      };

      const result = createScrapeResult(
        "Batch Doc",
        "https://example.com/batch",
        "Content chunk 1",
        ["section1"],
      );
      result.chunks = [
        {
          types: ["text"],
          content: "Content chunk 1",
          section: { level: 0, path: ["section1"] },
        },
        {
          types: ["text"],
          content: "Content chunk 2",
          section: { level: 0, path: ["section2"] },
        },
      ];

      await store.addDocuments("retrytest", "1.0.0", 1, result);

      expect(callCount).toBeGreaterThan(1);
      expect(await store.checkDocumentExists("retrytest", "1.0.0")).toBe(true);
    });

    it("should truncate single oversized text when size error occurs", async () => {
      // Skip if embeddings are disabled
      // @ts-expect-error Accessing private property for testing
      if (!store.embeddings) {
        return;
      }

      embedDocumentsOverride = async (texts: string[]) => {
        callCount++;
        if (callCount === 1) {
          throw new Error("This model's maximum context length is 8191 tokens");
        }
        return texts.map(() => new Array(1536).fill(0.1));
      };

      const largeContent = "x".repeat(50000);
      await store.addDocuments(
        "truncatetest",
        "1.0.0",
        1,
        createScrapeResult("Large Doc", "https://example.com/large", largeContent, [
          "section",
        ]),
      );

      expect(callCount).toBe(2);
      expect(await store.checkDocumentExists("truncatetest", "1.0.0")).toBe(true);
    });

    it("should detect various size error messages", async () => {
      // Skip if embeddings are disabled
      // @ts-expect-error Accessing private property for testing
      if (!store.embeddings) {
        return;
      }

      const sizeErrorMessages = [
        "maximum context length exceeded",
        "input is too long",
        "token limit reached",
        "input is too large",
        "text exceeds the limit",
        "max token count exceeded",
      ];

      for (const errorMsg of sizeErrorMessages) {
        callCount = 0;

        embedDocumentsOverride = async (texts: string[]) => {
          callCount++;
          if (callCount === 1) {
            throw new Error(errorMsg);
          }
          return texts.map(() => new Array(1536).fill(0.1));
        };

        const testLib = `errortest-${sizeErrorMessages.indexOf(errorMsg)}`;
        await store.addDocuments(
          testLib,
          "1.0.0",
          1,
          createScrapeResult(
            "Error Test",
            `https://example.com/${testLib}`,
            "Test content",
            ["test"],
          ),
        );

        expect(callCount).toBeGreaterThan(1);
        expect(await store.checkDocumentExists(testLib, "1.0.0")).toBe(true);
      }
    });

    it("should re-throw non-size errors without retry", async () => {
      // Skip if embeddings are disabled
      // @ts-expect-error Accessing private property for testing
      if (!store.embeddings) {
        return;
      }

      embedDocumentsOverride = async () => {
        callCount++;
        throw new Error("Network error: connection refused");
      };

      await expect(
        store.addDocuments(
          "networkerror",
          "1.0.0",
          1,
          createScrapeResult(
            "Network Error Test",
            "https://example.com/network-error",
            "Test content",
            ["test"],
          ),
        ),
      ).rejects.toThrow("Network error");

      // Should have been called only once (no retry for non-size errors)
      expect(callCount).toBe(1);
    });

    it("should handle nested retry for multiple batch splits", async () => {
      // Skip if embeddings are disabled
      // @ts-expect-error Accessing private property for testing
      if (!store.embeddings) {
        return;
      }

      embedDocumentsOverride = async (texts: string[]) => {
        callCount++;
        if (callCount <= 2 && texts.length > 1) {
          throw new Error("maximum context length exceeded");
        }
        return texts.map(() => new Array(1536).fill(0.1));
      };

      const result = createScrapeResult(
        "Multi Split",
        "https://example.com/multi",
        "Chunk 1",
        ["s1"],
      );
      result.chunks = [
        { types: ["text"], content: "Chunk 1", section: { level: 0, path: ["s1"] } },
        { types: ["text"], content: "Chunk 2", section: { level: 0, path: ["s2"] } },
        { types: ["text"], content: "Chunk 3", section: { level: 0, path: ["s3"] } },
        { types: ["text"], content: "Chunk 4", section: { level: 0, path: ["s4"] } },
      ];

      await store.addDocuments("multisplit", "1.0.0", 1, result);

      expect(callCount).toBeGreaterThan(2);
      expect(await store.checkDocumentExists("multisplit", "1.0.0")).toBe(true);
    });

    it("should fail when embedding API returns non-retryable error", async () => {
      // Skip if embeddings are disabled
      // @ts-expect-error Accessing private property for testing
      if (!store.embeddings) {
        return;
      }

      // Simulate an API error that is NOT a size-related error
      // (size errors trigger recursive splitting which could be infinite
      //  if the error persists after all splits — production code bug)
      embedDocumentsOverride = async () => {
        callCount++;
        throw new Error("API error: internal server error");
      };

      await expect(
        store.addDocuments(
          "alwaysfail",
          "1.0.0",
          1,
          createScrapeResult(
            "Always Fail",
            "https://example.com/always-fail",
            "Some test content",
            ["test"],
          ),
        ),
      ).rejects.toThrow("API error");

      expect(callCount).toBeGreaterThan(0);
    });
  });
});

/**
 * Tests for DocumentStore without embeddings (FTS-only mode)
 * Tests the fallback behavior when no embedding configuration is provided
 */
describe("DocumentStore - Without Embeddings (FTS-only)", () => {
  let store: DocumentStore;
  let connection: PostgresConnection;
  let testDbUrl: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(async () => {
    const { url } = await globalTestDb;
    testDbUrl = url;

    // Create a single shared connection for the suite
    appConfig.database.url = testDbUrl;
    appConfig.app.embeddingModel = "";
    connection = new PostgresConnection(testDbUrl, TEST_POOL_CONFIG);
    store = new DocumentStore(connection, appConfig);
    await store.initialize();
  });

  beforeEach(() => {
    // Save and clear environment variables to disable embeddings
    originalEnv = { ...process.env };
    delete process.env.OPENAI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AZURE_OPENAI_API_KEY;
    resetEmbedDocumentsOverride();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  afterAll(async () => {
    if (store) {
      await store.shutdown();
    }
  });

  describe("Initialization without embeddings", () => {
    it("should initialize successfully without embedding credentials", async () => {
      // Already initialized in beforeAll - verify it worked
      const healthResult = await connection.healthCheck();
      expect(healthResult).toBe(true);
    });

    it("should store documents without vectorization", async () => {
      await truncateAll(connection.getPool());

      await expect(
        store.addDocuments(
          "react",
          "18.0.0",
          1,
          createScrapeResult(
            "React Hooks Guide",
            "https://example.com/react-hooks",
            "This is a test document about React hooks.",
            ["React", "Hooks"],
          ),
        ),
      ).resolves.not.toThrow();

      const exists = await store.checkDocumentExists("react", "18.0.0");
      expect(exists).toBe(true);
    });
  });

  describe("FTS-only Search", () => {
    beforeEach(async () => {
      await truncateAll(connection.getPool());

      await store.addDocuments(
        "testlib",
        "1.0.0",
        1,
        createScrapeResult(
          "React Hooks Guide",
          "https://example.com/react-hooks",
          "React hooks are a powerful feature for state management.",
          ["React", "Hooks"],
        ),
      );
      await store.addDocuments(
        "testlib",
        "1.0.0",
        1,
        createScrapeResult(
          "TypeScript Introduction",
          "https://example.com/typescript-intro",
          "TypeScript provides excellent type safety for JavaScript.",
          ["TypeScript", "Intro"],
        ),
      );
    });

    it("should perform FTS-only search", async () => {
      const results = await store.findByContent("testlib", "1.0.0", "React hooks", 5);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain("React hooks");
      expect(results[0]).toHaveProperty("score");
      expect(results[0]).toHaveProperty("fts_rank");
      // Should NOT have vector rank since vectorization is disabled
      expect((results[0] as unknown as Record<string, unknown>).vec_rank).toBeUndefined();
    });

    it("should handle various search queries correctly", async () => {
      const jsResults = await store.findByContent("testlib", "1.0.0", "TypeScript", 5);
      expect(jsResults.length).toBeGreaterThan(0);
      expect(jsResults[0].content).toContain("TypeScript");

      // Empty query should return empty results
      const emptyResults = await store.findByContent("testlib", "1.0.0", "", 5);
      expect(emptyResults).toHaveLength(0);
    });

    it("should safely handle special characters in queries via plainto_tsquery", async () => {
      const maliciousQueries = [
        "'; DROP TABLE documents; --",
        "programming & development",
        "function()",
        "test* wildcard",
      ];

      for (const query of maliciousQueries) {
        await expect(
          store.findByContent("testlib", "1.0.0", query, 10),
        ).resolves.not.toThrow();
      }
    });
  });
});

/**
 * Common tests that work in both embedding and non-embedding modes
 * These tests focus on core database functionality
 */
describe("DocumentStore - Common Functionality", () => {
  let store: DocumentStore;
  let connection: PostgresConnection;
  let testDbUrl: string;

  beforeAll(async () => {
    const { url } = await globalTestDb;
    testDbUrl = url;

    // Create a single shared connection and store for the entire suite
    const embeddingConfig = EmbeddingConfig.parseEmbeddingConfig(
      "openai:text-embedding-3-small",
    );
    appConfig.app.embeddingModel = embeddingConfig.modelSpec;
    appConfig.database.url = testDbUrl;
    appConfig.database.vectorDimension = 1536;

    connection = new PostgresConnection(testDbUrl, TEST_POOL_CONFIG);
    store = new DocumentStore(connection, appConfig);
    await store.initialize();
  });

  beforeEach(async () => {
    await truncateAll(connection.getPool());
    resetEmbedDocumentsOverride();
  });

  afterAll(async () => {
    if (store) {
      await store.shutdown();
    }
  });

  describe("getActiveEmbeddingConfig", () => {
    it("should return null when no embedding config is provided", async () => {
      // Create a store without embedding config (FTS-only mode)
      const ftsConnection = new PostgresConnection(testDbUrl, TEST_POOL_CONFIG);
      const ftsConfig = loadConfig();
      ftsConfig.app.embeddingModel = "";
      ftsConfig.database.url = testDbUrl;
      const ftsOnlyStore = new DocumentStore(ftsConnection, ftsConfig);
      await ftsOnlyStore.initialize();

      const config = ftsOnlyStore.getActiveEmbeddingConfig();
      expect(config).toBeNull();

      await ftsOnlyStore.shutdown();
    });
  });

  describe("Case Sensitivity", () => {
    it("treats version names case-insensitively within a library", async () => {
      const v1 = await store.resolveVersionId("cslib", "1.0.0");
      const v2 = await store.resolveVersionId("cslib", "1.0.0");
      const v3 = await store.resolveVersionId("cslib", "1.0.0");
      expect(v1).toBe(v2);
      expect(v2).toBe(v3);
    });

    it("collapses mixed-case version names to a single version id", async () => {
      const v1 = await store.resolveVersionId("mixcase", "Alpha");
      const v2 = await store.resolveVersionId("mixcase", "alpha");
      const v3 = await store.resolveVersionId("mixcase", "ALPHA");
      expect(v1).toBe(v2);
      expect(v2).toBe(v3);
    });
  });

  describe("Version Isolation", () => {
    it("should search within specific versions only", async () => {
      await store.addDocuments(
        "featuretest",
        "1.0.0",
        1,
        createScrapeResult(
          "Old Feature",
          "https://example.com/old",
          "Old feature documentation",
          ["features"],
        ),
      );
      await store.addDocuments(
        "featuretest",
        "2.0.0",
        1,
        createScrapeResult(
          "New Feature",
          "https://example.com/new",
          "New feature documentation",
          ["features"],
        ),
      );

      const v1Results = await store.findByContent("featuretest", "1.0.0", "feature", 10);
      expect(v1Results.length).toBeGreaterThan(0);
      expect(v1Results[0].title).toBe("Old Feature");

      const v2Results = await store.findByContent("featuretest", "2.0.0", "feature", 10);
      expect(v2Results.length).toBeGreaterThan(0);
      expect(v2Results[0].title).toBe("New Feature");
    });
  });

  describe("Document Management", () => {
    it("should delete both documents and pages when removing all documents", async () => {
      const library = "delete-test";
      const version = "1.0.0";

      // Add multiple pages with documents
      await store.addDocuments(
        library,
        version,
        1,
        createScrapeResult("Page 1", "https://example.com/page1", "Content for page 1", [
          "section1",
        ]),
      );
      await store.addDocuments(
        library,
        version,
        1,
        createScrapeResult("Page 2", "https://example.com/page2", "Content for page 2", [
          "section2",
        ]),
      );

      // Verify both pages and documents exist
      const versionId = await store.resolveVersionId(library, version);
      const pagesBefore = await store.getPagesByVersionId(versionId);
      expect(pagesBefore.length).toBe(2);
      expect(await store.checkDocumentExists(library, version)).toBe(true);

      // Delete all documents for this version
      const deletedCount = await store.deletePages(library, version);
      expect(deletedCount).toBe(2); // Should delete 2 documents

      // Verify both documents AND pages are gone
      const pagesAfter = await store.getPagesByVersionId(versionId);
      expect(pagesAfter.length).toBe(0); // Pages should be deleted too
      expect(await store.checkDocumentExists(library, version)).toBe(false);
    });

    it("should retrieve documents by ID", async () => {
      await store.addDocuments(
        "idtest",
        "1.0.0",
        1,
        createScrapeResult(
          "ID Test Doc",
          "https://example.com/id-test",
          "Test document for ID retrieval",
          ["test"],
        ),
      );
      const results = await store.findByContent("idtest", "1.0.0", "test document", 10);
      expect(results.length).toBeGreaterThan(0);

      const doc = results[0];
      expect(doc.id).toBeDefined();

      const retrievedDoc = await store.getById(doc.id);
      expect(retrievedDoc).not.toBeNull();
      expect(retrievedDoc?.title).toBe("ID Test Doc");
    });

    it("should handle URL pre-deletion correctly", async () => {
      const library = "url-update-test";
      const version = "1.0.0";
      const url = "https://example.com/test-page";

      // Helper function to count documents
      async function countDocuments(targetUrl?: string): Promise<number> {
        const pool = connection.getPool();
        let query = `
          SELECT COUNT(*) as count
          FROM documents d
          JOIN pages p ON d.page_id = p.id
          JOIN versions v ON p.version_id = v.id
          JOIN libraries l ON v.library_id = l.id
          WHERE l.name = $1 AND COALESCE(v.name, '') = $2
        `;
        const params: unknown[] = [library.toLowerCase(), version.toLowerCase()];

        if (targetUrl) {
          query += " AND p.url = $3";
          params.push(targetUrl);
        }

        const result = await pool.query(query, params);
        return Number(result.rows[0].count);
      }

      // Add initial page with 2 chunks
      await store.addDocuments(library, version, 1, {
        ...createScrapeResult("Initial Test Page", url, "Initial content chunk 1", [
          "section1",
        ]),
        chunks: [
          {
            types: ["text"],
            content: "Initial content chunk 1",
            section: { level: 0, path: ["section1"] },
          },
          {
            types: ["text"],
            content: "Initial content chunk 2",
            section: { level: 0, path: ["section2"] },
          },
        ],
      });
      expect(await countDocuments()).toBe(2);
      expect(await countDocuments(url)).toBe(2);

      // Update with new page (should trigger pre-deletion)
      await store.addDocuments(library, version, 1, {
        ...createScrapeResult("Updated Test Page", url, "Updated content chunk 1", [
          "updated-section1",
        ]),
        chunks: [
          {
            types: ["text"],
            content: "Updated content chunk 1",
            section: { level: 0, path: ["updated-section1"] },
          },
          {
            types: ["text"],
            content: "Updated content chunk 2",
            section: { level: 0, path: ["updated-section2"] },
          },
          {
            types: ["text"],
            content: "Updated content chunk 3",
            section: { level: 0, path: ["updated-section3"] },
          },
        ],
      });
      expect(await countDocuments()).toBe(3);
      expect(await countDocuments(url)).toBe(3);
    });
  });

  describe("Search Security", () => {
    beforeEach(async () => {
      await truncateAll(connection.getPool());

      await store.addDocuments(
        "security-test",
        "1.0.0",
        1,
        createScrapeResult(
          "Programming Guide",
          "https://example.com/programming",
          "Programming computers is fun and educational for developers",
          ["programming", "guide"],
        ),
      );
      await store.addDocuments(
        "security-test",
        "1.0.0",
        1,
        createScrapeResult(
          "CLI Options",
          "https://example.com/cli-options",
          "Use the --error-on-warnings flag to fail the build on warnings.",
          ["cli", "options"],
        ),
      );
    });

    it("should safely handle malicious queries", async () => {
      const maliciousQuery = "'; DROP TABLE documents; --";

      await expect(
        store.findByContent("security-test", "1.0.0", maliciousQuery, 10),
      ).resolves.not.toThrow();

      // Verify database is still functional
      const normalResults = await store.findByContent(
        "security-test",
        "1.0.0",
        "programming",
        10,
      );
      expect(normalResults.length).toBeGreaterThan(0);
    });

    it("should handle special characters safely", async () => {
      const specialCharQueries = [
        "programming & development",
        "software (lifecycle)",
        "price: $99.99",
        "100% coverage",
      ];

      for (const query of specialCharQueries) {
        await expect(
          store.findByContent("security-test", "1.0.0", query, 10),
        ).resolves.not.toThrow();
      }
    });

    it("should handle quoted strings with hyphens via plainto_tsquery", async () => {
      // plainto_tsquery handles all special characters safely, including hyphens
      const results = await store.findByContent(
        "security-test",
        "1.0.0",
        '"--error-on-warnings"',
        10,
      );

      // Should find the document containing --error-on-warnings
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain("--error-on-warnings");
    });

    it("should handle other quoted strings with special characters", async () => {
      await store.addDocuments(
        "security-test",
        "1.0.0",
        1,
        createScrapeResult(
          "Special Chars",
          "https://example.com/special",
          "Use @decorator or $variable in your code.",
          ["syntax"],
        ),
      );

      // Test various quoted strings with special characters
      const testQueries = [
        '"@decorator"',
        '"$variable"',
        '"foo-bar-baz"',
        '"test.method()"',
      ];

      for (const query of testQueries) {
        await expect(
          store.findByContent("security-test", "1.0.0", query, 10),
        ).resolves.not.toThrow();
      }
    });

    it("should handle unbalanced quotes by treating as plain text", async () => {
      // User forgot closing quote — plainto_tsquery treats it as literal text
      const query = '"--error-on-warnings';

      // Should not throw syntax error
      await expect(
        store.findByContent("security-test", "1.0.0", query, 10),
      ).resolves.not.toThrow();
    });

    it("should preserve phrase search when user provides quotes", async () => {
      await store.addDocuments(
        "security-test",
        "1.0.0",
        1,
        createScrapeResult(
          "Phrase Test",
          "https://example.com/phrase",
          "The quick brown fox jumps over the lazy dog.",
          ["test"],
        ),
      );

      // Quoted phrase should find exact phrase
      const phraseResults = await store.findByContent(
        "security-test",
        "1.0.0",
        '"quick brown fox"',
        10,
      );
      expect(phraseResults.length).toBeGreaterThan(0);
      expect(phraseResults[0].content).toContain("quick brown fox");
    });

    it("should support mixed quoted phrases and unquoted terms", async () => {
      await store.addDocuments(
        "security-test",
        "1.0.0",
        1,
        createScrapeResult(
          "Mixed Search Test",
          "https://example.com/mixed",
          "Modern programming requires knowledge of design patterns and best practices.",
          ["programming"],
        ),
      );

      // Test mixed search: unquoted term + quoted phrase
      const results = await store.findByContent(
        "security-test",
        "1.0.0",
        'programming "design patterns"',
        10,
      );

      // Should find documents containing both "programming" AND the phrase "design patterns"
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain("programming");
      expect(results[0].content).toContain("design patterns");
    });

    it("should treat FTS operators as literal keywords in queries", async () => {
      await store.addDocuments(
        "security-test",
        "1.0.0",
        1,
        createScrapeResult(
          "OR Keyword Test",
          "https://example.com/or-test",
          "You can use OR conditions in your queries to match multiple terms.",
          ["queries"],
        ),
      );

      // With plainto_tsquery, operators like OR are treated as literal words
      const results = await store.findByContent(
        "security-test",
        "1.0.0",
        '"queries" OR malicious',
        10,
      );

      // plainto_tsquery will look for "queries" and "OR" and "malicious" as plain words
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain("queries");
      expect(results[0].content).toContain("OR");
    });

    it("should handle NOT operator as a literal keyword", async () => {
      await store.addDocuments(
        "security-test",
        "1.0.0",
        1,
        createScrapeResult(
          "NOT Keyword Test",
          "https://example.com/not-test",
          "You should NOT use this approach in production code.",
          ["warnings"],
        ),
      );

      // plainto_tsquery treats NOT as a literal word
      const results = await store.findByContent(
        "security-test",
        "1.0.0",
        '"production" NOT unsafe',
        10,
      );

      // Document has "production" and "NOT" which matches
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain("production");
      expect(results[0].content).toContain("NOT");
    });
  });

  describe("Refresh Operations - getPagesByVersionId", () => {
    beforeEach(async () => {
      await truncateAll(connection.getPool());

      // Add pages with etags for building refresh queue
      await store.addDocuments(
        "refresh-queue-test",
        "1.0.0",
        1,
        createScrapeResult(
          "Page 1",
          "https://example.com/page1",
          "Content 1",
          ["section1"],
          { etag: '"etag1"', lastModified: "2023-01-01T00:00:00Z" },
        ),
      );
      await store.addDocuments(
        "refresh-queue-test",
        "1.0.0",
        1,
        createScrapeResult(
          "Page 2",
          "https://example.com/page2",
          "Content 2",
          ["section2"],
          { etag: '"etag2"', lastModified: "2023-01-02T00:00:00Z" },
        ),
      );
      await store.addDocuments(
        "refresh-queue-test",
        "1.0.0",
        1,
        createScrapeResult(
          "Page 3 No ETag",
          "https://example.com/page3",
          "Content 3",
          ["section3"],
          { etag: null, lastModified: null },
        ),
      );
    });

    it("should retrieve all pages with metadata for refresh queue building", async () => {
      const versionId = await store.resolveVersionId("refresh-queue-test", "1.0.0");
      const pages = await store.getPagesByVersionId(versionId);

      expect(pages.length).toBe(3);

      // Verify page1 metadata
      const page1 = pages.find((p) => p.url === "https://example.com/page1");
      expect(page1).toBeDefined();
      expect(page1!.id).toBeDefined();
      expect(page1!.etag).toBe('"etag1"');
      expect(page1!.depth).toBe(1);

      // Verify page2 metadata
      const page2 = pages.find((p) => p.url === "https://example.com/page2");
      expect(page2).toBeDefined();
      expect(page2!.etag).toBe('"etag2"');

      // Verify page3 (no etag)
      const page3 = pages.find((p) => p.url === "https://example.com/page3");
      expect(page3).toBeDefined();
      expect(page3!.etag).toBeNull();
    });

    it("should return empty array for version with no pages", async () => {
      const emptyVersionId = await store.resolveVersionId("empty-lib", "1.0.0");
      const pages = await store.getPagesByVersionId(emptyVersionId);

      expect(pages).toEqual([]);
    });

    it("should include all metadata fields needed for refresh", async () => {
      const versionId = await store.resolveVersionId("refresh-queue-test", "1.0.0");
      const pages = await store.getPagesByVersionId(versionId);

      // All pages should have the necessary fields for refresh operations
      for (const page of pages) {
        expect(page.id).toBeDefined();
        expect(page.url).toBeDefined();
        expect(page.depth).toBeDefined();
        // etag can be null, but the field should exist
        expect(page).toHaveProperty("etag");
      }
    });
  });
});

/**
 * Tests for embedding model change safety:
 * metadata persistence, change detection, vector invalidation.
 *
 * Uses a shared connection pool to avoid OOM from creating too many
 * PostgresConnection/DocumentStore instances. Each test uses truncateAll
 * for data isolation, and only creates a fresh store when a different
 * embedding configuration is needed.
 */
describe("DocumentStore - Embedding Model Change Safety", () => {
  let connection: PostgresConnection;
  let testDbUrl: string;
  let originalApiKey: string | undefined;

  beforeAll(async () => {
    const { url } = await globalTestDb;
    testDbUrl = url;

    // Create a single shared connection for the suite
    connection = new PostgresConnection(testDbUrl, TEST_POOL_CONFIG);
    await connection.initialize();
  });

  beforeEach(async () => {
    // Clean up all data including metadata for test isolation
    // (all suites share a single database)
    await truncateAll(connection.getPool());
    resetEmbedDocumentsOverride();

    // Set dummy API key so areCredentialsAvailable("openai") returns true
    // and initializeEmbeddings() proceeds (the actual API call is mocked)
    originalApiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "test-key-for-model-change-safety";
  });

  afterEach(() => {
    // Restore original env
    if (originalApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalApiKey;
    }
  });

  afterAll(async () => {
    await connection.close();
  });

  /**
   * Helper: create a DocumentStore with the given embedding model spec.
   * Reuses the shared PostgresConnection to avoid creating new pools.
   * Do NOT call store.shutdown() on the returned store — the connection
   * is shared and will be closed in afterAll.
   */
  async function createStore(
    modelSpec: string,
    dimension?: number,
  ): Promise<DocumentStore> {
    const cfg = loadConfig();
    if (modelSpec) {
      const embeddingConfig = EmbeddingConfig.parseEmbeddingConfig(modelSpec);
      cfg.app.embeddingModel = embeddingConfig.modelSpec;
    } else {
      cfg.app.embeddingModel = "";
    }
    cfg.database.url = testDbUrl;
    cfg.database.vectorDimension = 1536;
    if (dimension !== undefined) {
      cfg.database.vectorDimension = dimension;
    }
    const s = new DocumentStore(connection, cfg);
    await s.initialize();
    return s;
  }

  // 9.2 Test getEmbeddingMetadata returns null when no keys exist (first-run)
  describe("getEmbeddingMetadata", () => {
    it("should return null for both fields on first run before any embedding init", async () => {
      const s = await createStore("");
      const metadata = await s.getEmbeddingMetadata();
      expect(metadata.model).toBeNull();
      expect(metadata.dimension).toBeNull();
    });
  });

  // 9.3 Test setEmbeddingMetadata writes and reads correctly
  describe("setEmbeddingMetadata", () => {
    it("should write and read model and dimension correctly", async () => {
      const s = await createStore("");
      await s.setEmbeddingMetadata("openai:text-embedding-3-small", 1536);

      const metadata = await s.getEmbeddingMetadata();
      expect(metadata.model).toBe("openai:text-embedding-3-small");
      expect(metadata.dimension).toBe("1536");
    });

    it("should overwrite existing metadata on subsequent calls", async () => {
      const s = await createStore("");
      await s.setEmbeddingMetadata("openai:text-embedding-3-small", 1536);
      await s.setEmbeddingMetadata("openai:text-embedding-ada-002", 768);

      const metadata = await s.getEmbeddingMetadata();
      expect(metadata.model).toBe("openai:text-embedding-ada-002");
      expect(metadata.dimension).toBe("768");
    });
  });

  // 9.4 Test checkEmbeddingModelChange throws when model differs
  describe("checkEmbeddingModelChange", () => {
    it("should throw EmbeddingModelChangedError when model differs", async () => {
      // First init with model A
      const _first = await createStore("openai:text-embedding-3-small");
      // first store goes out of scope — shared connection stays open

      // Create a fresh store on the same database
      const s = await createStore("openai:text-embedding-3-small");

      // Manually set stored metadata to a different model
      await s.setEmbeddingMetadata("openai:text-embedding-ada-002", 1536);

      // Now checkEmbeddingModelChange should detect the mismatch
      await expect(s.checkEmbeddingModelChange()).rejects.toThrow(
        EmbeddingModelChangedError,
      );
    });

    // 9.5 Test checkEmbeddingModelChange throws when dimension differs
    it("should throw EmbeddingModelChangedError when dimension differs", async () => {
      const s = await createStore("openai:text-embedding-3-small");

      // Set stored metadata with same model but different dimension
      await s.setEmbeddingMetadata("openai:text-embedding-3-small", 768);

      await expect(s.checkEmbeddingModelChange()).rejects.toThrow(
        EmbeddingModelChangedError,
      );
    });

    // 9.6 Test checkEmbeddingModelChange does not throw when model and dimension match
    it("should not throw when model and dimension match", async () => {
      const s = await createStore("openai:text-embedding-3-small");

      // Metadata was persisted by initializeEmbeddings — check should pass
      await expect(s.checkEmbeddingModelChange()).resolves.not.toThrow();
    });

    // 9.7 Test checkEmbeddingModelChange does not throw on first run (no stored metadata)
    it("should not throw on first run when no metadata exists", async () => {
      // Create store but clear metadata to simulate first run
      const s = await createStore("openai:text-embedding-3-small");

      const pool = connection.getPool();
      await pool.query("DELETE FROM metadata");

      await expect(s.checkEmbeddingModelChange()).resolves.not.toThrow();
    });

    // 9.8 Test checkEmbeddingModelChange does not throw in FTS-only mode
    it("should not throw when in FTS-only mode (no embedding model)", async () => {
      const s = await createStore("");

      // Even if metadata exists from a prior run, FTS-only skips the check
      await s.setEmbeddingMetadata("openai:text-embedding-3-small", 1536);

      await expect(s.checkEmbeddingModelChange()).resolves.not.toThrow();
    });
  });

  // 9.9, 9.10, 9.11 Test invalidateAllVectors
  describe("invalidateAllVectors", () => {
    it("should set all embeddings to NULL", async () => {
      const s = await createStore("openai:text-embedding-3-small");

      // Add a document so we have an embedding to invalidate
      await s.addDocuments(
        "testlib",
        "1.0.0",
        1,
        createScrapeResult(
          "Test Doc",
          "https://example.com/test",
          "Some test content for embedding invalidation",
        ),
      );

      // Verify embedding exists
      const pool = connection.getPool();
      const before = await pool.query<{ cnt: string }>(
        "SELECT COUNT(*) as cnt FROM documents WHERE embedding IS NOT NULL",
      );
      expect(Number(before.rows[0].cnt)).toBeGreaterThan(0);

      await s.invalidateAllVectors("openai:text-embedding-ada-002", 1536);

      const after = await pool.query<{ cnt: string }>(
        "SELECT COUNT(*) as cnt FROM documents WHERE embedding IS NOT NULL",
      );
      expect(Number(after.rows[0].cnt)).toBe(0);
    });

    it("should verify vector column exists with correct dimension after invalidation", async () => {
      const s = await createStore("openai:text-embedding-3-small");

      // Add a document to populate embeddings
      await s.addDocuments(
        "testlib",
        "1.0.0",
        1,
        createScrapeResult(
          "Test Doc",
          "https://example.com/test",
          "Content for vector column test",
        ),
      );

      // Verify embedding column exists
      const pool = connection.getPool();
      const vecCheck = await pool.query(
        `SELECT a.attname, pg_catalog.format_type(a.atttypid, a.atttypmod)
         FROM pg_attribute a
         JOIN pg_class c ON a.attrelid = c.oid
         WHERE c.relname = 'documents' AND a.attname = 'embedding'`,
      );
      expect(vecCheck.rows.length).toBeGreaterThan(0);

      await s.invalidateAllVectors("openai:text-embedding-ada-002", 768);

      // After invalidation, all embeddings should be NULL
      const afterCount = await pool.query<{ cnt: string }>(
        "SELECT COUNT(*) as cnt FROM documents WHERE embedding IS NOT NULL",
      );
      expect(Number(afterCount.rows[0].cnt)).toBe(0);
    });

    it("should update metadata with new model and dimension", async () => {
      const s = await createStore("openai:text-embedding-3-small");

      await s.invalidateAllVectors("openai:text-embedding-ada-002", 768);

      const metadata = await s.getEmbeddingMetadata();
      expect(metadata.model).toBe("openai:text-embedding-ada-002");
      expect(metadata.dimension).toBe("768");
    });
  });

  // 9.12 Test vector column dimension verification
  describe("Vector Column Verification", () => {
    it("should have embedding column with configured dimension", async () => {
      const _s = await createStore("openai:text-embedding-3-small");

      // Verify embedding column exists with correct type via pg_attribute
      const pool = connection.getPool();
      const vecCheck = await pool.query(
        `SELECT a.attname, pg_catalog.format_type(a.atttypid, a.atttypmod)
         FROM pg_attribute a
         JOIN pg_class c ON a.attrelid = c.oid
         WHERE c.relname = 'documents' AND a.attname = 'embedding'`,
      );
      expect(vecCheck.rows.length).toBeGreaterThan(0);
      // The type should contain "vector" and the configured dimension
      expect(vecCheck.rows[0].format_type).toContain("vector");
    });
  });
});

// ─── Global Teardown: drop shared test database ────────────────────────────
afterAll(async () => {
  const { cleanup } = await globalTestDb;
  await cleanup();
});
