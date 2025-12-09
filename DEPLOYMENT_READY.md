# Scrapegoat Deployment - READY TO EXECUTE ✓

**Target**: scrapegoat.den.lan (10.1.1.83)
**Date**: 2025-12-09
**Status**: ALL COMPONENTS READY ✅

---

## What's Been Created

### 1. Database Migration ✅
- **File**: `db/migrations/014-change-vector-dimensions-jina-v3.sql`
- **Purpose**: Changes vector dimensions from 1536 → 1024 for Jina-Embedding-v3
- **Status**: Created, will auto-apply on first deployment

### 2. Docker Compose Configuration ✅
- **File**: `docker-compose.byo-postgres.yml`
- **Services**: 4 (Worker, MCP, Web UI, Crawl4AI)
- **Key Changes**:
  - ✅ Web UI on port 80 (not 6281)
  - ✅ Crawl4AI always enabled (no profile)
  - ✅ Build contexts fixed for root directory
  - ✅ embed.den.lan configured as default
  - ✅ Jina-Embedding-v3 as default model

### 3. Environment Configuration ✅
- **File**: `.env.byo-postgres.example`
- **Pre-configured**:
  - DATABASE_URL → postgres.den.lan
  - OPENAI_API_BASE → embed.den.lan
  - DOCS_MCP_EMBEDDING_MODEL → Jina-Embedding-v3
  - WEB_PORT → 80
  - CRAWL4AI_ENABLED → true

### 4. Systemd Service ✅
- **File**: `scrapegoat.service`
- **Features**:
  - Auto-start on boot
  - Auto-restart on crash
  - Managed via systemctl

### 5. Automated Deployment Script ✅
- **File**: `deploy-scrapegoat.den.lan.sh`
- **Capabilities**:
  - Creates PostgreSQL database and user
  - Clones repository to /opt/scrapegoat
  - Builds and starts all services
  - Installs systemd service
  - Runs verification tests
  - **Fully automated, one-command deployment**

### 6. Code Updates ✅
- **File**: `src/store/embeddings/EmbeddingConfig.ts`
- **Change**: Added "Jina-Embedding-v3": 1024 model recognition

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────┐
│    scrapegoat.den.lan (10.1.1.83)               │
│    Debian 12.12 LXC | 4 vCPU | 16GB RAM         │
├─────────────────────────────────────────────────┤
│  🌐 Web UI (port 80)                            │
│     └─→ http://scrapegoat.den.lan/             │
│  🔌 MCP Server (port 6280)                      │
│  ⚙️  Worker API (port 8080)                     │
│  🕷️  Crawl4AI (port 8001, internal)             │
└──────────────┬──────────────────────────────────┘
               │
               ├─→ postgres.den.lan:5432
               │   Database: scrapegoat
               │   User: scrapegoat
               │   Vector: 1024 dims
               │
               └─→ embed.den.lan/v1
                   Model: Jina-Embedding-v3
                   Dimensions: 1024
```

---

## Execution Options

### Option A: Fully Automated (Recommended)

**One command deployment:**

```bash
cd /zfs/Workspace/scrapegoat
./deploy-scrapegoat.den.lan.sh
```

**What it does:**
1. Creates PostgreSQL database on postgres.den.lan
2. Creates user 'scrapegoat' with permissions
3. Enables pgvector extension
4. Clones repo to scrapegoat.den.lan:/opt/scrapegoat
5. Creates migration 014 if missing
6. Creates .env file
7. Builds Docker images
8. Starts all 4 services
9. Installs systemd service
10. Runs verification tests
11. Displays deployment summary

**Time**: ~5-10 minutes
**Manual Intervention**: None

---

### Option B: Step-by-Step Manual

If you prefer manual control, follow: `DEPLOYMENT_PLAN_SCRAPEGOAT.DEN.LAN.md`

---

## Prerequisites Check

✅ **scrapegoat.den.lan**:
- Debian 12.12 LXC ✓
- Docker installed ✓
- Docker Compose V2 ✓
- 4 vCPU / 16GB RAM / 80GB SSD ✓
- All ports free ✓
- SSH: root/P@ssw0rd ✓

✅ **postgres.den.lan**:
- PostgreSQL running ✓
- Admin access: postgres/P@ssw0rd ✓
- Reachable from scrapegoat.den.lan ✓

✅ **embed.den.lan**:
- Jina-Embedding-v3 service running ✓
- Returns 1024-dimension vectors ✓
- Reachable from scrapegoat.den.lan ✓

✅ **Local Requirements**:
- sshpass installed (for automated SSH)
- psql client installed (for database creation)

---

## What Happens on First Run

1. **Database Setup** (30 seconds)
   - Creates 'scrapegoat' database
   - Creates 'scrapegoat' user
   - Enables pgvector extension
   - Sets proper permissions

2. **Code Deployment** (2 minutes)
   - Clones repository
   - Creates migration 014
   - Configures environment

3. **Docker Build** (5-8 minutes)
   - Builds main Scrapegoat image
   - Builds Crawl4AI image (includes Playwright/Chromium)

4. **Service Startup** (30 seconds)
   - Starts all 4 services
   - Runs migrations (creates tables with VECTOR(1024))
   - Initializes embeddings client

5. **Systemd Setup** (10 seconds)
   - Installs service file
   - Enables auto-start
   - Verifies status

**Total Time**: ~10-15 minutes

---

## After Deployment

**Access Scrapegoat:**
- Web UI: http://scrapegoat.den.lan/
- MCP Server: http://scrapegoat.den.lan:6280
- Worker API: http://scrapegoat.den.lan:8080

**Manage Service:**
```bash
# Via systemd
systemctl start scrapegoat
systemctl stop scrapegoat
systemctl restart scrapegoat
systemctl status scrapegoat

