# Migration Guide: Playwright Removal (v2.0.0)

This guide helps you migrate from Scrapegoat v1.x (with Playwright) to v2.0.0 (Crawl4AI-only).

## Overview

Version 2.0.0 removes Playwright as a content fetcher and consolidates on Crawl4AI as the sole browser automation provider. This change:

- Reduces dependency size by 65MB (11%)
- Simplifies the codebase by removing 973 lines of middleware code
- Provides a more consistent and feature-rich browser automation experience
- Eliminates the need for Playwright browser installation and management

## Breaking Changes

### 1. API Changes

#### Removed: `ScrapeMode` Enum

**Before (v1.x):**
```typescript
import { ScrapeMode } from './scraper/types';

const options = {
  scrapeMode: ScrapeMode.Playwright,
  // ...
};
```

**After (v2.0.0):**
```typescript
const options = {
  fetcher: 'crawl4ai',
  // ...
};
```

#### Removed: `scrapeMode` Parameter

The `scrapeMode` parameter has been completely removed from all APIs. Use the `fetcher` parameter instead.

**Before (v1.x):**
```typescript
// CLI
scrapegoat scrape --url https://example.com --scrape-mode playwright

// TypeScript API
pipeline.process(url, { scrapeMode: ScrapeMode.Playwright })
```

**After (v2.0.0):**
```typescript
// CLI
scrapegoat scrape --url https://example.com --fetcher crawl4ai

// TypeScript API
pipeline.process(url, { fetcher: 'crawl4ai' })
```

#### Deprecated: `fetcher: 'browser'`

The `'browser'` fetcher type has been removed. The system will automatically redirect to `'crawl4ai'` with a deprecation warning.

**Migration:**
```typescript
// Before (v1.x)
const options = { fetcher: 'browser' };

// After (v2.0.0) - automatically redirected
const options = { fetcher: 'browser' }; // ⚠️  Logs warning, uses 'crawl4ai'

// Recommended (v2.0.0)
const options = { fetcher: 'crawl4ai' }; // ✅ No warning
```

### 2. Type Changes

#### `FetcherType` Union

**Before (v1.x):**
```typescript
type FetcherType = "auto" | "http" | "browser" | "crawl4ai" | "file";
```

**After (v2.0.0):**
```typescript
type FetcherType = "auto" | "http" | "crawl4ai" | "file";
```

#### `ScraperOptions` Interface

**Before (v1.x):**
```typescript
interface ScraperOptions {
  scrapeMode?: ScrapeMode;
  fetcher?: FetcherType;
  // ...
}
```

**After (v2.0.0):**
```typescript
interface ScraperOptions {
  fetcher?: FetcherType; // 'browser' removed from union type
  crawl4ai?: Crawl4AIOptions; // Now references Crawl4AIOptions interface
  // ...
}
```

### 3. Removed Classes and Files

The following classes and files have been removed:

- `BrowserFetcher` (src/scraper/fetcher/BrowserFetcher.ts) - 142 lines
- `HtmlPlaywrightMiddleware` (src/scraper/middleware/HtmlPlaywrightMiddleware.ts) - 831 lines
- `HtmlPlaywrightMiddleware.test.ts` - ~500 lines

### 4. Environment Variables

The following Playwright-specific environment variables are no longer used:

- `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` - removed
- `PLAYWRIGHT_LAUNCH_ARGS` - removed

Crawl4AI handles browser automation through its own Docker service.

### 5. CLI Commands

#### `scrape` Command

**Before (v1.x):**
```bash
scrapegoat scrape --url https://example.com --scrape-mode playwright
```

**After (v2.0.0):**
```bash
scrapegoat scrape --url https://example.com --fetcher crawl4ai
```

#### `fetch-url` Command

**Before (v1.x):**
```bash
scrapegoat fetch-url https://example.com --scrape-mode fetch
```

**After (v2.0.0):**
```bash
scrapegoat fetch-url https://example.com --fetcher http
```

### 6. Web UI Changes

- Removed "Browser" option from fetcher selector dropdown
- Removed "Scrape Mode" section entirely
- Added comprehensive Crawl4AI configuration options:
  - Content Enhancement: enableScreenshot, screenshotMode, enableMedia, enableLinks
  - Advanced Settings: waitFor, waitForTimeout, customJs, cacheMode, headers

