# Testing Strategy - Phase 1.2

## Overview

Comprehensive testing strategy for Crawl4AI TypeScript integration, covering unit tests, integration tests, and manual testing.

---

## Test Levels

### 1. Unit Tests

**Purpose**: Test individual components in isolation with mocked dependencies.

**Coverage Target**: >90%

**Files to Test**:
- Crawl4AIFetcher.ts

**Test Framework**:
- Vitest
- Mock: Crawl4AIClient

**Key Test Cases**:

#### canFetch()
- ✓ Returns true for HTTP URLs
- ✓ Returns true for HTTPS URLs
- ✓ Returns false for file:// URLs
- ✓ Returns false for other protocols

#### fetch() - Success Cases
- ✓ Fetches content successfully
- ✓ Uses fitMarkdown when available
- ✓ Falls back to rawMarkdown
- ✓ Falls back to markdown
- ✓ Uses final URL from metadata
- ✓ Returns correct RawContent structure

#### fetch() - Error Cases
- ✓ Throws when service unavailable
- ✓ Throws when circuit breaker open
- ✓ Throws when Crawl4AI returns error
- ✓ Throws when content is empty
- ✓ Handles cancellation via AbortSignal
- ✓ Re-throws ScraperErrors correctly
- ✓ Wraps unknown errors in ScraperError

#### isAvailable()
- ✓ Returns true when service healthy
- ✓ Returns false when service down

#### getCircuitState()
- ✓ Returns circuit state from client

**Example Test**:

```typescript
describe("fetch - error handling", () => {
  it("should throw error when service is unavailable", async () => {
    mockClient.isAvailable.mockResolvedValue(false);
    mockClient.getCircuitState.mockReturnValue({
      state: "closed",
      failureCount: 0,
      lastFailureTime: 0,
    });

    await expect(fetcher.fetch("https://example.com")).rejects.toThrow(
      ScraperError,
    );
    await expect(fetcher.fetch("https://example.com")).rejects.toThrow(
      /service is not available/i,
    );
  });
});
```

---

### 2. Integration Tests

**Purpose**: Test real communication with Crawl4AI Python service.

**Prerequisites**: Crawl4AI service running at http://localhost:8001

**Files to Test**:
- Crawl4AIFetcher.integration.test.ts

**Test Strategy**:
- Tests skip gracefully if service unavailable
- Use real network requests to test URLs
- Verify end-to-end functionality
- Test real redirect handling

**Key Test Cases**:

#### Service Communication
- ✓ Health check works correctly
- ✓ Fetch real webpage content
- ✓ Handle redirects correctly
- ✓ Return circuit breaker state

#### Real-World Scenarios
- ✓ Fetch example.com successfully
- ✓ Handle HTTPS redirect from HTTP
- ✓ Extract meaningful markdown
- ✓ Preserve metadata correctly

**Example Test**:

```typescript
it("should fetch real webpage content", async () => {
  if (!isServiceAvailable) {
    console.log("Skipping - service not available");
    return;
  }

  const url = "https://example.com";
  const result = await fetcher.fetch(url);

  expect(result).toBeDefined();
  expect(result.mimeType).toBe("text/markdown");
  expect(result.content).toBeInstanceOf(Buffer);
  expect(result.content.length).toBeGreaterThan(0);

  const markdown = result.content.toString("utf-8");
  expect(markdown).toContain("Example Domain");
}, 30000); // 30s timeout
```

**Running Integration Tests**:

```bash
# 1. Start Python service
cd services/crawl4ai
docker-compose up -d

# 2. Verify service
curl http://localhost:8001/health

# 3. Run integration tests
npm test Crawl4AIFetcher.integration.test.ts
```

---

### 3. Pipeline Integration Tests

**Purpose**: Verify Crawl4AIFetcher output works with existing pipelines.

**Test File**: Create `Crawl4AIFetcher.pipeline.test.ts`

**Test Cases**:

#### MarkdownPipeline Integration
- ✓ MarkdownPipeline accepts Crawl4AI output
- ✓ Content processes through middleware
- ✓ Links extracted correctly
- ✓ Metadata preserved

**Example Test**:

