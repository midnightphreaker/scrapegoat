# Scrapegoat Migration Plan: docs.fenrirsden.org (REVISED)
**Date:** 2026-02-04
**Current Version:** v2.0.0 (commit 4b9193b)
**Target Version:** v2.0.0 (commit dcf6ca4)
**Location:** docs.fenrirsden.org (/opt/scrapegoat/scrapegoat)
**Estimated Downtime:** 15-30 minutes (services only)
**Total Maintenance Window:** 3-4 hours

---

## Executive Summary

This migration plan updates Scrapegoat from commit 4b9193b to dcf6ca4, incorporating TypeScript compilation fixes and comprehensive accessibility improvements.

**What Changed:**
- 164 files changed (+27,140 / -1,793)
- 2 new commits with accessibility improvements and bug fixes

**Critical Changes from Original Plan:**
1. **Build images BEFORE stopping services** (prevents extended downtime)
2. **Image versioning with commit hashes** (enables instant rollback)
3. **Capacity pre-checks** (prevents mid-deployment failures)
4. **Realistic runtime estimates** (3-4 hours total, only 15-30 min downtime)
5. **Volume backup procedures** (protects Docker named volumes)
6. **Database readiness checks** (ensures clean startup)
7. **Maintenance page configuration** (better user experience)

**Data Preservation:** All data remains on pgsql.fenrirsden.org - no database migration required.

---

## Current State Analysis

### Deployment Location & Structure
```
/opt/scrapegoat/
├── env                          # Environment variables (source of truth)
└── scrapegoat/                  # Git repository
    ├── .env                     # Docker compose env file (linked from env)
    ├── docker-compose.byo-postgres.yml
    └── src/
```

**Working Directory for Commands:** `/opt/scrapegoat/scrapegoat` (systemd uses `/opt/scrapegoat`)

### Current Services Status

| Service | Container | Port | Process | Status |
|---------|-----------|------|---------|--------|
| Worker | scrapegoat-worker | 8080 | node | Running (healthy) |
| MCP | scrapegoat-mcp | 8888 | node | Running |
| Web | scrapegoat-web | 9090 | node | Running |
| Crawl4AI | scrapegoat-crawl4ai | 8001 | uvicorn | Running (healthy) |

### Current Environment Configuration

**Source File:** `/opt/scrapegoat/env` (also replicated in `/opt/scrapegoat/scrapegoat/.env`)

```bash
DATABASE_URL=postgresql://scrapegoat:scrapegoat@pgsql.fenrirsden.org:5432/scrapegoat
OPENAI_API_BASE=https://embed.fenrirsden.org/v1
OPENAI_API_KEY=not-required
DOCS_MCP_EMBEDDING_MODEL=qwen3-vl-embedding
VECTOR_DIMENSION=1024
CRAWL4AI_ENABLED=true
CRAWL4AI_SERVICE_URL=http://localhost:8001
WEB_PORT=9090
MCP_PORT=8888
WORKER_PORT=8080
NODE_ENV=production
```

**NOTE:** The docker-compose.yml uses `${WEB_PORT:-6281}` as default, but environment overrides set it to 9090.

### Infrastructure Dependencies

| Service | Host | Port | Purpose |
|---------|------|------|---------|
| PostgreSQL | pgsql.fenrirsden.org | 5432 | Database |
| Embedding | embed.fenrirsden.org | 443 | Qwen3-VL embeddings |
| nginx | docs.fenrirsden.org | 80/443 | Reverse proxy |

---

## Phase 0: Pre-Flight Checks (15 minutes) ⭐ NEW

**Objective:** Verify system is ready for deployment before making any changes

### Prerequisites Verification

