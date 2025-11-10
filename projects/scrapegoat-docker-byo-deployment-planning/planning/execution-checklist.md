# Scrapegoat Docker BYO Deployment - Execution Checklist

**Quick Reference Guide for Step-by-Step Execution**

---

## Pre-Execution Setup

```bash
# Save these credentials for reference:
POSTGRES_ROOT_USER=postgres
POSTGRES_ROOT_PASSWORD=Mustiness-Grit7-Kindling
POSTGRES_HOST=postgres.den.lan
EMBED_SERVICE=http://embed.den.lan
TARGET_SERVER=docs.den.lan (10.1.1.27)
```

---

## Phase 1: Pre-Deployment Verification (15 min)

### Access and Infrastructure
- [ ] SSH to docs.den.lan: `ssh root@docs.den.lan`
- [ ] Verify Docker installed: `docker --version` (v20+)
- [ ] Verify Docker Compose: `docker compose version` (v2+)

### PostgreSQL Connectivity
- [ ] Test PostgreSQL: `psql -h postgres.den.lan -U postgres -d postgres -c "SELECT version();"`
- [ ] Verify pgvector available: Check extension is listed
- [ ] Password: `Mustiness-Grit7-Kindling`

### Embedding Service
- [ ] Test embed.den.lan: `curl -s http://embed.den.lan/models`
- [ ] Verify model: nomic-ai/nomic-embed-text-v1.5 present
- [ ] Test embeddings endpoint: Returns 768-dimension vectors

### Port Availability
- [ ] Port 8080 free (Worker)
- [ ] Port 6280 free (MCP)
- [ ] Port 80 free (Web)
- [ ] Port 8001 free (Crawl4AI)
- [ ] Check command: `lsof -i :{port}` for each

### Cleanup
- [ ] Remove old installations: `rm -rf /opt/scrapegoat*`
- [ ] Stop old service if exists: `systemctl stop scrapegoat`
- [ ] Remove systemd service: `rm /etc/systemd/system/scrapegoat.service`

---

## Phase 2: Database Initialization (10 min)

### Generate Password
- [ ] Generate password: `DB_PASSWORD=$(openssl rand -base64 32 | tr -d '=/+')`
- [ ] Save password: `echo $DB_PASSWORD` (Copy this!)
- [ ] Saved password: ________________

### Database Setup
- [ ] SSH to postgres.den.lan: `ssh root@postgres.den.lan`
- [ ] Connect to PostgreSQL: `sudo -u postgres psql`
- [ ] Drop existing DB (if any): `DROP DATABASE IF EXISTS scrapegoat;`
- [ ] Create user: `CREATE USER scrapegoat_user WITH PASSWORD 'YOUR_PASSWORD';`
- [ ] Create database: `CREATE DATABASE scrapegoat OWNER scrapegoat_user;`
- [ ] Grant privileges: `GRANT ALL PRIVILEGES ON DATABASE scrapegoat TO scrapegoat_user;`

### Enable pgvector
- [ ] Connect to DB: `\c scrapegoat`
- [ ] Enable extension: `CREATE EXTENSION IF NOT EXISTS vector;`
- [ ] Verify: `\dx vector` (should show version 0.8.0+)
- [ ] Exit: `\q`

### Test Connection
- [ ] Return to docs.den.lan: `exit`
- [ ] Test connection: `psql -h postgres.den.lan -U scrapegoat_user -d scrapegoat -c "SELECT version();"`
- [ ] Create DATABASE_URL: `postgresql://scrapegoat_user:{PASSWORD}@postgres.den.lan:5432/scrapegoat`
- [ ] DATABASE_URL saved: ________________

---

## Phase 3: File Deployment (10 min)

### Create Directory
- [ ] Create deployment dir: `mkdir -p /opt/scrapegoat-docker`
- [ ] Change to directory: `cd /opt/scrapegoat-docker`

### Copy Files
- [ ] Copy docker-compose.yml from local:
  ```bash
  scp /home/mp/Workspace/scrapegoat/projects/docker-deployment-planning/configurations/docker-compose.byo.yml \
      root@docs.den.lan:/opt/scrapegoat-docker/docker-compose.yml
  ```
- [ ] Verify file exists: `ls -lh docker-compose.yml`

### Create .env File
- [ ] Create .env (see deployment-phases.md for full content)
- [ ] **CRITICAL**: Update DATABASE_URL with actual password
- [ ] Verify DATABASE_URL: `grep DATABASE_URL= .env`
- [ ] Set OPENAI_API_BASE: `http://embed.den.lan/v1`
- [ ] Set OPENAI_API_KEY: `not-required`
- [ ] Set DOCS_MCP_EMBEDDING_MODEL: `nomic-ai/nomic-embed-text-v1.5`
- [ ] Set CRAWL4AI_ENABLED: `true` or `false`

### Secure Configuration
- [ ] Set permissions: `chmod 600 .env`
- [ ] Verify: `ls -la .env` (should be -rw-------)
- [ ] Validate compose: `docker compose config > /dev/null`

---

## Phase 4: Service Startup (5 min)

### Pull Images
- [ ] Pull images: `docker compose pull`
- [ ] All images downloaded successfully

