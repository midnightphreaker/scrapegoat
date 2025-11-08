# Task Breakdown: Phase 5.2

## Task Summary

| Phase | Tasks | Est. Time | Priority | Dependencies |
|-------|-------|-----------|----------|--------------|
| A: FTS Fixes | 6 | 4-6 hours | CRITICAL | None |
| B: Test DB Setup | 8 | 1.5 hours | HIGH | None |
| C: Migration Tests | 6 | 3.5-4.5 hours | MEDIUM-HIGH | B |
| D: Service Validation | 7 | 2.5-3.5 hours | MEDIUM | A |
| E: CLI Verification | 5 | 0.5-3 hours | MEDIUM | A, D |
| F: Documentation | 5 | 4-6 hours | MEDIUM | None |
| G: Finalization | 6 | 1-2 hours | LOW | All |
| **TOTAL** | **43** | **16-25 hours** | | |

---

## Phase A: Fix FTS Implementation

### A1: Analyze Current Implementation
**Time**: 30 minutes
**Priority**: CRITICAL
**Dependencies**: None

**Actions**:
- Read DocumentStore.ts implementation
- Run failing tests to capture errors
- Document current FTS usage patterns
- Identify all locations needing updates

**Files**:
- `/home/mp/Workspace/scrapegoat/src/store/DocumentStore.ts`
- `/home/mp/Workspace/scrapegoat/src/store/DocumentStore.test.ts`

**Commands**:
```bash
cd /home/mp/Workspace/scrapegoat
npm test -- DocumentStore.test.ts --verbose 2>&1 | tee test-errors.log
grep -n "MATCH\|search\|query" src/store/DocumentStore.ts
```

**Deliverable**: Understanding of implementation and failure points

---

### A2: Design FTS Query Builder
**Time**: 30 minutes
**Priority**: CRITICAL
**Dependencies**: A1

**Actions**:
- Design PostgreSQL FTS query pattern
- Choose query function (plainto_tsquery vs to_tsquery)
- Design ranking strategy
- Plan edge case handling

**Reference**: See `research/postgresql-fts-research.md`

**Deliverable**: Clear implementation approach documented

---

### A3: Implement FTS Query Methods
**Time**: 2-3 hours
**Priority**: CRITICAL
**Dependencies**: A2

**Actions**:
- Update searchDocuments() method
- Replace MATCH with @@ operator
- Implement plainto_tsquery() usage
- Add ts_rank() for ranking
- Update hybrid search (if exists)
- Handle parameter placeholders (? → $1, $2)

**Files Modified**:
- `src/store/DocumentStore.ts`

**Example Change**:
```typescript
// BEFORE:
WHERE content MATCH ?

// AFTER:
WHERE search_vector @@ plainto_tsquery('english', $1)
ORDER BY ts_rank(search_vector, plainto_tsquery('english', $1)) DESC
```

**Deliverable**: Updated DocumentStore.ts with PostgreSQL FTS

---

### A4: Handle Case Sensitivity
**Time**: 30 minutes
**Priority**: HIGH
**Dependencies**: A3

**Actions**:
- Verify FTS case-insensitivity works
- Update library/version matching if needed
- Test with various case combinations

**Deliverable**: Case-insensitive search working

---

### A5: Test and Iterate
**Time**: 1-2 hours
**Priority**: CRITICAL
**Dependencies**: A3, A4

**Actions**:
- Run DocumentStore.test.ts
- Fix failures one by one
- Re-run tests after each fix
- Verify all 24 tests pass

**Command**:
```bash
npm test -- DocumentStore.test.ts
```

**Target**: 24/24 tests passing (100%)

**Deliverable**: All DocumentStore tests passing

---

### A6: Commit FTS Fixes
**Time**: 15 minutes
**Priority**: HIGH
**Dependencies**: A5

**Actions**:
- Review changes
- Write descriptive commit message
- Commit to git

**Command**:
```bash
git add src/store/DocumentStore.ts
git commit -m "feat(phase-5.2): implement PostgreSQL FTS in DocumentStore"
```

**Deliverable**: Clean commit of FTS fixes

---

## Phase B: Test Database Setup

### B1: Connect to PostgreSQL Server
**Time**: 5 minutes
**Priority**: HIGH
**Dependencies**: None

**Actions**:
- Test connection to postgres.den.lan
- Verify credentials work

**Command**:
```bash
psql -h postgres.den.lan -U postgres -W
```

**Deliverable**: Successful connection

---

### B2: Create Test Database
**Time**: 10 minutes
**Priority**: HIGH
**Dependencies**: B1

**Actions**:
- Create scrapegoat_test database
- Verify creation