```bash
# 1. Check available disk space (need >15GB free)
DISK_FREE=$(df -BG /opt | awk 'NR==2 {print $4}' | sed 's/G//')
if [ "$DISK_FREE" -lt 15 ]; then
    echo "❌ ERROR: Insufficient disk space. Need 15GB, have ${DISK_FREE}GB"
    echo "Please free up space before proceeding."
    exit 1
fi
echo "✓ Disk space: ${DISK_FREE}GB available"

# 2. Check available memory (need >2GB free)
AVAILABLE_MEM=$(free -m | awk 'NR==2 {print $7}')
if [ "$AVAILABLE_MEM" -lt 2048 ]; then
    echo "❌ ERROR: Insufficient memory. Need 2GB, have ${AVAILABLE_MEM}MB"
    exit 1
fi
echo "✓ Memory: ${AVAILABLE_MEM}MB available"

# 3. Verify PostgreSQL connectivity
if ! ping -c 2 pgsql.fenrirsden.org > /dev/null 2>&1; then
    echo "❌ ERROR: Cannot reach pgsql.fenrirsden.org"
    exit 1
fi
echo "✓ PostgreSQL host reachable"

# 4. Verify embedding service connectivity
if ! curl -sf https://embed.fenrirsden.org/v1/models > /dev/null; then
    echo "❌ ERROR: Cannot reach embedding service"
    exit 1
fi
echo "✓ Embedding service reachable"

# 5. Verify current git state
cd /opt/scrapegoat/scrapegoat
git fetch origin > /dev/null 2>&1
if ! git branch -r --contains dcf6ca4 | grep -q origin; then
    echo "❌ ERROR: Target commit dcf6ca4 not found in remote"
    exit 1
fi
echo "✓ Target commit available"

# 6. Verify Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ ERROR: Docker is not running"
    exit 1
fi
echo "✓ Docker is running"

# 7. Verify current services are healthy
for service in worker mcp web crawl4ai; do
    if ! docker ps | grep -q "scrapegoat-$service"; then
        echo "⚠ WARNING: scrapegoat-$service is not running"
    fi
done

echo ""
echo "✅ All pre-flight checks passed!"
echo ""
```

### Tag Current Working Images

```bash
# Tag current images for rollback capability
docker tag gitlab.fenrirsden.org/pub/scrapegoat:latest gitlab.fenrirsden.org/pub/scrapegoat:4b9193b-backup
docker tag scrapegoat-crawl4ai:latest scrapegoat-crawl4ai:4b9193b-backup
echo "✓ Current images tagged for rollback"
```

---

## Phase 1: Pre-Deployment Backup (20-30 minutes)

**Objective:** Complete backup of deployment state

### Create Backup Directory and Timestamp

```bash
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/scrapegoat/backup_${BACKUP_DATE}"
mkdir -p "$BACKUP_DIR"
echo "Backup directory: $BACKUP_DIR"
```

### Backup Deployment Directory

```bash
cp -r /opt/scrapegoat/scrapegoat "$BACKUP_DIR/scrapegoat"
echo "✓ Source code backed up"
```

### Backup Environment Files

```bash
cp /opt/scrapegoat/env "$BACKUP_DIR/env"
cp /opt/scrapegoat/scrapegoat/.env "$BACKUP_DIR/.env"
echo "✓ Environment files backed up"
```

### Backup Systemd Service

```bash
cp /etc/systemd/system/scrapegoat.service "$BACKUP_DIR/scrapegoat.service"
echo "✓ Systemd service backed up"
```

### Backup Docker Volumes ⭐ NEW

```bash
# Backup the scrapegoat-data volume
docker run --rm \
  -v scrapegoat-data:/data:ro \
  -v "$BACKUP_DIR":/backup \
  ubuntu tar czf /backup/scrapegoat-volume.tar.gz /data
echo "✓ Docker volume backed up"
```

### Document Container State

```bash
docker ps > "$BACKUP_DIR/docker_ps.txt"
docker images > "$BACKUP_DIR/docker_images.txt"
echo "✓ Container state documented"
```

### Backup Database (Optional but Recommended)

```bash
# This may take 10-20 minutes depending on database size
echo "Starting database backup (may take 10-20 minutes)..."
PGPASSWORD=scrapegoat pg_dump -h pgsql.fenrirsden.org -U scrapegoat -d scrapegoat | \
  gzip > "$BACKUP_DIR/scrapegoat_db_${BACKUP_DATE}.sql.gz"

# Verify backup integrity ⭐ NEW
if ! gunzip -t "$BACKUP_DIR/scrapegoat_db_${BACKUP_DATE}.sql.gz" 2>/dev/null; then
    echo "❌ ERROR: Database backup is corrupted!"
    exit 1
fi
echo "✓ Database backed up and verified"
```

### Backup Summary

```bash
echo ""
echo "=== Backup Summary ==="
echo "Location: $BACKUP_DIR"
du -sh "$BACKUP_DIR"
ls -lh "$BACKUP_DIR"
echo ""
```

---

## Phase 2: Build New Docker Images (45-90 minutes) ⭐ REORDERED

**Objective:** Build new images BEFORE stopping services (reduces downtime)

