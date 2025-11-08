# Phase 2: Explicit Fetcher Selection

**Status**: Ready for Implementation
**Priority**: P0 (Foundation for all other phases)
**Estimated Effort**: 8-12 hours
**Complexity**: Medium
**Risk Level**: Low

## Overview

Enable users to explicitly specify which content fetcher to use (HTTP, Browser, Crawl4AI, or Auto) instead of relying solely on auto-detection. This gives users control over scraping behavior while maintaining backward compatibility.

## Requirements

### Functional Requirements

1. **Fetcher Type Enum**: Define explicit fetcher types
   - `auto`: Current auto-detection behavior (default)
   - `http`: Force HTTP/fetch-based fetching
   - `browser`: Force Playwright browser fetching
   - `crawl4ai`: Force Crawl4AI service fetching
   - `file`: Force file system fetching

2. **FetchOptions Extension**: Add fetcher parameter
   - New optional parameter: `fetcher?: FetcherType`
   - Maintain existing `useCrawl4AI?: boolean` for backward compatibility
   - Priority: `fetcher` param > `useCrawl4AI` flag > auto-detection

3. **MCP Tool Enhancement**: Add fetcher selection to scrape_docs
   - New optional parameter: `fetcher?: string`
   - Enum values: "auto" | "http" | "browser" | "crawl4ai"
   - Default: "auto"

4. **Validation**: Ensure fetcher can handle URL
   - Error if user specifies `fetcher: 'file'` for http:// URL
   - Error if user specifies `fetcher: 'http'` for file:// URL
   - Helpful error messages explaining why fetcher was rejected

### Non-Functional Requirements

1. **Backward Compatibility**:
   - All existing code continues to work without changes
   - `useCrawl4AI: true` still works (maps to `fetcher: 'crawl4ai'`)
   - Default behavior unchanged (`fetcher: 'auto'`)

2. **Performance**: No performance impact on existing operations

3. **Testability**: All fetcher types fully testable

## Architecture Design

### Type Definitions

**File**: `src/scraper/fetcher/types.ts`

```typescript
/**
 * Available fetcher types for content retrieval
 */
export type FetcherType = 'auto' | 'http' | 'browser' | 'crawl4ai' | 'file';

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
  /**
   * Explicit fetcher selection.
   * Default: 'auto' (auto-detection based on URL and challenges)
   *
   * Priority: fetcher > useCrawl4AI > auto-detection
   */
  fetcher?: FetcherType;
  /**
   * @deprecated Use fetcher: 'crawl4ai' instead.
   * Whether to use Crawl4AI for content fetching.
   * When true, AutoDetectFetcher will select Crawl4AIFetcher.
   */
  useCrawl4AI?: boolean;
}
```

### AutoDetectFetcher Logic

**File**: `src/scraper/fetcher/AutoDetectFetcher.ts`

```typescript
async fetch(source: string, options?: FetchOptions): Promise<RawContent> {
  // Determine effective fetcher type
  const fetcherType = this.determineFetcherType(source, options);

  // Route to appropriate fetcher
  switch (fetcherType) {
    case 'file':
      return this.fileFetcher.fetch(source, options);

    case 'http':
      return this.httpFetcher.fetch(source, options);

    case 'browser':
      return this.browserFetcher.fetch(source, options);

    case 'crawl4ai':
      return this.crawl4aiFetcher.fetch(source, options);

    case 'auto':
      return this.autoDetect(source, options);

    default:
      throw new Error(`Unknown fetcher type: ${fetcherType}`);
  }
}

private determineFetcherType(source: string, options?: FetchOptions): FetcherType {
  // Priority 1: Explicit fetcher parameter
  if (options?.fetcher) {
    // Validate that fetcher can handle this URL
    if (!this.canFetcherHandleSource(options.fetcher, source)) {
      throw new Error(
        `Fetcher '${options.fetcher}' cannot handle URL: ${source}. ` +
        `Use 'auto' or choose a compatible fetcher.`
      );
    }
    return options.fetcher;
  }

  // Priority 2: Backward compatibility with useCrawl4AI flag
  if (options?.useCrawl4AI === true) {
    return 'crawl4ai';
  }

  // Priority 3: Auto-detection
  return 'auto';
}

private canFetcherHandleSource(fetcher: FetcherType, source: string): boolean {
  switch (fetcher) {
    case 'auto':
      return true; // Auto can handle anything
    case 'file':
      return this.fileFetcher.canFetch(source);
    case 'http':
      return this.httpFetcher.canFetch(source);
    case 'browser':
      return this.browserFetcher.canFetch(source);
    case 'crawl4ai':
      return this.crawl4aiFetcher.canFetch(source);
    default:
      return false;
  }
}

private async autoDetect(source: string, options?: FetchOptions): Promise<RawContent> {
  // Existing auto-detection logic (file → http → browser fallback)
  if (this.fileFetcher.canFetch(source)) {
    return this.fileFetcher.fetch(source, options);
  }

  if (this.httpFetcher.canFetch(source)) {
    try {
      return await this.httpFetcher.fetch(source, options);
    } catch (error) {
      if (error instanceof ChallengeError) {
        logger.info(`🔄 Challenge detected, falling back to browser...`);
        return this.browserFetcher.fetch(source, options);
      }
      throw error;
    }
  }

  throw new Error(`No suitable fetcher found for URL: ${source}`);
}
```

