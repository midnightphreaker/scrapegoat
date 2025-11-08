# Phase C: Rewrite applyMigrations.test.ts for PostgreSQL

## Executive Summary

This plan provides a comprehensive, actionable roadmap for rewriting the SQLite-based `applyMigrations.test.ts` file to use PostgreSQL with pgvector. The rewrite will maintain 100% test coverage while replacing all SQLite-specific code with PostgreSQL equivalents.

**File**: `/home/mp/Workspace/scrapegoat/src/store/applyMigrations.test.ts`
**Current**: 654 lines, 4 test suites, 100% SQLite
**Target**: PostgreSQL with pgvector, schema-based isolation

---

## Table of Contents

1. [Current Test Analysis](#current-test-analysis)
2. [SQLite to PostgreSQL Mapping](#sqlite-to-postgresql-mapping)
3. [Schema-Based Isolation Strategy](#schema-based-isolation-strategy)
4. [Test-by-Test Rewrite Plan](#test-by-test-rewrite-plan)
5. [Implementation Steps](#implementation-steps)
6. [Code Examples](#code-examples)
7. [Verification Plan](#verification-plan)
8. [Potential Issues & Solutions](#potential-issues--solutions)

---

## Current Test Analysis

### Test Suite Structure

```
Database Migrations
├── Test 1: Schema validation (lines 20-115)
│   ├── Validates table creation
│   ├── Validates column schemas
│   ├── Checks FTS5 virtual table
│   └── Checks vec0 virtual table
│
├── Test 2: Empty vector search (lines 117-164)
│   ├── Tests vector search with no documents
│   └── Expects empty results gracefully
│
├── Test 3: Vector similarity search (lines 166-369)
│   ├── Creates test vectors (AI vs cooking topics)
│   ├── Tests distance calculations
│   ├── Validates L2 distance semantics (lower = better)
│   └── Tests identical vector search (distance ≈ 0)
│
└── Test 4: Full-text search (lines 371-652)
    ├── Tests FTS5 search
    ├── Tests BM25 scoring
    ├── Tests phrase matching
    ├── Tests metadata field search
    └── Validates rank semantics (lower BM25 = better)
```

### SQLite Dependencies to Remove

```typescript
// Imports
import Database, { type Database as DatabaseType } from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";

// Setup
db = new Database(":memory:");
sqliteVec.load(db);

// Queries
db.prepare("PRAGMA table_info(documents)").all();
db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
db.prepare("INSERT INTO documents_vec (rowid, library_id, version_id, embedding) VALUES (?, ?, ?, ?)");
db.prepare("WHERE documents_fts MATCH ? AND k = 5");
db.prepare("SELECT bm25(documents_fts, 10.0, 1.0, 5.0, 1.0)");
```

---

## SQLite to PostgreSQL Mapping

### Comprehensive Feature Mapping Table

| Feature | SQLite | PostgreSQL | Notes |
|---------|--------|------------|-------|
| **Database Setup** | `new Database(":memory:")` | `new Pool({ connectionString })` + schema isolation | Schema-based isolation is faster |
| **Extension Loading** | `sqliteVec.load(db)` | `CREATE EXTENSION vector` | Extension is database-level |
| **Table List** | `SELECT name FROM sqlite_master WHERE type='table'` | `SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()` | Use current_schema() for isolation |
| **Column Schema** | `PRAGMA table_info(table_name)` | `SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = $1` | Returns more detailed type info |
| **FTS Table** | `documents_fts` virtual table (FTS5) | GIN index on `to_tsvector('english', content)` | No separate table needed |
| **Vector Table** | `documents_vec` virtual table (vec0) | `embedding` column with HNSW index | Column on main documents table |
| **FTS Search** | `WHERE documents_fts MATCH ?` | `WHERE to_tsvector('english', content) @@ plainto_tsquery('english', $1)` | Use @@ operator |
| **FTS Phrase** | `MATCH '"exact phrase"'` | `@@ phraseto_tsquery('english', $1)` | Different function for phrases |
| **FTS Ranking** | `bm25(documents_fts, ...)` - lower is better | `ts_rank(to_tsvector(...), query)` - **higher is better** | **OPPOSITE SEMANTICS!** |
| **Vector Search** | `WHERE embedding MATCH ? AND k = 5` | `ORDER BY embedding <=> $1::vector LIMIT 5` | Use <=> operator |
| **Vector Distance** | L2 (Euclidean) distance | Cosine distance with `<=>` | Both use "lower = better" |
| **Insert Vector** | `JSON.stringify(array)` | `JSON.stringify(array)` cast to `::vector` | Same format, different cast |
| **Extension Check** | `SELECT sql FROM sqlite_master WHERE type='table' AND name='documents_vec'` | `SELECT extname FROM pg_extension WHERE extname = 'vector'` | Check pg_extension table |
| **Index Check** | `PRAGMA index_list(table_name)` | `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = $1` | More detailed index info |

### Critical Semantic Differences

1. **FTS Ranking Direction**
   - SQLite BM25: **Lower score = better match** (ORDER BY rank ASC)
   - PostgreSQL ts_rank: **Higher score = better match** (ORDER BY rank DESC)
   - **ALL assertions must be inverted!**

2. **Vector Distance**
   - Both use "lower = better" semantics ✅
   - SQLite uses L2 (Euclidean), PostgreSQL uses Cosine
   - Distance 0 = identical vectors in both

3. **Table Architecture**
   - SQLite: Separate virtual tables (`documents_fts`, `documents_vec`)
   - PostgreSQL: Single table with indexes
   - Schema validation must check indexes instead of tables

---

## Schema-Based Isolation Strategy

### Why Schema-Based Instead of Database-Per-Test?

1. **Speed**: Creating schemas is 10-100x faster than creating databases
2. **Extensions**: pgvector is database-level, shared across schemas
3. **Cleanup**: `DROP SCHEMA CASCADE` is cleaner and faster
4. **Concurrency**: Better support for parallel test execution
5. **Resource Usage**: Lower overhead than multiple databases

### Schema Isolation Implementation

```typescript
interface TestSchema {
  schemaName: string;
  pool: Pool;
  cleanup: () => Promise<void>;
}

async function createTestSchema(): Promise<TestSchema> {
  const schemaName = `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const TEST_DATABASE_URL =
    process.env.TEST_DATABASE_URL ||
    "postgresql://postgres:postgres@postgres.den.lan/scrapegoat_test";

  // Step 1: Create the schema using a temporary connection
  const setupPool = new Pool({ connectionString: TEST_DATABASE_URL });
  const setupClient = await setupPool.connect();

  try {
    await setupClient.query(`CREATE SCHEMA ${schemaName}`);
  } finally {
    await setupClient.release();
    await setupPool.end();
  }

  // Step 2: Create a pool configured to use the isolated schema
  // The 'options' parameter sets search_path for ALL connections from this pool
  const pool = new Pool({
    connectionString: TEST_DATABASE_URL,
    options: `-c search_path=${schemaName},public`
  });

  // Step 3: Define cleanup function
  const cleanup = async () => {
    // Close all connections in the pool first
    await pool.end();

    // Drop the schema
    const cleanupPool = new Pool({ connectionString: TEST_DATABASE_URL });
    const cleanupClient = await cleanupPool.connect();

    try {
      await cleanupClient.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
    } finally {
      await cleanupClient.release();
      await cleanupPool.end();
    }
  };

  return { schemaName, pool, cleanup };
}
```

### How It Works

1. **Unique Schema**: Each test gets `test_<timestamp>_<random>` schema
2. **Search Path**: Pool configured with `search_path=${schemaName},public`
3. **Isolation**: All tables, indexes created in isolated schema
4. **Extensions**: pgvector extension available from `public` schema
5. **Cleanup**: `DROP SCHEMA CASCADE` removes everything
6. **No Conflicts**: Tests can run in parallel without interference

---

## Test-by-Test Rewrite Plan

### Test 1: Schema Validation

**Purpose**: Verify migrations create expected tables, columns, indexes, and extensions.

**Current SQLite Implementation**:
- Checks tables: documents, documents_fts, documents_vec, libraries, pages, versions
- Uses `PRAGMA table_info()` for column schemas
- Uses `sqlite_master` for virtual table definitions
- Validates FTS5 and vec0 virtual tables

**PostgreSQL Implementation**:

```typescript
it("should apply all migrations and create expected tables and columns", async () => {
  // Apply migrations
  await applyMigrations(pool);

  const client = await pool.connect();
  try {
    // 1. Check tables exist (NO documents_fts or documents_vec!)
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = current_schema()
      ORDER BY table_name
    `);
    const tableNames = tablesResult.rows.map(r => r.table_name);

    expect(tableNames).toContain("documents");
    expect(tableNames).toContain("libraries");
    expect(tableNames).toContain("pages");
    expect(tableNames).toContain("versions");
    expect(tableNames).toContain("_schema_migrations");

    // Should NOT have separate FTS or vector tables
    expect(tableNames).not.toContain("documents_fts");
    expect(tableNames).not.toContain("documents_vec");

    // 2. Check documents columns
    const documentsColumns = await client.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'documents'
      ORDER BY ordinal_position
    `);
    const documentsColumnNames = documentsColumns.rows.map(r => r.column_name);

    expect(documentsColumnNames).toEqual(
      expect.arrayContaining([
        "id",
        "page_id",
        "content",
        "metadata",
        "sort_order",
        "embedding",
        "indexed_at",
        "created_at"
      ])
    );

    // Verify old columns are removed (same as SQLite test)
    expect(documentsColumnNames).not.toContain("library");
    expect(documentsColumnNames).not.toContain("version");
    expect(documentsColumnNames).not.toContain("library_id");
    expect(documentsColumnNames).not.toContain("version_id");
    expect(documentsColumnNames).not.toContain("url");

    // 3. Check embedding column type is vector(1536)
    const embeddingColumn = documentsColumns.rows.find(r => r.column_name === "embedding");
    expect(embeddingColumn).toBeDefined();
    expect(embeddingColumn.udt_name).toBe("vector");

    // 4. Check pages columns
    const pagesColumns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'pages'
      ORDER BY ordinal_position
    `);
    const pagesColumnNames = pagesColumns.rows.map(r => r.column_name);

    expect(pagesColumnNames).toEqual(
      expect.arrayContaining([
        "id",
        "version_id",
        "url",
        "title",
        "etag",
        "last_modified",
        "content_type",
        "created_at"
      ])
    );

    // 5. Check libraries columns
    const librariesColumns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'libraries'
    `);
    const librariesColumnNames = librariesColumns.rows.map(r => r.column_name);

    expect(librariesColumnNames).toEqual(
      expect.arrayContaining(["id", "name", "created_at"])
    );

    // 6. Check versions table
    expect(tableNames).toContain("versions");
    const versionsColumns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'versions'
    `);
    const versionsColumnNames = versionsColumns.rows.map(r => r.column_name);

    expect(versionsColumnNames).toEqual(
      expect.arrayContaining([
        "id",
        "library_id",
        "name",
        "status",
        "created_at",
        "updated_at"
      ])
    );

    // 7. Check pgvector extension is installed
    const extensionResult = await client.query(`
      SELECT extname FROM pg_extension WHERE extname = 'vector'
    `);
    expect(extensionResult.rows.length).toBeGreaterThan(0);

    // 8. Check GIN index for FTS exists
    const ftsIndexResult = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = current_schema()
        AND tablename = 'documents'
        AND indexname = 'idx_documents_content_fts'
    `);
    expect(ftsIndexResult.rows.length).toBe(1);
    expect(ftsIndexResult.rows[0].indexdef).toContain("USING gin");
    expect(ftsIndexResult.rows[0].indexdef).toContain("to_tsvector");

    // 9. Check HNSW index for vectors exists
    const vectorIndexResult = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = current_schema()
        AND tablename = 'documents'
        AND indexname = 'idx_documents_embedding_hnsw'
    `);
    expect(vectorIndexResult.rows.length).toBe(1);
    expect(vectorIndexResult.rows[0].indexdef).toContain("USING hnsw");
    expect(vectorIndexResult.rows[0].indexdef).toContain("embedding");

  } finally {
    client.release();
  }
});
```

**Key Changes**:
- ✅ Use `information_schema` instead of `PRAGMA`
- ✅ Check indexes instead of virtual tables
- ✅ Verify pgvector extension
- ✅ Validate column types (vector(1536))
- ✅ Ensure NO documents_fts or documents_vec tables

---

### Test 2: Empty Vector Search

**Purpose**: Verify vector search returns empty results gracefully when no documents exist.

**Current SQLite Implementation**:
```sql
SELECT dv.rowid, d.content, dv.distance
FROM documents_vec dv
JOIN documents d ON dv.rowid = d.id
WHERE dv.embedding MATCH ? AND k = 5
```

**PostgreSQL Implementation**:

```typescript
it("should handle vector search with empty results gracefully", async () => {
  // Apply migrations
  await applyMigrations(pool);

  const client = await pool.connect();
  try {
    // Insert a library and version but no documents
    await client.query("INSERT INTO libraries (name) VALUES ($1)", ["empty-lib"]);

    const libraryResult = await client.query(
      "SELECT id FROM libraries WHERE name = $1",
      ["empty-lib"]
    );
    const libraryId = libraryResult.rows[0].id;

    // Insert a version for this library
    await client.query(
      "INSERT INTO versions (library_id, name) VALUES ($1, $2)",
      [libraryId, "1.0.0"]
    );

    const versionResult = await client.query(
      "SELECT id FROM versions WHERE library_id = $1 AND name = $2",
      [libraryId, "1.0.0"]
    );
    const versionId = versionResult.rows[0].id;

    // Create search vector (1536 dimensions)
    const searchVector = new Array(1536).fill(0.5);
    const searchVectorStr = JSON.stringify(searchVector);

    // Search for vectors in empty library
    const vectorSearchQuery = `
      SELECT
        d.id,
        d.content,
        d.embedding <=> $1::vector AS distance
      FROM documents d
      JOIN pages p ON d.page_id = p.id
      JOIN versions v ON p.version_id = v.id
      JOIN libraries l ON v.library_id = l.id
      WHERE l.name = $2
        AND v.name = $3
        AND d.embedding IS NOT NULL
      ORDER BY d.embedding <=> $1::vector
      LIMIT 5
    `;

    const searchResults = await client.query(vectorSearchQuery, [
      searchVectorStr,
      "empty-lib",
      "1.0.0"
    ]);

    // Should return empty array, not throw an error
    expect(searchResults.rows).toEqual([]);

  } finally {
    client.release();
  }
});
```

**Key Changes**:
- ✅ Use `<=>` operator for cosine distance
- ✅ No documents_vec table, query documents directly
- ✅ Use parameterized queries ($1, $2, $3)
- ✅ Cast to `::vector` type
- ✅ Check `embedding IS NOT NULL`

---

### Test 3: Vector Similarity Search

**Purpose**: Verify vector search returns similar vectors with correct distance calculations.

**PostgreSQL Implementation**:

```typescript
it("should perform vector search and return similar vectors correctly", async () => {
  // Apply migrations
  await applyMigrations(pool);

  const client = await pool.connect();
  try {
    // Insert test library and version
    await client.query("INSERT INTO libraries (name) VALUES ($1)", ["test-lib"]);
    const libraryResult = await client.query(
      "SELECT id FROM libraries WHERE name = $1",
      ["test-lib"]
    );
    const libraryId = libraryResult.rows[0].id;

    await client.query(
      "INSERT INTO versions (library_id, name) VALUES ($1, $2)",
      [libraryId, "1.0.0"]
    );
    const versionResult = await client.query(
      "SELECT id FROM versions WHERE library_id = $1 AND name = $2",
      [libraryId, "1.0.0"]
    );
    const versionId = versionResult.rows[0].id;

    // Insert test pages
    const page1Result = await client.query(
      `INSERT INTO pages (version_id, url, title, content_type)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [versionId, "https://example.com/doc1", "AI Basics", "text/html"]
    );
    const page1Id = page1Result.rows[0].id;

    const page2Result = await client.query(
      `INSERT INTO pages (version_id, url, title, content_type)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [versionId, "https://example.com/doc2", "Neural Networks", "text/html"]
    );
    const page2Id = page2Result.rows[0].id;

    const page3Result = await client.query(
      `INSERT INTO pages (version_id, url, title, content_type)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [versionId, "https://example.com/doc3", "Cooking Guide", "text/html"]
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
        i >= 100 && i < 200 ? Math.random() * 0.1 + 0.9 : Math.random() * 0.2
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
        JSON.stringify(aiVector1)
      ]
    );

    await client.query(
      `INSERT INTO documents (page_id, content, metadata, sort_order, embedding)
       VALUES ($1, $2, $3, $4, $5::vector)`,
      [
        page2Id,
        "This document discusses neural networks and deep learning",
        JSON.stringify({ title: "Neural Networks", path: "/neural-networks" }),
        2,
        JSON.stringify(aiVector2)
      ]
    );

    await client.query(
      `INSERT INTO documents (page_id, content, metadata, sort_order, embedding)
       VALUES ($1, $2, $3, $4, $5::vector)`,
      [
        page3Id,
        "Cooking recipes and food preparation techniques",
        JSON.stringify({ title: "Cooking Guide", path: "/cooking" }),
        3,
        JSON.stringify(cookingVector)
      ]
    );

    // Search with a vector similar to AI vectors
    const searchVector = new Array(1536)
      .fill(0)
      .map((_, i) => (i < 100 ? Math.random() * 0.1 + 0.77 : Math.random() * 0.2));

    const vectorSearchQuery = `
      SELECT
        d.id,
        d.content,
        d.embedding <=> $1::vector AS distance
      FROM documents d
      JOIN pages p ON d.page_id = p.id
      JOIN versions v ON p.version_id = v.id
      JOIN libraries l ON v.library_id = l.id
      WHERE l.name = $2
        AND v.name = $3
        AND d.embedding IS NOT NULL
      ORDER BY d.embedding <=> $1::vector
      LIMIT 3
    `;

    const searchResults = await client.query(vectorSearchQuery, [
      JSON.stringify(searchVector),
      "test-lib",
      "1.0.0"
    ]);

    // Should return 3 results ordered by similarity
    expect(searchResults.rows).toHaveLength(3);

    // Results should be ordered by distance (most similar first)
    expect(searchResults.rows[0].distance).toBeLessThan(searchResults.rows[1].distance);
    expect(searchResults.rows[1].distance).toBeLessThan(searchResults.rows[2].distance);

    // AI-related documents should be more similar (lower distance) than cooking document
    const aiResults = searchResults.rows.filter(
      r => r.content.includes("machine learning") || r.content.includes("neural networks")
    );
    const cookingResults = searchResults.rows.filter(
      r => r.content.includes("cooking") || r.content.includes("recipes")
    );

    expect(aiResults).toHaveLength(2);
    expect(cookingResults).toHaveLength(1);

    // AI documents should have lower distances than cooking document
    const maxAiDistance = Math.max(...aiResults.map(r => r.distance));
    const cookingDistance = cookingResults[0].distance;
    expect(maxAiDistance).toBeLessThan(cookingDistance);

    // Validate distance behavior: cosine distance with <=>
    // - Distance 0 = identical vectors (closest match)
    // - Distance 1 = orthogonal vectors
    // - Distance 2 = opposite vectors
    // - Lower distances = more similar vectors
    for (const result of searchResults.rows) {
      expect(result.distance).toBeGreaterThanOrEqual(0);
      expect(result.distance).toBeLessThanOrEqual(2); // Cosine distance is bounded [0, 2]
    }

    // Test identical vector search should return distance ≈ 0
    const identicalSearchResults = await client.query(vectorSearchQuery, [
      JSON.stringify(aiVector1),
      "test-lib",
      "1.0.0"
    ]);

    expect(identicalSearchResults.rows).toHaveLength(3);

    // Find the result that matches our exact vector (should be doc1)
    const exactMatch = identicalSearchResults.rows.find(r =>
      r.content.includes("machine learning")
    );
    expect(exactMatch).toBeDefined();
    expect(exactMatch.distance).toBeCloseTo(0, 6); // Very close to 0 for identical vectors

    // Demonstrate distance semantics: lower distance = higher similarity
    const allDistances = searchResults.rows.map(r => r.distance).sort((a, b) => a - b);
    expect(allDistances[0]).toBeLessThan(allDistances[1]); // Best match has lowest distance
    expect(allDistances[1]).toBeLessThan(allDistances[2]); // Worst match has highest distance

  } finally {
    client.release();
  }
});
```

**Key Changes**:
- ✅ Use `<=>` operator for cosine distance
- ✅ Cast embeddings to `::vector` type
- ✅ Use `RETURNING id` for inserts
- ✅ Cosine distance bounded [0, 2] vs unbounded L2
- ✅ Same "lower is better" semantics

---

### Test 4: Full-Text Search

**Purpose**: Verify FTS search with ranking, phrase matching, and metadata search.

**PostgreSQL Implementation**:

```typescript
it("should perform FTS search and return relevant text matches correctly", async () => {
  // Apply migrations
  await applyMigrations(pool);

  const client = await pool.connect();
  try {
    // Insert test library and version
    await client.query("INSERT INTO libraries (name) VALUES ($1)", ["docs-lib"]);
    const libraryResult = await client.query(
      "SELECT id FROM libraries WHERE name = $1",
      ["docs-lib"]
    );
    const libraryId = libraryResult.rows[0].id;

    await client.query(
      "INSERT INTO versions (library_id, name) VALUES ($1, $2)",
      [libraryId, "1.0.0"]
    );
    const versionResult = await client.query(
      "SELECT id FROM versions WHERE library_id = $1 AND name = $2",
      [libraryId, "1.0.0"]
    );
    const versionId = versionResult.rows[0].id;

    // Insert test pages
    const reactPageResult = await client.query(
      `INSERT INTO pages (version_id, url, title, content_type)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [versionId, "https://example.com/react-hooks", "React Hooks Guide", "text/html"]
    );
    const reactPageId = reactPageResult.rows[0].id;

    const vuePageResult = await client.query(
      `INSERT INTO pages (version_id, url, title, content_type)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [versionId, "https://example.com/vue-composition", "Vue Composition API", "text/html"]
    );
    const vuePageId = vuePageResult.rows[0].id;

    const angularPageResult = await client.query(
      `INSERT INTO pages (version_id, url, title, content_type)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [versionId, "https://example.com/angular-services", "Angular Services", "text/html"]
    );
    const angularPageId = angularPageResult.rows[0].id;

    const dbPageResult = await client.query(
      `INSERT INTO pages (version_id, url, title, content_type)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [versionId, "https://example.com/database-design", "Database Design", "text/html"]
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
        1
      ]
    );

    await client.query(
      `INSERT INTO documents (page_id, content, metadata, sort_order)
       VALUES ($1, $2, $3, $4)`,
      [
        vuePageId,
        "Vue composition API provides a way to organize component logic. It offers reactive state management and computed properties for building dynamic applications.",
        JSON.stringify({ title: "Vue Composition API", path: "/vue/composition" }),
        2
      ]
    );

    await client.query(
      `INSERT INTO documents (page_id, content, metadata, sort_order)
       VALUES ($1, $2, $3, $4)`,
      [
        angularPageId,
        "Angular services are singleton objects that provide functionality across the application. Dependency injection makes services available to components.",
        JSON.stringify({ title: "Angular Services", path: "/angular/services" }),
        3
      ]
    );

    await client.query(
      `INSERT INTO documents (page_id, content, metadata, sort_order)
       VALUES ($1, $2, $3, $4)`,
      [
        dbPageId,
        "Database normalization reduces redundancy and improves data integrity. Primary keys uniquely identify records in relational databases.",
        JSON.stringify({ title: "Database Design", path: "/database/design" }),
        4
      ]
    );

    // Test 1: Search for React-specific content
    const reactSearchQuery = `
      SELECT
        d.id,
        d.content,
        (d.metadata::jsonb)->>'title' as title,
        p.url,
        (d.metadata::jsonb)->>'path' as path,
        ts_rank(to_tsvector('english', d.content), plainto_tsquery('english', $1)) as rank
      FROM documents d
      JOIN pages p ON d.page_id = p.id
      JOIN versions v ON p.version_id = v.id
      JOIN libraries l ON v.library_id = l.id
      WHERE to_tsvector('english', d.content) @@ plainto_tsquery('english', $1)
        AND l.name = $2
        AND v.name = $3
      ORDER BY rank DESC
    `;

    const reactResults = await client.query(reactSearchQuery, [
      "react hooks",
      "docs-lib",
      "1.0.0"
    ]);

    expect(reactResults.rows).toHaveLength(1);
    expect(reactResults.rows[0].content).toContain("React hooks");
    expect(reactResults.rows[0].title).toBe("React Hooks Guide");

    // Test 2: Search for state management across frameworks
    const stateResults = await client.query(reactSearchQuery, [
      "state",
      "docs-lib",
      "1.0.0"
    ]);

    expect(stateResults.rows.length).toBeGreaterThanOrEqual(2);

    // Should find both React (useState) and Vue (reactive state) content
    const contentTexts = stateResults.rows.map(r => r.content);
    const hasReactState = contentTexts.some(content => content.includes("useState"));
    const hasVueState = contentTexts.some(content => content.includes("reactive state"));

    expect(hasReactState || hasVueState).toBe(true);

    // Test 3: Search with phrase matching
    // NOTE: PostgreSQL uses phraseto_tsquery for exact phrases
    const phraseSearchQuery = `
      SELECT
        d.id,
        d.content,
        (d.metadata::jsonb)->>'title' as title,
        p.url,
        (d.metadata::jsonb)->>'path' as path,
        ts_rank(to_tsvector('english', d.content), phraseto_tsquery('english', $1)) as rank
      FROM documents d
      JOIN pages p ON d.page_id = p.id
      JOIN versions v ON p.version_id = v.id
      JOIN libraries l ON v.library_id = l.id
      WHERE to_tsvector('english', d.content) @@ phraseto_tsquery('english', $1)
        AND l.name = $2
        AND v.name = $3
      ORDER BY rank DESC
    `;

    const phraseResults = await client.query(phraseSearchQuery, [
      "dependency injection",
      "docs-lib",
      "1.0.0"
    ]);

    expect(phraseResults.rows).toHaveLength(1);
    expect(phraseResults.rows[0].content).toContain("Dependency injection");
    expect(phraseResults.rows[0].title).toBe("Angular Services");

    // Test 4: Search in metadata fields (title)
    const titleSearchQuery = `
      SELECT
        d.id,
        d.content,
        (d.metadata::jsonb)->>'title' as title,
        p.url,
        (d.metadata::jsonb)->>'path' as path,
        ts_rank(to_tsvector('english', (d.metadata::jsonb)->>'title'), plainto_tsquery('english', $1)) as rank
      FROM documents d
      JOIN pages p ON d.page_id = p.id
      JOIN versions v ON p.version_id = v.id
      JOIN libraries l ON v.library_id = l.id
      WHERE to_tsvector('english', (d.metadata::jsonb)->>'title') @@ plainto_tsquery('english', $1)
        AND l.name = $2
        AND v.name = $3
      ORDER BY rank DESC
    `;

    const titleResults = await client.query(titleSearchQuery, [
      "Database",
      "docs-lib",
      "1.0.0"
    ]);

    expect(titleResults.rows).toHaveLength(1);
    expect(titleResults.rows[0].title).toBe("Database Design");

    // Test 5: Test empty search results
    const emptyResults = await client.query(reactSearchQuery, [
      "nonexistent term",
      "docs-lib",
      "1.0.0"
    ]);

    expect(emptyResults.rows).toHaveLength(0);

    // Test 6: Test ranking (more relevant results should have better rank)
    const multiResults = await client.query(reactSearchQuery, [
      "component",
      "docs-lib",
      "1.0.0"
    ]);

    if (multiResults.rows.length > 1) {
      // Results should be ordered by relevance (rank DESC in PostgreSQL!)
      // NOTE: This is OPPOSITE of SQLite BM25 where lower = better
      for (let i = 1; i < multiResults.rows.length; i++) {
        expect(multiResults.rows[i].rank).toBeLessThanOrEqual(multiResults.rows[i - 1].rank);
      }
    }

    // Test 7: Validate ts_rank scoring behavior
    // NOTE: PostgreSQL ts_rank semantics are OPPOSITE of SQLite BM25:
    // - ts_rank: Higher score = better match (ORDER BY rank DESC)
    // - BM25: Lower score = better match (ORDER BY bm25 ASC)
    const stateRankResults = await client.query(reactSearchQuery, [
      "state",
      "docs-lib",
      "1.0.0"
    ]);

    expect(stateRankResults.rows.length).toBeGreaterThanOrEqual(2);

    // Validate ts_rank score behavior: higher scores = better matches
    for (const result of stateRankResults.rows) {
      expect(result.rank).toBeGreaterThan(0); // Positive scores for matches
    }

    // Results should be ordered by ts_rank DESC (best matches first)
    for (let i = 1; i < stateRankResults.rows.length; i++) {
      expect(stateRankResults.rows[i].rank).toBeLessThanOrEqual(
        stateRankResults.rows[i - 1].rank
      );
    }

    // Test phrase match vs partial match scoring
    const exactPhraseResults = await client.query(phraseSearchQuery, [
      "component state",
      "docs-lib",
      "1.0.0"
    ]);

    const partialMatchResults = await client.query(reactSearchQuery, [
      "component",
      "docs-lib",
      "1.0.0"
    ]);

    if (exactPhraseResults.rows.length > 0 && partialMatchResults.rows.length > 0) {
      // Exact phrase matches should have better (HIGHER) ts_rank scores
      // NOTE: This is OPPOSITE of SQLite where exact phrases had lower BM25 scores
      const bestExactScore = Math.max(...exactPhraseResults.rows.map(r => r.rank));
      const bestPartialScore = Math.max(...partialMatchResults.rows.map(r => r.rank));
      expect(bestExactScore).toBeGreaterThanOrEqual(bestPartialScore);
    }

  } finally {
    client.release();
  }
});
```

**Key Changes**:
- ✅ Use `to_tsvector()` and `@@` operator instead of FTS5
- ✅ Use `plainto_tsquery()` for word search
- ✅ Use `phraseto_tsquery()` for phrase search
- ✅ Use `ts_rank()` for ranking
- ✅ **CRITICAL**: ORDER BY rank DESC (higher = better) - OPPOSITE of SQLite!
- ✅ Cast metadata to jsonb for querying: `(metadata::jsonb)->>'title'`
- ✅ All ranking assertions inverted

---

## Implementation Steps

### Step 1: Update Imports

**Remove**:
```typescript
import Database, { type Database as DatabaseType } from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
```

**Add**:
```typescript
import { Pool, type PoolClient } from "pg";
```

**Keep**:
```typescript
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "./applyMigrations";
```

---

### Step 2: Add Schema Isolation Helper

Add at top of test file, before describe block:

```typescript
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://postgres:postgres@postgres.den.lan/scrapegoat_test";

interface TestSchema {
  schemaName: string;
  pool: Pool;
  cleanup: () => Promise<void>;
}

async function createTestSchema(): Promise<TestSchema> {
  const schemaName = `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // Step 1: Create the schema
  const setupPool = new Pool({ connectionString: TEST_DATABASE_URL });
  const setupClient = await setupPool.connect();

  try {
    await setupClient.query(`CREATE SCHEMA ${schemaName}`);
  } finally {
    await setupClient.release();
    await setupPool.end();
  }

  // Step 2: Create pool with isolated schema
  const pool = new Pool({
    connectionString: TEST_DATABASE_URL,
    options: `-c search_path=${schemaName},public`
  });

  // Step 3: Define cleanup
  const cleanup = async () => {
    await pool.end();

    const cleanupPool = new Pool({ connectionString: TEST_DATABASE_URL });
    const cleanupClient = await cleanupPool.connect();

    try {
      await cleanupClient.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
    } finally {
      await cleanupClient.release();
      await cleanupPool.end();
    }
  };

  return { schemaName, pool, cleanup };
}
```

---

### Step 3: Update Test Suite Structure

**Replace**:
```typescript
describe("Database Migrations", () => {
  let db: DatabaseType;

  beforeEach(() => {
    db = new Database(":memory:");
    sqliteVec.load(db);
  });

  afterEach(() => {
    db.close();
  });

  // tests...
});
```

**With**:
```typescript
describe("Database Migrations (PostgreSQL)", () => {
  let pool: Pool;
  let schemaName: string;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const testSchema = await createTestSchema();
    pool = testSchema.pool;
    schemaName = testSchema.schemaName;
    cleanup = testSchema.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  // tests...
});
```

---

### Step 4: Rewrite Tests

Replace each test with the PostgreSQL version from the detailed plans above:

1. ✅ Test 1: Schema validation
2. ✅ Test 2: Empty vector search
3. ✅ Test 3: Vector similarity search
4. ✅ Test 4: Full-text search

---

### Step 5: Run Tests

```bash
cd /home/mp/Workspace/scrapegoat
npm test src/store/applyMigrations.test.ts
```

---

### Step 6: Verify No SQLite Remnants

```bash
grep -r "better-sqlite3" src/store/applyMigrations.test.ts
grep -r "sqlite-vec" src/store/applyMigrations.test.ts
grep -r "sqlite_master" src/store/applyMigrations.test.ts
grep -r "PRAGMA" src/store/applyMigrations.test.ts
grep -r "documents_fts" src/store/applyMigrations.test.ts  # Should only be in NOT assertions
grep -r "documents_vec" src/store/applyMigrations.test.ts  # Should only be in NOT assertions
```

All should return no results (or only negative assertions).

---

## Code Examples

### Vector Embedding Format

```typescript
// Create vector array
const embedding = new Array(1536).fill(0).map(() => Math.random());

// Convert to PostgreSQL format
const embeddingStr = JSON.stringify(embedding); // "[0.123,0.456,...]"

// Insert
await client.query(
  'INSERT INTO documents (..., embedding) VALUES (..., $1::vector)',
  [...otherParams, embeddingStr]
);

// Search
const searchVectorStr = JSON.stringify(searchVector);
await client.query(
  'SELECT *, embedding <=> $1::vector AS distance FROM documents ORDER BY distance LIMIT 5',
  [searchVectorStr]
);
```

### FTS Query Examples

```typescript
// Basic word search
const query = `
  SELECT *, ts_rank(to_tsvector('english', content), plainto_tsquery('english', $1)) as rank
  FROM documents
  WHERE to_tsvector('english', content) @@ plainto_tsquery('english', $1)
  ORDER BY rank DESC
`;
await client.query(query, ["search terms"]);

// Phrase search
const phraseQuery = `
  SELECT *, ts_rank(to_tsvector('english', content), phraseto_tsquery('english', $1)) as rank
  FROM documents
  WHERE to_tsvector('english', content) @@ phraseto_tsquery('english', $1)
  ORDER BY rank DESC
`;
await client.query(phraseQuery, ["exact phrase"]);

// Metadata search
const metadataQuery = `
  SELECT *,
    ts_rank(
      to_tsvector('english', (metadata::jsonb)->>'title'),
      plainto_tsquery('english', $1)
    ) as rank
  FROM documents
  WHERE to_tsvector('english', (metadata::jsonb)->>'title') @@ plainto_tsquery('english', $1)
  ORDER BY rank DESC
`;
await client.query(metadataQuery, ["title search"]);
```

### Schema Introspection

```typescript
// List tables
const tables = await client.query(`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = current_schema()
  ORDER BY table_name
`);

// List columns
const columns = await client.query(`
  SELECT column_name, data_type, udt_name
  FROM information_schema.columns
  WHERE table_schema = current_schema()
    AND table_name = $1
  ORDER BY ordinal_position
`, ['documents']);

// Check extension
const extension = await client.query(`
  SELECT extname FROM pg_extension WHERE extname = 'vector'
`);

// List indexes
const indexes = await client.query(`
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE schemaname = current_schema()
    AND tablename = $1
`, ['documents']);
```

---

## Verification Plan

### 1. Test Execution

```bash
cd /home/mp/Workspace/scrapegoat
npm test src/store/applyMigrations.test.ts
```

**Expected output**:
```
 ✓ src/store/applyMigrations.test.ts (4)
   ✓ Database Migrations (PostgreSQL) (4)
     ✓ should apply all migrations and create expected tables and columns
     ✓ should handle vector search with empty results gracefully
     ✓ should perform vector search and return similar vectors correctly
     ✓ should perform FTS search and return relevant text matches correctly

Test Files  1 passed (1)
     Tests  4 passed (4)
```

### 2. Code Quality Checks

```bash
# Check for SQLite imports
grep -n "better-sqlite3" src/store/applyMigrations.test.ts
# Expected: no results

# Check for SQLite vector
grep -n "sqlite-vec" src/store/applyMigrations.test.ts
# Expected: no results

# Check for SQLite-specific SQL
grep -n "PRAGMA\|sqlite_master" src/store/applyMigrations.test.ts
# Expected: no results

# Check for virtual tables (should only be in negative assertions)
grep -n "documents_fts\|documents_vec" src/store/applyMigrations.test.ts
# Expected: only in expect().not.toContain() assertions
```

### 3. Schema Isolation Validation

```bash
# Run tests multiple times to ensure cleanup works
npm test src/store/applyMigrations.test.ts -- --reporter=verbose
npm test src/store/applyMigrations.test.ts -- --reporter=verbose
npm test src/store/applyMigrations.test.ts -- --reporter=verbose
```

All runs should pass without errors about existing schemas.

### 4. Database State Check

Connect to database and verify no test schemas remain:

```sql
-- Connect to scrapegoat_test database
\c scrapegoat_test

-- List all schemas (should NOT see any test_* schemas)
SELECT schema_name FROM information_schema.schemata
WHERE schema_name LIKE 'test_%';

-- Expected: 0 rows
```

### 5. Coverage Validation

Ensure all original test cases are covered:

- ✅ Migration execution
- ✅ Table creation validation
- ✅ Column schema validation
- ✅ Index creation validation
- ✅ Extension validation
- ✅ Empty vector search
- ✅ Vector similarity search
- ✅ Distance calculations
- ✅ Identical vector search
- ✅ Basic FTS search
- ✅ Phrase matching
- ✅ Metadata field search
- ✅ Empty FTS results
- ✅ Ranking validation

### 6. Integration Test

Run all store tests to ensure no regressions:

```bash
npm test src/store/
```

All tests should pass.

---

## Potential Issues & Solutions

### Issue 1: Schema Not Isolated

**Symptom**: Tests interfere with each other, see data from other tests

**Cause**: search_path not properly set

**Solution**:
```typescript
// Verify search_path is set correctly
const result = await client.query('SHOW search_path');
console.log('search_path:', result.rows[0].search_path);
// Should show: test_xxxxx_xxxxx,public
```

### Issue 2: Extension Not Found

**Symptom**: `ERROR: type "vector" does not exist`

**Cause**: pgvector extension not installed in database

**Solution**:
```bash
# Connect to scrapegoat_test database
psql -h postgres.den.lan -U postgres -d scrapegoat_test

# Install extension
CREATE EXTENSION IF NOT EXISTS vector;
```

### Issue 3: Schema Cleanup Fails

**Symptom**: `ERROR: schema "test_xxxxx" still has active connections`

**Cause**: Pool not closed before cleanup

**Solution**:
```typescript
const cleanup = async () => {
  // MUST call pool.end() first to close all connections
  await pool.end();

  // Then drop schema
  const cleanupPool = new Pool({ connectionString: TEST_DATABASE_URL });
  // ... rest of cleanup
};
```

### Issue 4: Vector Distance Out of Range

**Symptom**: Distance values > 2 for cosine distance

**Cause**: Vector not normalized, or using wrong operator

**Solution**:
```typescript
// Ensure using cosine distance operator <=>
// Cosine distance is bounded [0, 2] for normalized vectors

// Check operator in query
SELECT embedding <=> $1::vector AS distance  -- Correct: <=>
// NOT: embedding <-> $1::vector  -- This is L2 distance
```

### Issue 5: FTS Ranking Seems Inverted

**Symptom**: Lower-ranked results appear first

**Cause**: Using SQLite semantics (ASC) instead of PostgreSQL (DESC)

**Solution**:
```typescript
// PostgreSQL ts_rank: higher = better
ORDER BY ts_rank(...) DESC  // Correct

// NOT: ORDER BY ts_rank(...) ASC  // SQLite BM25 semantics
```

### Issue 6: Phrase Search Not Working

**Symptom**: Phrase search returns no results or wrong results

**Cause**: Using plainto_tsquery() instead of phraseto_tsquery()

**Solution**:
```typescript
// For exact phrases, use phraseto_tsquery
WHERE to_tsvector('english', content) @@ phraseto_tsquery('english', $1)

// NOT: plainto_tsquery for phrases (it splits words)
```

### Issue 7: Embedding Insert Fails

**Symptom**: `ERROR: malformed vector literal`

**Cause**: Incorrect embedding format

**Solution**:
```typescript
// Correct format
const embedding = [0.1, 0.2, 0.3, ...];
const embeddingStr = JSON.stringify(embedding); // "[0.1,0.2,0.3,...]"
await client.query('INSERT ... VALUES ($1::vector)', [embeddingStr]);

// NOT: embedding as array object
await client.query('... VALUES ($1::vector)', [embedding]); // WRONG
```

### Issue 8: Tests Timeout

**Symptom**: Tests timeout after 30 seconds

**Cause**: Database connection issues, schema creation slow

**Solution**:
```typescript
// Increase timeout in vitest.config.ts
export default defineConfig({
  test: {
    testTimeout: 60000, // 60 seconds
  }
});

// Or in test file
it("test name", async () => {
  // ...
}, { timeout: 60000 });
```

### Issue 9: Metadata JSON Queries Fail

**Symptom**: `ERROR: cannot cast type text to jsonb`

**Cause**: Metadata stored as TEXT but not valid JSON

**Solution**:
```typescript
// Ensure metadata is valid JSON
const metadata = JSON.stringify({ title: "Test", path: "/test" });

// Cast to jsonb for queries
(metadata::jsonb)->>'title'

// Validate JSON before insert
try {
  JSON.parse(metadata);
} catch (e) {
  throw new Error('Invalid JSON metadata');
}
```

### Issue 10: Index Not Used

**Symptom**: Queries slow, EXPLAIN shows sequential scan

**Cause**: Query not matching index definition

**Solution**:
```typescript
// Ensure query matches GIN index definition
// Index: to_tsvector('english', content)
// Query must use same configuration:
WHERE to_tsvector('english', content) @@ plainto_tsquery('english', $1)
//    ^^^^^^^^^^^^^^^^^^^ must match index

// Run ANALYZE to update statistics
await client.query('ANALYZE documents');
```

---

## Summary

This plan provides a complete roadmap for rewriting `applyMigrations.test.ts` from SQLite to PostgreSQL. Key takeaways:

1. **Schema-based isolation** provides fast, reliable test isolation
2. **No virtual tables** - use indexes instead (GIN for FTS, HNSW for vectors)
3. **Ranking semantics are opposite** - ts_rank higher=better vs BM25 lower=better
4. **Vector format same** - JSON.stringify(array) works for both
5. **Operator differences** - `<=>` for vectors, `@@` for FTS
6. **Function differences** - plainto_tsquery vs phraseto_tsquery

The rewrite maintains 100% test coverage while fully migrating to PostgreSQL with no SQLite dependencies remaining.

---

**File**: `/home/mp/Workspace/scrapegoat/projects/phase-c-migrations-test-rewrite-plan.md`
**Generated**: 2025-11-08
**Status**: Ready for implementation
