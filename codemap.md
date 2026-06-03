# Repository Atlas: scrapegoat

## Project Responsibility

A documentation indexing and search MCP server that scrapes web docs, local files, and package registries, processes content into vector embeddings, and provides semantic search via the Model Context Protocol. Supports CLI, MCP (stdio/HTTP), and web UI interfaces.

## System Entry Points

- `src/index.ts`: Main entry point — loads config, ensures Playwright browsers, routes to CLI.
- `package.json`: Dependency manifest. Binary `scrapegoat` maps to `dist/index.js`. Node.js >= 22.
- `vite.config.ts`: Server build (TypeScript + Vite → Node.js).
- `vite.config.web.ts`: Web asset build (TailwindCSS + HTMX + AlpineJS → static files).

## Directory Map (Aggregated)

| Directory | Responsibility | Detailed Map |
|-----------|---------------|--------------|
| `src/app/` | Unified server composition using `AppServer` — orchestrates service registration, Fastify setup, and lifecycle management. | [View Map](src/app/codemap.md) |
| `src/auth/` | OAuth2 proxy authentication — `ProxyAuthManager` manages tokens, `middleware.ts` guards Fastify routes. | [View Map](src/auth/codemap.md) |
| `src/cli/` | CLI interface — yargs command definitions in `commands/`, output formatting, and service initialization for local mode. | [View Map](src/cli/codemap.md) |
| `src/events/` | Event-driven pub/sub — `EventBusService` decouples producers from consumers; `RemoteEventProxy` bridges distributed events via tRPC/WebSocket. | [View Map](src/events/codemap.md) |
| `src/mcp/` | MCP protocol server — exposes tools as MCP endpoints over stdio or HTTP/SSE transports. | [View Map](src/mcp/codemap.md) |
| `src/pipeline/` | Asynchronous job processing — `PipelineFactory` selects in-process (`PipelineManager`) or remote (`PipelineClient`) execution; `PipelineWorker` orchestrates individual jobs. | [View Map](src/pipeline/codemap.md) |
| `src/scraper/` | Content acquisition — strategy pattern for different sources (web, local, registries), fetcher layer, middleware chains, and content-type pipelines. | [View Map](src/scraper/codemap.md) |
| `src/services/` | Service registration — factory functions that wire up MCP, tRPC, web, and worker services into the AppServer. | [View Map](src/services/codemap.md) |
| `src/splitter/` | Document chunking — semantic splitters (Markdown, JSON, text), size optimization, and Tree-sitter AST-aware code splitting. | [View Map](src/splitter/codemap.md) |
| `src/store/` | Data persistence — SQLite with migrations, document CRUD, hybrid search (vector + FTS with RRF), embedding generation, and search result reassembly. | [View Map](src/store/codemap.md) |
| `src/telemetry/` | Privacy-first analytics — PostHog client with PII sanitization and opt-in configuration. | [View Map](src/telemetry/codemap.md) |
| `src/tools/` | Business logic layer — interface-agnostic tool implementations consumed by CLI, MCP, and web. Handles scraping, search, library management, and job control. | [View Map](src/tools/codemap.md) |
| `src/types/` | Shared TypeScript type definitions and ambient module declarations. | [View Map](src/types/codemap.md) |
| `src/upload/` | File upload — staging service, archive extraction (zip/tar), import tree construction, and security validation. | [View Map](src/upload/codemap.md) |
| `src/utils/` | Common utilities — config loading, environment setup, logging, URL validation, path resolution, version parsing, archive handling. | [View Map](src/utils/codemap.md) |
| `src/web/` | Web interface — Fastify with JSX components (kitajs/TSX), AlpineJS interactivity, HTMX dynamic updates, and TailwindCSS styling. | [View Map](src/web/codemap.md) |

## Architecture Summary

**Unified mode**: Single process — CLI/MCP/Web → PipelineFactory → PipelineManager → PipelineWorker → Scraper → Splitter → Store. Events flow via local EventBus.

**Distributed mode**: Multiple coordinators → PipelineClient (tRPC/HTTP) → shared Worker process. RemoteEventProxy bridges events back to local EventBus.

**Key patterns**: Strategy (scrapers), Factory (pipeline selection, archive adapters), Pub/Sub (EventBus), Write-Through (job state → DB), Middleware Chain (content processing), tRPC (service communication).

## Cross-Cutting Concerns

- **Configuration**: Zod-validated `AppConfig` loaded from defaults < config.yaml < env vars < CLI args (see `src/utils/config.ts`).
- **Logging**: `logger.info` for app events, `console.*` for CLI output, `logger.debug` for granular flow.
- **Error handling**: try/catch at boundaries, standard HTTP codes, job failures stored in DB.
- **Testing**: Vitest, single-file policy (`foo.ts` → `foo.test.ts`), E2E in `test/`.
