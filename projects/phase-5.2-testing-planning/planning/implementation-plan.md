# Implementation Plan: Phase 5.2

## Overview

Detailed step-by-step plan for implementing Phase 5.2, organized by priority and dependencies. Each task includes validation criteria and estimated time.

## Pre-Implementation Checklist

- [ ] Planning review completed
- [ ] Docker Compose test database started
- [ ] Test database connection verified
- [ ] All planning documents reviewed
- [ ] Git branch created for Phase 5.2

## Day 1: DocumentStore.test.ts Migration

### Task 1.1: Setup and Preparation
**Time**: 30 minutes
**Priority**: CRITICAL
**Dependencies**: None

**Steps**:
1. Start Docker Compose test database:
   ```bash
   cd /home/mp/Workspace/docs-mcp-server
   docker-compose -f docker-compose.test.yml up -d
   ```

2. Verify test database connection:
   ```bash
   psql postgresql://postgres:postgres@localhost:5433/postgres -c "SELECT version();"
   ```

3. Create git branch:
   ```bash
   git checkout -b phase-5.2-test-migration
   ```

4. Backup original test file:
   ```bash
   cp src/store/DocumentStore.test.ts src/store/DocumentStore.test.ts.backup
   ```

**Validation**:
- [ ] Docker container running
- [ ] PostgreSQL connection successful
- [ ] Git branch created
- [ ] Backup created

---

### Task 1.2: Update "With Embeddings" Test Suite
**Time**: 1 hour
**Priority**: CRITICAL
**Dependencies**: Task 1.1

**File**: `/home/mp/Workspace/docs-mcp-server/src/store/DocumentStore.test.ts`
**Lines**: 69-494

**Changes**:

1. **Add imports** (top of file):
   ```typescript
   import { createTestDatabase, type TestDatabase } from "./__tests__/testUtils";
   ```

2. **Update beforeEach** (line 72-81):
   ```typescript
   // OLD:
   beforeEach(async () => {
     const embeddingConfig = EmbeddingConfig.parseEmbeddingConfig(
       "openai:text-embedding-3-small",
     );
     store = new DocumentStore(":memory:", embeddingConfig);
     await store.initialize();
   });

   // NEW:
   let testDb: TestDatabase;

   beforeEach(async () => {
     const embeddingConfig = EmbeddingConfig.parseEmbeddingConfig(
       "openai:text-embedding-3-small",
     );
     testDb = await createTestDatabase(embeddingConfig);
     store = testDb.store;
   });
   ```

3. **Update afterEach** (line 83-87):
   ```typescript
   // OLD:
   afterEach(async () => {
     if (store) {
       await store.shutdown();
     }
   });

   // NEW:
   afterEach(async () => {
     if (testDb) {
       await testDb.cleanup();
     }
   });
   ```

4. **Fix direct database access** (lines 726-745):
   ```typescript
   // OLD (SQLite-specific):
   async function countDocuments(targetUrl?: string): Promise<number> {
     let query = `
       SELECT COUNT(*) as count
       FROM documents d
       JOIN pages p ON d.page_id = p.id
       JOIN versions v ON p.version_id = v.id
       JOIN libraries l ON v.library_id = l.id
       WHERE l.name = ? AND COALESCE(v.name, '') = ?
     `;
     const params: any[] = [library.toLowerCase(), version.toLowerCase()];

     if (targetUrl) {
       query += " AND p.url = ?";
       params.push(targetUrl);
     }

     const result = (store as any).db.prepare(query).get(...params) as {
       count: number;
     };
     return result.count;
   }

   // NEW (PostgreSQL):
   async function countDocuments(targetUrl?: string): Promise<number> {
     let query = `
       SELECT COUNT(*) as count
       FROM documents d
       JOIN pages p ON d.page_id = p.id
       JOIN versions v ON p.version_id = v.id
       JOIN libraries l ON v.library_id = l.id
       WHERE LOWER(l.name) = LOWER($1) AND LOWER(COALESCE(v.name, '')) = LOWER($2)
     `;
     const params: any[] = [library, version];

     if (targetUrl) {
       query += " AND p.url = $3";
       params.push(targetUrl);
     }

     const client = (store as any).client;
     const result = await client.query(query, params);
     return parseInt(result.rows[0].count, 10);
   }
   ```

**Validation**:
- [ ] All tests in "With Embeddings" suite pass
- [ ] No SQLite references in suite
- [ ] Test execution time < 40 seconds
- [ ] Run: `npm test -- DocumentStore.test.ts -t "With Embeddings"`

---

### Task 1.3: Update "Without Embeddings" Test Suite
**Time**: 30 minutes
**Priority**: HIGH
**Dependencies**: Task 1.2

**File**: `/home/mp/Workspace/docs-mcp-server/src/store/DocumentStore.test.ts`
**Lines**: 499-616

**Changes**:

1. **Update beforeEach** (line 554-557):
   ```typescript
   // OLD:
   beforeEach(async () => {
     store = new DocumentStore(":memory:");
     await store.initialize();
   });

   // NEW:
   let testDb: TestDatabase;

   beforeEach(async () => {
     testDb = await createTestDatabase(); // No embedding config
     store = testDb.store;
   });
   ```

2. **Update afterEach** (line 514-521):
   ```typescript
   // OLD:
   afterEach(async () => {
     process.env = originalEnv;
     if (store) {
       await store.shutdown();
     }
   });

   // NEW:
   afterEach(async () => {
     process.env = originalEnv;
     if (testDb) {
       await testDb.cleanup();
     }
   });
   ```

3. **Update initialization test** (line 524-527):
   ```typescript
   // OLD:
   it("should initialize successfully without embedding credentials", async () => {
     store = new DocumentStore(":memory:");
     await expect(store.initialize()).resolves.not.toThrow();
   });

   // NEW:
   it("should initialize successfully without embedding credentials", async () => {
     const localTestDb = await createTestDatabase();
     await expect(localTestDb.store.initialize()).resolves.not.toThrow();
     await localTestDb.cleanup();
   });
   ```

**Validation**:
- [ ] All tests in "Without Embeddings" suite pass
- [ ] FTS-only search works correctly
- [ ] Test execution time < 20 seconds
- [ ] Run: `npm test -- DocumentStore.test.ts -t "Without Embeddings"`

---

### Task 1.4: Update "Common Functionality" Test Suite
**Time**: 30 minutes
**Priority**: HIGH
**Dependencies**: Task 1.3

**File**: `/home/mp/Workspace/docs-mcp-server/src/store/DocumentStore.test.ts`
**Lines**: 622-835

**Changes**:

1. **Update beforeEach** (line 626-632):
   ```typescript
   // OLD:
   beforeEach(async () => {
     const embeddingConfig = EmbeddingConfig.parseEmbeddingConfig(
       "openai:text-embedding-3-small",
     );
     store = new DocumentStore(":memory:", embeddingConfig);
     await store.initialize();
   });

   // NEW:
   let testDb: TestDatabase;

   beforeEach(async () => {
     const embeddingConfig = EmbeddingConfig.parseEmbeddingConfig(
       "openai:text-embedding-3-small",
     );
     testDb = await createTestDatabase(embeddingConfig);
     store = testDb.store;
   });
   ```

