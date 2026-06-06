# src/scraper/utils/

## Responsibility
Shared utility functions for the scraper module: URL scope filtering, pattern matching, charset detection, buffer conversion, llms.txt parsing, LRU caching, and sandboxed JS execution.

## Design
- **scope.ts**: `isInScope(baseUrl, targetUrl, scope)` — checks if a target URL is within crawling scope. Three modes: `subpages` (same host + path prefix), `hostname` (same host), `domain` (same top-level domain via `extractPrimaryDomain`). `computeBaseDirectory()` determines effective parent directory for subpages scope (handles file-like vs directory-like paths). `isPathDescendant()` detects sibling-wise redirects.
- **patternMatcher.ts**: URL include/exclude filtering with glob and regex support. `shouldIncludeUrl(url, includePatterns?, excludePatterns?)` — exclude takes precedence; empty include means all included. `matchesAnyPattern()` supports both `/regex/` syntax and glob patterns via `minimatch`. Matches against full URL, pathname, and file basename (for `file://` URLs). Default exclusion patterns applied when no user patterns provided.
- **defaultPatterns.ts**: Curated lists of default exclusion patterns — files (CHANGELOG, LICENSE, test files, lock files, build artifacts, IDE files) and folders (archive, test, dist, build, i18n non-English locales). `getEffectiveExclusionPatterns()` merges user patterns or falls back to defaults.
- **charset.ts**: `resolveCharset(httpCharset, content, mimeType)` — prioritizes HTML `<meta charset>` tags over HTTP Content-Type headers. `detectCharsetFromHtml()` parses both HTML5 `<meta charset>` and HTML4 `<meta http-equiv>` styles. `normalizeCharset()` maps common aliases (iso-8859-1 → latin1, etc.).
- **buffer.ts**: `convertToString(content, charset?)` — decodes Buffer to string via `iconv-lite` with charset normalization and UTF-8/latin1 fallback chain.
- **llmsTxtParser.ts**: Parses `llms.txt` Markdown format into structured `LlmsTxtResult` (project name, summary, sections with curated links). `isLlmsTxtUrl()` detects meta-file URLs. Validates content structure (requires H1 heading, at least one link).
- **SimpleMemoryCache.ts**: Generic LRU cache backed by `Map` insertion order. `get()`/`has()` promote to MRU. `set()` evicts oldest when full. Used by `HtmlPlaywrightMiddleware` for resource caching.
- **sandbox.ts**: `executeJsInSandbox()` — runs HTML-embedded JavaScript in JSDOM + Node `vm` context. Fetches external scripts via callback. Configurable timeout. Returns final HTML + collected errors. Used by `HtmlJsExecutorMiddleware`.

## Flow
- Scope/pattern utilities called by `BaseScraperStrategy.shouldProcessUrl()` on every discovered URL.
- Charset/buffer utils called by pipelines during content decoding.
- llms.txt parser called by `WebScraperStrategy.probeLlmsTxt()`.
- Cache used by Playwright middleware for sub-resource caching.
- Sandbox called by `HtmlJsExecutorMiddleware` for JS-heavy pages.

## Integration
- Consumed by: strategies, pipelines, middleware across the scraper module
- Depends on: `minimatch`, `iconv-lite`, `jsdom` (via `createJSDOM`), `AppConfig` defaults
