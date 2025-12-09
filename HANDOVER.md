# Scrapegoat Docker Deployment Simplification - Technical Handover

**Date**: 2025-12-07
**Objective**: Simplify Docker deployment to two modes (inc-postgres, byo-postgres) with Crawl4AI as default
**Status**: Ready for Implementation
**Context Usage**: 67% (133k/200k tokens) - Handover required for next session

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Assessment](#current-state-assessment)
3. [Problems Identified](#problems-identified)
4. [Technical Requirements](#technical-requirements)
5. [Implementation Plan](#implementation-plan)
6. [File Operations Reference](#file-operations-reference)
7. [Testing & Validation](#testing--validation)
8. [Success Criteria](#success-criteria)

---

## Executive Summary

### What We're Doing

Transforming Scrapegoat from a complex multi-file deployment into a **simple two-mode Docker deployment**:

1. **inc-postgres** - Included PostgreSQL (easiest, all services bundled)
2. **byo-postgres** - Bring Your Own PostgreSQL (production, external services)

### Key Changes

- **Crawl4AI**: Default scraper, always enabled (no profile flag)
- **Repository**: Clean root directory, archive planning docs
- **Deployment**: Two docker-compose files only, clear .env templates
- **Documentation**: Docker-first README, comprehensive quick start guide

### Why This Matters

Current deployment is confusing with files scattered in `projects/docker-deployment-planning/`, unclear naming, and complex configuration. Shane wants deployment as simple as upstream docs-mcp-server but maintaining Scrapegoat's advanced features.

---

## Current State Assessment

### What Works

✅ **Core Application**: Production-ready, v2.0.0 deployed to docs.den.lan
✅ **Dockerfile**: Already has `--legacy-peer-deps` flags (lines 23, 32)
✅ **Database Migrations**: Automatic via DocumentStore.initialize()
✅ **Crawl4AI Service**: Functional Python/FastAPI service in `services/crawl4ai/`
✅ **Planned Docker Compose**: Files exist in `projects/docker-deployment-planning/configurations/`

### Current Architecture

**Multi-Service System**:
- **Worker API** (Node.js, port 8080) - Document processing, background jobs
- **MCP Server** (Node.js, port 6280) - Model Context Protocol
- **Web UI** (Node.js, port 6281) - Web interface
- **Crawl4AI** (Python/FastAPI, port 8001) - Advanced web scraping
- **PostgreSQL** (Optional bundled or external) - Database with pgvector
- **Embeddings** (Optional bundled or external) - Text-Embeddings-Inference

### Repository Structure (Current)

```
/zfs/Workspace/scrapegoat/
├── src/                          # TypeScript source code
├── services/crawl4ai/            # Python Crawl4AI service
├── db/migrations/                # PostgreSQL migrations
├── docs/                         # Documentation (some)
├── projects/                     # Planning documents
│   └── docker-deployment-planning/
│       └── configurations/
│           ├── docker-compose.aio.yml    # ← Need to move
│           └── docker-compose.byo.yml    # ← Need to move
├── docker-compose.yml            # Current (needs cleanup)
├── docker-compose.test.yml       # Testing only
├── Dockerfile                    # ✅ Already fixed with --legacy-peer-deps
├── .env.example                  # ⚠️ Outdated (shows SQLite)
├── .env.byo.example              # ✅ Correct format
├── README.md                     # Needs updating
└── [40+ other .md files]         # ← CLUTTER TO CLEAN

```

### Key Files Location Reference

**Deployment Files (Currently)**:
- `projects/docker-deployment-planning/configurations/docker-compose.aio.yml`
- `projects/docker-deployment-planning/configurations/docker-compose.byo.yml`
- `.env.byo.example` (root)
- `.env.example` (root, outdated)

**Crawl4AI Service**:
- `services/crawl4ai/Dockerfile`
- `services/crawl4ai/app/` (Python FastAPI application)
- `services/crawl4ai/requirements.txt`

---

## Problems Identified

### 1. Docker Compose Files Hidden

**Problem**: Docker compose files buried in `projects/docker-deployment-planning/configurations/`
**Impact**: Users can't find deployment files
**Solution**: Move to root with clear names

### 2. Crawl4AI Optional via Profile

**Current**: `docker-compose.yml` uses `profiles: [crawl4ai]` flag
**Problem**: Users don't know to add `--profile crawl4ai`
**Requirement**: Crawl4AI should ALWAYS run (Shane's requirement #1)
**Solution**: Remove profile flag, enable by default

### 3. Build Context Paths Wrong

**Current**: `context: ../..` in docker-compose files
**Problem**: Paths are relative to `projects/docker-deployment-planning/configurations/`
**Solution**: Change to `context: .` when moving to root

### 4. Repository Clutter

**Current**: 40+ markdown files in root directory
**Files**: AGENTS.md, ANSIBLE_*.md, CURRENT_PLAN.md, DEPLOYMENT_LOG.md, _DESIGN_SPECS.md, _IMPLEMENTATION_PLAN.md, INSTALL_NOTES.md, MCP_ISSUE*.md, PHASE_*.md, PROJECT_SUMMARY.md, STATUS.md, STUDY_LITE.md, WORKLOG.md, etc.
**Problem**: Confusing, unprofessional, hard to navigate
**Solution**: Archive planning docs, organize technical docs

### 5. Environment Templates Unclear

**Current**:
- `.env.example` - Shows SQLite (legacy from upstream)
- `.env.byo.example` - Correct PostgreSQL format
- Missing: `.env.inc-postgres.example`

**Problem**: Users don't know which template to use
**Solution**: Create specific templates for each deployment mode

### 6. README Not Docker-First

**Current**: README shows git clone + npm install workflow
**Problem**: Doesn't highlight simple Docker deployment
**Solution**: Restructure README - Docker quick start FIRST

---

## Technical Requirements

### Shane's Explicit Requirements

1. ✅ **Crawl4AI Default**: ALWAYS use Crawl4AI, fallback only if needed
2. ✅ **Two Modes Only**: inc-postgres and byo-postgres, that's it
3. ✅ **Clean Repository**: Remove clutter from main directory
4. ❌ **No MCP-Only**: Not needed (Shane requirement #3)

### Deployment Requirements

**inc-postgres mode** (Included PostgreSQL):
- All 6 services in one docker-compose file
- PostgreSQL 17 with pgvector (bundled)
- Text-Embeddings-Inference (bundled)
- Crawl4AI (always included)
- Worker, MCP, Web services
- Minimal config: Just set POSTGRES_PASSWORD

**byo-postgres mode** (Bring Your Own):
- 4 services in docker-compose file
- External PostgreSQL + pgvector
- External embeddings API
- Crawl4AI (always included)
- Worker, MCP, Web services
- Required config: DATABASE_URL, OPENAI_API_BASE

### Crawl4AI Requirements

- **Always Enabled**: CRAWL4AI_ENABLED=true by default
- **No Profile Flag**: Service should start automatically
- **Service URL**: CRAWL4AI_SERVICE_URL=http://localhost:8001
- **Fetcher Priority**: AutoDetectFetcher should prefer Crawl4AI

---

## Implementation Plan

### Phase 1: Verify Dockerfile (15 minutes)

**Objective**: Confirm Dockerfile already has --legacy-peer-deps flags

**Actions**:
```bash
cd /zfs/Workspace/scrapegoat

# Check Dockerfile lines 23 and 32
grep -n "legacy-peer-deps" Dockerfile

# Expected output:
# 23:RUN npm ci --legacy-peer-deps
# 32:RUN rm -rf node_modules && npm ci --omit=dev --legacy-peer-deps
```

**If Missing** (unlikely based on earlier read):
```bash
# Edit Dockerfile
sed -i 's/npm ci$/npm ci --legacy-peer-deps/' Dockerfile
sed -i 's/npm ci --omit=dev$/npm ci --omit=dev --legacy-peer-deps/' Dockerfile
```

**Test**:
```bash
npm run build
docker build -t scrapegoat:test .
```

**Commit** (if changes made):
```bash
git add Dockerfile
git commit -m "fix: ensure --legacy-peer-deps in Dockerfile for @langchain compatibility"
```

---

### Phase 2: Create Deployment Files (45 minutes)

#### 2.1 Copy and Rename inc-postgres

```bash
cd /zfs/Workspace/scrapegoat

# Copy from planning directory
cp projects/docker-deployment-planning/configurations/docker-compose.aio.yml \
   docker-compose.inc-postgres.yml
```

#### 2.2 Fix docker-compose.inc-postgres.yml

**Edit** `docker-compose.inc-postgres.yml`:

**Line-by-line changes**:
```yaml
# Line 1-17: Add header comment
# ============================================================================
# Scrapegoat Docker Compose - Included PostgreSQL Mode
# ============================================================================
# All services bundled: PostgreSQL, Embeddings, Worker, MCP, Web, Crawl4AI
#
# Quick Start:
#   1. cp .env.inc-postgres.example .env
#   2. Edit .env - set POSTGRES_PASSWORD
#   3. docker compose -f docker-compose.inc-postgres.yml up -d
#
# Services:
#   - PostgreSQL 17 with pgvector (port 5432, internal)
#   - Text-Embeddings-Inference (port 8082, internal)
#   - Worker API (port 8080)
#   - MCP Server (port 6280)
#   - Web UI (port 6281)
#   - Crawl4AI (port 8001, internal)
# ============================================================================

# Line 88: Fix worker build context
    build:
      context: .              # Changed from: ../..
      dockerfile: Dockerfile

# Line 103: Ensure Crawl4AI enabled
      - CRAWL4AI_ENABLED=true  # Changed from: ${CRAWL4AI_ENABLED:-false}

# Line 136: Fix mcp build context
    build:
      context: .              # Changed from: ../..
      dockerfile: Dockerfile

# Line 173: Fix web build context
    build:
      context: .              # Changed from: ../..
      dockerfile: Dockerfile

# Line 214: Fix crawl4ai build context
    build:
      context: ./services/crawl4ai  # Changed from: ../../services/crawl4ai
      dockerfile: Dockerfile

# Lines 245-246: REMOVE profile (make always-on)
    # DELETE these lines:
    # profiles:
    #   - crawl4ai
```

**Automated sed commands**:
```bash
# Fix build contexts
sed -i 's|context: \.\./\.\.|context: .|g' docker-compose.inc-postgres.yml
sed -i 's|context: \.\./\.\./services/crawl4ai|context: ./services/crawl4ai|g' docker-compose.inc-postgres.yml

# Enable Crawl4AI by default
sed -i 's|CRAWL4AI_ENABLED=\${CRAWL4AI_ENABLED:-false}|CRAWL4AI_ENABLED=true|g' docker-compose.inc-postgres.yml

# Remove profile lines (careful - only for crawl4ai service)
sed -i '/profiles:/d; /- crawl4ai/d' docker-compose.inc-postgres.yml
```

#### 2.3 Copy and Fix byo-postgres

```bash
# Copy from planning directory
cp projects/docker-deployment-planning/configurations/docker-compose.byo.yml \
   docker-compose.byo-postgres.yml
```

**Apply same fixes** (header, contexts, crawl4ai enabled, remove profile):
```bash
# Fix build contexts
sed -i 's|context: \.\./\.\.|context: .|g' docker-compose.byo-postgres.yml
sed -i 's|context: \.\./\.\./services/crawl4ai|context: ./services/crawl4ai|g' docker-compose.byo-postgres.yml

# Enable Crawl4AI by default
sed -i 's|CRAWL4AI_ENABLED=\${CRAWL4AI_ENABLED:-false}|CRAWL4AI_ENABLED=true|g' docker-compose.byo-postgres.yml

# Remove profile lines
sed -i '/profiles:/d; /- crawl4ai/d' docker-compose.byo-postgres.yml
```

**Manually add header** (sed can't do multi-line easily):
```yaml
# ============================================================================
# Scrapegoat Docker Compose - BYO PostgreSQL Mode
# ============================================================================
# Use your own PostgreSQL and embeddings services
#
# Quick Start:
#   1. cp .env.byo-postgres.example .env
#   2. Edit .env - set DATABASE_URL and OPENAI_API_BASE
#   3. docker compose -f docker-compose.byo-postgres.yml up -d
#
# Services:
#   - Worker API (port 8080)
#   - MCP Server (port 6280)
#   - Web UI (port 6281)
#   - Crawl4AI (port 8001, internal)
#
# Requirements:
#   - External PostgreSQL 14+ with pgvector
#   - External OpenAI-compatible embeddings API
# ============================================================================
```

#### 2.4 Create .env.inc-postgres.example

```bash
cat > .env.inc-postgres.example << 'EOF'
# ============================================================================
# Scrapegoat Configuration - Included PostgreSQL Mode
# ============================================================================
# This configuration includes PostgreSQL and embeddings services.
# Minimal configuration required - just set a password!

# ----------------------------------------------------------------------------
# DATABASE CONFIGURATION (Auto-configured)
# ----------------------------------------------------------------------------
# PostgreSQL connection is auto-configured via docker-compose
# Database: scrapegoat
# User: scrapegoat
# Host: localhost (via host networking)
# Port: 5432

# SET THIS: PostgreSQL password (required)
POSTGRES_PASSWORD=your-secure-password-here

# The DATABASE_URL is auto-generated by docker-compose from POSTGRES_PASSWORD
# Format: postgresql://scrapegoat:${POSTGRES_PASSWORD}@localhost:5432/scrapegoat

# ----------------------------------------------------------------------------
# EMBEDDING API CONFIGURATION (Auto-configured)
# ----------------------------------------------------------------------------
# Text-Embeddings-Inference service is included
# Auto-configured to use localhost:8082
OPENAI_API_BASE=http://localhost:8082/v1
OPENAI_API_KEY=not-required
DOCS_MCP_EMBEDDING_MODEL=text-embeddings-inference

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
# PostHog analytics (leave empty to disable)
POSTHOG_API_KEY=

# Data storage path (inside containers)
DOCS_MCP_STORE_PATH=/data
EOF
```

#### 2.5 Update .env.byo.example

**Check current file** and ensure CRAWL4AI_ENABLED=true:
```bash
# Verify
grep CRAWL4AI_ENABLED .env.byo.example

# If it shows false, change to true
sed -i 's/CRAWL4AI_ENABLED=false/CRAWL4AI_ENABLED=true/' .env.byo.example
```

**Optionally rename** for consistency:
```bash
mv .env.byo.example .env.byo-postgres.example
```

#### 2.6 Update .env.example

Replace with redirection to specific templates:
```bash
cat > .env.example << 'EOF'
# ============================================================================
# Scrapegoat Environment Configuration
# ============================================================================
#
# This file is a template. Copy one of the specific templates:
#
# For Included PostgreSQL Mode (easiest):
#   cp .env.inc-postgres.example .env
#
# For Bring Your Own PostgreSQL Mode:
#   cp .env.byo-postgres.example .env
#
# Then edit .env with your specific values.
#
# See documentation:
#   - docs/deployment/DOCKER_QUICKSTART.md
#   - docs/CONFIGURATION.md
# ============================================================================
EOF
```

**Commit Phase 2**:
```bash
git add docker-compose.inc-postgres.yml \
        docker-compose.byo-postgres.yml \
        .env.inc-postgres.example \
        .env.byo-postgres.example \
        .env.example

git commit -m "feat: add simplified docker-compose files with Crawl4AI always enabled

- docker-compose.inc-postgres.yml: Bundled PostgreSQL + embeddings
- docker-compose.byo-postgres.yml: External PostgreSQL + embeddings
- Crawl4AI enabled by default in both modes (no profile flag)
- Fixed build context paths for root directory deployment
- Created .env templates for each deployment mode

Breaking change: Crawl4AI is now always included (was optional)"
```

---

### Phase 3: Repository Cleanup (30 minutes)

#### 3.1 Create Archive Structure

```bash
cd /zfs/Workspace/scrapegoat

# Create archive directories
mkdir -p archive/{planning,worklogs,investigations,legacy}
```

#### 3.2 Move Planning Documents

```bash
# Move to archive/planning/
mv AGENTS.md archive/planning/
mv ANSIBLE_CHUNKING_DEBUG_PLAN.md archive/planning/
mv CURRENT_PLAN.md archive/planning/
mv _DESIGN_SPECS.md archive/planning/
mv _IMPLEMENTATION_PLAN.md archive/planning/
mv PHASE_5.3_IMPLEMENTATION_PLAN.md archive/planning/
mv PROJECT_SUMMARY.md archive/planning/
mv _REQUIRED_WEBUI_IMAGES.md archive/planning/
mv STUDY_LITE.md archive/planning/

# Move entire projects/ directory
mv projects archive/legacy/
```

#### 3.3 Move Work Logs

```bash
# Move to archive/worklogs/
mv WORKLOG.md archive/worklogs/
mv DEPLOYMENT_LOG.md archive/worklogs/
mv INSTALL_NOTES.md archive/worklogs/
mv STATUS.md archive/worklogs/
mv RESUME.txt archive/worklogs/
```

#### 3.4 Move Investigation Documents

```bash
# Move to archive/investigations/
mv MCP_ISSUE.md archive/investigations/
mv MCP_ISSUE_SOLUTION.md archive/investigations/
mv INSTALLATION_PLAN_docs.den.lan.md archive/investigations/
```

#### 3.5 Move or Delete Old Configs

```bash
# Move to archive/legacy/
mv docker-compose.yml archive/legacy/docker-compose.old.yml
mv NEW_STYLE.md archive/legacy/
mv webui_style.json archive/legacy/
mv oldwebui.png archive/legacy/
mv WEBUI.png archive/legacy/
```

#### 3.6 Reorganize Documentation

```bash
# Create docs structure
mkdir -p docs/deployment
mkdir -p docs/architecture
mkdir -p docs/migration

# Move architectural docs
mv ARCHITECTURE.md docs/architecture/
mv DEPLOYMENT.md docs/deployment/
mv DOCKER_DEPLOYMENT.md docs/deployment/
mv NGINX-CONFIG.md docs/deployment/
mv MIGRATION.md docs/migration/

# Move to docs root
mv INSTALL.md docs/
```

#### 3.7 Update .gitignore

Add archive directory to .gitignore (optional - or keep in git for history):
```bash
echo "# Archive - old planning and logs" >> .gitignore
echo "archive/" >> .gitignore
```

**Commit Phase 3**:
```bash
git add archive/ docs/ .gitignore
git status  # Review what's deleted/moved

git commit -m "refactor: reorganize repository structure

- Moved planning documents to archive/planning/
- Moved work logs to archive/worklogs/
- Moved investigation docs to archive/investigations/
- Moved legacy files to archive/legacy/
- Reorganized technical docs in docs/
- Cleaned root directory for better navigation"
```

---

### Phase 4: Documentation Updates (45 minutes)

#### 4.1 Create DOCKER_QUICKSTART.md

```bash
cat > docs/deployment/DOCKER_QUICKSTART.md << 'EOF'
# Docker Quick Start Guide

Two deployment options available:

1. **Included PostgreSQL** - Everything bundled, easiest setup
2. **BYO PostgreSQL** - Use your own database and embeddings

---

## Included PostgreSQL Deployment

### Prerequisites

- Docker 20.10+ with Compose v2
- 8GB RAM minimum
- 20GB disk space

### Quick Start

1. **Download configuration**:
```bash
curl -O https://raw.githubusercontent.com/yourusername/scrapegoat/main/docker-compose.inc-postgres.yml
curl -O https://raw.githubusercontent.com/yourusername/scrapegoat/main/.env.inc-postgres.example
cp .env.inc-postgres.example .env
```

2. **Configure** (edit .env):
```bash
# Required: Set PostgreSQL password
POSTGRES_PASSWORD=your-secure-password-here

# Optional: Other settings have sensible defaults
```

3. **Start services**:
```bash
docker compose -f docker-compose.inc-postgres.yml up -d
```

4. **Verify deployment**:
```bash
# Check all services running
docker compose -f docker-compose.inc-postgres.yml ps

# Expected: All services "Up" and healthy
# - scrapegoat-postgres: Up (healthy)
# - scrapegoat-embeddings: Up (healthy)
# - scrapegoat-worker: Up (healthy)
# - scrapegoat-mcp: Up
# - scrapegoat-web: Up
# - scrapegoat-crawl4ai: Up (healthy)

# Test endpoints
curl http://localhost:6281              # Web UI
curl http://localhost:6280/health       # MCP health check
curl http://localhost:8001/health       # Crawl4AI health check
```

### Services Included

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5432 | Database with pgvector (internal) |
| Embeddings | 8082 | Text-Embeddings-Inference (internal) |
| Worker API | 8080 | Document processing |
| MCP Server | 6280 | Model Context Protocol |
| Web UI | 6281 | Web management interface |
| Crawl4AI | 8001 | AI-optimized web scraping (internal) |

### Resource Requirements

- **RAM**: 8-10GB
- **Disk**: 20-25GB
- **CPU**: 4+ cores recommended

---

## BYO PostgreSQL Deployment

### Prerequisites

- Docker 20.10+ with Compose v2
- External PostgreSQL 14+ with pgvector extension
- External OpenAI-compatible embeddings API
- 5-6GB RAM
- 10GB disk space

### Quick Start

1. **Download configuration**:
```bash
curl -O https://raw.githubusercontent.com/yourusername/scrapegoat/main/docker-compose.byo-postgres.yml
curl -O https://raw.githubusercontent.com/yourusername/scrapegoat/main/.env.byo-postgres.example
cp .env.byo-postgres.example .env
```

2. **Configure** (edit .env):
```bash
# Required: PostgreSQL connection
DATABASE_URL=postgresql://user:password@postgres.example.com:5432/scrapegoat

# Required: Embeddings API
OPENAI_API_BASE=http://embed.example.com/v1
OPENAI_API_KEY=your-api-key-or-not-required

# Required: Model name (must match your embeddings service)
DOCS_MCP_EMBEDDING_MODEL=text-embedding-3-small
```

3. **Ensure database exists**:
```bash
# On your PostgreSQL server
psql -U postgres -c "CREATE DATABASE scrapegoat;"
psql -U postgres -d scrapegoat -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

4. **Start services**:
```bash
docker compose -f docker-compose.byo-postgres.yml up -d
```

5. **Verify deployment**:
```bash
docker compose -f docker-compose.byo-postgres.yml ps

# Expected: All services "Up" and healthy
# - scrapegoat-worker: Up (healthy)
# - scrapegoat-mcp: Up
# - scrapegoat-web: Up
# - scrapegoat-crawl4ai: Up (healthy)
```

### Services Included

| Service | Port | Description |
|---------|------|-------------|
| Worker API | 8080 | Document processing |
| MCP Server | 6280 | Model Context Protocol |
| Web UI | 6281 | Web management interface |
| Crawl4AI | 8001 | AI-optimized web scraping (internal) |

### External Service Requirements

1. **PostgreSQL**: 14+ with pgvector extension
2. **Embeddings API**: OpenAI-compatible `/v1/embeddings` endpoint

---

## Common Operations

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f worker
docker compose logs -f mcp
docker compose logs -f web
docker compose logs -f crawl4ai
```

### Stop Services

```bash
# Graceful stop
docker compose down

# Stop and remove volumes (⚠️ data loss)
docker compose down -v
```

### Restart Services

```bash
docker compose restart
```

### Update to Latest Version

```bash
# Pull latest images
docker compose pull

# Rebuild with new code
docker compose build

# Restart services
docker compose up -d
```

---

## Troubleshooting

### Services Not Starting

**Check logs**:
```bash
docker compose logs
```

**Common issues**:
- Database connection failures (check DATABASE_URL)
- Missing pgvector extension
- Port conflicts (6280, 6281, 8080, 8001 must be available)

### Database Connection Errors

**Verify PostgreSQL**:
```bash
psql $DATABASE_URL -c "SELECT version();"
psql $DATABASE_URL -c "SELECT * FROM pg_extension WHERE extname='vector';"
```

**Check permissions**:
- User must have CREATE TABLE permission
- User must have CREATE EXTENSION permission (if not postgres user)

### Crawl4AI Not Working

**Check service**:
```bash
curl http://localhost:8001/health

# Should return: {"status":"ok","version":"1.0.0","uptime":...}
```

**Check worker logs**:
```bash
docker compose logs worker | grep crawl4ai
```

### Build Failures

**npm dependency errors**:
Ensure Dockerfile has `--legacy-peer-deps` flags:
```bash
grep "legacy-peer-deps" Dockerfile
```

**Context errors**:
Ensure docker-compose build context is `context: .` (root directory)

---

## Next Steps

- **Configuration Guide**: ../../CONFIGURATION.md
- **Architecture Documentation**: ../../architecture/ARCHITECTURE.md
- **Troubleshooting Guide**: ../../TROUBLESHOOTING.md (if exists)
- **API Documentation**: ../../API.md (if exists)

---

## Support

For issues or questions:
1. Check logs: `docker compose logs`
2. Review configuration: `.env` file
3. Consult troubleshooting guide
4. Open issue on GitLab: http://gitlab.den.lan/pub/scrapegoat
EOF
```

#### 4.2 Update README.md

**Create backup**:
```bash
cp README.md README.md.backup
```

**Update README.md** - Add Docker quick start at the top:
```markdown
# Scrapegoat

> Documentation scraping and indexing service with Model Context Protocol (MCP) integration

![Status](https://img.shields.io/badge/status-production--ready-brightgreen)
![Version](https://img.shields.io/badge/version-2.0.0-blue)

---

## 🚀 Quick Start (Docker)

### Option 1: Included PostgreSQL (Easiest)

Everything bundled - just set a password and run:

```bash
# Download files
curl -O https://raw.githubusercontent.com/.../docker-compose.inc-postgres.yml
curl -O https://raw.githubusercontent.com/.../.env.inc-postgres.example
cp .env.inc-postgres.example .env

# Edit .env - set POSTGRES_PASSWORD
nano .env

# Start all services
docker compose -f docker-compose.inc-postgres.yml up -d

# Access
# Web UI: http://localhost:6281
# MCP Server: http://localhost:6280
```

**Services included**: PostgreSQL, Embeddings, Worker, MCP, Web, Crawl4AI

### Option 2: Bring Your Own PostgreSQL

Use your existing PostgreSQL and embeddings services:

```bash
# Download files
curl -O https://raw.githubusercontent.com/.../docker-compose.byo-postgres.yml
curl -O https://raw.githubusercontent.com/.../.env.byo-postgres.example
cp .env.byo-postgres.example .env

# Edit .env - set DATABASE_URL and OPENAI_API_BASE
nano .env

# Start services
docker compose -f docker-compose.byo-postgres.yml up -d
```

**Requirements**: PostgreSQL 14+ with pgvector, OpenAI-compatible embeddings API

📖 **Full Guide**: [docs/deployment/DOCKER_QUICKSTART.md](docs/deployment/DOCKER_QUICKSTART.md)

---

## Features

[Rest of existing README content...]
```

**Replace Quick Start section** and move deployment to top.

#### 4.3 Update INSTALL.md

Add reference to new Docker deployment:
```markdown
# Installation Guide

## Recommended: Docker Deployment

For the easiest installation, use Docker Compose:

- **Quick Start**: [docs/deployment/DOCKER_QUICKSTART.md](docs/deployment/DOCKER_QUICKSTART.md)
- **Included PostgreSQL**: `docker-compose.inc-postgres.yml`
- **BYO PostgreSQL**: `docker-compose.byo-postgres.yml`

Docker deployment handles all dependencies, migrations, and service orchestration automatically.

## Manual Installation

For development or manual deployment, follow these steps:

[Existing manual installation content...]
```

**Commit Phase 4**:
```bash
git add docs/deployment/DOCKER_QUICKSTART.md \
        README.md \
        docs/INSTALL.md

git commit -m "docs: add Docker quick start guide and update README

- Created comprehensive DOCKER_QUICKSTART.md
- Updated README.md to show Docker deployment first
- Updated INSTALL.md to reference Docker guides
- Documented both inc-postgres and byo-postgres modes"
```

---

### Phase 5: Testing & Validation (60 minutes)

#### 5.1 Test inc-postgres Build

```bash
cd /zfs/Workspace/scrapegoat

# Create test .env
cp .env.inc-postgres.example .env
nano .env  # Set POSTGRES_PASSWORD=test123

# Build images
docker compose -f docker-compose.inc-postgres.yml build

# Expected: Successful build of:
# - ghcr.io/denmaster/scrapegoat:latest
# - scrapegoat-crawl4ai:latest

# Check for errors in build output
# npm should not fail with dependency conflicts
```

#### 5.2 Test inc-postgres Startup

```bash
# Start services
docker compose -f docker-compose.inc-postgres.yml up -d

# Wait 30 seconds for services to initialize
sleep 30

# Check service status
docker compose -f docker-compose.inc-postgres.yml ps

# Expected output (all services Up):
# NAME                      STATUS          PORTS
# scrapegoat-postgres       Up (healthy)    5432
# scrapegoat-embeddings     Up (healthy)    8082
# scrapegoat-worker         Up (healthy)    8080
# scrapegoat-mcp            Up              6280
# scrapegoat-web            Up              6281
# scrapegoat-crawl4ai       Up (healthy)    8001
```

#### 5.3 Test Endpoints

```bash
# Web UI
curl -I http://localhost:6281
# Expected: HTTP/1.1 200 OK

# MCP Health
curl http://localhost:6280/health
# Expected: {"status":"healthy"} or similar

# Crawl4AI Health
curl http://localhost:8001/health
# Expected: {"status":"ok","version":"1.0.0",...}

# Worker API
curl http://localhost:8080/api/health
# Expected: Success response
```

#### 5.4 Check Logs for Errors

```bash
# Worker logs - check for successful startup
docker compose -f docker-compose.inc-postgres.yml logs worker | tail -50

# Look for:
# ✅ "DocumentStore initialized successfully"
# ✅ "Applied X migration(s)" or "Database schema is up to date"
# ✅ "AppServer available at http://..."
# ❌ Any ERROR or FAIL messages

# MCP logs
docker compose -f docker-compose.inc-postgres.yml logs mcp | tail -20

# Web logs
docker compose -f docker-compose.inc-postgres.yml logs web | tail -20

# Crawl4AI logs
docker compose -f docker-compose.inc-postgres.yml logs crawl4ai | tail -20
```

#### 5.5 Test Functional Workflow

**Via Web UI**:
1. Open http://localhost:6281 in browser
2. Navigate to scraping/indexing interface
3. Submit a test URL (e.g., https://example.com)
4. Verify job starts and completes
5. Search for indexed content
6. Verify results returned

**Via Logs**:
```bash
# Watch worker logs while submitting URL
docker compose -f docker-compose.inc-postgres.yml logs -f worker

# Look for:
# - Crawl4AI fetcher being used
# - Successful content extraction
# - Database writes
# - No errors
```

#### 5.6 Verify Crawl4AI Usage

```bash
# Check worker logs for Crawl4AI references
docker compose -f docker-compose.inc-postgres.yml logs worker | grep -i crawl4ai

# Expected output should show:
# - "Using Crawl4AI fetcher"
# - "Crawl4AI service health check passed"
# - Crawl4AI API calls
```

#### 5.7 Test byo-postgres Mode

**Prerequisites**: Requires external PostgreSQL and embeddings

```bash
# Stop inc-postgres services
docker compose -f docker-compose.inc-postgres.yml down

# Configure for BYO mode
cp .env.byo-postgres.example .env
nano .env

# Set:
# DATABASE_URL=postgresql://postgres:password@postgres.den.lan:5432/scrapegoat_test
# OPENAI_API_BASE=http://embed.den.lan/v1
# OPENAI_API_KEY=not-required
# DOCS_MCP_EMBEDDING_MODEL=text-embedding-3-small

# Build and start
docker compose -f docker-compose.byo-postgres.yml build
docker compose -f docker-compose.byo-postgres.yml up -d

# Verify 4 services running
docker compose -f docker-compose.byo-postgres.yml ps

# Test endpoints (same as above)
curl http://localhost:6281
curl http://localhost:6280/health
curl http://localhost:8001/health
```

#### 5.8 Clean Up Test Environment

```bash
# Stop all services
docker compose -f docker-compose.inc-postgres.yml down
docker compose -f docker-compose.byo-postgres.yml down

# Optional: Remove test volumes
docker compose -f docker-compose.inc-postgres.yml down -v

# Remove test .env
rm .env
```

**Document Results**:
Create `TESTING_REPORT.md` with results from each test.

**If All Tests Pass**:
```bash
git add TESTING_REPORT.md
git commit -m "test: validate docker deployment modes

- inc-postgres: All 6 services start successfully
- byo-postgres: All 4 services start successfully
- Crawl4AI confirmed as default fetcher
- All endpoints accessible
- Database migrations run automatically"
```

---

## File Operations Reference

### Files to Move (Phase 2)

```bash
# Source → Destination
projects/docker-deployment-planning/configurations/docker-compose.aio.yml → docker-compose.inc-postgres.yml
projects/docker-deployment-planning/configurations/docker-compose.byo.yml → docker-compose.byo-postgres.yml
```

### Files to Create (Phase 2)

```bash
.env.inc-postgres.example   # New template for inc-postgres mode
.env.example                # Updated with template selection guide
```

### Files to Archive (Phase 3)

```bash
# Planning documents → archive/planning/
AGENTS.md
ANSIBLE_CHUNKING_DEBUG_PLAN.md
CURRENT_PLAN.md
_DESIGN_SPECS.md
_IMPLEMENTATION_PLAN.md
PHASE_5.3_IMPLEMENTATION_PLAN.md
PROJECT_SUMMARY.md
_REQUIRED_WEBUI_IMAGES.md
STUDY_LITE.md

# Work logs → archive/worklogs/
WORKLOG.md
DEPLOYMENT_LOG.md
INSTALL_NOTES.md
STATUS.md
RESUME.txt

# Investigations → archive/investigations/
MCP_ISSUE.md
MCP_ISSUE_SOLUTION.md
INSTALLATION_PLAN_docs.den.lan.md

# Legacy → archive/legacy/
docker-compose.yml → docker-compose.old.yml
NEW_STYLE.md
webui_style.json
oldwebui.png
WEBUI.png
projects/ (entire directory)
```

### Files to Move (Phase 3 - Documentation)

```bash
# Architecture docs → docs/architecture/
ARCHITECTURE.md

# Deployment docs → docs/deployment/
DEPLOYMENT.md
DOCKER_DEPLOYMENT.md
NGINX-CONFIG.md

# Migration docs → docs/migration/
MIGRATION.md

# Root docs → docs/
INSTALL.md
```

### Files to Create (Phase 4)

```bash
docs/deployment/DOCKER_QUICKSTART.md   # New comprehensive guide
README.md                              # Updated with Docker-first approach
```

### Files to Keep in Root

```bash
# Essential project files
README.md
LICENSE
CHANGELOG.md
package.json
package-lock.json
tsconfig.json
biome.json
commitlint.config.js
tailwind.config.ts
postcss.config.cjs

# Vite configuration
vite.config.ts
vite.config.web.ts
vitest.config.ts
vitest.e2e.config.ts

# Docker files (new)
Dockerfile
docker-compose.inc-postgres.yml
docker-compose.byo-postgres.yml
docker-compose.test.yml
.dockerignore

# Environment templates (new)
.env.inc-postgres.example
.env.byo-postgres.example
.env.example

# Git files
.gitignore
.releaserc.json
PR_TEMPLATE.md

# Husky
.husky/ (directory)
```

---

## Testing & Validation

### Pre-Implementation Checklist

- [ ] Backup repository: `git clone /zfs/Workspace/scrapegoat /tmp/scrapegoat-backup`
- [ ] Verify Dockerfile has --legacy-peer-deps: `grep -n "legacy-peer-deps" Dockerfile`
- [ ] Current build works: `npm run build && docker build -t test .`
- [ ] Document current state: `git status > PRE_IMPLEMENTATION_STATE.txt`

### Phase 1 Validation

- [ ] Dockerfile contains --legacy-peer-deps on lines 23, 32
- [ ] Docker build succeeds without npm errors
- [ ] TypeScript compilation passes

### Phase 2 Validation

- [ ] docker-compose.inc-postgres.yml exists in root
- [ ] docker-compose.byo-postgres.yml exists in root
- [ ] Build contexts are `context: .` (not `../..`)
- [ ] Crawl4AI has NO profile flag
- [ ] CRAWL4AI_ENABLED=true in both files
- [ ] .env.inc-postgres.example exists
- [ ] .env.byo-postgres.example exists
- [ ] .env.example redirects to specific templates

### Phase 3 Validation

- [ ] archive/ directory structure created
- [ ] Planning docs moved to archive/planning/
- [ ] Work logs moved to archive/worklogs/
- [ ] Investigation docs moved to archive/investigations/
- [ ] Legacy files moved to archive/legacy/
- [ ] Technical docs organized in docs/
- [ ] Root directory clean (only essential files)

### Phase 4 Validation

- [ ] docs/deployment/DOCKER_QUICKSTART.md created
- [ ] README.md shows Docker deployment first
- [ ] INSTALL.md references Docker guides
- [ ] All documentation links valid
- [ ] GitLab/GitHub renders correctly

### Phase 5 Validation (Critical)

#### inc-postgres Mode

- [ ] Build succeeds: `docker compose -f docker-compose.inc-postgres.yml build`
- [ ] All 6 services start: `docker compose ps` shows Up/healthy
- [ ] PostgreSQL accessible internally
- [ ] Embeddings service responds: `curl localhost:8082/health`
- [ ] Worker API responds: `curl localhost:8080/health`
- [ ] MCP server responds: `curl localhost:6280/health`
- [ ] Web UI loads: `curl localhost:6281`
- [ ] Crawl4AI responds: `curl localhost:8001/health`
- [ ] Migrations run automatically (check worker logs)
- [ ] Can index a test URL via Web UI
- [ ] Can search indexed content
- [ ] Crawl4AI is used as fetcher (check logs)
- [ ] No errors in any service logs

#### byo-postgres Mode

- [ ] Build succeeds: `docker compose -f docker-compose.byo-postgres.yml build`
- [ ] All 4 services start: `docker compose ps` shows Up/healthy
- [ ] Worker connects to external PostgreSQL
- [ ] Worker connects to external embeddings
- [ ] MCP server responds: `curl localhost:6280/health`
- [ ] Web UI loads: `curl localhost:6281`
- [ ] Crawl4AI responds: `curl localhost:8001/health`
- [ ] Migrations run automatically
- [ ] Can index a test URL
- [ ] Can search indexed content

### Regression Testing

- [ ] npm run build still works
- [ ] npm test passes
- [ ] Existing systemd deployment still works (docs.den.lan)
- [ ] No broken imports or dependencies

---

## Success Criteria

### Repository Organization

✅ **Root Directory Clean**
- Only essential files in root (< 30 files)
- No planning/investigation documents
- Clear deployment files with obvious names

✅ **Documentation Organized**
- docs/deployment/ contains all deployment guides
- docs/architecture/ contains design docs
- docs/migration/ contains migration guides
- README.md is user-friendly and Docker-first

✅ **Archive Created**
- Old planning docs preserved but out of the way
- Work logs accessible but not cluttering
- Clear structure for historical reference

### Deployment Simplification

✅ **Two Modes Only**
- docker-compose.inc-postgres.yml (included PostgreSQL)
- docker-compose.byo-postgres.yml (BYO PostgreSQL)
- No other docker-compose variations

✅ **Crawl4AI Default**
- CRAWL4AI_ENABLED=true by default
- No profile flag required
- Service always starts with main application

✅ **Clear Configuration**
- .env.inc-postgres.example (minimal config)
- .env.byo-postgres.example (clear requirements)
- .env.example redirects to specific templates

### Functional Requirements

✅ **Builds Successfully**
- docker-compose build works for both modes
- No npm dependency errors
- All images create successfully

✅ **Starts Successfully**
- inc-postgres: 6 services Up and healthy
- byo-postgres: 4 services Up and healthy
- No errors in logs

✅ **Works Functionally**
- Can index URLs via Web UI
- Can search indexed content
- Crawl4AI is used as fetcher
- Database migrations run automatically
- MCP endpoints accessible

### Documentation Quality

✅ **Quick Start Guide**
- Step-by-step instructions
- Both deployment modes documented
- Troubleshooting section included
- Clear prerequisites listed

✅ **README Updated**
- Docker deployment shown first
- Simple example commands
- Links to detailed guides
- Professional appearance

---

## Next Session Handover

### Context for Next Agent/Session

**What Was Done**: Comprehensive analysis of Scrapegoat deployment complexity, comparison with upstream docs-mcp-server, identification of problems, and creation of detailed implementation plan.

**Current State**: Repository is functional but cluttered. Docker deployment files exist but are hidden in planning directory. Crawl4AI is optional when it should be default.

**What's Needed**: Execute the 5-phase implementation plan to create simplified Docker deployment with clean repository structure.

**Time Estimate**:
- Phase 1: 15 minutes (verify Dockerfile)
- Phase 2: 45 minutes (create deployment files)
- Phase 3: 30 minutes (repository cleanup)
- Phase 4: 45 minutes (documentation updates)
- Phase 5: 60 minutes (testing & validation)
- **Total**: ~3 hours of focused work

**Key Files to Reference**:
- This handover: `/zfs/Workspace/scrapegoat/HANDOVER.md`
- Current docker-compose (planned): `projects/docker-deployment-planning/configurations/`
- Dockerfile: `/zfs/Workspace/scrapegoat/Dockerfile`
- Current working deployment: docs.den.lan (systemd + Docker hybrid)

**Critical Requirements (Shane's Explicit Instructions)**:
1. Crawl4AI is DEFAULT always (no fallback-only)
2. Two modes only: inc-postgres and byo-postgres
3. Clean repository (archive clutter)
4. No MCP-only mode needed

**Pitfalls to Avoid**:
- Don't modify Dockerfile if it already has --legacy-peer-deps
- Don't break existing systemd deployment on docs.den.lan
- Don't remove Crawl4AI profile flag without enabling it by default
- Don't forget to fix build context paths when moving files
- Don't skip testing phase - deployment must actually work

**Success = Shane Can**:
1. Download two files (docker-compose + .env)
2. Edit one variable (POSTGRES_PASSWORD or DATABASE_URL)
3. Run `docker compose up -d`
4. Have fully functional Scrapegoat with Crawl4AI

---

## Appendix

### Environment Variable Reference

**inc-postgres mode**:
```bash
# Required
POSTGRES_PASSWORD=...           # Set by user

# Auto-configured (don't need to set)
DATABASE_URL=...               # Generated from POSTGRES_PASSWORD
OPENAI_API_BASE=...            # Points to bundled embeddings
OPENAI_API_KEY=not-required    # Bundled service doesn't need key
DOCS_MCP_EMBEDDING_MODEL=...   # Set for bundled service
```

**byo-postgres mode**:
```bash
# Required (must set)
DATABASE_URL=postgresql://...
OPENAI_API_BASE=http://...
OPENAI_API_KEY=...             # Or not-required
DOCS_MCP_EMBEDDING_MODEL=...   # Must match embeddings service

# Optional
CRAWL4AI_ENABLED=true          # Already defaulted
MCP_PORT=6280                  # Already defaulted
WEB_PORT=6281                  # Already defaulted
```

### Docker Compose Service Names

**inc-postgres services**:
- postgres
- embeddings
- worker
- mcp
- web
- crawl4ai

**byo-postgres services**:
- worker
- mcp
- web
- crawl4ai

### Port Mapping

| Service | Internal Port | External Port | Access |
|---------|--------------|---------------|--------|
| PostgreSQL | 5432 | - | Internal only |
| Embeddings | 8082 | - | Internal only |
| Worker | 8080 | 8080 | API access |
| MCP | 6280 | 6280 | MCP protocol |
| Web UI | 6281 | 6281 | Browser access |
| Crawl4AI | 8001 | - | Internal only |

### Useful Commands

```bash
# Build both modes
docker compose -f docker-compose.inc-postgres.yml build
docker compose -f docker-compose.byo-postgres.yml build

# Start with logs
docker compose -f docker-compose.inc-postgres.yml up

# Start detached
docker compose -f docker-compose.inc-postgres.yml up -d

# Stop services
docker compose -f docker-compose.inc-postgres.yml down

# Remove volumes (⚠️ data loss)
docker compose -f docker-compose.inc-postgres.yml down -v

# View logs
docker compose -f docker-compose.inc-postgres.yml logs -f

# Check service status
docker compose -f docker-compose.inc-postgres.yml ps

# Rebuild specific service
docker compose -f docker-compose.inc-postgres.yml build worker

# Restart specific service
docker compose -f docker-compose.inc-postgres.yml restart worker
```

---

**END OF HANDOVER**

This document is self-contained and can be used by the next agent/session to execute the implementation plan without requiring access to conversation history or OpenMemory.
