# Quick Start Guide: Phase 5.2 Implementation

**Use this guide to start implementing Phase 5.2 immediately.**

## Pre-Flight Checklist

Before you begin, ensure:

```bash
# 1. Navigate to project directory
cd /home/mp/Workspace/scrapegoat

# 2. Verify you're on the right branch
git status
# Should show: On branch postgres-fork

# 3. Verify build is passing
npm run build
# Should complete without errors

# 4. Check current test status
npm test -- src/store/DocumentStore.test.ts
# EXPECTED: Will fail (uses SQLite :memory:)

# 5. Start Docker test database
docker-compose -f docker-compose.test.yml up -d

# 6. Verify PostgreSQL connection
psql postgresql://postgres:postgres@localhost:5433/postgres -c "SELECT version();"
# Should return: PostgreSQL 16.x

# 7. Create implementation branch
git checkout -b phase-5.2-test-migration
```

✅ If all checks pass, you're ready to start!

---

## Day 1: DocumentStore.test.ts (4-6 hours)

### Step 1: Backup and Update Imports (15 min)

```bash
# Backup original
cp src/store/DocumentStore.test.ts src/store/DocumentStore.test.ts.backup

# Open in editor
code src/store/DocumentStore.test.ts
```

**Add import** (after line 5):
```typescript
import { createTestDatabase, type TestDatabase } from "./__tests__/testUtils";
```

### Step 2: Update "With Embeddings" Suite (1 hour)

**Find line 69** (`describe("DocumentStore - With Embeddings"`) and update:

**Before** (lines 70-87):
```typescript
describe("DocumentStore - With Embeddings", () => {
  let store: DocumentStore;

  beforeEach(async () => {
    const embeddingConfig = EmbeddingConfig.parseEmbeddingConfig(
      "openai:text-embedding-3-small",
    );
    store = new DocumentStore(":memory:", embeddingConfig);
    await store.initialize();
  });

  afterEach(async () => {
    if (store) {
      await store.shutdown();
    }
  });
```

**After**:
```typescript
describe("DocumentStore - With Embeddings", () => {
  let testDb: TestDatabase;
  let store: DocumentStore;

  beforeEach(async () => {
    const embeddingConfig = EmbeddingConfig.parseEmbeddingConfig(
      "openai:text-embedding-3-small",
    );
    testDb = await createTestDatabase(embeddingConfig);
    store = testDb.store;
  });

  afterEach(async () => {
    if (testDb) {
      await testDb.cleanup();
    }
  });
```

**Find line 726-745** (countDocuments helper) and replace:

```typescript
// NEW PostgreSQL version:
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

### Step 3: Update "Without Embeddings" Suite (30 min)

**Find line 499** and update same pattern as above.

### Step 4: Update "Common Functionality" Suite (30 min)

**Find line 622** and update same pattern as above.

### Step 5: Test and Validate (30 min)

```bash
# Run DocumentStore tests
npm test -- src/store/DocumentStore.test.ts

# Expected: All 30+ tests passing
# If any fail, review error messages and fix

# Check execution time
# Target: <60 seconds
```

**If all pass**: ✅ Day 1 complete!

---

## Day 2: applyMigrations.test.ts (4-6 hours)

### Step 1: Create New File (30 min)

```bash
# Backup original
mv src/store/applyMigrations.test.ts src/store/applyMigrations.test.ts.backup

# Create new file
cat > src/store/applyMigrations.test.ts << 'EOF'
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { Client } from "pg";
import { createTestDatabase, type TestDatabase } from "./__tests__/testUtils";

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

  // Tests will go here
});
EOF
```

### Step 2: Add Tests One by One

**Copy test templates from** `/home/mp/Workspace/scrapegoat/projects/phase-5.2-testing-planning/planning/implementation-plan.md`

**Tests to implement** (in order):
1. Task 2.2: Migration execution (15 min)
2. Task 2.3: Table schemas (30 min)
3. Task 2.4: pgvector extension (15 min)
4. Task 2.5: HNSW index (30 min)
5. Task 2.6: GIN index (15 min)
6. Task 2.7: Vector search (45 min)
7. Task 2.8: Full-text search (30 min)
8. Task 2.9: Migration idempotency (15 min)

**After each test**:
```bash
npm test -- src/store/applyMigrations.test.ts
# Verify new test passes before adding next one
```

### Step 3: Validate

```bash
# Run all migration tests
npm test -- src/store/applyMigrations.test.ts

