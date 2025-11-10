# Scrapegoat Docker Compose BYO Deployment - Detailed Phases

**Deployment Plan Version**: 1.0
**Date**: 2025-11-10
**Configuration**: BYO (Bring Your Own)

---

## Overview

This document provides step-by-step instructions for deploying Scrapegoat using Docker Compose BYO configuration. Each phase must be completed successfully before proceeding to the next.

### Deployment Timeline

| Phase | Duration | Description |
|-------|----------|-------------|
| Phase 1 | 15 min | Pre-deployment verification |
| Phase 2 | 10 min | Database initialization |
| Phase 3 | 10 min | File deployment and configuration |
| Phase 4 | 5 min | Service startup |
| Phase 5 | 15 min | Validation and testing |
| Phase 6 | 10 min | Post-deployment tasks |
| **Total** | **65 min** | **Complete deployment** |

---

## Phase 1: Pre-Deployment Verification (15 minutes)

### Objective
Verify all infrastructure components are accessible and ready for deployment.

### Step 1.1: Verify docs.den.lan Access

```bash
# SSH into application server
ssh root@docs.den.lan

# Expected: Successful login with root@docs.den.lan prompt
```

**Troubleshooting**: If SSH fails, verify IP address and credentials.

### Step 1.2: Verify Docker Installation

```bash
# Check Docker version
docker --version

# Expected output: Docker version 20.x or higher
# Example: Docker version 24.0.7, build afdd53b

# Check Docker Compose version
docker compose version

# Expected output: Docker Compose version v2.x or higher
# Example: Docker Compose version v2.23.0
```

**If Docker is not installed**:
```bash
# Install Docker (Ubuntu/Debian)
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Verify installation
docker --version
```

### Step 1.3: Verify PostgreSQL Connectivity

```bash
# Test PostgreSQL connection from docs.den.lan
psql -h postgres.den.lan -U postgres -d postgres -c "SELECT version();"

# Expected: PostgreSQL version output
# Example: PostgreSQL 18.0 (Ubuntu 18.0-1.pgdg22.04+1) on x86_64-pc-linux-gnu...

# If connection fails, verify:
# 1. postgres.den.lan is accessible: ping postgres.den.lan
# 2. Port 5432 is open: nc -zv postgres.den.lan 5432
# 3. Firewall rules allow connection
```

**Credentials**: postgres / Mustiness-Grit7-Kindling

### Step 1.4: Verify pgvector Extension Availability

```bash
# Check if pgvector is available
psql -h postgres.den.lan -U postgres -d postgres -c \
  "SELECT * FROM pg_available_extensions WHERE name = 'vector';"

# Expected: Row showing vector extension with version 0.8.0 or higher
```

### Step 1.5: Verify Embedding Service Connectivity

```bash
# Test embedding service endpoint
curl -s http://embed.den.lan/models

# Expected: JSON response with available models including nomic-ai/nomic-embed-text-v1.5

# Test embeddings endpoint
curl -s -X POST http://embed.den.lan/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "input": ["test"],
    "model": "nomic-ai/nomic-embed-text-v1.5"
  }' | jq '.data[0].embedding | length'

# Expected: 768 (embedding dimension)
```

### Step 1.6: Verify Port Availability

```bash
# Check required ports are free
for port in 8080 6280 80 8001; do
  if lsof -i :$port > /dev/null 2>&1; then
    echo "⚠️  Port $port is in use!"
    lsof -i :$port
  else
    echo "✅ Port $port is available"
  fi
done

# Expected: All ports available (✅)
```

**If ports are in use**:
```bash
# Check what's using the port
lsof -i :{PORT_NUMBER}

# Stop conflicting service if safe
systemctl stop {service_name}

# Or kill process (use with caution)
kill {PID}
```

### Step 1.7: Clean Up Previous Installation (If Any)

```bash
# Check for previous scrapegoat installations
ls -la /opt/scrapegoat* 2>/dev/null

# If previous installation exists, remove it
rm -rf /opt/scrapegoat*

# Check for previous systemd service
systemctl status scrapegoat 2>/dev/null

# If service exists, stop and disable it
systemctl stop scrapegoat
systemctl disable scrapegoat
rm /etc/systemd/system/scrapegoat.service
systemctl daemon-reload
```

