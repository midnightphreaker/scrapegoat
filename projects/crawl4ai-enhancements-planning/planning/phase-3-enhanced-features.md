# Phase 3: Enhanced Crawl4AI Features

**Status**: Ready for Implementation (after Phase 2)
**Priority**: P1 (High Value)
**Estimated Effort**: 28-36 hours
**Complexity**: High
**Risk Level**: Medium

## Overview

Leverage Crawl4AI's advanced capabilities to capture screenshots, extract media assets, and catalog link relationships. Extends the data model to store and serve this rich content.

## Requirements

### Functional Requirements

1. **Screenshot Capture**
   - Support viewport and full-page screenshots
   - Store screenshots as files (not in database)
   - Configurable via environment variables
   - Size limits to prevent storage bloat
   - Optional per-scrape job

2. **Media Extraction**
   - Extract images, videos, audio from pages
   - Store metadata (URL, type, alt text, dimensions)
   - Store as JSON in database metadata
   - Queryable and displayable in UI

3. **Link Extraction**
   - Extract all links from pages
   - Categorize as internal/external
   - Store link text and rel attributes
   - Useful for navigation analysis

4. **Storage Schema Extensions**
   - Add `screenshot_path` column to pages table
   - Add `fetcher_type` column to track which fetcher was used
   - Use existing `metadata` JSON column for media/links
   - Create migration script (011-enhanced-crawl4ai.sql)

### Non-Functional Requirements

1. **Storage Efficiency**
   - Screenshots: Max 5MB per screenshot
   - File-based storage (not database blobs)
   - Compression where possible (WebP format)
   - Retention policy (configurable)

2. **Performance**
   - Enhanced features optional (disabled by default)
   - Minimal impact when disabled
   - Parallel processing where possible
   - Timeout handling

3. **Reliability**
   - Graceful degradation if screenshot fails
   - Continue scraping even if media extraction fails
   - Robust error handling

## Architecture Design

### Database Schema Changes

**Migration**: `db/migrations/011-enhanced-crawl4ai.sql`

```sql
-- Migration 011: Enhanced Crawl4AI Features
-- Adds support for screenshots, media tracking, and fetcher type tracking

-- Add screenshot path column to pages table
ALTER TABLE pages
ADD COLUMN screenshot_path TEXT;

-- Add fetcher type column to track which fetcher was used
ALTER TABLE pages
ADD COLUMN fetcher_type TEXT DEFAULT 'http';

-- Create index for fetcher type queries
CREATE INDEX IF NOT EXISTS idx_pages_fetcher_type ON pages(fetcher_type);

-- Add comment explaining metadata structure
COMMENT ON COLUMN pages.metadata IS
  'JSON metadata: { media?: MediaItem[], links?: LinkItem[], ... }';
```

**Rollback Migration**: `db/migrations/011-enhanced-crawl4ai-down.sql`

```sql
-- Rollback Migration 011: Remove Enhanced Crawl4AI Features

DROP INDEX IF EXISTS idx_pages_fetcher_type;
ALTER TABLE pages DROP COLUMN IF EXISTS fetcher_type;
ALTER TABLE pages DROP COLUMN IF EXISTS screenshot_path;
```

### Type Extensions

**File**: `src/scraper/fetcher/types.ts`

```typescript
/**
 * Media item extracted from page
 */
export interface MediaItem {
  type: 'image' | 'video' | 'audio';
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

/**
 * Link extracted from page
 */
export interface LinkItem {
  url: string;
  text: string;
  rel?: string;
}

/**
 * Extended page metadata
 */
export interface PageMetadata {
  media?: MediaItem[];
  links?: LinkItem[];
  [key: string]: unknown; // Allow other metadata
}

/**
 * Raw content fetched from a source before processing.
 * Now includes optional enhanced features.
 */
export interface RawContent {
  /** Raw content as string or buffer */
  content: string | Buffer;
  /** MIME type of the content */
  mimeType: string;
  /** Character set of the content */
  charset?: string;
  /** Content encoding */
  encoding?: string;
  /** Original source location */
  source: string;
  /** Optional screenshot (base64 or buffer) */
  screenshot?: string | Buffer;
  /** Optional extracted media items */
  media?: MediaItem[];
  /** Optional extracted links */
  links?: LinkItem[];
  /** Fetcher type used to retrieve this content */
  fetcherType?: FetcherType;
}

/**
 * Crawl4AI configuration options
 */
export interface Crawl4AIOptions {
  /** Enable screenshot capture */
  enableScreenshot?: boolean;
  /** Screenshot mode: viewport or full page */
  screenshotMode?: 'viewport' | 'full';
  /** Enable media extraction */
  enableMedia?: boolean;
  /** Enable link extraction */
  enableLinks?: boolean;
}

/**
 * Options for configuring content fetching behavior
 */
export interface FetchOptions {
  // ... existing options ...

  /** Crawl4AI-specific options */
  crawl4ai?: Crawl4AIOptions;
}
```

