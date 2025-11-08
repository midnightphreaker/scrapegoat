# Phase C: applyMigrations.test.ts PostgreSQL Rewrite

## Overview

Phase C completes the PostgreSQL migration of the Scrapegoat project by rewriting the migration test file (`applyMigrations.test.ts`) from SQLite to PostgreSQL with pgvector.

**Status**: 📋 Planning Complete - Ready for Implementation

---

## Project Context

### What is Scrapegoat?
PostgreSQL fork of the docs-mcp-server project, migrating from SQLite to PostgreSQL with pgvector for vector search capabilities.

### Previous Phases
- ✅ **Phase A**: Fixed PostgreSQL FTS - 24/24 DocumentStore tests passing
- ✅ **Phase B**: Created scrapegoat_test database on postgres.den.lan with pgvector
- 🎯 **Phase C**: Rewrite applyMigrations.test.ts (current phase)

---

## Planning Documents

This directory contains comprehensive planning documents for Phase C:

### 1. 📘 Main Implementation Plan
**File**: `phase-c-migrations-test-rewrite-plan.md` (26 KB)

Complete, detailed implementation plan including:
- Current test analysis (654 lines, 4 test suites)
- SQLite to PostgreSQL mapping table
- Schema-based isolation strategy
- Test-by-test rewrite plans with full code
- Implementation steps (15 steps)
- Code examples for all scenarios
- Verification plan (6 checks)
- Troubleshooting guide (10 common issues)

**Start here** for comprehensive understanding.

---

### 2. ⚡ Quick Reference Guide
**File**: `phase-c-quick-reference.md` (7 KB)

Fast lookup reference including:
- Critical differences cheatsheet
- Quick syntax mapping table
- Common query patterns
- Configuration snippets
- Assertion changes

**Use this** while coding for quick answers.

---

### 3. 🔄 Side-by-Side Comparison
**File**: `phase-c-side-by-side-comparison.md` (9 KB)

Before/after code comparison showing:
- Setup & teardown changes
- Test 1: Schema validation
- Test 2: Empty vector search
- Test 3: Vector similarity search
- Test 4: Full-text search
- Metadata field search
- Distance/rank assertions

**Use this** to see exactly what changes in each test.

---

### 4. ✅ Implementation Checklist
**File**: `phase-c-implementation-checklist.md` (8 KB)

Step-by-step execution guide with checkboxes:
- Pre-implementation verification
- 15 implementation steps
- Code quality verification
- Testing procedures
- Troubleshooting section
- Completion criteria

**Use this** as your execution roadmap.

---

## Quick Start

### For Implementation:
1. Read **Main Implementation Plan** (15 min)
2. Follow **Implementation Checklist** step-by-step (2-3 hours)
3. Reference **Quick Reference** while coding
4. Use **Side-by-Side Comparison** when rewriting tests

### For Quick Understanding:
1. Read **Quick Reference** (5 min)
2. Skim **Side-by-Side Comparison** (10 min)
3. Reference **Main Implementation Plan** for details as needed

---

## Critical Information

### ⚠️ MOST IMPORTANT: FTS Ranking Semantics

```typescript
// SQLite BM25: Lower score = better match
ORDER BY rank ASC  // SQLite

// PostgreSQL ts_rank: Higher score = better match (OPPOSITE!)
ORDER BY rank DESC  // PostgreSQL
```

**All FTS ranking assertions must be inverted!**

### Architecture Changes

**SQLite Structure:**
```
documents          (main table)
documents_fts      (FTS5 virtual table)
documents_vec      (vec0 virtual table)
```

**PostgreSQL Structure:**
```
documents          (single table with embedding column)
├── GIN index:  idx_documents_content_fts (for FTS)
└── HNSW index: idx_documents_embedding_hnsw (for vectors)
```

**No separate virtual tables in PostgreSQL!**

---

## Key Metrics

### Test File Stats
- **Current size**: 654 lines
- **Test count**: 4 test suites
- **Coverage**: Migration execution, schema validation, vector search, FTS