## Migration Paths

### For Application Code

1. **Search and replace** `ScrapeMode` imports:
   ```bash
   # Find all ScrapeMode imports
   grep -r "import.*ScrapeMode" src/

   # Remove the imports and update code
   ```

2. **Update scrapeMode to fetcher**:
   ```typescript
   // Before
   const options = { scrapeMode: ScrapeMode.Playwright };

   // After
   const options = { fetcher: 'crawl4ai' };
   ```

3. **Update fetcher values**:
   - `ScrapeMode.Playwright` → `fetcher: 'crawl4ai'`
   - `ScrapeMode.Fetch` → `fetcher: 'http'`
   - `ScrapeMode.Auto` → `fetcher: 'auto'` or omit (default)
   - `fetcher: 'browser'` → `fetcher: 'crawl4ai'`

### For CLI Usage

1. **Update command flags**:
   ```bash
   # Before
   --scrape-mode playwright

   # After
   --fetcher crawl4ai
   ```

2. **Update fetcher values**:
   - `--scrape-mode playwright` → `--fetcher crawl4ai`
   - `--scrape-mode fetch` → `--fetcher http`
   - `--scrape-mode auto` → `--fetcher auto` or omit (default)

### For Web UI Usage

1. **Fetcher selection**:
   - Old "Browser" option → Use "Crawl4AI" instead
   - "Scrape Mode" dropdown → Use "Fetcher" dropdown

2. **New Crawl4AI options** available:
   - Enable/disable screenshots (default: enabled)
   - Screenshot mode: viewport or fullpage (default: fullpage)
   - Enable/disable media extraction (default: enabled)
   - Enable/disable link extraction (default: enabled)
   - Advanced settings: waitFor, waitForTimeout, customJs, cacheMode, headers

### For Test Code

1. **Update test imports**:
   ```typescript
   // Before
   import { ScrapeMode } from '../types';

   // After
   // No import needed - use string literals
   ```

2. **Update test options**:
   ```typescript
   // Before
   const options = { scrapeMode: ScrapeMode.Fetch };

   // After
   const options = { fetcher: 'http' };
   ```

## Database Migration

A database migration is included to update existing data:

**Migration: 013-remove-browser-fetcher.sql**

This migration:
1. Updates all `pages` table rows where `fetcher_type = 'browser'` to `fetcher_type = 'crawl4ai'`
2. Updates the `fetcher_type` column comment to reflect valid types

**Running the migration:**

The migration runs automatically when you start the server. To run manually:

```bash
# Using CLI
scrapegoat migrate

# Using Docker
docker exec scrapegoat-db psql -U postgres -d scrapegoat -f /migrations/013-remove-browser-fetcher.sql
```

**Verification:**

After migration, verify no 'browser' entries remain:

```sql
SELECT COUNT(*) FROM pages WHERE fetcher_type = 'browser';
-- Should return 0
```

## Backward Compatibility

### Automatic Redirection

The system includes automatic backward compatibility for `fetcher: 'browser'`:

```typescript
// v2.0.0 automatically redirects to 'crawl4ai'
const options = { fetcher: 'browser' as any };

// Logs warning:
// "fetcher='browser' is deprecated and has been removed.
//  Using 'crawl4ai' instead. Please update your code to use
//  fetcher='crawl4ai'."
```

This allows existing code to continue working while you migrate.

### Config Interface Preservation

The `BrowserFetcherConfig` interface is preserved in the config schema for backward compatibility:

```typescript
// Still valid in config.ts
export interface BrowserFetcherConfig {
  timeout: number;
  maxRetries: number;
}
```

This ensures configuration files don't break during migration.

## Crawl4AI Feature Comparison

Crawl4AI provides all Playwright features plus additional capabilities:

| Feature                    | Playwright | Crawl4AI |
| -------------------------- | ---------- | -------- |
| JavaScript rendering       | ✅         | ✅       |
| Screenshot capture         | ✅         | ✅       |
| Custom JavaScript          | ✅         | ✅       |
| Dynamic content waiting    | ✅         | ✅       |
| Media extraction           | ❌         | ✅       |
| Link extraction            | ❌         | ✅       |
| AI-optimized processing    | ❌         | ✅       |
| Cache control              | ❌         | ✅       |
| Custom headers             | ✅         | ✅       |
| Session management         | ✅         | ✅       |

