# Integration Strategy: Architecture Decision Records

**Last Updated:** 2025-11-08

This document contains Architecture Decision Records (ADRs) for the Crawl4AI storage pipeline integration.

---

## ADR-001: Feature Flag vs Automatic Detection

**Date:** 2025-11-08
**Status:** Accepted

### Context

We need to decide how Crawl4AI should be selected as the content fetcher for web scraping. There are three main approaches:

1. **Automatic Detection** - Always use Crawl4AI for certain URL patterns or as a fallback
2. **Feature Flag** - Explicit opt-in via `useCrawl4AI` configuration option
3. **Separate Strategy** - Create dedicated `Crawl4AIScraperStrategy` with URL pattern matching

### Decision

**We will use a feature flag approach** with `useCrawl4AI: boolean` in `ScraperOptions`.

### Rationale

**Why Feature Flag:**

1. **Performance Control**
   - Crawl4AI is significantly slower than simple HTTP fetching (2-5x)
   - JavaScript rendering adds 1-3 seconds per page
   - Users should consciously choose this trade-off

2. **Cost Management**
   - If using paid Crawl4AI service (hosted version), costs can add up
   - Automatic usage would create unexpected costs
   - Opt-in prevents cost surprises

3. **Transparency and Control**
   - Clear when Crawl4AI is being used vs standard fetchers
   - Easy to A/B test quality (same URL with/without Crawl4AI)
   - Troubleshooting is clearer (know which fetcher was used)

4. **Persistence and Reproducibility**
   - Flag stored in `scraper_options` JSON in database
   - Can reproduce scraping jobs with exact same configuration
   - Version history shows which fetcher was used

5. **Backward Compatibility**
   - Defaults to `false`, existing workflows unaffected
   - No surprises for users with established scraping pipelines
   - Gradual adoption possible (test on specific libraries first)

**Why NOT Automatic Detection:**

