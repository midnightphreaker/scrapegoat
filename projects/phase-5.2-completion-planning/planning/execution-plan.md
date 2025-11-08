# Phase 5.2 Execution Plan

## Overview

This is the master execution plan for completing Phase 5.2. Follow the phases in order, as many have dependencies on earlier phases.

**Total Estimated Time**: 16-25 hours (2-3 work days)

---

## PHASE A: Fix FTS Implementation (CRITICAL PATH)

**Priority**: CRITICAL
**Estimated Time**: 4-6 hours
**Dependencies**: None
**Status**: 🔴 Not Started

### Objective
Fix all 10 failing DocumentStore tests by implementing proper PostgreSQL FTS query syntax.

### Tasks

#### A1: Analyze Current Implementation (30 minutes)

**Action**: Read and understand current FTS implementation

**Files to Examine**:
- `/home/mp/Workspace/scrapegoat/src/store/DocumentStore.ts`
- `/home/mp/Workspace/scrapegoat/src/store/DocumentStore.test.ts`

**Commands**:
```bash
cd /home/mp/Workspace/scrapegoat

# Read the implementation
cat src/store/DocumentStore.ts | grep -A 20 "search"

# Run tests to see exact errors
npm test -- DocumentStore.test.ts --verbose 2>&1 | tee test-errors.log
```

**What to Look For**:
- How search queries are constructed
- Where MATCH operator is used (SQLite syntax)
- Which methods need FTS functionality
- Error messages from failing tests

**Deliverable**: Understanding of current implementation and failure points

---

#### A2: Design FTS Query Builder (30 minutes)

**Action**: Design the PostgreSQL FTS query implementation

**Key Decisions**:
- Use `plainto_tsquery()` for user input (safe, handles special chars)
- Use `@@` operator for matching
- Use `ts_rank()` for ranking
- Use `'english'` text search configuration

**Design Pattern**:
```typescript
// Before (SQLite):
WHERE documents MATCH ?

// After (PostgreSQL):
WHERE search_vector @@ plainto_tsquery('english', $1)
ORDER BY ts_rank(search_vector, plainto_tsquery('english', $1)) DESC
```

**Reference**: See `/home/mp/Workspace/scrapegoat/projects/phase-5.2-completion-planning/research/postgresql-fts-research.md`

**Deliverable**: Clear implementation approach

---

#### A3: Implement FTS Query Methods (2-3 hours)

**Action**: Update all search-related methods in DocumentStore.ts

**Methods to Update** (find these in DocumentStore.ts):
1. `searchDocuments()` - main search method
2. Any hybrid search methods
3. Any filtering + search methods

**Implementation Steps**:

1. **Find search query construction**:
```bash
cd /home/mp/Workspace/scrapegoat
grep -n "MATCH" src/store/DocumentStore.ts
```

2. **Replace with PostgreSQL FTS**:
```typescript
// Example transformation:

// BEFORE (SQLite):
const query = `
    SELECT * FROM documents
    WHERE content MATCH ?
    ORDER BY rank
`;

// AFTER (PostgreSQL):
const query = `
    SELECT
        *,
        ts_rank(search_vector, plainto_tsquery('english', $1)) as rank
    FROM documents
    WHERE search_vector @@ plainto_tsquery('english', $1)
    ORDER BY rank DESC
`;
```

3. **Handle edge cases**:
```typescript
// Empty query validation
if (!searchTerm || searchTerm.trim() === '') {
    throw new Error('Search term cannot be empty');
}

// Special characters are handled by plainto_tsquery automatically
```

4. **Update hybrid search (if exists)**:
```typescript
const query = `
    SELECT
        d.*,
        (1 - (d.embedding <-> $1::vector)) * 0.5 +
        ts_rank(d.search_vector, plainto_tsquery('english', $2)) * 0.5 as combined_score
    FROM documents d
    WHERE
        d.search_vector @@ plainto_tsquery('english', $2)
        OR (d.embedding <-> $1::vector) < 0.5
    ORDER BY combined_score DESC
`;
```

**Deliverable**: Updated DocumentStore.ts with PostgreSQL FTS

---

#### A4: Handle Case Sensitivity (30 minutes)

**Action**: Ensure case-insensitive search works correctly

**Issue**: PostgreSQL FTS is case-insensitive by default (good!), but exact matches for library/version names might need adjustment.

**Implementation**:
```typescript
// For FTS search (already case-insensitive)
WHERE search_vector @@ plainto_tsquery('english', $1)  // Already works!

// For exact library/version matching (if needed)
WHERE LOWER(library) = LOWER($1)
WHERE LOWER(version) = LOWER($2)
```

**Test Cases**:
- "PostgreSQL" should match "postgresql"
- "React" should match "react"
- Library name "MyLib" should match "mylib"

**Deliverable**: Case-insensitive search working

---

#### A5: Test and Iterate (1-2 hours)

**Action**: Run tests repeatedly until all pass

**Test Command**:
```bash
npm test -- DocumentStore.test.ts
```

**Debugging Process**:
1. Run tests, note failures
2. Read error messages carefully
3. Fix one issue at a time
4. Re-run tests
5. Repeat until 24/24 passing

**Common Issues to Watch For**:
- Parameter placeholders: `?` (SQLite) → `$1, $2` (PostgreSQL)
- Column names: `rank` might conflict with SQL keyword
- Empty results: Check if search_vector is being populated
- Ranking order: DESC vs ASC

**Verification**:
```bash
# All tests should pass
npm test -- DocumentStore.test.ts

# Expected output:
# PASS  src/store/DocumentStore.test.ts
#   ✓ should ... (24 tests)
# Tests: 24 passed, 24 total
```

**Deliverable**: 24/24 DocumentStore tests passing

---

#### A6: Commit FTS Fixes (15 minutes)

**Action**: Commit working FTS implementation

**Commands**:
```bash
cd /home/mp/Workspace/scrapegoat

# Review changes
git diff src/store/DocumentStore.ts

# Add and commit
git add src/store/DocumentStore.ts
git commit -m "feat(phase-5.2): implement PostgreSQL FTS in DocumentStore

- Replace SQLite MATCH syntax with PostgreSQL @@ operator
- Use plainto_tsquery() for safe query parsing
- Use ts_rank() for result ranking
- Handle empty queries and special characters
- All 24 DocumentStore tests now passing (100%)

Fixes: #phase-5.2-fts"

# Verify commit
git log -1 --stat
```

**Deliverable**: Clean commit of FTS implementation

---

### Phase A Completion Criteria

- [ ] All 24 DocumentStore.test.ts tests passing (100%)
- [ ] No test failures or timeouts
- [ ] Case-insensitive search works
- [ ] Special characters handled correctly
- [ ] Changes committed to git

**Next Phase**: Phase B (can be done in parallel with A1-A3)

---

## PHASE B: Test Database Setup

**Priority**: HIGH
**Estimated Time**: 1.5 hours
**Dependencies**: None (can parallel with Phase A)
**Status**: 🔴 Not Started

### Objective
Create dedicated PostgreSQL test database on postgres.den.lan with all required extensions and configuration.

### Tasks

#### B1: Connect to PostgreSQL Server (5 minutes)

**Action**: Establish connection to postgres.den.lan

**Connection Details**:
- Host: postgres.den.lan
- User: postgres
- Password: Mustiness-Grit7-Kindling

**Commands**:
```bash
# Option 1: Direct psql connection
psql -h postgres.den.lan -U postgres -W

# Option 2: SSH first, then psql
ssh root@postgres.den.lan  # Password: P@ssw0rd
sudo -u postgres psql

# Verify connection
\conninfo
\l  # List databases
```

**Verification**: Can connect successfully

---

#### B2: Create Test Database (10 minutes)

**Action**: Create scrapegoat_test database

