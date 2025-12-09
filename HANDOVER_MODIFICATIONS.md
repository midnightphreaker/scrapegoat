# Handover Plan Modifications for embed.den.lan

**Date**: 2025-12-09
**Context**: Using embed.den.lan with Jina-Embedding-v3 instead of bundled embeddings

---

## Summary of Changes

### Database Migration
✅ **Created**: `db/migrations/014-change-vector-dimensions-jina-v3.sql`
- Changes `VECTOR(1536)` → `VECTOR(1024)`
- Compatible with Jina-Embedding-v3 output dimensions
- Safe because production database was cleared

✅ **Updated**: `src/store/embeddings/EmbeddingConfig.ts`
- Added "Jina-Embedding-v3": 1024 (exact model name from embed.den.lan)

---

## Modified Architecture

### inc-postgres Mode (5 services, was 6)
**Bundled Services:**
- ✅ PostgreSQL 17 with pgvector (bundled)
- ❌ ~~Text-Embeddings-Inference~~ (REMOVED)
- ✅ Worker API (port 8080)
- ✅ MCP Server (port 6280)
- ✅ Web UI (port 6281)
- ✅ Crawl4AI (port 8001)

**External Services:**
- ✅ embed.den.lan (Jina-Embedding-v3, 1024 dims)

### byo-postgres Mode (4 services, unchanged)
**Bundled Services:**
- ✅ Worker API, MCP, Web, Crawl4AI

**External Services:**
- ✅ PostgreSQL (user-provided)
- ✅ embed.den.lan (Jina-Embedding-v3, 1024 dims)

---

## Configuration Changes

### .env.inc-postgres.example (Modified)

```bash
# ============================================================================
# Scrapegoat Configuration - Included PostgreSQL Mode
# ============================================================================
# Includes PostgreSQL, uses external embed.den.lan for embeddings.
# Minimal configuration required - just set a password!

# ----------------------------------------------------------------------------
# DATABASE CONFIGURATION (Auto-configured)
# ----------------------------------------------------------------------------
# PostgreSQL connection auto-configured via docker-compose
POSTGRES_PASSWORD=your-secure-password-here

# Auto-generated: postgresql://scrapegoat:${POSTGRES_PASSWORD}@localhost:5432/scrapegoat

# ----------------------------------------------------------------------------
# EMBEDDING API CONFIGURATION (External Service)
# ----------------------------------------------------------------------------
# Using embed.den.lan with Jina-Embedding-v3
# - 1024 dimensions
# - 8192 token context length
# - OpenAI-compatible API
OPENAI_API_BASE=http://embed.den.lan/v1
OPENAI_API_KEY=not-required
DOCS_MCP_EMBEDDING_MODEL=Jina-Embedding-v3

# ----------------------------------------------------------------------------
# CRAWL4AI CONFIGURATION (Enabled by default)
# ----------------------------------------------------------------------------
CRAWL4AI_ENABLED=true
CRAWL4AI_SERVICE_URL=http://localhost:8001

# ----------------------------------------------------------------------------
# SERVICE PORTS (Default values)
# ----------------------------------------------------------------------------
MCP_PORT=6280
WEB_PORT=6281
WORKER_PORT=8080

# ----------------------------------------------------------------------------
# OPTIONAL CONFIGURATIONS
# ----------------------------------------------------------------------------
POSTHOG_API_KEY=
DOCS_MCP_STORE_PATH=/data
```

### .env.byo-postgres.example (Modified)

```bash
# ============================================================================
# Scrapegoat Configuration - BYO PostgreSQL Mode
# ============================================================================
# Use your own PostgreSQL, external embed.den.lan for embeddings

# ----------------------------------------------------------------------------
# DATABASE CONFIGURATION (Required - User Provided)
# ----------------------------------------------------------------------------
# Your PostgreSQL 14+ with pgvector extension
DATABASE_URL=postgresql://user:password@postgres.den.lan:5432/scrapegoat

# ----------------------------------------------------------------------------
# EMBEDDING API CONFIGURATION (External Service)
# ----------------------------------------------------------------------------
# Using embed.den.lan with Jina-Embedding-v3
# - 1024 dimensions
# - 8192 token context length
# - OpenAI-compatible API
OPENAI_API_BASE=http://embed.den.lan/v1
OPENAI_API_KEY=not-required
DOCS_MCP_EMBEDDING_MODEL=Jina-Embedding-v3

# ----------------------------------------------------------------------------
# CRAWL4AI CONFIGURATION (Enabled by default)
# ----------------------------------------------------------------------------
CRAWL4AI_ENABLED=true
CRAWL4AI_SERVICE_URL=http://localhost:8001

# ----------------------------------------------------------------------------
# SERVICE PORTS (Default values)
# ----------------------------------------------------------------------------
MCP_PORT=6280
WEB_PORT=6281
WORKER_PORT=8080

# ----------------------------------------------------------------------------
# OPTIONAL CONFIGURATIONS
# ----------------------------------------------------------------------------
POSTHOG_API_KEY=
DOCS_MCP_STORE_PATH=/data
```

