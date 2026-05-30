# Orchestrator Journal — ScrapeGoat Docker Setup

## Objective
Set up scrapegoat using `docker-compose.postgres.yml` on this server with:
- Embedding endpoint: `http://10.9.9.11:8080/v1` (no API key, model: `text-embedding`, OpenAI-compatible)
- Bind all services to IP `10.9.9.20`
- Avoid conflicts with existing postgres containers

## Status: ✅ COMPLETE — All 4 services running and verified

### Service Endpoints
| Service | Container | URL | Status |
|---------|-----------|-----|--------|
| PostgreSQL | `scrapegoat-postgres` | `10.9.9.20:5432` | healthy |
| Worker | `scrapegoat-worker` | `http://10.9.9.20:8080` | healthy |
| MCP SSE | `scrapegoat-mcp` | `http://10.9.9.20:6280/sse` | HTTP 200 |
| Web UI | `scrapegoat-web` | `http://10.9.9.20:6281` | HTTP 200 |

### Embedding Config
- Endpoint: `http://10.9.9.11:8080/v1` (OpenAI-compatible)
- Model: `openai:text-embedding`
- No API key needed (`OPENAI_API_KEY=not-needed` placeholder)

### Files Modified
- `.env` — Created with embedding config
- `docker-compose.postgres.yml` — Port bindings changed to `10.9.9.20:port:port` for all services; web service command changed; `DOCS_MCP_HOST` env var added to web service; `scrapegoat-data:/data` volume added to web service

---

## Issues Found During Setup — Track for Source Fixes

### 1. Web `--server-url` causes silent hang (BUG)
- **Symptom**: Web container with `--server-url http://worker:8080/api` silently hangs — app binds to `127.0.0.1:random_port` instead of `0.0.0.0:6281`. Zero logs.
- **Root cause**: `PipelineClient` (used when `--server-url` is provided) creates a `createWSClient` WebSocket connection. When the worker's tRPC API doesn't support WebSocket transport, the connection hangs silently and the web server never starts properly.
- **Fix applied in compose**: Removed `--server-url` from web service command. Web service now uses embedded local worker with direct PostgreSQL access instead of connecting to the worker via WebSocket.
- **Source fix needed**: The web command's `--server-url` mode should either:
  - Use HTTP transport instead of WebSocket for tRPC client
  - Properly error/handle when WebSocket connection fails
  - Log something instead of silently hanging
- **Files**: `src/cli/commands/web.ts`, likely `src/tRPC/PipelineClient.ts` or similar

### 2. `npm warn deprecated boolean@3.2.0` during Docker build
- **Symptom**: `npm warn deprecated boolean@3.2.0: Package no longer supported` appears during `npm install` in Dockerfile build step
- **Impact**: Non-blocking warning, build succeeds. But the deprecated package should be removed or replaced.
- **Source fix needed**: Find which dependency transitively depends on `boolean@3.2.0` and either update the parent or find an alternative.
- **How to reproduce**: `docker compose -f docker-compose.postgres.yml build --no-cache`

### 3. `DOCS_MCP_HOST=0.0.0.0` needed despite `--host 0.0.0.0` CLI arg
- **Symptom**: The web service ignores `--host 0.0.0.0` CLI argument and defaults to `127.0.0.1`
- **Workaround**: Added `DOCS_MCP_HOST=0.0.0.0` environment variable to the web service
- **Note**: The MCP command (`mcp --host 0.0.0.0`) works fine — issue is specific to the web command
- **Source fix needed**: The web subcommand should respect `--host` the same way the MCP subcommand does
- **Files**: `src/cli/commands/web.ts`, `src/server/AppServer.ts`, `src/utils/config.ts`
