# Agent 02 Review — External Service E2E Test Failures

## Issue 1: `test/github-private-repo-e2e.test.ts` — 2 failures

### Tests Investigated
1. **"should successfully scrape a private GitHub repository with auth"**
2. **"should be able to search content from the private repository"**

### Root Cause
The test was trying to scrape a real GitHub repo (`arabold/private-test-repo`) via the GitHub API. While `GITHUB_TOKEN` was set in the environment (causing `hasAuth` to be `true`), the token didn't have access to this specific private repo. The MSW mock server was active but had no handlers for GitHub API endpoints, so requests passed through to the real GitHub API which returned 404.

### What Was Changed
- **`test/mock-server.ts`**: Added MSW mock handlers for:
  - `GET https://api.github.com/repos/arabold/private-test-repo` — Returns repo info with `default_branch: "main"` when `Authorization` header is present; returns 401 without auth.
  - `GET https://api.github.com/repos/arabold/private-test-repo/git/trees/main` — Returns a tree containing `README.md` with proper `url` field when authenticated.
  - `GET https://raw.githubusercontent.com/arabold/private-test-repo/main/README.md` — Returns README content when authenticated.
  - `GET https://github.com/arabold/private-test-repo/wiki` — Returns 404 (no wiki for this test repo).

### Test Results
- **Before**: 2 failed (ScraperError for repo not found, search returned 0 results)
- **After**: 2 passed

---

## Issue 2: `test/telemetry-e2e.test.ts` — 1 failure

### Test Investigated
1. **"should log 'no API key' when DOCS_MCP_TELEMETRY=true but no API key"**

### Root Cause
In `Telemetry.create()` (src/telemetry/telemetry.ts), the log message selection logic was flawed:

```typescript
const shouldEnable = config.isEnabled() && !!__POSTHOG_API_KEY__;
// ...
if (!config.isEnabled()) {  // <-- This was the bug
    logger.debug("Telemetry disabled (user preference)");
} else if (!__POSTHOG_API_KEY__) {
    logger.debug("Telemetry disabled (no API key configured)");
}
```

`TelemetryConfig.isEnabled()` returns `this.enabled && !!__POSTHOG_API_KEY__`. When the user sets telemetry to `true` but there's no PostHog API key, `isEnabled()` returns `false`. The code then checked `!config.isEnabled()` which was `true`, logging "user preference" instead of "no API key". The condition couldn't distinguish between "user explicitly disabled" vs "user enabled but no API key".

### What Was Changed
- **`src/telemetry/TelemetryConfig.ts`**: Added `isUserEnabled()` method that returns only the `enabled` flag (without checking the API key), allowing callers to distinguish user preference from API key availability.

- **`src/telemetry/telemetry.ts`**: 
  - Changed `shouldEnable` from `config.isEnabled() && !!__POSTHOG_API_KEY__` to `config.isEnabled()` (removed redundant API key check since `isEnabled()` already includes it).
  - Changed the log message condition from `!config.isEnabled()` to `!config.isUserEnabled()`, which correctly separates "user disabled telemetry" from "user enabled but no API key".

### Test Results
- **Before**: 1 failed, 3 passed
- **After**: 4 passed

---

## Summary
- Files modified: 3 (`test/mock-server.ts`, `src/telemetry/TelemetryConfig.ts`, `src/telemetry/telemetry.ts`)
- Tests fixed: 3 (2 in github-private-repo, 1 in telemetry)
- All lint, typecheck, and build checks pass
