# src/scraper/middleware/

## Responsibility
Provides composable, chainable content processing middleware for transforming raw fetched content (HTML → Markdown, metadata extraction, link extraction, sanitization, JS rendering).

## Design
- **MiddlewareContext** (`types.ts`): Shared mutable state passed through the chain — `content` (string), `contentType`, `source`, `title`, `links`, `errors`, `options` (ScraperOptions), `dom` (Cheerio API, HTML-only), `fetcher` (ContentFetcher, for resolving resources).
- **ContentProcessorMiddleware interface**: `process(context, next)` — classic middleware chain pattern. Each middleware calls `next()` to pass control downstream.
- **HTML middleware stack** (execution order):
  1. `HtmlPlaywrightMiddleware` — Renders JS-heavy pages with Playwright if `scrapeMode` is playwright/auto. Manages shadow DOM extraction, iframe/frameset processing, route interception with LRU resource caching. Updates `context.content` with rendered HTML.
  2. `HtmlCheerioParserMiddleware` — Parses HTML string into Cheerio `context.dom`.
  3. `HtmlMetadataExtractorMiddleware` — Extracts title from `<title>` or `<h1>`.
  4. `HtmlLinkExtractorMiddleware` — Extracts `<a href>` links, resolves relative URLs against `<base href>` or source. Filters to http/https/file protocols.
  5. `HtmlSanitizerMiddleware` — Removes nav, footer, scripts, ads, modals, etc. by CSS selectors. Safety net: reverts if all content removed. Supports user-provided `excludeSelectors`.
  6. `HtmlNormalizationMiddleware` — Converts relative image/link URLs to absolute, removes tracking pixels, unwraps anchor links and non-HTTP protocol links, simplifies presentational wrappers.
  7. `HtmlToMarkdownMiddleware` — Converts Cheerio DOM to Markdown via TurndownService with GFM support and custom rules (code block language detection, link normalization).
- **Markdown middleware stack**:
  1. `MarkdownMetadataExtractorMiddleware` — Extracts title from YAML frontmatter (`gray-matter`) or first `#` heading.
  2. `MarkdownLinkExtractorMiddleware` — Placeholder (TODO).
- **JS execution**: `HtmlJsExecutorMiddleware` — Sandboxed JS execution via JSDOM + Node `vm`. Fetches external scripts via `context.fetcher`. Warning: not suitable for arbitrary production pages.

## Flow
1. Pipeline constructs middleware array based on content type and options.
2. `BasePipeline.executeMiddlewareStack()` dispatches recursively: `dispatch(0)` → middleware[0].process(ctx, () => dispatch(1)) → ...
3. Each middleware mutates `context` in place, calls `next()`.
4. Final context: `content` = processed Markdown/text, `title`, `links`, `errors`, `contentType` updated.

## Integration
- Consumed by: `HtmlPipeline`, `MarkdownPipeline` (pipelines compose middleware stacks)
- Depends on: Cheerio, TurndownService, Playwright, JSDOM, `ContentFetcher`, `ScraperOptions`, `AppConfig`
