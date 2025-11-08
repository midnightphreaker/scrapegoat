# Risk Assessment: Phase 5.2

## Risk Matrix

| ID | Risk | Severity | Likelihood | Priority | Status |
|----|------|----------|------------|----------|--------|
| R1 | FTS Query Complexity | HIGH | MEDIUM | CRITICAL | 🔴 Active |
| R2 | Test Database Conflicts | MEDIUM | LOW | HIGH | 🟡 Monitoring |
| R3 | Migration Test Failures | MEDIUM | MEDIUM | HIGH | 🔴 Active |
| R4 | Performance Degradation | LOW | MEDIUM | MEDIUM | 🟡 Monitoring |
| R5 | Documentation Gaps | LOW | MEDIUM | LOW | 🟢 Acceptable |
| R6 | Test Coverage Below Target | MEDIUM | LOW | MEDIUM | 🟡 Monitoring |
| R7 | Schema Cleanup Failures | MEDIUM | LOW | MEDIUM | 🟡 Monitoring |
| R8 | Parameter Binding Errors | HIGH | MEDIUM | HIGH | 🔴 Active |

---

## R1: FTS Query Complexity

**Category**: Technical
**Severity**: HIGH
**Likelihood**: MEDIUM
**Overall Risk**: HIGH
**Status**: 🔴 Active

### Description
PostgreSQL FTS uses completely different syntax and semantics than SQLite FTS5. The complexity of properly implementing query parsing, ranking, and edge case handling could block Phase 5.2 completion.

### Impact
- Could prevent DocumentStore tests from passing
- May require significant rework of search functionality
- Could delay entire phase by days
- May uncover additional incompatibilities

### Root Causes
- Different FTS architectures (SQLite FTS5 vs PostgreSQL tsvector/tsquery)
- Special character handling differences
- Ranking algorithm differences
- Query operator syntax differences

### Mitigation Strategy

**Preventive Actions**:
1. Start with simplest query function (plainto_tsquery)
2. Test each query type individually before integration
3. Reference PostgreSQL FTS documentation extensively
4. Create test cases for edge cases first
5. Use research document as implementation guide

**Detective Controls**:
- Run tests after each query change
- Log actual SQL queries being executed
- Test with variety of search terms
- Monitor test failure patterns

**Corrective Actions**:
- If too complex, use plainto_tsquery for all queries (simpler but works)
- Consult PostgreSQL experts or community
- Consider using library for query building
- Fall back to simpler search if needed

### Contingency Plan

If FTS implementation becomes blocked:

1. **Fallback Option 1**: Use plainto_tsquery for everything
   - Pros: Simple, safe, handles most cases
   - Cons: No advanced query operators
   - Time: Saves 2-3 hours

2. **Fallback Option 2**: Use LIKE queries temporarily
   - Pros: Always works
   - Cons: No ranking, slower, not FTS
   - Time: Very quick (1 hour)

3. **Escalation**: Seek expert help
   - PostgreSQL community forums
   - Stack Overflow
   - Consult database expert

### Current Status
- Risk is active (FTS implementation not started)
- Mitigation: Will use plainto_tsquery (simpler, safer)
- Monitoring: Will track test passing rate

### Success Criteria
- All 24 DocumentStore tests passing
- FTS queries execute without errors
- Search results are relevant

---

## R2: Test Database Conflicts

**Category**: Infrastructure
**Severity**: MEDIUM
**Likelihood**: LOW
**Overall Risk**: MEDIUM
**Status**: 🟡 Monitoring

### Description
The test database setup on postgres.den.lan could accidentally interfere with existing openmemory databases, which is a CRITICAL constraint.

### Impact
- Could damage openmemory data (CRITICAL)
- Could cause authentication/permission issues
- Could conflict with other projects
- Loss of trust and project credibility

### Root Causes
- Shared PostgreSQL server
- Manual database operations
- Human error (wrong database selected)
- Insufficient isolation

### Mitigation Strategy

**Preventive Actions**:
1. Use completely separate database name (scrapegoat_test)
2. Never connect to openmemory databases
3. Add safety checks in code
4. Document which databases are off-limits
5. Use dedicated schema names (test_*)

