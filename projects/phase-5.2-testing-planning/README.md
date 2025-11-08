# Phase 5.2 Planning: Critical Path Tests & Setup Documentation

**Project**: Scrapegoat - PostgreSQL fork of scrapegoat
**Phase**: 5.2 - Testing Migration & Documentation
**Timeline**: Days 3-5 of Phase 5 (Target: 2025-11-13)
**Status**: Planning Complete - Ready for Implementation

## Quick Navigation

- [Project Vision](#project-vision)
- [Requirements](./requirements/)
- [Research](./research/)
- [Architecture](./architecture/)
- [Planning](./planning/)
- [Risks](./risks/)
- [Documentation](./documentation/)

## Project Vision

Migrate all existing test suites from SQLite to PostgreSQL, ensuring 100% compatibility while validating PostgreSQL-specific features (pgvector, HNSW indexes, GIN FTS, hybrid search). Create comprehensive setup and configuration documentation to enable developers and users to work with the PostgreSQL-based system.

## Success Criteria

- [ ] DocumentStore.test.ts: 100% of existing tests passing with PostgreSQL
- [ ] applyMigrations.test.ts: Rewritten and passing (no SQLite dependencies)
- [ ] DocumentRetrieverService.test.ts: Hybrid search validated
- [ ] CLI tests: All passing with PostgreSQL
- [ ] Test coverage: ≥60% on store layer
- [ ] POSTGRESQL_SETUP.md: Complete setup guide
- [ ] CONFIGURATION.md: All environment variables documented

## Phase Overview

**Current State**:
- Phase 5.1 complete: Test infrastructure ready (testUtils.ts, docker-compose.test.yml, vitest.config.ts)
- Existing tests use SQLite (`:memory:`, better-sqlite3, sqlite-vec)
- Build passing: 354.42 kB web, 526.80 kB SSR
- Migration documentation complete

**Phase 5.2 Goals**:
1. Update DocumentStore.test.ts (835 lines) for PostgreSQL
2. Rewrite applyMigrations.test.ts (654 lines) for PostgreSQL
3. Validate DocumentRetrieverService.test.ts (780 lines) with hybrid search
4. Verify CLI tests work with PostgreSQL
5. Create POSTGRESQL_SETUP.md with Docker and manual instructions
6. Create CONFIGURATION.md with environment variable reference

## Key Deliverables

### Test Updates
1. **DocumentStore.test.ts** - Replace `:memory:` with PostgreSQL test DB
2. **applyMigrations.test.ts** - Complete rewrite (remove SQLite dependencies)
3. **DocumentRetrieverService.test.ts** - Validate hybrid search
4. **CLI Tests** - Verify PostgreSQL compatibility

### Documentation
5. **POSTGRESQL_SETUP.md** - Database setup guide
6. **CONFIGURATION.md** - Environment variable reference

## Timeline

| Day | Focus | Deliverables |
|-----|-------|--------------|
| 1 | DocumentStore.test.ts update | PostgreSQL test migration complete |
| 2 | applyMigrations.test.ts rewrite | Migration tests passing |
| 3 | DocumentRetrieverService + CLI | Hybrid search validated, CLI tests verified |
| 4 | Documentation | POSTGRESQL_SETUP.md complete |
| 5 | Documentation + Coverage | CONFIGURATION.md complete, 60%+ coverage |

## Resources Available

**PostgreSQL Server** (remote):
- SSH: root@postgres.den.lan (password: P@ssw0rd)
- DB Admin: postgres / Mustiness-Grit7-Kindling
- Can create new test databases
- **CRITICAL**: Do NOT touch openmemory tables/databases

**Local Test Infrastructure**:
- docker-compose.test.yml - Local PostgreSQL 16 + pgvector (port 5433)
- testUtils.ts - PostgreSQL test helpers (createTestDatabase, resetTestDatabase)
- vitest.config.ts - Test configuration with 30s timeouts
- .env.test - Test environment configuration

**Existing Test Patterns**:
- DocumentStore tests: 835 lines, 3 describe blocks, mocked embeddings
- applyMigrations tests: 654 lines, SQLite-specific, needs complete rewrite
- DocumentRetrieverService tests: 780 lines, mocked DocumentStore
- CLI tests: 6 files, mocked dependencies

## Technical Context

**Database Schema**:
```
libraries → versions → pages → documents
```

**PostgreSQL Extensions**:
- pgvector (vector storage and similarity)
- HNSW index (m=16, ef_construction=64)
- GIN index (full-text search)

**Hybrid Search Architecture**:
- Vector search: pgvector with cosine similarity
- Full-text search: PostgreSQL GIN index
- Reciprocal Rank Fusion (RRF) merging (k=60)

**Connection String Format**:
```
postgresql://username:password@hostname:port/database
```

## Next Steps

1. Review detailed planning documents in subdirectories
2. Set up local test database: `docker-compose -f docker-compose.test.yml up -d`
3. Verify test database connection: `psql postgresql://postgres:postgres@localhost:5433/postgres`
4. Begin implementation starting with DocumentStore.test.ts

---

*Planning completed: 2025-11-08*
*Ready for implementation*