**CRITICAL:** Building before stopping services means:
- If build fails, services keep running
- Can troubleshoot build issues without downtime
- Only stop services after successful build

### Build Main Scrapegoat Image

```bash
cd /opt/scrapegoat/scrapegoat

echo "Building main scrapegoat image (this may take 20-40 minutes)..."
docker build \
  -t gitlab.fenrirsden.org/pub/scrapegoat:dcf6ca4 \
  -t gitlab.fenrirsden.org/pub/scrapegoat:latest \
  -f Dockerfile \
  . 2>&1 | tee /tmp/scrapegoat-build.log

# Verify build succeeded
if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo "❌ ERROR: Main image build failed!"
    echo "Check log: /tmp/scrapegoat-build.log"
    echo "Services are still running - no downtime occurred."
    exit 1
fi
echo "✓ Main image built successfully"
```

### Build Crawl4AI Image

```bash
echo "Building Crawl4AI image (this may take 20-40 minutes)..."
docker build \
  -t scrapegoat-crawl4ai:dcf6ca4 \
  -t scrapegoat-crawl4ai:latest \
  -f services/crawl4ai/Dockerfile \
  ./services/crawl4ai 2>&1 | tee /tmp/crawl4ai-build.log

# Verify build succeeded
if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo "❌ ERROR: Crawl4AI image build failed!"
    echo "Check log: /tmp/crawl4ai-build.log"
    echo "Services are still running - no downtime occurred."
    exit 1
fi
echo "✓ Crawl4AI image built successfully"
```

### Verify New Images Work ⭐ NEW

```bash
# Quick sanity check
echo "Verifying new images..."
docker run --rm gitlab.fenrirsden.org/pub/scrapegoat:dcf6ca4 node -e "console.log('Main image: OK')"
docker run --rm scrapegoat-crawl4ai:dcf6ca4 python -c "print('Crawl4AI image: OK')"
echo "✓ Images verified"
```

---

## Phase 3: Configure Maintenance Page (5 minutes) ⭐ NEW

**Objective:** Show users a maintenance message during downtime

```bash
# Create maintenance page HTML
cat > /var/www/html/maintenance.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
  <title>Scrapegoat Maintenance</title>
  <style>
    body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
    .maintenance { text-align: center; padding: 40px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #333; }
    p { color: #666; }
  </style>
</head>
<body>
  <div class="maintenance">
    <h1>🔧 Under Maintenance</h1>
    <p>Scrapegoat is being upgraded. We'll be back in about 30 minutes.</p>
    <p>Started: $(date)</p>
  </div>
</body>
</html>
EOF

# Get current nginx config location
NGINX_SITE=$(find /etc/nginx/sites-enabled -name "*scrapegoat*" -o -name "*docs*" | head -1)
if [ -z "$NGINX_SITE" ]; then
    NGINX_SITE="/etc/nginx/sites-enabled/default"
fi

# Backup current nginx config
cp "$NGINX_SITE" "$BACKUP_DIR/nginx.conf"

# Update nginx to return 503 (maintenance mode)
sed -i 's|proxy_pass.*|proxy_pass http://localhost:9090; return 503;|' "$NGINX_SITE"

# Test and reload nginx
nginx -t && nginx -s reload
echo "✓ Maintenance page configured"
```

---

## Phase 4: Stop Current Services (5 minutes)

**Objective:** Gracefully shutdown all scrapegoat services

### Check for Active Jobs

```bash
# Check if any indexing jobs are running
ACTIVE_JOBS=$(curl -s http://localhost:8080/api/indexing/jobs 2>/dev/null | \
  jq '[.[] | select(.status=="running" or .status=="queued")] | length' 2>/dev/null || echo "0")

if [ "$ACTIVE_JOBS" -gt 0 ]; then
    echo "⚠ WARNING: $ACTIVE_JOBS active indexing jobs detected"
    echo "Consider waiting for jobs to complete, or proceed anyway."
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled. Please wait for jobs to complete."
        exit 0
    fi
fi
```

### Stop Services

```bash
# Stop systemd service (gracefully stops containers)
systemctl stop scrapegoat

# Wait for containers to stop
echo "Waiting for containers to stop..."
sleep 5

# Verify all containers stopped
if docker ps | grep -q scrapegoat; then
    echo "⚠ Some containers still running, forcing stop..."
    docker stop scrapegoat-worker scrapegoat-mcp scrapegoat-web scrapegoat-crawl4ai 2>/dev/null
fi

echo "✓ All services stopped"
```

