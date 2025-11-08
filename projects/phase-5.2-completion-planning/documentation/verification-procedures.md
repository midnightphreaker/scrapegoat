# Verification Procedures: Phase 5.2

## Overview

This document defines comprehensive verification procedures to ensure Phase 5.2 is completed successfully with high quality.

---

## Level 1: Unit Test Verification

Run after each major task completion.

### DocumentStore Tests

**Command**:
```bash
cd /home/mp/Workspace/scrapegoat
npm test -- DocumentStore.test.ts
```

**Success Criteria**:
- ✅ 24/24 tests passing (100%)
- ✅ No warnings or errors
- ✅ Execution time <30 seconds
- ✅ All search queries working
- ✅ Special characters handled
- ✅ Case-insensitive search working

**Verification Checklist**:
- [ ] All tests pass
- [ ] No skipped tests
- [ ] No test timeouts
- [ ] Search results are relevant
- [ ] FTS ranking working correctly

---

### Migration Tests

**Command**:
```bash
npm test -- applyMigrations.test.ts
```

**Success Criteria**:
- ✅ All tests passing (100%)
- ✅ Fresh database migration works
- ✅ Incremental migration works
- ✅ Version tracking accurate
- ✅ Error handling working
- ✅ Cleanup successful (no orphaned schemas)

**Verification Checklist**:
- [ ] All migration tests pass
- [ ] Test schemas cleaned up
- [ ] Migration version tracking correct
- [ ] Idempotency verified

**Cleanup Verification**:
```bash
psql -h postgres.den.lan -U postgres -d scrapegoat_test -c "
    SELECT nspname
    FROM pg_namespace
    WHERE nspname LIKE 'test_%'
    ORDER BY nspname;
"
```

**Expected**: No test schemas remaining

---

### Service Layer Tests

**Command**:
```bash
npm test -- DocumentRetrieverService.test.ts
```

**Success Criteria**:
- ✅ All tests passing (100%)
- ✅ Hybrid search working
- ✅ Vector search working
- ✅ FTS search working
- ✅ Filtering working
- ✅ Pagination working

**Verification Checklist**:
- [ ] All service tests pass
- [ ] Search results ranked correctly
- [ ] Hybrid scoring working
- [ ] Filters applied correctly

---

### CLI Tests

**Command**:
```bash
npm test -- --testPathPattern=commands
```

**Success Criteria**:
- ✅ All CLI tests passing (100%)
- ✅ All commands working
- ✅ Error handling working

**Verification Checklist**:
- [ ] add-library tests pass
- [ ] search tests pass
- [ ] list tests pass
- [ ] delete tests pass

---

## Level 2: Integration Testing

Run after completing major phases.

### Full Test Suite

**Command**:
```bash
cd /home/mp/Workspace/scrapegoat
npm test
```

**Success Criteria**:
- ✅ All tests passing
- ✅ No test failures
- ✅ No unexpected skipped tests
- ✅ Execution time acceptable (<2 minutes)

**Verification Checklist**:
- [ ] All test files pass
- [ ] No regressions introduced
- [ ] Tests run in reasonable time

**Output Analysis**:
```
Test Suites: X passed, X total
Tests:       X passed, X total
Snapshots:   X total
Time:        XX.XXXs
```

---

### Database Integration

**Objective**: Verify all database operations work correctly.

**Setup**:
```bash
export DATABASE_URL="postgresql://postgres:Mustiness-Grit7-Kindling@postgres.den.lan:5432/scrapegoat_test"
```

**Test Script**:
```sql
-- Connect to database
\c scrapegoat_test

-- 1. Verify tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Expected: documents, libraries, migrations, versions

-- 2. Verify indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY indexname;

-- Expected: All indexes from migrations

-- 3. Verify search_vector column
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'documents'
  AND column_name = 'search_vector';

-- Expected: search_vector | tsvector

-- 4. Verify embedding column
SELECT column_name, udt_name
FROM information_schema.columns
WHERE table_name = 'documents'
  AND column_name = 'embedding';

-- Expected: embedding | vector

-- 5. Test FTS functionality
INSERT INTO documents (title, content, library, version, url)
VALUES ('Test Doc', 'This is a test document about PostgreSQL', 'test', '1.0', 'http://test.com');

-- Verify search_vector populated
SELECT search_vector FROM documents WHERE title = 'Test Doc';

-- Test FTS search
SELECT * FROM documents
WHERE search_vector @@ plainto_tsquery('english', 'postgresql');

-- Should return the test document

-- 6. Test vector functionality
UPDATE documents SET embedding = ARRAY[0.1, 0.2, 0.3]::real[] WHERE title = 'Test Doc';

SELECT embedding FROM documents WHERE title = 'Test Doc';

-- Test vector search
SELECT embedding <-> ARRAY[0.1, 0.2, 0.3]::real[] AS distance
FROM documents
WHERE title = 'Test Doc';

-- Should return distance ~0

-- 7. Cleanup
DELETE FROM documents WHERE title = 'Test Doc';
```

