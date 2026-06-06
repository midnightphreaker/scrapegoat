# src/

## Responsibility
Core source tree for the ScrapeGoat MCP server — an extensible documentation indexing and search system for AI coding assistants.

## Design
Layered architecture with clear separation of concerns:

- **Entry Layer** (`index.ts`, `app/`, `cli/`) — bootstrap, CLI parsing, service lifecycle
- **Service Layer** (`services/`, `events/`, `auth/`) — wires components together into runnable servers
- **Domain Layer** (`scraper/`, `pipeline/`, `splitter/`, `tools/`, `upload/`) — core business logic
- **Data Layer** (`store/`, `store/embeddings/`) — PostgreSQL-backed document storage with vector search
- **Transport Layer** (`mcp/`, `web/`) — MCP stdio server + Fastify web dashboard
- **Cross-cutting** (`utils/`, `types/`, `telemetry/`) — shared utilities, config, logging, analytics

Uses dependency injection (constructor injection) throughout. Services are composed in `AppServer` and connected via tRPC for cross-process communication (WebSocket for browser ↔ server, in-process for CLI mode).

## Flow
1. `src/index.ts` boots: loads env, sanitizes, initializes Playwright, delegates to CLI
2. CLI parses command → configures `AppServerConfig` (which services to enable)
3. `AppServer` creates Fastify instance, registers services conditionally
4. MCP tools register on the MCP server → execute via `PipelineManager` → `ScraperService`
5. Scraped documents flow through `PipelineWorker` → fetcher → middleware → splitter → `DocumentStore`
6. Search queries hit `DocumentRetrieverService` → embedding generation → vector similarity → results
7. Web dashboard connects via tRPC WebSocket for real-time job progress

## Integration
- Consumed by: `dist/index.js` (compiled entry point), Docker entrypoint
- Depends on: external packages (Fastify, pg, Playwright, tRPC, etc.)

## Directory Map
| Directory | Responsibility | Map |
|-----------|---------------|-----|
| `app/` | Modular Fastify server with service composition | [Map](app/codemap.md) |
| `auth/` | OAuth2/OIDC proxy auth middleware | [Map](auth/codemap.md) |
| `cli/` | CLI command routing and service lifecycle | [Map](cli/codemap.md) |
| `events/` | Typed event bus with remote tRPC proxy | [Map](events/codemap.md) |
| `mcp/` | MCP stdio server and JSON-RPC handler | [Map](mcp/codemap.md) |
| `pipeline/` | Scrape job queue, worker pool, tRPC API | [Map](pipeline/codemap.md) |
| `scraper/` | Web scraping engine with strategy pattern | [Map](scraper/codemap.md) |
| `services/` | Service registration layer for AppServer | [Map](services/codemap.md) |
| `splitter/` | Document chunking (greedy, semantic, tree-sitter) | [Map](splitter/codemap.md) |
| `store/` | PostgreSQL document store with pgvector embeddings | [Map](store/codemap.md) |
| `telemetry/` | PostHog analytics with PII sanitization | [Map](telemetry/codemap.md) |
| `tools/` | MCP tool implementations | [Map](tools/codemap.md) |
| `types/` | Shared type definitions | [Map](types/codemap.md) |
| `upload/` | File upload and archive extraction | [Map](upload/codemap.md) |
| `utils/` | Cross-cutting utilities | [Map](utils/codemap.md) |
| `web/` | Web dashboard (Fastify + AlpineJS + htmx) | [Map](web/codemap.md) |