**CRITICAL WARNING**: Do NOT touch openmemory databases or tables!

**SQL Commands**:
```sql
-- Create database
CREATE DATABASE scrapegoat_test
    WITH
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF-8'
    LC_CTYPE = 'en_US.UTF-8'
    TEMPLATE = template0;

-- Verify creation
\l scrapegoat_test

-- Connect to new database
\c scrapegoat_test

-- Verify connection
SELECT current_database();
```

**Verification**:
```sql
-- Should show scrapegoat_test
SELECT current_database();
```

**Deliverable**: scrapegoat_test database created

---

#### B3: Install pgvector Extension (10 minutes)

**Action**: Install and verify pgvector extension

**SQL Commands**:
```sql
-- Must be connected to scrapegoat_test
\c scrapegoat_test

-- Install pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify installation
\dx vector

-- Test vector functionality
SELECT '[1,2,3]'::vector;
SELECT '[1,2,3]'::vector <-> '[4,5,6]'::vector AS distance;
```

**Expected Output**:
```
distance
--------
5.196152422706632
```

**Verification**:
```sql
-- List extensions
\dx

-- Should show:
-- Name   | Version | Schema | Description
-- vector | 0.5.x   | public | vector data type and ivfflat access method
```

**Deliverable**: pgvector extension installed and working

---

#### B4: Create Test User (Optional, 15 minutes)

**Action**: Create dedicated test user with limited permissions

**Note**: This is optional but recommended for security.

**SQL Commands**:
```sql
-- Create user
CREATE USER scrapegoat_test WITH PASSWORD 'test_secure_password_123';

-- Grant database access
GRANT ALL PRIVILEGES ON DATABASE scrapegoat_test TO scrapegoat_test;

-- Connect to database
\c scrapegoat_test

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO scrapegoat_test;
GRANT CREATE ON SCHEMA public TO scrapegoat_test;

-- Grant default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON TABLES TO scrapegoat_test;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT ALL ON SEQUENCES TO scrapegoat_test;
```

**Verification**:
```bash
# Test connection with new user
psql -h postgres.den.lan -U scrapegoat_test -d scrapegoat_test -W
```

**Deliverable**: Test user created (optional)

---

#### B5: Update Test Configuration (30 minutes)

**Action**: Configure project to use test database

**Files to Update**:

1. **Create/Update .env.test**:
```bash
cd /home/mp/Workspace/scrapegoat

cat > .env.test << 'EOF'
# PostgreSQL Test Database Configuration
DATABASE_URL=postgresql://postgres:Mustiness-Grit7-Kindling@postgres.den.lan:5432/scrapegoat_test

# Alternative with test user (if created)
# DATABASE_URL=postgresql://scrapegoat_test:test_secure_password_123@postgres.den.lan:5432/scrapegoat_test

# Test configuration
NODE_ENV=test
LOG_LEVEL=error
EOF
```

2. **Update test utilities** (if needed):
```typescript
// src/store/test-utils.ts

export async function createTestDatabase(): Promise<TestDatabase> {
    const schemaName = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Use test database connection
    const client = new Client({
        connectionString: process.env.DATABASE_URL ||
            'postgresql://postgres:Mustiness-Grit7-Kindling@postgres.den.lan:5432/scrapegoat_test'
    });

    await client.connect();

    // Create test schema
    await client.query(`CREATE SCHEMA ${schemaName}`);
    await client.query(`SET search_path TO ${schemaName}`);

    // Apply migrations
    await applyMigrations(client);

    const cleanup = async () => {
        await client.query('SET search_path TO public');
        await client.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
        await client.end();
    };

    return { client, schemaName, cleanup };
}
```

3. **Update package.json test scripts**:
```bash
cd /home/mp/Workspace/scrapegoat

# Add to package.json scripts:
{
    "test": "NODE_ENV=test jest",
    "test:db": "NODE_ENV=test jest --testPathPattern=store",
    "test:coverage": "NODE_ENV=test jest --coverage"
}
```

**Deliverable**: Project configured to use test database

---

#### B6: Run Migrations on Test Database (15 minutes)

**Action**: Apply all migrations to test database

**Commands**:
```bash
cd /home/mp/Workspace/scrapegoat

# Set environment
export DATABASE_URL="postgresql://postgres:Mustiness-Grit7-Kindling@postgres.den.lan:5432/scrapegoat_test"

# Run migrations (depends on your migration script)
npm run migrate
# OR
node scripts/migrate.js
# OR
npx ts-node src/scripts/migrate.ts
```

**Manual Verification**:
```bash
psql -h postgres.den.lan -U postgres -d scrapegoat_test

-- Check tables
\dt

-- Should see:
-- documents
-- libraries
-- versions
-- migrations

-- Check indexes
\di

-- Should see:
-- idx_documents_search_vector (GIN)
-- idx_documents_embedding (vector index)

-- Check triggers
SELECT tgname FROM pg_trigger WHERE tgname LIKE '%search_vector%';

-- Check vector extension
\dx vector
```

**Deliverable**: All migrations applied successfully

---

#### B7: Verify Database Setup (15 minutes)

**Action**: Run comprehensive verification checks

**Verification Script**:
```sql
-- Connect to test database
\c scrapegoat_test

-- 1. Verify database encoding
SHOW SERVER_ENCODING;
SHOW CLIENT_ENCODING;

-- 2. Verify pgvector
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- 3. Verify tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Expected: documents, libraries, migrations, versions

-- 4. Verify search_vector column
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'documents'
  AND column_name = 'search_vector';

-- Expected: search_vector | tsvector

-- 5. Verify embedding column
SELECT column_name, udt_name
FROM information_schema.columns
WHERE table_name = 'documents'
  AND column_name = 'embedding';

-- Expected: embedding | vector

-- 6. Verify GIN index on search_vector
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'documents'
  AND indexname LIKE '%search_vector%';

-- 7. Verify trigger exists
SELECT tgname, tgtype, tgenabled
FROM pg_trigger
WHERE tgrelid = 'documents'::regclass
  AND tgname LIKE '%search_vector%';

-- 8. Test FTS functionality
INSERT INTO documents (title, content, library, version, url)
VALUES ('Test Doc', 'This is a test document', 'test_lib', '1.0', 'http://test.com');

SELECT to_tsvector('english', content) FROM documents WHERE title = 'Test Doc';

SELECT * FROM documents
WHERE search_vector @@ plainto_tsquery('english', 'test');

-- 9. Test vector functionality
UPDATE documents SET embedding = '[1,2,3]'::vector WHERE title = 'Test Doc';

SELECT embedding FROM documents WHERE title = 'Test Doc';

-- 10. Cleanup test data
DELETE FROM documents WHERE title = 'Test Doc';
```

**Deliverable**: All verification checks pass

---

#### B8: Document Connection Details (10 minutes)

**Action**: Update .env.example and documentation

**Files to Update**:

1. **.env.example**:
```bash
cd /home/mp/Workspace/scrapegoat

cat >> .env.example << 'EOF'

# PostgreSQL Database Configuration
DATABASE_URL=postgresql://username:password@host:5432/database

# Example for development
# DATABASE_URL=postgresql://postgres:password@localhost:5432/scrapegoat_dev

# Example for testing
# DATABASE_URL=postgresql://postgres:password@postgres.den.lan:5432/scrapegoat_test

# Example for production
# DATABASE_URL=postgresql://user:password@prod-host:5432/scrapegoat_prod

# Connection pool settings (optional)
# PGPOOL_MIN=2
# PGPOOL_MAX=10
EOF
```

2. **README.md** (add quick start section):
```markdown
## Quick Start

### Database Setup

1. Create PostgreSQL database:
```sql
CREATE DATABASE scrapegoat;
CREATE EXTENSION vector;
```

2. Configure connection:
```bash
export DATABASE_URL="postgresql://user:password@host:5432/scrapegoat"
```

3. Run migrations:
```bash
npm run migrate
```

See [docs/POSTGRESQL_SETUP.md](docs/POSTGRESQL_SETUP.md) for detailed setup instructions.
```

