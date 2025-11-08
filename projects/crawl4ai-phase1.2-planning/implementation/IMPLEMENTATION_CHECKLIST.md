# Implementation Checklist - Phase 1.2

## Pre-Implementation

- [ ] Read [EXECUTIVE_SUMMARY.md](../EXECUTIVE_SUMMARY.md)
- [ ] Review [architecture-decisions.md](../architecture/architecture-decisions.md)
- [ ] Verify Phase 1.1 Python service is working
  ```bash
  curl http://localhost:8001/health
  # Expected: {"status":"ok","version":"1.0.0","uptime":...}
  ```
- [ ] Confirm existing TypeScript components are present:
  - [ ] `/home/mp/Workspace/scrapegoat/src/scraper/fetcher/crawl4ai/types.ts` exists
  - [ ] `/home/mp/Workspace/scrapegoat/src/scraper/fetcher/crawl4ai/Crawl4AIClient.ts` exists

---

## Implementation Tasks

### Task 1: Add Configuration Constants ⏱️ 5 min

**File**: `/home/mp/Workspace/scrapegoat/src/utils/config.ts`

- [ ] Open file
- [ ] Add at end of file:
  ```typescript
  export const CRAWL4AI_SERVICE_URL = process.env.CRAWL4AI_SERVICE_URL || "http://localhost:8001";
  export const CRAWL4AI_TIMEOUT = parseInt(process.env.CRAWL4AI_TIMEOUT || "30000", 10);
  export const CRAWL4AI_MAX_RETRIES = parseInt(process.env.CRAWL4AI_MAX_RETRIES || "3", 10);
  ```
- [ ] Save file
- [ ] Run: `npm run build` (should pass)

