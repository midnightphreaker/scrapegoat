# Test Isolation Strategies for PostgreSQL

## Problem Statement

Unlike SQLite which supports `:memory:` databases for fast, isolated testing, PostgreSQL requires different strategies for test isolation. Each test should run independently without affecting others.

## Test Isolation Requirements

1. **Independence**: Tests don't affect each other
2. **Cleanup**: Resources cleaned up after tests
3. **Speed**: Tests run reasonably fast
4. **Parallelization**: Multiple tests can run concurrently
5. **Debugging**: Easy to inspect state when tests fail

## Strategy Comparison

### Strategy 1: Separate Databases (Per Test)

**Approach**: Create/drop a new database for each test.

```typescript
beforeEach(async () => {
    const dbName = `test_${Date.now()}_${Math.random()}`;
    await adminClient.query(`CREATE DATABASE ${dbName}`);
    testClient = new Client({ database: dbName });
    await testClient.connect();
    await applyMigrations(testClient);
});

afterEach(async () => {
    await testClient.end();
    await adminClient.query(`DROP DATABASE ${dbName}`);
});
```

**Pros**:
- Complete isolation
- Can't interfere with each other
- Clean state guaranteed

**Cons**:
- Slow (database creation overhead)
- Requires superuser permissions
- Can't run in parallel easily
- Resource intensive

**Verdict**: ❌ Too slow for unit tests

---

### Strategy 2: Schemas (Per Test) ✅ RECOMMENDED

**Approach**: Create a new schema for each test within a shared database.

```typescript
let schemaName: string;

beforeEach(async () => {
    schemaName = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await client.query(`CREATE SCHEMA ${schemaName}`);
    await client.query(`SET search_path TO ${schemaName}`);
    await applyMigrations(client, { schema: schemaName });
});

afterEach(async () => {
    await client.query(`SET search_path TO public`);
    await client.query(`DROP SCHEMA ${schemaName} CASCADE`);
});
```

**Pros**:
- Fast (no database creation overhead)
- Complete isolation
- Can run tests in parallel
- Easy cleanup with CASCADE
- Works with normal permissions
- Can inspect failed test schemas

**Cons**:
- Need to set search_path for each test
- Migration code must support schemas
- Slightly more complex than databases

**Verdict**: ✅ Best balance of speed and isolation

---

### Strategy 3: Transactions with Rollback

**Approach**: Wrap each test in a transaction and rollback.

```typescript
beforeEach(async () => {
    await client.query('BEGIN');
});

afterEach(async () => {
    await client.query('ROLLBACK');
});
```

**Pros**:
- Very fast
- Simple implementation
- Automatic cleanup

**Cons**:
- Can't test transaction logic
- Can't test COMMIT behavior
- Can't test concurrent operations
- DDL operations (like migrations) can't be rolled back in some cases
- Sequences still increment

**Verdict**: ⚠️ Good for simple tests, not suitable for migration tests

---

### Strategy 4: Table Truncation

**Approach**: Truncate all tables after each test.

```typescript
afterEach(async () => {
    await client.query('TRUNCATE documents, libraries, versions CASCADE');
});
```

**Pros**:
- Fast
- Simple

**Cons**:
- Requires knowing all tables
- Sequences still increment
- Can't test schema changes
- Tests can still interfere if run in parallel
- Not suitable for migration tests

**Verdict**: ⚠️ Only for simple data tests, not for our use case

---

### Strategy 5: Shared Schema with UUID/Random Prefixes

**Approach**: Use random prefixes for table/data names.

```typescript
const testId = uuid();
await client.query(`
    INSERT INTO documents (id, test_id, content)
    VALUES ($1, $2, $3)
`, [docId, testId, content]);

// Query with filter
await client.query(`
    SELECT * FROM documents WHERE test_id = $1
`, [testId]);
```

**Pros**:
- Can share database and schema
- Fast

**Cons**:
- Requires modifying schema (test_id column)
- Complex queries
- Cleanup can be missed
- Not true isolation
- Can't test migrations

**Verdict**: ❌ Not suitable for migration tests

---

## Recommended Implementation: Schema-Based Isolation

### Helper Functions

```typescript
// src/store/test-utils.ts

import { Client } from 'pg';

export interface TestDatabase {
    client: Client;
    schemaName: string;
    cleanup: () => Promise<void>;
}

/**
 * Create isolated test database using schema isolation
 */
export async function createTestDatabase(): Promise<TestDatabase> {
    const schemaName = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Connect to main test database
    const client = new Client({
        host: process.env.POSTGRES_HOST || 'postgres.den.lan',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        database: process.env.POSTGRES_TEST_DB || 'scrapegoat_test',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD,
    });

    await client.connect();

    // Create test schema
    await client.query(`CREATE SCHEMA ${schemaName}`);

    // Set search path to test schema
    await client.query(`SET search_path TO ${schemaName}`);

    // Apply migrations to test schema
    await applyMigrations(client);

    const cleanup = async () => {
        // Reset search path
        await client.query('SET search_path TO public');

        // Drop test schema and all objects
        await client.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);

        // Close connection
        await client.end();
    };

    return { client, schemaName, cleanup };
}

/**
 * Run a test with isolated database
 */
export async function withTestDatabase<T>(
    fn: (client: Client) => Promise<T>
): Promise<T> {
    const { client, cleanup } = await createTestDatabase();

    try {
        return await fn(client);
    } finally {
        await cleanup();
    }
}
```

### Usage in Tests