---

## Docker Compose Changes

### docker-compose.inc-postgres.yml

**REMOVE** the entire `embeddings` service section:
```yaml
# DELETE THIS ENTIRE BLOCK:
#  embeddings:
#    image: ghcr.io/huggingface/text-embeddings-inference:1.5
#    container_name: scrapegoat-embeddings
#    ...
```

**UPDATE** worker service environment:
```yaml
worker:
  environment:
    - OPENAI_API_BASE=http://embed.den.lan/v1
    - OPENAI_API_KEY=not-required
    - DOCS_MCP_EMBEDDING_MODEL=Jina-Embedding-v3
    - CRAWL4AI_ENABLED=true  # Changed from ${CRAWL4AI_ENABLED:-false}
```

**REMOVE** Crawl4AI profile:
```yaml
crawl4ai:
  # DELETE these lines:
  # profiles:
  #   - crawl4ai
```

### docker-compose.byo-postgres.yml

**Same changes** as inc-postgres for worker environment and Crawl4AI profile.

---

## Documentation Changes

### Service Count Updates

**inc-postgres mode:**
- Services: ~~6~~ → **5** (removed embeddings)
- RAM: ~~8-10GB~~ → **6-8GB** (lower without embeddings)
- Disk: ~~20-25GB~~ → **15-20GB** (lower without embeddings)

**Resource Requirements Table:**

| Component | inc-postgres | byo-postgres |
|-----------|--------------|--------------|
| PostgreSQL | Included | External |
| Embeddings | **External (embed.den.lan)** | **External (embed.den.lan)** |
| RAM | 6-8GB | 5-6GB |
| Disk | 15-20GB | 10GB |
| Services | 5 | 4 |

### Quick Start Documentation

**Update service listings** to show embed.den.lan as external:

```markdown
## Included PostgreSQL Deployment

### Services Included

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5432 | Database with pgvector (internal) |
| Worker API | 8080 | Document processing |
| MCP Server | 6280 | Model Context Protocol |
| Web UI | 6281 | Web management interface |
| Crawl4AI | 8001 | AI-optimized web scraping (internal) |

**External Service**: embed.den.lan (Jina-Embedding-v3, 1024 dims)
```

---

## Implementation Checklist

- [x] Create migration 014 for VECTOR(1024)
- [x] Update EmbeddingConfig.ts with Jina-Embedding-v3
- [ ] Remove embeddings service from docker-compose.inc-postgres.yml
- [ ] Update docker-compose.byo-postgres.yml
- [ ] Create .env.inc-postgres.example
- [ ] Update .env.byo-postgres.example
- [ ] Update .env.example
- [ ] Update HANDOVER.md with modified architecture
- [ ] Update DOCKER_QUICKSTART.md with new service counts
- [ ] Update README.md with embed.den.lan reference
- [ ] Test inc-postgres build and startup
- [ ] Test byo-postgres build and startup
- [ ] Verify Jina-Embedding-v3 is used
- [ ] Verify vector storage works with 1024 dims

---

## Key Benefits

✅ **Simpler Deployment**: One less service to manage (5 vs 6 for inc-postgres)
✅ **Lower Resources**: ~2GB less RAM, ~5GB less disk
✅ **Centralized Embeddings**: Single embed.den.lan service for all projects
✅ **Optimal Dimensions**: 1024 dims (vs 1536) = ~33% smaller vectors
✅ **Clean Database**: Fresh start with correct schema from beginning

---

## Testing Notes

After implementation, verify:
1. Migration 014 runs successfully
2. Documents table shows VECTOR(1024) dimension
3. Worker connects to embed.den.lan successfully
4. Embeddings are stored as 1024-dimension vectors
5. Vector search works correctly
6. MCP queries return relevant results

```bash
# Test vector dimension
psql $DATABASE_URL -c "SELECT atttypmod FROM pg_attribute WHERE attrelid = 'documents'::regclass AND attname = 'embedding';"
# Expected: 1028 (1024 + 4 byte header)

# Test embedding
curl http://embed.den.lan/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model":"Jina-Embedding-v3","input":"test"}'
```
