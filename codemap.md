# Repository Atlas: scrapegoat

## Project Responsibility
ScrapeGoat is an MCP (Model Context Protocol) server that provides always-current documentation indexing for AI coding assistants. It fetches official docs from websites, GitHub, npm, PyPI, and local files, allowing LLMs to query exact library versions. It is the open-source alternative to Context7, NiA, and Ref.Tools.

## System Entry Points
- `src/index.ts` — CLI bootstrap: loads env, sanitizes, runs the CLI via `cli/main.ts:runCli()`
- `package.json` — ESM package (`@midnightphreaker/scrapegoat`), bin → `dist/index.js`
- `vite.config.ts` — Vite build config (ESM lib, Node target, shebang injection)
- `vite.config.web.ts` — Separate Vite config for web UI assets
- `Dockerfile` / `docker-compose.yml` — Containerized deployment with PostgreSQL support
- `tsconfig.json` — Strict TS with ESNext modules, bundler resolution, JSX via `@kitajs/html`

## Directory Map
| Directory | Responsibility Summary | Detailed Map |
|-----------|------------------------|--------------|
| `src/app/` | Central Fastify-based application server with modular service composition (MCP, tRPC, WebSocket, worker). | [View Map](src/app/codemap.md) |
| `src/auth/` | Authentication middleware and proxy auth manager for tRPC API. | [View Map](src/auth/codemap.md) |
| `src/cli/` | CLI parsing (commander), command routing, graceful shutdown, and service lifecycle management. | [View Map](src/cli/codemap.md) |
| `src/events/` | Event bus service using EventEmitter, remote event proxy via tRPC subscriptions. | [View Map](src/events/codemap.md) |
| `src/mcp/` | MCP server implementation: stdio transport, tool registration, JSON-RPC handling. | [View Map](src/mcp/codemap.md) |
| `src/pipeline/` | Scraping pipeline orchestration: job queue, worker pool, tRPC-backed job management. | [View Map](src/pipeline/codemap.md) |
| `src/scraper/` | Web scraping engine with strategy pattern: fetcher, middleware pipeline, URL discovery strategies. | [View Map](src/scraper/codemap.md) |
| `src/services/` | Service layer wiring MCP, tRPC, web, and worker services into the AppServer. | [View Map](src/services/codemap.md) |
| `src/splitter/` | Document chunking: greedy, semantic markdown, JSON, text splitters with tree-sitter support. | [View Map](src/splitter/codemap.md) |
| `src/store/` | Document storage layer: SQLite (better-sqlite3) with pgvector embedding, CRUD operations, migration support. | [View Map](src/store/codemap.md) |
| `src/telemetry/` | PostHog analytics integration with PII sanitization and opt-out support. | [View Map](src/telemetry/codemap.md) |
| `src/tools/` | MCP tool implementations: scrape, search, fetch-url, list-libraries, cancel-job, etc. | [View Map](src/tools/codemap.md) |
| `src/types/` | Shared TypeScript type definitions and ambient module declarations. | [View Map](src/types/codemap.md) |
| `src/upload/` | File upload pipeline: archive extraction, import tree building, security validation. | [View Map](src/upload/codemap.md) |
| `src/utils/` | Cross-cutting utilities: config, logging, URL validation, version, paths, MIME types, archives. | [View Map](src/utils/codemap.md) |
| `src/web/` | Web dashboard UI: Fastify routes, AlpineJS components, htmx interactivity, Tailwind CSS. | [View Map](src/web/codemap.md) |

## Architecture Overview

```
entry (src/index.ts, src/cli/main.ts)
  └─► CLI command dispatch
        ├─► "server" / "web" → AppServer (Fastify + tRPC WebSocket + Web UI)
        │     └─► services: MCP, tRPC, web, worker
        │           └─► DocumentStore (SQLite)
        │           └─► PipelineWorker (scrape jobs)
        └─► "mcp" → stdio MCP server
              └─► direct DocumentStore access
```

ScrapeGoat operates in multiple modes:
- **Server mode**: Full HTTP/WebSocket server with web dashboard, API, and background workers
- **MCP stdio mode**: Direct stdio transport for IDE integration (Claude, Cline, etc.)
- **Web-only mode**: Standalone web dashboard

Data flows from scraping jobs through the pipeline (fetcher → middleware → splitter → embeddings) into SQLite storage, then queried via MCP tools or the web dashboard.

## Key Technologies
- **Runtime**: Node.js 22+, ESM
- **Server**: Fastify + WebSocket (ws) + tRPC subscriptions
- **Database**: SQLite via better-sqlite3, with pgvector and sqlite-vec extensions
- **Scraping**: Playwright (headless browser), Turndown (HTML→Markdown), Cheerio
- **Embeddings**: OpenAI / Ollama / local providers via embedding factory
- **Web UI**: AlpineJS, htmx, Tailwind CSS, @kitajs/html (JSX server-side rendering)
- **Testing**: Vitest (unit + e2e), promptfoo (search evaluation)
- **Tooling**: Biome (lint+format), Husky (pre-commit), Vite (build)