**Detective Controls**:
- Always verify current database before operations
- Use `SELECT current_database();` before destructive operations
- Review SQL commands before executing
- Monitor database list periodically

**Corrective Actions**:
- If wrong database accessed: STOP immediately
- Document incident
- Verify no damage done
- Implement additional safeguards

### Contingency Plan

If openmemory database is accidentally accessed:

1. **Immediate Actions**:
   - STOP all operations immediately
   - Disconnect from database
   - Do NOT execute any write operations
   - Document what was accessed

2. **Assessment**:
   - Verify no data was modified
   - Check openmemory application still works
   - Review logs for any changes

3. **Recovery**:
   - If data damaged: Restore from backup (contact admin)
   - If no damage: Document lesson learned
   - Implement additional safeguards

### Current Status
- Risk is being monitored
- Mitigation: Using separate database name
- Prevention: Will add safety checks in code

### Success Criteria
- No access to openmemory databases
- Test database operations isolated
- Zero incidents

---

## R3: Migration Test Failures

**Category**: Technical
**Severity**: MEDIUM
**Likelihood**: MEDIUM
**Overall Risk**: MEDIUM-HIGH
**Status**: 🔴 Active

### Description
Rewriting migration tests for schema-based isolation could reveal bugs in the migration system or result in test pollution between tests.

### Impact
- Migration tests may not pass
- Could indicate migration bugs affecting production
- Test pollution could cause intermittent failures
- Could delay Phase 5.2 completion
- May require rework of migration system

### Root Causes
- Schema isolation not properly implemented
- Cleanup not working correctly
- search_path not set correctly
- Migration code has schema assumptions
- Test dependencies not properly isolated

### Mitigation Strategy

**Preventive Actions**:
1. Create robust test helper functions first
2. Test helpers thoroughly before using in tests
3. Use unique schema names (timestamp + random)
4. Implement proper cleanup in afterEach
5. Test on fresh database first

**Detective Controls**:
- Check for leftover test schemas after tests
- Monitor test execution order effects
- Verify migrations apply cleanly each time
- Check search_path is correct during tests

**Corrective Actions**:
- Add explicit cleanup verification
- Use CASCADE when dropping schemas
- Reset search_path after each test
- Add schema existence checks

### Contingency Plan

If migration tests cannot be made reliable:

1. **Fallback Option 1**: Use transaction rollback for simple tests
   - Won't work for all scenarios but better than nothing
   - Time: Saves 2-3 hours

2. **Fallback Option 2**: Use separate databases (slower)
   - Complete isolation guaranteed
   - Time: Adds 1-2 hours to test runs

3. **Fallback Option 3**: Skip migration tests temporarily
   - Document as known limitation
   - Test migrations manually
   - Add to Phase 6 scope

### Current Status
- Risk is active (tests not rewritten yet)
- Mitigation: Will use proven schema isolation pattern
- Monitoring: Will verify cleanup after tests

### Success Criteria
- All migration tests passing
- No leftover test schemas
- Tests pass consistently
- No test pollution

---

## R4: Performance Degradation

**Category**: Performance
**Severity**: LOW
**Likelihood**: MEDIUM
**Overall Risk**: LOW-MEDIUM
**Status**: 🟡 Monitoring

### Description
PostgreSQL tests may be significantly slower than SQLite :memory: tests, especially if connecting to remote server (postgres.den.lan).

### Impact
- Slower test execution (may go from <10s to 30-60s)
- Developer productivity impact
- CI/CD pipeline slower
- May discourage running tests frequently

### Root Causes
- Network latency to postgres.den.lan
- Database creation/cleanup overhead
- Migration application overhead
- Query execution overhead
- Connection overhead

### Mitigation Strategy

**Preventive Actions**:
1. Use connection pooling
2. Keep indexes optimized
3. Use schema isolation (faster than databases)
4. Reuse connections where possible
5. Run tests in parallel

**Detective Controls**:
- Measure test execution time
- Profile slow tests
- Monitor database query performance
- Track test duration trends

**Corrective Actions**:
- Optimize slow tests
- Cache test fixtures
- Use test data builders
- Consider local PostgreSQL for development

### Contingency Plan

If tests become too slow:

