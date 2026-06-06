# src/scraper/fetcher/

## Responsibility
Retrieves raw content from HTTP(S), local files, and headless browsers with retry logic, ETag-based conditional requests, SSRF protection, and automatic challenge fallback.

## Design
- **ContentFetcher interface** (`types.ts`): `canFetch(source)` / `fetch(source, options?)` → `RawContent`. Shared `FetchOptions` with signal, headers, etag, timeout, retry config.
- **FetchStatus enum**: `SUCCESS`, `NOT_MODIFIED` (304), `NOT_FOUND` (404/ENOENT) — abstracts HTTP status into semantic states for pipeline consumers.
- **RawContent**: Content buffer/string + metadata (mimeType, charset, encoding, source, etag, lastModified, status).
- **HttpFetcher**: Axios-based HTTP client. Features: exponential backoff retry on 5xx/429/408, SSRF protection (`isUrlAllowed`), browser fingerprint generation (`FingerprintGenerator`), Cloudflare challenge detection → `ChallengeError`, TLS error detection → `TlsCertificateError`, redirect handling (configurable), conditional requests with `If-None-Match`.
- **FileFetcher**: Reads local `file://` URLs. Generates ETag from file mtime MD5 hash. Supports conditional fetch (NOT_MODIFIED) and NOT_FOUND (ENOENT). Uses `MimeTypeUtils.detectMimeTypeFromPath` for type detection.
- **BrowserFetcher**: Playwright/Chromium-based fetcher. Lazy browser launch, single page reuse. Sets realistic headers via `FingerprintGenerator`. Waits for `networkidle`. Handles redirects and ETag extraction.
- **AutoDetectFetcher**: Facade that routes to FileFetcher (file://), HttpFetcher (http/https), with automatic fallback to BrowserFetcher on `ChallengeError` or `TlsCertificateError`.
- **FingerprintGenerator**: Wraps `header-generator` library to produce realistic browser-like HTTP headers (Chrome/Firefox/Safari across OS/device combos).

## Flow
1. `AutoDetectFetcher.fetch(url)` checks protocol → delegates to appropriate fetcher.
2. HTTP path: `HttpFetcher.fetch()` → SSRF check → retry loop with fingerprint headers + conditional request headers → returns `RawContent` or throws typed errors.
3. On `ChallengeError`/`TlsCertificateError`: AutoDetectFetcher falls back to `BrowserFetcher.fetch()` → Playwright navigation → returns rendered HTML.
4. File path: `FileFetcher.fetch()` → stat → ETag comparison → read file → return `RawContent`.

## Integration
- Consumed by: `WebScraperStrategy`, `GitHubScraperStrategy`, middleware (via `MiddlewareContext.fetcher`), pipelines (passed to `process()`)
- Depends on: `AppConfig`, `MimeTypeUtils`, error types (`ChallengeError`, `TlsCertificateError`, `ScraperError`), `isUrlAllowed`