**Deliverable**: Connection details documented

---

### Phase B Completion Criteria

- [ ] scrapegoat_test database created on postgres.den.lan
- [ ] pgvector extension installed and working
- [ ] Test user created (optional)
- [ ] Project configured to use test database
- [ ] All migrations applied successfully
- [ ] Database verification checks pass
- [ ] Connection details documented

**Next Phase**: Phase C (depends on Phase B completion)

---

## PHASE C: Rewrite Migration Tests

**Priority**: MEDIUM-HIGH
**Estimated Time**: 3.5-4.5 hours
**Dependencies**: Phase B complete
**Status**: 🔴 Not Started

### Objective
Rewrite applyMigrations.test.ts to use schema-based test isolation for PostgreSQL.

### Tasks

#### C1: Analyze Current Tests (30 minutes)

**Action**: Understand existing migration test structure

**Files to Examine**:
```bash
cd /home/mp/Workspace/scrapegoat
cat src/store/applyMigrations.test.ts
cat src/store/applyMigrations.ts
```

**What to Document**:
- What scenarios are being tested
- How SQLite :memory: is currently used
- What assertions are made
- What cleanup is performed

**Deliverable**: Understanding of test requirements

---

#### C2: Create Schema-Based Test Helpers (1 hour)

**Action**: Create helper functions for schema-based isolation

**File to Create/Update**: `src/store/test-utils.ts`

**Implementation**:
```typescript
// src/store/test-utils.ts

import { Client } from 'pg';
import { applyMigrations } from './applyMigrations';

export interface TestDatabase {
    client: Client;
    schemaName: string;
    cleanup: () => Promise<void>;
}

/**
 * Create isolated test database using schema isolation
 * @param applyMigrationsFlag - Whether to apply migrations (default: true)
 */
export async function createTestDatabase(
    applyMigrationsFlag: boolean = true
): Promise<TestDatabase> {
    const schemaName = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const client = new Client({
        connectionString: process.env.DATABASE_URL ||
            'postgresql://postgres:Mustiness-Grit7-Kindling@postgres.den.lan:5432/scrapegoat_test'
    });

    await client.connect();

    try {
        // Create test schema
        await client.query(`CREATE SCHEMA ${schemaName}`);

        // Set search path to test schema
        await client.query(`SET search_path TO ${schemaName}`);

        // Apply migrations if requested
        if (applyMigrationsFlag) {
            await applyMigrations(client);
        }

        const cleanup = async () => {
            try {
                // Reset search path
                await client.query('SET search_path TO public');

                // Drop test schema and all objects
                await client.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
            } finally {
                // Always close connection
                await client.end();
            }
        };

        return { client, schemaName, cleanup };
    } catch (error) {
        // Cleanup on error
        await client.end();
        throw error;
    }
}

/**
 * Run a test with isolated database
 */
export async function withTestDatabase<T>(
    fn: (client: Client, schemaName: string) => Promise<T>,
    applyMigrationsFlag: boolean = true
): Promise<T> {
    const { client, schemaName, cleanup } = await createTestDatabase(applyMigrationsFlag);

    try {
        return await fn(client, schemaName);
    } finally {
        await cleanup();
    }
}
```

**Test the Helper**:
```typescript
// Quick test
import { createTestDatabase } from './test-utils';

async function test() {
    const db = await createTestDatabase(false);
    console.log('Schema:', db.schemaName);

    // Schema should be empty
    const result = await db.client.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = $1
    `, [db.schemaName]);

    console.log('Tables:', result.rows);  // Should be empty

    await db.cleanup();
}

test();
```

**Deliverable**: Working test helper functions

---

#### C3: Rewrite Migration Tests (2-3 hours)

**Action**: Rewrite applyMigrations.test.ts for PostgreSQL

**File to Update**: `src/store/applyMigrations.test.ts`

**Implementation**:
```typescript
// src/store/applyMigrations.test.ts

import { Client } from 'pg';
import { applyMigrations } from './applyMigrations';
import { createTestDatabase, TestDatabase } from './test-utils';

describe('Migration System', () => {
    describe('Fresh Database Migration', () => {
        let db: TestDatabase;

        beforeEach(async () => {
            // Create empty schema (no migrations applied)
            db = await createTestDatabase(false);
        });

        afterEach(async () => {
            await db.cleanup();
        });

        it('should apply all migrations to empty schema', async () => {
            // Apply migrations
            await applyMigrations(db.client);

            // Verify tables exist
            const result = await db.client.query(`
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = $1
                ORDER BY table_name
            `, [db.schemaName]);

            const tableNames = result.rows.map(r => r.table_name);
            expect(tableNames).toContain('documents');
            expect(tableNames).toContain('libraries');
            expect(tableNames).toContain('versions');
            expect(tableNames).toContain('migrations');
        });

        it('should create all indexes', async () => {
            await applyMigrations(db.client);

            const result = await db.client.query(`
                SELECT indexname
                FROM pg_indexes
                WHERE schemaname = $1
                ORDER BY indexname
            `, [db.schemaName]);

            const indexNames = result.rows.map(r => r.indexname);
            expect(indexNames).toContain('idx_documents_search_vector');
            expect(indexNames).toContain('idx_documents_embedding');
        });

        it('should create search_vector trigger', async () => {
            await applyMigrations(db.client);

            const result = await db.client.query(`
                SELECT tgname
                FROM pg_trigger
                JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
                JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
                WHERE nspname = $1
                  AND tgname LIKE '%search_vector%'
            `, [db.schemaName]);

            expect(result.rows.length).toBeGreaterThan(0);
        });

        it('should track migration versions', async () => {
            await applyMigrations(db.client);

            const result = await db.client.query(`
                SELECT version FROM migrations ORDER BY version
            `);

            expect(result.rows.length).toBeGreaterThan(0);

            // Verify versions are sequential
            const versions = result.rows.map(r => r.version);
            for (let i = 0; i < versions.length; i++) {
                expect(versions[i]).toBe(i + 1);
            }
        });
    });

    describe('Incremental Migration', () => {
        let db: TestDatabase;

        beforeEach(async () => {
            db = await createTestDatabase(false);
        });

        afterEach(async () => {
            await db.cleanup();
        });

        it('should only apply new migrations', async () => {
            // Apply migrations first time
            await applyMigrations(db.client);

            const firstResult = await db.client.query(
                'SELECT version FROM migrations ORDER BY version'
            );
            const firstCount = firstResult.rows.length;

            // Apply migrations again (should be no-op)
            await applyMigrations(db.client);

            const secondResult = await db.client.query(
                'SELECT version FROM migrations ORDER BY version'
            );
            const secondCount = secondResult.rows.length;

            // Same number of migrations
            expect(secondCount).toBe(firstCount);
        });

        it('should be idempotent', async () => {
            // Apply multiple times
            await applyMigrations(db.client);
            await applyMigrations(db.client);
            await applyMigrations(db.client);

            // Verify tables still exist and are correct
            const result = await db.client.query(`
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = $1
            `, [db.schemaName]);

            expect(result.rows.length).toBeGreaterThan(0);
        });
    });

    describe('Migration Tracking', () => {
        let db: TestDatabase;

        beforeEach(async () => {
            db = await createTestDatabase(false);
        });

        afterEach(async () => {
            await db.cleanup();
        });

        it('should create migrations table', async () => {
            await applyMigrations(db.client);

            const result = await db.client.query(`
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = $1
                  AND table_name = 'migrations'
            `, [db.schemaName]);

            expect(result.rows).toHaveLength(1);
        });

        it('should record applied_at timestamp', async () => {
            await applyMigrations(db.client);

            const result = await db.client.query(`
                SELECT version, applied_at FROM migrations
            `);

            expect(result.rows.length).toBeGreaterThan(0);

            // All should have timestamps
            result.rows.forEach(row => {
                expect(row.applied_at).toBeInstanceOf(Date);
                expect(row.applied_at.getTime()).toBeLessThanOrEqual(Date.now());
            });
        });
    });

    describe('Error Handling', () => {
        let db: TestDatabase;

        beforeEach(async () => {
            db = await createTestDatabase(false);
        });

        afterEach(async () => {
            await db.cleanup();
        });

        it('should handle connection errors gracefully', async () => {
            // Create client with bad connection
            const badClient = new Client({
                host: 'nonexistent.example.com',
                database: 'fake',
                user: 'fake',
                password: 'fake',
            });

            await expect(applyMigrations(badClient)).rejects.toThrow();
        });

        // Add more error handling tests as needed
    });
});
```

**Deliverable**: Rewritten migration tests

---

#### C4: Update applyMigrations for Schema Support (30 minutes)

**Action**: Ensure applyMigrations works with schema isolation

**File to Update**: `src/store/applyMigrations.ts`

**Verify/Update**:
```typescript
// The function should respect the current search_path
// No changes needed if using relative table names