- Crawl4AI is not always better (simple docs don't need JS rendering)
- Performance penalty for all requests unacceptable
- Hard to predict when it would activate (confusing for users)

**Why NOT Separate Strategy:**

- Duplicates code from WebScraperStrategy
- URL pattern matching is fragile and arbitrary
- Harder to maintain (two code paths for web scraping)
- Less flexible (can't easily enable/disable for specific libraries)

### Consequences

**Positive:**
- Users have full control over when Crawl4AI is used
- No unexpected performance degradation or costs
- Clear audit trail in database of fetcher used
- Easy to test and compare Crawl4AI vs standard fetchers

**Negative:**
- Requires users to know about the option (documentation needed)
- Not automatic for sites that might benefit (e.g., SPA documentation)
- Slightly more complex configuration (one more option)

**Mitigations:**
- Comprehensive documentation with examples
- UI could suggest enabling for specific URL patterns
- Future enhancement: Auto-suggest based on URL analysis

### Alternatives Considered

**1. Automatic Fallback Chain**
```
HttpFetcher → [ChallengeError] → BrowserFetcher → [Empty Content] → Crawl4AI
```
- Rejected: Too slow, unpredictable behavior, hard to debug

**2. URL Pattern Whitelist**
```typescript
const crawl4aiDomains = ['docs.react.dev', 'nextjs.org'];
if (crawl4aiDomains.some(d => url.includes(d))) {
  useCrawl4AI = true;
}
```
- Rejected: Brittle, hard to maintain, arbitrary choices

**3. Content Quality Detection**
```typescript
const content = await httpFetcher.fetch(url);
if (contentQuality(content) < threshold) {
  content = await crawl4aiFetcher.fetch(url);  // Retry with Crawl4AI
}
```
- Rejected: Doubles fetch time, complex heuristics, wastes requests

---

## ADR-002: Modify AutoDetectFetcher vs Create New Strategy

**Date:** 2025-11-08
**Status:** Accepted

### Context

We need to decide where to integrate Crawl4AI into the fetcher selection logic. Options:

1. **Modify AutoDetectFetcher** - Add Crawl4AI selection logic to existing fetcher
2. **Create Crawl4AIStrategy** - New scraper strategy that always uses Crawl4AI
3. **Replace AutoDetectFetcher** - Create new fetcher selector with Crawl4AI support

### Decision

**We will modify AutoDetectFetcher** to include Crawl4AI selection logic based on the `useCrawl4AI` flag.

### Rationale

**Why Modify AutoDetectFetcher:**

1. **Minimal Code Changes**
   - Single file modification vs multiple new files
   - Leverages existing fetcher selection infrastructure
   - No changes to strategy layer needed

2. **Consistent Pattern**
   - AutoDetectFetcher already handles fetcher selection
   - Natural place for "which fetcher should I use?" logic
   - Maintains single responsibility (fetcher selection)

3. **Type Safety**
   - `FetchOptions` already exists and is typed
   - Adding `useCrawl4AI?: boolean` is straightforward
   - TypeScript enforces correct usage throughout codebase

4. **Reusable Across Strategies**
   - WebScraperStrategy, GitHubStrategy, etc. can all use it
   - No need to duplicate Crawl4AI logic in each strategy
   - Centralized fetcher selection logic

**Why NOT Create Crawl4AIStrategy:**

- Duplicates 95% of WebScraperStrategy code
- Harder to maintain (two strategies for web scraping)
- Confusing URL pattern matching (when to use which strategy?)
- Violates DRY principle

**Why NOT Replace AutoDetectFetcher:**

- Unnecessary breaking change
- Would affect all existing strategies
- More risk, same outcome

### Consequences

**Positive:**
- Minimal code changes (add Crawl4AI instance, add selection logic)
- All strategies can use Crawl4AI without modification
- Type-safe flag propagation through existing interfaces
- Easy to test (single file, clear responsibilities)

**Negative:**
- AutoDetectFetcher becomes slightly more complex
- Couples AutoDetectFetcher to Crawl4AI configuration

**Mitigations:**
- Keep selection logic simple (just check flag)
- Document the selection logic clearly
- Unit tests for all fetcher selection paths

### Implementation

**Before (Current):**
```typescript
export class AutoDetectFetcher implements ContentFetcher {
  private readonly httpFetcher = new HttpFetcher();
  private readonly browserFetcher = new BrowserFetcher();
  private readonly fileFetcher = new FileFetcher();

  async fetch(source: string, options?: FetchOptions): Promise<RawContent> {
    if (this.fileFetcher.canFetch(source)) {
      return this.fileFetcher.fetch(source, options);
    }

    if (this.httpFetcher.canFetch(source)) {
      try {
        return await this.httpFetcher.fetch(source, options);
      } catch (error) {
        if (error instanceof ChallengeError) {
          return this.browserFetcher.fetch(source, options);
        }
        throw error;
      }
    }

    throw new Error(`No suitable fetcher found for URL: ${source}`);
  }
}
```

**After (Proposed):**
```typescript
export class AutoDetectFetcher implements ContentFetcher {
  private readonly httpFetcher = new HttpFetcher();
  private readonly browserFetcher = new BrowserFetcher();
  private readonly fileFetcher = new FileFetcher();
  private readonly crawl4aiFetcher = new Crawl4AIFetcher();  // NEW

  async fetch(source: string, options?: FetchOptions): Promise<RawContent> {
    if (this.fileFetcher.canFetch(source)) {
      return this.fileFetcher.fetch(source, options);
    }

    if (this.httpFetcher.canFetch(source)) {
      // NEW: Check for Crawl4AI flag
      if (options?.useCrawl4AI) {
        logger.debug(`Using Crawl4AIFetcher for: ${source}`);
        return this.crawl4aiFetcher.fetch(source, options);
      }

      // Existing logic unchanged
      try {
        return await this.httpFetcher.fetch(source, options);
      } catch (error) {
        if (error instanceof ChallengeError) {
          return this.browserFetcher.fetch(source, options);
        }
        throw error;
      }
    }

    throw new Error(`No suitable fetcher found for URL: ${source}`);
  }
}
```

---

## ADR-003: Fallback Strategy on Crawl4AI Failure

**Date:** 2025-11-08
**Status:** Accepted

### Context

When `useCrawl4AI: true` is set, but Crawl4AI service fails, we need to decide:

1. **Fail the job entirely** - Throw error, job marked as failed
2. **Fallback to HttpFetcher** - Try standard HTTP fetch for that page
3. **Fallback with warning** - Use HttpFetcher but log warning about inconsistency

### Decision

**We will fail the job entirely** when Crawl4AI is requested but unavailable.

### Rationale

**Why Fail Entirely:**

1. **Data Consistency**
   - All pages in a version should use the same fetcher
   - Mixed content quality would be confusing
   - Search results would have inconsistent formatting/quality

2. **Clear User Intent**
   - User explicitly requested Crawl4AI (`useCrawl4AI: true`)
   - Falling back silently violates that intent
   - Better to fail loudly than succeed unexpectedly

3. **Circuit Breaker Already Handles Transient Failures**
   - Crawl4AIClient has built-in retry logic (3 attempts)
   - Circuit breaker handles temporary service issues
   - Real failures are likely persistent (service down, misconfigured)

4. **Easy Recovery**
   - User can retry the job when service is available
   - User can disable `useCrawl4AI` if needed
   - Database tracks failure reason for debugging

**Why NOT Fallback to HttpFetcher:**

- Violates user's explicit configuration
- Creates inconsistent data (some pages Crawl4AI, some not)
- Hard to know which pages used which fetcher
- Search quality would be unpredictable

**Why NOT Partial Success:**

- Complexity in tracking mixed fetcher usage
- Confusing for users (job succeeded but used different fetcher?)
- Hard to reproduce (which pages failed? why?)

### Consequences

**Positive:**
- Clear failure mode (job fails, user knows why)
- Data consistency maintained (all pages same fetcher)
- User intent respected (requested Crawl4AI, won't get HTTP fallback)
- Easy to debug (check Crawl4AI service status)

**Negative:**
- Jobs fail if Crawl4AI service is down
- No graceful degradation for partial availability
- Users must manually disable flag if service unavailable

**Mitigations:**
- Circuit breaker provides clear error messages
- Service health check available (`crawl4aiFetcher.isAvailable()`)
- Documentation recommends checking service before scraping
- Future: UI could auto-check service health before job submission

### Error Handling Flow

```typescript
// Crawl4AIFetcher.fetch()
async fetch(source: string, options?: FetchOptions): Promise<RawContent> {
  // Check service availability
  const isAvailable = await this.client.isAvailable();
  if (!isAvailable) {
    const circuitState = this.client.getCircuitState();
    if (circuitState.state === "open") {
      // Circuit breaker is open - service appears down
      throw new ScraperError(
        `Crawl4AI service circuit breaker is open. Service appears to be unavailable. Try again later.`,
        false
      );
    }
    // Service not available but circuit not open yet
    throw new ScraperError(
      `Crawl4AI service is not available at ${CRAWL4AI_SERVICE_URL}. Ensure the Python service is running.`,
      false
    );
  }

  // Proceed with fetch...
  const response = await this.client.crawl(request, options);

  // Handle errors
  if (!response.success || !response.data) {
    throw new ScraperError(
      `Crawl4AI service returned error: ${response.error?.message}`,
      false
    );
  }

  return rawContent;
}
```

**Job Failure Flow:**

```
1. useCrawl4AI: true in job config
2. AutoDetectFetcher selects Crawl4AIFetcher
3. Crawl4AIFetcher.fetch() throws ScraperError
4. WebScraperStrategy.processItem() catches and re-throws
5. PipelineWorker.executeJob() catches error
6. PipelineManager marks job as FAILED
7. Error message stored in versions.error_message
8. User sees clear error: "Crawl4AI service unavailable"
```

**User Recovery Options:**

```typescript
// Option 1: Retry when service is available
await pipelineManager.retryJob(jobId);

// Option 2: Re-submit without Crawl4AI
await pipelineManager.scrape({
  library: "react",
  version: "18.0.0",
  sourceUrl: "https://react.dev",
  useCrawl4AI: false,  // Disable Crawl4AI
});

// Option 3: Check service health first
const isAvailable = await crawl4aiFetcher.isAvailable();
if (isAvailable) {
  await pipelineManager.scrape({ ..., useCrawl4AI: true });
} else {
  console.log("Crawl4AI service unavailable, using standard fetch");
  await pipelineManager.scrape({ ..., useCrawl4AI: false });
}
```

---

## ADR-004: Database Schema - No Migration Required

**Date:** 2025-11-08
**Status:** Accepted

### Context

We need to track which fetcher was used for scraping and ensure stored content is searchable. Options:

1. **Add `fetcher_type` column** to `pages` table
2. **Store in `scraper_options` JSON** in `versions` table
3. **No schema changes** - existing schema sufficient

### Decision

**No database schema changes required.** Existing schema already supports our needs.

### Rationale

**Existing Schema Already Provides:**

1. **Fetcher Tracking via `scraper_options`**
   ```sql
   -- versions table
   scraper_options TEXT  -- JSON: { "useCrawl4AI": true, ... }
   ```
   - Stores complete scraping configuration
   - Includes `useCrawl4AI` flag
   - Enables reproducible scraping

2. **Content Type Tracking via `content_type`**
   ```sql
   -- pages table
   content_type TEXT  -- "text/markdown" for Crawl4AI
   ```
   - Distinguishes markdown (Crawl4AI) from HTML (HttpFetcher)
   - Used by pipeline for content processing
   - Searchable and filterable

3. **Vector Embeddings Already Supported**
   ```sql
   -- documents table
   embedding VECTOR(1536)  -- pgvector extension
   ```
   - Works with any content source
   - Markdown chunks embedded same as HTML chunks
   - No special handling needed for Crawl4AI content

**Why NOT Add `fetcher_type` Column:**

- Redundant with `scraper_options` JSON
- Would need to maintain sync between `fetcher_type` and `scraper_options`
- Content type (`text/markdown` vs `text/html`) already distinguishes output
- Adds migration complexity for no functional benefit

### Consequences

**Positive:**
- Zero migration risk
- Backward compatible with all existing data
- No database downtime required
- Can deploy immediately

**Negative:**
- Fetcher type not in dedicated column (slightly less convenient for queries)
- Must parse JSON to determine if Crawl4AI was used

**Mitigations:**
- Document how to query for Crawl4AI usage:
  ```sql
  -- Find versions that used Crawl4AI
  SELECT library_id, name, source_url
  FROM versions
  WHERE scraper_options::jsonb->>'useCrawl4AI' = 'true';
  ```

### Data Tracking Example

**Scraping Job:**
```typescript
{
  library: "react",
  version: "18.0.0",
  sourceUrl: "https://react.dev",
  useCrawl4AI: true,
  maxPages: 100
}
```

**Stored in Database:**

```sql
-- versions table
INSERT INTO versions (library_id, name, source_url, scraper_options)
VALUES (
  1,
  '18.0.0',
  'https://react.dev',
  '{"useCrawl4AI":true,"maxPages":100,"maxDepth":3}'
);

-- pages table
INSERT INTO pages (version_id, url, title, content_type)
VALUES (
  101,
  'https://react.dev/reference/react/useState',
  'useState - React',
  'text/markdown'  -- Indicates Crawl4AI output
);

-- documents table
INSERT INTO documents (page_id, content, embedding, metadata)
VALUES (
  5001,
  'useState is a React Hook...',
  '[0.123, -0.456, ...]',
  '{"level":1,"path":"useState"}'
);
```

**Querying Crawl4AI Content:**

```sql
-- Find all libraries using Crawl4AI
SELECT DISTINCT l.name
FROM libraries l
JOIN versions v ON v.library_id = l.id
WHERE v.scraper_options::jsonb->>'useCrawl4AI' = 'true';

-- Find all markdown pages (likely from Crawl4AI)
SELECT p.url, p.title
FROM pages p
WHERE p.content_type = 'text/markdown';

-- Count documents by content type
SELECT p.content_type, COUNT(d.id) as chunk_count
FROM documents d
JOIN pages p ON p.id = d.page_id
GROUP BY p.content_type;
```

---

## Summary

### Decisions Made

| ADR | Decision | Rationale |
|-----|----------|-----------|
| **ADR-001** | Feature flag approach (`useCrawl4AI`) | Performance control, cost management, transparency |
| **ADR-002** | Modify AutoDetectFetcher | Minimal changes, reusable across strategies |
| **ADR-003** | Fail on Crawl4AI unavailability | Data consistency, respect user intent |
| **ADR-004** | No database schema changes | Existing schema sufficient, zero migration risk |

### Key Principles

1. **Explicit Over Implicit** - Feature flag makes Crawl4AI usage clear
2. **Consistency Over Graceful Degradation** - All pages use same fetcher
3. **Simplicity Over Flexibility** - Minimal code changes, leverage existing infrastructure
4. **Backward Compatibility** - No breaking changes, existing workflows unaffected

### Implementation Impact

**Code Changes Required:**
- `src/scraper/types.ts` - Add `useCrawl4AI` to `ScraperOptions`
- `src/store/types.ts` - Add `useCrawl4AI` to `VersionScraperOptions`
- `src/scraper/fetcher/types.ts` - Add `useCrawl4AI` to `FetchOptions`
- `src/scraper/fetcher/AutoDetectFetcher.ts` - Add Crawl4AI selection logic
- `src/scraper/strategies/WebScraperStrategy.ts` - Pass flag through

**Database Changes Required:** NONE

**Testing Required:**
- Unit tests for AutoDetectFetcher selection logic
- Integration test: Crawl4AI → PostgreSQL flow
- Test Crawl4AI service unavailability handling

---

**Next:** See `step-by-step-guide.md` for detailed implementation instructions.
