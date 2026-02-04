# Scrapegoat Migration Plan: docs.fenrirsden.org
**Date:** 2026-02-04
**Current Version:** v2.0.0 (commit 4b9193b)
**Target Version:** v2.0.0 (commit dcf6ca4)
**Location:** docs.fenrirsden.org (/opt/scrapegoat/scrapegoat)

---

## Executive Summary

This migration plan updates the Scrapegoat installation on docs.fenrirsden.org from the current version (commit 4b9193b, Feb 2 2026) to the latest version (commit dcf6ca4, which includes TypeScript compilation fixes and comprehensive accessibility improvements).

**Key Changes:**
- 164 files changed (+27,140 / -1,793)
- 2 new commits with significant features:
  - `1304c6f`: Comprehensive accessibility features and responsive mobile navigation
  - `dcf6ca4`: Fix all TypeScript compilation errors (96 → 0)

**Critical Note:** Data is preserved on pgsql.fenrirsden.org - no database migration required.

---

## Current State Analysis

### Current Deployment Configuration

**Location:** `/opt/scrapegoat/scrapegoat`
**Git Version:** v2.0.0 (commit 4b9193b "refactor(types): improve type safety and status consistency")

**Services (Docker):**
| Service | Container | Port | Status |
|---------|-----------|------|--------|
| Worker | scrapegoat-worker | 8080 | Running (healthy) |
| MCP | scrapegoat-mcp | 8888 | Running |
| Web | scrapegoat-web | 9090 | Running |
| Crawl4AI | scrapegoat-crawl4ai | 8001 | Running (healthy) |

**Systemd Service:** `/etc/systemd/system/scrapegoat.service`

**Environment Configuration** (`/opt/scrapegoat/env`):
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

**Docker Compose:** `docker-compose.byo-postgres.yml`
**Docker Image:** gitlab.fenrirsden.org/pub/scrapegoat:latest (or locally built)

**Network Configuration:**
- nginx on port 80 (proxies to web service)
- nginx on port 443 (SSL)
- All Docker services using `network_mode: host` (LXC compatibility)

---

## Pre-Migration Checklist

- [ ] Verify SSH access to docs.fenrirsden.org
- [ ] Confirm PostgreSQL is accessible at pgsql.fenrirsden.org:5432
- [ ] Confirm embedding service at https://embed.fenrirsden.org/v1 is accessible
- [ ] Backup current deployment directory
- [ ] Document current running containers and their configurations
- [ ] Verify git access to gitlab.fenrirsden.org/pub/scrapegoat

---

## Migration Plan

### Phase 1: Pre-Deployment Backup (15 minutes)

**Objective:** Safeguard current deployment state

**Steps:**

1. **Create backup timestamp:**
   ```bash
   BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
   BACKUP_DIR="/opt/scrapegoat/backup_${BACKUP_DATE}"
   mkdir -p "$BACKUP_DIR"
   ```

2. **Backup deployment directory:**
   ```bash
   cp -r /opt/scrapegoat/scrapegoat "$BACKUP_DIR/scrapegoat"
   ```

3. **Backup environment files:**
   ```bash
   cp /opt/scrapegoat/env "$BACKUP_DIR/env"
   cp /opt/scrapegoat/scrapegoat/.env "$BACKUP_DIR/.env"
   ```

4. **Backup systemd service:**
   ```bash
   cp /etc/systemd/system/scrapegoat.service "$BACKUP_DIR/scrapegoat.service"
   ```

5. **Document current container state:**
   ```bash
   docker ps > "$BACKUP_DIR/docker_ps.txt"
   docker images > "$BACKUP_DIR/docker_images.txt"
   ```

6. **Create database backup (optional but recommended):**
   ```bash
   PGPASSWORD=scrapegoat pg_dump -h pgsql.fenrirsden.org -U scrapegoat -d scrapegoat | gzip > "$BACKUP_DIR/scrapegoat_db_${BACKUP_DATE}.sql.gz"
   ```

**Expected Result:** Complete backup in `/opt/scrapegoat/backup_<timestamp>/`

---

### Phase 2: Stop Current Services (5 minutes)

**Objective:** Gracefully shutdown all scrapegoat services

**Steps:**

1. **Stop systemd service:**
   ```bash
   systemctl stop scrapegoat
   ```

2. **Verify all containers stopped:**
   ```bash
   docker ps -a | grep scrapegoat
   ```

3. **Remove old containers:**
   ```bash
   cd /opt/scrapegoat/scrapegoat
   docker compose -f docker-compose.byo-postgres.yml down
   ```

**Expected Result:** All scrapegoat containers stopped and removed

---

### Phase 3: Update Source Code (10 minutes)

**Objective:** Pull latest changes from repository

