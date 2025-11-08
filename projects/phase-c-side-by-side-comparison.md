# Phase C: Side-by-Side Code Comparison

## Setup & Teardown

### SQLite (Before)
```typescript
import Database, { type Database as DatabaseType } from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";

describe("Database Migrations", () => {
  let db: DatabaseType;

  beforeEach(() => {
    db = new Database(":memory:");
    sqliteVec.load(db);
  });

  afterEach(() => {
    db.close();
  });
});
```

### PostgreSQL (After)
```typescript
import { Pool, type PoolClient } from "pg";

const TEST_DATABASE_URL = "postgresql://postgres:postgres@postgres.den.lan/scrapegoat_test";

interface TestSchema {
  schemaName: string;
  pool: Pool;
  cleanup: () => Promise<void>;
}

async function createTestSchema(): Promise<TestSchema> {
  const schemaName = `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  const setupPool = new Pool({ connectionString: TEST_DATABASE_URL });
  const setupClient = await setupPool.connect();
  await setupClient.query(`CREATE SCHEMA ${schemaName}`);
  await setupClient.release();
  await setupPool.end();

  const pool = new Pool({
    connectionString: TEST_DATABASE_URL,
    options: `-c search_path=${schemaName},public`
  });

  const cleanup = async () => {
    await pool.end();
    const cleanupPool = new Pool({ connectionString: TEST_DATABASE_URL });
    const cleanupClient = await cleanupPool.connect();
    await cleanupClient.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
    await cleanupClient.release();
    await cleanupPool.end();
  };

  return { schemaName, pool, cleanup };
}

