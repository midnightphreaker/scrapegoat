# Agent 01 Review — Refresh Pipeline E2E Test Failures

## Summary

Fixed all 9 failing HTTP-based tests in `test/refresh-pipeline-e2e.test.ts` by adding a missing nock mock for the `/llms.txt` probe request.

## Root Cause

**File**: `test/refresh-pipeline-e2e.test.ts`

`WebScraperStrategy.scrape()` (line 458 of `src/scraper/strategies/WebScraperStrategy.ts`) calls `probeLlmsTxt()` before every scrape operation. This method fetches `{base_url}/llms.txt` to detect and parse llms.txt metadata files.

The test nock mocks only intercepted the page-specific paths (`/`, `/page1`, `/page2`, etc.) but **never mocked `/llms.txt`**. Since `nock.disableNetConnect()` was not called, the unmocked `/llms.txt` request leaked through to the real network:

- `test-docs.example.com` resolves to a real IP (`159.196.110.226`) 
- The server returns `308 Permanent Redirect` → `https://test-docs.example.com/llms.txt`
- Axios follows the redirect to HTTPS, which either hangs or returns unexpected content
- This causes the scrape job to hang indefinitely, hitting the 30s test timeout

File-based tests were unaffected because `LocalFileStrategy` doesn't call `probeLlmsTxt()`.

## Fix Applied

Added a persistent nock mock for `/llms.txt` returning 404 in the `beforeEach` block:

```typescript
nock(TEST_BASE_URL).persist().get("/llms.txt").reply(404);
```

- **`.persist()`** ensures the mock survives across multiple `scrape()` calls within the same test (initial scrape + refresh)
- **`reply(404)`** makes the probe fail cleanly and quickly — `probeLlmsTxt()` catches the error and returns `null`, proceeding with normal scraping

## Test Results

**Before**: 2/11 passed (file-based only), 9/11 timed out at 30s each
**After**: 11/11 passed in ~8.6s total

| Test | Before | After |
|------|--------|-------|
| should delete documents when a page returns 404 during refresh | TIMEOUT (30s) | PASS (752ms) |
| should update documents when a page has changed content during refresh | TIMEOUT (30s) | PASS (348ms) |
| should skip processing when pages return 304 Not Modified | TIMEOUT (30s) | PASS (289ms) |
| should discover and index new pages during refresh | TIMEOUT (30s) | PASS (372ms) |
| should gracefully handle 404 errors for broken links | TIMEOUT (30s) | PASS (170ms) |
| should continue scraping after encountering multiple 404 errors | TIMEOUT (30s) | PASS (263ms) |
| should handle network timeouts gracefully | TIMEOUT (15s) | PASS (5152ms) |
| should follow redirects and use the final URL for indexing | TIMEOUT (30s) | PASS (215ms) |
| should handle redirect chains during refresh | TIMEOUT (30s) | PASS (455ms) |
| should detect new/modified/deleted files during refresh | PASS | PASS (386ms) |
| should handle unchanged files efficiently | PASS | PASS (191ms) |

## Validation

- Lint: Passed (313 files, no issues)
- Typecheck: Passed
- Build: Passed
- All 11 E2E tests: Passed

## Files Changed

- `test/refresh-pipeline-e2e.test.ts`: Added persistent nock mock for `/llms.txt` in `beforeEach`