### Start Services
- [ ] Start services: `docker compose up -d`
  - Alternative with Crawl4AI: `docker compose --profile crawl4ai up -d`
- [ ] Check status: `docker compose ps`
- [ ] All containers "Up"

### Monitor Startup
- [ ] Watch logs: `docker compose logs -f` (Ctrl+C to exit)
- [ ] Worker shows: "Database connected"
- [ ] Worker shows: "Server listening on port 8080"
- [ ] MCP shows: "Server listening on port 6280"
- [ ] Web shows: "Server listening on port 80"

### Health Checks
- [ ] Worker healthy: `docker inspect scrapegoat-worker --format='{{.State.Health.Status}}'`
- [ ] Returns "healthy"
- [ ] MCP and Web started after Worker

---

## Phase 5: Validation (15 min)

### Service Health
- [ ] Worker health: `curl -s http://localhost:8080/health | jq .status`
- [ ] Returns "ok"
- [ ] MCP health: `curl -s http://localhost:6280/health | jq .status`
- [ ] Returns "ok"
- [ ] Web health: `curl -s http://localhost:80/health | jq .status`
- [ ] Returns "ok"

### Database Verification
- [ ] Tables created: `psql -h postgres.den.lan -U scrapegoat_user -d scrapegoat -c "\dt"`
- [ ] See: documents, document_sections, libraries, _schema_migrations
- [ ] pgvector active: `SELECT extname FROM pg_extension WHERE extname='vector';`

### Embedding Integration
- [ ] Worker logs show embedding connection
- [ ] No "embedding disabled" messages
- [ ] Check: `docker compose logs worker | grep -i embedding`

### End-to-End Test
- [ ] Create test library via API
- [ ] Verify in database: `SELECT id, name FROM libraries;`
- [ ] Test library appears in list

### Resource Usage
- [ ] Check stats: `docker stats --no-stream`
- [ ] Worker: ~500MB-1GB
- [ ] MCP: ~100-200MB
- [ ] Web: ~100-200MB
- [ ] All within acceptable limits

---

## Phase 6: Post-Deployment (10 min)

### Auto-Start Configuration
- [ ] Verify restart policy: "unless-stopped"
- [ ] Test auto-restart: Stop worker, verify it restarts
- [ ] Optional: Create systemd service (see deployment-phases.md)

### Documentation
- [ ] Create ACCESS.md with service URLs
- [ ] Create backup.sh script
- [ ] Update backup.sh with actual password
- [ ] Test backup: `/opt/scrapegoat-docker/backup.sh`
- [ ] Create OPERATIONS.md guide

### Final Verification
- [ ] All services running: `docker compose ps`
- [ ] All endpoints respond
- [ ] No errors in logs
- [ ] Data volume created: `docker volume ls | grep scrapegoat`

---

## Deployment Complete Checklist

### Critical Verifications
- [ ] Database initialized with pgvector
- [ ] All 4 containers running (worker, mcp, web, crawl4ai*)
- [ ] Worker health check passing
- [ ] Database migrations completed
- [ ] Embedding service integrated
- [ ] Test library creation successful
- [ ] Access documentation created
- [ ] Backup script configured

### Access Information
- [ ] Web UI accessible: http://docs.den.lan
- [ ] MCP endpoint accessible: http://docs.den.lan:6280/mcp
- [ ] Worker API accessible: http://docs.den.lan80/api

### Post-Deployment Tasks
- [ ] Set up automated backups (cron job)
- [ ] Monitor logs for 24 hours
- [ ] Test document indexing workflow
- [ ] Document any custom configurations

---

## Quick Commands Reference

```bash
# View logs
cd /opt/scrapegoat-docker && docker compose logs -f

# Restart services
docker compose restart

# Stop services
docker compose down

# Start services
docker compose up -d

# Check status
docker compose ps

# Database access
psql -h postgres.den.lan -U scrapegoat_user -d scrapegoat

# Backup database
/opt/scrapegoat-docker/backup.sh
```

---

## Troubleshooting Quick Reference

| Issue | Check | Fix |
|-------|-------|-----|
| Service won't start | `docker compose logs {service}` | Check .env DATABASE_URL |
| Port in use | `lsof -i :{port}` | Stop conflicting service |
| Database connection | `psql -h postgres.den.lan -U scrapegoat_user -d scrapegoat` | Verify password, firewall |
| Unhealthy worker | `docker compose logs worker` | Check database connectivity |
| Embedding not working | `curl http://embed.den.lan/models` | Verify embed.den.lan accessible |

---

## Success Indicators

✅ **All services "Up" and worker "healthy"**
✅ **All /health endpoints return {"status": "ok"}**
✅ **Database tables created**
✅ **Test library creation works**
✅ **No errors in logs**

**Deployment Time**: ~65 minutes for complete execution

---

**Quick Start**: Follow this checklist sequentially. Mark each item as you complete it. Do not skip phases.

**For Details**: See [deployment-phases.md](deployment-phases.md) for detailed instructions and commands for each step.

**Emergency Rollback**: `cd /opt/scrapegoat-docker && docker compose down && docker volume rm scrapegoat-data`

---

*Last Updated: 2025-11-10*