## Enhanced Crawl4AI Options (v2.0.0)

Version 2.0.0 adds comprehensive Crawl4AI configuration options:

### Content Enhancement Options

```typescript
interface Crawl4AIOptions {
  /** Enable screenshot capture (default: true) */
  enableScreenshot?: boolean;

  /** Screenshot mode: 'viewport' or 'fullpage' (default: 'fullpage') */
  screenshotMode?: 'viewport' | 'fullpage';

  /** Enable media extraction (images, videos) (default: true) */
  enableMedia?: boolean;

  /** Enable link extraction (default: true) */
  enableLinks?: boolean;

  // ... other options
}
```

### Advanced Settings

```typescript
interface Crawl4AIOptions {
  /** CSS selector to wait for before processing (default: none) */
  waitFor?: string;

  /** Maximum time to wait in milliseconds (default: 30000) */
  waitForTimeout?: number;

  /** Custom JavaScript to execute on page (default: none) */
  customJs?: string;

  /** Cache mode: 'fresh' | 'enabled' | 'disabled' | 'bypass' (default: 'fresh') */
  cacheMode?: 'fresh' | 'enabled' | 'disabled' | 'bypass';

  /** Custom HTTP headers as JSON object (default: none) */
  headers?: Record<string, string>;
}
```

## Performance Impact

The migration provides several performance benefits:

- **Dependency size**: -65MB (11% reduction)
- **Code complexity**: -973 lines of middleware removed
- **Build time**: Faster compilation without Playwright types
- **Installation time**: No browser download required

## Troubleshooting

### Issue: Code references `ScrapeMode`

**Error:**
```
Cannot find name 'ScrapeMode'
```

**Solution:**
Remove the `ScrapeMode` import and use string literals:
```typescript
// Before
import { ScrapeMode } from './types';
const options = { scrapeMode: ScrapeMode.Playwright };

// After
const options = { fetcher: 'crawl4ai' };
```

### Issue: Tests failing with `scrapeMode` property

**Error:**
```
Object literal may only specify known properties, and 'scrapeMode' does not exist
```

**Solution:**
Replace `scrapeMode` with `fetcher`:
```typescript
// Before
const options = { scrapeMode: ScrapeMode.Fetch };

// After
const options = { fetcher: 'http' };
```

### Issue: Database still has 'browser' entries

**Solution:**
Run the migration manually:
```sql
UPDATE pages SET fetcher_type = 'crawl4ai' WHERE fetcher_type = 'browser';
```

### Issue: Deprecation warnings in logs

**Warning:**
```
fetcher="browser" is deprecated and has been removed. Using "crawl4ai" instead.
```

**Solution:**
Update your code to use `fetcher: 'crawl4ai'` instead of `fetcher: 'browser'`.

## Timeline and Support

- **v2.0.0**: Playwright removed, Crawl4AI as sole provider
- **Deprecation warnings**: Will remain for 2-3 minor versions
- **Breaking change**: `fetcher: 'browser'` will be removed in v3.0.0

## Need Help?

If you encounter issues during migration:

1. Check the [WORKLOG.md](WORKLOG.md) for detailed implementation notes
2. Review the [CHANGELOG.md](CHANGELOG.md) for complete changes
3. Open an issue on GitHub with:
   - Your current configuration
   - Error messages or logs
   - Migration path you're attempting

## Summary

Migration from v1.x to v2.0.0 requires:

1. ✅ Remove all `ScrapeMode` imports
2. ✅ Replace `scrapeMode` with `fetcher` in all code
3. ✅ Update `fetcher: 'browser'` to `fetcher: 'crawl4ai'`
4. ✅ Update CLI flags from `--scrape-mode` to `--fetcher`
5. ✅ Run database migration 013
6. ✅ Remove Playwright environment variables
7. ✅ Update Web UI usage to use new Crawl4AI options

The migration is designed to be straightforward, with automatic redirection for backward compatibility during the transition period.