2. **Update afterEach** (line 634-638):
   ```typescript
   // OLD:
   afterEach(async () => {
     if (store) {
       await store.shutdown();
     }
   });

   // NEW:
   afterEach(async () => {
     if (testDb) {
       await testDb.cleanup();
     }
   });
   ```

**Validation**:
- [ ] All tests in "Common Functionality" suite pass
- [ ] Case sensitivity tests work
- [ ] Version isolation tests work
- [ ] Test execution time < 30 seconds
- [ ] Run: `npm test -- DocumentStore.test.ts -t "Common Functionality"`

---

### Task 1.5: Full DocumentStore Test Validation
**Time**: 30 minutes
**Priority**: CRITICAL
**Dependencies**: Tasks 1.2, 1.3, 1.4

**Steps**:
1. Run full test suite:
   ```bash
   npm test -- DocumentStore.test.ts
   ```

2. Verify all tests pass:
   - Expected: 30+ tests passing
   - No failures or skips

3. Check test execution time:
   - Target: < 60 seconds total

4. Run coverage report:
   ```bash
   npm run test:coverage -- DocumentStore.test.ts
   ```

5. Verify coverage:
   - DocumentStore.ts: > 60% coverage
   - No decrease from original coverage

**Validation**:
- [ ] All 30+ tests passing
- [ ] Test execution time < 60 seconds
- [ ] Coverage ≥ 60% on DocumentStore.ts
- [ ] No SQLite references remain in test file

---

## Day 2: applyMigrations.test.ts Rewrite

### Task 2.1: Create New Test Structure
**Time**: 1 hour
**Priority**: CRITICAL
**Dependencies**: Day 1 complete

**File**: `/home/mp/Workspace/docs-mcp-server/src/store/applyMigrations.test.ts`

**Steps**:

1. Backup original file:
   ```bash
   mv src/store/applyMigrations.test.ts src/store/applyMigrations.test.ts.backup
   ```

2. Create new file with imports:
   ```typescript
   import { beforeEach, afterEach, describe, expect, it } from "vitest";
   import { Client } from "pg";
   import { applyMigrations } from "./applyMigrations";
   import { createTestDatabase, type TestDatabase } from "./__tests__/testUtils";
   ```

3. Create test structure:
   ```typescript
   describe("PostgreSQL Migrations", () => {
     let testDb: TestDatabase;
     let client: Client;

     beforeEach(async () => {
       testDb = await createTestDatabase();
       client = (testDb.store as any).client;
     });

     afterEach(async () => {
       await testDb.cleanup();
     });

     // Tests go here
   });
   ```

**Validation**:
- [ ] New file created
- [ ] Imports correct
- [ ] Test structure in place

---

### Task 2.2: Test Migration Execution
**Time**: 45 minutes
**Priority**: CRITICAL
**Dependencies**: Task 2.1

**Test**: Basic migration execution and table creation

```typescript
it("should apply all migrations and create expected tables", async () => {
  // Verify tables exist
  const tablesResult = await client.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);

  const tableNames = tablesResult.rows.map(r => r.tablename);

  expect(tableNames).toContain("libraries");
  expect(tableNames).toContain("versions");
  expect(tableNames).toContain("pages");
  expect(tableNames).toContain("documents");
  expect(tableNames).toContain("migration_history");
});
```

**Validation**:
- [ ] Test passes
- [ ] All tables created
- [ ] Migration history tracked

---

### Task 2.3: Test Table Schemas
**Time**: 45 minutes
**Priority**: HIGH
**Dependencies**: Task 2.2

**Test**: Verify column structure for each table

```typescript
it("should create documents table with correct schema", async () => {
  const columnsResult = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'documents'
    ORDER BY ordinal_position
  `);

  const columnNames = columnsResult.rows.map(r => r.column_name);

  expect(columnNames).toContain("id");
  expect(columnNames).toContain("page_id");
  expect(columnNames).toContain("content");
  expect(columnNames).toContain("metadata");
  expect(columnNames).toContain("sort_order");
  expect(columnNames).toContain("embedding");

  // Verify embedding column type
  const embeddingCol = columnsResult.rows.find(r => r.column_name === "embedding");
  expect(embeddingCol).toBeDefined();
});
```

**Validation**:
- [ ] Documents table schema correct
- [ ] Pages table schema correct
- [ ] Versions table schema correct
- [ ] Libraries table schema correct

---

### Task 2.4: Test pgvector Extension
**Time**: 30 minutes
**Priority**: CRITICAL
**Dependencies**: Task 2.2

**Test**: Verify pgvector extension installation

```typescript
it("should enable pgvector extension", async () => {
  const extensionResult = await client.query(`
    SELECT * FROM pg_extension WHERE extname = 'vector'
  `);

  expect(extensionResult.rows).toHaveLength(1);
  expect(extensionResult.rows[0].extname).toBe("vector");
});

