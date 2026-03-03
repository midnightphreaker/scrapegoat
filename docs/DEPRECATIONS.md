# Deprecation Warnings

This document lists all deprecated APIs in Scrapegoat and their migration paths.

## Deprecated Options

### 1. `useCrawl4AI` Option

**Status:** Deprecated
**Removed In:** Future version
**Replacement:** `fetcher: 'crawl4ai'` or `fetcher: 'auto'`

**Description:**
The `useCrawl4AI` boolean flag has been deprecated in favor of the more explicit `fetcher` option. This provides better type safety and clearer intent.

**Migration Guide:**

#### Before (Deprecated)
```typescript
// Using useCrawl4AI flag
const result = await fetch(url, {
  useCrawl4AI: true,
  crawl4ai: {
    screenshot: true,
  }
});
```

#### After (Recommended)
```typescript
// Explicit fetcher selection
const result = await fetch(url, {
  fetcher: 'crawl4ai',
  crawl4ai: {
    screenshot: true,
  }
});

// OR for auto-detection with fallback
const result = await fetch(url, {
  fetcher: 'auto',
  crawl4ai: {
    screenshot: true,
  }
});
```

**Runtime Warning:**
```
The useCrawl4AI option is deprecated and will be removed in a future version.
Please use fetcher="crawl4ai" or fetcher="auto" instead.
Example: { fetcher: "crawl4ai" } or { fetcher: "auto" }
```

**Affected Files:**
- `src/scraper/types.ts` - `ScraperOptions.useCrawl4AI`
- `src/scraper/fetcher/types.ts` - `FetchOptions.useCrawl4AI`
- `src/store/types.ts` - `VersionScraperOptions.useCrawl4AI`

---

### 2. `stealthMode` Option

**Status:** Deprecated
**Removed In:** Future version
**Replacement:** `browser.enableStealth`

**Description:**
The `stealthMode` option has been deprecated in favor of the more explicit `browser.enableStealth` configuration. This aligns with the v0.8.0 Crawl4AI API structure.

**Migration Guide:**

#### Before (Deprecated)
```typescript
const result = await fetch(url, {
  crawl4ai: {
    stealthMode: 'advanced', // 'disabled' | 'basic' | 'advanced'
  }
});
```

#### After (Recommended)
```typescript
const result = await fetch(url, {
  crawl4ai: {
    browserType: 'chromium',
    browser: {
      enableStealth: true, // Boolean instead of enum
    }
  }
});
```

**Runtime Warning:**
```
The crawl4ai.stealthMode option is deprecated and will be removed in a future version.
Please use browser.enableStealth instead.
Example: { crawl4ai: { browser: { enableStealth: true } } }
```

**Affected Files:**
- `src/scraper/fetcher/types.ts` - `Crawl4AIOptions.stealthMode`
- `src/scraper/fetcher/crawl4ai/types.ts` - `Crawl4AIConfig.stealthMode`

---

### 3. `fetcher: 'browser'` Option

**Status:** Deprecated (Removed)
**Removed In:** Current version
**Replacement:** `fetcher: 'crawl4ai'`

**Description:**
The `'browser'` fetcher type has been removed and replaced with `'crawl4ai'`. This provides more accurate naming since the fetcher uses the Crawl4AI Python service.

**Migration Guide:**

#### Before (Deprecated)
```typescript
const result = await fetch(url, {
  fetcher: 'browser',
});
```

#### After (Recommended)
```typescript
const result = await fetch(url, {
  fetcher: 'crawl4ai',
});
```

**Runtime Warning:**
```
fetcher="browser" is deprecated and has been removed.
Using "crawl4ai" instead.
Please update your code to use fetcher="crawl4ai".
```

**Affected Files:**
- `src/scraper/fetcher/AutoDetectFetcher.ts` - Runtime warning and automatic redirection

---

### 4. `hooks` Option

**Status:** Not Supported
**Reason:** Security and performance
**Alternative:** Server-side hooks or `customJs` option

**Description:**
Hooks are not supported via the client API. They must be implemented server-side in the Python crawler service.

**Alternatives:**

1. **Use `customJs` for client-side JavaScript execution:**
```typescript
const result = await fetch(url, {
  crawl4ai: {
    customJs: `
      // Your custom JavaScript here
      document.querySelector('.load-more').click();
    `,
  }
});
```

2. **Modify the crawler service directly:**
   - Edit the Python crawler service code to add custom hooks
   - This is the recommended approach for production use cases

**Affected Files:**
- `src/scraper/fetcher/crawl4ai/types.ts` - `HooksConfig` (typed as `never`)

---

## Testing Deprecation Warnings

To test deprecation warnings, run the dedicated test suite:

```bash
npm test -- src/scraper/fetcher/__tests__/deprecationWarnings.test.ts
```

This will verify that:
- Deprecated options trigger appropriate warnings
- New options do not trigger warnings
- Migration guidance is provided in warning messages

---

## Timeline

| Deprecated Option | Deprecated Date | Removal Date |
|-------------------|-----------------|--------------|
| `useCrawl4AI` | 2026-02-04 | TBD |
| `stealthMode` | 2026-02-04 | TBD |
| `fetcher: 'browser'` | 2026-01-XX | 2026-02-04 (Removed) |
| `hooks` | N/A | Not Supported |

---

## Best Practices

1. **Update your code now:** Don't wait for the removal date. Update your code to use the new APIs as soon as possible.

2. **Enable logging:** Set `LOG_LEVEL=WARN` to see deprecation warnings in your logs:
   ```bash
   LOG_LEVEL=WARN npm start
   ```

3. **Test thoroughly:** After migrating, test your code to ensure it works as expected with the new options.

4. **Check the documentation:** Refer to the latest documentation for examples and best practices.

5. **Use TypeScript:** Enable strict TypeScript checking to catch deprecated options at compile time.

---

## Questions or Issues?

If you have questions about these deprecations or need help migrating your code:

1. Check the test suite for examples: `src/scraper/fetcher/__tests__/deprecationWarnings.test.ts`
2. Review the type definitions in `src/scraper/fetcher/types.ts`
3. Open an issue on GitHub for further assistance