**Reference**: [step-by-step-guide.md - Step 1](step-by-step-guide.md#step-1-add-configuration-constants)

---

### Task 2: Create Crawl4AIFetcher ⏱️ 30 min

**File**: `/home/mp/Workspace/scrapegoat/src/scraper/fetcher/crawl4ai/Crawl4AIFetcher.ts` (new file)

- [ ] Create new file
- [ ] Copy complete implementation from [step-by-step-guide.md - Step 2](step-by-step-guide.md#step-2-create-crawl4aifetcher)
- [ ] Verify imports resolve correctly
- [ ] Save file
- [ ] Run: `npm run build` (should pass)
- [ ] Verify no TypeScript errors

**Key Points**:
- Implements `ContentFetcher` interface
- Uses `Crawl4AIClient` for HTTP
- Returns markdown as `RawContent`
- Handles errors with `ScraperError`
- Checks service availability

---

### Task 3: Create Barrel Exports ⏱️ 5 min

**File 1**: `/home/mp/Workspace/scrapegoat/src/scraper/fetcher/crawl4ai/index.ts` (new file)

- [ ] Create new file
- [ ] Add content:
  ```typescript
  export * from "./Crawl4AIClient";
  export * from "./Crawl4AIFetcher";
  export * from "./types";
  ```
- [ ] Save file

**File 2**: `/home/mp/Workspace/scrapegoat/src/scraper/fetcher/index.ts`

- [ ] Open file
- [ ] Add line: `export * from "./crawl4ai";`
- [ ] Should be after existing exports
- [ ] Save file
- [ ] Run: `npm run build` (should pass)
- [ ] Test import: Verify `import { Crawl4AIFetcher } from './scraper/fetcher'` works

**Reference**: [step-by-step-guide.md - Step 3](step-by-step-guide.md#step-3-export-crawl4aifetcher)

---

### Task 4: Create Unit Tests ⏱️ 45 min

**File**: `/home/mp/Workspace/scrapegoat/src/scraper/fetcher/crawl4ai/Crawl4AIFetcher.test.ts` (new file)

- [ ] Create new file
- [ ] Copy complete test suite from [step-by-step-guide.md - Step 4](step-by-step-guide.md#step-4-create-unit-tests)
- [ ] Verify test framework (vitest) is available
- [ ] Save file
- [ ] Run: `npm test Crawl4AIFetcher.test.ts`
- [ ] All tests should pass
- [ ] Verify coverage >90%: `npm run test:coverage`

**Test Coverage**:
- [ ] canFetch() for HTTP/HTTPS
- [ ] canFetch() for other protocols
- [ ] fetch() success cases
- [ ] fetch() error cases (service down, circuit open, empty content)
- [ ] fetch() cancellation
- [ ] isAvailable() method
- [ ] getCircuitState() method

**Reference**: [step-by-step-guide.md - Step 4](step-by-step-guide.md#step-4-create-unit-tests)

---

### Task 5: Create Integration Tests ⏱️ 30 min

**File**: `/home/mp/Workspace/scrapegoat/src/scraper/fetcher/crawl4ai/Crawl4AIFetcher.integration.test.ts` (new file)

- [ ] Create new file
- [ ] Copy integration tests from [step-by-step-guide.md - Step 5](step-by-step-guide.md#step-5-create-integration-test)
- [ ] Save file
- [ ] Start Python service:
  ```bash
  cd /home/mp/Workspace/scrapegoat/services/crawl4ai
  docker-compose up -d
  ```
- [ ] Verify service: `curl http://localhost:8001/health`
- [ ] Run: `npm test Crawl4AIFetcher.integration.test.ts`
- [ ] All tests should pass
- [ ] Stop service: `docker-compose down` (if desired)

**Test Cases**:
- [ ] Service availability check
- [ ] Real webpage fetch
- [ ] Redirect handling
- [ ] Circuit breaker state

**Reference**: [step-by-step-guide.md - Step 5](step-by-step-guide.md#step-5-create-integration-test)

---

### Task 6: Documentation ⏱️ 15 min

**File**: Create `.env.example` (if doesn't exist)

- [ ] Create or update file
- [ ] Add:
  ```bash
  # Crawl4AI Service Configuration
  CRAWL4AI_SERVICE_URL=http://localhost:8001
  CRAWL4AI_TIMEOUT=30000
  CRAWL4AI_MAX_RETRIES=3
  ```
- [ ] Save file

**Optional**: Update main README.md with usage example

- [ ] See [step-by-step-guide.md - Step 6](step-by-step-guide.md#step-6-update-documentation) for documentation template

---

## Verification Tasks

### Build Verification

- [ ] Run: `npm run build`
  - Expected: Build completes without errors
  - Fix any TypeScript errors before proceeding

### Type Check

- [ ] Run: `npm run type-check`
  - Expected: No type errors
  - All imports resolve correctly

### Linting

- [ ] Run: `npm run lint`
  - Expected: No linting errors
  - Fix any style issues

### Unit Tests

- [ ] Run: `npm test Crawl4AIFetcher.test.ts`
  - Expected: All tests pass
  - Coverage >90%

- [ ] Run: `npm run test:coverage`
  - Check coverage report
  - Ensure >90% for Crawl4AIFetcher.ts

### Integration Tests

**Prerequisites**: Python service running

- [ ] Start service:
  ```bash
  cd /home/mp/Workspace/scrapegoat/services/crawl4ai
  docker-compose up -d
  ```

- [ ] Verify service:
  ```bash
  curl http://localhost:8001/health
  ```

- [ ] Run tests:
  ```bash
  npm test Crawl4AIFetcher.integration.test.ts
  ```
  - Expected: All tests pass
  - Tests verify real service communication

- [ ] Stop service (optional):
  ```bash
  cd /home/mp/Workspace/scrapegoat/services/crawl4ai
  docker-compose down
  ```

### Manual Testing

**Create Test Script**: `/home/mp/Workspace/scrapegoat/scripts/test-crawl4ai-manual.ts`

- [ ] Copy script from [step-by-step-guide.md - Manual Testing](step-by-step-guide.md#step-8-final-verification)
- [ ] Ensure Python service is running
- [ ] Run: `npx tsx scripts/test-crawl4ai-manual.ts`
- [ ] Expected output:
  ```
  === Crawl4AI Manual Test ===

  1. Checking service availability...
     Service available: true

  2. Circuit breaker state:
     State: closed
     Failure count: 0
     ...

  === All tests passed! ===
  ```

---

## Quality Gates

All must pass before marking Phase 1.2 complete:

- [ ] **Build**: `npm run build` passes without errors
- [ ] **Type Check**: `npm run type-check` passes
- [ ] **Lint**: `npm run lint` passes
- [ ] **Unit Tests**: All unit tests pass with >90% coverage
- [ ] **Integration Tests**: All integration tests pass (with service running)
- [ ] **Manual Test**: Manual test script runs successfully
- [ ] **Imports**: Can import Crawl4AIFetcher from fetcher module
- [ ] **Documentation**: Usage documented and `.env.example` updated

---

## Troubleshooting

### Build Fails

**Issue**: TypeScript compilation errors

**Solutions**:
- Check all imports are correct
- Verify ContentFetcher interface is imported
- Ensure all types are properly defined
- Run `npm install` to ensure dependencies

### Tests Fail

**Issue**: Unit tests failing

**Solutions**:
- Check mocks are set up correctly (vi.mock)
- Verify test data matches expected format
- Check error messages match test assertions
- Review test implementation vs code

**Issue**: Integration tests failing

**Solutions**:
- Verify Python service is running: `curl http://localhost:8001/health`
- Check service logs: `docker-compose logs -f`
- Ensure network connectivity
- Verify service URL matches (localhost:8001)

### Service Not Available

**Issue**: "Crawl4AI service is not available"

**Solutions**:
- Start service: `cd services/crawl4ai && docker-compose up -d`
- Check status: `docker ps | grep crawl4ai`
- Check health: `curl http://localhost:8001/health`
- Review logs: `docker-compose logs -f`

### Import Errors

**Issue**: Cannot import Crawl4AIFetcher

**Solutions**:
- Verify barrel exports in `crawl4ai/index.ts`
- Check `fetcher/index.ts` includes `export * from "./crawl4ai"`
- Rebuild: `npm run build`
- Check tsconfig.json includes src directory

---

## Post-Implementation

### Code Review

- [ ] Review code follows TypeScript best practices
- [ ] Error handling is comprehensive
- [ ] Logging is appropriate
- [ ] No console.log in production code (use logger)
- [ ] No hardcoded values (use config)
- [ ] Types are properly defined (no `any`)

### Performance

- [ ] Health check completes in reasonable time (<5s)
- [ ] Fetch operations respect timeout
- [ ] No memory leaks
- [ ] Circuit breaker working correctly

### Documentation

- [ ] Code has JSDoc comments
- [ ] Usage examples are clear
- [ ] Error messages are actionable
- [ ] Configuration is documented

---

## Final Checklist

Before marking Phase 1.2 as COMPLETE:

### Code Quality
- [ ] All files created and in correct locations
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] No linting errors (`npm run lint`)
- [ ] Build successful (`npm run build`)
- [ ] No `console.log` statements (use `logger`)
- [ ] No `any` types in public API
- [ ] All imports resolve correctly

### Testing
- [ ] Unit tests pass (>90% coverage)
- [ ] Integration tests pass
- [ ] Manual test successful
- [ ] All error paths tested
- [ ] Edge cases covered

### Documentation
- [ ] Code has JSDoc comments
- [ ] Usage examples provided
- [ ] `.env.example` updated
- [ ] Troubleshooting guide available

### Functionality
- [ ] Can fetch real web pages
- [ ] Returns markdown correctly
- [ ] Handles errors gracefully
- [ ] Circuit breaker works
- [ ] Service availability detected
- [ ] Cancellation works via AbortSignal

### Integration
- [ ] Exports work correctly
- [ ] Compatible with ContentFetcher interface
- [ ] Works with existing pipelines
- [ ] No breaking changes to existing code

---

## Completion

When all checkboxes are checked:

✅ **Phase 1.2 is COMPLETE!**

**Next Steps**:
1. Create PR for review (if applicable)
2. Deploy to staging environment
3. Monitor circuit breaker state
4. Consider optional enhancements (AutoDetectFetcher integration, etc.)

---

## Time Tracking

**Estimated Time**: 2.5 hours

**Actual Time Breakdown**:
- Configuration: _____ min (est: 5 min)
- Crawl4AIFetcher: _____ min (est: 30 min)
- Exports: _____ min (est: 5 min)
- Unit Tests: _____ min (est: 45 min)
- Integration Tests: _____ min (est: 30 min)
- Documentation: _____ min (est: 15 min)
- Verification: _____ min (est: 15 min)

**Total Actual**: _____ min

---

Last Updated: 2025-11-08