1. **Optimization**:
   - Enable parallel test execution
   - Optimize database connection usage
   - Reduce test database setup overhead

2. **Infrastructure**:
   - Set up local PostgreSQL for faster tests
   - Use Docker for local test database
   - CI/CD can still use remote database

3. **Acceptance**:
   - Document that PostgreSQL tests are slower
   - Still better than not having tests
   - Focus on test quality over speed

### Current Status
- Risk is being monitored
- Baseline: Will measure current test speed
- Target: <60 seconds for full suite

### Success Criteria
- Full test suite completes in <2 minutes
- Individual test files complete in <30 seconds
- Performance acceptable for development workflow

---

## R5: Documentation Gaps

**Category**: Documentation
**Severity**: LOW
**Likelihood**: MEDIUM
**Overall Risk**: LOW
**Status**: 🟢 Acceptable

### Description
Documentation may have gaps, errors, or unclear sections that make setup difficult for users.

### Impact
- Users struggle with setup
- Support burden increases
- Project adoption delayed
- Reputation impact
- Time wasted debugging setup issues

### Root Causes
- Missing steps in documentation
- Untested examples
- Platform-specific issues not covered
- Outdated information
- Assumptions about user knowledge

### Mitigation Strategy

**Preventive Actions**:
1. Test all documentation steps on fresh system
2. Include troubleshooting section
3. Provide working examples
4. Cover multiple platforms
5. Request peer review

**Detective Controls**:
- Test documentation yourself
- Ask colleague to follow documentation
- Monitor user feedback
- Track common support questions

**Corrective Actions**:
- Update documentation based on feedback
- Add missing steps
- Clarify confusing sections
- Add more examples

### Contingency Plan

If documentation is insufficient:

1. **Quick Fixes**:
   - Add FAQ section
   - Link to external resources
   - Provide example repository

2. **Iterative Improvement**:
   - Update based on user feedback
   - Add video tutorial if needed
   - Create step-by-step guide

3. **Support**:
   - Provide direct support initially
   - Document common issues
   - Build knowledge base

### Current Status
- Risk is acceptable
- Mitigation: Will test all examples
- Plan: Request peer review of documentation

### Success Criteria
- Setup steps work on fresh PostgreSQL
- Common errors documented
- User can complete setup in <30 minutes

---

## R6: Test Coverage Below Target

**Category**: Quality
**Severity**: MEDIUM
**Likelihood**: LOW
**Overall Risk**: LOW-MEDIUM
**Status**: 🟡 Monitoring

### Description
Test coverage may fall below the 60% target after PostgreSQL migration.

### Impact
- Quality standards not met
- Critical paths may be untested
- Higher risk of bugs in production
- Phase 5.2 completion criteria not met

### Root Causes
- Tests removed or disabled during migration
- New code added without tests
- Coverage calculation changes
- Test files not included in coverage

### Mitigation Strategy

**Preventive Actions**:
1. Run coverage report before and after changes
2. Don't remove tests unless necessary
3. Add tests for new code
4. Focus on critical path coverage

**Detective Controls**:
- Run coverage after each phase
- Monitor coverage trends
- Identify uncovered critical code

**Corrective Actions**:
- Add tests for uncovered code
- Increase coverage of critical paths
- Remove dead code (increases coverage %)

### Contingency Plan

If coverage is below target:

1. **Assessment**:
   - Identify what's uncovered
   - Determine if critical

2. **Prioritized Addition**:
   - Add tests for critical paths first
   - Document uncovered non-critical code
   - Plan to add tests in Phase 6

3. **Acceptance**:
   - Document current coverage
   - Create plan to improve
   - May accept slightly below target if critical paths covered

### Current Status
- Risk is being monitored
- Baseline: Will measure current coverage
- Target: ≥60% overall, ≥70% store layer

### Success Criteria
- Overall coverage ≥60%
- Store layer coverage ≥70%
- All critical paths tested

---

## R7: Schema Cleanup Failures

**Category**: Infrastructure
**Severity**: MEDIUM
**Likelihood**: LOW
**Overall Risk**: LOW-MEDIUM
**Status**: 🟡 Monitoring