---

## Phase 5: Update Source Code (5 minutes)

**Objective:** Pull latest changes from repository

```bash
cd /opt/scrapegoat/scrapegoat

# Stash any local changes (if any)
git stash push -m "Pre-migration stash $(date)" 2>/dev/null || true

# Fetch and checkout target commit
git fetch origin
git checkout dcf6ca4

# Verify version
echo "Current commit:"
git log --oneline -1
echo ""

# Expected: dcf6ca4 fix: resolve all TypeScript compilation errors (96 → 0)
if ! git log --oneline -1 | grep -q "dcf6ca4"; then
    echo "❌ ERROR: Not on correct commit!"
    exit 1
fi

echo "✓ Source code updated to commit dcf6ca4"
```

---

## Phase 6: Update Configuration (5 minutes)

**Objective:** Verify and update environment configuration

### Verify Port Configuration ⭐ UPDATED

```bash
# Verify ports in environment file
echo "Verifying port configuration..."
grep -E "WEB_PORT|MCP_PORT|WORKER_PORT" /opt/scrapegoat/env

# Expected output:
# WEB_PORT=9090
# MCP_PORT=8888
# WORKER_PORT=8080

# Sync .env file from source of truth
cp /opt/scrapegoat/env /opt/scrapegoat/scrapegoat/.env
echo "✓ Environment files synchronized"
```

### Check for New Environment Variables ⭐ NEW

```bash
# Compare .env.example with current .env
echo "Checking for new environment variables..."
NEW_VARS=$(diff .env.example .env | grep "^<" | cut -d' ' -f2 | cut -d'=' -f1)

if [ -n "$NEW_VARS" ]; then
    echo "⚠ WARNING: New environment variables detected:"
    echo "$NEW_VARS"
    echo "Review and add to .env if needed."
fi
```

---

## Phase 7: Start Services (15-20 minutes)

**Objective:** Start all scrapegoat services with new version

### Wait for Database Readiness ⭐ NEW

```bash
echo "Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if PGPASSWORD=scrapegoat psql -h pgsql.fenrirsden.org -U scrapegoat -d scrapegoat \
      -c "SELECT 1" > /dev/null 2>&1; then
        echo "✓ PostgreSQL is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ ERROR: PostgreSQL not ready after 60 seconds"
        exit 1
    fi
    echo "Waiting for PostgreSQL... ($i/30)"
    sleep 2
done
```

### Start Services via Systemd

```bash
systemctl start scrapegoat

echo "Waiting for containers to start..."
sleep 10
```

### Monitor Container Startup

```bash
echo "Monitoring container startup..."
for i in {1..12}; do
    RUNNING=$(docker ps --format '{{.Names}}' | grep -c scrapegoat || true)
    if [ "$RUNNING" -ge 4 ]; then
        echo "✓ All containers started"
        break
    fi
    if [ $i -eq 12 ]; then
        echo "⚠ WARNING: Not all containers started after 60 seconds"
        docker ps -a
    fi
    echo "Waiting... ($i/12) - $RUNNING containers running"
    sleep 5
done
```

### Verify Container Status

```bash
echo ""
echo "=== Container Status ==="
docker ps | grep scrapegoat
echo ""

# Check health status
echo "=== Health Status ==="
docker inspect scrapegoat-worker | jq -r '.[0].State.Health.Status' 2>/dev/null || echo "Worker: health check pending"
docker inspect scrapegoat-crawl4ai | jq -r '.[0].State.Health.Status' 2>/dev/null || echo "Crawl4AI: health check pending"
```

---

## Phase 8: Restore Normal Routing (2 minutes)

```bash
# Restore original nginx configuration
cp "$BACKUP_DIR/nginx.conf" "$NGINX_SITE"
nginx -t && nginx -s reload
echo "✓ Normal routing restored"
```

---

## Phase 9: Post-Deployment Verification (20-30 minutes)

**Objective:** Verify all services are working correctly

### Check Service Endpoints

```bash
echo "=== Testing Service Endpoints ==="

# Worker API
echo -n "Worker (8080): "
if curl -sf http://localhost:8080/health > /dev/null; then
    echo "✓ OK"
else
    echo "❌ FAILED"
fi

# MCP Server
echo -n "MCP Server (8888): "
if curl -sf http://localhost:8888/health > /dev/null; then
    echo "✓ OK"
else
    echo "❌ FAILED"
fi

# Web UI
echo -n "Web UI (9090): "
if curl -sf http://localhost:9090/ > /dev/null; then
    echo "✓ OK"
else
    echo "❌ FAILED"
fi

# Crawl4AI
echo -n "Crawl4AI (8001): "
if curl -sf http://localhost:8001/health > /dev/null; then
    echo "✓ OK"
else
    echo "❌ FAILED"
fi
```

