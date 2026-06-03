## Responsibility

The `src/scraper/` module orchestrates fetching, processing, and indexing of documentation content from diverse sources: HTTP/HTTPS websites, GitHub repositories, npm/PyPI packages, local filesystem paths, and uploaded import archives. It discovers pages via link crawling or API-based enumeration, fetches raw content through a pluggable fetcher layer, transforms it through middleware-based pipelines (HTML→Markdown conversion, sanitization, metadata extraction, chunking), and emits progress events carrying processed chunks back to the caller for storage.

## Design

### Entry Points & Orchestration
- **`ScraperRegistry`**: Factory that maps a URL to a concrete `ScraperStrategy` instance. Uses URL-prefix matching with priority ordering: `LocalImportStrategy` > `LocalFileStrategy` > `NpmScraperStrategy` > `PyPiScraperStrategy` > `GitHubScraperStrategy` > `WebScraperStrategy`. Each call returns a fresh strategy for state isolation across parallel jobs.
- **`ScraperService`**: Thin facade that obtains a strategy from the registry, calls `strategy.scrape()`, and guarantees `strategy.cleanup()` runs in a `finally` block.

### Core Types (`types.ts`)
- **`ScraperStrategy`**: Interface with `canHandle(url)`, `scrape(options, progressCallback, signal?)`, and optional `cleanup()`.
- **`ScraperOptions`**: Full runtime configuration (URL, scope, concurrency, include/exclude patterns, scrapeMode, ETags, refresh mode, etc.).
- **`ScrapeResult` / `ScraperProgressEvent`**: Structures emitted per-page during scraping, carrying title, text content, links, chunks, ETag, and deletion status.
- **`QueueItem`**: Internal crawl-queue entry with URL, depth, pageId, ETag, and provenance flags (`fromLlmsTxt`).
- **`ScrapeMode`**: Enum (`Fetch`, `Playwright`, `Auto`) controlling HTML rendering strategy.

### Strategies (`strategies/`)
All strategies extend **`BaseScraperStrategy`**, which implements BFS crawling with configurable `maxPages`, `maxDepth`, `maxConcurrency`, URL deduplication via a `visited` set, scope filtering (`subpages`/`hostname`/`domain`), and include/exclude pattern matching. Subclasses override `processItem()` and optionally `scrape()`.

| Strategy | Purpose |
|---|---|
| **`WebScraperStrategy`** | General HTTP/HTTPS scraping. Uses `AutoDetectFetcher` for content fetching, `PipelineFactory` for processing, and `probeLlmsTxt()` for llms.txt-based URL discovery. Handles root archive downloads by delegating to `LocalFileStrategy`. |
| **`GitHubScraperStrategy`** | Discovers files via GitHub Tree API, scrapes wiki pages via `GitHubWikiProcessor`, and processes individual files via `GitHubRepoProcessor`. Manages auth through `resolveGitHubAuth()` (env vars → `gh` CLI cascade). |
| **`NpmScraperStrategy` / `PyPiScraperStrategy`** | Thin wrappers around `WebScraperStrategy` with URL normalization (case-insensitive, strip hash/query/trailing slash). |
| **`LocalFileStrategy`** | Crawls `file://` URLs on the local filesystem. Supports directory listing, archive traversal (zip/tar/gz via `ArchiveAdapter`), virtual paths inside archives, and ETag-based conditional fetching. |
| **`LocalImportStrategy`** | Processes `file:///import/<library>/<version>/` URLs mapped to a staging directory from the upload flow. Walks directories recursively and runs files through standard pipelines. |

### Fetcher Layer (`fetcher/`)
All fetchers implement the **`ContentFetcher`** interface (`canFetch`, `fetch`). Returns **`RawContent`** with semantic `FetchStatus` (`SUCCESS`, `NOT_MODIFIED`, `NOT_FOUND`).

| Fetcher | Role |
|---|---|
| **`HttpFetcher`** | Axios-based HTTP client with exponential-backoff retry, SSRF protection, ETag/If-None-Match conditional requests, Cloudflare challenge detection, TLS error handling, and browser-like fingerprint headers via `FingerprintGenerator`. |
| **`FileFetcher`** | Reads local files from `file://` URLs with MD5-based ETags from mtime and enhanced MIME type detection. |
| **`BrowserFetcher`** | Playwright/Chromium fetcher for JavaScript-heavy pages. Manages browser lifecycle, custom headers, and viewport settings. |
| **`AutoDetectFetcher`** | Composite that routes `file://` to `FileFetcher`, HTTP to `HttpFetcher`, and falls back to `BrowserFetcher` on `ChallengeError` or `TlsCertificateError`. |

### Middleware (`middleware/`)
Implements a chain-of-responsibility pattern. Each middleware implements `ContentProcessorMiddleware` with `process(context, next)`. The `MiddlewareContext` carries content string, DOM (`cheerio.CheerioAPI`), links, errors, and scraper options.