### Expected Changes
- **Lines changed**: ~500 (76%)
- **SQLite dependencies removed**: 100%
- **New PostgreSQL features**: Schema isolation, GIN/HNSW indexes, ts_rank
- **Estimated time**: 2-3 hours

### Success Criteria
- ✅ All 4 tests pass
- ✅ No SQLite dependencies remain
- ✅ Schema isolation works (tests can run in parallel)
- ✅ No regressions in other tests

---

## Technology Stack

### Removed Dependencies
- ❌ `better-sqlite3` - SQLite database driver
- ❌ `sqlite-vec` - SQLite vector extension

### Added Dependencies
- ✅ `pg` (node-postgres) - PostgreSQL client
- ✅ `pgvector` extension - Vector similarity search

### Test Infrastructure
- Schema-based isolation (one schema per test)
- scrapegoat_test database on postgres.den.lan
- Pool-based connection management

---

## Implementation Strategy

### 1. Schema Isolation
Each test runs in an isolated PostgreSQL schema:
```typescript
test_1699564234_abc123  // Created before test
test_1699564235_def456  // Created before test
// Dropped after test cleanup
```

Benefits:
- ✅ Fast (10-100x faster than separate databases)
- ✅ Isolated (no test interference)
- ✅ Parallel-safe
- ✅ Easy cleanup (DROP SCHEMA CASCADE)

### 2. Migration Testing
Tests verify:
- ✅ Migrations execute without errors
- ✅ Tables created with correct schema
- ✅ Columns have correct types (vector(1536))
- ✅ Indexes created (GIN for FTS, HNSW for vectors)
- ✅ Extensions installed (pgvector)

### 3. Vector Search Testing
Tests verify:
- ✅ Empty search returns gracefully
- ✅ Similar vectors have lower distance (cosine)
- ✅ Identical vectors have distance ≈ 0
- ✅ Distance calculations are correct

### 4. Full-Text Search Testing
Tests verify:
- ✅ Basic word search works
- ✅ Phrase matching works
- ✅ Metadata field search works
- ✅ Ranking orders results correctly (higher = better)

---

## Key Syntax Changes

### Table Inspection
```typescript
// SQLite
PRAGMA table_info(documents)
SELECT name FROM sqlite_master WHERE type='table'

// PostgreSQL
SELECT column_name FROM information_schema.columns WHERE table_name = $1
SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()
```

### Vector Search
```typescript
// SQLite
SELECT dv.rowid, d.content, dv.distance
FROM documents_vec dv
JOIN documents d ON dv.rowid = d.id
WHERE dv.embedding MATCH ? AND k = 5

// PostgreSQL
SELECT d.id, d.content, d.embedding <=> $1::vector AS distance
FROM documents d
WHERE d.embedding IS NOT NULL
ORDER BY d.embedding <=> $1::vector
LIMIT 5
```

### Full-Text Search
```typescript
// SQLite
SELECT d.*, fts.rank
FROM documents_fts fts
JOIN documents d ON fts.rowid = d.id
WHERE documents_fts MATCH ?
ORDER BY fts.rank ASC

// PostgreSQL
SELECT d.*, ts_rank(to_tsvector('english', d.content), plainto_tsquery('english', $1)) as rank
FROM documents d
WHERE to_tsvector('english', d.content) @@ plainto_tsquery('english', $1)
ORDER BY rank DESC  -- OPPOSITE direction!
```

---

## File Locations

### Test File (to modify)
```
/home/mp/Workspace/scrapegoat/src/store/applyMigrations.test.ts
```

### Migration Files (PostgreSQL-compatible)
```
/home/mp/Workspace/scrapegoat/db/migrations/
├── 001-initial-schema.sql       (pgvector extension, base tables)
├── 002-gin-indexes.sql          (FTS indexes)
├── 003-hnsw-indexes.sql         (Vector indexes)
└── 010-add-indexed-at-column.sql
```