export async function applyMigrations(client: Client): Promise<void> {
    // Create migrations table in current schema
    await client.query(`
        CREATE TABLE IF NOT EXISTS migrations (
            version INTEGER PRIMARY KEY,
            applied_at TIMESTAMP DEFAULT NOW()
        )
    `);

    // Get applied migrations from current schema (respects search_path)
    const result = await client.query('SELECT version FROM migrations');
    const appliedVersions = new Set(result.rows.map(r => r.version));

    // Load migration files
    const migrations = await loadMigrations();

    // Apply pending migrations
    for (const migration of migrations) {
        if (!appliedVersions.has(migration.version)) {
            console.log(`Applying migration ${migration.version}...`);

            // Execute migration SQL
            await client.query(migration.sql);

            // Record migration
            await client.query(
                'INSERT INTO migrations (version) VALUES ($1)',
                [migration.version]
            );

            console.log(`Migration ${migration.version} applied successfully`);
        }
    }
}
```

**Test**:
```bash
npm test -- applyMigrations.test.ts
```

**Deliverable**: Migration system works with schema isolation

---

#### C5: Run and Validate Tests (30 minutes)

**Action**: Ensure all migration tests pass

**Commands**:
```bash
cd /home/mp/Workspace/scrapegoat

# Run migration tests
npm test -- applyMigrations.test.ts --verbose

# Verify cleanup (should be no test schemas left)
psql -h postgres.den.lan -U postgres -d scrapegoat_test -c "
    SELECT nspname
    FROM pg_namespace
    WHERE nspname LIKE 'test_%'
    ORDER BY nspname;
"
```

**If schemas remain**:
```sql
-- Cleanup script
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

**Deliverable**: All migration tests passing, proper cleanup

---

#### C6: Commit Migration Test Updates (15 minutes)

**Action**: Commit rewritten migration tests

**Commands**:
```bash
cd /home/mp/Workspace/scrapegoat

git add src/store/applyMigrations.test.ts
git add src/store/test-utils.ts
git add src/store/applyMigrations.ts  # if modified

git commit -m "feat(phase-5.2): rewrite migration tests for PostgreSQL

- Implement schema-based test isolation
- Create test helper functions (createTestDatabase, withTestDatabase)
- Rewrite all migration tests to use schemas instead of :memory:
- Add proper cleanup to prevent test pollution
- Test fresh migrations, incremental migrations, and error handling
- All migration tests passing

Refs: #phase-5.2-migrations"
```

**Deliverable**: Migration tests committed

---

### Phase C Completion Criteria

- [ ] applyMigrations.test.ts rewritten for PostgreSQL
- [ ] Test helper functions created and working
- [ ] All migration tests passing
- [ ] Schema cleanup working correctly
- [ ] No test pollution between tests
- [ ] Changes committed to git

**Next Phase**: Phase D (depends on Phase A completion)

---

## PHASE D: Validate Service Layer Tests

**Priority**: MEDIUM
**Estimated Time**: 2.5-3.5 hours
**Dependencies**: Phase A complete
**Status**: 🔴 Not Started

### Objective
Validate and update DocumentRetrieverService.test.ts for PostgreSQL hybrid search.

### Tasks

#### D1: Review Service Tests (30 minutes)

**Action**: Examine DocumentRetrieverService tests

**Commands**:
```bash
cd /home/mp/Workspace/scrapegoat

# Read test file
cat src/store/DocumentRetrieverService.test.ts

# Run tests to see current status
npm test -- DocumentRetrieverService.test.ts
```

**What to Check**:
- Does it use hybrid search (vector + FTS)?
- What are the expected scores/rankings?
- Are there hardcoded assertions that need updating?
- What test fixtures are used?

**Deliverable**: Understanding of service test requirements

---

#### D2: Run Tests and Identify Issues (30 minutes)

**Action**: Run tests and document failures

**Commands**:
```bash
npm test -- DocumentRetrieverService.test.ts --verbose 2>&1 | tee service-test-errors.log
```

**Document**:
- Which tests pass
- Which tests fail
- Error messages
- Expected vs actual values

**Deliverable**: List of issues to fix

---

#### D3: Update Service Implementation (1-2 hours)

**Action**: Fix DocumentRetrieverService if needed

**File**: `src/store/DocumentRetrieverService.ts`

**Potential Issues to Fix**:

1. **Hybrid search query syntax**:
```typescript
// Verify query uses PostgreSQL syntax
const query = `
    SELECT
        d.*,
        (1 - (d.embedding <-> $1::vector)) AS vector_score,
        ts_rank(d.search_vector, plainto_tsquery('english', $2)) AS fts_score,
        (1 - (d.embedding <-> $1::vector)) * $3 +
        ts_rank(d.search_vector, plainto_tsquery('english', $2)) * (1 - $3) AS combined_score
    FROM documents d
    WHERE
        d.search_vector @@ plainto_tsquery('english', $2)
        OR (d.embedding <-> $1::vector) < $4
    ORDER BY combined_score DESC
    LIMIT $5
`;
```

2. **Score normalization**:
- Vector scores: 1 - distance (range 0-1)
- FTS scores: ts_rank() (range varies, typically 0-1)
- May need to normalize differently

3. **Filtering**:
```typescript
// Add library/version filtering
AND library = $6
AND version = $7
```

**Deliverable**: Updated service implementation

---

#### D4: Adjust Test Expectations (30 minutes)

**Action**: Update test assertions if needed

**File**: `src/store/DocumentRetrieverService.test.ts`

**Potential Updates**:
```typescript
// Before (SQLite):
expect(results[0].score).toBeCloseTo(0.95, 2);

// After (PostgreSQL):
// Scores might be different due to ranking algorithm
expect(results[0].score).toBeGreaterThan(0.8);
expect(results[0].score).toBeLessThanOrEqual(1.0);

// Or update expected value based on actual PostgreSQL scores
expect(results[0].score).toBeCloseTo(0.87, 2);
```

**Important**: Don't lower quality standards, just adjust for algorithm differences.

**Deliverable**: Updated test assertions

---

#### D5: Validate Hybrid Search (30 minutes)

**Action**: Manual testing of hybrid search