**SQL**:
```sql
CREATE DATABASE scrapegoat_test WITH ENCODING='UTF8';
\l scrapegoat_test
```

**Deliverable**: scrapegoat_test database created

---

### B3: Install pgvector Extension
**Time**: 10 minutes
**Priority**: HIGH
**Dependencies**: B2

**Actions**:
- Install pgvector extension
- Test vector functionality

**SQL**:
```sql
\c scrapegoat_test
CREATE EXTENSION vector;
\dx vector
SELECT '[1,2,3]'::vector;
```

**Deliverable**: pgvector installed and working

---

### B4: Create Test User (Optional)
**Time**: 15 minutes
**Priority**: MEDIUM
**Dependencies**: B2

**Actions**:
- Create test user
- Grant permissions

**SQL**:
```sql
CREATE USER scrapegoat_test WITH PASSWORD 'test_secure_password_123';
GRANT ALL PRIVILEGES ON DATABASE scrapegoat_test TO scrapegoat_test;
```

**Deliverable**: Test user created (optional)

---

### B5: Update Test Configuration
**Time**: 30 minutes
**Priority**: HIGH
**Dependencies**: B3

**Actions**:
- Create .env.test file
- Update test utilities
- Update package.json scripts

**Files Modified**:
- `.env.test` (new)
- `src/store/test-utils.ts` (may be new)
- `package.json`

**Deliverable**: Project configured for test database

---

### B6: Run Migrations
**Time**: 15 minutes
**Priority**: HIGH
**Dependencies**: B5

**Actions**:
- Apply all migrations to test database
- Verify tables created

**Command**:
```bash
export DATABASE_URL="postgresql://postgres:password@postgres.den.lan:5432/scrapegoat_test"
npm run migrate
```

**Deliverable**: Migrations applied successfully

---

### B7: Verify Database Setup
**Time**: 15 minutes
**Priority**: HIGH
**Dependencies**: B6

**Actions**:
- Run verification SQL queries
- Check tables, indexes, triggers
- Test FTS and vector functionality

**Deliverable**: All verification checks pass

---

### B8: Document Connection Details
**Time**: 10 minutes
**Priority**: MEDIUM
**Dependencies**: B7

**Actions**:
- Update .env.example
- Document in README.md

**Files Modified**:
- `.env.example`
- `README.md`

**Deliverable**: Connection details documented

---

## Phase C: Rewrite Migration Tests

### C1: Analyze Current Tests
**Time**: 30 minutes
**Priority**: MEDIUM
**Dependencies**: None

**Actions**:
- Read applyMigrations.test.ts
- Understand test scenarios
- Document what needs to change

**Files**:
- `src/store/applyMigrations.test.ts`
- `src/store/applyMigrations.ts`

**Deliverable**: Understanding of test requirements

---

### C2: Create Test Helpers
**Time**: 1 hour
**Priority**: HIGH
**Dependencies**: B (Phase B complete)

**Actions**:
- Create createTestDatabase() function
- Create withTestDatabase() function
- Test helpers work correctly

**Files**:
- `src/store/test-utils.ts` (new or updated)

**Deliverable**: Working test helper functions

---

### C3: Rewrite Migration Tests
**Time**: 2-3 hours
**Priority**: MEDIUM-HIGH
**Dependencies**: C2

**Actions**:
- Rewrite all test cases for schema isolation
- Update assertions
- Add proper cleanup
- Test fresh migrations
- Test incremental migrations
- Test error handling

**Files Modified**:
- `src/store/applyMigrations.test.ts`

**Deliverable**: Rewritten migration tests

---

### C4: Update applyMigrations
**Time**: 30 minutes
**Priority**: MEDIUM
**Dependencies**: C3

**Actions**:
- Ensure applyMigrations respects search_path
- Verify no hardcoded schema references

**Files**:
- `src/store/applyMigrations.ts` (may need updates)

**Deliverable**: Migration system supports schemas

---

### C5: Run and Validate Tests
**Time**: 30 minutes
**Priority**: HIGH
**Dependencies**: C3, C4

**Actions**:
- Run migration tests
- Verify all pass
- Check cleanup works

**Command**:
```bash
npm test -- applyMigrations.test.ts
```

**Deliverable**: All migration tests passing

---

### C6: Commit Updates
**Time**: 15 minutes
**Priority**: MEDIUM
**Dependencies**: C5

**Actions**:
- Commit migration test updates

**Command**:
```bash
git add src/store/applyMigrations.test.ts src/store/test-utils.ts
git commit -m "feat(phase-5.2): rewrite migration tests for PostgreSQL"
```

**Deliverable**: Migration tests committed