```typescript
// DocumentStore.test.ts

describe('DocumentStore', () => {
    let db: TestDatabase;
    let store: DocumentStore;

    beforeEach(async () => {
        db = await createTestDatabase();
        store = new DocumentStore(db.client);
    });

    afterEach(async () => {
        await db.cleanup();
    });

    it('should insert document', async () => {
        const doc = await store.insertDocument({
            content: 'test content',
            title: 'test title',
        });

        expect(doc.id).toBeDefined();
        expect(doc.content).toBe('test content');
    });

    it('should search documents', async () => {
        await store.insertDocument({ content: 'hello world' });
        await store.insertDocument({ content: 'goodbye world' });

        const results = await store.searchDocuments('hello');

        expect(results).toHaveLength(1);
        expect(results[0].content).toBe('hello world');
    });
});
```

### Usage for Migration Tests

```typescript
// applyMigrations.test.ts

describe('Migration System', () => {
    let db: TestDatabase;

    beforeEach(async () => {
        // Create test schema WITHOUT applying migrations
        const schemaName = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const client = new Client({
            database: 'scrapegoat_test',
            // ... connection details
        });
        await client.connect();
        await client.query(`CREATE SCHEMA ${schemaName}`);
        await client.query(`SET search_path TO ${schemaName}`);

        db = { client, schemaName, cleanup: async () => {
            await client.query('SET search_path TO public');
            await client.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
            await client.end();
        }};
    });

    afterEach(async () => {
        await db.cleanup();
    });

    it('should apply all migrations to fresh database', async () => {
        // Schema exists but is empty
        await applyMigrations(db.client);

        // Verify tables exist
        const result = await db.client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = $1
        `, [db.schemaName]);

        expect(result.rows).toContainEqual({ table_name: 'documents' });
        expect(result.rows).toContainEqual({ table_name: 'libraries' });
        expect(result.rows).toContainEqual({ table_name: 'migrations' });
    });

    it('should track migration versions', async () => {
        await applyMigrations(db.client);

        const result = await db.client.query(`
            SELECT version FROM migrations ORDER BY version
        `);

        expect(result.rows.length).toBeGreaterThan(0);
        expect(result.rows[0].version).toBe(1);
    });
});
```

## Migration Code Updates

The `applyMigrations` function needs to support the search_path:

```typescript
// src/store/applyMigrations.ts

export async function applyMigrations(client: Client): Promise<void> {
    // Migration code will automatically use current search_path
    // No special changes needed if migrations use relative table names

    // Ensure migrations table exists in current schema
    await client.query(`
        CREATE TABLE IF NOT EXISTS migrations (
            version INTEGER PRIMARY KEY,
            applied_at TIMESTAMP DEFAULT NOW()
        )
    `);

    // Get applied migrations from current schema
    const result = await client.query('SELECT version FROM migrations');
    const appliedVersions = new Set(result.rows.map(r => r.version));

    // Apply pending migrations
    for (const migration of allMigrations) {
        if (!appliedVersions.has(migration.version)) {
            await client.query(migration.sql);
            await client.query(
                'INSERT INTO migrations (version) VALUES ($1)',
                [migration.version]
            );
        }
    }
}
```

## Parallel Test Execution

With schema-based isolation, tests can run in parallel:

```json
// jest.config.js
{
    "maxWorkers": 4,  // Run up to 4 tests in parallel
    "testTimeout": 30000
}
```

Each test gets its own schema, so they won't interfere.

## Debugging Failed Tests

When a test fails, the schema remains until cleanup runs:

```typescript
// Temporarily disable cleanup for debugging
afterEach(async () => {
    if (!process.env.KEEP_TEST_SCHEMA) {
        await db.cleanup();
    } else {
        console.log(`Test schema kept for debugging: ${db.schemaName}`);
    }
});
```

Then inspect manually:
```bash
psql -h postgres.den.lan -U postgres -d scrapegoat_test

\c scrapegoat_test
SET search_path TO test_1234567890_abc123;
SELECT * FROM documents;
```

## Performance Considerations

**Schema Creation Overhead**:
- Creating schema: ~10ms
- Dropping schema CASCADE: ~20ms
- Total per test: ~30ms overhead

**Optimization**:
- Reuse connection pool
- Run migrations once per schema (already done)
- Use parallel test execution

**Expected Performance**:
- 24 DocumentStore tests: ~10-15 seconds
- 10 migration tests: ~5-10 seconds
- Total test suite: ~30-60 seconds

## Security Considerations

**Permissions Required**:
```sql
-- Test user needs schema creation permission
GRANT CREATE ON DATABASE scrapegoat_test TO test_user;
```

**Schema Naming**:
- Use timestamps + random suffix to avoid collisions
- Prefix with `test_` for easy identification
- Clean up old test schemas periodically

**Cleanup Script**:
```sql
-- Clean up old test schemas (older than 1 day)
DO $$
DECLARE
    schema_name TEXT;
BEGIN
    FOR schema_name IN
        SELECT nspname
        FROM pg_namespace
        WHERE nspname LIKE 'test_%'
    LOOP
        EXECUTE 'DROP SCHEMA IF EXISTS ' || quote_ident(schema_name) || ' CASCADE';
    END LOOP;
END $$;
```

## Conclusion

**Recommended Strategy**: Schema-based isolation

**Why**:
- Fast enough for unit tests
- Complete isolation
- Supports parallel execution
- Works with migrations
- Easy debugging
- Standard PostgreSQL features

**Implementation Priority**:
1. Create `createTestDatabase()` helper
2. Update test files to use helper
3. Verify cleanup works correctly
4. Enable parallel execution
5. Add debugging support

---

*Last Updated: 2025-11-08*