### Check External Access

```bash
echo ""
echo "=== Testing External Access ==="

# Via nginx
echo -n "External (docs.fenrirsden.org): "
if curl -sf http://docs.fenrirsden.org/ > /dev/null; then
    echo "✓ OK"
else
    echo "❌ FAILED"
fi
```

### Check Database Connection

```bash
echo ""
echo "=== Testing Database ==="
LIBRARY_COUNT=$(PGPASSWORD=scrapegoat psql -h pgsql.fenrirsden.org -U scrapegoat -d scrapegoat \
  -t -c "SELECT COUNT(*) FROM libraries;" 2>/dev/null | xargs)
echo "Libraries in database: $LIBRARY_COUNT"
```

### Check Port Bindings ⭐ NEW

```bash
echo ""
echo "=== Port Bindings ==="
netstat -tlnp | grep -E ':(8080|8888|9090|8001)\s' || \
  ss -tlnp | grep -E ':(8080|8888|9090|8001)\s'
```

### Review Logs

```bash
echo ""
echo "=== Recent Logs ==="
echo "--- Worker ---"
docker logs scrapegoat-worker --tail 20 | grep -E "(ERROR|WARN|started|listening)" || true

echo "--- MCP ---"
docker logs scrapegoat-mcp --tail 20 | grep -E "(ERROR|WARN|started|listening)" || true

echo "--- Web ---"
docker logs scrapegoat-web --tail 20 | grep -E "(ERROR|WARN|started|listening)" || true

echo "--- Crawl4AI ---"
docker logs scrapegoat-crawl4ai --tail 20 | grep -E "(ERROR|WARN|started|listening)" || true
```

---

## Phase 10: Functional Testing (20-30 minutes)

**Objective:** Verify core functionality and accessibility improvements

### Test Library Listing

```bash
echo "=== Testing Library List ==="
curl -s http://localhost:8080/api/libraries | jq '.' || echo "Failed to list libraries"
```

### Test Search

```bash
echo ""
echo "=== Testing Search ==="
SEARCH_RESULT=$(curl -s -X POST http://localhost:8080/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "limit": 5}')

echo "$SEARCH_RESULT" | jq '.' || echo "Search failed"
```

### Manual Accessibility Testing ⭐ NEW

**Open in browser and verify:**
1. Navigate to http://docs.fenrirsden.org/
2. Test responsive mobile navigation (resize browser to mobile width)
3. Test keyboard navigation (Tab through page)
4. Check color contrast (visually inspect)
5. Verify all libraries are listed
6. Verify search functionality works
7. Check that no console errors appear

---

## Phase 11: Post-Deployment Monitoring (30 minutes) ⭐ NEW

**Objective:** Monitor logs and metrics after deployment

```bash
echo "=== Monitoring logs for 30 minutes ==="
echo "Press Ctrl+C to stop monitoring early"
echo ""

timeout 1800 bash -c '
  while true; do
    clear
    echo "=== Scrapegoat Live Monitor ==="
    echo "Time: $(date)"
    echo ""
    echo "=== Container Status ==="
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep scrapegoat
    echo ""
    echo "=== Recent Errors (last 5) ==="
    docker logs scrapegoat-worker --since 1m 2>&1 | grep -i error | tail -5 || echo "No errors"
    echo ""
    echo "=== Resource Usage ==="
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" | grep scrapegoat
    echo ""
    echo "Monitoring... (Ctrl+C to stop, auto-exits in 30 minutes)"
    sleep 10
  done
'
```

---

## Rollback Plan

**If critical issues are encountered:**

### Quick Rollback (<5 minutes)

```bash
# 1. Stop new deployment
systemctl stop scrapegoat
cd /opt/scrapegoat/scrapegoat
docker compose -f docker-compose.byo-postgres.yml down

# 2. Restore old images (already tagged!)
docker tag gitlab.fenrirsden.org/pub/scrapegoat:4b9193b-backup gitlab.fenrirsden.org/pub/scrapegoat:latest
docker tag scrapegoat-crawl4ai:4b9193b-backup scrapegoat-crawl4ai:latest

# 3. Restore old source code
cd /opt/scrapegoat/scrapegoat
git checkout 4b9193b

# 4. Restart services
systemctl start scrapegoat

# 5. Verify
docker ps | grep scrapegoat
curl http://localhost:8080/health
```