### Phase 1 Completion Checklist

- [ ] SSH access to docs.den.lan verified
- [ ] Docker and Docker Compose installed and functional
- [ ] PostgreSQL connectivity confirmed
- [ ] pgvector extension available
- [ ] Embedding service accessible
- [ ] All required ports available
- [ ] Previous installation cleaned up

**Status Check**: All items must be checked before proceeding to Phase 2.

---

## Phase 2: Database Initialization (10 minutes)

### Objective
Create and configure PostgreSQL database with pgvector extension and proper user permissions.

### Step 2.1: Generate Secure Database Password

```bash
# Generate a strong random password (save this!)
DB_PASSWORD=$(openssl rand -base64 32 | tr -d '=/+')
echo "Generated Password: $DB_PASSWORD"

# IMPORTANT: Save this password - you'll need it for .env configuration
# Example output: Xk7mN9pQwR2tY5vL8zB3nH6jF4sD1gA
```

**Action**: Copy and save the generated password securely.

### Step 2.2: Connect to PostgreSQL

```bash
# SSH to postgres.den.lan
ssh root@postgres.den.lan

# Switch to postgres user and connect
sudo -u postgres psql

# You should see: postgres=#
```

### Step 2.3: Create Database and User

```sql
-- Check if database exists
SELECT datname FROM pg_database WHERE datname = 'scrapegoat';

-- If exists, drop it (CAUTION: This destroys all data!)
DROP DATABASE IF EXISTS scrapegoat;

-- Create database user with generated password
CREATE USER scrapegoat_user WITH PASSWORD 'YOUR_GENERATED_PASSWORD_HERE';

-- Create database owned by scrapegoat_user
CREATE DATABASE scrapegoat OWNER scrapegoat_user;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE scrapegoat TO scrapegoat_user;

-- Verify creation
\l scrapegoat

-- Expected output:
--  Name       | Owner           | Encoding | Locale Provider | Collate | Ctype | ...
-- ------------+-----------------+----------+-----------------+---------+-------+-----
--  scrapegoat | scrapegoat_user | UTF8     | ...             | ...     | ...   | ...
```

### Step 2.4: Enable pgvector Extension

```sql
-- Connect to scrapegoat database
\c scrapegoat

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify installation
\dx vector

-- Expected output:
--  Name   | Version | Schema | Description
-- --------+---------+--------+----------------------------------
--  vector | 0.8.0   | public | vector data type and ivfflat...

-- List extension functions (optional verification)
\df *.*vector*

-- Exit psql
\q
```

### Step 2.5: Test Connection from docs.den.lan

```bash
# Return to docs.den.lan
exit  # Exit from postgres.den.lan

# Test connection with new user (replace PASSWORD with your generated one)
psql -h postgres.den.lan -U scrapegoat_user -d scrapegoat -c "SELECT version();"

# If prompted for password, enter the generated password
# Expected: PostgreSQL version output

# Test pgvector extension
psql -h postgres.den.lan -U scrapegoat_user -d scrapegoat -c \
  "SELECT extname, extversion FROM pg_extension WHERE extname='vector';"

# Expected:
#  extname | extversion
# ---------+------------
#  vector  | 0.8.0
```

### Step 2.6: Create CONNECTION_URL

```bash
# Construct the DATABASE_URL (replace {PASSWORD} with your generated password)
DATABASE_URL="postgresql://scrapegoat_user:{PASSWORD}@postgres.den.lan:5432/scrapegoat"

# Example:
# DATABASE_URL="postgresql://scrapegoat_user:Xk7mN9pQwR2tY5vL8zB3nH6jF4sD1gA@postgres.den.lan:5432/scrapegoat"

echo "DATABASE_URL=$DATABASE_URL"

# IMPORTANT: Save this connection string for Phase 3
```

### Phase 2 Completion Checklist

- [ ] Secure database password generated and saved
- [ ] Database 'scrapegoat' created
- [ ] User 'scrapegoat_user' created with password
- [ ] pgvector extension enabled
- [ ] Connection tested from docs.den.lan
- [ ] DATABASE_URL connection string created and saved

**Status Check**: All items must be checked before proceeding to Phase 3.

