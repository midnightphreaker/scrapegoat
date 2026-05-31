# Orchestrator Journal — ScrapeGoat

## Session 1: Docker Setup — ✅ COMPLETE

### Objective
Set up scrapegoat using `docker-compose.postgres.yml` on this server with:
- Embedding endpoint: `http://10.9.9.11:8080/v1` (no API key, model: `text-embedding`, OpenAI-compatible)
- Bind all services to IP `10.9.9.20`

### Service Endpoints (all running)
| Service | Container | URL | Status |
|---------|-----------|-----|--------|
| PostgreSQL | `scrapegoat-postgres` | `10.9.9.20:5432` | healthy |
| Worker | `scrapegoat-worker` | `http://10.9.9.20:8080` | healthy |
| MCP SSE | `scrapegoat-mcp` | `http://10.9.9.20:6280/sse` | HTTP 200 |
| Web UI | `scrapegoat-web` | `http://10.9.9.20:6281` | HTTP 200 |

### Files Modified
- `.env` — Created with embedding config
- `docker-compose.postgres.yml` — Port bindings to `10.9.9.20`, web service command fixed

---

## Session 2: Issue #15 Rebrand — ✅ PR CREATED

### Objective
Complete the full ScrapeGoat rebrand per https://git.phrk.org/pub/scrapegoat/issues/15

### PR
- **URL**: https://git.phrk.org/pub/scrapegoat/pulls/20
- **Branch**: `chore/15-rebrand-references-to-scrapegoat`
- **Base**: `main`

### What Changed
- **`DOCS_MCP_*` → `SCRAPEGOAT_*`** env vars (with backward-compat aliases + deprecation warnings)
- Config paths: `~/.config/scrapegoat/` (falls back to old `~/.config/docs-mcp-server/`)
- All source strings, CLI help, web UI branding
- All documentation, skills, openspec files
- Docker/compose files, package.json
- Assets renamed (`docs-mcp-server.png` → `scrapegoat.png`)

### Verification
- ✅ Lint (0 issues)
- ✅ Typecheck (0 errors)
- ✅ Tests (all pass)
- ✅ Build (success)

### Intentionally Retained References
- **CHANGELOG.md**: ~427 historical `github.com/arabold` URLs (factual commit records)
- **UPSTREAM_CHANGES.md**: Fork history preserved
- **config.test.ts**: `DOCS_MCP_*` env var tests for backward-compat fallback path

### Issue NOT closed — requires MidnightPhreaker permission

---

## Bugs Found — Track for Source Fixes

### 1. Web `--server-url` causes silent hang
- Web container with `--server-url` silently hangs (WebSocket tRPC client fails)
- Workaround: removed `--server-url` from compose; web uses embedded local worker
- Source fix needed: use HTTP transport or handle WS failure gracefully
- Files: `src/cli/commands/web.ts`, `src/tRPC/PipelineClient.ts`

### 2. `npm warn deprecated boolean@3.2.0`
- Non-blocking during Docker build `npm install`
- Reproduce: `docker compose -f docker-compose.postgres.yml build --no-cache`

### 3. Web `--host` CLI arg ignored
- Web subcommand doesn't respect `--host 0.0.0.0` (MCP command does)
- Workaround: `DOCS_MCP_HOST=0.0.0.0` env var (now `SCRAPEGOAT_HOST=0.0.0.0` after rebrand)
- Files: `src/cli/commands/web.ts`, `src/server/AppServer.ts`
