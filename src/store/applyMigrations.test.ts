// Integration test for database migrations using PostgreSQL with pgvector

import { Pool, type PoolClient } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "./applyMigrations";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5433/postgres";

interface TestSchema {
  schemaName: string;
  pool: Pool;
  cleanup: () => Promise<void>;
}

/**
 * Creates an isolated PostgreSQL schema for testing.
 * Each test gets its own schema to prevent interference.
 */
async function createTestSchema(): Promise<TestSchema> {
  const schemaName = `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // Step 1: Create the schema
  const setupPool = new Pool({ connectionString: TEST_DATABASE_URL });
  const setupClient = await setupPool.connect();

  try {
    await setupClient.query(`CREATE SCHEMA ${schemaName}`);
  } finally {
    setupClient.release();
    await setupPool.end();
  }

  // Step 2: Create pool with isolated schema
  const pool = new Pool({
    connectionString: TEST_DATABASE_URL,
    options: `-c search_path=${schemaName},public`,
  });

  // Step 3: Define cleanup
  const cleanup = async () => {
    await pool.end();

    const cleanupPool = new Pool({ connectionString: TEST_DATABASE_URL });
    const cleanupClient = await cleanupPool.connect();

    try {
      await cleanupClient.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
    } finally {
      cleanupClient.release();
      await cleanupPool.end();
    }
  };

  return { schemaName, pool, cleanup };
}

describe("Database Migrations", () => {
  let testSchema: TestSchema;
  let pool: Pool;

  beforeEach(async () => {
    testSchema = await createTestSchema();
    pool = testSchema.pool;
  });

  afterEach(async () => {
    await testSchema.cleanup();
  });

  it("should apply all migrations and create expected tables and columns", async () => {
    // Apply migrations
    await expect(applyMigrations(pool)).resolves.not.toThrow();

    const client = await pool.connect();
    try {
      // Check tables exist
      const tablesResult = await client.query(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = $1
         ORDER BY table_name`,
        [testSchema.schemaName],
      );
      const tableNames = tablesResult.rows.map((r) => r.table_name);

      expect(tableNames).toContain("documents");
      expect(tableNames).toContain("libraries");
      expect(tableNames).toContain("pages");
      expect(tableNames).toContain("versions");

      // Check documents table columns
      const documentsColumnsResult = await client.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = 'documents'
         ORDER BY column_name`,
        [testSchema.schemaName],
      );
      const documentsColumnNames = documentsColumnsResult.rows.map((r) => r.column_name);

      expect(documentsColumnNames).toEqual(
        expect.arrayContaining([
          "id",
          "page_id",
          "content",
          "metadata",
          "sort_order",
          "embedding",
          "indexed_at",
        ]),
      );

      // Ensure old denormalized columns are not present
      expect(documentsColumnNames).not.toContain("library");
      expect(documentsColumnNames).not.toContain("version");
      expect(documentsColumnNames).not.toContain("library_id");
      expect(documentsColumnNames).not.toContain("version_id");
      expect(documentsColumnNames).not.toContain("url");

      // Check pages table columns
      const pagesColumnsResult = await client.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = 'pages'
         ORDER BY column_name`,
        [testSchema.schemaName],
      );
      const pagesColumnNames = pagesColumnsResult.rows.map((r) => r.column_name);

      expect(pagesColumnNames).toEqual(
        expect.arrayContaining([
          "id",
          "version_id",
          "url",
          "title",
          "etag",
          "last_modified",
          "content_type",
          "created_at",
        ]),
      );

      // Check libraries table columns
      const librariesColumnsResult = await client.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = 'libraries'
         ORDER BY column_name`,
        [testSchema.schemaName],
      );
      const librariesColumnNames = librariesColumnsResult.rows.map((r) => r.column_name);

      expect(librariesColumnNames).toEqual(
        expect.arrayContaining(["id", "name", "created_at"]),
      );

      // Check versions table columns
      const versionsColumnsResult = await client.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = 'versions'
         ORDER BY column_name`,
        [testSchema.schemaName],
      );
      const versionsColumnNames = versionsColumnsResult.rows.map((r) => r.column_name);

      expect(versionsColumnNames).toEqual(
        expect.arrayContaining([
          "id",
          "library_id",
          "name",
          "status",
          "created_at",
          "updated_at",
        ]),
      );

      // Check pgvector extension is installed
      const extensionsResult = await client.query(
        `SELECT extname
         FROM pg_extension
         WHERE extname = 'vector'`,
      );
      expect(extensionsResult.rows).toHaveLength(1);
      expect(extensionsResult.rows[0].extname).toBe("vector");

      // Check GIN index for FTS exists
      const ginIndexResult = await client.query(
        `SELECT indexname
         FROM pg_indexes
         WHERE schemaname = $1 AND indexname = 'idx_documents_content_fts'`,
        [testSchema.schemaName],
      );
      expect(ginIndexResult.rows).toHaveLength(1);

      // Check HNSW index for vector search exists
      const hnswIndexResult = await client.query(
        `SELECT indexname
         FROM pg_indexes
         WHERE schemaname = $1 AND indexname = 'idx_documents_embedding_hnsw'`,
        [testSchema.schemaName],
      );
      expect(hnswIndexResult.rows).toHaveLength(1);
    } finally {
      client.release();
    }
  });

  it("should handle vector search with empty results gracefully", async () => {
    // Apply migrations
    await applyMigrations(pool);

    const client = await pool.connect();
    try {
      // Insert library but no documents
      const libraryResult = await client.query(
        "INSERT INTO libraries (name) VALUES ($1) RETURNING id",
        ["empty-lib"],
      );
      const libraryId = libraryResult.rows[0].id;

      // Insert version
      const versionResult = await client.query(
        "INSERT INTO versions (library_id, name, status) VALUES ($1, $2, 'completed') RETURNING id",
        [libraryId, "1.0.0"],
      );
      const versionId = versionResult.rows[0].id;

      // Search for vectors in empty library
      const searchVector = new Array(1536).fill(0.5);
      const searchResult = await client.query(
        `SELECT d.id, d.content, 1 - (d.embedding <=> $1::vector) as similarity
         FROM documents d
         INNER JOIN pages p ON d.page_id = p.id
         INNER JOIN versions v ON p.version_id = v.id
         INNER JOIN libraries l ON v.library_id = l.id
         WHERE l.name = $2 AND v.name = $3 AND d.embedding IS NOT NULL
         ORDER BY d.embedding <=> $1::vector
         LIMIT 5`,
        [`[${searchVector.join(",")}]`, "empty-lib", "1.0.0"],
      );

      // Should return empty array, not throw
      expect(searchResult.rows).toEqual([]);
    } finally {
      client.release();
    }
  });

  it("should perform vector search and return similar vectors correctly", async () => {
    // Apply migrations
    await applyMigrations(pool);

    const client = await pool.connect();
    try {
      // Insert test library and version
      const libraryResult = await client.query(
        "INSERT INTO libraries (name) VALUES ($1) RETURNING id",
        ["test-lib"],
      );
      const libraryId = libraryResult.rows[0].id;

      const versionResult = await client.query(
        "INSERT INTO versions (library_id, name, status) VALUES ($1, $2, 'completed') RETURNING id",
        [libraryId, "1.0.0"],
      );
      const versionId = versionResult.rows[0].id;

      // Insert test pages
      const page1Result = await client.query(
        `INSERT INTO pages (version_id, url, title, content_type)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [versionId, "https://example.com/doc1", "AI Basics", "text/html"],
      );
      const page1Id = page1Result.rows[0].id;

      const page2Result = await client.query(
        `INSERT INTO pages (version_id, url, title, content_type)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [versionId, "https://example.com/doc2", "Neural Networks", "text/html"],
      );
      const page2Id = page2Result.rows[0].id;

      const page3Result = await client.query(
        `INSERT INTO pages (version_id, url, title, content_type)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [versionId, "https://example.com/doc3", "Cooking Guide", "text/html"],
      );
      const page3Id = page3Result.rows[0].id;

      // Create test vectors (similar vectors for AI-related docs, different for cooking)
      const aiVector1 = new Array(1536)
        .fill(0)
        .map((_, i) => (i < 100 ? Math.random() * 0.1 + 0.8 : Math.random() * 0.2));
      const aiVector2 = new Array(1536)
        .fill(0)
        .map((_, i) => (i < 100 ? Math.random() * 0.1 + 0.75 : Math.random() * 0.2));
      const cookingVector = new Array(1536)
        .fill(0)
        .map((_, i) =>
          i >= 100 && i < 200 ? Math.random() * 0.1 + 0.9 : Math.random() * 0.2,
        );

      // Insert documents with embeddings
      await client.query(
        `INSERT INTO documents (page_id, content, metadata, sort_order, embedding)
         VALUES ($1, $2, $3, $4, $5::vector)`,
        [
          page1Id,
          "This is about machine learning and artificial intelligence",
          JSON.stringify({ title: "AI Basics", path: "/ai-basics" }),
          1,
          `[${aiVector1.join(",")}]`,
        ],
      );

      await client.query(
        `INSERT INTO documents (page_id, content, metadata, sort_order, embedding)
         VALUES ($1, $2, $3, $4, $5::vector)`,
        [
          page2Id,
          "This document discusses neural networks and deep learning",
          JSON.stringify({ title: "Neural Networks", path: "/neural-networks" }),
          2,
          `[${aiVector2.join(",")}]`,
        ],
      );

      await client.query(
        `INSERT INTO documents (page_id, content, metadata, sort_order, embedding)
         VALUES ($1, $2, $3, $4, $5::vector)`,
        [
          page3Id,
          "Cooking recipes and food preparation techniques",
          JSON.stringify({ title: "Cooking Guide", path: "/cooking" }),
          3,
          `[${cookingVector.join(",")}]`,
        ],
      );

      // Search with a vector similar to AI vectors
      const searchVector = new Array(1536)
        .fill(0)
        .map((_, i) => (i < 100 ? Math.random() * 0.1 + 0.77 : Math.random() * 0.2));

      interface VectorSearchResult {
        id: number;
        content: string;
        distance: number;
      }

      const searchResult = await client.query(
        `SELECT d.id, d.content, d.embedding <=> $1::vector as distance
         FROM documents d
         INNER JOIN pages p ON d.page_id = p.id
         INNER JOIN versions v ON p.version_id = v.id
         INNER JOIN libraries l ON v.library_id = l.id
         WHERE l.name = $2 AND v.name = $3 AND d.embedding IS NOT NULL
         ORDER BY d.embedding <=> $1::vector
         LIMIT 3`,
        [`[${searchVector.join(",")}]`, "test-lib", "1.0.0"],
      );

      const searchResults = searchResult.rows as VectorSearchResult[];

      // Should return 3 results ordered by similarity
      expect(searchResults).toHaveLength(3);

      // Results should be ordered by distance (most similar first = lowest distance)
      expect(searchResults[0].distance).toBeLessThan(searchResults[1].distance);
      expect(searchResults[1].distance).toBeLessThan(searchResults[2].distance);

      // AI-related documents should be more similar (lower distance) than cooking
      const aiResults = searchResults.filter(
        (r) =>
          r.content.includes("machine learning") || r.content.includes("neural networks"),
      );
      const cookingResults = searchResults.filter(
        (r) => r.content.includes("cooking") || r.content.includes("recipes"),
      );

      expect(aiResults).toHaveLength(2);
      expect(cookingResults).toHaveLength(1);

      // AI documents should have lower distances than cooking document
      const maxAiDistance = Math.max(...aiResults.map((r) => r.distance));
      const cookingDistance = cookingResults[0].distance;
      expect(maxAiDistance).toBeLessThan(cookingDistance);

      // Validate distance behavior: pgvector cosine distance
      // - Distance 0 = identical vectors (closest match)
      // - Distance 2 = opposite vectors (farthest match)
      // - Lower distances = more similar
      for (const result of searchResults) {
        expect(result.distance).toBeGreaterThanOrEqual(0);
        expect(result.distance).toBeLessThan(2);
      }

      // Test identical vector search
      const identicalSearchResult = await client.query(
        `SELECT d.id, d.content, d.embedding <=> $1::vector as distance
         FROM documents d
         INNER JOIN pages p ON d.page_id = p.id
         INNER JOIN versions v ON p.version_id = v.id
         INNER JOIN libraries l ON v.library_id = l.id
         WHERE l.name = $2 AND v.name = $3 AND d.embedding IS NOT NULL
         ORDER BY d.embedding <=> $1::vector
         LIMIT 3`,
        [`[${aiVector1.join(",")}]`, "test-lib", "1.0.0"],
      );

      const identicalResults = identicalSearchResult.rows as VectorSearchResult[];
      expect(identicalResults).toHaveLength(3);

      // Find exact match (should be doc1)
      const exactMatch = identicalResults.find((r) =>
        r.content.includes("machine learning"),
      );
      expect(exactMatch).toBeDefined();
      expect(exactMatch!.distance).toBeCloseTo(0, 6);
    } finally {
      client.release();
    }
  });

  it("should perform FTS search and return relevant text matches correctly", async () => {
    // Apply migrations
    await applyMigrations(pool);

    const client = await pool.connect();
    try {
      // Insert test library and version
      const libraryResult = await client.query(
        "INSERT INTO libraries (name) VALUES ($1) RETURNING id",
        ["docs-lib"],
      );
      const libraryId = libraryResult.rows[0].id;

      const versionResult = await client.query(
        "INSERT INTO versions (library_id, name, status) VALUES ($1, $2, 'completed') RETURNING id",
        [libraryId, "1.0.0"],
      );
      const versionId = versionResult.rows[0].id;

      // Insert test pages
      const reactPageResult = await client.query(
        `INSERT INTO pages (version_id, url, title, content_type)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [versionId, "https://example.com/react-hooks", "React Hooks Guide", "text/html"],
      );
      const reactPageId = reactPageResult.rows[0].id;

      const vuePageResult = await client.query(
        `INSERT INTO pages (version_id, url, title, content_type)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [
          versionId,
          "https://example.com/vue-composition",
          "Vue Composition API",
          "text/html",
        ],
      );
      const vuePageId = vuePageResult.rows[0].id;

      const angularPageResult = await client.query(
        `INSERT INTO pages (version_id, url, title, content_type)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [
          versionId,
          "https://example.com/angular-services",
          "Angular Services",
          "text/html",
        ],
      );
      const angularPageId = angularPageResult.rows[0].id;

      const dbPageResult = await client.query(
        `INSERT INTO pages (version_id, url, title, content_type)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [
          versionId,
          "https://example.com/database-design",
          "Database Design",
          "text/html",
        ],
      );
      const dbPageId = dbPageResult.rows[0].id;

      // Insert test documents with diverse content
      await client.query(
        `INSERT INTO documents (page_id, content, metadata, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [
          reactPageId,
          "React hooks are a powerful feature that allows you to use state and lifecycle methods in functional components. The useState hook manages component state.",
          JSON.stringify({ title: "React Hooks Guide", path: "/react/hooks" }),
          1,
        ],
      );

      await client.query(
        `INSERT INTO documents (page_id, content, metadata, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [
          vuePageId,
          "Vue composition API provides a way to organize component logic. It offers reactive state management and computed properties for building dynamic applications.",
          JSON.stringify({ title: "Vue Composition API", path: "/vue/composition" }),
          2,
        ],
      );

      await client.query(
        `INSERT INTO documents (page_id, content, metadata, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [
          angularPageId,
          "Angular services are singleton objects that provide functionality across the application. Dependency injection makes services available to components.",
          JSON.stringify({ title: "Angular Services", path: "/angular/services" }),
          3,
        ],
      );

      await client.query(
        `INSERT INTO documents (page_id, content, metadata, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [
          dbPageId,
          "Database normalization reduces redundancy and improves data integrity. Primary keys uniquely identify records in relational databases.",
          JSON.stringify({ title: "Database Design", path: "/database/design" }),
          4,
        ],
      );

      interface FTSSearchResult {
        id: number;
        content: string;
        title: string;
        url: string;
        path: string;
        rank: number;
      }

      // Test 1: Search for React-specific content
      const reactSearchResult = await client.query(
        `SELECT
           d.id,
           d.content,
           (d.metadata::json)->>'title' as title,
           p.url,
           (d.metadata::json)->>'path' as path,
           ts_rank(to_tsvector('english', d.content), plainto_tsquery('english', $1)) as rank
         FROM documents d
         INNER JOIN pages p ON d.page_id = p.id
         INNER JOIN versions v ON p.version_id = v.id
         INNER JOIN libraries l ON v.library_id = l.id
         WHERE to_tsvector('english', d.content) @@ plainto_tsquery('english', $1)
           AND l.name = $2 AND v.name = $3
         ORDER BY rank DESC`,
        ["react hooks", "docs-lib", "1.0.0"],
      );

      const reactResults = reactSearchResult.rows as FTSSearchResult[];
      expect(reactResults).toHaveLength(1);
      expect(reactResults[0].content).toContain("React hooks");
      expect(reactResults[0].title).toBe("React Hooks Guide");

      // Test 2: Search for state management across frameworks
      const stateSearchResult = await client.query(
        `SELECT
           d.id,
           d.content,
           (d.metadata::json)->>'title' as title,
           p.url,
           (d.metadata::json)->>'path' as path,
           ts_rank(to_tsvector('english', d.content), plainto_tsquery('english', $1)) as rank
         FROM documents d
         INNER JOIN pages p ON d.page_id = p.id
         INNER JOIN versions v ON p.version_id = v.id
         INNER JOIN libraries l ON v.library_id = l.id
         WHERE to_tsvector('english', d.content) @@ plainto_tsquery('english', $1)
           AND l.name = $2 AND v.name = $3
         ORDER BY rank DESC`,
        ["state", "docs-lib", "1.0.0"],
      );

      const stateResults = stateSearchResult.rows as FTSSearchResult[];
      expect(stateResults.length).toBeGreaterThanOrEqual(2);

      // Should find both React and Vue content
      const contentTexts = stateResults.map((r) => r.content);
      const hasReactState = contentTexts.some((content) => content.includes("useState"));
      const hasVueState = contentTexts.some((content) =>
        content.includes("reactive state"),
      );
      expect(hasReactState || hasVueState).toBe(true);

      // Test 3: Search with phrase matching (dependency injection)
      const phraseSearchResult = await client.query(
        `SELECT
           d.id,
           d.content,
           (d.metadata::json)->>'title' as title,
           p.url,
           (d.metadata::json)->>'path' as path,
           ts_rank(to_tsvector('english', d.content), plainto_tsquery('english', $1)) as rank
         FROM documents d
         INNER JOIN pages p ON d.page_id = p.id
         INNER JOIN versions v ON p.version_id = v.id
         INNER JOIN libraries l ON v.library_id = l.id
         WHERE to_tsvector('english', d.content) @@ plainto_tsquery('english', $1)
           AND l.name = $2 AND v.name = $3
         ORDER BY rank DESC`,
        ["dependency injection", "docs-lib", "1.0.0"],
      );

      const phraseResults = phraseSearchResult.rows as FTSSearchResult[];
      expect(phraseResults).toHaveLength(1);
      expect(phraseResults[0].content).toContain("Dependency injection");
      expect(phraseResults[0].title).toBe("Angular Services");

      // Test 4: Test empty search results
      const emptySearchResult = await client.query(
        `SELECT d.id, d.content
         FROM documents d
         INNER JOIN pages p ON d.page_id = p.id
         INNER JOIN versions v ON p.version_id = v.id
         INNER JOIN libraries l ON v.library_id = l.id
         WHERE to_tsvector('english', d.content) @@ plainto_tsquery('english', $1)
           AND l.name = $2 AND v.name = $3`,
        ["nonexistent term xyz", "docs-lib", "1.0.0"],
      );

      expect(emptySearchResult.rows).toHaveLength(0);

      // Test 5: Test ranking (higher rank = more relevant in PostgreSQL)
      const componentSearchResult = await client.query(
        `SELECT
           d.id,
           d.content,
           ts_rank(to_tsvector('english', d.content), plainto_tsquery('english', $1)) as rank
         FROM documents d
         INNER JOIN pages p ON d.page_id = p.id
         INNER JOIN versions v ON p.version_id = v.id
         INNER JOIN libraries l ON v.library_id = l.id
         WHERE to_tsvector('english', d.content) @@ plainto_tsquery('english', $1)
           AND l.name = $2 AND v.name = $3
         ORDER BY rank DESC`,
        ["component", "docs-lib", "1.0.0"],
      );

      const componentResults = componentSearchResult.rows as Array<{
        id: number;
        content: string;
        rank: number;
      }>;

      if (componentResults.length > 1) {
        // PostgreSQL ts_rank: Higher scores = better matches (OPPOSITE of SQLite BM25)
        // Results are ordered DESC, so each subsequent result should have lower or equal rank
        for (let i = 1; i < componentResults.length; i++) {
          expect(componentResults[i].rank).toBeLessThanOrEqual(
            componentResults[i - 1].rank,
          );
        }
      }

      // Test 6: Validate ts_rank scoring behavior
      // PostgreSQL ts_rank returns higher scores for better matches
      for (const result of componentResults) {
        expect(result.rank).toBeGreaterThan(0); // ts_rank returns positive values
        expect(result.rank).toBeLessThan(1); // Typically normalized between 0-1
      }
    } finally {
      client.release();
    }
  });
});