---

## Phase 3: File Deployment and Configuration (10 minutes)

### Objective
Deploy Docker Compose configuration and create environment file with proper settings.

### Step 3.1: Create Deployment Directory

```bash
# On docs.den.lan
mkdir -p /opt/scrapegoat-docker
cd /opt/scrapegoat-docker

# Verify directory created
pwd
# Expected: /opt/scrapegoat-docker
```

### Step 3.2: Copy Docker Compose Configuration

```bash
# From your local machine, copy the BYO docker-compose file
scp /home/mp/Workspace/scrapegoat/projects/docker-deployment-planning/configurations/docker-compose.byo.yml \
    root@docs.den.lan:/opt/scrapegoat-docker/docker-compose.yml

# Verify file copied
ssh root@docs.den.lan "ls -lh /opt/scrapegoat-docker/docker-compose.yml"

# Expected: File listed with size ~6-8KB
```

### Step 3.3: Create Environment File

```bash
# On docs.den.lan
cd /opt/scrapegoat-docker

# Create .env file with actual configuration
cat > .env << 'ENVEOF'
# ============================================================================
# Scrapegoat BYO Configuration - docs.den.lan
# ============================================================================
# Created: 2025-11-10
# Configuration: BYO (Bring Your Own) - External PostgreSQL and Embedding

# ----------------------------------------------------------------------------
# DATABASE CONFIGURATION
# ----------------------------------------------------------------------------
DATABASE_URL=postgresql://scrapegoat_user:YOUR_PASSWORD_HERE@postgres.den.lan:5432/scrapegoat

# ----------------------------------------------------------------------------
# EMBEDDING API CONFIGURATION
# ----------------------------------------------------------------------------
OPENAI_API_BASE=http://embed.den.lan/v1
OPENAI_API_KEY=not-required
DOCS_MCP_EMBEDDING_MODEL=nomic-ai/nomic-embed-text-v1.5

# ----------------------------------------------------------------------------
# SERVICE PORTS
# ----------------------------------------------------------------------------
MCP_PORT=6280
WEB_PORT=80
WORKER_PORT=8080

# ----------------------------------------------------------------------------
# CRAWL4AI CONFIGURATION
# ----------------------------------------------------------------------------
CRAWL4AI_ENABLED=true
CRAWL4AI_SERVICE_URL=http://localhost:8001
CRAWL4AI_VERBOSE=false
CRAWL4AI_HEADLESS=true
CRAWL4AI_MAX_CONCURRENT=5
CRAWL4AI_TIMEOUT=30

# ----------------------------------------------------------------------------
# OPTIONAL CONFIGURATIONS
# ----------------------------------------------------------------------------
DOCS_MCP_STORE_PATH=/data
POSTHOG_API_KEY=
NODE_ENV=production

ENVEOF

# CRITICAL: Update the DATABASE_URL with your actual password
nano .env
# Find: YOUR_PASSWORD_HERE
# Replace with: Your generated password from Phase 2
# Save and exit (Ctrl+X, Y, Enter)
```

### Step 3.4: Verify Environment Configuration

```bash
# Check .env file exists and has correct permissions
ls -la .env

# Expected: -rw-r--r-- 1 root root ~1200 Nov 10 HH:MM .env

# Verify DATABASE_URL is set correctly (password should not be YOUR_PASSWORD_HERE)
grep "DATABASE_URL=" .env

# Expected: DATABASE_URL=postgresql://scrapegoat_user:{ACTUAL_PASSWORD}@postgres.den.lan:5432/scrapegoat

# Verify embedding service endpoint
grep "OPENAI_API_BASE=" .env

# Expected: OPENAI_API_BASE=http://embed.den.lan/v1
```

### Step 3.5: Secure Environment File

```bash
# Restrict permissions on .env file (contains sensitive data)
chmod 600 .env

# Verify permissions
ls -la .env

# Expected: -rw------- 1 root root ~1200 Nov 10 HH:MM .env
```

### Step 3.6: Verify Docker Compose Configuration

```bash
# Validate docker-compose.yml syntax
docker compose config > /dev/null

# Expected: No errors (if successful, no output)

# View the configuration (optional)
docker compose config | head -50

# Check for required services
docker compose config --services

# Expected output (one service per line):
# worker
# mcp
# web
# crawl4ai
```

