# src/utils/

## Responsibility
Shared utility functions for configuration, logging, URL handling, MIME type detection, path resolution, environment normalization, and error types used across the entire application.

## Design
**config.ts** — layered configuration system merging defaults → YAML/JSON file → environment variables → CLI args (highest wins). Uses Zod schema (`AppConfigSchema`) for validation. Supports auto-update of default config file on startup (materializes new keys), read-only mode for explicit config paths, and `setConfigValue()` CLI command. Env var mapping uses both explicit aliases (legacy `DOCS_MCP_*` → `SCRAPEGOAT_*`) and auto-generated paths from config leaf keys.

**logger.ts** — level-controlled stderr logger (`ERROR`/`WARN`/`INFO`/`DEBUG`) with test suppression via `VITEST_WORKER_ID`. Auto-detects TTY for default level. No external dependencies.

**errors.ts** — scraper-specific error hierarchy: `ScraperError` (base with `isRetryable` flag) → `InvalidUrlError`, `RedirectError`, `ChallengeError`, `TlsCertificateError`.

**url.ts** — URL normalization (trailing slash, hash, index files, case), validation, and primary domain extraction via `psl` (public suffix list). Used for crawl scope and deduplication.

**urlValidation.ts** — SSRF protection: blocks private IPs (10.x, 172.16.x, 192.168.x), loopback (127.x, ::1), link-local (169.254.x, fe80::), and cloud metadata endpoints. Handles both IPv4 and IPv6.

**mimeTypeUtils.ts** — comprehensive MIME type detection from file paths/URLs with a large custom extension→MIME map covering 100+ source code, documentation, config, and document formats. Includes MIME normalization (fixes `mime` package misidentifications) and language extraction for code block formatting.

**paths.ts** — project root discovery (walks up to `package.json`), store path resolution (custom → legacy `.store` → system `env-paths`).

**dom.ts** — JSDOM factory with silenced virtual console.

**env.ts** — environment variable normalization (trims whitespace, strips outer quotes).

**string.ts** — `fullTrim()` for thorough whitespace removal.

**version.ts** — semver-aware version comparison for descending sort with unversioned-as-latest support.

**banner.ts** — ASCII art startup banner with ANSI colors.

## Flow
- Config loaded once at startup via `loadConfig()` → `AppConfig` used everywhere
- Logger configured once, imported as singleton
- URL/MIME utilities called per-request in scraper and search paths

## Integration
- Consumed by: nearly every module in the project
- Depends on: `zod`, `yaml`, `env-paths`, `psl`, `semver`, `jsdom`, `mime`
