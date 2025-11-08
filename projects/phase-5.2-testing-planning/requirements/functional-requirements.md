# Functional Requirements: Phase 5.2

## Overview

Phase 5.2 must migrate all existing test suites from SQLite to PostgreSQL while maintaining 100% test coverage and validating PostgreSQL-specific features.

## Test Migration Requirements

### FR-1: DocumentStore.test.ts Migration

**Priority**: CRITICAL
**Complexity**: Medium

**Current State**:
- 835 lines of test code
- Uses `:memory:` SQLite database (line 79, 525, 630)
- 3 main describe blocks:
  1. "With Embeddings" - Tests hybrid search
  2. "Without Embeddings (FTS-only)" - Tests fallback mode
  3. "Common Functionality" - Core database operations
- Mocked embedding service for deterministic tests

**Required Changes**:
1. Replace all `:memory:` references with `createTestDatabase()`
2. Add proper cleanup in afterEach with `testDb.cleanup()`
3. Update beforeEach to use PostgreSQL test database
4. Remove any SQLite-specific code (if any)
5. Validate all 30+ test cases pass with PostgreSQL

**Acceptance Criteria**:
- [ ] All existing tests pass without modification to test logic
- [ ] Uses createTestDatabase() from testUtils
- [ ] Proper cleanup in all test suites
- [ ] No SQLite references remain
- [ ] Test execution time < 60 seconds per suite
- [ ] 100% of original test cases passing

---

### FR-2: applyMigrations.test.ts Complete Rewrite

**Priority**: CRITICAL
**Complexity**: High

**Current State**:
- 654 lines of SQLite-specific test code
- Imports: `better-sqlite3`, `sqlite-vec` (lines 3-4)
- Tests: SQLite PRAGMA, sqlite_master table, sqlite-vec virtual tables
- 3 main test cases covering migrations, vector search, FTS

**Required Changes**:
1. **Complete rewrite** - No salvageable SQLite code
2. Remove all SQLite dependencies (better-sqlite3, sqlite-vec)
3. Test PostgreSQL-specific migrations:
   - pgvector extension creation
   - HNSW index creation (m=16, ef_construction=64)
   - GIN index creation for FTS
   - Proper foreign key constraints
4. Test PostgreSQL-specific features:
   - Vector search with pgvector operators
   - Full-text search with GIN index
   - Hybrid search combining both
5. Verify migration idempotency

**Acceptance Criteria**:
- [ ] No SQLite dependencies (better-sqlite3, sqlite-vec)
- [ ] Tests pgvector extension installation
- [ ] Tests HNSW index creation and parameters
- [ ] Tests GIN index creation
- [ ] Tests vector search functionality
- [ ] Tests full-text search functionality
- [ ] Tests migration idempotency (can run twice safely)
- [ ] All 7 migrations apply successfully
- [ ] Test execution time < 45 seconds

---

### FR-3: DocumentRetrieverService.test.ts Validation

**Priority**: HIGH
**Complexity**: Low