**Test Script**:
```typescript
// Create test script: scripts/test-hybrid-search.ts

import { DocumentRetrieverService } from '../src/store/DocumentRetrieverService';
import { DocumentStore } from '../src/store/DocumentStore';
import { createTestDatabase } from '../src/store/test-utils';

async function test() {
    const db = await createTestDatabase();

    try {
        const store = new DocumentStore(db.client);
        const retriever = new DocumentRetrieverService(db.client);

        // Add test documents
        await store.insertDocument({
            title: 'PostgreSQL Tutorial',
            content: 'Learn PostgreSQL database management',
            library: 'test',
            version: '1.0',
            url: 'http://test.com/pg',
            embedding: [0.1, 0.2, 0.3, ...], // 1536 dimensions
        });

        await store.insertDocument({
            title: 'MongoDB Guide',
            content: 'NoSQL database with MongoDB',
            library: 'test',
            version: '1.0',
            url: 'http://test.com/mongo',
            embedding: [0.5, 0.6, 0.7, ...],
        });

        // Test FTS search
        console.log('FTS Search for "postgresql":');
        const ftsResults = await retriever.search('postgresql', { useFTS: true });
        console.log(ftsResults);

        // Test vector search
        console.log('Vector Search:');
        const vectorResults = await retriever.search(null, {
            embedding: [0.1, 0.2, 0.3, ...],
            useVector: true,
        });
        console.log(vectorResults);

        // Test hybrid search
        console.log('Hybrid Search:');
        const hybridResults = await retriever.search('postgresql', {
            embedding: [0.1, 0.2, 0.3, ...],
            useFTS: true,
            useVector: true,
            vectorWeight: 0.5,
        });
        console.log(hybridResults);

    } finally {
        await db.cleanup();
    }
}

test().catch(console.error);
```

**Run**:
```bash
npx ts-node scripts/test-hybrid-search.ts
```

**Deliverable**: Hybrid search working correctly

---

#### D6: Run Tests and Verify (30 minutes)

**Action**: Ensure all service tests pass

**Commands**:
```bash
npm test -- DocumentRetrieverService.test.ts

# Expected: all tests passing
```

**If tests fail**:
1. Read error messages carefully
2. Check query syntax
3. Verify test data
4. Debug with console.log
5. Fix and re-run

**Deliverable**: All service tests passing

---

#### D7: Commit Service Updates (15 minutes)

**Action**: Commit service layer updates

**Commands**:
```bash
git add src/store/DocumentRetrieverService.ts
git add src/store/DocumentRetrieverService.test.ts

git commit -m "feat(phase-5.2): validate DocumentRetrieverService for PostgreSQL

- Update hybrid search query for PostgreSQL syntax
- Adjust score normalization for ts_rank()
- Update test expectations for PostgreSQL ranking
- All DocumentRetrieverService tests passing

Refs: #phase-5.2-service"
```

**Deliverable**: Service updates committed

---

### Phase D Completion Criteria

- [ ] DocumentRetrieverService.test.ts reviewed
- [ ] All service tests passing
- [ ] Hybrid search working correctly
- [ ] Score calculations verified
- [ ] Changes committed to git

**Next Phase**: Phase E (verify CLI tests)

---

## PHASE E: Verify CLI Tests

**Priority**: MEDIUM
**Estimated Time**: 0.5-3 hours
**Dependencies**: Phases A and D complete
**Status**: 🔴 Not Started

### Objective
Verify all CLI command tests pass with PostgreSQL backend.

### Tasks

#### E1: Identify CLI Tests (15 minutes)

**Action**: Find all CLI test files

**Commands**:
```bash
cd /home/mp/Workspace/scrapegoat

# Find CLI test files
find src -name "*.test.ts" -path "*/commands/*"

# Or search for test files
grep -r "describe.*command" src/commands/
```

**Deliverable**: List of CLI test files

---

#### E2: Run CLI Tests (15 minutes)

**Action**: Run all CLI tests

**Commands**:
```bash
# Run all CLI tests
npm test -- --testPathPattern=commands

# Or run specific command tests
npm test -- src/commands/add-library.test.ts
npm test -- src/commands/search.test.ts
npm test -- src/commands/list.test.ts
npm test -- src/commands/delete.test.ts
```

**Document**:
- Which tests pass
- Which tests fail
- Error messages

**Deliverable**: CLI test status report

---

#### E3: Fix CLI Test Issues (0-2 hours)

**Action**: Fix any failing CLI tests

**If tests pass**: Skip to E4
**If tests fail**: Debug and fix

**Common Issues**:
- Database connection errors
- Query syntax errors (should be fixed by Phase A)
- Test data setup issues
- Assertion issues

**Process**:
1. Read error message
2. Identify root cause
3. Fix implementation or test
4. Re-run tests
5. Repeat until passing

**Deliverable**: All CLI tests passing

---

#### E4: Manual CLI Testing (30 minutes)

**Action**: Manually test CLI commands

**Test Scenario**:
```bash
cd /home/mp/Workspace/scrapegoat

# Set database URL
export DATABASE_URL="postgresql://postgres:Mustiness-Grit7-Kindling@postgres.den.lan:5432/scrapegoat_test"

# 1. Add a library
npm run add-library -- test-lib v1.0 \
    --docs-url "https://example.com/docs"

# 2. List libraries
npm run list

# Expected output: test-lib v1.0

# 3. Search documents
npm run search -- "test query"

# Expected: search results or no results

# 4. Delete library
npm run delete -- test-lib v1.0

# 5. Verify deletion
npm run list

# Expected: test-lib not listed
```

**Deliverable**: CLI commands working manually

---

#### E5: Commit CLI Fixes (15 minutes)

**Action**: Commit any CLI fixes

**If changes made**:
```bash
git add src/commands/

git commit -m "fix(phase-5.2): update CLI commands for PostgreSQL

- Fix [specific issues]
- All CLI tests passing

Refs: #phase-5.2-cli"
```

**If no changes needed**:
```bash
# Just verify in notes
echo "CLI tests already passing, no changes needed"
```

**Deliverable**: CLI fixes committed (if any)

---

### Phase E Completion Criteria

- [ ] All CLI test files identified
- [ ] All CLI tests passing
- [ ] Manual CLI testing successful
- [ ] Changes committed (if any)

**Next Phase**: Phase F (documentation)

---

## PHASE F: Create Documentation

**Priority**: MEDIUM
**Estimated Time**: 4-6 hours
**Dependencies**: None (can start anytime)
**Status**: 🔴 Not Started

### Objective
Create comprehensive setup and configuration documentation.

### Tasks

#### F1: Create POSTGRESQL_SETUP.md (2-3 hours)

**Action**: Write complete PostgreSQL setup guide

**File**: `/home/mp/Workspace/scrapegoat/docs/POSTGRESQL_SETUP.md`

**Template Structure**:

