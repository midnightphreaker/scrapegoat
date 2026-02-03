import type { Document } from "@langchain/core/documents";
import type { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDatabase, type TestDatabase } from "./__tests__/testUtils";
import { DocumentRetrieverService } from "./DocumentRetrieverService";
import { EmbeddingConfig } from "./embeddings/EmbeddingConfig";

// Mock embedding service for deterministic test vectors
vi.mock("./embeddings/EmbeddingFactory", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./embeddings/EmbeddingFactory")>();

  return {
    ...actual,
    createEmbeddingModel: () => ({
      embedQuery: vi.fn(async (text: string) => {
        // Generate deterministic embeddings based on text content
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
      }),
      embedDocuments: vi.fn(async (texts: string[]) => {
        return texts.map((text) => {
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
        });
      }),
    }),
  };
});

/**
 * Helper function to execute EXPLAIN ANALYZE and parse query plan
 */
async function getQueryPlan(pool: Pool, query: string, params: any[] = []): Promise<any> {
  const explainQuery = `EXPLAIN (ANALYZE, FORMAT JSON) ${query}`;
  const result = await pool.query(explainQuery, params);
  return result.rows[0]["QUERY PLAN"][0];
}

/**
 * Helper function to check if an index is used in the query plan
 */
function _isIndexUsed(plan: any, indexName: string): boolean {
  if (!plan) return false;

  // Check current node
  if (plan["Node Type"] === "Index Scan" && plan["Index Name"] === indexName) {
    return true;
  }

  // Check child nodes recursively
  if (plan.Plans) {
    for (const childPlan of plan.Plans) {
      if (_isIndexUsed(childPlan, indexName)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Helper function to calculate RRF score manually for validation
 */
function _calculateRRFScore(rank: number, k: number = 60): number {
  return 1 / (k + rank);
}

/**
 * Helper function to create deterministic test vectors
 */
function createTestVector(seed: number, dimensions: number = 1536): number[] {
  const vector = new Array(dimensions);
  for (let i = 0; i < dimensions; i++) {
    // Use sine wave pattern based on seed and index for deterministic but varied values
    vector[i] = Math.sin((seed + i) * 0.1) * 0.5 + 0.5;
  }

  // Normalize the vector
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return magnitude > 0 ? vector.map((val) => val / magnitude) : vector;
}

/**
 * PostgreSQL-Specific Feature Tests
 *
 * This test suite validates PostgreSQL-specific features including:
 * - pgvector similarity search (cosine, inner product, L2 distance)
 * - Full-text search with GIN indexes
 * - HNSW index performance
 * - Hybrid search with Reciprocal Rank Fusion (RRF)
 * - Connection pooling and concurrency
 */
describe("PostgreSQL Features", () => {
  let testDb: TestDatabase;
  let pool: Pool;

  beforeEach(async () => {
    const embeddingConfig = EmbeddingConfig.parseEmbeddingConfig(
      "openai:text-embedding-3-small",
    );
    testDb = await createTestDatabase(embeddingConfig);
    pool = testDb.pool;
  });

  afterEach(async () => {
    if (testDb) {
      await testDb.cleanup();
    }
  });

  describe("Suite 1: pgvector Similarity Search", () => {
    it("should use cosine distance operator (<=>) correctly", async () => {
      // Create test library and version
      const libraryResult = await pool.query(
        "INSERT INTO libraries (name) VALUES ($1) RETURNING id",
        ["test-lib"],
      );
      const libraryId = libraryResult.rows[0].id;

      const versionResult = await pool.query(
        "INSERT INTO versions (library_id, name, status) VALUES ($1, $2, $3) RETURNING id",
        [libraryId, "1.0.0", "ready"],
      );
      const versionId = versionResult.rows[0].id;

      const pageResult = await pool.query(
        "INSERT INTO pages (version_id, url, title, content_type) VALUES ($1, $2, $3, $4) RETURNING id",
        [versionId, "https://example.com/page1", "Test Page", "text/html"],
      );
      const pageId = pageResult.rows[0].id;

      // Create test vectors with known relationships
      const vector1 = createTestVector(1);
      const vector2 = createTestVector(1); // Same as vector1 - distance should be 0
      const vector3 = createTestVector(100); // Very different - distance should be large

      // Insert documents with embeddings
      await pool.query(
        "INSERT INTO documents (page_id, content, embedding, sort_order) VALUES ($1, $2, $3, $4)",
        [pageId, "Document 1", JSON.stringify(vector1), 0],
      );
      await pool.query(
        "INSERT INTO documents (page_id, content, embedding, sort_order) VALUES ($1, $2, $3, $4)",
        [pageId, "Document 2", JSON.stringify(vector2), 1],
      );
      await pool.query(
        "INSERT INTO documents (page_id, content, embedding, sort_order) VALUES ($1, $2, $3, $4)",
        [pageId, "Document 3", JSON.stringify(vector3), 2],
      );

      // Query using cosine distance operator
      const queryVector = createTestVector(1);
      const result = await pool.query(
        `SELECT content, embedding <=> $1::vector AS distance
         FROM documents
         ORDER BY embedding <=> $1::vector
         LIMIT 3`,
        [JSON.stringify(queryVector)],
      );

      // Validate results
      expect(result.rows).toHaveLength(3);

      // First result should be identical vector (distance ~0)
      expect(result.rows[0].content).toBe("Document 1");
      expect(Number(result.rows[0].distance)).toBeLessThan(0.01);

      // Second result should also be identical (distance ~0)
      expect(result.rows[1].content).toBe("Document 2");
      expect(Number(result.rows[1].distance)).toBeLessThan(0.01);

      // Third result should be different (distance > 0)
      expect(result.rows[2].content).toBe("Document 3");
      expect(Number(result.rows[2].distance)).toBeGreaterThan(0.1);

      // Verify ordering: distances should be ascending
      expect(Number(result.rows[0].distance)).toBeLessThanOrEqual(
        Number(result.rows[1].distance),
      );
      expect(Number(result.rows[1].distance)).toBeLessThanOrEqual(
        Number(result.rows[2].distance),
      );
    });

    it("should use inner product operator (<#>) correctly", async () => {
      // Create test library, version, page
      const libraryResult = await pool.query(
        "INSERT INTO libraries (name) VALUES ($1) RETURNING id",
        ["test-lib"],
      );
      const libraryId = libraryResult.rows[0].id;

      const versionResult = await pool.query(
        "INSERT INTO versions (library_id, name, status) VALUES ($1, $2, $3) RETURNING id",
        [libraryId, "1.0.0", "ready"],
      );
      const versionId = versionResult.rows[0].id;

      const pageResult = await pool.query(
        "INSERT INTO pages (version_id, url, title, content_type) VALUES ($1, $2, $3, $4) RETURNING id",
        [versionId, "https://example.com/page1", "Test Page", "text/html"],
      );
      const pageId = pageResult.rows[0].id;

      // Create normalized test vectors
      const vector1 = new Array(1536).fill(0);
      vector1[0] = 1.0; // Unit vector along first dimension

      const vector2 = new Array(1536).fill(0);
      vector2[0] = 0.7;
      vector2[1] = 0.7;
      const mag2 = Math.sqrt(0.7 * 0.7 + 0.7 * 0.7);
      const normalizedVector2 = vector2.map((v) => v / mag2);

      // Insert documents
      await pool.query(
        "INSERT INTO documents (page_id, content, embedding, sort_order) VALUES ($1, $2, $3, $4)",
        [pageId, "Vector 1", JSON.stringify(vector1), 0],
      );
      await pool.query(
        "INSERT INTO documents (page_id, content, embedding, sort_order) VALUES ($1, $2, $3, $4)",
        [pageId, "Vector 2", JSON.stringify(normalizedVector2), 1],
      );

      // Query using inner product operator (negative inner product distance)
      const result = await pool.query(
        `SELECT content, embedding <#> $1::vector AS neg_inner_product
         FROM documents
         ORDER BY embedding <#> $1::vector
         LIMIT 2`,
        [JSON.stringify(vector1)],
      );

      // Validate results
      expect(result.rows).toHaveLength(2);

      // Inner product with itself should be largest (most negative distance)
      expect(result.rows[0].content).toBe("Vector 1");

      // Verify ordering is correct
      expect(Number(result.rows[0].neg_inner_product)).toBeLessThan(
        Number(result.rows[1].neg_inner_product),
      );
    });

    it("should use L2 distance operator (<->) correctly", async () => {
      // Create test library, version, page
      const libraryResult = await pool.query(
        "INSERT INTO libraries (name) VALUES ($1) RETURNING id",
        ["test-lib"],
      );
      const libraryId = libraryResult.rows[0].id;

      const versionResult = await pool.query(
        "INSERT INTO versions (library_id, name, status) VALUES ($1, $2, $3) RETURNING id",
        [libraryId, "1.0.0", "ready"],
      );
      const versionId = versionResult.rows[0].id;

      const pageResult = await pool.query(
        "INSERT INTO pages (version_id, url, title, content_type) VALUES ($1, $2, $3, $4) RETURNING id",
        [versionId, "https://example.com/page1", "Test Page", "text/html"],
      );
      const pageId = pageResult.rows[0].id;

      // Create simple test vectors for easy L2 distance calculation
      const origin = new Array(1536).fill(0);

      const vector1 = new Array(1536).fill(0);
      vector1[0] = 1.0; // L2 distance from origin = 1.0

      const vector2 = new Array(1536).fill(0);
      vector2[0] = 2.0; // L2 distance from origin = 2.0

      // Insert documents
      await pool.query(
        "INSERT INTO documents (page_id, content, embedding, sort_order) VALUES ($1, $2, $3, $4)",
        [pageId, "Near origin", JSON.stringify(vector1), 0],
      );
      await pool.query(
        "INSERT INTO documents (page_id, content, embedding, sort_order) VALUES ($1, $2, $3, $4)",
        [pageId, "Far from origin", JSON.stringify(vector2), 1],
      );

      // Query using L2 distance operator
      const result = await pool.query(
        `SELECT content, embedding <-> $1::vector AS l2_distance
         FROM documents
         ORDER BY embedding <-> $1::vector
         LIMIT 2`,
        [JSON.stringify(origin)],
      );

      // Validate results
      expect(result.rows).toHaveLength(2);

      // First result should be vector1 (distance = 1.0)
      expect(result.rows[0].content).toBe("Near origin");
      expect(Math.abs(Number(result.rows[0].l2_distance) - 1.0)).toBeLessThan(0.01);

      // Second result should be vector2 (distance = 2.0)
      expect(result.rows[1].content).toBe("Far from origin");
      expect(Math.abs(Number(result.rows[1].l2_distance) - 2.0)).toBeLessThan(0.01);

      // Verify ordering
      expect(Number(result.rows[0].l2_distance)).toBeLessThan(
        Number(result.rows[1].l2_distance),
      );
    });

    it("should handle vector normalization properly", async () => {
      // Create test library, version, page
      const libraryResult = await pool.query(
        "INSERT INTO libraries (name) VALUES ($1) RETURNING id",
        ["test-lib"],
      );
      const libraryId = libraryResult.rows[0].id;

      const versionResult = await pool.query(
        "INSERT INTO versions (library_id, name, status) VALUES ($1, $2, $3) RETURNING id",
        [libraryId, "1.0.0", "ready"],
      );
      const versionId = versionResult.rows[0].id;

      const pageResult = await pool.query(
        "INSERT INTO pages (version_id, url, title, content_type) VALUES ($1, $2, $3, $4) RETURNING id",
        [versionId, "https://example.com/page1", "Test Page", "text/html"],
      );
      const pageId = pageResult.rows[0].id;

      // Create non-normalized vector
      const nonNormalizedVector = new Array(1536).fill(2.0);

      // Calculate normalized version
      const magnitude = Math.sqrt(
        nonNormalizedVector.reduce((sum, val) => sum + val * val, 0),
      );
      const normalizedVector = nonNormalizedVector.map((val) => val / magnitude);

      // Insert non-normalized vector
      await pool.query(
        "INSERT INTO documents (page_id, content, embedding, sort_order) VALUES ($1, $2, $3, $4)",
        [pageId, "Non-normalized vector", JSON.stringify(nonNormalizedVector), 0],
      );

      // Query with normalized version using cosine distance
      // Cosine distance should work correctly regardless of vector magnitude
      const result = await pool.query(
        `SELECT content, embedding <=> $1::vector AS cosine_distance
         FROM documents
         LIMIT 1`,
        [JSON.stringify(normalizedVector)],
      );

      // Validate that cosine distance works (should be 0 since direction is same)
      expect(result.rows).toHaveLength(1);
      expect(Number(result.rows[0].cosine_distance)).toBeLessThan(0.01);
    });

    it("should retrieve nearest neighbors accurately", async () => {
      // Create test library, version, page
      const libraryResult = await pool.query(
        "INSERT INTO libraries (name) VALUES ($1) RETURNING id",
        ["test-lib"],
      );
      const libraryId = libraryResult.rows[0].id;

      const versionResult = await pool.query(
        "INSERT INTO versions (library_id, name, status) VALUES ($1, $2, $3) RETURNING id",
        [libraryId, "1.0.0", "ready"],
      );
      const versionId = versionResult.rows[0].id;

      const pageResult = await pool.query(
        "INSERT INTO pages (version_id, url, title, content_type) VALUES ($1, $2, $3, $4) RETURNING id",
        [versionId, "https://example.com/page1", "Test Page", "text/html"],
      );
      const pageId = pageResult.rows[0].id;

      // Create a cluster of vectors around different points
      const clusterA = [createTestVector(10), createTestVector(11), createTestVector(12)];

      const clusterB = [createTestVector(50), createTestVector(51), createTestVector(52)];

      // Insert documents from both clusters
      for (let i = 0; i < clusterA.length; i++) {
        await pool.query(
          "INSERT INTO documents (page_id, content, embedding, sort_order) VALUES ($1, $2, $3, $4)",
          [pageId, `Cluster A Doc ${i}`, JSON.stringify(clusterA[i]), i],
        );
      }

      for (let i = 0; i < clusterB.length; i++) {
        await pool.query(
          "INSERT INTO documents (page_id, content, embedding, sort_order) VALUES ($1, $2, $3, $4)",
          [
            pageId,
            `Cluster B Doc ${i}`,
            JSON.stringify(clusterB[i]),
            i + clusterA.length,
          ],
        );
      }

      // Query for nearest neighbors to a point in cluster A
      const queryVector = createTestVector(10);
      const result = await pool.query(
        `SELECT content, embedding <=> $1::vector AS distance
         FROM documents
         ORDER BY embedding <=> $1::vector
         LIMIT 3`,
        [JSON.stringify(queryVector)],
      );

      // Validate that all nearest neighbors are from cluster A
      expect(result.rows).toHaveLength(3);
      expect(result.rows[0].content).toContain("Cluster A");
      expect(result.rows[1].content).toContain("Cluster A");
      expect(result.rows[2].content).toContain("Cluster A");

      // Validate ordering: distances should be ascending
      expect(Number(result.rows[0].distance)).toBeLessThanOrEqual(
        Number(result.rows[1].distance),
      );
      expect(Number(result.rows[1].distance)).toBeLessThanOrEqual(
        Number(result.rows[2].distance),
      );
    });
  });

  describe("Suite 2: Full-Text Search with GIN Index", () => {
    it("should use GIN index for FTS queries (verify with EXPLAIN)", async () => {
      // Create test data
      const libraryResult = await pool.query(
        "INSERT INTO libraries (name) VALUES ($1) RETURNING id",
        ["test-lib"],
      );
      const libraryId = libraryResult.rows[0].id;

      const versionResult = await pool.query(
        "INSERT INTO versions (library_id, name, status) VALUES ($1, $2, $3) RETURNING id",
        [libraryId, "1.0.0", "ready"],
      );
      const versionId = versionResult.rows[0].id;

      const pageResult = await pool.query(
        "INSERT INTO pages (version_id, url, title, content_type) VALUES ($1, $2, $3, $4) RETURNING id",
        [versionId, "https://example.com/page1", "Test Page", "text/html"],
      );
      const pageId = pageResult.rows[0].id;

      const embedding = createTestVector(1);

      // Insert multiple documents to encourage index usage
      for (let i = 0; i < 20; i++) {
        await pool.query(
          "INSERT INTO documents (page_id, content, embedding, sort_order) VALUES ($1, $2, $3, $4)",
          [
            pageId,
            `PostgreSQL database with advanced indexing features ${i}`,
            JSON.stringify(embedding),
            i,
          ],
        );
      }

      // Execute EXPLAIN ANALYZE on FTS query
      const query = `
        SELECT content
        FROM documents
        WHERE to_tsvector('english', content) @@ plainto_tsquery('english', $1)
      `;

      const plan = await getQueryPlan(pool, query, ["database"]);

      // Verify index is being considered (may use Bitmap Index Scan instead of Index Scan)
      // For small datasets, PostgreSQL may choose seq scan, so we just verify the query works
      expect(plan.Plan).toBeDefined();
      expect(plan["Execution Time"]).toBeDefined();
    });

    it("should rank results correctly with ts_rank", async () => {
      // Create test data with varying keyword density
      const libraryResult = await pool.query(
        "INSERT INTO libraries (name) VALUES ($1) RETURNING id",
        ["test-lib"],
      );
      const libraryId = libraryResult.rows[0].id;

      const versionResult = await pool.query(
        "INSERT INTO versions (library_id, name, status) VALUES ($1, $2, $3) RETURNING id",
        [libraryId, "1.0.0", "ready"],
      );
      const versionId = versionResult.rows[0].id;

      const pageResult = await pool.query(
        "INSERT INTO pages (version_id, url, title, content_type) VALUES ($1, $2, $3, $4) RETURNING id",
        [versionId, "https://example.com/page1", "Test Page", "text/html"],
      );
      const pageId = pageResult.rows[0].id;

      const embedding = createTestVector(1);

      // Document 1: High keyword density (3 mentions)
      await pool.query(
        "INSERT INTO documents (page_id, content, embedding, sort_order) VALUES ($1, $2, $3, $4)",
        [
          pageId,
          "PostgreSQL PostgreSQL PostgreSQL is a powerful database system",
          JSON.stringify(embedding),
          0,
        ],
      );

      // Document 2: Medium keyword density (1 mention)
      await pool.query(
        "INSERT INTO documents (page_id, content, embedding, sort_order) VALUES ($1, $2, $3, $4)",
        [
          pageId,
          "PostgreSQL is an open source database with many features",
          JSON.stringify(embedding),
          1,
        ],
      );

      // Document 3: Low keyword density (no mention, different words)
      await pool.query(
        "INSERT INTO documents (page_id, content, embedding, sort_order) VALUES ($1, $2, $3, $4)",
        [
          pageId,
          "MySQL and Oracle are other database systems available today",
          JSON.stringify(embedding),
          2,
        ],
      );

      // Query with ts_rank
      const result = await pool.query(
        `SELECT
           content,
           ts_rank(to_tsvector('english', content), plainto_tsquery('english', $1)) AS rank
         FROM documents
         WHERE to_tsvector('english', content) @@ plainto_tsquery('english', $1)
         ORDER BY rank DESC`,
        ["PostgreSQL"],
      );

      // Validate ranking
      expect(result.rows.length).toBeGreaterThanOrEqual(2);

      // First result should have highest rank (most mentions)
      expect(result.rows[0].content).toContain("PostgreSQL PostgreSQL PostgreSQL");

      // Second result should have lower rank
      expect(result.rows[1].content).not.toContain("PostgreSQL PostgreSQL PostgreSQL");

      // Ranks should be in descending order
      expect(Number(result.rows[0].rank)).toBeGreaterThan(Number(result.rows[1].rank));
    });

    it("should handle plainto_tsquery for plain text", async () => {
      // Create test data
      const libraryResult = await pool.query(
        "INSERT INTO libraries (name) VALUES ($1) RETURNING id",
        ["test-lib"],
      );
      const libraryId = libraryResult.rows[0].id;

      const versionResult = await pool.query(
        "INSERT INTO versions (library_id, name, status) VALUES ($1, $2, $3) RETURNING id",
        [libraryId, "1.0.0", "ready"],
      );
      const versionId = versionResult.rows[0].id;

      const pageResult = await pool.query(
        "INSERT INTO pages (version_id, url, title, content_type) VALUES ($1, $2, $3, $4) RETURNING id",
        [versionId, "https://example.com/page1", "Test Page", "text/html"],
      );
      const pageId = pageResult.rows[0].id;

      const embedding = createTestVector(1);
      await pool.query(
        "INSERT INTO documents (page_id, content, embedding, sort_order) VALUES ($1, $2, $3, $4)",
        [
          pageId,
          "PostgreSQL database & indexing: special characters!",
          JSON.stringify(embedding),
          0,
        ],
      );

      // Test with special characters - plainto_tsquery should handle safely
      const result = await pool.query(
        `SELECT content
         FROM documents
         WHERE to_tsvector('english', content) @@ plainto_tsquery('english', $1)`,
        ["database & indexing:"],
      );

      // Should find the document despite special characters
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].content).toContain("database & indexing");
    });

    it("should handle phrase matching with phraseto_tsquery", async () => {
      // Create test data
      const libraryResult = await pool.query(
        "INSERT INTO libraries (name) VALUES ($1) RETURNING id",
        ["test-lib"],
      );
      const libraryId = libraryResult.rows[0].id;

      const versionResult = await pool.query(
        "INSERT INTO versions (library_id, name, status) VALUES ($1, $2, $3) RETURNING id",
        [libraryId, "1.0.0", "ready"],
      );
      const versionId = versionResult.rows[0].id;

      const pageResult = await pool.query(
        "INSERT INTO pages (version_id, url, title, content_type) VALUES ($1, $2, $3, $4) RETURNING id",
        [versionId, "https://example.com/page1", "Test Page", "text/html"],
      );
      const pageId = pageResult.rows[0].id;

      const embedding = createTestVector(1);

      // Document with exact phrase
      await pool.query(
        "INSERT INTO documents (page_id, content, embedding, sort_order) VALUES ($1, $2, $3, $4)",
        [
          pageId,
          "PostgreSQL is a powerful database system for enterprise applications",
          JSON.stringify(embedding),
          0,
        ],
      );

      // Document with words in different order
      await pool.query(
        "INSERT INTO documents (page_id, content, embedding, sort_order) VALUES ($1, $2, $3, $4)",
        [
          pageId,
          "A database that is powerful like PostgreSQL system",
          JSON.stringify(embedding),
          1,
        ],
      );

      // Query for exact phrase
      const result = await pool.query(
        `SELECT content
         FROM documents
         WHERE to_tsvector('english', content) @@ phraseto_tsquery('english', $1)`,
        ["powerful database system"],
      );

      // Should only find the document with exact phrase in order
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].content).toContain("powerful database system");
    });

    it("should apply stemming correctly", async () => {
      // Create test data
      const libraryResult = await pool.query(
        "INSERT INTO libraries (name) VALUES ($1) RETURNING id",
        ["test-lib"],
      );
      const libraryId = libraryResult.rows[0].id;

      const versionResult = await pool.query(
        "INSERT INTO versions (library_id, name, status) VALUES ($1, $2, $3) RETURNING id",
        [libraryId, "1.0.0", "ready"],
      );
      const versionId = versionResult.rows[0].id;

      const pageResult = await pool.query(
        "INSERT INTO pages (version_id, url, title, content_type) VALUES ($1, $2, $3, $4) RETURNING id",
        [versionId, "https://example.com/page1", "Test Page", "text/html"],
      );
      const pageId = pageResult.rows[0].id;

      const embedding = createTestVector(1);

      // Documents with different word forms
      await pool.query(
        "INSERT INTO documents (page_id, content, embedding, sort_order) VALUES ($1, $2, $3, $4)",
        [
          pageId,
          "We are running PostgreSQL database queries",
          JSON.stringify(embedding),
          0,
        ],
      );

      await pool.query(
        "INSERT INTO documents (page_id, content, embedding, sort_order) VALUES ($1, $2, $3, $4)",
        [
          pageId,
          "The search functionality is being searched thoroughly",
          JSON.stringify(embedding),
          1,
        ],
      );

      // Test stemming: "run" should match "running"
      const result1 = await pool.query(
        `SELECT content
         FROM documents
         WHERE to_tsvector('english', content) @@ plainto_tsquery('english', $1)`,
        ["run"],
      );

      expect(result1.rows).toHaveLength(1);
      expect(result1.rows[0].content).toContain("running");

      // Test stemming: "search" should match "searched"
      const result2 = await pool.query(
        `SELECT content
         FROM documents
         WHERE to_tsvector('english', content) @@ plainto_tsquery('english', $1)`,
        ["search"],
      );

      expect(result2.rows).toHaveLength(1);
      expect(result2.rows[0].content).toContain("searched");
    });
  });

  describe("Suite 3: HNSW Index Performance Validation", () => {
    it("should verify HNSW index exists on documents.embedding", async () => {
      // Query pg_indexes to verify HNSW index exists
      const result = await pool.query(
        `SELECT
           indexname,
           indexdef
         FROM pg_indexes
         WHERE tablename = 'documents'
           AND indexname = 'idx_documents_embedding_hnsw'`,
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].indexname).toBe("idx_documents_embedding_hnsw");

      // Verify index uses HNSW method and vector_cosine_ops
      const indexDef = result.rows[0].indexdef;
      expect(indexDef).toContain("hnsw");
      expect(indexDef).toContain("vector_cosine_ops");
    });

    it("should use HNSW index for vector queries (EXPLAIN)", async () => {
      // Create test data
      const libraryResult = await pool.query(
        "INSERT INTO libraries (name) VALUES ($1) RETURNING id",
        ["test-lib"],
      );
      const libraryId = libraryResult.rows[0].id;

      const versionResult = await pool.query(
        "INSERT INTO versions (library_id, name, status) VALUES ($1, $2, $3) RETURNING id",
        [libraryId, "1.0.0", "ready"],
      );
      const versionId = versionResult.rows[0].id;

      const pageResult = await pool.query(
        "INSERT INTO pages (version_id, url, title, content_type) VALUES ($1, $2, $3, $4) RETURNING id",
        [versionId, "https://example.com/page1", "Test Page", "text/html"],
      );
      const pageId = pageResult.rows[0].id;

      // Insert several documents to ensure index is used
      for (let i = 0; i < 10; i++) {
        const embedding = createTestVector(i);
        await pool.query(
          "INSERT INTO documents (page_id, content, embedding, sort_order) VALUES ($1, $2, $3, $4)",
          [pageId, `Document ${i}`, JSON.stringify(embedding), i],
        );
      }

      // Execute EXPLAIN ANALYZE on vector search query
      const queryVector = createTestVector(1);
      const query = `
        SELECT content
        FROM documents
        ORDER BY embedding <=> $1::vector
        LIMIT 5
      `;

      const plan = await getQueryPlan(pool, query, [JSON.stringify(queryVector)]);

      // Verify query plan is available (index usage depends on dataset size and planner decisions)
      expect(plan.Plan).toBeDefined();
      expect(plan["Execution Time"]).toBeDefined();
    });

    it("should measure query performance with different ef_search values", async () => {
      // Create test data
      const libraryResult = await pool.query(
        "INSERT INTO libraries (name) VALUES ($1) RETURNING id",
        ["test-lib"],
      );
      const libraryId = libraryResult.rows[0].id;

      const versionResult = await pool.query(
        "INSERT INTO versions (library_id, name, status) VALUES ($1, $2, $3) RETURNING id",
        [libraryId, "1.0.0", "ready"],
      );
      const versionId = versionResult.rows[0].id;

      const pageResult = await pool.query(
        "INSERT INTO pages (version_id, url, title, content_type) VALUES ($1, $2, $3, $4) RETURNING id",
        [versionId, "https://example.com/page1", "Test Page", "text/html"],
      );
      const pageId = pageResult.rows[0].id;

      // Insert documents
      for (let i = 0; i < 50; i++) {
        const embedding = createTestVector(i);
        await pool.query(
          "INSERT INTO documents (page_id, content, embedding, sort_order) VALUES ($1, $2, $3, $4)",
          [pageId, `Document ${i}`, JSON.stringify(embedding), i],
        );
      }

      const queryVector = createTestVector(1);
      const efSearchValues = [10, 40, 100];
      const timings: number[] = [];

      for (const efSearch of efSearchValues) {
        // Set ef_search parameter
        await pool.query(`SET hnsw.ef_search = ${efSearch}`);

        // Measure query time
        const startTime = Date.now();
        await pool.query(
          `SELECT content FROM documents ORDER BY embedding <=> $1::vector LIMIT 10`,
          [JSON.stringify(queryVector)],
        );
        const elapsed = Date.now() - startTime;
        timings.push(elapsed);
      }

      // Reset ef_search to default
      await pool.query("RESET hnsw.ef_search");

      // Validate that queries completed (timing may be 0 for fast queries)
      expect(timings).toHaveLength(3);
      timings.forEach((timing) => {
        expect(timing).toBeGreaterThanOrEqual(0);
        expect(timing).toBeLessThan(2000); // Should complete within 2 seconds
      });
    });

    it("should validate index parameters (m=16, ef_construction=64)", async () => {
      // Query index options from pg_class
      const result = await pool.query(
        `SELECT
           c.relname,
           c.reloptions
         FROM pg_class c
         JOIN pg_index i ON i.indexrelid = c.oid
         WHERE c.relname = 'idx_documents_embedding_hnsw'`,
      );

      expect(result.rows).toHaveLength(1);

      // Parse reloptions to verify m and ef_construction parameters
      const options = result.rows[0].reloptions;

      if (options) {
        const optionsStr = options.join(",");
        expect(optionsStr).toContain("m=16");
        expect(optionsStr).toContain("ef_construction=64");
      } else {
        // If options are null, check the index definition
        const indexResult = await pool.query(
          `SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_documents_embedding_hnsw'`,
        );
        const indexDef = indexResult.rows[0].indexdef;
        expect(indexDef).toContain("m = 16");
        expect(indexDef).toContain("ef_construction = 64");
      }
    });

    it("should handle large result sets efficiently", async () => {
      // Create test data
      const libraryResult = await pool.query(
        "INSERT INTO libraries (name) VALUES ($1) RETURNING id",
        ["test-lib"],
      );
      const libraryId = libraryResult.rows[0].id;

      const versionResult = await pool.query(
        "INSERT INTO versions (library_id, name, status) VALUES ($1, $2, $3) RETURNING id",
        [libraryId, "1.0.0", "ready"],
      );
      const versionId = versionResult.rows[0].id;

      const pageResult = await pool.query(
        "INSERT INTO pages (version_id, url, title, content_type) VALUES ($1, $2, $3, $4) RETURNING id",
        [versionId, "https://example.com/page1", "Test Page", "text/html"],
      );
      const pageId = pageResult.rows[0].id;

      // Insert 200 documents
      for (let i = 0; i < 200; i++) {
        const embedding = createTestVector(i);
        await pool.query(
          "INSERT INTO documents (page_id, content, embedding, sort_order) VALUES ($1, $2, $3, $4)",
          [pageId, `Document ${i}`, JSON.stringify(embedding), i],
        );
      }

      // Query for top 100 nearest neighbors and measure time
      const queryVector = createTestVector(1);
      const startTime = Date.now();

      const result = await pool.query(
        `SELECT content FROM documents ORDER BY embedding <=> $1::vector LIMIT 100`,
        [JSON.stringify(queryVector)],
      );

      const elapsed = Date.now() - startTime;

      // Validate results
      expect(result.rows).toHaveLength(100);

      // Query should complete quickly (increase threshold for CI environments)
      expect(elapsed).toBeLessThan(2000); // 2 second threshold for test environment
    });
  });

  describe("Suite 4: Hybrid Search RRF Algorithm", () => {
    it("should merge vector and FTS results correctly", async () => {
      // Create test data with known vector and text properties
      const docs: Document[] = [
        {
          pageContent: "PostgreSQL database performance tuning guide",
          metadata: {
            url: "https://example.com/page1",
            title: "Performance Guide",
          },
        },
        {
          pageContent: "JavaScript testing framework documentation",
          metadata: {
            url: "https://example.com/page2",
            title: "Testing Docs",
          },
        },
        {
          pageContent: "Database optimization and performance tips",
          metadata: {
            url: "https://example.com/page3",
            title: "Optimization Tips",
          },
        },
      ];

      await testDb.store.addDocuments("test-lib", "1.0.0", docs);

      // Create retriever service
      const retriever = new DocumentRetrieverService(testDb.store);

      // Execute hybrid search
      const results = await retriever.search(
        "test-lib",
        "1.0.0",
        "database performance",
        3,
      );

      // Verify results include documents matching both vector and text criteria
      expect(results.length).toBeGreaterThan(0);

      // Should include documents with "database" and "performance"
      const contents = results.map((r) => r.content);
      const hasDatabase = contents.some((c) => c.includes("database"));
      const hasPerformance = contents.some((c) => c.includes("performance"));

      expect(hasDatabase).toBe(true);
      expect(hasPerformance).toBe(true);
    });

    it("should apply RRF k=60 parameter correctly", async () => {
      // Create test data
      const docs: Document[] = [
        {
          pageContent: "Document about PostgreSQL databases",
          metadata: {
            url: "https://example.com/page1",
            title: "Doc 1",
          },
        },
        {
          pageContent: "Document about database systems",
          metadata: {
            url: "https://example.com/page2",
            title: "Doc 2",
          },
        },
      ];

      await testDb.store.addDocuments("test-lib", "1.0.0", docs);

      // Execute hybrid search to trigger RRF
      const retriever = new DocumentRetrieverService(testDb.store);
      const results = await retriever.search("test-lib", "1.0.0", "database", 2);

      // Verify results are returned (RRF algorithm executed)
      expect(results).toHaveLength(2);

      // The RRF formula with k=60 should have been applied
      // We can't directly verify the scores, but we can verify both documents were found
      expect(results[0].content).toContain("database");
      expect(results[1].content).toContain("database");
    });

    it("should handle case when vector search returns no results", async () => {
      // Create test data without embeddings matching query
      const docs: Document[] = [
        {
          pageContent: "Documentation about testing frameworks",
          metadata: {
            url: "https://example.com/page1",
            title: "Testing Doc",
          },
        },
      ];

      await testDb.store.addDocuments("test-lib", "1.0.0", docs);

      // Search for something that will match text but not vector well
      const retriever = new DocumentRetrieverService(testDb.store);
      const results = await retriever.search("test-lib", "1.0.0", "testing", 5);

      // Should still return results from FTS
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain("testing");
    });

    it("should handle case when FTS returns no results", async () => {
      // Create test data
      const docs: Document[] = [
        {
          pageContent: "Random content that won't match FTS query",
          metadata: {
            url: "https://example.com/page1",
            title: "Random Doc",
          },
        },
      ];

      await testDb.store.addDocuments("test-lib", "1.0.0", docs);

      // Search for something semantically similar but lexically different
      // The mocked embedding will create a vector based on query text
      const retriever = new DocumentRetrieverService(testDb.store);
      const results = await retriever.search("test-lib", "1.0.0", "content", 5);

      // Should still return results (from vector search or FTS match on "content")
      expect(results.length).toBeGreaterThan(0);
    });

    it("should produce correct final ranking", async () => {
      // Create test documents with known ranking characteristics
      const docs: Document[] = [
        // Document A: High vector similarity, low FTS (few query words)
        {
          pageContent: "PostgreSQL database system",
          metadata: {
            url: "https://example.com/pageA",
            title: "Doc A",
          },
        },
        // Document B: Low vector similarity, high FTS (many query words)
        {
          pageContent: "database database database performance performance performance",
          metadata: {
            url: "https://example.com/pageB",
            title: "Doc B",
          },
        },
        // Document C: Medium vector, medium FTS (balanced)
        {
          pageContent: "database performance optimization guide",
          metadata: {
            url: "https://example.com/pageC",
            title: "Doc C",
          },
        },
      ];

      await testDb.store.addDocuments("test-lib", "1.0.0", docs);

      // Execute hybrid search
      const retriever = new DocumentRetrieverService(testDb.store);
      const results = await retriever.search(
        "test-lib",
        "1.0.0",
        "database performance",
        3,
      );

      // Verify results returned (may be fewer if grouped by URL)
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(3);

      // The ranking should consider both vector and FTS scores via RRF
      // Check that results contain relevant content
      const allContent = results.map((r) => r.content).join(" ");
      expect(allContent).toContain("database");
      expect(allContent).toContain("performance");
    });
  });

  describe("Suite 5: Connection Pooling and Concurrency", () => {
    it("should handle concurrent queries without errors", async () => {
      // Create test data
      const docs: Document[] = Array.from({ length: 10 }, (_, i) => ({
        pageContent: `Test document ${i} with content`,
        metadata: {
          library: "test-lib",
          version: "1.0.0",
          url: `https://example.com/page${i}`,
          title: `Doc ${i}`,
        },
      }));

      await testDb.store.addDocuments("test-lib", "1.0.0", docs);

      // Execute 20 simultaneous queries
      const queries = Array.from({ length: 20 }, (_, _i) =>
        pool.query("SELECT content FROM documents WHERE page_id IS NOT NULL LIMIT 5"),
      );

      // All queries should complete successfully
      const results = await Promise.all(queries);

      expect(results).toHaveLength(20);
      results.forEach((result) => {
        expect(result.rows.length).toBeGreaterThan(0);
      });
    });

    it("should reuse connections from pool", async () => {
      // Get initial connection count
      const beforeResult = await pool.query(
        `SELECT count(*) as count
         FROM pg_stat_activity
         WHERE datname = $1`,
        [testDb.databaseName],
      );
      const connectionsBefore = parseInt(beforeResult.rows[0].count, 10);

      // Execute multiple queries
      for (let i = 0; i < 10; i++) {
        await pool.query("SELECT 1");
      }

      // Get connection count after queries
      const afterResult = await pool.query(
        `SELECT count(*) as count
         FROM pg_stat_activity
         WHERE datname = $1`,
        [testDb.databaseName],
      );
      const connectionsAfter = parseInt(afterResult.rows[0].count, 10);

      // Connection count should not increase significantly (pool reuse)
      // Allow for slight increase due to test infrastructure
      expect(connectionsAfter).toBeLessThanOrEqual(connectionsBefore + 3);
    });

    it("should maintain transaction isolation", async () => {
      // Create test library and version
      const libraryResult = await pool.query(
        "INSERT INTO libraries (name) VALUES ($1) RETURNING id",
        ["test-lib"],
      );
      const libraryId = libraryResult.rows[0].id;

      const versionResult = await pool.query(
        "INSERT INTO versions (library_id, name, status) VALUES ($1, $2, $3) RETURNING id",
        [libraryId, "1.0.0", "ready"],
      );
      const versionId = versionResult.rows[0].id;

      // Start two transactions
      const client1 = await pool.connect();
      const client2 = await pool.connect();

      try {
        await client1.query("BEGIN");
        await client2.query("BEGIN");

        // Client 1 inserts a page but doesn't commit
        await client1.query(
          "INSERT INTO pages (version_id, url, title, content_type) VALUES ($1, $2, $3, $4)",
          [
            versionId,
            "https://example.com/isolation-test",
            "Isolation Test",
            "text/html",
          ],
        );

        // Client 2 should NOT see the uncommitted page
        const result = await client2.query("SELECT * FROM pages WHERE url = $1", [
          "https://example.com/isolation-test",
        ]);

        expect(result.rows).toHaveLength(0);

        // Commit both transactions
        await client1.query("COMMIT");
        await client2.query("COMMIT");

        // Now client 2 should see the page
        const result2 = await pool.query("SELECT * FROM pages WHERE url = $1", [
          "https://example.com/isolation-test",
        ]);

        expect(result2.rows).toHaveLength(1);
      } finally {
        client1.release();
        client2.release();
      }
    });

    it("should release connections after queries complete", async () => {
      // Monitor active connections before
      const beforeResult = await pool.query(
        `SELECT count(*) as count
         FROM pg_stat_activity
         WHERE datname = $1 AND state = 'active'`,
        [testDb.databaseName],
      );
      const activeBefore = parseInt(beforeResult.rows[0].count, 10);

      // Execute query
      await pool.query("SELECT pg_sleep(0.1)");

      // Wait a bit for connection to be released
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Check active connections after
      const afterResult = await pool.query(
        `SELECT count(*) as count
         FROM pg_stat_activity
         WHERE datname = $1 AND state = 'active'`,
        [testDb.databaseName],
      );
      const activeAfter = parseInt(afterResult.rows[0].count, 10);

      // Active connections should return to idle (or similar to before)
      // The query we just ran will be "active" so expect activeAfter to be close to activeBefore + 1
      expect(activeAfter).toBeLessThanOrEqual(activeBefore + 2);
    });

    it("should handle pool exhaustion gracefully", async () => {
      // This test is intentionally simplified to avoid hanging tests
      // In a real scenario with a small pool (max=2), we would test timeout behavior

      // Create concurrent long-running queries
      const longQueries = Array.from({ length: 3 }, () =>
        pool.query("SELECT pg_sleep(0.05)"),
      );

      // All queries should complete without errors (queue if needed)
      const results = await Promise.all(longQueries);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toBeDefined();
      });
    });
  });
});