---

## Phase D: Validate Service Layer

### D1: Review Service Tests
**Time**: 30 minutes
**Priority**: MEDIUM
**Dependencies**: None

**Actions**:
- Read DocumentRetrieverService.test.ts
- Understand test expectations

**Files**:
- `src/store/DocumentRetrieverService.test.ts`

**Deliverable**: Understanding of service tests

---

### D2: Run Tests
**Time**: 30 minutes
**Priority**: MEDIUM
**Dependencies**: A (Phase A complete)

**Actions**:
- Run service tests
- Document failures

**Command**:
```bash
npm test -- DocumentRetrieverService.test.ts --verbose
```

**Deliverable**: List of issues to fix

---

### D3: Update Service Implementation
**Time**: 1-2 hours
**Priority**: MEDIUM
**Dependencies**: D2

**Actions**:
- Fix hybrid search queries
- Update score calculations
- Fix any PostgreSQL syntax issues

**Files**:
- `src/store/DocumentRetrieverService.ts` (if needed)

**Deliverable**: Updated service implementation

---

### D4: Adjust Test Expectations
**Time**: 30 minutes
**Priority**: MEDIUM
**Dependencies**: D3

**Actions**:
- Update test assertions for PostgreSQL scores
- Adjust tolerances if needed

**Files**:
- `src/store/DocumentRetrieverService.test.ts` (if needed)

**Deliverable**: Updated test expectations

---

### D5: Validate Hybrid Search
**Time**: 30 minutes
**Priority**: MEDIUM
**Dependencies**: D3

**Actions**:
- Manual testing of hybrid search
- Verify results are relevant

**Deliverable**: Hybrid search working correctly

---

### D6: Run and Verify Tests
**Time**: 30 minutes
**Priority**: HIGH
**Dependencies**: D3, D4

**Actions**:
- Run service tests
- Verify all pass

**Command**:
```bash
npm test -- DocumentRetrieverService.test.ts
```

**Deliverable**: All service tests passing

---

### D7: Commit Updates
**Time**: 15 minutes
**Priority**: MEDIUM
**Dependencies**: D6

**Actions**:
- Commit service updates

**Command**:
```bash
git add src/store/DocumentRetrieverService.*
git commit -m "feat(phase-5.2): validate DocumentRetrieverService for PostgreSQL"
```

**Deliverable**: Service updates committed

---

## Phase E: Verify CLI Tests

### E1: Identify CLI Tests
**Time**: 15 minutes
**Priority**: MEDIUM
**Dependencies**: None

**Actions**:
- Find all CLI test files
- List test scenarios

**Command**:
```bash
find src -name "*.test.ts" -path "*/commands/*"
```

**Deliverable**: List of CLI test files

---

### E2: Run CLI Tests
**Time**: 15 minutes
**Priority**: MEDIUM
**Dependencies**: A, D (Phases A and D complete)

**Actions**:
- Run all CLI tests
- Document results

**Command**:
```bash
npm test -- --testPathPattern=commands
```

**Deliverable**: CLI test status report

---

### E3: Fix Issues
**Time**: 0-2 hours
**Priority**: MEDIUM
**Dependencies**: E2

**Actions**:
- Debug failing tests
- Fix implementation or tests
- Re-run until passing

**Files**:
- `src/commands/*.ts` (if needed)

**Deliverable**: All CLI tests passing

---

### E4: Manual Testing
**Time**: 30 minutes
**Priority**: MEDIUM
**Dependencies**: E3

**Actions**:
- Manually run CLI commands
- Verify functionality

**Deliverable**: CLI working manually

---

### E5: Commit Fixes
**Time**: 15 minutes
**Priority**: MEDIUM
**Dependencies**: E3

**Actions**:
- Commit CLI fixes (if any)

**Deliverable**: CLI fixes committed

---

## Phase F: Create Documentation

### F1: Create POSTGRESQL_SETUP.md
**Time**: 2-3 hours
**Priority**: MEDIUM
**Dependencies**: None

**Actions**:
- Write setup guide
- Include all platforms
- Add troubleshooting section
- Test all examples

**Files**:
- `docs/POSTGRESQL_SETUP.md` (new)

**Deliverable**: Complete setup guide

---

### F2: Create CONFIGURATION.md
**Time**: 2-3 hours
**Priority**: MEDIUM
**Dependencies**: None

**Actions**:
- Document all config options
- Provide examples
- Add best practices

**Files**:
- `docs/CONFIGURATION.md` (new)

**Deliverable**: Complete configuration reference

---

### F3: Update README
**Time**: 30 minutes
**Priority**: MEDIUM
**Dependencies**: F1, F2