| Middleware | Role |
|---|---|
| **`HtmlPlaywrightMiddleware`** | Renders pages in Playwright for JS-heavy content. Handles shadow DOM extraction, iframe/frameset loading, LRU resource caching (`SimpleMemoryCache`), HTTP Basic Auth credentials, and custom header forwarding. Only active when `scrapeMode` is `playwright` or `auto`. |
| **`HtmlCheerioParserMiddleware`** | Parses HTML string into a Cheerio DOM object on `context.dom`. |
| **`HtmlMetadataExtractorMiddleware`** | Extracts `<title>` or first `<h1>` from Cheerio DOM. |
| **`HtmlLinkExtractorMiddleware`** | Extracts and resolves `<a href>` links from Cheerio DOM, respecting `<base href>`. |
| **`HtmlSanitizerMiddleware`** | Removes noise elements (nav, sidebar, ads, modals, etc.) using CSS selectors. Includes a safety net that reverts if all content is removed. |
| **`HtmlNormalizationMiddleware`** | Converts relative URLs to absolute, removes tracking images, unwraps anchor-only and non-HTTP links, simplifies presentational wrappers. |
| **`HtmlToMarkdownMiddleware`** | Converts Cheerio DOM to Markdown via Turndown with GFM support and custom rules for code blocks and links. |
| **`HtmlJsExecutorMiddleware`** | Executes embedded JavaScript in a Node.js VM + JSDOM sandbox (`executeJsInSandbox`). Fetches external scripts via `ContentFetcher`. Warning: not suitable for arbitrary production pages. |
| **`MarkdownMetadataExtractorMiddleware`** | Extracts title from YAML frontmatter or first H1 heading in Markdown. |
| **`MarkdownLinkExtractorMiddleware`** | Placeholder for Markdown link extraction (currently a no-op). |

### Pipelines (`pipelines/`)
Each pipeline implements **`ContentPipeline`** (`canProcess`, `process`, `close`), extends **`BasePipeline`** which provides `executeMiddlewareStack()`. Pipelines handle both transformation and chunking.

**`PipelineFactory.createStandardPipelines()`** returns (in order):
1. **`JsonPipeline`** — JSON content → `JsonDocumentSplitter` (structure-preserving chunks).
2. **`SourceCodePipeline`** — Source code → `TreesitterSourceCodeSplitter` (language-aware hierarchical chunking).
3. **`DocumentPipeline`** — PDF/Office/ODF/eBooks/Jupyter via Kreuzberg (`@kreuzberg/node`) → Markdown → `SemanticMarkdownSplitter`.
4. **`HtmlPipeline`** — HTML through middleware chain (Playwright→Cheerio→sanitize→normalize→Turndown→Markdown) → `SemanticMarkdownSplitter`. Conditionally prepends `HtmlPlaywrightMiddleware` based on `scrapeMode`.
5. **`MarkdownPipeline`** — Markdown through metadata/link middleware → `SemanticMarkdownSplitter`.
6. **`TextPipeline`** — Universal fallback for safe text content → `TextDocumentSplitter`. Performs binary detection.

### Utilities (`utils/`)
- **`scope.ts`**: `isInScope()` for subpages/hostname/domain scope filtering; `isPathDescendant()` for redirect detection.
- **`patternMatcher.ts`**: `shouldIncludeUrl()` combining glob (minimatch) and regex patterns with default exclusion rules.
- **`defaultPatterns.ts`**: Default glob patterns excluding changelogs, licenses, test files, lock files, build artifacts, non-English locales, archive directories.
- **`buffer.ts`**: `convertToString()` for charset-aware Buffer→string decoding via iconv-lite.
- **`charset.ts`**: `resolveCharset()` for HTML meta-tag charset detection; `normalizeCharset()` for alias mapping.
- **`sandbox.ts`**: `executeJsInSandbox()` using Node.js `vm` + JSDOM for safe script execution.
- **`llmsTxtParser.ts`**: `parseLlmsTxt()` for parsing llms.txt Markdown files into structured links and sections.
- **`SimpleMemoryCache.ts`**: Generic LRU cache backed by `Map`, used for Playwright resource caching.

## Flow

1. **ScraperService.scrape()** receives `ScraperOptions` and delegates to `ScraperRegistry.getStrategy(url)` to obtain a fresh strategy.
2. **Strategy.scrape()** initializes a BFS queue with the root URL (or pre-populated `initialQueue` for refresh operations), then loops processing batches up to `maxConcurrency`.
3. **BaseScraperStrategy.processBatch()** calls each strategy's `processItem()` concurrently, collects discovered links, deduplicates against `visited`, and enqueues new items.
4. **Strategy.processItem()** fetches content (via appropriate fetcher), selects a matching pipeline via `canProcess()`, and runs the raw content through it.
5. **Pipeline.process()** builds a `MiddlewareContext`, executes the middleware chain (rendering → parsing → sanitization → conversion → metadata extraction), then splits the result into chunks.
6. **Progress callback** receives `ScraperProgressEvent` for each processed page (containing `ScrapeResult` with chunks, links, and metadata) or deletion/unchanged notifications.
7. After the scrape loop completes, **ScraperService** calls `strategy.cleanup()` to release browser instances, temp files, and other resources.

## Integration

- **Consumed by**: `src/pipeline/` (PipelineManager/Worker orchestrates scrape jobs), CLI commands, API routes that trigger documentation indexing.
- **Depends on**:
  - `src/utils/config` (`AppConfig`) for all runtime settings
  - `src/utils/errors` (`ScraperError`, `ChallengeError`, `RedirectError`, `TlsCertificateError`)
  - `src/utils/logger` for structured logging
  - `src/utils/mimeTypeUtils` for MIME type detection and classification
  - `src/utils/url` for URL normalization
  - `src/utils/urlValidation` for SSRF protection
  - `src/utils/archive` for archive (zip/tar/gz) extraction
  - `src/utils/dom` for JSDOM factory
  - `src/splitter/` for all content chunking (`SemanticMarkdownSplitter`, `TextDocumentSplitter`, `JsonDocumentSplitter`, `TreesitterSourceCodeSplitter`, `GreedySplitter`)
  - `src/upload/security` (`ensureWithinBase`) for path traversal prevention in LocalImportStrategy
  - External: axios, playwright, cheerio, turndown, gray-matter, iconv-lite, header-generator, @kreuzberg/node, jsdom, minimatch