```typescript
import { Crawl4AIFetcher } from "./Crawl4AIFetcher";
import { MarkdownPipeline } from "../../pipelines/MarkdownPipeline";

it("should work with MarkdownPipeline", async () => {
  const fetcher = new Crawl4AIFetcher();
  const pipeline = new MarkdownPipeline();

  const rawContent = await fetcher.fetch("https://example.com");

  expect(pipeline.canProcess(rawContent)).toBe(true);

  const processed = await pipeline.process(rawContent, {
    url: "https://example.com",
    maxPages: 1,
  });

  expect(processed.textContent).toBeDefined();
  expect(processed.textContent.length).toBeGreaterThan(0);
});
```

---

### 4. Manual Testing

**Purpose**: Verify functionality in real-world scenarios.

**Test Script**: Create `/home/mp/Workspace/scrapegoat/scripts/test-crawl4ai-manual.ts`

```typescript
import { Crawl4AIFetcher } from "./src/scraper/fetcher";
import { logger } from "./src/utils/logger";

async function testCrawl4AI() {
  const fetcher = new Crawl4AIFetcher();

  console.log("=== Crawl4AI Manual Test ===\n");

  // Test 1: Service availability
  console.log("1. Checking service availability...");
  const available = await fetcher.isAvailable();
  console.log(`   Service available: ${available}\n`);

  if (!available) {
    console.error("❌ Service not available. Please start the service:");
    console.error("   cd services/crawl4ai && docker-compose up -d");
    return;
  }

  // Test 2: Circuit breaker state
  console.log("2. Circuit breaker state:");
  const state = fetcher.getCircuitState();
  console.log(`   State: ${state.state}`);
  console.log(`   Failure count: ${state.failureCount}`);
  console.log(`   Last failure: ${state.lastFailureTime}\n`);

  // Test 3: Fetch example.com
  console.log("3. Fetching https://example.com...");
  const startTime = Date.now();
  const result = await fetcher.fetch("https://example.com");
  const duration = Date.now() - startTime;

  console.log(`   ✓ Success in ${duration}ms`);
  console.log(`   Content length: ${result.content.length} bytes`);
  console.log(`   MIME type: ${result.mimeType}`);
  console.log(`   Final URL: ${result.source}`);
  console.log(`   Charset: ${result.charset}\n`);

  // Test 4: Markdown content preview
  console.log("4. Markdown preview (first 200 chars):");
  const markdown = result.content.toString("utf-8");
  console.log(`   ${markdown.substring(0, 200)}...\n`);

  // Test 5: Redirect handling
  console.log("5. Testing redirect handling (http -> https)...");
  const redirectResult = await fetcher.fetch("http://example.com");
  console.log(`   Original URL: http://example.com`);
  console.log(`   Final URL: ${redirectResult.source}`);
  console.log(`   Redirect handled: ${redirectResult.source.startsWith("https://")}\n`);

  console.log("=== All tests passed! ===");
}