describe("Database Migrations (PostgreSQL)", () => {
  let pool: Pool;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const testSchema = await createTestSchema();
    pool = testSchema.pool;
    cleanup = testSchema.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });
});
```

---

## Test 1: Schema Validation

### SQLite (Before)
```typescript
it("should apply all migrations...", () => {
  applyMigrations(db);

  // Check tables
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    .all();

  const tableNames = tables.map(t => t.name);
  expect(tableNames).toContain("documents");
  expect(tableNames).toContain("documents_fts");  // Virtual table
  expect(tableNames).toContain("documents_vec");  // Virtual table

  // Check columns
  const columns = db.prepare("PRAGMA table_info(documents);").all();
  const columnNames = columns.map(col => col.name);
  expect(columnNames).toContain("embedding");

  // Check FTS virtual table
  const ftsTableInfo = db
    .prepare("SELECT sql FROM sqlite_master WHERE name='documents_fts';")
    .get();
  expect(ftsTableInfo.sql).toContain("VIRTUAL TABLE documents_fts USING fts5");

  // Check vector virtual table
  const vecTableInfo = db
    .prepare("SELECT sql FROM sqlite_master WHERE name='documents_vec';")
    .get();
  expect(vecTableInfo.sql).toContain("USING vec0");
});
```

### PostgreSQL (After)
```typescript
it("should apply all migrations...", async () => {
  await applyMigrations(pool);

  const client = await pool.connect();
  try {
    // Check tables
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = current_schema()
      ORDER BY table_name
    `);

    const tableNames = tablesResult.rows.map(r => r.table_name);
    expect(tableNames).toContain("documents");
    expect(tableNames).not.toContain("documents_fts");  // No virtual table!
    expect(tableNames).not.toContain("documents_vec");  // No virtual table!

    // Check columns
    const columnsResult = await client.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'documents'
      ORDER BY ordinal_position
    `);

    const columnNames = columnsResult.rows.map(r => r.column_name);
    expect(columnNames).toContain("embedding");

    // Verify embedding type is vector
    const embeddingCol = columnsResult.rows.find(r => r.column_name === "embedding");
    expect(embeddingCol.udt_name).toBe("vector");

    // Check pgvector extension
    const extResult = await client.query(`
      SELECT extname FROM pg_extension WHERE extname = 'vector'
    `);
    expect(extResult.rows.length).toBeGreaterThan(0);

    // Check GIN index for FTS (replaces virtual table)
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

    // Check HNSW index for vectors (replaces virtual table)
    const vectorIndexResult = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = current_schema()
        AND tablename = 'documents'
        AND indexname = 'idx_documents_embedding_hnsw'
    `);
    expect(vectorIndexResult.rows.length).toBe(1);
    expect(vectorIndexResult.rows[0].indexdef).toContain("USING hnsw");

  } finally {
    client.release();
  }
});
```

---

## Test 2: Empty Vector Search

### SQLite (Before)
```typescript
it("should handle vector search with empty results gracefully", () => {
  applyMigrations(db);

  db.prepare("INSERT INTO libraries (name) VALUES (?)").run("empty-lib");
  const library = db.prepare("SELECT id FROM libraries WHERE name = ?").get("empty-lib");

  db.prepare("INSERT INTO versions (library_id, name) VALUES (?, ?)").run(library.id, "1.0.0");

  const searchVector = new Array(1536).fill(0.5);
  const vectorSearchQuery = `
    SELECT dv.rowid, d.content, dv.distance
    FROM documents_vec dv
    JOIN documents d ON dv.rowid = d.id
    WHERE dv.embedding MATCH ?
      AND k = 5
    ORDER BY dv.distance ASC
  `;

  const results = db
    .prepare(vectorSearchQuery)
    .all(JSON.stringify(searchVector));

  expect(results).toEqual([]);
});
```

### PostgreSQL (After)
```typescript
it("should handle vector search with empty results gracefully", async () => {
  await applyMigrations(pool);

  const client = await pool.connect();
  try {
    await client.query("INSERT INTO libraries (name) VALUES ($1)", ["empty-lib"]);

    const libraryResult = await client.query(
      "SELECT id FROM libraries WHERE name = $1",
      ["empty-lib"]
    );
    const libraryId = libraryResult.rows[0].id;

    await client.query(
      "INSERT INTO versions (library_id, name) VALUES ($1, $2)",
      [libraryId, "1.0.0"]
    );

    const searchVector = new Array(1536).fill(0.5);
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
      JSON.stringify(searchVector),
      "empty-lib",
      "1.0.0"
    ]);

    expect(searchResults.rows).toEqual([]);

  } finally {
    client.release();
  }
});
```

**Key changes:**
- ❌ Remove `documents_vec` table reference
- ✅ Query `documents` table directly with `embedding` column
- ❌ Remove `MATCH` syntax
- ✅ Use `<=>` operator for cosine distance
- ❌ Remove `k` parameter
- ✅ Use `LIMIT 5` instead
- ✅ Add `::vector` cast
- ✅ Use parameterized queries ($1, $2, $3)

---

## Test 3: Vector Similarity Search

### SQLite (Before)
```typescript
// Insert documents
const doc1Id = db.prepare(
  "INSERT INTO documents (page_id, content, metadata, sort_order) VALUES (?, ?, ?, ?)"
).run(pageId, content, JSON.stringify(metadata), 1).lastInsertRowid;

// Insert vectors into virtual table
const insertVector = db.prepare(`
  INSERT INTO documents_vec (rowid, library_id, version_id, embedding)
  VALUES (?, ?, ?, ?)
`);

insertVector.run(
  BigInt(doc1Id),
  BigInt(libraryId),
  BigInt(versionId),
  JSON.stringify(aiVector1)
);

// Search
const vectorSearchQuery = `
  SELECT dv.rowid, d.content, dv.distance
  FROM documents_vec dv
  JOIN documents d ON dv.rowid = d.id
  WHERE dv.embedding MATCH ?
    AND k = 3
  ORDER BY dv.distance ASC
`;

const results = db.prepare(vectorSearchQuery).all(JSON.stringify(searchVector));
```

### PostgreSQL (After)
```typescript
// Insert documents with embeddings in one query
await client.query(
  `INSERT INTO documents (page_id, content, metadata, sort_order, embedding)
   VALUES ($1, $2, $3, $4, $5::vector)`,
  [
    pageId,
    content,
    JSON.stringify(metadata),
    1,
    JSON.stringify(aiVector1)  // Embedding in same INSERT
  ]
);

// Search (no separate vector table)
const vectorSearchQuery = `
  SELECT
    d.id,
    d.content,
    d.embedding <=> $1::vector AS distance
  FROM documents d
  JOIN pages p ON d.page_id = p.id
  JOIN versions v ON p.version_id = v.id
  WHERE v.id = $2
    AND d.embedding IS NOT NULL
  ORDER BY d.embedding <=> $1::vector
  LIMIT 3
`;

const searchResults = await client.query(vectorSearchQuery, [
  JSON.stringify(searchVector),
  versionId
]);
```

**Key changes:**
- ❌ Remove separate `documents_vec` INSERT
- ✅ Include `embedding` in documents INSERT
- ❌ Remove BigInt casts (not needed)
- ✅ Use `<=>` operator
- ✅ Add `::vector` cast

---

## Test 4: Full-Text Search

### SQLite (Before)
```typescript
// Basic FTS search
const ftsSearchQuery = `
  SELECT
    d.id,
    d.content,
    fts.rank
  FROM documents_fts fts
  JOIN documents d ON fts.rowid = d.id
  WHERE documents_fts MATCH ?
  ORDER BY fts.rank ASC  -- Lower rank = better in SQLite BM25
`;

const results = db.prepare(ftsSearchQuery).all("react hooks");

// BM25 scoring
const bm25Query = `
  SELECT
    d.id,
    bm25(documents_fts, 10.0, 1.0, 5.0, 1.0) as bm25_score
  FROM documents_fts fts
  JOIN documents d ON fts.rowid = d.id
  WHERE documents_fts MATCH ?
  ORDER BY bm25_score ASC  -- Lower = better
`;

// Phrase search
const phraseResults = db
  .prepare(ftsSearchQuery)
  .all('"dependency injection"');  // Quotes for phrase

// Ranking assertions
expect(results[i].rank).toBeGreaterThanOrEqual(results[i-1].rank);  // Lower is better
```

### PostgreSQL (After)
```typescript
// Basic FTS search
const ftsSearchQuery = `
  SELECT
    d.id,
    d.content,
    ts_rank(to_tsvector('english', d.content), plainto_tsquery('english', $1)) as rank
  FROM documents d
  JOIN pages p ON d.page_id = p.id
  WHERE to_tsvector('english', d.content) @@ plainto_tsquery('english', $1)
  ORDER BY rank DESC  -- ⚠️ Higher rank = better in PostgreSQL!
`;

const searchResults = await client.query(ftsSearchQuery, ["react hooks"]);

// ts_rank replaces BM25 (opposite semantics!)
// No separate BM25 function, ts_rank serves same purpose

// Phrase search (different function!)
const phraseSearchQuery = `
  SELECT
    d.id,
    d.content,
    ts_rank(to_tsvector('english', d.content), phraseto_tsquery('english', $1)) as rank
  FROM documents d
  WHERE to_tsvector('english', d.content) @@ phraseto_tsquery('english', $1)
  ORDER BY rank DESC
`;

const phraseResults = await client.query(phraseSearchQuery, ["dependency injection"]);
// No quotes needed, phraseto_tsquery handles it

// Ranking assertions (INVERTED!)
expect(results[i].rank).toBeLessThanOrEqual(results[i-1].rank);  // Higher is better
```

**Key changes:**
- ❌ Remove `documents_fts` table reference
- ✅ Use `to_tsvector('english', content)`
- ❌ Remove `MATCH` syntax
- ✅ Use `@@` operator with `plainto_tsquery()`
- ❌ Remove `bm25()` function
- ✅ Use `ts_rank()` instead
- ⚠️ **CRITICAL**: Change `ORDER BY rank ASC` to `DESC`
- ⚠️ **CRITICAL**: Invert all ranking assertions
- ✅ Use `phraseto_tsquery()` for phrases (no quotes)
- ✅ Use parameterized queries

---

## Metadata Field Search

### SQLite (Before)
```typescript
const titleSearchQuery = `
  SELECT
    d.id,
    json_extract(d.metadata, '$.title') as title,
    fts.rank
  FROM documents_fts fts
  JOIN documents d ON fts.rowid = d.id
  WHERE fts.title MATCH ?  -- Search in title column of FTS index
  ORDER BY fts.rank
`;

const results = db.prepare(titleSearchQuery).all("Database");
```

### PostgreSQL (After)
```typescript
const titleSearchQuery = `
  SELECT
    d.id,
    (d.metadata::jsonb)->>'title' as title,
    ts_rank(
      to_tsvector('english', (d.metadata::jsonb)->>'title'),
      plainto_tsquery('english', $1)
    ) as rank
  FROM documents d
  WHERE to_tsvector('english', (d.metadata::jsonb)->>'title') @@ plainto_tsquery('english', $1)
  ORDER BY rank DESC  -- Higher = better
`;

const titleResults = await client.query(titleSearchQuery, ["Database"]);
```

**Key changes:**
- ❌ Remove `fts.title` column reference
- ✅ Cast metadata to jsonb: `(metadata::jsonb)->>'title'`
- ✅ Use `to_tsvector()` on extracted field
- ✅ Order by rank DESC

---

## Distance/Rank Assertions

### SQLite (Before)
```typescript
// Vector distance (lower = better) ✅ Same in PostgreSQL
expect(searchResults[0].distance).toBeLessThan(searchResults[1].distance);
expect(identicalVectorDistance).toBeCloseTo(0, 6);

// FTS ranking (lower = better) ⚠️ OPPOSITE in PostgreSQL!
expect(results[0].rank).toBeLessThan(results[1].rank);  // Lower is better
for (let i = 1; i < results.length; i++) {
  expect(results[i].rank).toBeGreaterThanOrEqual(results[i-1].rank);
}
```

### PostgreSQL (After)
```typescript
// Vector distance (lower = better) ✅ Same as SQLite
expect(searchResults[0].distance).toBeLessThan(searchResults[1].distance);
expect(identicalVectorDistance).toBeCloseTo(0, 6);

// FTS ranking (higher = better) ⚠️ INVERTED from SQLite!
expect(results[0].rank).toBeGreaterThan(results[1].rank);  // Higher is better
for (let i = 1; i < results.length; i++) {
  expect(results[i].rank).toBeLessThanOrEqual(results[i-1].rank);  // INVERTED
}
```

---

## Summary of Changes

| Aspect | SQLite | PostgreSQL | Status |
|--------|--------|------------|--------|
| **Database Setup** | In-memory | Schema isolation | ✅ Different approach |
| **Vector Distance** | Lower = better | Lower = better | ✅ Same semantics |
| **FTS Ranking** | Lower = better | **Higher = better** | ⚠️ **OPPOSITE!** |
| **Vector Table** | Separate `documents_vec` | Column on `documents` | ❌ Architecture change |
| **FTS Table** | Separate `documents_fts` | GIN index on `documents` | ❌ Architecture change |
| **Vector Syntax** | `MATCH ? AND k = N` | `ORDER BY <=> $1 LIMIT N` | ❌ Syntax change |
| **FTS Syntax** | `MATCH 'query'` | `@@ plainto_tsquery('query')` | ❌ Syntax change |
| **Phrase Search** | `MATCH '"phrase"'` | `@@ phraseto_tsquery('phrase')` | ❌ Different function |
| **Embedding Format** | `JSON.stringify(array)` | `JSON.stringify(array)` | ✅ Same |

**Most Critical**: FTS ranking semantics are inverted - ALL assertions must change!

---

**File**: `/home/mp/Workspace/scrapegoat/projects/phase-c-side-by-side-comparison.md`
**Generated**: 2025-11-08