### Description
Test schema cleanup may fail, leaving orphaned schemas in the database that accumulate over time.

### Impact
- Database clutter
- Storage waste
- Potential name collisions
- Performance degradation over time
- Manual cleanup required

### Root Causes
- afterEach hook fails
- Test process crashes
- Connection errors during cleanup
- Permissions issues
- CASCADE not working as expected

### Mitigation Strategy

**Preventive Actions**:
1. Use try/finally for cleanup
2. Use CASCADE when dropping schemas
3. Add timeout to cleanup operations
4. Log cleanup failures
5. Use unique schema names (timestamp + random)

**Detective Controls**:
- Check for test schemas after test runs
- Monitor database schema count
- Periodic cleanup verification
- Alert on schema count growth

**Corrective Actions**:
- Create cleanup script for orphaned schemas
- Run cleanup script periodically
- Fix cleanup code if failures detected

### Contingency Plan

If cleanup fails regularly:

1. **Immediate**:
   - Create manual cleanup script
   - Run after test sessions

2. **Automated Cleanup Script**:
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

3. **Prevention**:
   - Add cleanup verification to tests
   - Improve error handling in cleanup code

### Current Status
- Risk is being monitored
- Mitigation: Will use robust cleanup pattern
- Plan: Create cleanup script

### Success Criteria
- No orphaned test schemas after test runs
- Cleanup succeeds 100% of time
- Database remains clean

---

## R8: Parameter Binding Errors

**Category**: Technical
**Severity**: HIGH
**Likelihood**: MEDIUM
**Overall Risk**: HIGH
**Status**: 🔴 Active

### Description
Converting from SQLite parameter binding (`?`) to PostgreSQL (`$1, $2`) could introduce errors if missed in any queries.

### Impact
- SQL syntax errors
- Tests fail
- Queries don't execute
- Could be hard to debug
- May miss some occurrences

### Root Causes
- Different parameter syntax between SQLite and PostgreSQL
- Manual find/replace errors
- Missed occurrences
- Dynamic query construction
- Template literals with parameters

### Mitigation Strategy

**Preventive Actions**:
1. Search for all `?` in query strings
2. Use automated find/replace where safe
3. Review each occurrence manually
4. Test each modified query
5. Use IDE/editor search tools

**Detective Controls**:
- Tests will fail if parameters wrong
- PostgreSQL error messages are clear
- Run tests after each change

**Corrective Actions**:
- Fix parameter binding when found
- Add test for that query
- Search for similar patterns

### Contingency Plan

If parameter binding errors are pervasive:

1. **Systematic Search**:
```bash
# Find all ? in SQL queries
grep -r "'" src/store/ | grep "?"
grep -r '`' src/store/ | grep "?"
```

2. **Automated Fix** (with care):
   - Use regex to find query strings
   - Manually review each occurrence
   - Replace systematically

3. **Testing**:
   - Run tests after each file fixed
   - Verify queries execute

### Current Status
- Risk is active (not yet converted)
- Mitigation: Will use systematic search and replace
- Plan: Review each query manually

### Success Criteria
- All queries use PostgreSQL parameter syntax
- No SQL errors related to parameters
- All tests pass

---

## Risk Mitigation Timeline

| Phase | Active Risks | Mitigation Activities |
|-------|-------------|----------------------|
| A | R1, R8 | Use plainto_tsquery, systematic parameter replacement |
| B | R2 | Use separate database, safety checks |
| C | R3, R7 | Robust cleanup, schema isolation testing |
| D | R1 | Validate FTS in service layer |
| E | - | Verify CLI with PostgreSQL |
| F | R5 | Test documentation, peer review |
| G | R4, R6 | Measure performance and coverage |

---

## Risk Response Plan Summary

**Critical Risks (R1, R8)**:
- Start with simplest approach (plainto_tsquery)
- Systematic search and replace for parameters
- Test incrementally
- Have fallback options ready

**High Risks (R2, R3)**:
- Implement strong preventive controls
- Monitor actively
- Quick detection and response

**Medium/Low Risks (R4, R5, R6, R7)**:
- Monitor during execution
- Accept some level of risk
- Mitigate if becomes issue

---

*Last Updated: 2025-11-08*
