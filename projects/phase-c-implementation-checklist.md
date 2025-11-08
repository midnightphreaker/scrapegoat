# Phase C Implementation Checklist

## Pre-Implementation Verification

- [ ] PostgreSQL test database exists: `scrapegoat_test` on `postgres.den.lan`
- [ ] pgvector extension installed in test database
- [ ] Can connect: `psql -h postgres.den.lan -U postgres -d scrapegoat_test`
- [ ] Migrations are PostgreSQL-compatible (verified in Phase B)
- [ ] DocumentStore tests passing (24/24 from Phase A)

---

## Step 1: Backup Current Test File

```bash
cd /home/mp/Workspace/scrapegoat
cp src/store/applyMigrations.test.ts src/store/applyMigrations.test.ts.sqlite.backup
```

- [ ] Backup created

---

## Step 2: Update Imports

**File**: `/home/mp/Workspace/scrapegoat/src/store/applyMigrations.test.ts`

### Remove these imports:
```typescript
import Database, { type Database as DatabaseType } from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
```

- [ ] Removed `better-sqlite3` import
- [ ] Removed `sqlite-vec` import

### Add these imports:
```typescript
import { Pool, type PoolClient } from "pg";
```

- [ ] Added `pg` import

### Keep these imports:
```typescript
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "./applyMigrations";
```

- [ ] Verified existing imports remain

---

## Step 3: Add Schema Isolation Helper

**Add before the `describe` block:**

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

- [ ] Added `TEST_DATABASE_URL` constant
- [ ] Added `TestSchema` interface
- [ ] Added `createTestSchema()` function

---

## Step 4: Update Test Suite Structure

**Replace:**
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
```

**With:**
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
```

- [ ] Updated describe name to include "(PostgreSQL)"
- [ ] Changed `db` to `pool`
- [ ] Made beforeEach/afterEach async
- [ ] Updated to use schema isolation

---

## Step 5: Rewrite Test 1 - Schema Validation

### Replace entire test with:

See `/home/mp/Workspace/scrapegoat/projects/phase-c-migrations-test-rewrite-plan.md` section "Test 1: Schema Validation" for complete implementation.

**Key changes to verify:**
- [ ] Changed `applyMigrations(db)` to `await applyMigrations(pool)`
- [ ] Replaced `sqlite_master` with `information_schema.tables`
- [ ] Replaced `PRAGMA table_info` with `information_schema.columns`
- [ ] Added check for NO `documents_fts` table
- [ ] Added check for NO `documents_vec` table
- [ ] Added pgvector extension check
- [ ] Added GIN index check for FTS
- [ ] Added HNSW index check for vectors
- [ ] Verified embedding column type is `vector`
- [ ] Used `client.query()` instead of `db.prepare()`
- [ ] Added `client.release()` in finally block

---

## Step 6: Rewrite Test 2 - Empty Vector Search

### Replace entire test with PostgreSQL version

**Key changes to verify:**
- [ ] Changed to async function
- [ ] Use `client = await pool.connect()`
- [ ] Replaced `db.prepare().run()` with `client.query()`
- [ ] Changed to parameterized queries ($1, $2, $3)
- [ ] Removed `documents_vec` table reference
- [ ] Changed `MATCH ? AND k = 5` to `ORDER BY embedding <=> $1::vector LIMIT 5`
- [ ] Added `::vector` cast
- [ ] Added `client.release()` in finally block
- [ ] Verified `expect(searchResults.rows).toEqual([])`

---

## Step 7: Rewrite Test 3 - Vector Similarity Search

### Replace entire test with PostgreSQL version

**Key changes to verify:**
- [ ] Changed to async function
- [ ] Use `RETURNING id` for inserts instead of `lastInsertRowid`
- [ ] Insert embedding in documents table (not separate vec table)
- [ ] Added `::vector` cast for embeddings
- [ ] Changed vector search to use `<=>` operator
- [ ] Removed `documents_vec` table joins
- [ ] Updated distance bound check to [0, 2] for cosine (was unbounded L2)
- [ ] Kept "lower is better" assertions (same semantics)
- [ ] Added `client.release()` in finally block

---

## Step 8: Rewrite Test 4 - Full-Text Search

### Replace entire test with PostgreSQL version

**⚠️ CRITICAL CHANGES TO VERIFY:**

- [ ] Changed to async function
- [ ] Replaced `documents_fts MATCH` with `to_tsvector(...) @@ plainto_tsquery(...)`
- [ ] Replaced `bm25()` with `ts_rank()`
- [ ] **INVERTED**: Changed `ORDER BY rank ASC` to `ORDER BY rank DESC`
- [ ] **INVERTED**: Changed assertions for ranking comparisons
  - [ ] `toBeLessThan` → `toBeGreaterThan`
  - [ ] `toBeGreaterThanOrEqual` → `toBeLessThanOrEqual`
- [ ] Used `phraseto_tsquery()` for phrase matching (not `plainto_tsquery()`)
- [ ] Removed quotes from phrase queries
- [ ] Cast metadata to jsonb: `(metadata::jsonb)->>'title'`
- [ ] Changed `json_extract()` to `->>` operator
- [ ] Added `client.release()` in finally block

**Assertion verification checklist:**
```typescript
// ✅ CORRECT for PostgreSQL
expect(results[0].rank).toBeGreaterThan(results[1].rank);  // Higher = better
for (let i = 1; i < results.length; i++) {
  expect(results[i].rank).toBeLessThanOrEqual(results[i-1].rank);
}

// ❌ WRONG (SQLite semantics)
expect(results[0].rank).toBeLessThan(results[1].rank);  // Lower = better
```

