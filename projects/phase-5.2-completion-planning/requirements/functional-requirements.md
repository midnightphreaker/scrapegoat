# Functional Requirements: Phase 5.2

## Primary Objective

Complete the PostgreSQL-based test suite and documentation to make the Scrapegoat project production-ready.

## Core Requirements

### FR-1: DocumentStore Test Suite
**Priority**: CRITICAL
**Description**: All DocumentStore.test.ts tests must pass (24/24 = 100%)

**Specific Requirements**:
- FR-1.1: Full-text search queries must use PostgreSQL FTS syntax
- FR-1.2: Search queries must handle special characters correctly
- FR-1.3: Case-insensitive search must work for library/version names
- FR-1.4: Search ranking must use PostgreSQL ts_rank() function
- FR-1.5: All existing test scenarios must pass without modification to test expectations

**Acceptance Criteria**:
- `npm test -- DocumentStore.test.ts` shows 24/24 passing
- No test timeouts or database connection errors
- Tests run in reasonable time (<30 seconds total)

### FR-2: Test Database Infrastructure
**Priority**: HIGH
**Description**: Dedicated PostgreSQL test database on postgres.den.lan

**Specific Requirements**:
- FR-2.1: Database named `scrapegoat_test` created
- FR-2.2: pgvector extension installed and functional
- FR-2.3: Test user with appropriate permissions (optional)
- FR-2.4: Connection configuration documented and working
- FR-2.5: Migration system applies all migrations successfully

**Acceptance Criteria**:
- Can connect to database from project
- Migrations run without errors
- Vector search queries execute successfully
- FTS queries execute successfully

### FR-3: Migration Test Suite
**Priority**: HIGH
**Description**: applyMigrations.test.ts rewritten for PostgreSQL

**Specific Requirements**:
- FR-3.1: Tests use schema-based isolation (not :memory:)
- FR-3.2: Test fresh database migration (all migrations)
- FR-3.3: Test incremental migration (applying only new ones)
- FR-3.4: Test migration version tracking
- FR-3.5: Test error handling scenarios
- FR-3.6: Proper cleanup after each test

**Acceptance Criteria**:
- All migration tests pass
- No test pollution (tests don't affect each other)
- Test schemas are cleaned up properly

### FR-4: Service Layer Validation
**Priority**: MEDIUM
**Description**: DocumentRetrieverService.test.ts validated for PostgreSQL

**Specific Requirements**:
- FR-4.1: Hybrid search combining vector + FTS works correctly
- FR-4.2: Vector similarity search uses pgvector operators
- FR-4.3: Result ranking combines both search types properly
- FR-4.4: Filtering by library/version works
- FR-4.5: Pagination works correctly

**Acceptance Criteria**:
- All DocumentRetrieverService tests pass
- Hybrid search returns relevant results
- Search performance is acceptable

### FR-5: CLI Command Tests
**Priority**: MEDIUM
**Description**: All CLI command tests pass with PostgreSQL backend

**Specific Requirements**:
- FR-5.1: add-library command tests pass
- FR-5.2: search command tests pass
- FR-5.3: list command tests pass
- FR-5.4: delete command tests pass

**Acceptance Criteria**:
- `npm test` shows all CLI tests passing
- CLI commands work with PostgreSQL backend

### FR-6: PostgreSQL Setup Documentation
**Priority**: MEDIUM
**Description**: Complete setup guide for PostgreSQL configuration

**Specific Requirements**:
- FR-6.1: Prerequisites clearly listed
- FR-6.2: Installation steps for common platforms
- FR-6.3: Database creation and configuration
- FR-6.4: pgvector extension installation
- FR-6.5: Connection configuration examples
- FR-6.6: Migration execution instructions
- FR-6.7: Troubleshooting section

**Acceptance Criteria**:
- docs/POSTGRESQL_SETUP.md exists and is complete
- Setup steps work on fresh PostgreSQL installation
- Common errors are documented with solutions

### FR-7: Configuration Documentation
**Priority**: MEDIUM
**Description**: Complete reference for all configuration options

**Specific Requirements**:
- FR-7.1: Environment variables documented
- FR-7.2: Database connection options explained
- FR-7.3: Vector search configuration documented
- FR-7.4: FTS configuration documented
- FR-7.5: Hybrid search parameters explained
- FR-7.6: Performance tuning guidance
- FR-7.7: Development vs production configurations

**Acceptance Criteria**:
- docs/CONFIGURATION.md exists and is complete
- All configuration options are documented
- Examples are provided for common scenarios

### FR-8: Test Coverage
**Priority**: MEDIUM
**Description**: Maintain or improve test coverage

**Specific Requirements**:
- FR-8.1: Overall test coverage ≥60%
- FR-8.2: Store layer coverage ≥70%
- FR-8.3: Critical paths have ≥80% coverage

**Acceptance Criteria**:
- `npm run test:coverage` shows ≥60% overall
- No decrease in coverage from previous phase

### FR-9: Status Documentation Update
**Priority**: LOW
**Description**: Update STATUS.md with Phase 5.2 completion

**Specific Requirements**:
- FR-9.1: Record completion date
- FR-9.2: Update test passing metrics
- FR-9.3: Update phase status to "Complete"
- FR-9.4: Document any known issues or limitations
- FR-9.5: Link to new documentation

**Acceptance Criteria**:
- STATUS.md reflects Phase 5.2 completion
- Metrics are accurate and current

## Non-Functional Requirements

### NFR-1: Performance
- Tests should complete in reasonable time (<2 minutes total)
- Database queries should be optimized with proper indexes
- Connection pooling should be used for test efficiency

### NFR-2: Maintainability
- Code should be well-documented with comments
- Test helpers should be reusable
- Database schema changes should use migrations

### NFR-3: Compatibility
- Support PostgreSQL 15+
- Support pgvector 0.5.0+
- Support Node.js 18+

### NFR-4: Safety
- Tests must not affect production data
- Test database must be isolated
- No destructive operations without confirmation

---

*Last Updated: 2025-11-08*
