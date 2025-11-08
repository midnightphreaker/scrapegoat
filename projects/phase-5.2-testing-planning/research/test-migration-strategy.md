# Research: Test Migration Strategy

## Overview

Research into the best approach for migrating 835+ lines of SQLite tests to PostgreSQL, analyzing test patterns, dependencies, and migration complexity.

## Test File Analysis

### DocumentStore.test.ts Analysis

**Total Lines**: 835
**Test Cases**: 30+
**Test Suites**: 3 main describe blocks

**SQLite Dependencies Identified**:
```typescript
// Line 79: In-memory database creation
store = new DocumentStore(":memory:", embeddingConfig);

// Line 525: FTS-only mode test
store = new DocumentStore(":memory:");

// Line 630: Common functionality tests
store = new DocumentStore(":memory:", embeddingConfig);
```

**Database Access Patterns**:
1. **Initialization**: `new DocumentStore(dbPath, config)` → `new DocumentStore(connectionString, config)`
2. **Cleanup**: `await store.shutdown()` (already PostgreSQL-compatible)
3. **Direct DB Access**: Lines 726-745 use `(store as any).db.prepare()` for counting documents
   - **Impact**: This is SQLite-specific and needs replacement with PostgreSQL queries
   - **Solution**: Use `(store as any).client.query()` instead

**Mocking Strategy**:
- Embeddings are mocked (lines 8-63) - **No changes needed**
- Deterministic embedding generation - **Works with PostgreSQL**
- Mock pattern is database-agnostic - **Safe to keep**

**Migration Complexity**: **MEDIUM**
- Most test logic is database-agnostic
- Only 3 locations use `:memory:`
- 1 location (lines 726-745) needs query conversion
- All test assertions should work unchanged

---

### applyMigrations.test.ts Analysis

**Total Lines**: 654
**Test Cases**: 3 main tests
**SQLite-Specific Code**: **EXTENSIVE**

**Critical SQLite Dependencies**:
```typescript
// Line 3-4: SQLite imports
import Database, { type Database as DatabaseType } from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";

// Line 11-13: Database creation
db = new Database(":memory:");
sqliteVec.load(db);

// Line 24-26: SQLite metadata queries
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
  .all();

// Line 38: SQLite PRAGMA
const documentsColumns = db.prepare("PRAGMA table_info(documents);").all();

// Line 100: FTS virtual table check
expect(ftsTableInfo?.sql).toContain("VIRTUAL TABLE documents_fts USING fts5");

// Line 109: Vector virtual table check
expect(vecTableInfo?.sql).toContain("USING vec0");
```

**PostgreSQL Equivalents Needed**:
1. **Table listing**: `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
2. **Column info**: `SELECT column_name FROM information_schema.columns WHERE table_name = 'documents'`
3. **Index info**: `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'documents'`
4. **Extension check**: `SELECT * FROM pg_extension WHERE extname = 'vector'`
5. **FTS index**: Check GIN index on `content` column
6. **Vector index**: Check HNSW index on `embedding` column

**Migration Complexity**: **HIGH - Complete Rewrite Required**
- 0% of existing code is reusable
- All assertions need PostgreSQL equivalents
- New test patterns needed for PostgreSQL features

---

### DocumentRetrieverService.test.ts Analysis

**Total Lines**: 780
**Test Cases**: 20+
**Database Interaction**: **None (fully mocked)**

**Mocking Pattern**:
```typescript
// Line 6-7: Mock DocumentStore entirely
vi.mock("./DocumentStore");
vi.mock("../utils/logger");