**Verification Checklist**:
- [ ] All tables exist
- [ ] All indexes exist
- [ ] Triggers working
- [ ] FTS queries execute
- [ ] Vector queries execute
- [ ] Search results correct

---

### Manual Workflow Test

**Objective**: Test complete user workflow manually.

**Test Scenario**:
```bash
cd /home/mp/Workspace/scrapegoat

# 1. Add a library
npm run add-library -- test-lib v1.0 \
    --title "Test Library" \
    --content "This is test content for verification" \
    --url "https://example.com/test"

# Verify success
echo "Add library: $?"

# 2. List libraries
npm run list

# Verify output includes test-lib v1.0

# 3. Search with FTS
npm run search -- "test content"

# Verify results include test-lib

# 4. Search with vector (if implemented)
npm run search -- "verification" --use-vector

# Verify results returned

# 5. Hybrid search (if implemented)
npm run search -- "test" --use-hybrid

# Verify results ranked correctly

# 6. Delete library
npm run delete -- test-lib v1.0

# Verify success

# 7. Verify deletion
npm run list

# Verify test-lib not in list
```

**Verification Checklist**:
- [ ] Can add library successfully
- [ ] Library appears in list
- [ ] FTS search returns results
- [ ] Vector search works (if applicable)
- [ ] Hybrid search works (if applicable)
- [ ] Can delete library
- [ ] Deletion confirmed

---

## Level 3: Code Quality Verification

Run before final commit.

### Linting

**Command**:
```bash
cd /home/mp/Workspace/scrapegoat
npm run lint
```

**Success Criteria**:
- ✅ No linting errors
- ⚠️ Warnings are acceptable but should be minimized

**Verification Checklist**:
- [ ] No linting errors
- [ ] Warnings reviewed and justified
- [ ] Code style consistent

**If errors found**:
```bash
# Auto-fix where possible
npm run lint -- --fix

# Review remaining errors
npm run lint
```

---

### TypeScript Compilation

**Command**:
```bash
npm run build
```

**Success Criteria**:
- ✅ Build succeeds with no errors
- ⚠️ Warnings should be minimal

**Verification Checklist**:
- [ ] Build completes successfully
- [ ] No TypeScript errors
- [ ] Build artifacts generated
- [ ] No type safety issues

**Output Location**:
- Built files in `dist/` or `build/` directory

---

### Test Coverage

**Command**:
```bash
npm run test:coverage
```

**Success Criteria**:
- ✅ Overall coverage ≥60%
- ✅ Store layer coverage ≥70%
- ✅ Critical paths well covered

**Verification Checklist**:
- [ ] Overall coverage meets target
- [ ] Store layer coverage meets target
- [ ] No critical uncovered code
- [ ] Coverage report generated

**Report Analysis**:
```
Coverage summary:
Statements   : XX% ( XXX/XXX )
Branches     : XX% ( XXX/XXX )
Functions    : XX% ( XXX/XXX )
Lines        : XX% ( XXX/XXX )
```

**Critical Paths to Check**:
- DocumentStore methods (≥80%)
- Migration system (≥70%)
- Search functionality (≥80%)
- CLI commands (≥60%)

**View Detailed Report**:
```bash
# Open HTML report
open coverage/lcov-report/index.html

# Or view in terminal
cat coverage/coverage-summary.json | jq
```

---

## Level 4: Database State Verification

Run to ensure database is in correct state.

### Database Schema Verification

**Command**:
```bash
psql -h postgres.den.lan -U postgres -d scrapegoat_test
```

**Verification SQL**:
```sql
-- 1. Verify PostgreSQL version
SELECT version();
-- Expected: PostgreSQL 15.x or higher

-- 2. Verify database encoding
SHOW SERVER_ENCODING;
-- Expected: UTF8

-- 3. Verify pgvector extension
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
-- Expected: vector | 0.5.x

-- 4. Count tables
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
-- Expected: 4 (documents, libraries, versions, migrations)

-- 5. Verify indexes
SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';
-- Expected: Multiple indexes including FTS and vector indexes

-- 6. Verify triggers
SELECT tgname FROM pg_trigger
JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
WHERE nspname = 'public';
-- Expected: search_vector update trigger

-- 7. Verify text search configuration
SELECT cfgname FROM pg_ts_config WHERE cfgname = 'english';
-- Expected: english

-- 8. Check table sizes (should be small for test DB)
SELECT
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 9. Verify no orphaned test schemas
SELECT COUNT(*) FROM pg_namespace WHERE nspname LIKE 'test_%';
-- Expected: 0
```

