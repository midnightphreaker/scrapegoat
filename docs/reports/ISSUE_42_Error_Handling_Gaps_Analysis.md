# Issue #42: Error Handling Gaps - Analysis and Fixes

**Date:** 2025-02-04
**Status:** Analysis Complete
**Priority:** Medium
**Files Affected:**
- `/home/mp/Workspace/claudecode/scrapegoat/src/utils/errors.ts`
- `/home/mp/Workspace/claudecode/scrapegoat/src/scraper/fetcher/crawl4ai/Crawl4AIFetcher.ts`
- `/home/mp/Workspace/claudecode/scrapegoat/src/scraper/fetcher/AutoDetectFetcher.ts`

---

## Executive Summary

The scraper pipeline has generally good error handling with proper try-catch coverage in main async operations. However, several gaps were identified:

1. **Inconsistent error types** - Helper methods throw generic `Error` instead of `ScraperError`
2. **Missing error classes** - No `TimeoutError`, `ValidationError`, or `ServiceUnavailableError`
3. **Silent failures** - Media/link filtering doesn't log skipped items
4. **Incomplete error logging** - `Promise.allSettled()` failures aren't logged

---

## Detailed Findings

### 1. Inconsistent Error Types in Crawl4AIFetcher

**Location:** `src/scraper/fetcher/crawl4ai/Crawl4AIFetcher.ts`

**Issues:**

| Line | Method | Problem | Impact |
|------|--------|---------|--------|
| 392 | `normalizeMediaItem()` | Throws `new Error()` instead of `ScraperError` | Inconsistent error handling, harder to catch specific error types |
| 420 | `normalizeLinkItem()` | Throws `new Error()` instead of `ScraperError` | Same as above |

**Current Code:**
```typescript
private normalizeMediaItem(item: ServiceMediaItem): MediaItem {
  const url = item.url || item.src;
  if (!url) {
    throw new Error(`Media item missing both 'url' and 'src' fields`); // ❌ Generic Error
  }
  // ...
}
```

**Should be:**
```typescript
private normalizeMediaItem(item: ServiceMediaItem): MediaItem {
  const url = item.url || item.src;
  if (!url) {
    throw new ScraperError(
      `Media item missing both 'url' and 'src' fields: ${JSON.stringify(item)}`,
      false
    ); // ✅ ScraperError with context
  }
  // ...
}
```

---

### 2. Missing Error Type Classes

**Location:** `src/utils/errors.ts`

**Missing Classes:**

#### a) TimeoutError
For timeout-specific errors with retry information.

```typescript
class TimeoutError extends ScraperError {
  constructor(
    message: string,
    public readonly timeout?: number,
    cause?: Error
  ) {
    super(message, true, cause); // Timeouts are retryable
    this.name = 'TimeoutError';
  }
}
```

#### b) ValidationError
For input validation failures (not retryable).

```typescript
class ValidationError extends ScraperError {
  constructor(
    public readonly field: string,
    public readonly value: unknown,
    public readonly reason: string
  ) {
    super(`Validation failed for ${field}: ${reason}`, false); // Not retryable
    this.name = 'ValidationError';
  }
}
```

#### c) ServiceUnavailableError
For when external services are unavailable (aligns with circuit breaker).

```typescript
class ServiceUnavailableError extends ScraperError {
  constructor(
    public readonly service: string,
    cause?: Error
  ) {
    super(`Service ${service} is unavailable`, true, cause); // Retryable
    this.name = 'ServiceUnavailableError';
  }
}
```

---

### 3. Silent Failures in Media/Link Filtering

**Location:** `src/scraper/fetcher/crawl4ai/Crawl4AIFetcher.ts`

**Issue:** When media items or links are filtered out due to invalid URLs, no logging occurs.

**Current Code (lines 262-272):**
```typescript
if (
  enableMedia &&
  data.media &&
  Array.isArray(data.media) &&
  data.media.length > 0
) {
  rawContent.media = data.media
    .map((item: ServiceMediaItem) => this.normalizeMediaItem(item))
    .filter((item) => item.url && this.isValidUrl(item.url)); // ❌ Silent filtering
  logger.debug(`Extracted ${rawContent.media.length} media items`); // ❌ Doesn't show filtered count
}
```

**Should be:**
```typescript
if (
  enableMedia &&
  data.media &&
  Array.isArray(data.media) &&
  data.media.length > 0
) {
  const totalMediaItems = data.media.length;
  rawContent.media = data.media
    .map((item: ServiceMediaItem) => this.normalizeMediaItem(item))
    .filter((item) => {
      const isValid = item.url && this.isValidUrl(item.url);
      if (!isValid && item.url) {
        logger.warn(`Filtered out media item with invalid URL: ${item.url}`); // ✅ Log filtered items
      }
      return isValid;
    });

  const filteredCount = totalMediaItems - rawContent.media.length;
  logger.debug(
    `Extracted ${rawContent.media.length} media items${filteredCount > 0 ? ` (${filteredCount} filtered due to invalid URLs)` : ''}`
  ); // ✅ Show filtered count
}
```

---

### 4. Missing Error Logging in AutoDetectFetcher.close()

**Location:** `src/scraper/fetcher/AutoDetectFetcher.ts`

**Issue:** The `close()` method uses `Promise.allSettled()` but doesn't log rejected promises.

