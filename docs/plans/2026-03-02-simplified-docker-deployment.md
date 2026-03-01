# Simplified Docker Deployment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate Docker deployment into a single docker-compose.yml with 2 containers (scrapegoat + crawl4ai) that works out-of-the-box with existing PostgreSQL, with an optional commented section for dedicated PostgreSQL.

**Architecture:** Single Scrapegoat container runs all services (web, mcp, api, worker) on port 6280 using the default unified server. Separate Crawl4AI Python microservice on port 8001. User provides existing PostgreSQL via DATABASE_URL, or uncomment the postgres service for a dedicated database.

**Tech Stack:** Docker Compose, PostgreSQL 16, Node.js 22, Python FastAPI (Crawl4AI)

---

## Prerequisites

- [ ] Docker and Docker Compose installed
- [ ] PostgreSQL database accessible (existing OR will use dedicated)
- [ ] OpenAI API key (or compatible embedding provider)

---

## Task 1: Create Unified docker-compose.yml

**Files:**
- Create: `docker-compose.yml`

**Step 1: Create the new unified docker-compose.yml**

```yaml
# Scrapegoat - MCP Documentation Server
#
# Quick Start:
#   1. cp .env.example .env
#   2. Edit DATABASE_URL in .env
#   3. Edit OPENAI_API_KEY (or other provider) in .env
#   4. docker compose up -d
#
# For dedicated PostgreSQL: Uncomment the 'postgres' service below

services:
  scrapegoat:
    image: ${SCRAPEGOAT_IMAGE:-git.fenrirsden.org/pub/scrapegoat:latest}
    pull_policy: always
    container_name: scrapegoat
    ports:
      - "${SCRAPEGOAT_PORT:-6280}:6280"
    environment:
      - DATABASE_URL=${DATABASE_URL:?DATABASE_URL is required}
      - OPENAI_API_BASE=${OPENAI_API_BASE:-https://api.openai.com/v1}
      - OPENAI_API_KEY=${OPENAI_API_KEY:-}
      - DOCS_MCP_EMBEDDING_MODEL=${DOCS_MCP_EMBEDDING_MODEL:-openai:text-embedding-3-small}
      - VECTOR_DIMENSION=${VECTOR_DIMENSION:-1536}
      - DOCS_MCP_STORE_PATH=/data
      - CRAWL4AI_SERVICE_URL=http://crawl4ai:8001
      - NODE_ENV=production
    volumes:
      - scrapegoat-data:/data
    networks:
      - scrapegoat-net
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:6280/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  crawl4ai:
    image: ${CRAWL4AI_IMAGE:-unclecode/crawl4ai:latest}
    pull_policy: always
    container_name: scrapegoat-crawl4ai
    ports:
      - "${CRAWL4AI_PORT:-8001}:8001"
    environment:
      - CRAWL4AI_PORT=8001
    networks:
      - scrapegoat-net
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s

networks:
  scrapegoat-net:
    driver: bridge

volumes:
  scrapegoat-data:

# ═══════════════════════════════════════════════════════════════════════════
# OPTIONAL: Dedicated PostgreSQL Database
# ═══════════════════════════════════════════════════════════════════════════
# Uncomment this section and the depends_on lines above to deploy a dedicated
# PostgreSQL database for Scrapegoat.
#
# When using this PostgreSQL:
#   1. Comment out the DATABASE_URL line in scrapegoat environment
#   2. Uncomment the DATABASE_URL line below (hardcoded connection)
#   3. Uncomment depends_on: [postgres] in scrapegoat service
#
# postgres:
#   image: postgres:16-alpine
#   container_name: scrapegoat-postgres
#   environment:
#     POSTGRES_USER: scrapegoat
#     POSTGRES_PASSWORD: scrapegoat
#     POSTGRES_DB: scrapegoat
#   volumes:
#     - scrapegoat-pgdata:/var/lib/postgresql/data
#   networks:
#     - scrapegoat-net
#   restart: unless-stopped
#   healthcheck:
#     test: ["CMD-SHELL", "pg_isready -U scrapegoat -d scrapegoat"]
#     interval: 5s
#     timeout: 5s
#     retries: 5
#
# Then in the scrapegoat service above, replace:
#   - DATABASE_URL=${DATABASE_URL:?DATABASE_URL is required}
# With:
#   - DATABASE_URL=postgresql://scrapegoat:scrapegoat@postgres:5432/scrapegoat
# And add:
#   depends_on:
#     postgres:
#       condition: service_healthy
#
# volumes:
#   scrapegoat-pgdata:
```

**Step 2: Verify file syntax**

Run: `docker compose config`
Expected: No errors, shows service configuration

**Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add unified docker-compose.yml for simplified deployment"
```

---

## Task 2: Create Consolidated .env.example

**Files:**
- Modify: `.env.example`

**Step 1: Replace .env.example with consolidated version**

```bash
# ═══════════════════════════════════════════════════════════════════════════
# Scrapegoat Configuration
# ═══════════════════════════════════════════════════════════════════════════
# Copy this file to .env and configure for your environment
#   cp .env.example .env