**Steps:**

1. **Navigate to deployment directory:**
   ```bash
   cd /opt/scrapegoat/scrapegoat
   ```

2. **Stash any local changes (if any):**
   ```bash
   git stash push -m "Pre-migration stash $(date)"
   ```

3. **Fetch latest changes:**
   ```bash
   git fetch origin
   ```

4. **Checkout latest version:**
   ```bash
   git checkout dcf6ca4
   # OR if the branch/main has been updated:
   # git pull origin main
   ```

5. **Verify version:**
   ```bash
   git log --oneline -1
   # Expected: dcf6ca4 fix: resolve all TypeScript compilation errors (96 → 0)
   ```

**Expected Result:** Source code updated to commit dcf6ca4

---

### Phase 4: Rebuild Docker Images (20 minutes)

**Objective:** Build new Docker images with updated code

**Steps:**

1. **Build main scrapegoat image:**
   ```bash
   cd /opt/scrapegoat/scrapegoat
   docker build -t gitlab.fenrirsden.org/pub/scrapegoat:latest -f Dockerfile .
   ```

2. **Build crawl4ai image:**
   ```bash
   docker build -t scrapegoat-crawl4ai:latest -f services/crawl4ai/Dockerfile ./services/crawl4ai
   ```

3. **Verify images built:**
   ```bash
   docker images | grep scrapegoat
   ```

**Expected Result:** New Docker images built successfully

---

### Phase 5: Update Configuration (5 minutes)

**Objective:** Ensure environment configuration is correct

**Steps:**

1. **Compare new .env.example with current .env:**
   ```bash
   diff .env.example .env || true
   ```

2. **Update .env if needed** (preserve current settings):
   - Keep DATABASE_URL, OPENAI_API_BASE, DOCS_MCP_EMBEDDING_MODEL, etc.
   - Check for any new required environment variables

3. **Verify environment file:**
   ```bash
   cat /opt/scrapegoat/scrapegoat/.env
   ```

**Expected Result:** .env file updated with all required variables

---

### Phase 6: Start Services (10 minutes)

**Objective:** Start all scrapegoat services

**Steps:**

1. **Start via systemd:**
   ```bash
   systemctl start scrapegoat
   ```

2. **Monitor startup:**
   ```bash
   journalctl -u scrapegoat -f
   ```

3. **Verify containers running:**
   ```bash
   docker ps | grep scrapegoat
   ```

4. **Check container health:**
   ```bash
   docker inspect scrapegoat-worker | grep -A 5 Health
   docker inspect scrapegoat-crawl4ai | grep -A 5 Health
   ```

**Expected Result:** All services running and healthy

---

### Phase 7: Post-Deployment Verification (15 minutes)

**Objective:** Verify all services are working correctly

**Steps:**

1. **Check service endpoints:**
   ```bash
   # Worker API
   curl http://localhost:8080/health
   
   # MCP Server
   curl http://localhost:8888/health
   
   # Web UI (should return HTML)
   curl http://localhost:9090/
   
   # Crawl4AI
   curl http://localhost:8001/health
   ```

2. **Check nginx proxy:**
   ```bash
   curl http://docs.fenrirsden.org/
   ```

3. **Test MCP connection:**
   ```bash
   curl http://docs.fenrirsden.org:8888/health
   ```

4. **Verify database connection:**
   ```bash
   PGPASSWORD=scrapegoat psql -h pgsql.fenrirsden.org -U scrapegoat -d scrapegoat -c "SELECT COUNT(*) FROM libraries;"
   ```

5. **Check logs for errors:**
   ```bash
   docker logs scrapegoat-worker --tail 50
   docker logs scrapegoat-mcp --tail 50
   docker logs scrapegoat-web --tail 50
   docker logs scrapegoat-crawl4ai --tail 50
   ```

6. **Test web UI functionality** (manual):
   - Navigate to http://docs.fenrirsden.org/
   - Verify libraries are listed
   - Verify search works
   - Check accessibility features (keyboard navigation, screen reader compatibility)

**Expected Result:** All services responding correctly, no errors in logs

---

### Phase 8: Functional Testing (15 minutes)

**Objective:** Verify core functionality

**Steps:**

1. **Test library listing:**
   ```bash
   curl -X GET http://localhost:8080/api/libraries
   ```

2. **Test search functionality:**
   ```bash
   curl -X POST http://localhost:8080/api/search \
     -H "Content-Type: application/json" \
     -d '{"query": "test", "limit": 5}'
   ```

3. **Test job creation** (if applicable):
   ```bash
   curl -X POST http://localhost:8080/api/indexing/scrape \
     -H "Content-Type: application/json" \
     -d '{"url": "https://example.com", "library": "test-lib", "version": "1.0.0", "maxPages": 1}'
   ```