**Current Code (lines 189-194):**
```typescript
async close(): Promise<void> {
  await Promise.allSettled([
    this.crawl4aiFetcher.close(),
    // HttpFetcher and FileFetcher don't need explicit cleanup
  ]); // ❌ Failures are silently ignored
}
```

**Should be:**
```typescript
async close(): Promise<void> {
  const results = await Promise.allSettled([
    this.crawl4aiFetcher.close(),
    // HttpFetcher and FileFetcher don't need explicit cleanup
  ]);

  // ✅ Log any cleanup failures
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const fetcherName = index === 0 ? 'Crawl4AIFetcher' : 'Unknown';
      logger.warn(`Failed to close ${fetcherName}: ${result.reason}`);
    }
  });
}
```

---

### 5. Generic Error Throws in AutoDetectFetcher

**Location:** `src/scraper/fetcher/AutoDetectFetcher.ts`

**Issues:**

| Line | Context | Problem |
|------|---------|---------|
| 78 | Unknown fetcher type | Throws generic `Error` |
| 120 | Invalid fetcher for URL | Throws generic `Error` |
| 198 | No suitable fetcher | Throws generic `Error` |

**Should use ScraperError:**
```typescript
// Line 78
throw new ScraperError(`Unknown fetcher type: ${fetcherType}`, false);

// Line 120-122
throw new ScraperError(
  `Fetcher '${options.fetcher}' cannot handle URL: ${source}. ` +
  `Expected ${this.getExpectedProtocol(options.fetcher)} URL. ` +
  `Use 'auto' or choose a compatible fetcher.`,
  false
);

// Line 198
throw new ScraperError(`No suitable fetcher found for URL: ${source}`, false);
```

---

## Positive Findings (Good Practices)

The following areas have excellent error handling that should be maintained:

1. **Crawl4AIClient.ts** - Excellent circuit breaker pattern with proper state management
2. **HttpFetcher.ts** - Comprehensive retry logic with proper error classification
3. **Crawl4AIFetcher.fetch()** - Good try-catch coverage with ScraperError wrapping
4. **AbortSignal handling** - Properly propagated throughout the fetcher chain
5. **Error cause tracking** - Most errors properly track underlying causes

---

## Recommended Fixes Priority

### High Priority
1. ✅ Fix `normalizeMediaItem()` and `normalizeLinkItem()` to throw `ScraperError`
2. ✅ Add logging for filtered media/link items

### Medium Priority
3. ✅ Add missing error type classes (`TimeoutError`, `ValidationError`, `ServiceUnavailableError`)
4. ✅ Fix `AutoDetectFetcher` to throw `ScraperError` instead of generic `Error`
5. ✅ Add error logging in `Promise.allSettled()` results

### Low Priority
6. Consider adding timeout wrapper utility for custom async operations
7. Add error context (URL, attempt number) to more error messages

---

## Testing Recommendations

After implementing fixes, add tests for:

1. Error type consistency - ensure all fetchers throw `ScraperError` subclasses
2. Media/link filtering - verify filtered items are logged
3. Cleanup failures - test `Promise.allSettled()` error logging
4. New error types - unit tests for `TimeoutError`, `ValidationError`, `ServiceUnavailableError`

---

## Related Files (No Changes Needed)

- `src/scraper/fetcher/HttpFetcher.ts` - Already has good error handling
- `src/scraper/fetcher/FileFetcher.ts` - Already has good error handling
- `src/scraper/fetcher/crawl4ai/Crawl4AIClient.ts` - Excellent circuit breaker pattern
- `src/store/errors.ts` - Comprehensive store error types (different domain)

---

## Implementation Checklist

- [ ] Add `TimeoutError`, `ValidationError`, `ServiceUnavailableError` to `src/utils/errors.ts`
- [ ] Update `normalizeMediaItem()` in `Crawl4AIFetcher.ts` to throw `ScraperError`
- [ ] Update `normalizeLinkItem()` in `Crawl4AIFetcher.ts` to throw `ScraperError`
- [ ] Add logging for filtered media items in `Crawl4AIFetcher.ts`
- [ ] Add logging for filtered link items in `Crawl4AIFetcher.ts`
- [ ] Update `AutoDetectFetcher` error throws to use `ScraperError`
- [ ] Add error logging in `AutoDetectFetcher.close()`
- [ ] Export new error types from `src/utils/errors.ts`
- [ ] Add unit tests for new error types
- [ ] Update error handling documentation

---

## Files to Modify

1. `/home/mp/Workspace/claudecode/scrapegoat/src/utils/errors.ts` - Add new error classes
2. `/home/mp/Workspace/claudecode/scrapegoat/src/scraper/fetcher/crawl4ai/Crawl4AIFetcher.ts` - Fix normalization methods
3. `/home/mp/Workspace/claudecode/scrapegoat/src/scraper/fetcher/AutoDetectFetcher.ts` - Fix error types and logging

---

## Verification Steps

After implementing fixes:

1. Run existing test suite: `npm test`
2. Run integration tests: `npm run test:e2e`
3. Check for any new TypeScript errors: `npm run typecheck`
4. Review error logs during normal operation to ensure new logging is helpful
5. Test error scenarios:
   - Invalid media/link items
   - Service unavailability
   - Timeout conditions
   - Cleanup failures

---

## Notes

- The error handling foundation is solid - these are refinements for consistency
- No critical security issues identified
- All identified issues are non-breaking changes
- The circuit breaker pattern in `Crawl4AIClient.ts` is exemplary and should be referenced for other services