# Expected: 9+ tests passing
# Execution time: <45 seconds
```

**If all pass**: ✅ Day 2 complete!

---

## Day 3: Validation & CLI Tests (3-4 hours)

### Step 1: DocumentRetrieverService (1 hour)

```bash
# Should already pass (uses mocks)
npm test -- src/store/DocumentRetrieverService.test.ts

# If passes: Great! Add RRF tests from implementation plan (optional)
# If fails: Review and fix
```

### Step 2: CLI Tests (1 hour)

```bash
# Test each CLI command file
npm test -- src/cli/commands/search.test.ts
npm test -- src/cli/commands/list.test.ts
npm test -- src/cli/commands/fetchUrl.test.ts
npm test -- src/cli/commands/findVersion.test.ts
npm test -- src/cli/commands/scrape.test.ts
npm test -- src/cli/commands/remove.test.ts

# Expected: All should pass (they use mocks)
```

### Step 3: Full Test Suite (30 min)

```bash
# Run ALL tests
npm test

# Expected: All tests passing
# Execution time: <5 minutes
```

### Step 4: Coverage Report (30 min)

```bash
# Generate coverage
npm run test:coverage

# Check results:
# - Overall: Should be ≥60%
# - src/store/DocumentStore.ts: Should be ≥60%
# - src/store/applyMigrations.ts: Should be ≥70%

# Generate HTML report
npm run test:coverage -- --reporter=html

# Open in browser
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
```

**If coverage ≥60%**: ✅ Day 3 complete!

---

## Day 4: POSTGRESQL_SETUP.md (4-5 hours)

### Quick Creation

```bash
# Create file
cat > docs/POSTGRESQL_SETUP.md << 'EOF'
# PostgreSQL Setup Guide

[Copy content from implementation plan Task 4.1-4.4]
EOF

# Edit and refine
code docs/POSTGRESQL_SETUP.md
```

**Sections to complete**:
1. ✅ Quick Start with Docker (1 hour)
2. ✅ Manual Installation - Ubuntu (30 min)
3. ✅ Manual Installation - macOS (30 min)
4. ✅ Manual Installation - Windows (30 min)
5. ✅ Verification steps (30 min)
6. ✅ Configuration (30 min)
7. ✅ Troubleshooting (1 hour)

**Test every command!**

### Validation

```bash
# Follow your own Docker guide
# Verify every step works

# Update docs/README.md
code docs/README.md
# Change POSTGRESQL_SETUP.md status to ✅ Complete
```

---

## Day 5: CONFIGURATION.md (4-5 hours)

### Quick Creation

```bash
# Create file
cat > docs/CONFIGURATION.md << 'EOF'
# Configuration Reference

[Copy content from implementation plan Task 5.1-5.3]
EOF

# Edit and refine
code docs/CONFIGURATION.md
```

**Sections to complete**:
1. ✅ Database Configuration (1 hour)
2. ✅ Embedding Configuration (1.5 hours)
3. ✅ Search Configuration (30 min)
4. ✅ Performance Tuning (30 min)
5. ✅ Analytics/Telemetry (15 min)
6. ✅ Development/Testing (15 min)
7. ✅ Migration from SQLite (15 min)
8. ✅ Example configurations (30 min)

**Verify every variable exists in codebase!**

### Final Validation

```bash
# Check all links work
# Verify all examples are correct
# Test example .env files