**Actions**:
- Add links to documentation
- Update quick start section

**Files**:
- `README.md`

**Deliverable**: Updated README

---

### F4: Review and Polish
**Time**: 30 minutes
**Priority**: MEDIUM
**Dependencies**: F1, F2, F3

**Actions**:
- Review all documentation
- Fix typos and errors
- Test code examples

**Deliverable**: Polished documentation

---

### F5: Commit Documentation
**Time**: 15 minutes
**Priority**: MEDIUM
**Dependencies**: F4

**Actions**:
- Commit all documentation

**Command**:
```bash
git add docs/ README.md
git commit -m "docs(phase-5.2): add PostgreSQL setup and configuration guides"
```

**Deliverable**: Documentation committed

---

## Phase G: Finalization

### G1: Run Full Test Suite
**Time**: 15 minutes
**Priority**: HIGH
**Dependencies**: All previous phases

**Actions**:
- Run all tests
- Verify all pass

**Command**:
```bash
npm test
```

**Deliverable**: All tests passing

---

### G2: Verify Coverage
**Time**: 15 minutes
**Priority**: HIGH
**Dependencies**: G1

**Actions**:
- Run coverage report
- Verify ≥60%

**Command**:
```bash
npm run test:coverage
```

**Deliverable**: Coverage report ≥60%

---

### G3: Manual E2E Test
**Time**: 30 minutes
**Priority**: HIGH
**Dependencies**: G1

**Actions**:
- Run complete workflow manually
- Test add, search, list, delete

**Deliverable**: E2E test passed

---

### G4: Update STATUS.md
**Time**: 30 minutes
**Priority**: MEDIUM
**Dependencies**: G1, G2, G3

**Actions**:
- Update STATUS.md
- Record completion details
- Document metrics

**Files**:
- `STATUS.md`

**Deliverable**: Updated STATUS.md

---

### G5: Create Summary
**Time**: 15 minutes
**Priority**: LOW
**Dependencies**: G4

**Actions**:
- Create phase summary document
- List accomplishments

**Files**:
- `docs/phase-5.2-summary.md` (new)

**Deliverable**: Phase summary created

---

### G6: Final Commit
**Time**: 15 minutes
**Priority**: MEDIUM
**Dependencies**: G4, G5

**Actions**:
- Commit status updates
- Push all changes

**Command**:
```bash
git add STATUS.md docs/phase-5.2-summary.md
git commit -m "docs(phase-5.2): complete Phase 5.2 status update"
git push origin postgres-fork
```

**Deliverable**: All changes pushed

---

## Task Progress Tracking

Use this checklist to track progress:

### Phase A
- [ ] A1: Analyze Current Implementation
- [ ] A2: Design FTS Query Builder
- [ ] A3: Implement FTS Query Methods
- [ ] A4: Handle Case Sensitivity
- [ ] A5: Test and Iterate
- [ ] A6: Commit FTS Fixes

### Phase B
- [ ] B1: Connect to PostgreSQL Server
- [ ] B2: Create Test Database
- [ ] B3: Install pgvector Extension
- [ ] B4: Create Test User (Optional)
- [ ] B5: Update Test Configuration
- [ ] B6: Run Migrations
- [ ] B7: Verify Database Setup
- [ ] B8: Document Connection Details

### Phase C
- [ ] C1: Analyze Current Tests
- [ ] C2: Create Test Helpers
- [ ] C3: Rewrite Migration Tests
- [ ] C4: Update applyMigrations
- [ ] C5: Run and Validate Tests
- [ ] C6: Commit Updates

### Phase D
- [ ] D1: Review Service Tests
- [ ] D2: Run Tests
- [ ] D3: Update Service Implementation
- [ ] D4: Adjust Test Expectations
- [ ] D5: Validate Hybrid Search
- [ ] D6: Run and Verify Tests
- [ ] D7: Commit Updates

### Phase E
- [ ] E1: Identify CLI Tests
- [ ] E2: Run CLI Tests
- [ ] E3: Fix Issues
- [ ] E4: Manual Testing
- [ ] E5: Commit Fixes

### Phase F
- [ ] F1: Create POSTGRESQL_SETUP.md
- [ ] F2: Create CONFIGURATION.md
- [ ] F3: Update README
- [ ] F4: Review and Polish
- [ ] F5: Commit Documentation

### Phase G
- [ ] G1: Run Full Test Suite
- [ ] G2: Verify Coverage
- [ ] G3: Manual E2E Test
- [ ] G4: Update STATUS.md
- [ ] G5: Create Summary
- [ ] G6: Final Commit

---

*Last Updated: 2025-11-08*