### Crawl4AIFetcher Updates

**File**: `src/scraper/fetcher/crawl4ai/Crawl4AIFetcher.ts`

```typescript
export class Crawl4AIFetcher implements ContentFetcher {
  async fetch(source: string, options?: FetchOptions): Promise<RawContent> {
    // Build Crawl4AI configuration
    const crawl4aiConfig: Crawl4AIConfig = {
      useFitMarkdown: true,
      cacheMode: 'enabled',

      // Enhanced features (opt-in)
      screenshot: options?.crawl4ai?.enableScreenshot
        ? (options.crawl4ai.screenshotMode || 'viewport')
        : false,
      extractMedia: options?.crawl4ai?.enableMedia || false,
      // Note: Crawl4AI always extracts links, we just control storage
    };

    const response = await this.client.crawl(source, crawl4aiConfig);

    if (!response.success || !response.data) {
      throw new ScraperError(
        `Crawl4AI fetch failed for ${source}: ${response.error?.message}`,
        response.error
      );
    }

    const { data } = response;

    return {
      content: Buffer.from(data.markdown, 'utf-8'),
      mimeType: 'text/markdown',
      charset: 'utf-8',
      source: data.metadata.url,
      screenshot: data.screenshot, // base64 string or undefined
      media: data.media,
      links: options?.crawl4ai?.enableLinks ? data.links : undefined,
      fetcherType: 'crawl4ai',
    };
  }
}
```

### Screenshot Storage Utility

**File**: `src/utils/screenshotStorage.ts` (new file)

```typescript
import { createHash } from 'crypto';
import { mkdir, writeFile, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { logger } from './logger';

const DEFAULT_SCREENSHOT_DIR = './public/screenshots';
const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024; // 5MB

export interface SaveScreenshotOptions {
  library: string;
  version: string;
  url: string;
  data: string | Buffer; // base64 string or buffer
}

/**
 * Save screenshot to file system and return path
 */
export async function saveScreenshot(options: SaveScreenshotOptions): Promise<string> {
  const { library, version, url, data } = options;

  // Convert base64 to buffer if needed
  const buffer = typeof data === 'string'
    ? Buffer.from(data, 'base64')
    : data;

  // Validate size
  if (buffer.length > MAX_SCREENSHOT_SIZE) {
    throw new Error(
      `Screenshot too large: ${buffer.length} bytes (max: ${MAX_SCREENSHOT_SIZE})`
    );
  }

  // Generate filename from URL hash
  const urlHash = createHash('sha256').update(url).digest('hex').slice(0, 16);
  const filename = `${urlHash}.png`;

  // Build directory path
  const screenshotDir = process.env.SCREENSHOT_STORAGE_PATH || DEFAULT_SCREENSHOT_DIR;
  const dir = join(screenshotDir, library, version || 'unversioned');

  // Ensure directory exists
  await mkdir(dir, { recursive: true });

  // Write file
  const filepath = join(dir, filename);
  await writeFile(filepath, buffer);

  logger.debug(`Saved screenshot: ${filepath} (${buffer.length} bytes)`);

  // Return relative path (relative to public directory)
  return filepath.replace(/^\.\/public\//, '/');
}

/**
 * Load screenshot from file system
 */
export async function loadScreenshot(path: string): Promise<Buffer> {
  const fullPath = path.startsWith('/')
    ? join('./public', path)
    : path;

  return await readFile(fullPath);
}

/**
 * Delete screenshot from file system
 */
export async function deleteScreenshot(path: string): Promise<void> {
  const fullPath = path.startsWith('/')
    ? join('./public', path)
    : path;

  try {
    await unlink(fullPath);
    logger.debug(`Deleted screenshot: ${fullPath}`);
  } catch (error) {
    logger.warn(`Failed to delete screenshot ${fullPath}:`, error);
  }
}
```

### Storage Pipeline Updates

**File**: `src/pipeline/PipelineClient.ts`

