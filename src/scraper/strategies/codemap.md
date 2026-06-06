# src/scraper/strategies/

## Responsibility
Implements URL-type-specific scraping strategies that discover, fetch, and process documentation content through a breadth-first crawl with concurrent batch processing.

## Design
- **Strategy pattern**: Each strategy implements `ScraperStrategy.canHandle(url)` and `scraper(options, progressCallback, signal)`. `ScraperRegistry` routes URLs to the correct strategy.
- **BaseScraperStrategy**: Abstract base providing the crawl engine. Manages a `visited` set (prevents re-queuing), `pageCount`/`totalDiscovered`/`effectiveTotal` counters, and `canonicalBaseUrl` (updated after depth-0 redirect). The `scrape()` method runs a BFS loop: pop batch → `processBatch()` → `processItem()` per URL → deduplicate discovered links → push to queue. Supports refresh mode with pre-populated `initialQueue` (ETag-based conditional fetching). `shouldProcessUrl()` checks scope + include/exclude patterns.
- **WebScraperStrategy**: HTTP(S) web scraper. Uses `AutoDetectFetcher` for content retrieval with challenge fallback. Routes content through `PipelineFactory.createStandardPipelines()`. Features: `llms.txt` probe at depth 0 (parses curated link lists for prioritized discovery), root archive detection (`.zip/.tar/.gz` → download → delegate to `LocalFileStrategy`), Markdown variant URL preference for llms.txt-discovered links, canonical URL tracking across redirects with scope-anchor preservation.
- **LocalFileStrategy**: Crawls local `file://` paths. Handles directories (returns child links), archives (zip/tar.gz — lists entries as virtual `file:///path/to/archive.zip/entry` URLs), and regular files. Resolves virtual paths inside archives by walking up the filesystem. Processes files through standard pipelines.
- **LocalImportStrategy**: Handles `file:///import/<library>/<version>/` URLs for WebUI-uploaded documentation. Maps virtual URLs to a staging directory. Walks directories recursively, processes files through standard pipelines.
- **GitHubScraperStrategy**: Discovery strategy for GitHub repos. Uses GitHub Tree API to enumerate repository files, creates HTTPS blob URLs for each. Delegates wiki scraping to `GitHubWikiProcessor`, blob content to `GitHubRepoProcessor`. Handles base repo URLs, tree URLs (branch+subpath), blob URLs (single file), and legacy `github-file://` URLs (marked as NOT_FOUND for cleanup). Auth via `GITHUB_TOKEN`/`GH_TOKEN` env vars with caching.
- **NpmScraperStrategy** / **PyPiScraperStrategy**: Thin wrappers around `WebScraperStrategy` with URL normalization options (case-insensitive, strip hash/query/trailing slash).

## Flow
1. `BaseScraperStrategy.scrape()`: Initialize queue (root URL or initialQueue from refresh), BFS loop with concurrent batches.
2. Per batch: `processBatch()` → each item → `processItem()` (abstract, implemented by subclass).
3. `processItem()`: fetch content → route to pipeline → return `ProcessItemResult` (content, links, status, etag).
4. Discovered links: normalize → deduplicate via `visited` set → filter by scope/patterns → enqueue.
5. Progress reported via callback for each processed page.

## Integration
- Consumed by: `ScraperRegistry` (factory), `PipelineManager` (via `ScraperService`)
- Depends on: `BaseScraperStrategy`, fetchers, pipelines (`PipelineFactory`), `AppConfig`, `MimeTypeUtils`, scope/pattern utils