# ─────────────────────────────────────────────────────────────────────────────
# REQUIRED: Database Connection
# ─────────────────────────────────────────────────────────────────────────────
# PostgreSQL connection string (required for all deployments)
# Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
DATABASE_URL=postgresql://scrapegoat:scrapegoat@localhost:5432/scrapegoat

# ─────────────────────────────────────────────────────────────────────────────
# REQUIRED: Embedding Provider
# ─────────────────────────────────────────────────────────────────────────────
# OpenAI API (default)
OPENAI_API_BASE=https://api.openai.com/v1
OPENAI_API_KEY=sk-your-openai-api-key-here

# Alternative providers (uncomment and configure one):
# For Azure OpenAI:
# OPENAI_API_BASE=https://your-resource.openai.azure.com/openai/deployments/your-deployment
# OPENAI_API_KEY=your-azure-api-key

# For Google AI:
# GOOGLE_GENAI_API_KEY=your-google-api-key

# Embedding model configuration (format: provider:model-name)
DOCS_MCP_EMBEDDING_MODEL=openai:text-embedding-3-small

# Vector dimension (must match embedding model)
# text-embedding-3-small: 1536
# text-embedding-3-large: 3072
VECTOR_DIMENSION=1536

# ─────────────────────────────────────────────────────────────────────────────
# OPTIONAL: Docker Image Overrides
# ─────────────────────────────────────────────────────────────────────────────
# Override default images (useful for development or custom builds)
# SCRAPEGOAT_IMAGE=git.fenrirsden.org/pub/scrapegoat:latest
# CRAWL4AI_IMAGE=unclecode/crawl4ai:latest

# ─────────────────────────────────────────────────────────────────────────────
# OPTIONAL: Port Configuration
# ─────────────────────────────────────────────────────────────────────────────
# Override default ports if they conflict with your setup
# SCRAPEGOAT_PORT=6280
# CRAWL4AI_PORT=8001
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "feat: consolidate .env.example with all deployment options"
```

---

## Task 3: Update README.md Quick Start

**Files:**
- Modify: `README.md`

**Step 1: Add Quick Start section to README.md**

Find the existing Quick Start or Getting Started section and replace with:

```markdown
## Quick Start

### Docker Deployment (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/your-org/scrapegoat.git
cd scrapegoat

# 2. Configure environment
cp .env.example .env
# Edit .env and set:
#   - DATABASE_URL (your PostgreSQL connection)
#   - OPENAI_API_KEY (or other embedding provider)

# 3. Start services
docker compose up -d

# 4. Verify
docker compose ps
curl http://localhost:6280/health
```

**Access Points:**
- Web UI: http://localhost:6280
- MCP HTTP: http://localhost:6280/mcp
- API: http://localhost:6280/api
- Crawl4AI: http://localhost:8001

### With Dedicated PostgreSQL

Uncomment the `postgres` service section in `docker-compose.yml` and update the `DATABASE_URL` as documented in the comments.

### Manual Setup

For development or non-Docker deployments, see [CONTRIBUTING.md](CONTRIBUTING.md).
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update Quick Start for simplified Docker deployment"
```

---

## Task 4: Remove Old Compose Files

**Files:**
- Delete: `docker-compose.byo-postgres.yml`
- Delete: `docker-compose.builtin-postgres.yml`
- Delete: `.env.byo-postgres.example`
- Keep: `docker-compose-build-containers.yml` (used for building images)

**Step 1: Delete deprecated files**

```bash
git rm docker-compose.byo-postgres.yml docker-compose.builtin-postgres.yml .env.byo-postgres.example
```

**Step 2: Commit**

```bash
git commit -m "refactor: remove deprecated docker-compose variants in favor of unified deployment"
```

---

## Task 5: Verify Deployment Works

**Step 1: Create test environment**

```bash
cp .env.example .env
# Manually set a test DATABASE_URL and OPENAI_API_KEY
```

**Step 2: Pull and start**

```bash
docker compose pull
docker compose up -d
```

**Step 3: Verify services**

```bash
# Check containers are running
docker compose ps

# Check scrapegoat health
curl http://localhost:6280/health

# Check crawl4ai health
curl http://localhost:8001/health
```

**Step 4: Verify logs for errors**

```bash
docker compose logs scrapegoat
docker compose logs crawl4ai
```

**Step 5: Cleanup**

```bash
docker compose down
```

---

## Task 6: Final Commit and Summary

**Step 1: Review all changes**

```bash
git status
git log --oneline -5
```

**Step 2: Push changes (if ready)**

```bash
git push origin main
```

---

## Verification Checklist

After implementation, verify:

- [ ] `docker compose config` shows valid configuration
- [ ] `docker compose up -d` starts 2 containers (scrapegoat, crawl4ai)
- [ ] Scrapegoat accessible at http://localhost:6280
- [ ] Crawl4AI accessible at http://localhost:8001/health
- [ ] No errors in container logs
- [ ] `.env.example` has all required variables documented
- [ ] README.md Quick Start is accurate
- [ ] Old compose files removed from repository

---

## Notes

- The unified server runs on a single port (6280) by default
- All services (web, mcp, api, worker) are handled by one Node.js process
- Crawl4AI remains a separate container due to Python/runtime differences
- Bridge networking is used for better container isolation
- Users can override any default port via environment variables
