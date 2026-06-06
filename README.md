<div align="center">

<img src="assets/ScrapeGoat-Banner.svg" alt="ScrapeGoat Logo" width="700">

<br>

**ScrapeGoat: The A.I. Documentation GOAT!**

<br>

</div>

Always-current documentation indexing for AI coding assistants. ScrapeGoat is an
MCP server that fetches official docs from websites, GitHub repositories, npm,
PyPI, and local files, then indexes them for instant retrieval by LLMs. It is
the open-source alternative to Context7, NiA, and Ref.Tools.

## Requirements

- **Node.js** 22 or later
- **PostgreSQL** with [pgvector](https://github.com/pgvector/pgvector) extension
- **Playwright** Chromium browser (auto-installed on first run)
- **Embedding provider** credentials (optional; required for semantic search)

## Quick Start

```bash
cp .env.example .env
npm install
npm run build

# Single-command server (web + MCP + worker):
npm start

# Or run individual modes (see CLI Modes below)
```

## CLI Modes

ScrapeGoat runs in several modes, selectable by the first argument:

| Command | Description |
|---------|-------------|
| `scrapegoat` or `scrapegoat server` | Unified server: web dashboard, MCP, tRPC API, and background worker |
| `scrapegoat mcp` | MCP server only (stdio or HTTP transport) |
| `scrapegoat web` | Web dashboard only |
| `scrapegoat worker` | External pipeline worker (HTTP API only) |
| `scrapegoat scrape <lib> <url>` | Download and index documentation from a URL |
| `scrapegoat refresh <lib>` | Re-scrape a library using ETags for changed pages |
| `scrapegoat search <lib> <query>` | Full-text + vector search across indexed docs |
| `scrapegoat list` | List all indexed libraries and versions |
| `scrapegoat fetch-url <url>` | Fetch a URL and convert to Markdown |
| `scrapegoat config` | View or modify configuration |

Run `scrapegoat --help` for all options.

## MCP Tools

Registered on the MCP server (`scrape_docs`, `search_docs`, etc.) and available
to any MCP-compatible AI coding tool.

### Read Tools (Always Available)

| Tool | Description |
|------|-------------|
| `search_docs` | Search indexed documentation by library, version, and query |
| `list_libraries` | List all indexed libraries |
| `find_version` | Find the best matching version for a library |
| `fetch_url` | Fetch a single URL and return its Markdown content |

### Write Tools (Disabled in Read-Only Mode)

| Tool | Description |
|------|-------------|
| `scrape_docs` | Scrape and index documentation from a URL |
| `refresh_version` | Re-scrape a library version (ETag-aware, only changed pages) |
| `list_jobs` | List all indexing jobs, optionally filtered by status |
| `get_job_info` | Get details for a specific indexing job |
| `cancel_job` | Cancel a queued or running job |
| `clear_completed_jobs` | Remove completed/failed/cancelled jobs from the queue |
| `remove_docs` | Delete indexed documentation for a library |

### MCP Resources

| URI | Description |
|-----|-------------|
| `docs://libraries` | List all indexed libraries |
| `docs://libraries/{library}/versions` | List all indexed versions for a library |
| `docs://jobs` | List indexing jobs (supports `?status=running` filter) |
| `docs://jobs/{jobId}` | Get details for a specific job |

## Configuration

All settings are read from environment variables, YAML/JSON config files, and
CLI flags, in order of increasing priority. Copy `.env.example` to `.env` and
set the values you need.

### Required

| Variable | Description |
|----------|-------------|
| `SCRAPEGOAT_DB_URL` | PostgreSQL connection URL (`postgresql://user:pass@host:5432/db`) |

### Embedding Provider (Choose One)

| Provider | Environment Variables |
|----------|----------------------|
| **OpenAI** (default) | `OPENAI_API_KEY`, optionally `OPENAI_API_BASE` for Ollama/LMStudio |
| **Google Vertex** | `GOOGLE_APPLICATION_CREDENTIALS` (service account JSON path) |
| **Google Gemini** | `GOOGLE_API_KEY` |
| **AWS Bedrock** | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `BEDROCK_AWS_REGION` |
| **Azure OpenAI** | `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_API_INSTANCE_NAME`, `AZURE_OPENAI_API_DEPLOYMENT_NAME` |

### Key Tuning Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SCRAPEGOAT_EMBEDDING_MODEL` | `text-embedding-3-small` | Provider:model spec |
| `SCRAPEGOAT_DB_VECTOR_SIZE` | `1536` | Embedding vector dimension |
| `SCRAPEGOAT_SCRAPER_MAX_CONCURRENCY` | `3` | Concurrent page fetches per job |
| `SCRAPEGOAT_SPLITTER_MIN_CHUNK_SIZE` | `500` | Min chunk size (chars) before merging |
| `SCRAPEGOAT_SPLITTER_PREFERRED_CHUNK_SIZE` | `1500` | Target chunk size |
| `SCRAPEGOAT_SPLITTER_MAX_CHUNK_SIZE` | `5000` | Hard chunk size limit |
| `SCRAPEGOAT_SEARCH_WEIGHT_VEC` | `1` | Vector weight in hybrid RRF scoring |
| `SCRAPEGOAT_SEARCH_WEIGHT_FTS` | `1` | Full-text weight in hybrid RRF scoring |
| `POSTHOG_API_KEY` | _(none)_ | PostHog analytics key (omit to disable) |

See `.env.example` for all variables.

## Deployment

ScrapeGoat can be deployed as a single process or as a distributed system with
separate worker, MCP, and web containers connected via tRPC.

### Standalone (Single Container)

A single container runs the full server (web dashboard + MCP + worker):

```bash
docker compose up -d
```

This mode expects an external PostgreSQL instance reachable at the
`SCRAPEGOAT_DB_URL` you configure in `.env`.

### Distributed (PostgreSQL + Worker + MCP + Web)

A full distributed deployment with a managed PostgreSQL container:

```bash
cp .env.example .env
# Edit .env with your embedding provider credentials
docker compose -f docker-compose.postgres.yml up -d
```

This starts four containers:

| Container | Port | Purpose |
|-----------|------|---------|
| `scrapegoat-postgres` | `5432` | PostgreSQL with pgvector |
| `scrapegoat-worker` | `8080` | Scraping and indexing pipeline (tRPC API) |
| `scrapegoat-server` | `6280` | MCP server endpoint (SSE + Streamable HTTP) |
| `scrapegoat-web` | `6281` | Web management dashboard |

The worker is the authoritative backend. The MCP and web containers connect to
it via `--server-url http://worker:8080/api`. The worker depends on PostgreSQL;
MCP and web depend on the worker being healthy.

### Service Memory Limits

Set in `.env` (applies to Docker Compose only):

```
SCRAPEGOAT_WORKER_MEMORY_LIMIT=2G
SCRAPEGOAT_WORKER_MEMORY_RESERVATION=1G
SCRAPEGOAT_MCP_MEMORY_LIMIT=512M
SCRAPEGOAT_MCP_MEMORY_RESERVATION=256M
SCRAPEGOAT_WEB_MEMORY_LIMIT=512M
SCRAPEGOAT_WEB_MEMORY_RESERVATION=256M
```

## Connecting AI Coding Tools

ScrapeGoat supports three MCP transport protocols: **stdio** (for local tools),
**SSE** (Server-Sent Events), and **Streamable HTTP** (MCP 2025).

### HTTP Endpoints (Server Mode)

When running in server/mcp mode with `--protocol http`:

| Endpoint | Transport | Use |
|----------|-----------|-----|
| `http://<host>:6280/sse` | SSE | Older MCP clients (Claude Desktop, Continue) |
| `http://<host>:6280/messages` | SSE POST endpoint | Paired with `/sse` |
| `http://<host>:6280/mcp` | Streamable HTTP | Modern MCP clients (MCP 2025 spec) |

### OpenCode

OpenCode uses the `opencode.json` or `opencode.jsonc` config file. Add an MCP
server entry:

```jsonc
{
  "mcpServers": {
    "scrapegoat": {
      "command": "npx",
      "args": ["@midnightphreaker/scrapegoat", "mcp"],
      "env": {
        "SCRAPEGOAT_DB_URL": "postgresql://scrapegoat:scrapegoat@localhost:5432/scrapegoat",
        "OPENAI_API_KEY": "${OPENAI_API_KEY}"
      }
    }
  }
}
```

For remote server mode:

```jsonc
{
  "mcpServers": {
    "scrapegoat": {
      "type": "sse",
      "url": "http://localhost:6280/sse"
    }
  }
}
```

### Claude Code

In `.claude/settings.json` or the project `.claude.json`:

```json
{
  "mcpServers": {
    "scrapegoat": {
      "command": "npx",
      "args": ["-y", "@midnightphreaker/scrapegoat", "mcp"],
      "env": {
        "SCRAPEGOAT_DB_URL": "postgresql://scrapegoat:scrapegoat@localhost:5432/scrapegoat",
        "OPENAI_API_KEY": "${OPENAI_API_KEY}"
      }
    }
  }
}
```

### Codex CLI

In `~/.codex/config.toml`:

```toml
[mcp_servers.scrapegoat]
command = "npx"
args = ["-y", "@midnightphreaker/scrapegoat", "mcp"]
env = { SCRAPEGOAT_DB_URL = "postgresql://scrapegoat:scrapegoat@localhost:5432/scrapegoat", OPENAI_API_KEY = "${OPENAI_API_KEY}" }
```

### Cursor

In `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "scrapegoat": {
      "command": "npx",
      "args": ["-y", "@midnightphreaker/scrapegoat", "mcp"],
      "env": {
        "SCRAPEGOAT_DB_URL": "postgresql://scrapegoat:scrapegoat@localhost:5432/scrapegoat",
        "OPENAI_API_KEY": "${OPENAI_API_KEY}"
      }
    }
  }
}
```

### Read-Only Mode

All tools support a `--read-only` flag that disables write operations
(`scrape_docs`, `refresh_version`, `remove_docs`, job management). This is
useful for shared servers where AI clients should only search:

```bash
scrapegoat mcp --protocol http --read-only
```

## Architecture

```
src/index.ts (entry)
  └─► src/cli/main.ts (CLI dispatch)
        ├─► "server" / "mcp" / "web" / "worker" commands
        │     └─► AppServer (Fastify + tRPC + WebSocket)
        │           ├─► MCP service (SSE + Streamable HTTP routes)
        │           ├─► tRPC service (pipeline + store + events routers)
        │           ├─► Web service (AlpineJS + htmx dashboard)
        │           └─► Worker service (PipelineManager)
        │                 └─► PipelineWorker → ScraperService → ScraperRegistry
        │                       ├─► WebScraperStrategy (HTTP docs sites)
        │                       ├─► GitHubScraperStrategy (GitHub repos)
        │                       ├─► LocalFileStrategy (local files/archives)
        │                       ├─► NpmScraperStrategy (npm packages)
        │                       └─► PyPiScraperStrategy (PyPI packages)
        │                             └─► ContentFetcher → ContentPipeline → Splitter
        │                                   └─► DocumentStore (PostgreSQL + pgvector)
        └─► "mcp" (stdio) → StdioServerTransport
              └─► McpServer (tools + resources)
```

### Scraping Pipeline

1. **Fetcher** retrieves raw content (HTTP, file://, headless browser fallback)
2. **Middleware chain** processes content: Playwright render → Cheerio parse
   → metadata extraction → link extraction → sanitization → normalization
   → Turndown (HTML→Markdown)
3. **Splitter** decomposes Markdown into semantically meaningful chunks
   (headings, code blocks, tables, lists) with tree-sitter AST splitting for
   source code
4. **Greedy merger** combines undersized chunks while preserving section
   boundaries
5. **Embedding** generates vector embeddings via configured provider
6. **Storage** writes chunks to PostgreSQL with pgvector indexing

### Search

Hybrid search combines vector similarity and PostgreSQL full-text search using
Reciprocal Rank Fusion (RRF). Results are assembled with content-type-aware
strategies that cluster nearby chunks and expand context (parents, siblings,
children).

### Distributed Mode

In distributed mode, the worker container runs pipeline operations and exposes a
tRPC API. The MCP and web containers connect as tRPC clients. Events
(job status changes, progress updates) propagate from the worker to clients via
tRPC WebSocket subscriptions through the `RemoteEventProxy`.

## Development

```bash
npm install
npm run dev              # Parallel: server in watch mode + web build watch
npm run build            # Build server + web assets
npm test                 # Run all tests
npm run test:unit        # Unit tests only
npm run test:e2e         # End-to-end tests (requires build first)
npm run lint             # Biome check
npm run typecheck        # TypeScript type check
npm run format           # Biome format
```

### Key Technologies

- **Runtime**: Node.js 22 (ESM)
- **Server**: Fastify 5 with WebSocket
- **RPC**: tRPC 11 with superjson serialization
- **Database**: PostgreSQL with pgvector extension
- **Scraping**: Playwright (headless Chromium), Cheerio, Turndown (HTML→Markdown)
- **Embeddings**: LangChain integrations (OpenAI, Google Vertex/Gemini, AWS Bedrock, Azure)
- **Chunking**: remark (Markdown AST), tree-sitter (source code AST), greedy size optimization
- **Web UI**: Fastify server-side JSX (@kitajs/html), AlpineJS, htmx, Tailwind CSS 4
- **Build**: Vite 7
- **Lint/Format**: Biome
- **Testing**: Vitest, promptfoo (search evaluation)

### Project Structure

```
src/
├── app/          Fastify AppServer with modular service composition
├── auth/         OAuth2/OIDC proxy authentication middleware
├── cli/          Yargs-based CLI with command dispatch and lifecycle
├── events/       EventBus (Node EventEmitter) + tRPC remote proxy
├── mcp/          MCP server factory, stdio/SSE/HTTP transports, tool registration
├── pipeline/     Job queue, worker pool, tRPC-backed remote pipeline
├── scraper/      Scraping engine: strategy pattern, fetchers, middleware, pipelines
├── services/     Service registration layer for AppServer composition
├── splitter/     Chunk splitting: semantic Markdown, AST (tree-sitter), JSON, greedy merge
├── store/        PostgreSQL document store, pgvector embeddings, hybrid search, migrations
├── telemetry/    PostHog analytics with PII sanitization
├── tools/        MCP tool implementations (ScrapeTool, SearchTool, etc.)
├── types/        Shared type definitions
├── upload/       File upload staging, archive extraction, import tree builder
├── utils/        Config, logging, URLs, MIME types, SSRF protection
└── web/          Web dashboard: Fastify routes, AlpineJS components, htmx
```

## Attribution

ScrapeGoat began as a fork of
[docs-mcp-server](https://github.com/arabold/docs-mcp-server) by
[arabold](https://github.com/arabold) and
[grounded](https://github.com/grounded). That project established the
foundation — MCP stdio server, documentation scraping, SQLite-backed storage,
and the initial tool set — from which ScrapeGoat grew into its current
PostgreSQL-based, distributed form.

If you prefer a lighter, single-user SQLite-based documentation indexer that
runs without infrastructure, try the original:
[docs-mcp-server](https://github.com/arabold/docs-mcp-server).

## License

MIT
