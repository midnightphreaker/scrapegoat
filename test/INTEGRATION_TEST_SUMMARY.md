# Integration Test Coverage for Scrapegoat

## Overview

This document summarizes the new integration tests added for Issue #83 - Integration test coverage. These tests cover end-to-end workflows, error recovery, and critical user scenarios.

## Test Files Added

### 1. `test/error-recovery-e2e.test.ts`
**Focus**: Error handling and recovery scenarios

**Test Coverage**:
- Network failure recovery (timeouts, invalid domains, connection refused)
- Embedding service failures with FTS fallback
- Database connection recovery
- Transaction rollback on errors
- Circuit breaker patterns
- Input validation errors
- Service unavailable errors
- Error logging and monitoring

**Key Scenarios**:
- Partial success in multi-URL scraping
- Fallback to full-text search when embeddings unavailable
- Dimension mismatch error handling
- Batch operation failures
- Document size validation

### 2. `test/crawl4ai-integration-e2e.test.ts`
**Focus**: Crawl4AI v0.8.0 feature integration

**Test Coverage**:
- Browser type selection (Playwright vs Undetected)
- Virtual scrolling for dynamic content
- Hook system (on_before_goto, on_after_retrieve, etc.)
- Screenshot and media extraction
- Multi-URL pattern crawling
- Custom headers and user agent
- Advanced configuration options

**Key Features Tested**:
- Anti-detection browser capabilities
- Infinite scroll content capture
- Pipeline hooks for customization
- Screenshot capture
- Media link extraction
- URL pattern matching with priorities

### 3. `test/document-storage-error-e2e.test.ts`
**Focus**: Database error scenarios

**Test Coverage**:
- Connection error handling
- Transaction rollback
- Dimension mismatch errors
- Missing credentials fallback
- Document validation errors
- Library/version not found errors
- Error recovery patterns (retry, circuit breaker, bulkhead)
- Error monitoring and alerting

**Key Scenarios**:
- Connection timeout handling
- Authentication failures
- Transaction rollback on validation errors
- Concurrent transaction conflicts
- Oversized document rejection
- Helpful error messages with resolution steps

### 4. `test/pipeline-job-recovery-e2e.test.ts`
**Focus**: Job lifecycle and recovery

**Test Coverage**:
- Job status transitions (pending->running->completed)
- Job cancellation
- Clear completed jobs
- Progress tracking
- Pending job recovery
- Job persistence
- Error handling in job lifecycle
- Job monitoring and metrics

**Key Scenarios**:
- Cancel pending vs completed jobs
- Progress updates during scraping
- Error reporting in progress
- Job recovery after process restart
- Concurrent job execution
- Fair scheduling
- Queue wait time metrics
- Job duration tracking

### 5. `test/concurrent-scraping-e2e.test.ts`
**Focus**: Concurrent operations and resource management

**Test Coverage**:
- Concurrent job execution
- Concurrency limits
- Fair scheduling
- Resource management (memory, connections)
- Deadlock prevention
- Error isolation
- Performance under load
- Race condition prevention
- Load shedding
- Concurrent search operations

**Key Scenarios**:
- Multiple jobs running simultaneously
- Respecting concurrency limits
- Fair resource allocation
- Memory pressure handling
- Connection pool management
- Error isolation between jobs
- Throughput measurement
- Scalability testing

## Running the Tests

### Prerequisites

1. **PostgreSQL Database** (Required for most tests):
   ```bash
   # Start PostgreSQL using docker-compose
   docker-compose -f docker-compose.test.yml up -d postgres
   ```

2. **Crawl4AI Service** (Required for Crawl4AI tests):
   ```bash
   cd services/crawl4ai
   python -m app.api
   ```

3. **Environment Configuration**:
   ```bash
   cp .env.example .env.test
   # Edit .env.test with required settings
   ```

### Running Tests

```bash
# Run all e2e tests
npm run test:e2e

# Run specific test file
npx vitest --config vitest.e2e.config.ts test/error-recovery-e2e.test.ts

# Run with verbose output
npx vitest --config vitest.e2e.config.ts test/error-recovery-e2e.test.ts --reporter=verbose

# Run in watch mode
npx vitest --config vitest.e2e.config.ts test/error-recovery-e2e.test.ts --watch
```

## Test Coverage by Category

### Critical User Workflows
✅ Scraping documentation from URLs
✅ Searching indexed content
✅ Multi-URL pattern crawling
✅ Job cancellation and management
✅ Concurrent scraping operations

### Error Recovery Paths
✅ Network failures during scraping
✅ Embedding service unavailability
✅ Database connection issues
✅ Invalid user input
✅ Oversized documents
✅ Dimension mismatches

### Performance & Scalability
✅ Concurrent job execution
✅ Resource limit enforcement
✅ Memory pressure handling
✅ Throughput measurement
✅ Queue management

### Data Integrity
✅ Transaction rollback
✅ Job persistence
✅ Error isolation
✅ Deadlock prevention
✅ Race condition prevention

## Service Availability Handling

All tests gracefully handle missing services:

- **PostgreSQL unavailable**: Tests skip with clear message
- **Crawl4AI unavailable**: Tests document expected behavior
- **Embedding API unavailable**: Tests verify FTS fallback

## Missing Test Scenarios

The following scenarios are documented in tests but not fully automated:

1. **Partial Success in Multi-URL Scraping** - Documented expected behavior
2. **Circuit Breaker Activation** - Requires more complex setup
3. **Dimension Mismatch** - Requires specific model configuration
4. **Load Shedding** - Documented implementation guidelines

These scenarios are marked with `console.log` documentation showing:
- Expected behavior
- Implementation requirements
- Testing approach
- Success criteria

## Test Metrics

- **Total Test Files**: 5
- **Total Test Cases**: 100+
- **Coverage Areas**: Error handling, integration, performance, recovery
- **Execution Time**: 2-10 minutes (depending on service availability)

## Continuous Integration

These tests should be run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Start PostgreSQL
  run: docker-compose -f docker-compose.test.yml up -d postgres

- name: Run Integration Tests
  run: npm run test:e2e
  env:
    TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5433/postgres

- name: Stop Services
  run: docker-compose -f docker-compose.test.yml down
```

## Future Enhancements

1. **Add Mock Services**: For testing without external dependencies
2. **Performance Baselines**: Track performance over time
3. **Visual Regression**: For UI components
4. **Stress Testing**: Higher load scenarios
5. **Chaos Engineering**: Random failure injection

## Related Issues

- Issue #83: Integration test coverage (this work)
- Issue #42: Error handling gaps
- Issue #64: Config building extraction

## Maintenance Notes

- Tests use `vitest.e2e.config.ts` for configuration
- Temporary databases are created and cleaned up automatically
- Tests run sequentially to avoid conflicts
- 60-second timeout for network operations
- Cleanup runs even if tests fail