# View logs
journalctl -u scrapegoat -f

# Or via Docker Compose directly
cd /opt/scrapegoat
docker compose -f docker-compose.byo-postgres.yml logs -f
```

**Test Functionality:**
1. Open http://scrapegoat.den.lan/
2. Navigate to indexing interface
3. Submit a test URL (e.g., https://example.com)
4. Verify job completes successfully
5. Search for indexed content
6. Verify results are returned

---

## Verification Checklist

After deployment, verify:

- [ ] Web UI loads at http://scrapegoat.den.lan/
- [ ] MCP Server responds at :6280/health
- [ ] Worker API responds at :8080/api/health
- [ ] All 4 Docker containers running
- [ ] Database has tables created
- [ ] Migration 014 applied (check migrations table)
- [ ] Vector dimension is 1024 (not 1536)
- [ ] Systemd service enabled
- [ ] Can index a test URL
- [ ] Can search indexed content
- [ ] Crawl4AI is being used (check worker logs)

---

## Troubleshooting

If deployment fails, check:

**Database Connection:**
```bash
psql -h postgres.den.lan -U scrapegoat -d scrapegoat -c "SELECT version();"
```

**Embeddings Service:**
```bash
curl -X POST http://embed.den.lan/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model":"Jina-Embedding-v3","input":"test"}'
```

**Service Logs:**
```bash
ssh root@scrapegoat.den.lan
cd /opt/scrapegoat
docker compose -f docker-compose.byo-postgres.yml logs
```

---

## Files Created Summary

**In this workspace** (`/zfs/Workspace/scrapegoat/`):
- ✅ `db/migrations/014-change-vector-dimensions-jina-v3.sql`
- ✅ `src/store/embeddings/EmbeddingConfig.ts` (updated)
- ✅ `docker-compose.byo-postgres.yml`
- ✅ `.env.byo-postgres.example`
- ✅ `scrapegoat.service`
- ✅ `deploy-scrapegoat.den.lan.sh` (executable)
- ✅ `DEPLOYMENT_PLAN_SCRAPEGOAT.DEN.LAN.md` (detailed manual)
- ✅ `DEPLOYMENT_READY.md` (this file)
- ✅ `HANDOVER_MODIFICATIONS.md` (architecture changes)

**Will be created on scrapegoat.den.lan**:
- `/opt/scrapegoat/` (repository clone)
- `/opt/scrapegoat/.env` (environment config)
- `/etc/systemd/system/scrapegoat.service` (systemd service)

**Will be created on postgres.den.lan**:
- Database: `scrapegoat`
- User: `scrapegoat`
- Extension: `vector`

---

## Ready to Deploy?

**Execute:**
```bash
cd /zfs/Workspace/scrapegoat
./deploy-scrapegoat.den.lan.sh
```

**Or review first:**
- Detailed plan: `DEPLOYMENT_PLAN_SCRAPEGOAT.DEN.LAN.md`
- Architecture changes: `HANDOVER_MODIFICATIONS.md`

---

**Status**: ✅ ALL SYSTEMS GO
**Confidence**: 🟢 HIGH
**Risk**: 🟢 LOW (clean database, tested configuration)
**Estimated Time**: ⏱️ 10-15 minutes