```typescript
async function processPage(
  page: CrawledPage,
  config: PipelineConfig
): Promise<void> {
  // Fetch content with enhanced features
  const rawContent = await config.fetcher.fetch(page.url, {
    fetcher: config.fetcherType,
    crawl4ai: config.crawl4aiOptions,
  });

  // Save screenshot if present
  let screenshotPath: string | undefined;
  if (rawContent.screenshot) {
    screenshotPath = await saveScreenshot({
      library: config.library,
      version: config.version,
      url: page.url,
      data: rawContent.screenshot,
    });
  }

  // Build metadata with media and links
  const metadata: PageMetadata = {
    ...(rawContent.media && { media: rawContent.media }),
    ...(rawContent.links && { links: rawContent.links }),
  };

  // Store page with enhanced data
  await config.storage.savePage({
    url: page.url,
    title: page.title,
    content: rawContent.content.toString('utf-8'),
    metadata: JSON.stringify(metadata),
    screenshotPath,
    fetcherType: rawContent.fetcherType || 'auto',
  });

  // Continue with normal processing (chunking, embedding, etc.)
  // ...
}
```

## Implementation Tasks

### Sprint 2A: Schema & Infrastructure (Week 1, 16 hours)

#### Task 1: Database Migration (2 hours)
**Files**: `db/migrations/011-enhanced-crawl4ai.sql`, `011-enhanced-crawl4ai-down.sql`

- [ ] Create migration script to add columns
- [ ] Create rollback script
- [ ] Test migration on development database
- [ ] Document migration process

#### Task 2: Type Definitions (2 hours)
**File**: `src/scraper/fetcher/types.ts`

- [ ] Add `MediaItem` interface
- [ ] Add `LinkItem` interface
- [ ] Add `PageMetadata` interface
- [ ] Extend `RawContent` with optional fields
- [ ] Add `Crawl4AIOptions` interface
- [ ] Update `FetchOptions` with crawl4ai property

#### Task 3: Screenshot Storage Utility (4 hours)
**File**: `src/utils/screenshotStorage.ts`

- [ ] Implement `saveScreenshot()` function
- [ ] Implement `loadScreenshot()` function
- [ ] Implement `deleteScreenshot()` function
- [ ] Add size validation
- [ ] Add error handling
- [ ] Write unit tests

#### Task 4: Configuration (2 hours)
**File**: `src/utils/config.ts`

- [ ] Add `CRAWL4AI_ENABLE_SCREENSHOTS` environment variable
- [ ] Add `CRAWL4AI_ENABLE_MEDIA` environment variable
- [ ] Add `CRAWL4AI_ENABLE_LINKS` environment variable
- [ ] Add `CRAWL4AI_SCREENSHOT_MODE` environment variable
- [ ] Add `SCREENSHOT_STORAGE_PATH` environment variable
- [ ] Add `SCREENSHOT_MAX_SIZE_MB` environment variable
- [ ] Document all new environment variables

#### Task 5: Infrastructure Tests (6 hours)

- [ ] Test database migration up and down
- [ ] Test screenshot storage (save/load/delete)
- [ ] Test size limit validation
- [ ] Test directory creation
- [ ] Test configuration loading
- [ ] Test error scenarios

### Sprint 2B: Integration (Week 2, 12 hours)

#### Task 6: Update Crawl4AIFetcher (4 hours)
**File**: `src/scraper/fetcher/crawl4ai/Crawl4AIFetcher.ts`

- [ ] Accept Crawl4AIOptions in fetch()
- [ ] Build Crawl4AI config from options
- [ ] Map response to extended RawContent
- [ ] Add fetcherType to result
- [ ] Handle screenshot data
- [ ] Handle media/links data

#### Task 7: Update Storage Pipeline (4 hours)
**Files**: `src/pipeline/PipelineClient.ts`, `src/store/*.ts`

- [ ] Update page storage to accept new fields
- [ ] Implement screenshot saving logic
- [ ] Implement metadata serialization
- [ ] Update database queries
- [ ] Handle optional fields gracefully

#### Task 8: Update MCP Tool (2 hours)
**File**: `src/mcp/mcpServer.ts`

- [ ] Add optional boolean parameters:
  - `enableScreenshots?: boolean`
  - `enableMedia?: boolean`
  - `enableLinks?: boolean`
- [ ] Pass options through to scrape tool
- [ ] Document new parameters

#### Task 9: Integration Tests (6 hours)

- [ ] Test Crawl4AI with screenshot enabled
- [ ] Test Crawl4AI with media extraction
- [ ] Test Crawl4AI with link extraction
- [ ] Test full pipeline with enhanced features
- [ ] Test storage and retrieval
- [ ] Test with features disabled (default)

