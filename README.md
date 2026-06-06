<div align="center">

<img src="assets/ScrapeGoat-Banner.svg" alt="ScrapeGoat Logo" width="700">

<br>

**ScrapeGoat: The A.I. Documentation GOAT!**

<br>

</div>

Always-current documentation indexing for AI coding assistants. ScrapeGoat is
deployed via `git clone` and `docker compose` -- containers are built locally, no
images are published to any registry. It exposes a built-in remote
HTTP/SSE/Streamable MCP endpoint that AI coding tools connect to. It fetches
official docs from websites, GitHub repositories, npm, PyPI, and local files,
indexes them into PostgreSQL with pgvector embeddings, and serves them on
demand. It is the open-source alternative to Context7, NiA, and Ref.Tools.

## Quick Start

```bash
git clone https://git.phrk.org/pub/scrapegoat.git
cd scrapegoat
cp .env.example .env
# Edit .env with your embedding provider credentials
docker compose -f docker-compose.postgres.yml up -d
```

On first launch, Docker Compose builds the container images locally. Subsequent
starts use the cached images unless you rebuild with `--build`.

This starts PostgreSQL with pgvector, a background worker for scraping and
indexing, and an MCP server listening on port 6280. AI clients connect to
`http://<host>:6280/mcp` (Streamable HTTP) or `http://<host>:6280/sse` (SSE).

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

## Deployment Options

ScrapeGoat images are built locally via Docker Compose -- they are not published
to Docker Hub or any container registry. The `build` section in each Compose
file handles this automatically on first run.

| File | Use Case |
|------|----------|
| `docker-compose.postgres.yml` | Full stack with managed PostgreSQL (recommended) |
| `docker-compose.yml` | Standalone: requires external PostgreSQL at `SCRAPEGOAT_DB_URL` |

### Containers

| Container | Port | Purpose |
|-----------|------|---------|
| `scrapegoat-postgres` | `5432` | PostgreSQL with pgvector |
| `scrapegoat-worker` | `8080` | Scraping and indexing pipeline (tRPC API) |
| `scrapegoat-server` | `6280` | MCP server endpoint (SSE + Streamable HTTP) |
| `scrapegoat-web` | `6281` | Web management dashboard |

The worker is the authoritative backend. The MCP and web containers connect to
it via `--server-url http://worker:8080/api` and depend on worker health.

### Memory Limits

Set in `.env`:

```
SCRAPEGOAT_WORKER_MEMORY_LIMIT=2G
SCRAPEGOAT_WORKER_MEMORY_RESERVATION=1G
SCRAPEGOAT_MCP_MEMORY_LIMIT=512M
SCRAPEGOAT_MCP_MEMORY_RESERVATION=256M
SCRAPEGOAT_WEB_MEMORY_LIMIT=512M
SCRAPEGOAT_WEB_MEMORY_RESERVATION=256M
```

### Reverse Proxy with nginx

To serve ScrapeGoat behind a domain with HTTPS, use the config below. It proxies
the web dashboard (port 6281) and MCP endpoints (port 6280), redirects HTTP to
HTTPS, and allows uploads up to 1 GB.

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ""      close;
}

upstream scrapegoat_web {
    server 127.0.0.1:6281;
    keepalive 32;
}

upstream scrapegoat_mcp {
    server 127.0.0.1:6280;
}

server {
    listen 80 default_server;
    server_name _;

    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl default_server;
    http2 on;
    server_name scrapegoat.example.com;

    client_max_body_size 1024M;

    ssl_certificate /path/to/certificate.pem;
    ssl_certificate_key /path/to/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;

    location /mcp {
        proxy_buffering off;
        proxy_set_header Connection close;
        proxy_pass http://scrapegoat_mcp;
    }

    location /sse {
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Connection close;
        proxy_pass http://scrapegoat_mcp;
    }

    location /messages {
        proxy_buffering off;
        proxy_set_header Connection close;
        proxy_pass http://scrapegoat_mcp;
    }

    location / {
        proxy_pass http://scrapegoat_web;
    }
}
```

1. Save the config to `/etc/nginx/sites-available/scrapegoat` (the standalone
   file is also at `docs/infrastructure/nginx-reverse-proxy.conf`).

2. Replace the placeholders with your own values:

   | Placeholder | Replace With |
   |-------------|-------------|
   | `127.0.0.1:6281` | IP and port of the web container |
   | `127.0.0.1:6280` | IP and port of the MCP container |
   | `scrapegoat.example.com` | Your domain name |
   | `/path/to/certificate.pem` | Path to your TLS certificate |
   | `/path/to/private.key` | Path to your private key |

3. Enable the site and test the config:

   ```bash
   ln -s /etc/nginx/sites-available/scrapegoat /etc/nginx/sites-enabled/scrapegoat
   nginx -t
   systemctl reload nginx
   ```

4. AI tools then connect at `https://scrapegoat.example.com/mcp` (Streamable
   HTTP) or `https://scrapegoat.example.com/sse` (SSE). The web dashboard is at
   `https://scrapegoat.example.com/`.

## Connecting AI Coding Tools

The MCP server exposes two remote transport endpoints. Connect over HTTP after
starting the Docker containers.

### Remote (HTTP/SSE) -- Recommended

When ScrapeGoat is running via Docker, AI tools connect over HTTP:

| Endpoint | Transport | Use |
|----------|-----------|-----|
| `http://<host>:6280/mcp` | Streamable HTTP | Modern MCP clients (MCP 2025 spec) |
| `http://<host>:6280/sse` | SSE | Older clients (Claude Desktop, Continue) |
| `http://<host>:6280/messages` | SSE POST endpoint | Paired with `/sse` |

#### OpenCode

In `opencode.json` or `opencode.jsonc`, under the top-level `mcp` key:

```jsonc
{
  "mcp": {
    "scrapegoat": {
      "type": "remote",
      "url": "http://localhost:6280/mcp",
      "enabled": true
    }
  }
}
```

#### Claude Code

In `.claude/settings.json` or `.claude.json`:

```json
{
  "mcpServers": {
    "scrapegoat": {
      "type": "url",
      "url": "http://localhost:6280/mcp"
    }
  }
}
```

#### Codex CLI

In `~/.codex/config.toml`:

```toml
[mcp_servers.scrapegoat]
url = "http://localhost:6280/mcp"
```

#### Cursor

In `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "scrapegoat": {
      "url": "http://localhost:6280/mcp"
    }
  }
}
```

### Read-Only Mode

Set `SCRAPEGOAT_READ_ONLY=true` in the environment to disable write operations
(`scrape_docs`, `refresh_version`, `remove_docs`, job management). This is
useful for shared servers where clients should only search.

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

Standard workflow for building and testing locally:

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