### MCP Tool Update

**File**: `src/mcp/mcpServer.ts`

```typescript
server.tool(
  "scrape_docs",
  "Scrape and index documentation from a URL for a library.",
  {
    url: z.string().url().describe("Documentation root URL to scrape."),
    library: z.string().trim().describe("Library name."),
    version: z.string().trim().optional().describe("Library version (optional)."),
    maxPages: z.number().optional().default(DEFAULT_MAX_PAGES),
    maxDepth: z.number().optional().default(DEFAULT_MAX_DEPTH),
    scope: z.enum(["subpages", "hostname", "domain"]).optional().default("subpages"),
    followRedirects: z.boolean().optional().default(true),
    fetcher: z.enum(["auto", "http", "browser", "crawl4ai"])
      .optional()
      .default("auto")
      .describe("Content fetcher to use: 'auto' (default), 'http', 'browser', or 'crawl4ai'."),
  },
  async ({ url, library, version, maxPages, maxDepth, scope, followRedirects, fetcher }) => {
    const result = await tools.scrape.execute({
      url,
      library,
      version,
      waitForCompletion: false,
      options: {
        maxPages,
        maxDepth,
        scope,
        followRedirects,
        fetcher: fetcher as FetcherType, // Type assertion safe due to zod validation
      },
    });

    return createResponse(result);
  }
);
```

## Implementation Tasks

### Task 1: Update Type Definitions (2 hours)
**File**: `src/scraper/fetcher/types.ts`

- [ ] Add `FetcherType` type definition
- [ ] Add `fetcher?: FetcherType` to `FetchOptions`
- [ ] Mark `useCrawl4AI` as deprecated with JSDoc
- [ ] Update JSDoc comments with usage examples

### Task 2: Update AutoDetectFetcher (3 hours)
**File**: `src/scraper/fetcher/AutoDetectFetcher.ts`

- [ ] Implement `determineFetcherType()` method
- [ ] Implement `canFetcherHandleSource()` validation method
- [ ] Extract auto-detection logic into `autoDetect()` method
- [ ] Update `fetch()` method with switch/case routing
- [ ] Add helpful error messages for invalid fetcher/URL combinations

### Task 3: Update MCP Tool (1 hour)
**File**: `src/mcp/mcpServer.ts`

- [ ] Add `fetcher` parameter to scrape_docs tool schema
- [ ] Add parameter description and examples
- [ ] Pass fetcher option through to scrape tool
- [ ] Update tool documentation

### Task 4: Update Scrape Tool (1 hour)
**File**: `src/tools/scrape.ts`

- [ ] Accept fetcher option in execute() parameters
- [ ] Pass fetcher to crawler configuration
- [ ] Ensure fetcher propagates to fetcher instances

### Task 5: Write Tests (3 hours)
**File**: `src/scraper/fetcher/AutoDetectFetcher.test.ts`