### Sprint 2C: Polish & Documentation (Week 2, 8 hours)

#### Task 10: Error Handling (2 hours)

- [ ] Graceful degradation if screenshot fails
- [ ] Continue on media extraction failure
- [ ] Handle storage failures
- [ ] Add helpful error messages

#### Task 11: Documentation (4 hours)

- [ ] Update README with enhanced features
- [ ] Document screenshot storage strategy
- [ ] Document environment variables
- [ ] Add usage examples
- [ ] Create troubleshooting guide

#### Task 12: Code Review & Polish (2 hours)

- [ ] Code review
- [ ] Address feedback
- [ ] Performance testing
- [ ] Security review (file paths)

## Testing Strategy

### Unit Tests

```typescript
describe('screenshotStorage', () => {
  it('should save screenshot and return path', async () => {
    const path = await saveScreenshot({
      library: 'react',
      version: '18.0.0',
      url: 'https://react.dev/docs',
      data: mockScreenshotBuffer,
    });

    expect(path).toMatch(/^\/screenshots\/react\/18\.0\.0\//);
    expect(await fileExists(path)).toBe(true);
  });

  it('should reject screenshots larger than max size', async () => {
    const largeBuffer = Buffer.alloc(10 * 1024 * 1024); // 10MB

    await expect(saveScreenshot({
      library: 'test',
      version: '1.0.0',
      url: 'https://example.com',
      data: largeBuffer,
    })).rejects.toThrow('Screenshot too large');
  });
});

describe('Crawl4AIFetcher - Enhanced Features', () => {
  it('should capture screenshot when enabled', async () => {
    const result = await fetcher.fetch('https://example.com', {
      crawl4ai: { enableScreenshot: true, screenshotMode: 'viewport' },
    });

    expect(result.screenshot).toBeDefined();
    expect(typeof result.screenshot).toBe('string'); // base64
  });

  it('should extract media when enabled', async () => {
    const result = await fetcher.fetch('https://example.com', {
      crawl4ai: { enableMedia: true },
    });

    expect(result.media).toBeDefined();
    expect(Array.isArray(result.media)).toBe(true);
  });
});
```

### Integration Tests

- End-to-end test with real Crawl4AI service
- Screenshot capture and storage
- Media extraction and database storage
- Link extraction and database storage
- Verify data queryable from database

## Deployment Considerations

### Environment Variables

```bash
# Enable enhanced features globally (default: false)
CRAWL4AI_ENABLE_SCREENSHOTS=false
CRAWL4AI_ENABLE_MEDIA=false
CRAWL4AI_ENABLE_LINKS=false

# Screenshot configuration
CRAWL4AI_SCREENSHOT_MODE=viewport  # viewport | full
SCREENSHOT_STORAGE_PATH=./public/screenshots
SCREENSHOT_MAX_SIZE_MB=5
```

### Storage Considerations

- Screenshots stored in `public/screenshots/` directory
- Served statically via Fastify static plugin
- Need backup strategy for screenshot files
- Consider cleanup/retention policy

### Migration Checklist

- [ ] Back up production database
- [ ] Test migration on staging
- [ ] Run migration during maintenance window
- [ ] Verify migration success
- [ ] Monitor for issues
- [ ] Have rollback plan ready

## Success Metrics

- [ ] All unit tests passing (>85% coverage)
- [ ] All integration tests passing
- [ ] Migration tested and documented
- [ ] Screenshots saving correctly
- [ ] Media/links extracting correctly
- [ ] No performance regression
- [ ] Documentation complete

## Dependencies

**Depends On**:
- Phase 2 (Explicit Fetcher Selection) - Complete

**Blocks**:
- Phase 4 (WebUI Integration) - needs screenshot/media data

## Risks & Mitigation

### Risk 1: Storage Growth
- **Mitigation**: Size limits, disabled by default, cleanup policy

### Risk 2: Migration Failures
- **Mitigation**: Extensive testing, rollback script, backups

### Risk 3: Performance Impact
- **Mitigation**: Optional features, parallel processing, timeouts

## Timeline

- **Sprint 2A** (Schema & Infrastructure): Week 1 (16 hours)
- **Sprint 2B** (Integration): Week 2 (12 hours)
- **Sprint 2C** (Polish): Week 2 (8 hours)
- **Total**: 2 weeks (28-36 hours)

*Last Updated: 2025-11-08*