```markdown
# PostgreSQL Setup Guide

## Prerequisites

- PostgreSQL 15 or higher
- pgvector extension
- Node.js 18 or higher
- npm or yarn

## Installation

### Linux (Debian/Ubuntu)

\`\`\`bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Install pgvector
sudo apt install postgresql-15-pgvector
\`\`\`

### Linux (RHEL/CentOS/Fedora)

\`\`\`bash
# Install PostgreSQL
sudo dnf install postgresql-server postgresql-contrib

# Initialize database
sudo postgresql-setup --initdb

# Install pgvector
sudo dnf install pgvector_15
\`\`\`

### macOS

\`\`\`bash
# Install PostgreSQL
brew install postgresql@15

# Install pgvector
brew install pgvector
\`\`\`

### Windows

1. Download PostgreSQL installer from https://www.postgresql.org/download/windows/
2. Run installer and follow prompts
3. Download pgvector from https://github.com/pgvector/pgvector/releases
4. Install pgvector following Windows instructions

## Database Setup

### 1. Create Database

\`\`\`bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE scrapegoat
    WITH
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF-8'
    LC_CTYPE = 'en_US.UTF-8';

# Connect to database
\\c scrapegoat

# Create pgvector extension
CREATE EXTENSION vector;

# Verify extension
\\dx vector
\`\`\`

### 2. Create User (Optional)

\`\`\`sql
-- Create user
CREATE USER scrapegoat WITH PASSWORD 'your_secure_password';

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE scrapegoat TO scrapegoat;

\\c scrapegoat

GRANT ALL ON SCHEMA public TO scrapegoat;
GRANT CREATE ON SCHEMA public TO scrapegoat;
\`\`\`

## Configuration

### 1. Environment Variables

Create `.env` file:

\`\`\`bash
DATABASE_URL=postgresql://scrapegoat:your_secure_password@localhost:5432/scrapegoat
\`\`\`

### 2. Run Migrations

\`\`\`bash
npm install
npm run migrate
\`\`\`

### 3. Verify Setup

\`\`\`bash
# Check database connection
npm run test:db

# Or connect manually
psql -U scrapegoat -d scrapegoat

# Verify tables
\\dt

# Should see:
# documents, libraries, versions, migrations

# Verify indexes
\\di

# Verify pgvector
SELECT '[1,2,3]'::vector;
\`\`\`

## Troubleshooting

### Error: "extension vector does not exist"

**Solution**: Install pgvector extension

\`\`\`bash
# Check if pgvector is installed
psql -U postgres -c "SELECT * FROM pg_available_extensions WHERE name = 'vector';"

# If not available, install from source
git clone https://github.com/pgvector/pgvector.git
cd pgvector
make
make install  # may need sudo
\`\`\`

### Error: "could not connect to server"

**Solution**: Check PostgreSQL is running

\`\`\`bash
# Linux
sudo systemctl status postgresql
sudo systemctl start postgresql

# macOS
brew services list
brew services start postgresql@15
\`\`\`

### Error: "permission denied"

**Solution**: Grant proper permissions

\`\`\`sql
\\c scrapegoat
GRANT ALL ON SCHEMA public TO scrapegoat;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO scrapegoat;
\`\`\`

### Performance Issues

**Solution**: Optimize PostgreSQL settings

\`\`\`sql
-- Increase shared buffers (in postgresql.conf)
shared_buffers = 256MB

-- Increase work memory
work_mem = 16MB

-- Tune effective cache size
effective_cache_size = 1GB

-- Restart PostgreSQL after changes
\`\`\`

## Production Deployment

### Security

1. **Use strong passwords**
2. **Enable SSL/TLS**:

\`\`\`bash
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
\`\`\`

3. **Restrict network access** (pg_hba.conf)
4. **Regular backups**:

\`\`\`bash
# Backup
pg_dump -U scrapegoat scrapegoat > backup.sql

# Restore
psql -U scrapegoat scrapegoat < backup.sql
\`\`\`

### Performance Tuning

1. **Create appropriate indexes** (already in migrations)
2. **Use connection pooling** (recommended: pg-pool or pgbouncer)
3. **Monitor query performance**:

\`\`\`sql
-- Enable slow query logging
log_min_duration_statement = 1000  # Log queries > 1 second
\`\`\`

## Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [PostgreSQL FTS](https://www.postgresql.org/docs/current/textsearch.html)

---

*Last Updated: 2025-11-08*
```

**Deliverable**: Complete POSTGRESQL_SETUP.md

---

#### F2: Create CONFIGURATION.md (2-3 hours)

**Action**: Write complete configuration reference

**File**: `/home/mp/Workspace/scrapegoat/docs/CONFIGURATION.md`

**Template Structure**:

```markdown
# Configuration Reference

## Environment Variables

### DATABASE_URL (Required)

PostgreSQL connection string.

**Format**:
\`\`\`
postgresql://[user]:[password]@[host]:[port]/[database]?[options]
\`\`\`

**Examples**:
\`\`\`bash
# Development
DATABASE_URL=postgresql://localhost/scrapegoat

# Production with SSL
DATABASE_URL=postgresql://user:pass@prod.example.com:5432/scrapegoat?sslmode=require

# With connection pool
DATABASE_URL=postgresql://user:pass@localhost/scrapegoat?max=20&min=5
\`\`\`

**Options**:
- `sslmode`: require, prefer, disable
- `max`: Maximum pool connections (default: 10)
- `min`: Minimum pool connections (default: 2)
- `connectionTimeoutMillis`: Connection timeout (default: 30000)
- `idleTimeoutMillis`: Idle timeout (default: 30000)

### OPENAI_API_KEY

OpenAI API key for generating embeddings.

\`\`\`bash
OPENAI_API_KEY=sk-...
\`\`\`

### LOG_LEVEL

Logging verbosity.

**Values**: error, warn, info, debug
**Default**: info

\`\`\`bash
LOG_LEVEL=debug
\`\`\`

### NODE_ENV

Environment mode.

**Values**: development, production, test
**Default**: development

\`\`\`bash
NODE_ENV=production
\`\`\`

## Database Configuration

### Connection Pool

Configure via DATABASE_URL query parameters:

\`\`\`bash
DATABASE_URL=postgresql://localhost/scrapegoat?max=20&min=5&idleTimeoutMillis=30000
\`\`\`

**Recommended Settings**:

| Environment | Min | Max | Idle Timeout |
|------------|-----|-----|--------------|
| Development | 2 | 5 | 10000 |
| Production | 5 | 20 | 30000 |
| Test | 1 | 5 | 5000 |

### SSL/TLS

**Disable SSL** (development only):
\`\`\`bash
DATABASE_URL=postgresql://localhost/scrapegoat?sslmode=disable
\`\`\`

**Require SSL** (production):
\`\`\`bash
DATABASE_URL=postgresql://host/db?sslmode=require
\`\`\`

**Custom SSL certificate**:
\`\`\`bash
DATABASE_URL=postgresql://host/db?sslmode=verify-full&sslcert=/path/to/cert.pem&sslkey=/path/to/key.pem&sslrootcert=/path/to/ca.pem
\`\`\`

## Vector Search Configuration

### Embedding Dimensions

**Default**: 1536 (OpenAI text-embedding-ada-002)

To change, update migration:
\`\`\`sql
ALTER TABLE documents
ALTER COLUMN embedding TYPE vector(768);  -- For different model
\`\`\`

### Similarity Threshold

Configure in search queries:

\`\`\`typescript
// In DocumentRetrieverService
const threshold = 0.7;  // 0-1, higher = more similar

WHERE (embedding <-> $1::vector) < (1 - threshold)
\`\`\`

### Distance Metric

pgvector supports multiple metrics:

**Cosine Distance** (default, recommended):
\`\`\`sql
SELECT embedding <-> '[...]'::vector AS distance
\`\`\`

**L2 Distance**:
\`\`\`sql
SELECT embedding <-> '[...]'::vector AS distance
\`\`\`

**Inner Product**:
\`\`\`sql
SELECT (embedding <#> '[...]'::vector) * -1 AS similarity
\`\`\`

## Full-Text Search Configuration

### Text Search Configuration

**Default**: english

To change:
\`\`\`sql
-- In migration trigger
CREATE TRIGGER documents_search_vector_update
BEFORE INSERT OR UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION tsvector_update_trigger(
    search_vector, 'pg_catalog.french', -- Change language
    title, content, url
);
\`\`\`

**Available Configurations**:
- english (default)
- simple (no stemming)
- french, german, spanish, etc.

### Search Ranking Weights

Adjust in query:
\`\`\`sql
-- Weight title higher than content
SELECT
    ts_rank(
        setweight(to_tsvector('english', title), 'A') ||
        setweight(to_tsvector('english', content), 'B'),
        query
    ) as rank
FROM documents
\`\`\`

**Weights**: A (1.0), B (0.4), C (0.2), D (0.1)

## Hybrid Search Configuration

### Vector vs FTS Weight

Configure weight in search:

\`\`\`typescript
const vectorWeight = 0.5;  // 0-1
const ftsWeight = 1 - vectorWeight;

const combinedScore =
    vectorScore * vectorWeight +
    ftsScore * ftsWeight;
\`\`\`

**Recommendations**:
- Equal weights (0.5/0.5): Balanced
- Vector heavy (0.7/0.3): Semantic similarity priority
- FTS heavy (0.3/0.7): Keyword matching priority

## Performance Tuning

### Index Optimization

**GIN Index** (recommended for FTS):
\`\`\`sql
CREATE INDEX idx_search_vector ON documents USING GIN(search_vector);
\`\`\`

**HNSW Index** (recommended for vectors):
\`\`\`sql
CREATE INDEX idx_embedding ON documents
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
\`\`\`

Parameters:
- `m`: Max connections per node (higher = better recall, more memory)
- `ef_construction`: Construction effort (higher = better quality, slower build)

### Query Performance

**Use EXPLAIN ANALYZE**:
\`\`\`sql
EXPLAIN ANALYZE
SELECT * FROM documents
WHERE search_vector @@ plainto_tsquery('english', 'search term');
\`\`\`

**Optimize common queries**:
\`\`\`sql
-- Create covering index
CREATE INDEX idx_documents_search_cover ON documents
USING GIN(search_vector)
INCLUDE (id, title, library, version);
\`\`\`

## Example Configurations

### Development

\`\`\`.env
DATABASE_URL=postgresql://localhost/scrapegoat_dev?max=5
NODE_ENV=development
LOG_LEVEL=debug
OPENAI_API_KEY=sk-...
\`\`\`

### Production

\`\`\`.env
DATABASE_URL=postgresql://user:pass@prod.example.com:5432/scrapegoat?sslmode=require&max=20&min=5
NODE_ENV=production
LOG_LEVEL=warn
OPENAI_API_KEY=sk-...
\`\`\`

### Testing

\`\`\`.env.test
DATABASE_URL=postgresql://localhost/scrapegoat_test?max=5
NODE_ENV=test
LOG_LEVEL=error
\`\`\`

---

*Last Updated: 2025-11-08*
```