### Phase 3 Completion Checklist

- [ ] Deployment directory created at /opt/scrapegoat-docker
- [ ] docker-compose.yml copied and present
- [ ] .env file created with all required variables
- [ ] DATABASE_URL updated with actual password
- [ ] Environment file permissions secured (600)
- [ ] Docker Compose configuration validated

**Status Check**: All items must be checked before proceeding to Phase 4.

---

## Phase 4: Service Startup (5 minutes)

### Objective
Pull Docker images and start all Scrapegoat services using Docker Compose.

### Step 4.1: Pull Docker Images

```bash
# On docs.den.lan in /opt/scrapegoat-docker
cd /opt/scrapegoat-docker

# Pull required images (this may take 5-10 minutes depending on connection)
docker compose pull

# Expected output:
# [+] Pulling 4/4
#  ✔ worker Pulled
#  ✔ mcp Pulled
#  ✔ web Pulled
#  ✔ crawl4ai Pulled
```

**Note**: If using --profile crawl4ai, the crawl4ai image will also be pulled.

### Step 4.2: Start Services in Background

```bash
# Start all services (without crawl4ai profile by default)
docker compose up -d

# To include Crawl4AI service, use:
# docker compose --profile crawl4ai up -d

# Expected output:
# [+] Running 4/4
#  ✔ Network scrapegoat-network    Created
#  ✔ Container scrapegoat-worker   Started
#  ✔ Container scrapegoat-mcp      Started
#  ✔ Container scrapegoat-web      Started
```

### Step 4.3: Verify Container Status

```bash
# Check running containers
docker compose ps

# Expected output (all services should be "running" and "healthy"):
# NAME                 STATUS          PORTS
# scrapegoat-worker    Up (healthy)
# scrapegoat-mcp       Up
# scrapegoat-web       Up

# If any service is not "Up", check logs
docker compose logs {service_name}
```

### Step 4.4: Monitor Startup Logs

```bash
# Watch logs for all services (Ctrl+C to exit)
docker compose logs -f

# Or check individual service logs:
docker compose logs -f worker
docker compose logs -f mcp
docker compose logs -f web

# Look for:
# ✅ "Database connected successfully"
# ✅ "Server listening on port 8080" (worker)
# ✅ "Server listening on port 6280" (mcp)
# ✅ "Server listening on port 80" (web)
```

### Step 4.5: Wait for Health Checks

```bash
# Worker has a health check - wait for it to become healthy
# This can take 10-15 seconds after startup

# Check health status
docker inspect scrapegoat-worker --format='{{.State.Health.Status}}'

# Expected: "healthy"

# If "starting", wait a few seconds and check again
# If "unhealthy", check logs: docker compose logs worker
```

### Step 4.6: Verify Service Dependencies

```bash
# MCP and Web depend on Worker health check
# Verify they started after Worker became healthy

docker compose logs mcp | grep "started"
docker compose logs web | grep "started"

# Both should show startup messages after Worker health check passed
```

### Phase 4 Completion Checklist

- [ ] Docker images pulled successfully
- [ ] All containers started (docker compose up -d)
- [ ] Worker container is healthy
- [ ] MCP container is running
- [ ] Web container is running
- [ ] No error messages in logs
- [ ] All services listening on expected ports

**Status Check**: All items must be checked before proceeding to Phase 5.

---

## Phase 5: Validation and Testing (15 minutes)

### Objective
Thoroughly test all services and verify complete functionality.

### Step 5.1: Test Worker API Health

```bash
# Test Worker health endpoint
curl -s http://localhost:8080/health | jq .

# Expected output:
# {
#   "status": "ok",
#   "database": "connected",
#   "version": "1.0.0"
# }
```

### Step 5.2: Test MCP Server Endpoint

```bash
# Test MCP HTTP endpoint
curl -s http://localhost:6280/health | jq .

# Expected output:
# {
#   "status": "ok",
#   "version": "1.0.0"
# }

# Test MCP tools list
curl -s -X POST http://localhost:6280/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq .

# Expected: List of available MCP tools
```

### Step 5.3: Test Web Interface