**Verification Checklist**:
- [ ] PostgreSQL version correct
- [ ] Encoding is UTF8
- [ ] pgvector installed
- [ ] All tables exist
- [ ] All indexes exist
- [ ] Triggers exist and enabled
- [ ] Text search config available
- [ ] No orphaned test schemas

---

### Migration Version Verification

**SQL**:
```sql
\c scrapegoat_test

SELECT version, applied_at
FROM migrations
ORDER BY version;
```

**Verification**:
- [ ] All expected migrations present
- [ ] Versions sequential (1, 2, 3, ...)
- [ ] Applied dates make sense
- [ ] No gaps in version numbers

---

## Level 5: Documentation Verification

Run before marking Phase 5.2 complete.

### Documentation Completeness

**Files to Check**:
- [ ] `docs/POSTGRESQL_SETUP.md` exists
- [ ] `docs/CONFIGURATION.md` exists
- [ ] `README.md` updated
- [ ] `STATUS.md` updated
- [ ] `.env.example` has PostgreSQL example

**Content Verification**:

1. **POSTGRESQL_SETUP.md**:
   - [ ] Prerequisites section complete
   - [ ] Installation steps for Linux
   - [ ] Installation steps for macOS
   - [ ] Installation steps for Windows
   - [ ] Database creation steps
   - [ ] pgvector installation
   - [ ] Connection configuration
   - [ ] Migration execution
   - [ ] Troubleshooting section
   - [ ] Examples tested and working

2. **CONFIGURATION.md**:
   - [ ] All environment variables documented
   - [ ] DATABASE_URL format explained
   - [ ] Connection pool options
   - [ ] Vector search configuration
   - [ ] FTS configuration
   - [ ] Hybrid search parameters
   - [ ] Performance tuning guidance
   - [ ] Examples for dev/prod/test

3. **README.md**:
   - [ ] Links to new documentation
   - [ ] Quick start updated
   - [ ] PostgreSQL mentioned as requirement

---

### Documentation Testing

**Test Setup Guide**:
1. Have a colleague follow POSTGRESQL_SETUP.md
2. Note any confusion or errors
3. Update documentation accordingly

**Or self-test**:
```bash
# Start from scratch (fresh VM or container)
# Follow POSTGRESQL_SETUP.md step by step
# Note any issues or unclear steps
```

**Verification Checklist**:
- [ ] All commands execute successfully
- [ ] All examples work
- [ ] No missing steps
- [ ] Prerequisites clearly stated
- [ ] Troubleshooting helpful

---

### Link Verification

**Check all documentation links**:
```bash
cd /home/mp/Workspace/scrapegoat

# Find all markdown links
grep -r "\[.*\](.*)" docs/ README.md

# Check for broken links (manual review)
```

**Verification**:
- [ ] All internal links work
- [ ] All external links work
- [ ] No 404 errors
- [ ] Links to correct sections

---

## Level 6: Performance Verification

Run to establish baseline metrics.

### Test Execution Time

**Measure**:
```bash
cd /home/mp/Workspace/scrapegoat

# Time full test suite
time npm test

# Time DocumentStore tests
time npm test -- DocumentStore.test.ts

# Time migration tests
time npm test -- applyMigrations.test.ts
```

**Acceptable Ranges**:
- Full test suite: <2 minutes (target: <90 seconds)
- DocumentStore tests: <30 seconds (target: <20 seconds)
- Migration tests: <20 seconds (target: <15 seconds)

**Verification Checklist**:
- [ ] Full suite completes in acceptable time
- [ ] Individual test files complete quickly
- [ ] No tests timing out

**If too slow**:
- Enable parallel execution
- Optimize database connections
- Profile slow tests

---

### Query Performance

**Test FTS Query Performance**:
```sql
\c scrapegoat_test

-- Enable timing
\timing on

-- Test FTS query
EXPLAIN ANALYZE
SELECT *
FROM documents
WHERE search_vector @@ plainto_tsquery('english', 'test query')
ORDER BY ts_rank(search_vector, plainto_tsquery('english', 'test query')) DESC
LIMIT 10;

-- Should use GIN index
-- Execution time should be <100ms for reasonable data size
```

**Test Vector Query Performance**:
```sql
EXPLAIN ANALYZE
SELECT *
FROM documents
ORDER BY embedding <-> ARRAY[0.1, 0.2, 0.3]::real[]
LIMIT 10;

-- Should use vector index
-- Execution time depends on data size
```

**Verification Checklist**:
- [ ] FTS queries use GIN index
- [ ] Vector queries use vector index
- [ ] Query execution time acceptable
- [ ] No full table scans for indexed queries

---

## Level 7: Final Acceptance Testing