Test Cases:
- [ ] Explicit `fetcher: 'http'` uses HttpFetcher
- [ ] Explicit `fetcher: 'browser'` uses BrowserFetcher
- [ ] Explicit `fetcher: 'crawl4ai'` uses Crawl4AIFetcher
- [ ] Explicit `fetcher: 'file'` uses FileFetcher
- [ ] Default `fetcher: 'auto'` uses auto-detection
- [ ] Backward compatibility: `useCrawl4AI: true` uses Crawl4AIFetcher
- [ ] Priority: explicit fetcher overrides useCrawl4AI flag
- [ ] Validation: error when fetcher can't handle URL
- [ ] Error messages are helpful and actionable

### Task 6: Update Documentation (2 hours)

- [ ] Update README.md with fetcher selection examples
- [ ] Update API documentation with fetcher parameter
- [ ] Add migration guide for useCrawl4AI → fetcher
- [ ] Add troubleshooting guide for fetcher selection
- [ ] Update MCP tool documentation

## Testing Strategy

### Unit Tests
```typescript
describe('AutoDetectFetcher - Explicit Fetcher Selection', () => {
  it('should use HttpFetcher when fetcher: "http" specified', async () => {
    const result = await fetcher.fetch('https://example.com', { fetcher: 'http' });
    expect(mockHttpFetcher.fetch).toHaveBeenCalled();
  });

  it('should use BrowserFetcher when fetcher: "browser" specified', async () => {
    const result = await fetcher.fetch('https://example.com', { fetcher: 'browser' });
    expect(mockBrowserFetcher.fetch).toHaveBeenCalled();
  });

  it('should throw error when file fetcher used for http URL', async () => {
    await expect(
      fetcher.fetch('https://example.com', { fetcher: 'file' })
    ).rejects.toThrow("Fetcher 'file' cannot handle URL");
  });

  it('should prioritize explicit fetcher over useCrawl4AI flag', async () => {
    const result = await fetcher.fetch('https://example.com', {
      fetcher: 'http',
      useCrawl4AI: true  // Should be ignored
    });
    expect(mockHttpFetcher.fetch).toHaveBeenCalled();
    expect(mockCrawl4AIFetcher.fetch).not.toHaveBeenCalled();
  });

  it('should use Crawl4AI when useCrawl4AI: true for backward compatibility', async () => {
    const result = await fetcher.fetch('https://example.com', { useCrawl4AI: true });
    expect(mockCrawl4AIFetcher.fetch).toHaveBeenCalled();
  });
});
```

### Integration Tests
- Test full scrape pipeline with each fetcher type
- Test MCP tool invocation with fetcher parameter
- Test backward compatibility with existing scripts

## Deployment Considerations

### Backward Compatibility Checklist
- [ ] All existing code works without modifications
- [ ] `useCrawl4AI` flag continues to work
- [ ] Default behavior unchanged
- [ ] No breaking changes to public APIs

### Configuration Changes
- No new environment variables needed
- No configuration file changes needed
- Pure API enhancement

### Migration Path
Users can migrate from:
```typescript
// Old way (still works)
{ useCrawl4AI: true }

// New way (recommended)
{ fetcher: 'crawl4ai' }
```

### Rollback Plan
If issues arise, revert to previous version. No database changes, so rollback is safe.

## Success Metrics

- [ ] All unit tests passing (target: 100% for new code)
- [ ] All integration tests passing
- [ ] Backward compatibility tests passing
- [ ] Documentation complete and reviewed
- [ ] Code review approved
- [ ] No regression in existing functionality
- [ ] User feedback positive

## Dependencies

**Depends On**: None (foundational phase)

**Blocks**:
- Phase 3 (Enhanced Features) - needs explicit fetcher selection
- Phase 4 (WebUI) - UI will expose fetcher selection

## Timeline

- **Task 1-2**: Days 1-2 (Type definitions and AutoDetectFetcher)
- **Task 3-4**: Day 2 (MCP and scrape tool updates)
- **Task 5**: Day 3 (Testing)
- **Task 6**: Day 3 (Documentation)
- **Total**: 3 days (8-12 hours focused work)

*Last Updated: 2025-11-08*