**Deliverable**: Complete CONFIGURATION.md

---

#### F3: Update README.md (30 minutes)

**Action**: Add links to new documentation

**File**: `/home/mp/Workspace/scrapegoat/README.md`

**Updates**:
```markdown
## Documentation

- [PostgreSQL Setup Guide](docs/POSTGRESQL_SETUP.md) - Complete setup instructions
- [Configuration Reference](docs/CONFIGURATION.md) - All configuration options
- [Migration Guide](docs/MIGRATION_GUIDE.md) - SQLite to PostgreSQL migration
- [Development Guide](docs/DEVELOPMENT.md) - Development workflow

## Quick Start

### 1. Setup PostgreSQL

See [docs/POSTGRESQL_SETUP.md](docs/POSTGRESQL_SETUP.md) for detailed instructions.

\`\`\`bash
createdb scrapegoat
psql -d scrapegoat -c "CREATE EXTENSION vector;"
\`\`\`

### 2. Configure Connection

\`\`\`bash
echo "DATABASE_URL=postgresql://localhost/scrapegoat" > .env
\`\`\`

### 3. Run Migrations

\`\`\`bash
npm install
npm run migrate
\`\`\`

### 4. Start Using

\`\`\`bash
npm run add-library -- mylib v1.0 --docs-url https://example.com/docs
npm run search -- "search query"
\`\`\`
```

**Deliverable**: Updated README.md

---

#### F4: Review and Polish (30 minutes)

**Action**: Review all documentation for quality

**Checklist**:
- [ ] All code examples are correct
- [ ] All commands have been tested
- [ ] Links work correctly
- [ ] Formatting is consistent
- [ ] No typos or grammatical errors
- [ ] Examples are clear and helpful
- [ ] Troubleshooting section is comprehensive

**Tools**:
```bash
# Check markdown formatting
npx markdownlint docs/*.md

# Spell check (if available)
aspell check docs/POSTGRESQL_SETUP.md
```

**Deliverable**: Polished documentation

---

#### F5: Commit Documentation (15 minutes)

**Action**: Commit all documentation

**Commands**:
```bash
cd /home/mp/Workspace/scrapegoat

git add docs/POSTGRESQL_SETUP.md
git add docs/CONFIGURATION.md
git add README.md

git commit -m "docs(phase-5.2): add PostgreSQL setup and configuration guides

- Create comprehensive PostgreSQL setup guide
- Create complete configuration reference
- Update README with documentation links
- Add troubleshooting sections
- Include production deployment guidance

Refs: #phase-5.2-docs"
```

**Deliverable**: Documentation committed

---

### Phase F Completion Criteria

- [ ] POSTGRESQL_SETUP.md created and complete
- [ ] CONFIGURATION.md created and complete
- [ ] README.md updated with links
- [ ] All examples tested and working
- [ ] Documentation polished and reviewed
- [ ] Changes committed to git

**Next Phase**: Phase G (finalization)

---

## PHASE G: Finalization and Status Update

**Priority**: LOW
**Estimated Time**: 1-2 hours
**Dependencies**: All previous phases complete
**Status**: 🔴 Not Started

### Objective
Run final validation, update status documentation, and prepare for phase completion.

### Tasks

#### G1: Run Full Test Suite (15 minutes)

**Action**: Run all tests to ensure nothing broke

**Commands**:
```bash
cd /home/mp/Workspace/scrapegoat

# Run all tests
npm test

# Run with coverage
npm run test:coverage
```

**Expected**:
- All tests passing
- Coverage ≥60%

**If failures**:
- Identify which phase broke
- Fix issues
- Re-run tests

**Deliverable**: All tests passing

---

#### G2: Verify Test Coverage (15 minutes)

**Action**: Check test coverage metrics

**Commands**:
```bash
npm run test:coverage

# View detailed report
open coverage/lcov-report/index.html
```

**Verify**:
- Overall coverage ≥60%
- Store layer coverage ≥70%
- No critical paths uncovered

**If below target**:
- Identify uncovered code
- Add tests if time permits
- Document in STATUS.md as known limitation

**Deliverable**: Coverage report generated

---

#### G3: Run Manual End-to-End Test (30 minutes)

**Action**: Manually test the complete workflow

**Test Script**:
```bash
cd /home/mp/Workspace/scrapegoat

# 1. Clean database
psql -h postgres.den.lan -U postgres -d scrapegoat_test -c "TRUNCATE libraries CASCADE;"

# 2. Add a library
npm run add-library -- react v18 --docs-url https://react.dev

# 3. Wait for processing
sleep 10

# 4. List libraries
npm run list

# 5. Search with FTS
npm run search -- "component"

# 6. Search with vector
npm run search -- "state management" --use-vector

# 7. Hybrid search
npm run search -- "hooks" --use-hybrid

# 8. Delete library
npm run delete -- react v18

# 9. Verify deletion
npm run list
```

**Verify**:
- All commands execute successfully
- Search results are relevant
- No errors or warnings

**Deliverable**: Manual test passed

---

#### G4: Update STATUS.md (30 minutes)

**Action**: Update project status documentation

**File**: `/home/mp/Workspace/scrapegoat/STATUS.md`