### Test Database
```
postgresql://postgres:postgres@postgres.den.lan/scrapegoat_test
```

---

## Verification Commands

### Run Tests
```bash
cd /home/mp/Workspace/scrapegoat
npm test src/store/applyMigrations.test.ts
```

### Check for SQLite Remnants
```bash
grep -r "better-sqlite3\|sqlite-vec\|PRAGMA\|sqlite_master" src/store/applyMigrations.test.ts
# Expected: no results
```

### Verify Schema Cleanup
```sql
-- Connect to test database
psql -h postgres.den.lan -U postgres -d scrapegoat_test

-- Check for leftover schemas
SELECT schema_name FROM information_schema.schemata
WHERE schema_name LIKE 'test_%';

-- Expected: 0 rows
```

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

## Common Pitfalls

### 1. FTS Ranking Direction ⚠️
**Problem**: Best matches appearing last
**Cause**: Using `ORDER BY rank ASC` (SQLite semantics)
**Fix**: Use `ORDER BY rank DESC` (PostgreSQL semantics)

### 2. Virtual Tables
**Problem**: Tests fail looking for documents_fts/documents_vec
**Cause**: SQLite uses virtual tables, PostgreSQL doesn't
**Fix**: Check indexes instead of tables

### 3. Vector Operator
**Problem**: Vector search syntax error
**Cause**: Using SQLite `MATCH` syntax
**Fix**: Use PostgreSQL `<=>` operator

### 4. Phrase Search
**Problem**: Phrase search not working
**Cause**: Using `plainto_tsquery()` for phrases
**Fix**: Use `phraseto_tsquery()` for exact phrases

### 5. Schema Isolation
**Problem**: Tests see data from other tests
**Cause**: search_path not set correctly
**Fix**: Verify pool options: `-c search_path=${schemaName},public`

---

## Next Steps

### After Phase C Completion:
1. Update project status document
2. Mark applyMigrations.test.ts as PostgreSQL-complete
3. Verify all store tests pass (integration)
4. Begin Phase D (if applicable)

### Future Phases:
- Phase D: Service layer tests (if needed)
- Phase E: Integration tests (if needed)
- Phase F: Performance benchmarking
- Phase G: Production deployment

---

## Resources

### Planning Documents (this directory)
- `phase-c-migrations-test-rewrite-plan.md` - Main plan
- `phase-c-quick-reference.md` - Quick lookup
- `phase-c-side-by-side-comparison.md` - Before/after code
- `phase-c-implementation-checklist.md` - Step-by-step guide

### Project Documentation
- `/home/mp/Workspace/scrapegoat/README.md` - Project overview
- `/home/mp/Workspace/scrapegoat/docs/` - Architecture docs

### External Resources
- [PostgreSQL Full-Text Search](https://www.postgresql.org/docs/current/textsearch.html)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [node-postgres (pg) Docs](https://node-postgres.com/)

---

## Contact & Support

### Issues Encountered?
1. Check troubleshooting section in implementation plan
2. Review side-by-side comparison for syntax
3. Verify test database connectivity
4. Check PostgreSQL logs for errors

### Questions?
- Refer to main implementation plan (comprehensive)
- Check quick reference (fast answers)
- Review side-by-side comparison (code examples)

---

## Summary

Phase C provides a complete, ready-to-execute plan for migrating applyMigrations.test.ts from SQLite to PostgreSQL. The planning documents cover:

✅ **What to change** - Every line that needs updating
✅ **How to change it** - Exact PostgreSQL equivalents
✅ **Why to change it** - Reasoning and context
✅ **How to verify** - Testing and validation steps

The rewrite maintains 100% test coverage while fully migrating to PostgreSQL with no SQLite dependencies.

---

**Phase C Status**: 📋 Planning Complete - Ready for Implementation

**Generated**: 2025-11-08
**Location**: `/home/mp/Workspace/scrapegoat/projects/`