// Line 15-16: Create mock instance
mockDocumentStore = new DocumentStore("mock_connection_string");
retrieverService = new DocumentRetrieverService(mockDocumentStore);
```

**Test Focus**:
- Context retrieval logic
- Hierarchical reassembly
- MIME type handling
- Sort order handling
- RRF scoring (metadata only)

**PostgreSQL Considerations**:
- Tests are already database-agnostic
- Mock strategy works with PostgreSQL connection strings
- Should validate RRF scoring matches PostgreSQL implementation

**Migration Complexity**: **LOW**
- No code changes required
- May add new tests to validate PostgreSQL-specific behavior
- Mock connection string already uses generic format

---

## Migration Strategies Evaluated

### Strategy A: In-Place Migration
**Approach**: Update existing test files with minimal changes

**Pros**:
- Preserves git history
- Minimal file restructuring
- Faster implementation

**Cons**:
- May leave cruft/comments
- Harder to review
- Mixed old/new patterns

**Verdict**: ✅ **RECOMMENDED for DocumentStore.test.ts and DocumentRetrieverService.test.ts**

---

### Strategy B: Complete Rewrite
**Approach**: Start from scratch with PostgreSQL in mind

**Pros**:
- Clean, modern code
- PostgreSQL-first design
- Better test organization

**Cons**:
- Lose git history
- Risk missing edge cases
- More time-consuming

**Verdict**: ✅ **REQUIRED for applyMigrations.test.ts**

---

### Strategy C: Hybrid Approach
**Approach**: Migrate some tests, rewrite others

**Pros**:
- Best of both worlds
- Focused effort
- Pragmatic

**Cons**:
- Inconsistent patterns
- More complex planning

**Verdict**: ✅ **ACTUAL CHOICE - Use Strategy A for DocumentStore/Retriever, Strategy B for applyMigrations**

---

## Test Database Strategy

### Option 1: Docker Compose (Local Development)

**Setup**:
```bash
docker-compose -f docker-compose.test.yml up -d
```

**Connection**:
```
postgresql://postgres:postgres@localhost:5433/postgres
```

**Pros**:
- Fast startup (already configured)
- Isolated environment
- Consistent across developers
- No system PostgreSQL required

**Cons**:
- Requires Docker
- Port 5433 must be available
- Slower on some systems

**Verdict**: ✅ **PRIMARY for local development**

---

### Option 2: Remote PostgreSQL Server

**Connection**:
```
postgresql://postgres:Mustiness-Grit7-Kindling@postgres.den.lan:5432/scrapegoat_test
```

**Pros**:
- No local Docker needed
- Fast on powerful server
- Persistent for debugging

**Cons**:
- Network dependency
- Shared resource (must avoid openmemory DBs)
- Cleanup critical

**Verdict**: ✅ **SECONDARY for CI or when Docker unavailable**

---

### Option 3: Hybrid Approach

**Strategy**:
- Default to Docker Compose (TEST_DATABASE_URL not set)
- Fall back to remote server (TEST_DATABASE_URL set)
- Each test creates unique database name

**Implementation**:
```typescript
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5433/postgres";
```

**Verdict**: ✅ **IMPLEMENTED in testUtils.ts** (already done in Phase 5.1)

---

## Test Data Strategy

### Approach 1: Generate Fresh Data per Test

**Pattern**:
```typescript
beforeEach(async () => {
  testDb = await createTestDatabase();
  // Generate test data
});

afterEach(async () => {
  await testDb.cleanup();
});
```

**Pros**:
- Perfect isolation
- No test pollution
- Parallel execution safe

**Cons**:
- Slower test execution
- More resource usage

**Verdict**: ✅ **RECOMMENDED for integration tests**

---

### Approach 2: Shared Database with TRUNCATE

**Pattern**:
```typescript
beforeAll(async () => {
  testDb = await createTestDatabase();
});

afterEach(async () => {
  await resetTestDatabase(testDb.store);
});

