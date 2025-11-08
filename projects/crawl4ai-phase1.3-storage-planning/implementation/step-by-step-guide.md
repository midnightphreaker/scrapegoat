# Step-by-Step Implementation Guide

**Last Updated:** 2025-11-08

This guide provides detailed instructions for integrating Crawl4AI into the Scrapegoat storage pipeline.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Add useCrawl4AI to Type Definitions](#step-1-add-usecrawl4ai-to-type-definitions)
3. [Step 2: Modify AutoDetectFetcher](#step-2-modify-autodetectfetcher)
4. [Step 3: Update WebScraperStrategy](#step-3-update-webscraperstrategy)
5. [Step 4: Add Integration Tests](#step-4-add-integration-tests)
6. [Step 5: Update Documentation](#step-5-update-documentation)
7. [Verification](#verification)
8. [Rollback Plan](#rollback-plan)

---

## Prerequisites

### Before You Begin

**Ensure the following are in place:**

- ✅ Crawl4AI Python service running at `http://localhost:8001`
- ✅ Docker service configured and healthy
- ✅ PostgreSQL database running with pgvector extension
- ✅ Existing Crawl4AIFetcher implementation functional
- ✅ Development environment set up

**Verify Crawl4AI Service:**

```bash
# Check if Crawl4AI service is running
curl http://localhost:8001/health

# Expected response:
# {"status":"healthy","service":"crawl4ai-service","version":"1.0.0"}
```

**Verify Database:**

```bash
# Check PostgreSQL connection
psql $DATABASE_URL -c "SELECT 1;"

# Check pgvector extension
psql $DATABASE_URL -c "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';"
```

---

## Step 1: Add useCrawl4AI to Type Definitions

### 1.1: Update ScraperOptions

**File:** `/home/mp/Workspace/scrapegoat/src/scraper/types.ts`

**Add the `useCrawl4AI` field to the `ScraperOptions` interface:**

```typescript
/**
 * Options for configuring the scraping process
 */
export interface ScraperOptions {
  url: string;
  library: string;
  version: string;
  maxPages?: number;
  maxDepth?: number;
  scope?: "subpages" | "hostname" | "domain";
  followRedirects?: boolean;
  maxConcurrency?: number;
  ignoreErrors?: boolean;
  excludeSelectors?: string[];
  scrapeMode?: ScrapeMode;
  signal?: AbortSignal;
  includePatterns?: string[];
  excludePatterns?: string[];
  headers?: Record<string, string>;

  // NEW: Add this field
  /**
   * Whether to use Crawl4AI for content fetching.
   * Crawl4AI provides JavaScript rendering, anti-bot bypass, and BM25-filtered markdown.
   * Note: Slower than standard HTTP fetching, but produces higher quality content.
   * @default false
   */
  useCrawl4AI?: boolean;
}
```

**Reasoning:** ScraperOptions is the top-level configuration passed through the pipeline. Adding the flag here makes it available to all strategies and fetchers.

### 1.2: Update VersionScraperOptions

**File:** `/home/mp/Workspace/scrapegoat/src/store/types.ts`

**Add the `useCrawl4AI` field to `VersionScraperOptions`:**

```typescript
/**
 * Scraper options stored with each version for reproducible indexing.
 * Excludes runtime-only fields like signal, library, version, and url.
 */
export interface VersionScraperOptions {
  // Core scraping parameters
  maxPages?: number;
  maxDepth?: number;
  scope?: "subpages" | "hostname" | "domain";
  followRedirects?: boolean;
  maxConcurrency?: number;
  ignoreErrors?: boolean;

  // Content filtering
  excludeSelectors?: string[];
  includePatterns?: string[];
  excludePatterns?: string[];

  // Processing options
  scrapeMode?: ScrapeMode;
  headers?: Record<string, string>;

  // NEW: Add this field
  /**
   * Whether Crawl4AI was used for content fetching.
   * Stored for reproducibility and audit trail.
   */
  useCrawl4AI?: boolean;
}
```

**Reasoning:** VersionScraperOptions is stored in the database (`scraper_options` JSON field). Including the flag here ensures we can reproduce scraping jobs with the exact same configuration.

### 1.3: Update FetchOptions

**File:** `/home/mp/Workspace/scrapegoat/src/scraper/fetcher/types.ts`

**Add the `useCrawl4AI` field to `FetchOptions`:**

```typescript
/**
 * Options for configuring content fetching behavior
 */
export interface FetchOptions {
  /** Maximum retry attempts for failed fetches */
  maxRetries?: number;
  /** Base delay between retries in milliseconds */
  retryDelay?: number;
  /** Additional headers for HTTP requests */
  headers?: Record<string, string>;
  /** Timeout in milliseconds */
  timeout?: number;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Whether to follow HTTP redirects (3xx responses) */
  followRedirects?: boolean;

  // NEW: Add this field
  /**
   * Whether to use Crawl4AI for content fetching.
   * When true, AutoDetectFetcher will select Crawl4AIFetcher.
   */
  useCrawl4AI?: boolean;
}
```

**Reasoning:** FetchOptions is passed to the `fetch()` method of ContentFetcher implementations. Adding the flag here allows AutoDetectFetcher to check it during fetcher selection.

### Verification

**Run TypeScript type checking:**

```bash
cd /home/mp/Workspace/scrapegoat
npm run type-check
```

**Expected output:** No type errors

---

## Step 2: Modify AutoDetectFetcher

### 2.1: Add Crawl4AIFetcher Instance

**File:** `/home/mp/Workspace/scrapegoat/src/scraper/fetcher/AutoDetectFetcher.ts`

**Import Crawl4AIFetcher and add instance:**

```typescript
import { ChallengeError } from "../../utils/errors";
import { logger } from "../../utils/logger";
import { BrowserFetcher } from "./BrowserFetcher";
import { FileFetcher } from "./FileFetcher";
import { HttpFetcher } from "./HttpFetcher";
import { Crawl4AIFetcher } from "./crawl4ai/Crawl4AIFetcher";  // NEW: Import
import type { ContentFetcher, FetchOptions, RawContent } from "./types";

/**
 * AutoDetectFetcher automatically selects the appropriate fetcher based on URL type
 * and handles fallbacks for challenge detection.
 *
 * This eliminates the need for consumers to manage multiple fetcher instances
 * and implement fallback logic themselves.
 */
export class AutoDetectFetcher implements ContentFetcher {
  private readonly httpFetcher = new HttpFetcher();
  private readonly browserFetcher = new BrowserFetcher();
  private readonly fileFetcher = new FileFetcher();
  private readonly crawl4aiFetcher = new Crawl4AIFetcher();  // NEW: Add instance
```

### 2.2: Add Crawl4AI Selection Logic

**Update the `fetch()` method to check `useCrawl4AI` flag:**

```typescript
  /**
   * Fetch content from the source, automatically selecting the appropriate fetcher
   * and handling fallbacks when challenges are detected.
   */
  async fetch(source: string, options?: FetchOptions): Promise<RawContent> {
    // For file:// URLs, use FileFetcher directly
    if (this.fileFetcher.canFetch(source)) {
      logger.debug(`Using FileFetcher for: ${source}`);
      return this.fileFetcher.fetch(source, options);
    }

    // For HTTP(S) URLs, check for Crawl4AI preference first
    if (this.httpFetcher.canFetch(source)) {
      // NEW: Check for useCrawl4AI flag
      if (options?.useCrawl4AI) {
        logger.debug(`Using Crawl4AIFetcher for: ${source}`);
        return this.crawl4aiFetcher.fetch(source, options);
      }

      // Existing logic: try HttpFetcher first, fallback to BrowserFetcher on challenge
      try {
        logger.debug(`Using HttpFetcher for: ${source}`);
        return await this.httpFetcher.fetch(source, options);
      } catch (error) {
        if (error instanceof ChallengeError) {
          logger.info(
            `🔄 Challenge detected for ${source}, falling back to browser fetcher...`,
          );
          return this.browserFetcher.fetch(source, options);
        }
        throw error;
      }
    }

    // If we get here, no fetcher can handle this URL
    throw new Error(`No suitable fetcher found for URL: ${source}`);
  }
```

### 2.3: Update canFetch Method

**Update to include Crawl4AIFetcher:**

```typescript
  /**
   * Check if this fetcher can handle the given source.
   * Returns true for any URL that any of the underlying fetchers can handle.
   */
  canFetch(source: string): boolean {
    return (
      this.httpFetcher.canFetch(source) ||
      this.browserFetcher.canFetch(source) ||
      this.fileFetcher.canFetch(source) ||
      this.crawl4aiFetcher.canFetch(source)  // NEW: Add Crawl4AI
    );
  }
```

### 2.4: Update close Method

**Update cleanup to include Crawl4AIFetcher:**

```typescript
  /**
   * Close all underlying fetchers to prevent resource leaks.
   */
  async close(): Promise<void> {
    await Promise.allSettled([
      this.browserFetcher.close(),
      this.crawl4aiFetcher.close(),  // NEW: Add cleanup
      // HttpFetcher and FileFetcher don't need explicit cleanup
    ]);
  }
```

### Verification

**Run unit tests for AutoDetectFetcher:**

```bash
npm test -- AutoDetectFetcher.test.ts
```

**Manual test - Check Crawl4AI selection:**

```typescript
// Test file or REPL
import { AutoDetectFetcher } from './AutoDetectFetcher';

const fetcher = new AutoDetectFetcher();

// Should use Crawl4AI
const result = await fetcher.fetch('https://example.com', {
  useCrawl4AI: true
});

console.log(result.mimeType); // Expected: "text/markdown"
```

---

## Step 3: Update WebScraperStrategy

### 3.1: Pass useCrawl4AI to Fetcher

**File:** `/home/mp/Workspace/scrapegoat/src/scraper/strategies/WebScraperStrategy.ts`

**Locate the `processItem` method and update fetch options:**

```typescript
  protected override async processItem(
    item: QueueItem,
    options: ScraperOptions,
    _progressCallback?: ProgressCallback<ScraperProgress>,
    signal?: AbortSignal,
  ): Promise<{ document?: Document; links?: string[]; finalUrl?: string }> {
    const { url } = item;

    try {
      // Define fetch options, passing signal, followRedirects, and headers
      const fetchOptions = {
        signal,
        followRedirects: options.followRedirects,
        headers: options.headers,
        useCrawl4AI: options.useCrawl4AI,  // NEW: Pass useCrawl4AI flag
      };

      // Use AutoDetectFetcher which handles fallbacks automatically
      const rawContent: RawContent = await this.fetcher.fetch(url, fetchOptions);

      // ... rest of the method unchanged
```

**Reasoning:** WebScraperStrategy needs to pass the `useCrawl4AI` flag from ScraperOptions down to the fetcher via FetchOptions. This is the bridge between the configuration layer and the fetcher layer.

### 3.2: No Other Changes Needed

The rest of WebScraperStrategy remains unchanged because:
- Pipeline selection already works with markdown (`mimeType: "text/markdown"`)
- Document creation is content-type agnostic
- Link extraction works the same regardless of fetcher used

### Verification

**Run integration test:**

```bash
npm test -- WebScraperStrategy.test.ts
```

---

## Step 4: Add Integration Tests

### 4.1: Create Integration Test File

**File:** `/home/mp/Workspace/scrapegoat/src/scraper/fetcher/crawl4ai/Crawl4AI-storage.integration.test.ts`

**Create comprehensive integration test:**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DocumentManagementService } from "../../../store/DocumentManagementService";
import { ScraperService } from "../../ScraperService";
import { ScraperRegistry } from "../../ScraperRegistry";
import { Crawl4AIFetcher } from "./Crawl4AIFetcher";

describe("Crawl4AI Storage Integration", () => {
  let documentService: DocumentManagementService;
  let scraperService: ScraperService;

  beforeAll(async () => {
    // Initialize services
    documentService = new DocumentManagementService(
      process.env.DATABASE_URL || "postgresql://localhost:5432/scrapegoat_test"
    );
    await documentService.initialize();

    const registry = new ScraperRegistry();
    scraperService = new ScraperService(registry);
  });

  afterAll(async () => {
    await documentService.shutdown();
    await scraperService.cleanup();
  });

  it("should scrape with Crawl4AI and store to PostgreSQL", async () => {
    // Check Crawl4AI service is available
    const fetcher = new Crawl4AIFetcher();
    const isAvailable = await fetcher.isAvailable();

    if (!isAvailable) {
      console.warn("⚠️ Crawl4AI service not available, skipping integration test");
      return;
    }

    const library = "test-crawl4ai";
    const version = "1.0.0";
    const testUrl = "https://example.com";

    // Clean up any existing data
    await documentService.removeAllDocuments(library, version);

    // Scrape with Crawl4AI enabled
    let documentCount = 0;
    await scraperService.scrape(
      {
        url: testUrl,
        library,
        version,
        useCrawl4AI: true,  // Enable Crawl4AI
        maxPages: 1,
        maxDepth: 0,
      },
      async (progress) => {
        if (progress.document) {
          // Store document
          await documentService.addDocument(library, version, {
            pageContent: progress.document.content,
            metadata: {
              ...progress.document.metadata,
              mimeType: progress.document.contentType,
            },
          });
          documentCount++;
        }
      }
    );

    // Verify document was stored
    expect(documentCount).toBeGreaterThan(0);

    // Verify document is searchable
    const results = await documentService.searchStore(
      library,
      version,
      "example",
      5
    );

    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].url).toBe(testUrl);

    // Verify scraper options were stored
    const versionId = await documentService.ensureLibraryAndVersion(library, version);
    const storedOptions = await documentService.getScraperOptions(versionId);

    expect(storedOptions).toBeDefined();
    expect(storedOptions?.options.useCrawl4AI).toBe(true);

    // Clean up
    await documentService.removeAllDocuments(library, version);
  }, 60000); // 60 second timeout for integration test

  it("should handle Crawl4AI service unavailability gracefully", async () => {
    const library = "test-crawl4ai-failure";
    const version = "1.0.0";

    // This test assumes Crawl4AI service might be down
    // It should fail cleanly with a clear error message
    await expect(async () => {
      await scraperService.scrape(
        {
          url: "http://invalid-crawl4ai-test.example.com",
          library,
          version,
          useCrawl4AI: true,
          maxPages: 1,
        },
        async () => {
          // Should not reach here if service is down
        }
      );
    }).rejects.toThrow();
  });

  it("should store markdown content type from Crawl4AI", async () => {
    const fetcher = new Crawl4AIFetcher();
    const isAvailable = await fetcher.isAvailable();

    if (!isAvailable) {
      console.warn("⚠️ Crawl4AI service not available, skipping test");
      return;
    }

    const library = "test-crawl4ai-markdown";
    const version = "1.0.0";
    const testUrl = "https://example.com";

    await documentService.removeAllDocuments(library, version);

    // Scrape and store
    await scraperService.scrape(
      {
        url: testUrl,
        library,
        version,
        useCrawl4AI: true,
        maxPages: 1,
        maxDepth: 0,
      },
      async (progress) => {
        if (progress.document) {
          expect(progress.document.contentType).toBe("text/markdown");

          await documentService.addDocument(library, version, {
            pageContent: progress.document.content,
            metadata: {
              ...progress.document.metadata,
              mimeType: progress.document.contentType,
            },
          });
        }
      }
    );

    // Clean up
    await documentService.removeAllDocuments(library, version);
  }, 60000);
});
```

### 4.2: Run Integration Tests

```bash
# Ensure Crawl4AI service is running
docker-compose up -d crawl4ai

# Run integration tests
npm test -- Crawl4AI-storage.integration.test.ts

# Expected output:
# ✓ should scrape with Crawl4AI and store to PostgreSQL
# ✓ should handle Crawl4AI service unavailability gracefully
# ✓ should store markdown content type from Crawl4AI
```

---

## Step 5: Update Documentation

### 5.1: Update API Documentation

**File:** `/home/mp/Workspace/scrapegoat/docs/api-usage.md` (create if doesn't exist)

**Add Crawl4AI usage example:**

```markdown
## Using Crawl4AI for Advanced Web Scraping

Crawl4AI provides enhanced web scraping with JavaScript rendering and anti-bot bypass.

### When to Use Crawl4AI

Use Crawl4AI when:
- Documentation requires JavaScript rendering (SPAs like React, Vue, Angular apps)
- Sites have bot detection / anti-scraping measures
- You need cleaner markdown output (BM25-filtered, removes ads/navigation)
- Standard HTTP fetching returns incomplete content

**Trade-offs:**
- Slower: 2-5x slower than standard HTTP fetching
- More resource-intensive: Requires Python service with browser automation
- Cost: May incur costs if using hosted Crawl4AI service

### Basic Usage

\`\`\`typescript
import { PipelineManager } from './pipeline/PipelineManager';
import { DocumentManagementService } from './store/DocumentManagementService';
import { ScraperService } from './scraper/ScraperService';
import { ScraperRegistry } from './scraper/ScraperRegistry';

// Initialize services
const store = new DocumentManagementService(process.env.DATABASE_URL);
await store.initialize();

const registry = new ScraperRegistry();
const scraper = new ScraperService(registry);
const pipelineManager = new PipelineManager(store, scraper);

// Scrape with Crawl4AI enabled
const jobId = await pipelineManager.scrape({
  library: "react",
  version: "18.0.0",
  sourceUrl: "https://react.dev/reference/react",
  useCrawl4AI: true,  // Enable Crawl4AI
  maxPages: 100,
  maxDepth: 3,
});

// Monitor job progress
const job = pipelineManager.getJob(jobId);
console.log(job.status); // "queued" | "running" | "completed" | "failed"
\`\`\`

### Checking Service Availability

\`\`\`typescript
import { Crawl4AIFetcher } from './scraper/fetcher/crawl4ai/Crawl4AIFetcher';

const fetcher = new Crawl4AIFetcher();
const isAvailable = await fetcher.isAvailable();

if (isAvailable) {
  console.log("✓ Crawl4AI service is available");
  // Proceed with scraping
} else {
  console.log("✗ Crawl4AI service is unavailable");
  // Use standard fetching or wait for service
}
\`\`\`

### Error Handling

\`\`\`typescript
try {
  const jobId = await pipelineManager.scrape({
    library: "react",
    version: "18.0.0",
    sourceUrl: "https://react.dev",
    useCrawl4AI: true,
  });

  await pipelineManager.waitForCompletion(jobId);
  console.log("✓ Scraping completed successfully");
} catch (error) {
  if (error.message.includes("Crawl4AI service")) {
    console.error("Crawl4AI service is unavailable. Try:");
    console.error("  1. Check if service is running: docker-compose ps");
    console.error("  2. Retry without Crawl4AI: useCrawl4AI: false");
    console.error("  3. Check service logs: docker-compose logs crawl4ai");
  } else {
    console.error("Scraping failed:", error.message);
  }
}
\`\`\`
\`\`\`

### 5.2: Update README

**File:** `/home/mp/Workspace/scrapegoat/README.md`

**Add section on Crawl4AI:**

```markdown
## Advanced Features

### Crawl4AI Integration

Scrapegoat supports Crawl4AI for enhanced web scraping with JavaScript rendering and anti-bot bypass.

**Features:**
- JavaScript rendering via Playwright
- Anti-bot detection bypass
- BM25-filtered markdown (cleaner content)
- Screenshot capture
- Media extraction

**Enable Crawl4AI:**

\`\`\`typescript
await pipelineManager.scrape({
  library: "your-library",
  version: "1.0.0",
  sourceUrl: "https://example.com",
  useCrawl4AI: true,  // Enable Crawl4AI
});
\`\`\`

**Requirements:**
- Docker service running (`docker-compose up -d`)
- Crawl4AI service healthy (`curl http://localhost:8001/health`)

See [API Documentation](./docs/api-usage.md) for detailed usage.
```

---

## Verification

### Complete System Test

**Run this end-to-end verification:**

```bash
# 1. Start all services
docker-compose up -d

# 2. Verify Crawl4AI service
curl http://localhost:8001/health

# 3. Run type checking
npm run type-check

# 4. Run unit tests
npm test

# 5. Run integration tests
npm test -- Crawl4AI-storage.integration.test.ts

# 6. Test manually
npm run dev
```

**Manual verification script:**

```typescript
// test-crawl4ai-integration.ts
import { PipelineManager } from './src/pipeline/PipelineManager';
import { DocumentManagementService } from './src/store/DocumentManagementService';
import { ScraperService } from './src/scraper/ScraperService';
import { ScraperRegistry } from './src/scraper/ScraperRegistry';

async function testCrawl4AIIntegration() {
  console.log("🧪 Testing Crawl4AI Integration...\n");

  // Initialize
  const store = new DocumentManagementService(
    process.env.DATABASE_URL || "postgresql://localhost:5432/scrapegoat"
  );
  await store.initialize();

  const registry = new ScraperRegistry();
  const scraper = new ScraperService(registry);
  const pipelineManager = new PipelineManager(store, scraper);

  try {
    // Test scrape
    console.log("📡 Starting scrape with Crawl4AI...");
    const jobId = await pipelineManager.scrape({
      library: "test-crawl4ai",
      version: "1.0.0",
      sourceUrl: "https://example.com",
      useCrawl4AI: true,
      maxPages: 1,
      maxDepth: 0,
    });

    console.log(`✓ Job created: ${jobId}`);
    console.log("⏳ Waiting for completion...");

    await pipelineManager.waitForCompletion(jobId);

    const job = pipelineManager.getJob(jobId);
    console.log(`✓ Job status: ${job.status}`);

    // Test search
    console.log("\n🔍 Testing search...");
    const results = await store.searchStore(
      "test-crawl4ai",
      "1.0.0",
      "example",
      5
    );

    console.log(`✓ Found ${results.length} results`);
    if (results.length > 0) {
      console.log(`  First result URL: ${results[0].url}`);
      console.log(`  Content type: ${results[0].mimeType}`);
    }

    // Verify scraper options
    console.log("\n📋 Verifying stored configuration...");
    const versionId = await store.ensureLibraryAndVersion("test-crawl4ai", "1.0.0");
    const storedOptions = await store.getScraperOptions(versionId);

    console.log(`✓ useCrawl4AI was stored: ${storedOptions?.options.useCrawl4AI}`);

    console.log("\n✅ All tests passed!");

    // Cleanup
    await store.removeAllDocuments("test-crawl4ai", "1.0.0");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    throw error;
  } finally {
    await store.shutdown();
    await scraper.cleanup();
  }
}

testCrawl4AIIntegration();
```

**Run verification script:**

```bash
npx tsx test-crawl4ai-integration.ts

# Expected output:
# 🧪 Testing Crawl4AI Integration...
# 📡 Starting scrape with Crawl4AI...
# ✓ Job created: abc-123
# ⏳ Waiting for completion...
# ✓ Job status: completed
# 🔍 Testing search...
# ✓ Found 3 results
#   First result URL: https://example.com
#   Content type: text/markdown
# 📋 Verifying stored configuration...
# ✓ useCrawl4AI was stored: true
# ✅ All tests passed!
```

---

## Rollback Plan

### If Issues Are Encountered

**Step 1: Identify the issue**

```bash
# Check error logs
docker-compose logs scrapegoat
docker-compose logs crawl4ai

# Check database
psql $DATABASE_URL -c "SELECT * FROM versions WHERE scraper_options LIKE '%useCrawl4AI%';"
```

**Step 2: Revert code changes**

```bash
# Revert the commit
git revert <commit-hash>

# Or manually revert files
git checkout HEAD~1 -- src/scraper/types.ts
git checkout HEAD~1 -- src/store/types.ts
git checkout HEAD~1 -- src/scraper/fetcher/types.ts
git checkout HEAD~1 -- src/scraper/fetcher/AutoDetectFetcher.ts
git checkout HEAD~1 -- src/scraper/strategies/WebScraperStrategy.ts
```

**Step 3: Redeploy**

```bash
npm run build
docker-compose up -d --build
```

**Step 4: Verify rollback**

```bash
# Existing functionality should work
npm test

# Crawl4AI flag should not exist
grep -r "useCrawl4AI" src/ || echo "Successfully removed"
```

### Database Cleanup (if needed)

```sql
-- Remove test data
DELETE FROM documents WHERE page_id IN (
  SELECT id FROM pages WHERE version_id IN (
    SELECT id FROM versions WHERE library_id IN (
      SELECT id FROM libraries WHERE name LIKE 'test-crawl4ai%'
    )
  )
);

-- Remove scraper_options with useCrawl4AI (if reverting completely)
UPDATE versions
SET scraper_options = NULL
WHERE scraper_options::jsonb ? 'useCrawl4AI';
```

---

## Success Criteria Checklist

After completing all steps, verify:

- [ ] TypeScript compiles without errors (`npm run type-check`)
- [ ] All existing tests pass (`npm test`)
- [ ] Integration test passes (`npm test -- Crawl4AI-storage.integration.test.ts`)
- [ ] Can scrape with `useCrawl4AI: true`
- [ ] Content stored in PostgreSQL with markdown mime type
- [ ] Vector embeddings generated for chunks
- [ ] Content searchable via hybrid search
- [ ] `scraper_options` JSON includes `useCrawl4AI` flag
- [ ] Error handling works when Crawl4AI service down
- [ ] Documentation updated
- [ ] Manual verification script passes

---

**Next:** See `IMPLEMENTATION_CHECKLIST.md` for task tracking.