4. **Check accessibility improvements:**
   - Responsive mobile navigation
   - Keyboard navigation support
   - ARIA labels
   - Color contrast compliance

**Expected Result:** All core functions working, accessibility improvements visible

---

## Rollback Plan

**If critical issues are encountered:**

1. **Stop new deployment:**
   ```bash
   systemctl stop scrapegoat
   cd /opt/scrapegoat/scrapegoat
   docker compose -f docker-compose.byo-postgres.yml down
   ```

2. **Restore from backup:**
   ```bash
   BACKUP_DIR="/opt/scrapegoat/backup_<timestamp>"  # Use actual backup timestamp
   rm -rf /opt/scrapegoat/scrapegoat
   cp -r "$BACKUP_DIR/scrapegoat" /opt/scrapegoat/
   cp "$BACKUP_DIR/env" /opt/scrapegoat/env
   cp "$BACKUP_DIR/scrapegoat.service" /etc/systemd/system/scrapegoat.service
   systemctl daemon-reload
   ```

3. **Restore database** (if needed):
   ```bash
   gunzip -c "$BACKUP_DIR/scrapegoat_db_<timestamp>.sql.gz" | PGPASSWORD=scrapegoat psql -h pgsql.fenrirsden.org -U scrapegoat -d scrapegoat
   ```

4. **Rebuild old images:**
   ```bash
   cd /opt/scrapegoat/scrapegoat
   git checkout 4b9193b
   docker build -t gitlab.fenrirsden.org/pub/scrapegoat:latest .
   docker build -t scrapegoat-crawl4ai:latest -f services/crawl4ai/Dockerfile ./services/crawl4ai
   ```

5. **Restart services:**
   ```bash
   systemctl start scrapegoat
   ```

---

## Known Issues & Mitigation

### Potential Issue 1: Build Failures
**Symptom:** Docker build fails
**Mitigation:** 
- Ensure sufficient disk space (>5GB)
- Check network connectivity to gitlab.fenrirsden.org
- Try rebuilding without cache: `docker build --no-cache ...`

### Potential Issue 2: Port Conflicts
**Symptom:** Services fail to start due to port conflicts
**Mitigation:**
- Verify ports 8080, 8888, 9090, 8001 are available
- Check nginx configuration doesn't conflict

### Potential Issue 3: Database Connection Issues
**Symptom:** Services can't connect to PostgreSQL
**Mitigation:**
- Verify pgsql.fenrirsden.org is accessible
- Check DATABASE_URL in .env
- Verify network connectivity between hosts

### Potential Issue 4: Embedding Service Issues
**Symptom:** Embeddings fail to generate
**Mitigation:**
- Verify https://embed.fenrirsden.org/v1 is accessible
- Check DOCS_MCP_EMBEDDING_MODEL setting
- Review worker logs for specific errors

---

## Post-Migration Cleanup

After successful migration and verification:

1. **Keep backup for 7 days:**
   ```bash
   # Schedule cleanup
   echo "find /opt/scrapegoat/backup_* -mtime +7 -exec rm -rf {} \;" | at now + 7 days
   ```

2. **Remove old Docker images:**
   ```bash
   docker image prune -a
   ```

3. **Document migration:**
   - Update deployment documentation
   - Record any fixes needed
   - Create log for applying to local repo

---

## Deployment Log (to be filled during migration)

### Issues Encountered & Fixes

| # | Issue | Solution | Apply to Repo? |
|---|-------|----------|----------------|
| 1 | | | |
| 2 | | | |

### Configuration Changes Made

| File | Change | Reason |
|------|--------|--------|
| | | |

### Commands Executed

```bash
# Migration commands log:
```

---

## Appendix: Critical File Locations

**Deployment Directory:** `/opt/scrapegoat/scrapegoat`
**Environment File:** `/opt/scrapegoat/env` and `/opt/scrapegoat/scrapegoat/.env`
**Systemd Service:** `/etc/systemd/system/scrapegoat.service`
**Docker Compose:** `/opt/scrapegoat/scrapegoat/docker-compose.byo-postgres.yml`
**Nginx Config:** `/etc/nginx/sites-enabled/*` (to be verified)
**Backup Location:** `/opt/scrapegoat/backup_<timestamp>/`

---

## Sign-Off

**Pre-Migration Check:**
- [ ] Backup completed
- [ ] Rollback plan tested
- [ ] Stakeholders notified

**Post-Migration Verification:**
- [ ] All services healthy
- [ ] Core functionality tested
- [ ] Accessibility improvements verified
- [ ] Logs reviewed

**Migration Completed By:** _______________
**Date:** _______________
**Review Required:** _______________