afterAll(async () => {
  await testDb.cleanup();
});
```

**Pros**:
- Faster test execution
- Less resource usage
- Database setup amortized

**Cons**:
- Risk of test pollution
- Harder to debug
- Parallel execution issues

**Verdict**: ⚠️ **USE CAUTIOUSLY for unit tests with simple data**

---

## PostgreSQL-Specific Test Patterns

### Testing HNSW Index

```typescript
it("should create HNSW index with correct parameters", async () => {
  const result = await client.query(`
    SELECT
      indexname,
      indexdef
    FROM pg_indexes
    WHERE tablename = 'documents'
      AND indexdef LIKE '%hnsw%'
  `);

  expect(result.rows).toHaveLength(1);
  expect(result.rows[0].indexdef).toContain("m = 16");
  expect(result.rows[0].indexdef).toContain("ef_construction = 64");
});
```

---

### Testing GIN Index

```typescript
it("should create GIN index for full-text search", async () => {
  const result = await client.query(`
    SELECT
      indexname,
      indexdef
    FROM pg_indexes
    WHERE tablename = 'documents'
      AND indexdef LIKE '%gin%'
      AND indexdef LIKE '%content%'
  `);

  expect(result.rows).toHaveLength(1);
});
```

---

### Testing pgvector Extension

```typescript
it("should enable pgvector extension", async () => {
  const result = await client.query(`
    SELECT * FROM pg_extension WHERE extname = 'vector'
  `);

  expect(result.rows).toHaveLength(1);
});
```

---

### Testing Vector Search

```typescript
it("should perform vector similarity search", async () => {
  const searchVector = Array(1536).fill(0.5);

  const result = await client.query(`
    SELECT
      id,
      content,
      1 - (embedding <=> $1::vector) as similarity
    FROM documents
    WHERE version_id = $2
    ORDER BY embedding <=> $1::vector
    LIMIT 5
  `, [JSON.stringify(searchVector), versionId]);

  expect(result.rows.length).toBeGreaterThan(0);
  expect(result.rows[0].similarity).toBeGreaterThan(0);
});
```

---

### Testing Full-Text Search

```typescript
it("should perform full-text search with GIN index", async () => {
  const result = await client.query(`
    SELECT
      id,
      content,
      ts_rank(to_tsvector('english', content), query) as rank
    FROM documents, plainto_tsquery('english', $1) query
    WHERE to_tsvector('english', content) @@ query
      AND version_id = $2
    ORDER BY rank DESC
    LIMIT 5
  `, ['test query', versionId]);

  expect(result.rows.length).toBeGreaterThan(0);
  expect(result.rows[0].rank).toBeGreaterThan(0);
});
```

---

## Embedding Mock Strategy

### Current Pattern (DocumentStore.test.ts)

```typescript
vi.mock("./embeddings/EmbeddingFactory", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./embeddings/EmbeddingFactory")>();

  return {
    ...actual,
    createEmbeddingModel: () => ({
      embedQuery: vi.fn(async (text: string) => {
        // Deterministic embedding generation
        const words = text.toLowerCase().split(/\s+/);
        const embedding = new Array(1536).fill(0);
        // ... word-based seeding
        return embedding;
      }),
      embedDocuments: vi.fn(async (texts: string[]) => {
        // Same logic for batch
      }),
    }),
  };
});
```

**Analysis**:
- ✅ Database-agnostic
- ✅ Deterministic (good for testing)
- ✅ Realistic vector dimensions (1536)
- ✅ Works with PostgreSQL
- **No changes needed**

---

## Key Findings

### What Works Unchanged
1. **Embedding mocks** - Database-agnostic
2. **Test assertions** - Mostly database-agnostic
3. **DocumentRetrieverService tests** - Fully mocked
4. **CLI tests** - Minimal database interaction
5. **Test utilities** - Already PostgreSQL-ready

### What Needs Migration
1. **`:memory:` references** - Replace with createTestDatabase()
2. **SQLite PRAGMA queries** - Replace with PostgreSQL info queries
3. **sqlite_master queries** - Replace with pg_tables/information_schema
4. **SQLite-specific indexes** - Test HNSW and GIN instead
5. **Direct db.prepare() calls** - Replace with client.query()

### What Needs Rewrite
1. **applyMigrations.test.ts** - 100% SQLite-specific
2. **Migration verification logic** - New PostgreSQL patterns
3. **Index verification tests** - PostgreSQL-specific

---

## Recommendations

### Priority Order
1. **DocumentStore.test.ts** (Day 1) - Foundation for all other tests
2. **applyMigrations.test.ts** (Day 2) - Critical path, complete rewrite
3. **DocumentRetrieverService.test.ts** (Day 3) - Validate hybrid search
4. **CLI tests** (Day 3) - Quick verification
5. **Coverage validation** (Day 3-5) - Continuous

### Testing Approach
1. Use Docker Compose for local development
2. Use remote PostgreSQL for CI (if needed)
3. Create fresh database per test for integration tests
4. Keep embedding mocks unchanged
5. Add PostgreSQL-specific feature tests

### Success Metrics
- All existing test cases pass
- No SQLite dependencies remain
- 60%+ code coverage
- Test execution < 5 minutes
- All tests can run in parallel

---

*Research completed: 2025-11-08*
*Strategy: Hybrid migration approach*