**Updates**:
```markdown
## Phase 5.2: Test Suite Completion and Documentation

**Status**: ✅ COMPLETE
**Completion Date**: 2025-11-08
**Duration**: [X days]

### Objectives

- [x] Fix all failing DocumentStore tests (24/24 passing - 100%)
- [x] Create dedicated test database on postgres.den.lan
- [x] Rewrite migration tests for PostgreSQL
- [x] Validate service layer tests
- [x] Verify CLI tests
- [x] Create PostgreSQL setup documentation
- [x] Create configuration documentation
- [x] Update project status

### Test Results

**DocumentStore Tests**: 24/24 passing (100%)
**Migration Tests**: [X]/[X] passing (100%)
**Service Tests**: [X]/[X] passing (100%)
**CLI Tests**: [X]/[X] passing (100%)
**Overall**: [X]/[X] passing (100%)

**Test Coverage**: [X]% (Target: ≥60%)
- Overall: [X]%
- Store Layer: [X]%
- Service Layer: [X]%

### Key Changes

1. **FTS Implementation**:
   - Replaced SQLite MATCH syntax with PostgreSQL @@ operator
   - Implemented plainto_tsquery() for safe query parsing
   - Used ts_rank() for result ranking
   - Handle special characters and case sensitivity

2. **Test Infrastructure**:
   - Created dedicated test database (scrapegoat_test)
   - Implemented schema-based test isolation
   - Created test helper functions
   - Proper cleanup to prevent test pollution

3. **Migration System**:
   - Rewrote migration tests for PostgreSQL
   - Support schema-based isolation
   - Test fresh and incremental migrations

4. **Documentation**:
   - Created [POSTGRESQL_SETUP.md](docs/POSTGRESQL_SETUP.md)
   - Created [CONFIGURATION.md](docs/CONFIGURATION.md)
   - Updated README.md with documentation links

### Known Issues

- None

### Next Steps

- Phase 6: [Description of next phase]
```

**Deliverable**: Updated STATUS.md

---

#### G5: Create Phase Completion Summary (15 minutes)

**Action**: Create summary of Phase 5.2 work

**File**: `/home/mp/Workspace/scrapegoat/docs/phase-5.2-summary.md`

**Content**:
```markdown
# Phase 5.2 Completion Summary

**Completion Date**: 2025-11-08
**Total Effort**: [X] hours

## Objectives Achieved

✅ All 24 DocumentStore tests passing (100%)
✅ Test database created and configured
✅ Migration tests rewritten for PostgreSQL
✅ Service layer tests validated
✅ CLI tests verified
✅ Comprehensive documentation created
✅ Test coverage ≥60%

## Technical Accomplishments

### PostgreSQL FTS Implementation

Migrated from SQLite FTS5 to PostgreSQL full-text search:

- Implemented `plainto_tsquery()` for safe query parsing
- Used `@@` operator for matching
- Used `ts_rank()` for ranking
- Handles special characters automatically
- Case-insensitive search by default

### Test Infrastructure

Created robust test isolation using PostgreSQL schemas:

- Schema-based isolation (fast, complete isolation)
- Test helper functions (`createTestDatabase()`)
- Proper cleanup (no test pollution)
- Support for parallel test execution

### Documentation

Created comprehensive guides:

- PostgreSQL setup guide (installation, configuration, troubleshooting)
- Configuration reference (all options, examples, best practices)
- Updated README with quick start

## Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| DocumentStore Tests | 14/24 (58%) | 24/24 (100%) | +42% |
| Migration Tests | 0/X (0%) | X/X (100%) | +100% |
| Test Coverage | Unknown | [X]% | - |
| Documentation | 0 pages | 2 comprehensive guides | - |

## Files Modified

### Source Code
- src/store/DocumentStore.ts
- src/store/DocumentRetrieverService.ts (if needed)
- src/store/applyMigrations.ts (if needed)

### Tests
- src/store/DocumentStore.test.ts
- src/store/applyMigrations.test.ts
- src/store/test-utils.ts (new)

### Documentation
- docs/POSTGRESQL_SETUP.md (new)
- docs/CONFIGURATION.md (new)
- README.md
- STATUS.md

### Configuration
- .env.example
- .env.test (new)

## Git Commits

1. feat(phase-5.2): implement PostgreSQL FTS in DocumentStore
2. feat(phase-5.2): create test database and infrastructure
3. feat(phase-5.2): rewrite migration tests for PostgreSQL
4. feat(phase-5.2): validate DocumentRetrieverService for PostgreSQL (if needed)
5. fix(phase-5.2): update CLI commands for PostgreSQL (if needed)
6. docs(phase-5.2): add PostgreSQL setup and configuration guides
7. docs(phase-5.2): update STATUS.md with Phase 5.2 completion

## Lessons Learned

1. **PostgreSQL FTS is different but powerful**: The migration from SQLite FTS5 required understanding PostgreSQL's text search architecture, but the result is more robust.

2. **Schema-based isolation works well**: Using schemas for test isolation provides good performance while maintaining complete isolation.

3. **Documentation is critical**: Comprehensive setup guides make the difference between a usable and unusable project.

## Recommendations for Next Phase

1. Consider adding monitoring/observability
2. Performance benchmarking
3. Production deployment guide
4. CI/CD pipeline setup

---

*Created: 2025-11-08*
```

**Deliverable**: Phase summary created

---

#### G6: Final Commit and Push (15 minutes)

**Action**: Commit status updates and push all changes

**Commands**:
```bash
cd /home/mp/Workspace/scrapegoat

# Commit status updates
git add STATUS.md
git add docs/phase-5.2-summary.md

git commit -m "docs(phase-5.2): complete Phase 5.2 status update

- Update STATUS.md with completion details
- Create phase completion summary
- Record test metrics and coverage
- Document all changes and accomplishments

Phase 5.2 COMPLETE ✅

Refs: #phase-5.2-complete"

# Review all commits for this phase
git log --oneline --graph postgres-fork ^main

# Push to remote
git push origin postgres-fork
```

**Deliverable**: All changes committed and pushed

---

### Phase G Completion Criteria

- [ ] Full test suite passing
- [ ] Test coverage ≥60%
- [ ] Manual end-to-end test passed
- [ ] STATUS.md updated
- [ ] Phase summary created
- [ ] All changes committed and pushed

---

## Summary and Next Steps

### Phase Completion Checklist

- [ ] **Phase A**: FTS Implementation Fixed (24/24 tests)
- [ ] **Phase B**: Test Database Setup Complete
- [ ] **Phase C**: Migration Tests Rewritten
- [ ] **Phase D**: Service Layer Validated
- [ ] **Phase E**: CLI Tests Verified
- [ ] **Phase F**: Documentation Complete
- [ ] **Phase G**: Final Validation Complete

### Success Criteria Met

- [ ] DocumentStore.test.ts: 24/24 passing (100%)
- [ ] applyMigrations.test.ts: All passing
- [ ] DocumentRetrieverService.test.ts: All passing
- [ ] CLI tests: All passing
- [ ] Test coverage: ≥60%
- [ ] POSTGRESQL_SETUP.md: Complete
- [ ] CONFIGURATION.md: Complete
- [ ] STATUS.md: Updated

### Total Estimated Effort

- **Phase A**: 4-6 hours (CRITICAL)
- **Phase B**: 1.5 hours (can parallel)
- **Phase C**: 3.5-4.5 hours
- **Phase D**: 2.5-3.5 hours
- **Phase E**: 0.5-3 hours
- **Phase F**: 4-6 hours (can start early)
- **Phase G**: 1-2 hours

**Total**: 16-25 hours (2-3 work days)

### Risk Summary

| Risk | Severity | Mitigation |
|------|----------|------------|
| FTS complexity | HIGH | Use plainto_tsquery(), test incrementally |
| Test database conflicts | MEDIUM | Separate database, schema isolation |
| Migration test failures | MEDIUM | Schema-based isolation, good cleanup |
| Performance issues | LOW | Connection pooling, optimized queries |
| Documentation gaps | LOW | Comprehensive guides, troubleshooting |

### Next Actions

1. **START HERE**: Begin Phase A (Fix FTS Implementation)
2. **Parallel**: Start Phase B (Test Database Setup)
3. **Sequential**: Complete remaining phases in order
4. **Continuous**: Update planning documents as you progress

---

*Planning Document Created: 2025-11-08*
*Last Updated: 2025-11-08*