```bash
# Test Web UI health
curl -s http://localhost:80/health | jq .

# Expected output:
# {
#   "status": "ok"
# }

# Test Web UI is serving HTML (from docs.den.lan)
curl -s http://localhost:80/ | grep -q "<!DOCTYPE html"
echo $?

# Expected: 0 (success)
```

### Step 5.4: Verify Database Connectivity

```bash
# Check database tables were created by migrations
psql -h postgres.den.lan -U scrapegoat_user -d scrapegoat -c "\dt"

# Expected: List of tables including:
# - documents
# - document_sections
# - libraries
# - _schema_migrations

# Check migrations ran successfully
psql -h postgres.den.lan -U scrapegoat_user -d scrapegoat \
  -c "SELECT version FROM _schema_migrations ORDER BY version;"

# Expected: List of migration versions (001, 002, 003, 010, etc.)
```

### Step 5.5: Verify pgvector Extension

```bash
# Verify vector extension is active
psql -h postgres.den.lan -U scrapegoat_user -d scrapegoat \
  -c "SELECT extname, extversion FROM pg_extension WHERE extname='vector';"

# Expected:
#  extname | extversion
# ---------+------------
#  vector  | 0.8.0
```

### Step 5.6: Test Embedding Service Integration

```bash
# Check worker logs for embedding service connection
docker compose logs worker | grep -i "embedding"

# Expected: Messages showing successful embedding API connection
# Should NOT see: "No credentials found" or "embedding disabled"

# Test embedding generation (via Worker API)
# Note: This requires a test library to be indexed
```

### Step 5.7: Test Document Indexing (End-to-End)

```bash
# Create a test library via Worker API
curl -s -X POST http://localhost:8080/api/libraries \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Library",
    "url": "https://example.com/docs",
    "description": "Test documentation"
  }' | jq .

# Expected: JSON response with library ID and status

# Check library was created in database
psql -h postgres.den.lan -U scrapegoat_user -d scrapegoat \
  -c "SELECT id, name, status FROM libraries WHERE name='Test Library';"

# Expected: One row showing the test library
```

### Step 5.8: Verify Crawl4AI Service (If Enabled)

```bash
# If CRAWL4AI_ENABLED=true, test Crawl4AI service
curl -s http://localhost:8001/health

# Expected: {"status": "ok"}

# Check Crawl4AI logs
docker compose logs crawl4ai | tail -20

# Expected: Service running, no errors
```

### Step 5.9: Check Resource Usage

```bash
# Check container resource usage
docker stats --no-stream

# Expected: Reasonable memory/CPU usage
# Worker: ~500MB-1GB RAM
# MCP: ~100-200MB RAM
# Web: ~100-200MB RAM
# Crawl4AI: ~500MB-1GB RAM
```

### Step 5.10: Verify Data Persistence

```bash
# Check Docker volume exists
docker volume ls | grep scrapegoat

# Expected: scrapegoat-data volume listed

# Inspect volume
docker volume inspect scrapegoat-data

# Expected: Volume details with mount point
```

### Phase 5 Completion Checklist

- [ ] Worker API health check passes
- [ ] MCP server responds correctly
- [ ] Web interface accessible and functional
- [ ] Database tables created by migrations
- [ ] pgvector extension active
- [ ] Embedding service integration working
- [ ] Test library creation successful
- [ ] Crawl4AI service healthy (if enabled)
- [ ] Resource usage within acceptable limits
- [ ] Data volume created and mounted

**Status Check**: All items must be checked before proceeding to Phase 6.

---

## Phase 6: Post-Deployment Tasks (10 minutes)

### Objective
Configure auto-start, document access, and set up operational procedures.

### Step 6.1: Configure Auto-Start on Boot

```bash
# Docker Compose services will auto-restart due to "restart: unless-stopped"
# Verify restart policy
docker inspect scrapegoat-worker --format='{{.HostConfig.RestartPolicy.Name}}'

# Expected: "unless-stopped"

# Test auto-restart
docker stop scrapegoat-worker
sleep 5
docker ps | grep scrapegoat-worker

# Expected: Container should automatically restart
```

### Step 6.2: Configure systemd Service (Optional)

If you want systemd to start Docker Compose on boot:

```bash
# Create systemd service file
cat > /etc/systemd/system/scrapegoat-docker.service << 'SERVICEEOF'
[Unit]
Description=Scrapegoat Docker Compose Service
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/scrapegoat-docker
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
SERVICEEOF

# Reload systemd
systemctl daemon-reload

# Enable service
systemctl enable scrapegoat-docker

# Test service
systemctl start scrapegoat-docker
systemctl status scrapegoat-docker
```

### Step 6.3: Document Access URLs

Create a quick reference file:

```bash
cat > /opt/scrapegoat-docker/ACCESS.md << 'ACCESSEOF'
# Scrapegoat Access Information

**Deployment Date**: 2025-11-10
**Server**: docs.den.lan (10.1.1.27)

## Service URLs

- **Web Interface**: http://docs.den.lan
- **MCP Server (HTTP)**: http://docs.den.lan:6280/mcp
- **MCP Server (SSE)**: http://docs.den.lan:6280/sse
- **Worker API**: http://docs.den.lan:8080/api
- **Crawl4AI**: http://docs.den.lan:8001 (if enabled)

## Management Commands

### View Logs
```bash
cd /opt/scrapegoat-docker
docker compose logs -f
docker compose logs -f worker
docker compose logs -f mcp
docker compose logs -f web
```

### Service Control
```bash
cd /opt/scrapegoat-docker
docker compose stop
docker compose start
docker compose restart
docker compose down  # Stop and remove containers
docker compose up -d  # Start services
```

### Database Access
```bash
psql -h postgres.den.lan -U scrapegoat_user -d scrapegoat
```

## Backup Procedures

See BACKUP.md for database backup procedures.

ACCESSEOF

echo "Access documentation created at /opt/scrapegoat-docker/ACCESS.md"
```

### Step 6.4: Create Backup Script

```bash
cat > /opt/scrapegoat-docker/backup.sh << 'BACKUPEOF'
#!/bin/bash
# Scrapegoat Database Backup Script

BACKUP_DIR="/opt/scrapegoat-backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_URL="postgresql://scrapegoat_user:PASSWORD@postgres.den.lan:5432/scrapegoat"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup database
echo "Creating backup: scrapegoat_$DATE.sql.gz"
pg_dump "$DB_URL" | gzip > "$BACKUP_DIR/scrapegoat_$DATE.sql.gz"

# Keep only last 30 days
find "$BACKUP_DIR" -name "scrapegoat_*.sql.gz" -mtime +30 -delete

echo "Backup completed successfully"
ls -lh "$BACKUP_DIR/scrapegoat_$DATE.sql.gz"
BACKUPEOF

# Make executable
chmod +x /opt/scrapegoat-docker/backup.sh

# Update PASSWORD in backup script
nano /opt/scrapegoat-docker/backup.sh
# Replace PASSWORD with your actual database password

# Test backup script
/opt/scrapegoat-docker/backup.sh
```

### Step 6.5: Configure Log Rotation

```bash
# Create logrotate configuration
cat > /etc/logrotate.d/scrapegoat-docker << 'LOGROTATEEOF'
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
LOGROTATEEOF

# Test logrotate configuration
logrotate -d /etc/logrotate.d/scrapegoat-docker
```

### Step 6.6: Create Operations Documentation

```bash
cat > /opt/scrapegoat-docker/OPERATIONS.md << 'OPSEOF'
# Scrapegoat Operations Guide

## Daily Operations

### Health Check
```bash
cd /opt/scrapegoat-docker
docker compose ps
curl http://localhost:8080/health
```

### View Logs
```bash
docker compose logs -f --tail=100
```

### Check Resource Usage
```bash
docker stats --no-stream
```

## Troubleshooting

### Service Not Starting
```bash
# Check logs
docker compose logs {service_name}

# Restart service
docker compose restart {service_name}
```

### Database Connection Issues
```bash
# Test database connection
psql -h postgres.den.lan -U scrapegoat_user -d scrapegoat -c "SELECT 1;"

# Check worker logs
docker compose logs worker | grep -i database
```

### Performance Issues
```bash
# Check resource usage
docker stats

# Check database queries
psql -h postgres.den.lan -U scrapegoat_user -d scrapegoat \
  -c "SELECT * FROM pg_stat_activity WHERE datname='scrapegoat';"