testCrawl4AI().catch((error) => {
  console.error("\n❌ Test failed:");
  console.error(error);
  process.exit(1);
});
```

**Run**:
```bash
npx tsx scripts/test-crawl4ai-manual.ts
```

---

## Test Data

### Test URLs

**Reliable Test URLs**:
- https://example.com - Simple, always available
- https://httpbin.org/html - Returns HTML for testing
- https://httpbin.org/redirect/1 - Tests redirect handling
- https://www.wikipedia.org - Complex real-world site

**Do NOT Use**:
- Sites with aggressive anti-bot (will fail intermittently)
- Sites with rate limiting
- Sites that require authentication
- Sites with unstable content

---

## Error Simulation Tests

**Test File**: `Crawl4AIFetcher.error-simulation.test.ts`

**Purpose**: Simulate various error conditions.

**Test Cases**:

#### Network Errors
```typescript
it("should handle network timeout", async () => {
  const fetcher = new Crawl4AIFetcher();

  await expect(
    fetcher.fetch("https://example.com", { timeout: 1 }) // 1ms timeout
  ).rejects.toThrow(ScraperError);
});
```

#### Service Errors
```typescript
it("should handle service returning error", async () => {
  // Mock client to return error response
  mockClient.crawl.mockResolvedValue({
    success: false,
    error: {
      code: "TIMEOUT",
      message: "Crawl timed out",
    },
  });

  await expect(fetcher.fetch("https://example.com")).rejects.toThrow(
    /TIMEOUT/
  );
});
```

#### Circuit Breaker
```typescript
it("should open circuit after failures", async () => {
  // Simulate 5 consecutive failures
  mockClient.isAvailable.mockResolvedValue(false);

  for (let i = 0; i < 5; i++) {
    try {
      await fetcher.fetch("https://example.com");
    } catch (e) {
      // Expected
    }
  }

  const state = fetcher.getCircuitState();
  expect(state.state).toBe("open");
  expect(state.failureCount).toBeGreaterThanOrEqual(5);
});
```

---

## Performance Testing

**Test File**: `Crawl4AIFetcher.performance.test.ts`

**Purpose**: Verify performance characteristics.

**Test Cases**:

#### Response Time
```typescript
it("should complete health check within 5s", async () => {
  const fetcher = new Crawl4AIFetcher();

  const start = Date.now();
  await fetcher.isAvailable();
  const duration = Date.now() - start;

  expect(duration).toBeLessThan(5000);
});
```

#### Concurrent Requests
```typescript
it("should handle concurrent requests", async () => {
  const fetcher = new Crawl4AIFetcher();

  const promises = Array(5)
    .fill(null)
    .map(() => fetcher.fetch("https://example.com"));

  const results = await Promise.all(promises);

  expect(results).toHaveLength(5);
  results.forEach((result) => {
    expect(result.mimeType).toBe("text/markdown");
  });
}, 60000); // 60s timeout for 5 requests
```

---

## Continuous Integration

### CI Configuration

**File**: `.github/workflows/test.yml` (or similar)

**Add to CI pipeline**:

```yaml
- name: Start Crawl4AI Service
  run: |
    cd services/crawl4ai
    docker-compose up -d

    # Wait for service to be ready
    timeout 30 bash -c 'until curl -f http://localhost:8001/health; do sleep 1; done'

- name: Run Unit Tests
  run: npm test -- Crawl4AIFetcher.test.ts

- name: Run Integration Tests
  run: npm test -- Crawl4AIFetcher.integration.test.ts

- name: Stop Crawl4AI Service
  run: |
    cd services/crawl4ai
    docker-compose down
```

---

## Test Coverage Requirements

**Minimum Coverage**: 90%

**Coverage Report**:
```bash
npm run test:coverage
```

**Coverage Breakdown**:
- Statements: >90%
- Branches: >85%
- Functions: >90%
- Lines: >90%

**Excluded from Coverage**:
- Type definitions
- Test files
- Mock implementations

---

## Regression Testing

**Purpose**: Ensure changes don't break existing functionality.

**Strategy**:
1. Run full test suite before changes
2. Run full test suite after changes
3. Compare results

**Commands**:
```bash
# Before changes
npm test > test-results-before.txt

# After changes
npm test > test-results-after.txt

# Compare
diff test-results-before.txt test-results-after.txt
```

---

## Test Maintenance

### When to Update Tests

1. **New Features**: Add tests for new functionality
2. **Bug Fixes**: Add regression test for the bug
3. **API Changes**: Update affected tests
4. **Dependencies**: Re-run tests after dependency updates

### Test Review Checklist

- [ ] Tests cover happy path
- [ ] Tests cover error cases
- [ ] Tests cover edge cases
- [ ] Mocks are appropriate
- [ ] Timeouts are reasonable
- [ ] Tests are deterministic (no flakiness)
- [ ] Tests clean up resources
- [ ] Tests have descriptive names

---

## Debugging Failed Tests

### Common Issues

**Integration tests fail**:
1. Check service is running: `curl http://localhost:8001/health`
2. Check logs: `docker-compose logs -f`
3. Verify network connectivity
4. Check firewall settings

**Unit tests fail**:
1. Check mocks are set up correctly
2. Verify test data is valid
3. Check for race conditions
4. Review error messages carefully

**Flaky tests**:
1. Add appropriate timeouts
2. Use deterministic test data
3. Avoid time-based assertions
4. Clean up resources properly

---

## Test Documentation

### Test File Structure

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("Crawl4AIFetcher", () => {
  // Setup
  beforeEach(() => {
    // Initialize
  });

  afterEach(() => {
    // Cleanup
  });

  describe("feature group", () => {
    it("should do something specific", () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

### Test Naming Convention

**Pattern**: `should <expected behavior> when <condition>`

**Examples**:
- "should return true for HTTP URLs"
- "should throw error when service is unavailable"
- "should prefer fitMarkdown over rawMarkdown"

---

Last Updated: 2025-11-08