# Update docs/README.md
code docs/README.md
# Change CONFIGURATION.md status to ✅ Complete
```

---

## Final Checklist

Before marking Phase 5.2 complete:

```bash
# 1. All tests pass
npm test
# ✅ Expected: 100% pass rate

# 2. Coverage meets targets
npm run test:coverage
# ✅ Expected: ≥60% overall, ≥60% store layer

# 3. No SQLite references
grep -r "memory\|better-sqlite3\|sqlite-vec" src/store/*.test.ts
# ✅ Expected: No results (except backups)

# 4. Documentation complete
ls docs/POSTGRESQL_SETUP.md docs/CONFIGURATION.md
# ✅ Expected: Both files exist

# 5. Commit all changes
git add .
git commit -m "feat: phase 5.2 complete - postgresql test migration and setup docs

- Migrated DocumentStore.test.ts to PostgreSQL
- Rewrote applyMigrations.test.ts for PostgreSQL
- Validated DocumentRetrieverService and CLI tests
- Created POSTGRESQL_SETUP.md with Docker and manual installation
- Created CONFIGURATION.md with complete environment variable reference
- Achieved 60%+ test coverage on store layer
- All tests passing with PostgreSQL

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# 6. Push to remote
git push origin phase-5.2-test-migration
```

---

## Troubleshooting

### Tests Failing: "Connection refused"

```bash
# Check Docker is running
docker ps

# Restart test database
docker-compose -f docker-compose.test.yml restart

# Verify connection
psql postgresql://postgres:postgres@localhost:5433/postgres -c "SELECT 1"
```

### Tests Failing: "pgvector extension not found"

```bash
# Check extension in Docker
docker-compose -f docker-compose.test.yml exec postgres psql -U postgres -c "SELECT * FROM pg_extension WHERE extname = 'vector';"

# If missing, recreate container
docker-compose -f docker-compose.test.yml down -v
docker-compose -f docker-compose.test.yml up -d
```

### Coverage Below 60%

```bash
# Generate HTML report
npm run test:coverage -- --reporter=html

# Open in browser
open coverage/index.html

# Identify uncovered critical paths
# Add targeted tests for those paths
```

### Timeline Slipping

**Refer to contingency plans in**:
- `/home/mp/Workspace/scrapegoat/projects/phase-5.2-testing-planning/risks/risk-assessment.md`

**Quick fixes**:
- Day 2 behind? Use simplified applyMigrations tests
- Day 3 behind? Skip DocumentRetrieverService enhancements
- Day 4 behind? Release docs as draft
- Coverage low? Prioritize critical paths only

---

## Getting Help

**Planning Documents**:
- Executive Summary: `/home/mp/Workspace/scrapegoat/projects/phase-5.2-testing-planning/EXECUTIVE_SUMMARY.md`
- Detailed Plan: `/home/mp/Workspace/scrapegoat/projects/phase-5.2-testing-planning/planning/implementation-plan.md`
- Risk Assessment: `/home/mp/Workspace/scrapegoat/projects/phase-5.2-testing-planning/risks/risk-assessment.md`
- Research: `/home/mp/Workspace/scrapegoat/projects/phase-5.2-testing-planning/research/test-migration-strategy.md`

**Key Resources**:
- Test utilities: `/home/mp/Workspace/scrapegoat/src/store/__tests__/testUtils.ts`
- Test config: `/home/mp/Workspace/scrapegoat/vitest.config.ts`
- Docker setup: `/home/mp/Workspace/scrapegoat/docker-compose.test.yml`

---

## Success! 🎉

When you complete Phase 5.2:
- ✅ All tests passing with PostgreSQL
- ✅ 60%+ coverage achieved
- ✅ Setup documentation complete
- ✅ Configuration reference complete
- ✅ Ready for Phase 5.3 (PostgreSQL-specific feature tests)

**Next**: Phase 5.3 - Feature Validation (PostgreSQL-specific tests, performance docs)

---

*Quick start guide prepared: 2025-11-08*
*For detailed instructions, see planning/implementation-plan.md*
