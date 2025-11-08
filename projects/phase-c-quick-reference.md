# Phase C Quick Reference: SQLite → PostgreSQL Migration

## Critical Differences Cheatsheet

### 🔴 MOST IMPORTANT: FTS Ranking Semantics

```typescript
// SQLite BM25: Lower = Better
ORDER BY bm25(documents_fts, ...) ASC  // SQLite

// PostgreSQL ts_rank: Higher = Better ⚠️ OPPOSITE!
ORDER BY ts_rank(to_tsvector('english', content), query) DESC  // PostgreSQL
```

**ALL ranking assertions must be inverted!**

---

## Quick Syntax Mapping

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| **FTS Search** | `documents_fts MATCH 'query'` | `to_tsvector('english', content) @@ plainto_tsquery('english', 'query')` |
| **FTS Phrase** | `documents_fts MATCH '"exact phrase"'` | `to_tsvector('english', content) @@ phraseto_tsquery('english', 'exact phrase')` |
| **FTS Rank** | `bm25(documents_fts, ...)` (lower=better) | `ts_rank(to_tsvector(...), query)` (higher=better) |
| **Vector Search** | `WHERE embedding MATCH ? AND k = 5` | `ORDER BY embedding <=> $1::vector LIMIT 5` |
| **Vector Distance** | `dv.distance` from vec0 table | `embedding <=> $1::vector AS distance` |
| **List Tables** | `SELECT name FROM sqlite_master` | `SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()` |
| **List Columns** | `PRAGMA table_info(table)` | `SELECT column_name FROM information_schema.columns WHERE table_name = $1` |
| **Insert Vector** | `JSON.stringify(array)` | `JSON.stringify(array)` cast to `::vector` |

---

## Database Architecture Differences

### SQLite Structure
```
documents (main table)
documents_fts (FTS5 virtual table)
documents_vec (vec0 virtual table)
```

### PostgreSQL Structure
```
documents (single table with embedding column + indexes)
  ├── GIN index: idx_documents_content_fts (for FTS)
  └── HNSW index: idx_documents_embedding_hnsw (for vectors)
```

**No separate virtual tables!**

---

## Test Isolation Pattern

```typescript
interface TestSchema {
  schemaName: string;
  pool: Pool;
  cleanup: () => Promise<void>;
}

beforeEach(async () => {
  const testSchema = await createTestSchema();
  pool = testSchema.pool;
  cleanup = testSchema.cleanup;
});

afterEach(async () => {
  await cleanup();  // Drops schema CASCADE
});
```

---

## Common Queries

### FTS Search (Basic)
```typescript
const query = `
  SELECT
    d.*,
    ts_rank(to_tsvector('english', d.content), plainto_tsquery('english', $1)) as rank
  FROM documents d
  WHERE to_tsvector('english', d.content) @@ plainto_tsquery('english', $1)
  ORDER BY rank DESC  -- ⚠️ DESC for PostgreSQL!
`;
await client.query(query, ['search terms']);
```

### FTS Search (Phrase)
```typescript
const query = `
  SELECT d.*, ts_rank(..., phraseto_tsquery('english', $1)) as rank
  FROM documents d
  WHERE to_tsvector('english', d.content) @@ phraseto_tsquery('english', $1)
  ORDER BY rank DESC
`;
await client.query(query, ['exact phrase']);
```

### Vector Search
```typescript
const searchVector = new Array(1536).fill(0.5);
const query = `
  SELECT
    d.*,
    d.embedding <=> $1::vector AS distance
  FROM documents d
  WHERE d.embedding IS NOT NULL
  ORDER BY d.embedding <=> $1::vector
  LIMIT 5
`;
await client.query(query, [JSON.stringify(searchVector)]);
```

### Insert with Vector
```typescript
const embedding = new Array(1536).fill(0).map(() => Math.random());
await client.query(
  `INSERT INTO documents (page_id, content, metadata, sort_order, embedding)
   VALUES ($1, $2, $3, $4, $5::vector)`,
  [pageId, content, JSON.stringify(metadata), sortOrder, JSON.stringify(embedding)]
);
```

### Schema Introspection
```typescript
// List tables
const tables = await client.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = current_schema()
`);

// List columns
const columns = await client.query(`
  SELECT column_name, data_type, udt_name
  FROM information_schema.columns
  WHERE table_schema = current_schema() AND table_name = $1
`, ['documents']);

// Check indexes
const indexes = await client.query(`
  SELECT indexname, indexdef FROM pg_indexes
  WHERE schemaname = current_schema() AND tablename = $1
`, ['documents']);

// Check extension
const ext = await client.query(`
  SELECT extname FROM pg_extension WHERE extname = 'vector'
`);
```

---

## Assertion Changes

### Vector Distance (Same semantics ✅)
```typescript
// Both SQLite and PostgreSQL: lower = more similar
expect(distance1).toBeLessThan(distance2);  // Same!
expect(identicalVectorDistance).toBeCloseTo(0, 6);  // Same!
```

### FTS Ranking (OPPOSITE semantics ⚠️)
```typescript
// SQLite BM25
expect(results[0].rank).toBeLessThan(results[1].rank);  // Lower = better

// PostgreSQL ts_rank - INVERTED!
expect(results[0].rank).toBeGreaterThan(results[1].rank);  // Higher = better

// Ordering check
for (let i = 1; i < results.length; i++) {
  // SQLite
  expect(results[i].rank).toBeGreaterThanOrEqual(results[i-1].rank);

  // PostgreSQL - INVERTED!
  expect(results[i].rank).toBeLessThanOrEqual(results[i-1].rank);
}
```

---

## Configuration

### Test Database URL
```typescript
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://postgres:postgres@postgres.den.lan/scrapegoat_test";
```

### Pool Configuration
```typescript
const pool = new Pool({
  connectionString: TEST_DATABASE_URL,
  options: `-c search_path=${schemaName},public`  // Schema isolation
});
```

---

## Checklist

Before running tests:
- ✅ Remove all `better-sqlite3` imports
- ✅ Remove all `sqlite-vec` imports
- ✅ Replace `Database` with `Pool`
- ✅ Replace `PRAGMA` with `information_schema` queries
- ✅ Replace `sqlite_master` with `information_schema` queries
- ✅ Remove references to `documents_fts` and `documents_vec` tables
- ✅ **Invert all FTS ranking assertions**
- ✅ Change `MATCH` to `@@` operator
- ✅ Change `bm25()` to `ts_rank()`
- ✅ Change vector search to use `<=>` operator
- ✅ Add `::vector` casts for embeddings
- ✅ Use parameterized queries ($1, $2, $3)
- ✅ Add schema isolation with beforeEach/afterEach

After running tests:
- ✅ All 4 tests pass
- ✅ No SQLite dependencies remain
- ✅ No test schemas left in database
- ✅ Tests can run multiple times successfully

---

## File Locations

- **Test file**: `/home/mp/Workspace/scrapegoat/src/store/applyMigrations.test.ts`
- **Migrations**: `/home/mp/Workspace/scrapegoat/db/migrations/`
- **Test database**: `postgresql://postgres:postgres@postgres.den.lan/scrapegoat_test`

---

## Expected Test Output

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

---

**Generated**: 2025-11-08
**For**: Scrapegoat Phase C - applyMigrations.test.ts rewrite