Run before marking Phase 5.2 complete.

### Complete Workflow Test

**Scenario**: Real-world usage simulation

```bash
cd /home/mp/Workspace/scrapegoat

# 1. Fresh database setup
psql -h postgres.den.lan -U postgres -d scrapegoat_test -c "TRUNCATE libraries CASCADE;"

# 2. Add multiple libraries
npm run add-library -- react v18 --docs-url https://react.dev
npm run add-library -- vue v3 --docs-url https://vuejs.org
npm run add-library -- angular v16 --docs-url https://angular.io

# Wait for processing
sleep 30

# 3. Test searches
npm run search -- "component"
npm run search -- "reactive"
npm run search -- "framework"

# 4. Test filtering
npm run search -- "component" --library react
npm run search -- "component" --version v18

# 5. Test listing
npm run list
npm run list --library react

# 6. Test deletion
npm run delete -- react v18

# 7. Verify deletion
npm run list
npm run search -- "react"

# 8. Cleanup
npm run delete -- vue v3
npm run delete -- angular v16
```

**Verification Checklist**:
- [ ] All commands execute without errors
- [ ] Search results are relevant
- [ ] Filtering works correctly
- [ ] Listing shows correct data
- [ ] Deletion works
- [ ] No data corruption

---

### Final Checklist

Before marking Phase 5.2 COMPLETE:

**Tests**:
- [ ] All unit tests passing (100%)
- [ ] Full test suite passing
- [ ] Test coverage ≥60%
- [ ] No skipped critical tests

**Database**:
- [ ] Test database operational
- [ ] pgvector extension working
- [ ] Migrations applied successfully
- [ ] No orphaned test schemas

**Code Quality**:
- [ ] No linting errors
- [ ] Clean TypeScript build
- [ ] Code reviewed (if applicable)

**Documentation**:
- [ ] POSTGRESQL_SETUP.md complete
- [ ] CONFIGURATION.md complete
- [ ] README.md updated
- [ ] STATUS.md updated
- [ ] All examples tested

**Performance**:
- [ ] Tests complete in acceptable time
- [ ] Queries use indexes correctly
- [ ] No performance regressions

**Integration**:
- [ ] Manual workflow test passed
- [ ] CLI commands working
- [ ] End-to-end functionality verified

**Git**:
- [ ] All changes committed
- [ ] Commit messages descriptive
- [ ] No sensitive data in commits
- [ ] Branch ready for review/merge

---

## Verification Report Template

Use this template to document verification results:

```markdown
# Phase 5.2 Verification Report

**Date**: [YYYY-MM-DD]
**Verified By**: [Name]

## Test Results

- DocumentStore Tests: [X]/24 passing ([X]%)
- Migration Tests: [X]/[X] passing ([X]%)
- Service Tests: [X]/[X] passing ([X]%)
- CLI Tests: [X]/[X] passing ([X]%)
- Full Suite: [X]/[X] passing ([X]%)

## Code Quality

- Linting: ✅ PASS / ❌ FAIL
- TypeScript Build: ✅ PASS / ❌ FAIL
- Test Coverage: [X]% (Target: ≥60%)

## Database

- Test Database: ✅ Operational / ❌ Issues
- pgvector: ✅ Working / ❌ Issues
- Migrations: ✅ Applied / ❌ Issues
- Schema Cleanup: ✅ Clean / ❌ Orphaned schemas

## Documentation

- POSTGRESQL_SETUP.md: ✅ Complete / ⚠️ Needs work
- CONFIGURATION.md: ✅ Complete / ⚠️ Needs work
- README.md: ✅ Updated / ⚠️ Needs update
- STATUS.md: ✅ Updated / ⚠️ Needs update

## Performance

- Full Test Suite: [X] seconds (Target: <120s)
- FTS Query Performance: ✅ Good / ⚠️ Acceptable / ❌ Poor
- Vector Query Performance: ✅ Good / ⚠️ Acceptable / ❌ Poor

## Manual Testing

- Workflow Test: ✅ PASS / ❌ FAIL
- CLI Commands: ✅ All Working / ⚠️ Some issues
- Integration: ✅ Working / ❌ Issues

## Issues Found

[List any issues discovered during verification]

1. Issue description
   - Severity: Critical / High / Medium / Low
   - Status: Fixed / Pending / Deferred

## Recommendations

[Any recommendations for improvement]

## Approval

Phase 5.2 is:
- [ ] ✅ APPROVED - Ready for completion
- [ ] ⚠️ APPROVED WITH CONDITIONS - [List conditions]
- [ ] ❌ NOT APPROVED - [List blockers]

---

**Signature**: [Name]
**Date**: [YYYY-MM-DD]
```

---

*Last Updated: 2025-11-08*