### Full Rollback (includes database)

**Only needed if database schema was accidentally modified:**

```bash
# 1. Stop services
systemctl stop scrapegoat

# 2. Restore source code
rm -rf /opt/scrapegoat/scrapegoat
cp -r "$BACKUP_DIR/scrapegoat" /opt/scrapegoat/

# 3. Restore environment
cp "$BACKUP_DIR/env" /opt/scrapegoat/env
cp "$BACKUP_DIR/.env" /opt/scrapegoat/scrapegoat/.env

# 4. Restore systemd service
cp "$BACKUP_DIR/scrapegoat.service" /etc/systemd/system/scrapegoat.service
systemctl daemon-reload

# 5. Restore Docker volumes (if needed)
docker run --rm \
  -v scrapegoat-data:/data \
  -v "$BACKUP_DIR":/backup \
  ubuntu tar xzf /backup/scrapegoat-volume.tar.gz -C /

# 6. Restore database (ONLY IF NEEDED)
gunzip -c "$BACKUP_DIR/scrapegoat_db_*.sql.gz" | \
  PGPASSWORD=scrapegoat psql -h pgsql.fenrirsden.org -U scrapegoat -d scrapegoat

# 7. Rebuild old images
cd /opt/scrapegoat/scrapegoat
docker build -t gitlab.fenrirsden.org/pub/scrapegoat:latest .
docker build -t scrapegoat-crawl4ai:latest -f services/crawl4ai/Dockerfile ./services/crawl4ai

# 8. Start services
systemctl start scrapegoat
```

---

## Post-Migration Cleanup

### After 7 Days

```bash
# Remove old backups
find /opt/scrapegoat/backup_* -mtime +7 -exec rm -rf {} \;

# Remove old Docker images
docker image prune -a

# Untag backup images
docker rmi gitlab.fenrirsden.org/pub/scrapegoat:4b9193b-backup
docker rmi scrapegoat-crawl4ai:4b9193b-backup
```

---

## Deployment Log (Fill in During Migration)

### Pre-Flight Results
- Disk space: ______ GB available
- Memory: ______ MB available
- All checks: ___ PASSED / FAILED

### Build Results
- Main image: ___ SUCCESS / FAILED (___ minutes)
- Crawl4AI image: ___ SUCCESS / FAILED (___ minutes)

### Backup Summary
- Location: _________________________
- Size: ______
- Database backup: ___ VERIFIED / CORRUPTED

### Issues Encountered & Fixes

| # | Issue | Solution | Apply to Repo? |
|---|-------|----------|----------------|
| 1 | | | |
| 2 | | | |

### Configuration Changes Made

| File | Change | Reason |
|------|--------|--------|
| | | |

### Timeline

| Phase | Planned | Actual | Notes |
|-------|---------|--------|-------|
| Phase 0: Pre-Flight | 15 min | | |
| Phase 1: Backup | 30 min | | |
| Phase 2: Build | 90 min | | |
| Phase 3: Maintenance | 5 min | | |
| Phase 4: Stop Services | 5 min | | |
| Phase 5: Update Code | 5 min | | |
| Phase 6: Config | 5 min | | |
| Phase 7: Start Services | 20 min | | |
| Phase 8: Restore Routing | 2 min | | |
| Phase 9: Verification | 30 min | | |
| Phase 10: Functional Test | 30 min | | |
| Phase 11: Monitoring | 30 min | | |
| **TOTAL** | **~4 hours** | | |

---

## Sign-Off

**Pre-Migration Checklist:**
- [ ] Backup completed and verified
- [ ] Pre-flight checks passed
- [ ] New images built successfully
- [ ] Rollback plan tested (image tags verified)
- [ ] Stakeholders notified (if applicable)

**Post-Migration Verification:**
- [ ] All services healthy
- [ ] All endpoints responding
- [ ] Database connectivity verified
- [ ] Core functionality tested
- [ ] Accessibility improvements verified
- [ ] Logs reviewed (no critical errors)
- [ ] Monitoring period completed

**Migration Completed By:** _______________
**Date:** _______________
**Duration:** _______________

**Issues to Apply to Local Repo:**
```

---
```