it("should create embedding column with vector type", async () => {
  const typeResult = await client.query(`
    SELECT
      column_name,
      udt_name,
      character_maximum_length
    FROM information_schema.columns
    WHERE table_name = 'documents'
      AND column_name = 'embedding'
  `);

  expect(typeResult.rows).toHaveLength(1);
  // pgvector creates custom type 'vector'
  expect(typeResult.rows[0].udt_name).toBe("vector");
});
```

**Validation**:
- [ ] pgvector extension enabled
- [ ] Vector column type correct
- [ ] Vector dimension verified (if possible)

---

### Task 2.5: Test HNSW Index
**Time**: 45 minutes
**Priority**: CRITICAL
**Dependencies**: Task 2.4

**Test**: Verify HNSW index creation and parameters

```typescript
it("should create HNSW index with correct parameters", async () => {
  const indexResult = await client.query(`
    SELECT
      indexname,
      indexdef
    FROM pg_indexes
    WHERE tablename = 'documents'
      AND indexdef LIKE '%hnsw%'
  `);

  expect(indexResult.rows).toHaveLength(1);

  const indexDef = indexResult.rows[0].indexdef;

  // Verify HNSW parameters
  expect(indexDef).toContain("hnsw");
  expect(indexDef).toContain("embedding");
  expect(indexDef).toContain("vector_cosine_ops");

  // Check for m and ef_construction parameters
  // These may be in the index definition or stored separately
  expect(indexDef).toMatch(/m\s*=\s*16|m=16/);
  expect(indexDef).toMatch(/ef_construction\s*=\s*64|ef_construction=64/);
});
```

**Validation**:
- [ ] HNSW index exists
- [ ] Index on embedding column
- [ ] Parameters m=16, ef_construction=64 verified

---

### Task 2.6: Test GIN Index
**Time**: 30 minutes
**Priority**: HIGH
**Dependencies**: Task 2.2

**Test**: Verify GIN index for full-text search

```typescript
it("should create GIN index for full-text search", async () => {
  const indexResult = await client.query(`
    SELECT
      indexname,
      indexdef
    FROM pg_indexes
    WHERE tablename = 'documents'
      AND indexdef LIKE '%gin%'
      AND indexdef LIKE '%content%'
  `);

  expect(indexResult.rows).toHaveLength(1);

  const indexDef = indexResult.rows[0].indexdef;

  expect(indexDef).toContain("gin");
  expect(indexDef).toContain("to_tsvector");
  expect(indexDef).toContain("content");
});
```

**Validation**:
- [ ] GIN index exists
- [ ] Index on content column
- [ ] tsvector configuration correct

---

### Task 2.7: Test Vector Search Functionality
**Time**: 1 hour
**Priority**: HIGH
**Dependencies**: Tasks 2.4, 2.5

**Test**: Verify vector search works end-to-end

```typescript
it("should perform vector search and return similar vectors", async () => {
  // Insert test data
  const libraryResult = await client.query(
    "INSERT INTO libraries (name) VALUES ($1) RETURNING id",
    ["test-lib"]
  );
  const libraryId = libraryResult.rows[0].id;

  const versionResult = await client.query(
    "INSERT INTO versions (library_id, name) VALUES ($1, $2) RETURNING id",
    [libraryId, "1.0.0"]
  );
  const versionId = versionResult.rows[0].id;

  const pageResult = await client.query(
    `INSERT INTO pages (version_id, url, title, content_type)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [versionId, "https://example.com/doc1", "Test Doc", "text/html"]
  );
  const pageId = pageResult.rows[0].id;

  // Create test vector
  const testVector = Array(1536).fill(0).map((_, i) => i < 100 ? 0.8 : 0.1);

  const docResult = await client.query(
    `INSERT INTO documents (page_id, content, metadata, sort_order, embedding)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [
      pageId,
      "Test content about machine learning",
      JSON.stringify({ title: "Test" }),
      1,
      JSON.stringify(testVector)
    ]
  );

  // Perform vector search
  const searchVector = Array(1536).fill(0).map((_, i) => i < 100 ? 0.75 : 0.1);

  const searchResult = await client.query(`
    SELECT
      id,
      content,
      1 - (embedding <=> $1::vector) as similarity
    FROM documents
    WHERE page_id IN (
      SELECT id FROM pages WHERE version_id = $2
    )
    ORDER BY embedding <=> $1::vector
    LIMIT 5
  `, [JSON.stringify(searchVector), versionId]);

  expect(searchResult.rows).toHaveLength(1);
  expect(searchResult.rows[0].content).toContain("machine learning");
  expect(searchResult.rows[0].similarity).toBeGreaterThan(0.9); // Very similar vectors
});
```

**Validation**:
- [ ] Vector search executes without errors
- [ ] Similarity scores calculated correctly
- [ ] Results ordered by similarity
- [ ] HNSW index being used (check EXPLAIN if possible)

---

### Task 2.8: Test Full-Text Search Functionality
**Time**: 45 minutes
**Priority**: HIGH
**Dependencies**: Tasks 2.2, 2.6

**Test**: Verify FTS works with GIN index

```typescript
it("should perform full-text search with GIN index", async () => {
  // Insert test data (reuse library/version/page from previous test or create new)
  const libraryResult = await client.query(
    "INSERT INTO libraries (name) VALUES ($1) RETURNING id",
    ["fts-test-lib"]
  );
  const libraryId = libraryResult.rows[0].id;

  const versionResult = await client.query(
    "INSERT INTO versions (library_id, name) VALUES ($1, $2) RETURNING id",
    [libraryId, "1.0.0"]
  );
  const versionId = versionResult.rows[0].id;

  const pageResult = await client.query(
    `INSERT INTO pages (version_id, url, title, content_type)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [versionId, "https://example.com/react", "React Guide", "text/html"]
  );
  const pageId = pageResult.rows[0].id;

  await client.query(
    `INSERT INTO documents (page_id, content, metadata, sort_order)
     VALUES ($1, $2, $3, $4)`,
    [
      pageId,
      "React hooks are a powerful feature for state management in functional components",
      JSON.stringify({ title: "React Hooks" }),
      1
    ]
  );

  // Perform FTS search
  const searchResult = await client.query(`
    SELECT
      d.id,
      d.content,
      ts_rank(to_tsvector('english', d.content), query) as rank
    FROM documents d
    JOIN pages p ON d.page_id = p.id
    CROSS JOIN plainto_tsquery('english', $1) query
    WHERE to_tsvector('english', d.content) @@ query
      AND p.version_id = $2
    ORDER BY rank DESC
    LIMIT 5
  `, ["react hooks", versionId]);

  expect(searchResult.rows).toHaveLength(1);
  expect(searchResult.rows[0].content).toContain("React hooks");
  expect(searchResult.rows[0].rank).toBeGreaterThan(0);
});
```

**Validation**:
- [ ] FTS executes without errors
- [ ] Ranking scores calculated
- [ ] Results match search terms
- [ ] GIN index being used (check EXPLAIN if possible)

---

### Task 2.9: Test Migration Idempotency
**Time**: 30 minutes
**Priority**: MEDIUM
**Dependencies**: Task 2.2

**Test**: Verify migrations can run twice safely

```typescript
it("should handle repeated migration application gracefully", async () => {
  // Migrations already applied in beforeEach
  // Try to apply again
  await expect(applyMigrations((testDb.store as any).client)).resolves.not.toThrow();

  // Verify migration_history shows all migrations only once
  const historyResult = await client.query(`
    SELECT migration_name, COUNT(*) as count
    FROM migration_history
    GROUP BY migration_name
    HAVING COUNT(*) > 1
  `);

  // Should have no duplicates
  expect(historyResult.rows).toHaveLength(0);
});
```

**Validation**:
- [ ] Migrations don't error when run twice
- [ ] No duplicate migration history entries
- [ ] Database state unchanged on second run

---

### Task 2.10: Full applyMigrations Test Validation
**Time**: 30 minutes
**Priority**: CRITICAL
**Dependencies**: All Task 2.x

**Steps**:
1. Run full test suite:
   ```bash
   npm test -- applyMigrations.test.ts
   ```

2. Verify all tests pass:
   - Expected: 9+ tests passing

3. Check test execution time:
   - Target: < 45 seconds

4. Verify no SQLite dependencies:
   ```bash
   grep -i "sqlite" src/store/applyMigrations.test.ts
   # Should return no results
   ```

**Validation**:
- [ ] All 9+ tests passing
- [ ] Test execution time < 45 seconds
- [ ] No SQLite dependencies
- [ ] Coverage on applyMigrations.ts ≥ 70%

---

## Day 3: DocumentRetrieverService & CLI Tests

### Task 3.1: Review DocumentRetrieverService.test.ts
**Time**: 30 minutes
**Priority**: MEDIUM
**Dependencies**: None

**Steps**:
1. Read test file thoroughly
2. Identify any PostgreSQL-specific concerns
3. Check mock connection strings
4. Verify RRF scoring tests exist

**Validation**:
- [ ] Test file reviewed
- [ ] No changes needed (expected)
- [ ] Run: `npm test -- DocumentRetrieverService.test.ts`
- [ ] All tests pass

---

### Task 3.2: Add RRF Scoring Tests
**Time**: 1 hour
**Priority**: MEDIUM
**Dependencies**: Task 3.1

**Test**: Validate Reciprocal Rank Fusion scoring

```typescript
describe("RRF (Reciprocal Rank Fusion) Scoring", () => {
  it("should calculate RRF score correctly for hybrid results", async () => {
    const library = "lib";
    const version = "1.0.0";
    const query = "test";

    const result1 = new Document({
      id: "doc1",
      pageContent: "Content 1",
      metadata: {
        url: "url1",
        score: 0.9,
        vec_rank: 1,  // Best vector match
        fts_rank: 5,  // Mediocre text match
      },
    });

    const result2 = new Document({
      id: "doc2",
      pageContent: "Content 2",
      metadata: {
        url: "url2",
        score: 0.85,
        vec_rank: 3,  // Mediocre vector match
        fts_rank: 1,  // Best text match
      },
    });

    vi.spyOn(mockDocumentStore, "findByContent").mockResolvedValue([
      result1,
      result2,
    ]);
    vi.spyOn(mockDocumentStore, "findParentChunk").mockResolvedValue(null);
    vi.spyOn(mockDocumentStore, "findPrecedingSiblingChunks").mockResolvedValue([]);
    vi.spyOn(mockDocumentStore, "findChildChunks").mockResolvedValue([]);
    vi.spyOn(mockDocumentStore, "findSubsequentSiblingChunks").mockResolvedValue([]);
    vi.spyOn(mockDocumentStore, "findChunksByIds").mockImplementation(
      async (_, __, ids) => {
        if (ids.includes("doc1")) return [result1];
        if (ids.includes("doc2")) return [result2];
        return [];
      }
    );

    const results = await retrieverService.search(library, version, query);

    expect(results).toHaveLength(2);

    // Verify RRF scoring favors balanced results
    // RRF formula: score = w_vec/(k + vec_rank) + w_fts/(k + fts_rank)
    // Assuming k=60, w_vec=1.0, w_fts=1.0
    // doc1: 1.0/(60+1) + 1.0/(60+5) = 0.0164 + 0.0154 = 0.0318
    // doc2: 1.0/(60+3) + 1.0/(60+1) = 0.0159 + 0.0164 = 0.0323
    // doc2 should rank higher due to better text match

    expect(results[0].url).toBe("url2"); // Better balanced score
    expect(results[1].url).toBe("url1");
  });

  it("should handle results with only vector rank", async () => {
    const library = "lib";
    const version = "1.0.0";
    const query = "test";

    const vectorOnlyResult = new Document({
      id: "doc1",
      pageContent: "Vector match only",
      metadata: {
        url: "url1",
        score: 0.8,
        vec_rank: 1,
        // No fts_rank
      },
    });

    vi.spyOn(mockDocumentStore, "findByContent").mockResolvedValue([vectorOnlyResult]);
    vi.spyOn(mockDocumentStore, "findParentChunk").mockResolvedValue(null);
    vi.spyOn(mockDocumentStore, "findPrecedingSiblingChunks").mockResolvedValue([]);
    vi.spyOn(mockDocumentStore, "findChildChunks").mockResolvedValue([]);
    vi.spyOn(mockDocumentStore, "findSubsequentSiblingChunks").mockResolvedValue([]);
    vi.spyOn(mockDocumentStore, "findChunksByIds").mockResolvedValue([vectorOnlyResult]);

    const results = await retrieverService.search(library, version, query);

    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(0.8);
  });

  it("should handle results with only FTS rank", async () => {
    const library = "lib";
    const version = "1.0.0";
    const query = "test";

    const ftsOnlyResult = new Document({
      id: "doc1",
      pageContent: "FTS match only",
      metadata: {
        url: "url1",
        score: 0.7,
        fts_rank: 1,
        // No vec_rank
      },
    });

    vi.spyOn(mockDocumentStore, "findByContent").mockResolvedValue([ftsOnlyResult]);
    vi.spyOn(mockDocumentStore, "findParentChunk").mockResolvedValue(null);
    vi.spyOn(mockDocumentStore, "findPrecedingSiblingChunks").mockResolvedValue([]);
    vi.spyOn(mockDocumentStore, "findChildChunks").mockResolvedValue([]);
    vi.spyOn(mockDocumentStore, "findSubsequentSiblingChunks").mockResolvedValue([]);
    vi.spyOn(mockDocumentStore, "findChunksByIds").mockResolvedValue([ftsOnlyResult]);

    const results = await retrieverService.search(library, version, query);

    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(0.7);
  });
});
```

**Validation**:
- [ ] RRF scoring tests added
- [ ] All new tests pass
- [ ] Validates hybrid search behavior

---

### Task 3.3: Verify CLI Tests
**Time**: 1 hour
**Priority**: MEDIUM
**Dependencies**: None

**Files to Test**:
1. `/home/mp/Workspace/docs-mcp-server/src/cli/commands/search.test.ts`
2. `/home/mp/Workspace/docs-mcp-server/src/cli/commands/list.test.ts`
3. `/home/mp/Workspace/docs-mcp-server/src/cli/commands/fetchUrl.test.ts`
4. `/home/mp/Workspace/docs-mcp-server/src/cli/commands/findVersion.test.ts`
5. `/home/mp/Workspace/docs-mcp-server/src/cli/commands/scrape.test.ts`
6. `/home/mp/Workspace/docs-mcp-server/src/cli/commands/remove.test.ts`

**Steps for Each File**:
1. Run test:
   ```bash
   npm test -- src/cli/commands/search.test.ts
   ```

2. Verify passes

3. Check for SQLite-specific code:
   ```bash
   grep -i "memory\|sqlite" src/cli/commands/search.test.ts
   ```

4. Update if needed (likely no changes required)

**Validation**:
- [ ] search.test.ts passes
- [ ] list.test.ts passes
- [ ] fetchUrl.test.ts passes
- [ ] findVersion.test.ts passes
- [ ] scrape.test.ts passes
- [ ] remove.test.ts passes
- [ ] All 6 CLI test files pass
- [ ] Total execution time < 20 seconds

---

### Task 3.4: Run Full Test Suite
**Time**: 30 minutes
**Priority**: HIGH
**Dependencies**: All Day 1-3 tasks

**Steps**:
1. Run all store tests:
   ```bash
   npm test -- src/store/
   ```

2. Run all CLI tests:
   ```bash
   npm test -- src/cli/commands/
   ```

3. Run full test suite:
   ```bash
   npm test
   ```

4. Generate coverage report:
   ```bash
   npm run test:coverage
   ```

**Validation**:
- [ ] All store tests pass
- [ ] All CLI tests pass
- [ ] Overall test execution < 5 minutes
- [ ] Coverage report generated

---

### Task 3.5: Verify Coverage Thresholds
**Time**: 30 minutes
**Priority**: HIGH
**Dependencies**: Task 3.4

**Steps**:
1. Review coverage report

2. Check store layer coverage:
   - DocumentStore.ts: Should be ≥ 60%
   - applyMigrations.ts: Should be ≥ 70%
   - DocumentRetrieverService.ts: Should be ≥ 60%

3. If below threshold, identify uncovered lines:
   ```bash
   npm run test:coverage -- --reporter=html
   # Open coverage/index.html in browser
   ```

4. Add tests for critical uncovered paths

**Validation**:
- [ ] Overall coverage ≥ 60%
- [ ] Store layer coverage ≥ 60%
- [ ] No critical paths uncovered
- [ ] Coverage report saved

---

## Day 4: POSTGRESQL_SETUP.md Documentation

### Task 4.1: Docker Installation Section
**Time**: 1 hour
**Priority**: HIGH
**Dependencies**: None

**File**: `/home/mp/Workspace/docs-mcp-server/docs/POSTGRESQL_SETUP.md`

**Content to Create**:

```markdown
# PostgreSQL Setup Guide

Complete guide to installing and configuring PostgreSQL with pgvector extension for Scrapegoat.

## Quick Start with Docker (Recommended)

The fastest way to get started is using Docker with our pre-configured setup.

### Prerequisites
- Docker 20.10+ installed
- Docker Compose 2.0+ installed

### Installation Steps

1. **Create docker-compose.yml**:

   Create a file named `docker-compose.yml` in your project directory:

   \`\`\`yaml
   version: '3.8'

   services:
     postgres:
       image: pgvector/pgvector:pg16
       container_name: scrapegoat-db
       environment:
         POSTGRES_USER: scrapegoat
         POSTGRES_PASSWORD: your_secure_password_here
         POSTGRES_DB: scrapegoat
       ports:
         - "5432:5432"
       volumes:
         - pgdata:/var/lib/postgresql/data
       healthcheck:
         test: ["CMD-SHELL", "pg_isready -U scrapegoat"]
         interval: 5s
         timeout: 5s
         retries: 5

   volumes:
     pgdata:
   \`\`\`

2. **Start PostgreSQL**:

   \`\`\`bash
   docker-compose up -d
   \`\`\`

3. **Verify Installation**:

   \`\`\`bash
   docker-compose ps
   # Should show postgres service as "healthy"

   # Test connection
   docker-compose exec postgres psql -U scrapegoat -c "SELECT version();"
   \`\`\`

4. **Configure Scrapegoat**:

   Create or update your `.env` file:

   \`\`\`bash
   DATABASE_URL=postgresql://scrapegoat:your_secure_password_here@localhost:5432/scrapegoat
   \`\`\`

5. **Initialize Database**:

   Scrapegoat will automatically create tables and indexes on first run:

   \`\`\`bash
   npm run cli list
   \`\`\`

✅ **Setup Complete!** Skip to [Verification](#verification) section.

---
```

**Validation**:
- [ ] Section written
- [ ] Docker commands tested
- [ ] Connection verified

---

### Task 4.2: Manual Installation Sections
**Time**: 2 hours
**Priority**: HIGH
**Dependencies**: Task 4.1

**Platforms to Cover**:
1. Ubuntu/Debian
2. macOS (Homebrew)
3. Windows

**Content Structure** (for each platform):

```markdown
## Manual Installation

### Ubuntu/Debian

#### 1. Install PostgreSQL 16

\`\`\`bash
# Add PostgreSQL repository
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# Update and install
sudo apt update
sudo apt install -y postgresql-16 postgresql-contrib-16
\`\`\`

#### 2. Install pgvector Extension

\`\`\`bash
# Install build dependencies
sudo apt install -y postgresql-server-dev-16 build-essential git

# Clone and build pgvector
cd /tmp
git clone --branch v0.7.0 https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
\`\`\`

#### 3. Configure PostgreSQL

\`\`\`bash
# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE USER scrapegoat WITH PASSWORD 'your_secure_password_here';
CREATE DATABASE scrapegoat OWNER scrapegoat;
\c scrapegoat
CREATE EXTENSION vector;
GRANT ALL PRIVILEGES ON DATABASE scrapegoat TO scrapegoat;
EOF
\`\`\`

#### 4. Configure Connection

Update `/etc/postgresql/16/main/postgresql.conf`:

\`\`\`ini
listen_addresses = 'localhost'  # Or '*' for remote access
max_connections = 100
shared_buffers = 256MB
\`\`\`

Update `/etc/postgresql/16/main/pg_hba.conf`:

\`\`\`
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             all                                     peer
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256
\`\`\`

Restart PostgreSQL:

\`\`\`bash
sudo systemctl restart postgresql
\`\`\`

---

### macOS (Homebrew)

[Similar detailed instructions for macOS]

---

### Windows

[Similar detailed instructions for Windows]

---
```

**Validation**:
- [ ] Ubuntu instructions complete and tested
- [ ] macOS instructions complete
- [ ] Windows instructions complete

---

### Task 4.3: Verification & Configuration Sections
**Time**: 1 hour
**Priority**: HIGH
**Dependencies**: Tasks 4.1, 4.2

**Content**:

```markdown
## Verification

### 1. Test Connection

\`\`\`bash
psql "postgresql://scrapegoat:your_password@localhost:5432/scrapegoat" -c "SELECT version();"
\`\`\`

Expected output:
\`\`\`
PostgreSQL 16.x on x86_64-pc-linux-gnu, compiled by gcc ...
\`\`\`

### 2. Verify pgvector Extension

\`\`\`bash
psql "postgresql://scrapegoat:your_password@localhost:5432/scrapegoat" -c "SELECT * FROM pg_extension WHERE extname = 'vector';"
\`\`\`

Expected output:
\`\`\`
extname | extowner | extnamespace | extrelocatable | extversion
---------+----------+--------------+----------------+------------
vector   | ...      | ...          | t              | 0.7.0
\`\`\`

### 3. Test Vector Operations

\`\`\`bash
psql "postgresql://scrapegoat:your_password@localhost:5432/scrapegoat" << EOF
CREATE TABLE test_vectors (id serial PRIMARY KEY, embedding vector(3));
INSERT INTO test_vectors (embedding) VALUES ('[1,2,3]');
SELECT * FROM test_vectors;
DROP TABLE test_vectors;
EOF
\`\`\`

---

## Configuration

### Connection String Format

\`\`\`
postgresql://username:password@hostname:port/database?options
\`\`\`

**Components**:
- `username`: PostgreSQL user (e.g., `scrapegoat`)
- `password`: User password (URL-encode special characters)
- `hostname`: Server address (`localhost` or IP/domain)
- `port`: PostgreSQL port (default: `5432`)
- `database`: Database name (e.g., `scrapegoat`)
- `options`: Optional parameters (e.g., `?sslmode=require`)

**Examples**:

\`\`\`bash
# Local development
postgresql://scrapegoat:password123@localhost:5432/scrapegoat

# Remote server with SSL
postgresql://user:pass@db.example.com:5432/scrapegoat?sslmode=require

# Password with special characters (URL-encoded)
postgresql://user:p%40ssw0rd@localhost:5432/scrapegoat
\`\`\`

### Environment Variables

Set in `.env` file or shell:

\`\`\`bash
DATABASE_URL=postgresql://scrapegoat:password@localhost:5432/scrapegoat
\`\`\`

### Connection Pool Settings

For production, configure connection pooling:

\`\`\`bash
# Maximum number of connections in pool
DATABASE_POOL_MAX=20

# Minimum idle connections
DATABASE_POOL_MIN=5

# Connection timeout (ms)
DATABASE_CONNECT_TIMEOUT=5000
\`\`\`

See [CONFIGURATION.md](./CONFIGURATION.md) for complete reference.

---
```

**Validation**:
- [ ] Verification steps tested
- [ ] Configuration examples valid
- [ ] Links to CONFIGURATION.md added

---

### Task 4.4: Troubleshooting Section
**Time**: 1 hour
**Priority**: MEDIUM
**Dependencies**: Task 4.3

**Content**:

```markdown
## Troubleshooting

### Connection Refused

**Error**: `connection refused at port 5432`

**Solutions**:
1. Verify PostgreSQL is running:
   \`\`\`bash
   # Ubuntu/Debian
   sudo systemctl status postgresql

   # macOS
   brew services list

   # Docker
   docker-compose ps
   \`\`\`

2. Check port is correct:
   \`\`\`bash
   sudo netstat -tlnp | grep postgres
   \`\`\`

3. Verify `listen_addresses` in `postgresql.conf`:
   \`\`\`ini
   listen_addresses = '*'  # Or 'localhost'
   \`\`\`

---

### Authentication Failed

**Error**: `password authentication failed for user "scrapegoat"`

**Solutions**:
1. Verify password is correct
2. Check `pg_hba.conf` authentication method:
   \`\`\`
   host    all             all             127.0.0.1/32            scram-sha-256
   \`\`\`

3. Reset password if needed:
   \`\`\`bash
   sudo -u postgres psql -c "ALTER USER scrapegoat WITH PASSWORD 'new_password';"
   \`\`\`

---

### pgvector Extension Not Found

**Error**: `extension "vector" is not available`

**Solutions**:
1. Verify pgvector is installed:
   \`\`\`bash
   ls -la /usr/share/postgresql/16/extension/vector*
   \`\`\`

2. Reinstall pgvector if missing (see [Manual Installation](#manual-installation))

3. Try creating extension manually:
   \`\`\`bash
   sudo -u postgres psql -d scrapegoat -c "CREATE EXTENSION vector;"
   \`\`\`

---

### Permission Denied

**Error**: `permission denied for database scrapegoat`

**Solutions**:
1. Grant permissions:
   \`\`\`bash
   sudo -u postgres psql << EOF
   GRANT ALL PRIVILEGES ON DATABASE scrapegoat TO scrapegoat;
   \c scrapegoat
   GRANT ALL ON SCHEMA public TO scrapegoat;
   EOF
   \`\`\`

---

### Migration Failures

**Error**: `migration failed to apply`

**Solutions**:
1. Check migration history:
   \`\`\`bash
   psql $DATABASE_URL -c "SELECT * FROM migration_history ORDER BY executed_at;"
   \`\`\`

2. Manually apply failed migration (see [MIGRATION.md](./MIGRATION.md))

3. Drop and recreate database (⚠️ data loss):
   \`\`\`bash
   sudo -u postgres psql << EOF
   DROP DATABASE scrapegoat;
   CREATE DATABASE scrapegoat OWNER scrapegoat;
   \c scrapegoat
   CREATE EXTENSION vector;
   EOF
   \`\`\`

---

### Performance Issues

See [PERFORMANCE.md](./PERFORMANCE.md) for tuning guidance.

---
```

**Validation**:
- [ ] Common issues covered
- [ ] Solutions tested
- [ ] Links added

---

### Task 4.5: Finalize POSTGRESQL_SETUP.md
**Time**: 30 minutes
**Priority**: MEDIUM
**Dependencies**: All Task 4.x

**Steps**:
1. Add table of contents
2. Add cross-references to other docs
3. Proofread and format
4. Test all commands
5. Update docs/README.md status

**Validation**:
- [ ] TOC complete
- [ ] Cross-references added
- [ ] All commands tested
- [ ] docs/README.md updated to show ✅ Complete

---

## Day 5: CONFIGURATION.md Documentation

### Task 5.1: Database Configuration Section
**Time**: 1 hour
**Priority**: HIGH
**Dependencies**: None

**File**: `/home/mp/Workspace/docs-mcp-server/docs/CONFIGURATION.md`

**Content**:

```markdown
# Configuration Reference

Complete reference for all Scrapegoat configuration options and environment variables.

## Table of Contents

1. [Database Configuration](#database-configuration)
2. [Embedding Configuration](#embedding-configuration)
3. [Search Configuration](#search-configuration)
4. [Performance Tuning](#performance-tuning)
5. [Analytics/Telemetry](#analytics-telemetry)
6. [Development/Testing](#development-testing)
7. [Migration from SQLite](#migration-from-sqlite)

---

## Database Configuration

### DATABASE_URL

**Required**: Yes
**Type**: Connection String
**Purpose**: PostgreSQL database connection string

**Format**:
\`\`\`
postgresql://username:password@hostname:port/database?options
\`\`\`

**Example**:
\`\`\`bash
DATABASE_URL=postgresql://scrapegoat:password@localhost:5432/scrapegoat
\`\`\`

**Components**:
- **username**: PostgreSQL user
- **password**: User password (URL-encode special characters)
- **hostname**: Server address
- **port**: PostgreSQL port (default: 5432)
- **database**: Database name
- **options**: Connection options (sslmode, connect_timeout, etc.)

**SSL Options**:
\`\`\`bash
# Require SSL
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require

# SSL with certificate verification
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=verify-full&sslrootcert=/path/to/ca.crt
\`\`\`

**Special Characters in Password**:
URL-encode special characters:
- `@` → `%40`
- `:` → `%3A`
- `/` → `%2F`
- `?` → `%3F`

**Example**:
\`\`\`bash
# Password: p@ss:word/123
DATABASE_URL=postgresql://user:p%40ss%3Aword%2F123@localhost:5432/db
\`\`\`

---

### Connection Pool Settings

Control PostgreSQL connection pooling behavior.

#### DATABASE_POOL_MAX

**Default**: 20
**Type**: Integer (1-100)
**Purpose**: Maximum connections in pool

\`\`\`bash
DATABASE_POOL_MAX=20
\`\`\`

**Guidance**:
- Development: 5-10
- Production (light): 10-20
- Production (heavy): 20-50
- Consider PostgreSQL `max_connections` setting

---

#### DATABASE_POOL_MIN

**Default**: 5
**Type**: Integer (0-DATABASE_POOL_MAX)
**Purpose**: Minimum idle connections

\`\`\`bash
DATABASE_POOL_MIN=5
\`\`\`

**Guidance**:
- Keep at least 2-5 idle connections
- Higher values reduce connection latency
- Lower values reduce resource usage

---

#### DATABASE_CONNECT_TIMEOUT

**Default**: 5000 (5 seconds)
**Type**: Integer (milliseconds)
**Purpose**: Connection timeout

\`\`\`bash
DATABASE_CONNECT_TIMEOUT=5000
\`\`\`

---

#### DATABASE_IDLE_TIMEOUT

**Default**: 30000 (30 seconds)
**Type**: Integer (milliseconds)
**Purpose**: Idle connection timeout

\`\`\`bash
DATABASE_IDLE_TIMEOUT=30000
\`\`\`

---
```

**Validation**:
- [ ] DATABASE_URL documented
- [ ] Connection pool settings documented
- [ ] Examples tested

---

### Task 5.2: Embedding Configuration Section
**Time**: 1.5 hours
**Priority**: HIGH
**Dependencies**: Task 5.1

**Content**:

```markdown
## Embedding Configuration

Configure embedding model providers and settings.

### DOCS_MCP_EMBEDDING_MODEL

**Required**: No (defaults to OpenAI)
**Type**: String
**Format**: `provider:model_name` or `model_name` (assumes OpenAI)
**Purpose**: Embedding model selection

**Supported Providers**:
- `openai`: OpenAI embeddings
- `vertex`: Google Cloud Vertex AI
- `gemini`: Google Generative AI
- `aws`: AWS Bedrock
- `microsoft`: Azure OpenAI

**Examples**:
\`\`\`bash
# OpenAI (default)
DOCS_MCP_EMBEDDING_MODEL=text-embedding-3-small

# OpenAI explicit
DOCS_MCP_EMBEDDING_MODEL=openai:text-embedding-3-large

# Google Vertex AI
DOCS_MCP_EMBEDDING_MODEL=vertex:text-embedding-004

# Google Gemini
DOCS_MCP_EMBEDDING_MODEL=gemini:gemini-embedding-exp-03-07

# AWS Bedrock
DOCS_MCP_EMBEDDING_MODEL=aws:amazon.titan-embed-text-v1

# Azure OpenAI
DOCS_MCP_EMBEDDING_MODEL=microsoft:text-embedding-ada-002
\`\`\`

---

### OpenAI Configuration

#### OPENAI_API_KEY

**Required**: Yes (for OpenAI provider)
**Type**: API Key String
**Purpose**: OpenAI API authentication

\`\`\`bash
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
\`\`\`

**Get Key**: https://platform.openai.com/api-keys

---

#### OPENAI_ORG_ID

**Required**: No
**Type**: Organization ID
**Purpose**: OpenAI organization ID

\`\`\`bash
OPENAI_ORG_ID=org-xxxxxxxxxxxxx
\`\`\`

---

#### OPENAI_API_BASE

**Required**: No
**Type**: URL
**Purpose**: Custom base URL for OpenAI-compatible APIs

\`\`\`bash
# Ollama
OPENAI_API_BASE=http://localhost:11434/v1

# Azure OpenAI
OPENAI_API_BASE=https://your-resource.openai.azure.com
\`\`\`

---

### Google Cloud Vertex AI Configuration

#### GOOGLE_APPLICATION_CREDENTIALS

**Required**: Yes (for vertex provider)
**Type**: File Path
**Purpose**: Path to GCP service account JSON key

\`\`\`bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/gcp-service-account.json
\`\`\`

**Setup**:
1. Create service account in GCP Console
2. Grant "Vertex AI User" role
3. Download JSON key
4. Set path in environment variable

---

### Google Generative AI (Gemini) Configuration

#### GOOGLE_API_KEY

**Required**: Yes (for gemini provider)
**Type**: API Key String
**Purpose**: Google AI API authentication

\`\`\`bash
GOOGLE_API_KEY=AIzaSyxxxxxxxxxxxxx
\`\`\`

**Get Key**: https://aistudio.google.com/app/apikey

---

### AWS Bedrock Configuration

#### AWS_ACCESS_KEY_ID

**Required**: Yes (for aws provider)
**Type**: AWS Access Key
**Purpose**: AWS authentication

\`\`\`bash
AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxxxxx
\`\`\`

---

#### AWS_SECRET_ACCESS_KEY

**Required**: Yes (for aws provider)
**Type**: AWS Secret Key
**Purpose**: AWS authentication

\`\`\`bash
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxx
\`\`\`

---

#### AWS_REGION

**Required**: Yes (for aws provider)
**Type**: AWS Region
**Purpose**: AWS region for Bedrock

\`\`\`bash
AWS_REGION=us-east-1
\`\`\`

**Supported Regions**: us-east-1, us-west-2, etc.

---

#### BEDROCK_AWS_REGION

**Required**: No
**Type**: AWS Region
**Purpose**: Override AWS_REGION specifically for Bedrock

\`\`\`bash
BEDROCK_AWS_REGION=us-east-1
\`\`\`

---

### Azure OpenAI Configuration

#### AZURE_OPENAI_API_KEY

**Required**: Yes (for microsoft provider)
**Type**: API Key String
**Purpose**: Azure OpenAI authentication

\`\`\`bash
AZURE_OPENAI_API_KEY=xxxxxxxxxxxxxxxxxxxxx
\`\`\`

---

#### AZURE_OPENAI_API_INSTANCE_NAME

**Required**: Yes (for microsoft provider)
**Type**: String
**Purpose**: Azure OpenAI resource name

\`\`\`bash
AZURE_OPENAI_API_INSTANCE_NAME=your-resource-name
\`\`\`

---

#### AZURE_OPENAI_API_DEPLOYMENT_NAME

**Required**: Yes (for microsoft provider)
**Type**: String
**Purpose**: Azure OpenAI deployment name

\`\`\`bash
AZURE_OPENAI_API_DEPLOYMENT_NAME=your-deployment
\`\`\`

---

#### AZURE_OPENAI_API_VERSION

**Required**: No
**Default**: 2024-02-01
**Type**: Version String
**Purpose**: Azure OpenAI API version

\`\`\`bash
AZURE_OPENAI_API_VERSION=2024-02-01
\`\`\`

---

### Embedding Batch Configuration

#### DOCS_MCP_EMBEDDING_BATCH_CHARS

**Default**: 50000 (50 KB)
**Type**: Integer (characters)
**Purpose**: Maximum characters per embedding batch

\`\`\`bash
DOCS_MCP_EMBEDDING_BATCH_CHARS=50000
\`\`\`

**Tuning**:
- Increase for better performance (if API supports)
- Decrease if getting "413 Request entity too large" errors
- Consider provider limits

---

#### DOCS_MCP_EMBEDDING_BATCH_SIZE

**Default**: 100
**Type**: Integer (documents)
**Purpose**: Maximum documents per embedding batch

\`\`\`bash
DOCS_MCP_EMBEDDING_BATCH_SIZE=100
\`\`\`

**Tuning**:
- Increase for better performance
- Decrease if hitting rate limits
- Balance with BATCH_CHARS for optimal performance

---
```

**Validation**:
- [ ] All embedding providers documented
- [ ] All provider variables documented
- [ ] Batch configuration documented

---

### Task 5.3: Search & Performance Configuration
**Time**: 1 hour
**Priority**: MEDIUM
**Dependencies**: Task 5.2

**Content**:

```markdown
## Search Configuration

Configure hybrid search behavior (vector + full-text + RRF).

### SEARCH_WEIGHT_VEC

**Default**: 1.0
**Type**: Float (0.0-10.0)
**Purpose**: Weight for vector search in RRF

\`\`\`bash
SEARCH_WEIGHT_VEC=1.0
\`\`\`

**Tuning**:
- Increase to favor semantic similarity
- Decrease to favor keyword matching
- Must balance with SEARCH_WEIGHT_FTS

---

### SEARCH_WEIGHT_FTS

**Default**: 1.0
**Type**: Float (0.0-10.0)
**Purpose**: Weight for full-text search in RRF

\`\`\`bash
SEARCH_WEIGHT_FTS=1.0
\`\`\`

**Tuning**:
- Increase to favor keyword matching
- Decrease to favor semantic similarity
- Must balance with SEARCH_WEIGHT_VEC

---

### VECTOR_SEARCH_MULTIPLIER

**Default**: 1.0
**Type**: Float (0.5-2.0)
**Purpose**: Vector search result multiplier

\`\`\`bash
VECTOR_SEARCH_MULTIPLIER=1.0
\`\`\`

**Purpose**:
- Adjusts number of vector results fetched
- Higher values increase recall but reduce performance

---

### SEARCH_OVERFETCH_FACTOR

**Default**: 2.0
**Type**: Float (1.0-5.0)
**Purpose**: Overfetch multiplier for RRF

\`\`\`bash
SEARCH_OVERFETCH_FACTOR=2.0
\`\`\`

**Purpose**:
- Fetches more results than requested for better RRF merging
- `limit=10` → fetches 20 from each source, returns top 10
- Higher values improve result quality but reduce performance

---

## Performance Tuning

### MAX_CONCURRENCY

**Default**: 3
**Type**: Integer (1-20)
**Purpose**: Maximum concurrent scraping operations

\`\`\`bash
MAX_CONCURRENCY=3
\`\`\`

**Tuning**:
- Development: 1-3
- Production (light): 3-5
- Production (heavy): 5-10
- Consider server resources and target site limits

---

### Query Timeouts

Control database query timeouts.

#### DATABASE_STATEMENT_TIMEOUT

**Default**: 30000 (30 seconds)
**Type**: Integer (milliseconds)
**Purpose**: Maximum query execution time

\`\`\`bash
DATABASE_STATEMENT_TIMEOUT=30000
\`\`\`

---

## Analytics/Telemetry

### POSTHOG_API_KEY

**Required**: No
**Type**: API Key String
**Purpose**: PostHog analytics tracking

\`\`\`bash
POSTHOG_API_KEY=phc_xxxxxxxxxxxxx
\`\`\`

**Get Key**: https://app.posthog.com/project/settings

**Privacy**: Leave empty to disable all telemetry

---

## Development/Testing

### TEST_DATABASE_URL

**Required**: No (for testing)
**Type**: Connection String
**Purpose**: PostgreSQL connection for tests

\`\`\`bash
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/postgres
\`\`\`

**Default**: Uses local Docker test database (port 5433)

---

### NODE_ENV

**Default**: production
**Type**: String (development | production | test)
**Purpose**: Environment mode

\`\`\`bash
NODE_ENV=development
\`\`\`

**Effects**:
- development: Verbose logging, no telemetry
- production: Minimal logging, telemetry enabled
- test: Test mode, telemetry disabled

---

### DEBUG_LOGGING

**Default**: false
**Type**: Boolean
**Purpose**: Enable debug logging

\`\`\`bash
DEBUG_LOGGING=true
\`\`\`

---

## Migration from SQLite

### Deprecated Configuration

The following SQLite-specific variables are **no longer supported**:

#### ~~DOCS_MCP_STORE_PATH~~ (DEPRECATED)

**Replaced by**: DATABASE_URL
**Migration**:

\`\`\`bash
# OLD (SQLite):
DOCS_MCP_STORE_PATH=/path/to/store.db

# NEW (PostgreSQL):
DATABASE_URL=postgresql://scrapegoat:password@localhost:5432/scrapegoat
\`\`\`

---

## Configuration File Examples

### Production Configuration

\`\`\`bash
# .env.production

# Database
DATABASE_URL=postgresql://scrapegoat:secure_password@db.example.com:5432/scrapegoat?sslmode=require
DATABASE_POOL_MAX=20
DATABASE_POOL_MIN=5

# Embeddings
DOCS_MCP_EMBEDDING_MODEL=openai:text-embedding-3-small
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx

# Search
SEARCH_WEIGHT_VEC=1.0
SEARCH_WEIGHT_FTS=1.0

# Performance
MAX_CONCURRENCY=5

# Analytics
POSTHOG_API_KEY=phc_xxxxxxxxxxxxx
\`\`\`

---

### Development Configuration

\`\`\`bash
# .env.development

# Database (local Docker)
DATABASE_URL=postgresql://scrapegoat:password@localhost:5432/scrapegoat
DATABASE_POOL_MAX=10

# Embeddings
DOCS_MCP_EMBEDDING_MODEL=openai:text-embedding-3-small
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx

# Development settings
NODE_ENV=development
DEBUG_LOGGING=true
MAX_CONCURRENCY=2

# No analytics in development
POSTHOG_API_KEY=
\`\`\`

---

### Testing Configuration

\`\`\`bash
# .env.test

# Test database (Docker Compose on port 5433)
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5433/postgres

# Embeddings (mocked in tests)
DOCS_MCP_EMBEDDING_MODEL=openai:text-embedding-3-small
OPENAI_API_KEY=test-key

# Test settings
NODE_ENV=test
DEBUG_LOGGING=false
POSTHOG_API_KEY=
\`\`\`

---

## See Also

- [POSTGRESQL_SETUP.md](./POSTGRESQL_SETUP.md) - Database installation
- [PERFORMANCE.md](./PERFORMANCE.md) - Performance tuning (Phase 5.3)
- [MIGRATION.md](./MIGRATION.md) - SQLite to PostgreSQL migration
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues (Phase 5.3)

---

*Last Updated: 2025-11-08*
```

**Validation**:
- [ ] All search configuration variables documented
- [ ] Performance tuning documented
- [ ] Analytics/telemetry documented
- [ ] Development/testing variables documented
- [ ] Migration guidance included
- [ ] Example configurations provided

---

### Task 5.4: Finalize CONFIGURATION.md
**Time**: 30 minutes
**Priority**: MEDIUM
**Dependencies**: Tasks 5.1, 5.2, 5.3

**Steps**:
1. Review all sections for completeness
2. Verify all variable names match codebase
3. Test all examples
4. Add cross-references
5. Update docs/README.md status

**Validation**:
- [ ] All variables documented
- [ ] Examples tested
- [ ] Cross-references added
- [ ] docs/README.md updated to show ✅ Complete

---

### Task 5.5: Final Coverage Verification
**Time**: 1 hour
**Priority**: HIGH
**Dependencies**: All Day 1-5 tasks

**Steps**:
1. Run full test suite:
   ```bash
   npm test
   ```

2. Generate coverage report:
   ```bash
   npm run test:coverage
   ```

3. Review coverage report:
   - Overall: Should be ≥ 60%
   - Store layer: Should be ≥ 60%
   - Critical paths: Should be covered

4. If below threshold, add missing tests

5. Generate HTML coverage report:
   ```bash
   npm run test:coverage -- --reporter=html
   ```

6. Review uncovered lines and justify or add tests

**Validation**:
- [ ] Overall coverage ≥ 60%
- [ ] Store layer coverage ≥ 60%
- [ ] All critical paths covered
- [ ] Coverage report saved and reviewed

---

## Final Validation

### Completion Checklist

**Tests**:
- [ ] DocumentStore.test.ts: 100% passing with PostgreSQL
- [ ] applyMigrations.test.ts: Rewritten and passing
- [ ] DocumentRetrieverService.test.ts: All tests passing
- [ ] CLI tests: All 6 files passing
- [ ] Test coverage: ≥60% overall, ≥60% store layer
- [ ] No SQLite dependencies remain
- [ ] Test execution time: < 5 minutes

**Documentation**:
- [ ] POSTGRESQL_SETUP.md: Complete with Docker + manual
- [ ] CONFIGURATION.md: All variables documented
- [ ] docs/README.md: Status updated
- [ ] Cross-references added between docs
- [ ] All examples tested

**Git**:
- [ ] All changes committed
- [ ] Commit messages descriptive
- [ ] Branch pushed to remote

---

## Rollback Plan

If Phase 5.2 cannot be completed:

1. **Revert Test Changes**:
   ```bash
   git checkout main -- src/store/DocumentStore.test.ts
   git checkout main -- src/store/applyMigrations.test.ts
   ```

2. **Keep Documentation**:
   - POSTGRESQL_SETUP.md and CONFIGURATION.md can remain as drafts

3. **Document Issues**:
   - Record blockers in STATUS.md
   - Plan remediation for next phase

---

*Implementation plan completed: 2025-11-08*
*Total estimated time: 5 days*