```

## Maintenance

### Update Images
```bash
cd /opt/scrapegoat-docker
docker compose pull
docker compose up -d
```

### Database Backup
```bash
/opt/scrapegoat-docker/backup.sh
```

### View Database Size
```bash
psql -h postgres.den.lan -U scrapegoat_user -d scrapegoat \
  -c "SELECT pg_size_pretty(pg_database_size('scrapegoat'));"
```

OPSEOF
```

### Step 6.7: Final Verification

```bash
# Verify all services are running
docker compose ps

# Expected: All services "Up" and worker "healthy"

# Test all endpoints one final time
curl -s http://localhost:8080/health | jq .status
curl -s http://localhost:6280/health | jq .status
curl -s http://localhost:80/health | jq .status

# All should return: "ok"
```

### Step 6.8: Create Deployment Summary

```bash
cat > /opt/scrapegoat-docker/DEPLOYMENT_SUMMARY.md << 'SUMMARYEOF'
# Scrapegoat Deployment Summary

**Deployment Date**: $(date +%Y-%m-%d)
**Server**: docs.den.lan (10.1.1.27)
**Configuration**: Docker Compose BYO

## Services Deployed

- ✅ scrapegoat-worker (Port 8080)
- ✅ scrapegoat-mcp (Port 6280)
- ✅ scrapegoat-web (Port 80)
- ✅ scrapegoat-crawl4ai (Port 8001) [if enabled]

## External Services

- PostgreSQL: postgres.den.lan:5432/scrapegoat
- Embeddings: embed.den.lan (nomic-ai/nomic-embed-text-v1.5)

## Key Files

- Configuration: /opt/scrapegoat-docker/docker-compose.yml
- Environment: /opt/scrapegoat-docker/.env
- Access Info: /opt/scrapegoat-docker/ACCESS.md
- Operations: /opt/scrapegoat-docker/OPERATIONS.md

## Next Steps

1. Access web interface at http://docs.den.lan
2. Create your first documentation library
3. Set up automated backups (cron job for backup.sh)
4. Monitor logs for first 24 hours

## Support

- Source: /home/mp/Workspace/scrapegoat
- Documentation: /home/mp/Workspace/scrapegoat/docs/
- Deployment Plan: /home/mp/Workspace/scrapegoat/projects/scrapegoat-docker-byo-deployment-planning/

SUMMARYEOF
```

### Phase 6 Completion Checklist

- [ ] Auto-restart configured on all services
- [ ] systemd service created (optional)
- [ ] Access documentation created
- [ ] Backup script created and tested
- [ ] Log rotation configured
- [ ] Operations guide created
- [ ] Deployment summary documented
- [ ] All endpoints verified one final time

**Status Check**: All items must be checked. Deployment is now complete!

---

## Deployment Complete! 🎉

### Success Criteria

All phases completed successfully:
- ✅ Pre-deployment verification passed
- ✅ Database initialized with pgvector
- ✅ Services deployed via Docker Compose
- ✅ All health checks passing
- ✅ Validation tests successful
- ✅ Post-deployment configuration complete

### Access Your Deployment

**Web Interface**: http://docs.den.lan

### Immediate Next Steps

1. **Test Document Indexing**
   - Access the web interface
   - Create a test library
   - Verify indexing works
   - Test search functionality

2. **Set Up Automated Backups**
   ```bash
   # Add to crontab for daily 3 AM backups
   crontab -e
   # Add: 0 3 * * * /opt/scrapegoat-docker/backup.sh
   ```

3. **Monitor for 24 Hours**
   - Watch logs for any errors
   - Check resource usage
   - Verify stability

### Support Resources

- **Operations Guide**: /opt/scrapegoat-docker/OPERATIONS.md
- **Access Info**: /opt/scrapegoat-docker/ACCESS.md
- **Logs**: `docker compose logs -f`

---

**Deployment Date**: 2025-11-10
**Deployment Plan Version**: 1.0
**Status**: ✅ READY FOR EXECUTION

*For troubleshooting, see: /home/mp/Workspace/scrapegoat/projects/scrapegoat-docker-byo-deployment-planning/risks/risk-assessment.md*