**Current State**:
- 780 lines of test code
- Already mocks DocumentStore (doesn't touch database directly)
- Tests context retrieval, hierarchical reassembly, MIME type handling
- Tests hybrid search logic at service layer

**Required Changes**:
1. Review tests to ensure they validate PostgreSQL hybrid search
2. Add explicit tests for RRF (Reciprocal Rank Fusion) scoring
3. Validate vec_rank and fts_rank metadata handling
4. Ensure tests cover PostgreSQL-specific search behavior

**Acceptance Criteria**:
- [ ] All existing tests pass without modification
- [ ] Tests validate RRF scoring logic
- [ ] Tests validate vec_rank and fts_rank metadata
- [ ] Tests validate hybrid search result ordering
- [ ] Test execution time < 30 seconds

---

### FR-4: CLI Command Tests Verification

**Priority**: MEDIUM
**Complexity**: Low

**Current State**:
- 6 CLI command test files
- Mock DocumentStore and service dependencies
- Test command parsing and execution
- Minimal database interaction

**Test Files**:
1. search.test.ts (35 lines)
2. list.test.ts
3. fetchUrl.test.ts
4. findVersion.test.ts
5. scrape.test.ts
6. remove.test.ts

**Required Changes**:
1. Review each test file for SQLite-specific code
2. Update any database path references to connection strings
3. Ensure mocks use PostgreSQL connection strings
4. Verify all tests pass with PostgreSQL backend

**Acceptance Criteria**:
- [ ] All 6 CLI test files pass
- [ ] No SQLite database path references
- [ ] Mocks use PostgreSQL connection string format
- [ ] Test execution time < 20 seconds total

---

## Documentation Requirements

### FR-5: POSTGRESQL_SETUP.md Creation

**Priority**: HIGH
**Complexity**: Medium

**Purpose**: Enable developers and users to install and configure PostgreSQL with pgvector extension.

**Required Sections**:
1. **Prerequisites**
   - PostgreSQL 14+ requirement
   - pgvector extension requirement
   - Operating system compatibility
2. **Docker Installation (Quick Start)**
   - docker-compose.yml example
   - Single command setup
   - Verification steps
3. **Manual Installation**
   - Ubuntu/Debian installation
   - macOS installation (Homebrew)
   - Windows installation
   - pgvector extension compilation/installation
4. **Database Initialization**
   - Creating scrapegoat database
   - Creating database user
   - Granting permissions
   - Enabling pgvector extension
5. **Verification**
   - Connection test
   - Extension verification
   - Basic query test
6. **Configuration**
   - DATABASE_URL format
   - Connection parameters
   - SSL configuration
7. **Troubleshooting**
   - Common installation issues
   - Permission problems
   - Extension not found errors

**Acceptance Criteria**:
- [ ] Complete Docker setup in < 5 steps
- [ ] Manual installation for 3+ platforms
- [ ] Verification steps included
- [ ] Troubleshooting section covers 5+ common issues
- [ ] Cross-references CONFIGURATION.md
- [ ] Includes example connection strings

---

### FR-6: CONFIGURATION.md Creation

**Priority**: HIGH
**Complexity**: Medium

**Purpose**: Comprehensive reference for all environment variables and configuration options.

**Required Sections**:
1. **Database Configuration**
   - DATABASE_URL (required)
   - Connection string format
   - Connection pool settings
   - SSL/TLS options
2. **Embedding Configuration**
   - DOCS_MCP_EMBEDDING_MODEL
   - Provider-specific variables (OpenAI, Vertex, Gemini, AWS, Azure)
   - Batch size configuration
   - EMBEDDING_BATCH_CHARS
   - EMBEDDING_BATCH_SIZE
3. **Search Configuration**
   - SEARCH_WEIGHT_VEC
   - SEARCH_WEIGHT_FTS
   - VECTOR_SEARCH_MULTIPLIER
   - SEARCH_OVERFETCH_FACTOR
4. **Performance Tuning**
   - MAX_CONCURRENCY
   - Connection pool size
   - Query timeouts
5. **Analytics/Telemetry**
   - POSTHOG_API_KEY
   - Telemetry enable/disable
6. **Development/Testing**
   - TEST_DATABASE_URL
   - NODE_ENV settings
   - Debug logging
7. **Migration from SQLite**
   - Deprecated DOCS_MCP_STORE_PATH
   - Migration path explanation

**Acceptance Criteria**:
- [ ] Documents all environment variables
- [ ] Includes default values
- [ ] Includes example values
- [ ] Describes purpose and format for each variable
- [ ] Includes performance tuning guidance
- [ ] Links to POSTGRESQL_SETUP.md where relevant
- [ ] Migration guide from SQLite configuration

---

## Test Coverage Requirements

### FR-7: Coverage Thresholds

**Priority**: HIGH
**Complexity**: N/A

**Coverage Targets**:
- Overall: 60% minimum
- Store layer (DocumentStore.ts): 70% minimum
- Critical paths: 80% minimum

**Required Coverage**:
1. **DocumentStore.ts**
   - All 22 CRUD methods covered
   - Hybrid search paths covered
   - Error handling covered
   - Connection management covered
2. **applyMigrations.ts**
   - All 7 migrations covered
   - Error scenarios covered
   - Rollback scenarios covered
3. **DocumentRetrieverService.ts**
   - Context retrieval covered
   - Hierarchical reassembly covered
   - Assembly strategy selection covered

**Acceptance Criteria**:
- [ ] vitest coverage report shows ≥60% overall
- [ ] Store layer shows ≥60% coverage
- [ ] No critical paths uncovered
- [ ] Coverage report generated in CI-ready format

---

## Integration Requirements

### FR-8: Test Infrastructure Integration

**Priority**: MEDIUM
**Complexity**: Low

**Requirements**:
1. All tests use docker-compose.test.yml for local testing
2. Tests support TEST_DATABASE_URL for CI/remote testing
3. Tests clean up after themselves (no database pollution)
4. Tests can run in parallel safely
5. Tests have proper timeouts (30s default)

**Acceptance Criteria**:
- [ ] Tests work with local Docker database
- [ ] Tests work with remote PostgreSQL server
- [ ] Tests can run in parallel without conflicts
- [ ] No test leaves data behind
- [ ] All tests respect 30s timeout

---

## Non-Functional Requirements

### NFR-1: Test Performance

- Single test file execution: < 60 seconds
- Full test suite execution: < 5 minutes
- Test database creation: < 2 seconds
- Test database cleanup: < 1 second

### NFR-2: Test Reliability

- Tests must be deterministic (no flaky tests)
- Tests must be idempotent (can run multiple times)
- Tests must be isolated (no cross-test dependencies)
- Tests must clean up on failure

### NFR-3: Documentation Quality

- All documentation must be accurate and tested
- All code examples must be copy-pasteable
- All commands must work as written
- All troubleshooting steps must be verified

---

*Last Updated: 2025-11-08*
