# src/scraper/

## Responsibility
Discovers, fetches, and processes documentation content from URLs (web, local files, GitHub, npm, PyPI) using strategy-based scraping and middleware-based content processing pipelines.

## Design
- **Strategy pattern**: `ScraperStrategy` interface with `canHandle(url)` / `scrape()`. `ScraperRegistry` acts as a factory, routing URLs to the correct strategy (GitHub, local file, local import, npm, PyPI, web). Each `getStrategy()` call returns a fresh instance for parallel job isolation.
- **ScraperService**: Thin orchestrator — gets a strategy from the registry, calls `strategy.scrape()`, ensures `strategy.cleanup()` runs in finally block.
- **Content processing**: Raw content flows through `ContentPipeline` implementations (HTML, Markdown, JSON, source code, documents, text) that use middleware chains for transformation and splitters for chunking.
- **Fetcher layer**: `ContentFetcher` implementations (`HttpFetcher`, `FileFetcher`, `BrowserFetcher`, `AutoDetectFetcher`) abstract content retrieval with retry, ETag caching, and challenge detection.
- **Middleware chain**: `ContentProcessorMiddleware` with `process(ctx, next)` pattern for composable HTML/Markdown processing (parsing, sanitization, rendering, conversion, metadata extraction, link extraction).
- **Cancellation**: `AbortSignal` threaded through strategies, fetchers, and pipelines.
- **Scope control**: `scope` option (subpages/hostname/domain) + include/exclude glob patterns for URL filtering.

## Flow
1. `ScraperService.scrape(options, callback)` → `ScraperRegistry.getStrategy(url)` → fresh strategy instance.
2. Strategy `scrape()` populates a queue (`QueueItem[]`), processes in concurrent batches via `BaseScraperStrategy.processBatch()`.
3. Per item: fetcher retrieves `RawContent` → pipeline selected by MIME type → pipeline processes (middleware + splitting) → returns `ScrapeResult` via progress callback.
4. Progress callback feeds results back to `PipelineWorker` for storage.

## Integration
- Consumed by: `PipelineWorker` (via `PipelineManager`)
- Depends on: `AppConfig`, splitter module, fetcher/middleware/pipeline/strategy/utils submodules
