## Responsibility

Provides the **foundational utility layer** for the entire application: configuration loading and validation, environment variable normalization, structured logging, URL normalization and validation (including SSRF protection), DOM helpers, version comparison, MIME type detection, path resolution, string trimming, error hierarchies, and archive extraction adapters (ZIP/TAR via `archive/` subdirectory).

## Design

- **Zod-Based Config System** (`config.ts`): `AppConfigSchema` defines a deeply nested schema with `DEFAULT_CONFIG` fallbacks. `loadConfig(cliArgs, options)` merges layers — defaults → YAML/JSON file → env vars → CLI args — using `deepMerge`. Auto-writes new defaults to the system config path. Supports `setConfigValue` / `getConfigValue` / `isValidConfigPath` for CLI `config set` commands. Maps env vars via both explicit `configMappings` (legacy aliases like `PORT`, `DOCS_MCP_*`) and auto-generated `SCRAPEGOAT_*` names from `collectLeafPaths`.
- **Levelled Logger** (`logger.ts`): `logger` object with `debug`/`info`/`warn`/`error` methods writing to stderr. Log level set via `LOG_LEVEL` env var, defaults to `INFO` in interactive sessions and `ERROR` otherwise. Suppressed during Vitest runs unless `ENABLE_TEST_LOGS=1`.
- **URL Utilities** (`url.ts`, `urlValidation.ts`): `normalizeUrl` handles case normalization, trailing slash removal, index file stripping, and hash/query control. `extractPrimaryDomain` uses `psl` (public suffix list) for accurate registrable domain extraction. `isUrlAllowed` provides SSRF protection by blocking private IPs (RFC 1918), loopback, link-local, and IPv6 equivalents.
- **Error Hierarchy** (`errors.ts`): `ScraperError` (base with `isRetryable` flag) → `InvalidUrlError`, `RedirectError` (carries `originalUrl`/`redirectUrl`/`statusCode`), `ChallengeError`, `TlsCertificateError`.
- **MIME Type System** (`mimeTypeUtils.ts`): `MimeTypeUtils` static class with `detectMimeTypeFromPath` (200+ extension mappings, query/hash stripping, normalization of conflicting types like `.ts`→TypeScript not MPEG-2), `parseContentType`, `isHtml`/`isMarkdown`/`isJson`/`isPdf`/`isSourceCode`/`isSupportedDocument` predicates, `extractLanguageFromMimeType`, and `isBinary` (null byte heuristic).
- **Version Utilities** (`version.ts`): `compareVersionsDescending` sorts semver strings descending with unversioned entries first; falls back to case-insensitive string comparison for non-semver.
- **Archive Adapters** (`archive/`): `ArchiveAdapter` interface with `TarAdapter` (using `tar` module) and `ZipAdapter` (using `yauzl`). `ArchiveFactory.getArchiveAdapter` selects by file extension. Detection is extension-based to avoid misidentifying DOCX/EPUB/OOXML as ZIP archives.
- **Other Utilities**: `dom.ts` (`createJSDOM` with silenced `VirtualConsole`), `env.ts` (`normalizeEnvValue`, `sanitizeEnvironment`), `paths.ts` (`getProjectRoot` with caching, `resolveStorePath` with legacy `.store` fallback), `string.ts` (`fullTrim`), `banner.ts` (ASCII art startup banner).

## Flow

1. **Startup**: `loadConfig()` reads YAML/JSON config, merges with env vars and CLI args, validates against `AppConfigSchema`, returns typed `AppConfig`.
2. **Runtime**: All modules import `logger` for structured logging, `config` types for configuration access, `url`/`urlValidation` for URL processing, `mimeTypeUtils` for content type detection, and `errors` for typed error construction.
3. **Archive Processing**: `getArchiveAdapter(filePath)` returns the appropriate adapter; callers iterate `listEntries()`, then `getContent(path)` or `getStream(path)` for specific files.
4. **SSRF Protection**: `isUrlAllowed(url)` is called before any outbound HTTP request to block private/internal addresses.

## Integration

- **Consumed by**: Virtually every module in the application — `src/scraper/`, `src/pipeline/`, `src/store/`, `src/tools/`, `src/upload/`, `src/web/`, `src/events/`.
- **Depends on**: `zod` (schema validation), `yaml` (config parsing), `jsdom` (DOM), `psl` (public suffix list), `mime` (MIME detection), `semver` (version comparison), `env-paths` (system paths), `tar`, `yauzl` (archive handling).