- [ ] Verified all ranking assertions use PostgreSQL semantics (higher = better)

---

## Step 9: Code Quality Verification

### Run these checks:

```bash
cd /home/mp/Workspace/scrapegoat

# Check for SQLite imports (should return nothing)
grep -n "better-sqlite3" src/store/applyMigrations.test.ts

# Check for SQLite vector (should return nothing)
grep -n "sqlite-vec" src/store/applyMigrations.test.ts

# Check for SQLite-specific SQL (should return nothing)
grep -n "PRAGMA\|sqlite_master" src/store/applyMigrations.test.ts

# Check for virtual tables (should only be in NOT assertions)
grep -n "documents_fts\|documents_vec" src/store/applyMigrations.test.ts
```

- [ ] No `better-sqlite3` found
- [ ] No `sqlite-vec` found
- [ ] No `PRAGMA` found
- [ ] No `sqlite_master` found
- [ ] `documents_fts` and `documents_vec` only in negative assertions

---

## Step 10: Run Tests

```bash
cd /home/mp/Workspace/scrapegoat
npm test src/store/applyMigrations.test.ts
```

**Expected output:**
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

- [ ] All 4 tests pass
- [ ] No errors
- [ ] No warnings about deprecated APIs

---

## Step 11: Run Multiple Times

Test schema cleanup:

```bash
npm test src/store/applyMigrations.test.ts
npm test src/store/applyMigrations.test.ts
npm test src/store/applyMigrations.test.ts
```

- [ ] All runs pass
- [ ] No schema conflict errors
- [ ] No connection errors

---

## Step 12: Verify Schema Cleanup

Connect to database and check:

```bash
psql -h postgres.den.lan -U postgres -d scrapegoat_test
```

```sql
-- List all schemas (should NOT see any test_* schemas)
SELECT schema_name FROM information_schema.schemata
WHERE schema_name LIKE 'test_%';

-- Expected: 0 rows
```

- [ ] No test schemas remain
- [ ] Cleanup working correctly

---

## Step 13: Integration Testing

Run all store tests to ensure no regressions:

```bash
npm test src/store/
```

- [ ] All tests pass
- [ ] No regressions in other test files

---

## Step 14: Documentation

Update relevant documentation:

- [ ] Mark Phase C as complete in project status
- [ ] Update test count (if changed)
- [ ] Document any issues encountered and solutions

---

## Step 15: Commit Changes

```bash
git add src/store/applyMigrations.test.ts
git status
git diff --cached src/store/applyMigrations.test.ts  # Review changes
```

**Review checklist:**
- [ ] All SQLite code removed
- [ ] All PostgreSQL equivalents in place
- [ ] All ranking assertions inverted for FTS
- [ ] Schema isolation implemented
- [ ] Client properly released in all tests

```bash
git commit -m "feat(phase-c): rewrite applyMigrations.test.ts for PostgreSQL

- Replace SQLite (better-sqlite3, sqlite-vec) with PostgreSQL (pg, pgvector)
- Implement schema-based test isolation for parallel execution
- Remove virtual tables (documents_fts, documents_vec)
- Use GIN indexes for FTS and HNSW indexes for vectors
- Migrate vector search from MATCH syntax to <=> operator
- Migrate FTS from MATCH syntax to @@ with to_tsvector/plainto_tsquery
- Invert FTS ranking assertions (ts_rank higher=better vs BM25 lower=better)
- Use information_schema for schema introspection (replace PRAGMA)
- All 4 tests passing with PostgreSQL backend

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

- [ ] Changes committed

---

## Troubleshooting

### Issue: Extension not found

**Error**: `ERROR: type "vector" does not exist`

**Solution**:
```bash
psql -h postgres.den.lan -U postgres -d scrapegoat_test
CREATE EXTENSION IF NOT EXISTS vector;
```

- [ ] Resolved

---

### Issue: Tests timeout

**Error**: Tests timeout after 30 seconds

**Solution**: Increase timeout in test or vitest config
```typescript
it("test name", async () => {
  // ...
}, { timeout: 60000 });
```

- [ ] Resolved

---

### Issue: Schema not isolated

**Error**: Tests see data from other tests

**Solution**: Verify search_path is set:
```typescript
const result = await client.query('SHOW search_path');
console.log('search_path:', result.rows[0].search_path);
```

Should show: `test_xxxxx_xxxxx,public`

- [ ] Resolved

---

### Issue: Ranking seems backward

**Error**: Best matches have lowest rank scores

**Solution**: Verify ORDER BY direction
```typescript
// PostgreSQL: higher rank = better
ORDER BY rank DESC  ✅

// NOT: ORDER BY rank ASC (SQLite semantics)
```

- [ ] Resolved

---

## Completion Criteria

All boxes checked:
- [ ] Imports updated (pg, no SQLite)
- [ ] Schema isolation implemented
- [ ] Test 1 rewritten and passing
- [ ] Test 2 rewritten and passing
- [ ] Test 3 rewritten and passing
- [ ] Test 4 rewritten and passing
- [ ] All ranking assertions inverted
- [ ] No SQLite code remains
- [ ] Tests run multiple times successfully
- [ ] Schema cleanup verified
- [ ] Integration tests pass
- [ ] Changes committed

---

**Phase C Status**: ⬜ Not Started → 🟡 In Progress → ✅ Complete

**Completion Date**: _____________

**Notes**:
_______________________________________________________________________
_______________________________________________________________________
_______________________________________________________________________

---

**File**: `/home/mp/Workspace/scrapegoat/projects/phase-c-implementation-checklist.md`
**Generated**: 2025-11-08
