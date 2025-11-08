# Scrapegoat Installation Plan for docs.den.lan

**Document Version:** 1.0
**Date:** 2025-11-09
**Target Server:** docs.den.lan (Proxmox LXC Container)
**Branch:** addCrawl4AI
**Commit:** 0ea0917

## Executive Summary

This document provides a complete installation plan for deploying Scrapegoat (PostgreSQL-powered documentation MCP server) on docs.den.lan. The deployment uses a **hybrid architecture** where main Node.js services run as systemd units for efficiency, while Crawl4AI runs in Docker due to Playwright/Chromium requirements.

### Quick Facts

- **Server:** docs.den.lan (Debian-based Proxmox LXC)
- **Services:** 4 services (Worker, MCP, Web, Crawl4AI)
- **Database:** External PostgreSQL on postgres.den.lan
- **Deployment Model:** Hybrid (systemd + Docker)
- **Installation Time:** ~30-45 minutes

## 1. Architecture Decision

### Deployment Model: Hybrid (systemd + Docker)

After analyzing the constraints and requirements, we've chosen a hybrid deployment approach:

| Service | Deployment Method | Port | Rationale |
|---------|------------------|------|-----------|
| Worker | systemd (native Node.js) | 8080 | Core processing service, better performance native |
| MCP | systemd (native Node.js) | 6280 | API endpoint, easier debugging with systemd |
| Web | systemd (native Node.js) | 6281 | Web UI, standard service management |
| Crawl4AI | Docker container | 8001 | **MUST** be Docker (Playwright/Chromium requirement) |

### Rationale

**Why NOT Full Docker Deployment?**

1. **LXC Kernel Restrictions:** Proxmox LXC has kernel security restrictions (sysctl permissions)
2. **Resource Efficiency:** Native Node.js services use less memory and CPU in containerized environments
3. **Easier Debugging:** Direct systemd logs and process management
4. **Network Simplicity:** Avoids Docker networking complexity for main services
5. **Proven Working:** Crawl4AI already working in Docker with host networking

**Why Docker for Crawl4AI?**

1. **Playwright Requirement:** Needs Chromium browser with specific dependencies
2. **Isolation:** Browser automation benefits from containerization
3. **Already Working:** Proven configuration from Phase 1 deployment
4. **Host Networking:** Bypasses Proxmox sysctl restrictions

**Why NOT Native for Everything?**

1. **Playwright Installation:** Complex dependencies for Chromium
2. **System Contamination:** Browser binaries and libraries pollute system
3. **Update Complexity:** Playwright version management is easier in Docker

### Service Dependencies

```
PostgreSQL (external) ← Worker ← MCP
                          ↑      ↑
                          |      └─ Web
                          |
                      Crawl4AI (optional)
```

**Startup Order:**
1. Crawl4AI (Docker) - independent
2. Worker (systemd) - depends on PostgreSQL
3. MCP (systemd) - depends on Worker
4. Web (systemd) - depends on Worker

## 2. Prerequisites

### Required Software

```bash
# Node.js 22.x
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# Docker and Docker Compose
apt-get install -y docker.io docker-compose-plugin

# PostgreSQL client (for testing)
apt-get install -y postgresql-client

# Git
apt-get install -y git

# Build tools (for native modules)
apt-get install -y python3 make g++
```

### System Requirements

- **CPU:** 4 cores minimum (Worker processes documents)
- **Memory:** 4GB minimum (2GB for Worker, 2GB for Crawl4AI)
- **Disk:** 20GB minimum (for code, data, Docker images)
- **Network:** Access to postgres.den.lan:5432

### Database Prerequisites

On postgres.den.lan, create database and user:

```sql
-- Connect as postgres superuser
CREATE DATABASE scrapegoat;
CREATE USER scrapegoat WITH ENCRYPTED PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE scrapegoat TO scrapegoat;

-- Connect to scrapegoat database
\c scrapegoat

-- Enable pgvector extension (required)
CREATE EXTENSION IF NOT EXISTS vector;

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO scrapegoat;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO scrapegoat;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO scrapegoat;
```

### External Services

- **PostgreSQL:** postgres.den.lan:5432 (with pgvector extension)
- **GitLab:** gitlab.den.lan (for repository access)
- **OpenAI API:** (optional, for vector embeddings)

## 3. Installation Steps

### Step 1: Create Dedicated User

```bash
# Create scrapegoat user for security isolation
useradd -r -m -s /bin/bash -d /opt/scrapegoat scrapegoat

# Add to docker group for Crawl4AI management
usermod -aG docker scrapegoat
```

### Step 2: Directory Structure

```bash
# Create directory structure
mkdir -p /opt/scrapegoat/{repo,data,logs}
chown -R scrapegoat:scrapegoat /opt/scrapegoat

# Switch to scrapegoat user
su - scrapegoat
cd /opt/scrapegoat
```

Directory layout:
```
/opt/scrapegoat/
├── repo/           # Git repository (source code)
├── data/           # Application data (screenshots, temp files)
├── logs/           # Application logs
└── .env            # Environment configuration
```

### Step 3: Clone Repository

```bash
# As scrapegoat user
cd /opt/scrapegoat

# Clone from GitLab
git clone http://gitlab.den.lan/pub/scrapegoat.git repo
cd repo

# Checkout the addCrawl4AI branch
git checkout addCrawl4AI

# Verify commit
git log --oneline -1
# Should show: 0ea0917 feat(crawl4ai): phase 3B - complete storage pipeline
```

### Step 4: Install Dependencies

```bash
cd /opt/scrapegoat/repo

# Install Node.js dependencies (production only)
npm ci --omit=dev

# Verify installation
node --version  # Should be v22.x.x
npm --version
```

**Note:** We use `npm ci` (clean install) for reproducible builds based on package-lock.json.

### Step 5: Build Application

```bash
cd /opt/scrapegoat/repo

# Build TypeScript code and web UI
npm run build

# Verify build output
ls -la dist/
# Should see: index.js and other compiled files

ls -la public/
# Should see: web UI assets
```

**Build Process:**
1. Compiles TypeScript to JavaScript (dist/)
2. Bundles web UI assets (public/)
3. Optimizes for production

### Step 6: Configure Environment

```bash
# Create environment file
cat > /opt/scrapegoat/.env << 'EOF'
# Database Configuration (PostgreSQL)
DATABASE_URL=postgresql://scrapegoat:your-secure-password@postgres.den.lan:5432/scrapegoat

# Data Storage
DOCS_MCP_STORE_PATH=/opt/scrapegoat/data

# Crawl4AI Integration
CRAWL4AI_ENABLED=true
CRAWL4AI_SERVICE_URL=http://localhost:8001

# Embedding Provider (Optional - for vector search)
# Uncomment and configure if using embeddings
# OPENAI_API_KEY=sk-proj-your-key-here
# DOCS_MCP_EMBEDDING_MODEL=text-embedding-3-small

# Telemetry (Optional - disable if desired)
DOCS_MCP_TELEMETRY=false

# Node Environment
NODE_ENV=production
EOF

# Secure the environment file
chmod 600 /opt/scrapegoat/.env
chown scrapegoat:scrapegoat /opt/scrapegoat/.env
```

**Important:** Replace `your-secure-password` with the actual PostgreSQL password.

### Step 7: Database Setup and Migrations

```bash
# Test database connection
PGPASSWORD='your-secure-password' psql \
  -h postgres.den.lan \
  -U scrapegoat \
  -d scrapegoat \
  -c "SELECT version();"

# If connection successful, run migrations manually
cd /opt/scrapegoat/repo/db/migrations

# Run each migration in order
for migration in *.sql; do
  echo "Running migration: $migration"
  PGPASSWORD='your-secure-password' psql \
    -h postgres.den.lan \
    -U scrapegoat \
    -d scrapegoat \
    -f "$migration"
done

# Verify schema
PGPASSWORD='your-secure-password' psql \
  -h postgres.den.lan \
  -U scrapegoat \
  -d scrapegoat \
  -c "\dt"
# Should show: libraries, versions, pages, documents

# Verify pgvector extension
PGPASSWORD='your-secure-password' psql \
  -h postgres.den.lan \
  -U scrapegoat \
  -d scrapegoat \
  -c "\dx"
# Should show: vector extension
```

**Migrations Applied:**
- 001-initial-schema.sql - Base tables
- 002-gin-indexes.sql - Full-text search indexes
- 003-hnsw-indexes.sql - Vector similarity indexes
- 010-add-indexed-at-column.sql - Timestamp tracking
- 011-enhanced-crawl4ai.sql - Crawl4AI features (screenshot_path, fetcher_type)

### Step 8: Build Crawl4AI Docker Image

```bash
# As scrapegoat user (must be in docker group)
cd /opt/scrapegoat/repo/services/crawl4ai

# Build the image
docker build -t scrapegoat-crawl4ai:latest .

# Verify image
docker images | grep scrapegoat-crawl4ai
# Should show: scrapegoat-crawl4ai latest
```

**Build Details:**
- Base: python:3.11-slim
- Installs: crawl4ai, fastapi, uvicorn, playwright
- Includes: Chromium browser with dependencies
- Size: ~1.5GB (due to Chromium)

### Step 9: Create Docker Compose for Crawl4AI

```bash
# Create minimal docker-compose.yml for Crawl4AI only
cat > /opt/scrapegoat/docker-compose.yml << 'EOF'
version: '3.8'

services:
  crawl4ai:
    image: scrapegoat-crawl4ai:latest
    container_name: scrapegoat-crawl4ai
    restart: unless-stopped
    network_mode: host
    environment:
      - HOST=0.0.0.0
      - PORT=8001
      - VERBOSE=false
      - HEADLESS=true
      - MAX_CONCURRENT_CRAWLS=5
      - REQUEST_TIMEOUT=30
    # Playwright/Chromium requires increased shared memory and privileged mode in Proxmox
    shm_size: 2gb
    privileged: true
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G
EOF

chown scrapegoat:scrapegoat /opt/scrapegoat/docker-compose.yml
```

**Configuration Notes:**
- `network_mode: host` - Required for Proxmox LXC (bypasses sysctl restrictions)
- `privileged: true` - Required for Playwright/Chromium in LXC
- `shm_size: 2gb` - Chromium needs shared memory for rendering

### Step 10: Create Systemd Service Units

#### Worker Service

```bash
# As root
cat > /etc/systemd/system/scrapegoat-worker.service << 'EOF'
[Unit]
Description=Scrapegoat Worker Service
Documentation=https://github.com/arabold/docs-mcp-server
After=network.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=scrapegoat
Group=scrapegoat
WorkingDirectory=/opt/scrapegoat/repo
EnvironmentFile=/opt/scrapegoat/.env

ExecStart=/usr/bin/node dist/index.js worker --host 0.0.0.0 --port 8080

# Restart policy
Restart=always
RestartSec=10s

# Resource limits
MemoryLimit=2G
CPUQuota=200%

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=scrapegoat-worker

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/scrapegoat/data /opt/scrapegoat/logs

[Install]
WantedBy=multi-user.target
EOF
```

#### MCP Service

```bash
# As root
cat > /etc/systemd/system/scrapegoat-mcp.service << 'EOF'
[Unit]
Description=Scrapegoat MCP Service
Documentation=https://github.com/arabold/docs-mcp-server
After=network.target scrapegoat-worker.service
Requires=scrapegoat-worker.service

[Service]
Type=simple
User=scrapegoat
Group=scrapegoat
WorkingDirectory=/opt/scrapegoat/repo
EnvironmentFile=/opt/scrapegoat/.env

ExecStart=/usr/bin/node dist/index.js mcp \
  --protocol http \
  --host 0.0.0.0 \
  --port 6280 \
  --server-url http://localhost:8080/api

# Restart policy
Restart=always
RestartSec=10s

# Resource limits
MemoryLimit=512M
CPUQuota=100%

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=scrapegoat-mcp

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/scrapegoat/data

[Install]
WantedBy=multi-user.target
EOF
```

#### Web Service

```bash
# As root
cat > /etc/systemd/system/scrapegoat-web.service << 'EOF'
[Unit]
Description=Scrapegoat Web Interface
Documentation=https://github.com/arabold/docs-mcp-server
After=network.target scrapegoat-worker.service
Requires=scrapegoat-worker.service

[Service]
Type=simple
User=scrapegoat
Group=scrapegoat
WorkingDirectory=/opt/scrapegoat/repo
EnvironmentFile=/opt/scrapegoat/.env

ExecStart=/usr/bin/node dist/index.js web \
  --host 0.0.0.0 \
  --port 6281 \
  --server-url http://localhost:8080/api

# Restart policy
Restart=always
RestartSec=10s

# Resource limits
MemoryLimit=512M
CPUQuota=100%

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=scrapegoat-web

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/scrapegoat/data

[Install]
WantedBy=multi-user.target
EOF
```

#### Reload Systemd

```bash
# Reload systemd to recognize new services
systemctl daemon-reload

# Enable services to start on boot
systemctl enable scrapegoat-worker
systemctl enable scrapegoat-mcp
systemctl enable scrapegoat-web
```

### Step 11: Start Services

```bash
# Start Crawl4AI first (Docker)
cd /opt/scrapegoat
docker compose up -d crawl4ai

# Wait for Crawl4AI to be healthy
sleep 30
docker ps | grep crawl4ai
# Should show: Up X seconds (healthy)

# Start Worker (systemd)
systemctl start scrapegoat-worker

# Wait for Worker to initialize
sleep 10

# Start MCP and Web (systemd)
systemctl start scrapegoat-mcp
systemctl start scrapegoat-web

# Check all service statuses
systemctl status scrapegoat-worker
systemctl status scrapegoat-mcp
systemctl status scrapegoat-web
docker ps | grep crawl4ai
```

### Step 12: Verify Installation

#### Service Health Checks

```bash
# Test Crawl4AI
curl -s http://localhost:8001/health | jq
# Expected: {"status":"ok","version":"1.0.0"}

# Test Worker API
curl -s http://localhost:8080/api/health | jq
# Expected: {"status":"ok"}

# Test MCP endpoint
curl -s http://localhost:6280/health | jq
# Expected: {"status":"ok"}

# Test Web UI
curl -s http://localhost:6281/health | jq
# Expected: {"status":"ok"}

# Or open in browser: http://docs.den.lan:6281
```

#### Test Database Connection

```bash
# As scrapegoat user
cd /opt/scrapegoat/repo

# Test listing libraries (should be empty initially)
node dist/index.js list
# Expected: "No libraries indexed yet"
```

#### Test Crawl4AI Integration

```bash
# Test a simple crawl
curl -X POST http://localhost:8001/crawl \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}' | jq
# Expected: Success with markdown content
```

#### View Service Logs

```bash
# Systemd services
journalctl -u scrapegoat-worker -f
journalctl -u scrapegoat-mcp -f
journalctl -u scrapegoat-web -f

# Docker service
docker logs -f scrapegoat-crawl4ai
```

## 4. Service Management

### Starting Services

```bash
# Start all services
systemctl start scrapegoat-worker scrapegoat-mcp scrapegoat-web
cd /opt/scrapegoat && docker compose up -d crawl4ai
```

### Stopping Services

```bash
# Stop all services
systemctl stop scrapegoat-worker scrapegoat-mcp scrapegoat-web
cd /opt/scrapegoat && docker compose stop crawl4ai
```

### Restarting Services

```bash
# Restart individual service
systemctl restart scrapegoat-worker

# Restart all
systemctl restart scrapegoat-worker scrapegoat-mcp scrapegoat-web
cd /opt/scrapegoat && docker compose restart crawl4ai
```

### Viewing Status

```bash
# Check systemd services
systemctl status scrapegoat-*

# Check Docker service
docker ps | grep scrapegoat
```

### Viewing Logs

```bash
# Real-time logs (systemd)
journalctl -u scrapegoat-worker -f
journalctl -u scrapegoat-mcp -f
journalctl -u scrapegoat-web -f

# Real-time logs (Docker)
docker logs -f scrapegoat-crawl4ai

# Last 100 lines
journalctl -u scrapegoat-worker -n 100
docker logs --tail 100 scrapegoat-crawl4ai
```

## 5. Updating the Application

### Update from Git

```bash
# As scrapegoat user
cd /opt/scrapegoat/repo

# Stop services
sudo systemctl stop scrapegoat-worker scrapegoat-mcp scrapegoat-web

# Pull latest changes
git fetch origin
git checkout addCrawl4AI
git pull origin addCrawl4AI

# Install dependencies (if package.json changed)
npm ci --omit=dev

# Rebuild application
npm run build

# Check for new migrations
ls -la db/migrations/

# Run new migrations if any (manually)
cd db/migrations
# ... run new migrations ...

# Restart services
sudo systemctl start scrapegoat-worker scrapegoat-mcp scrapegoat-web
```

### Rebuild Crawl4AI

```bash
# As scrapegoat user
cd /opt/scrapegoat/repo/services/crawl4ai

# Rebuild image
docker build -t scrapegoat-crawl4ai:latest .

# Recreate container
cd /opt/scrapegoat
docker compose up -d --force-recreate crawl4ai
```

## 6. Troubleshooting

### Worker Service Won't Start

**Symptoms:** `systemctl status scrapegoat-worker` shows failed status

**Check:**
1. Database connection:
   ```bash
   PGPASSWORD='password' psql -h postgres.den.lan -U scrapegoat -d scrapegoat -c "SELECT 1;"
   ```
2. Environment file:
   ```bash
   cat /opt/scrapegoat/.env
   # Verify DATABASE_URL is correct
   ```
3. Logs:
   ```bash
   journalctl -u scrapegoat-worker -n 50
   ```

**Common Causes:**
- Wrong database password in .env
- PostgreSQL not accessible from docs.den.lan
- Missing migrations

### Crawl4AI Container Won't Start

**Symptoms:** `docker ps` shows container exiting or unhealthy

**Check:**
1. Docker logs:
   ```bash
   docker logs scrapegoat-crawl4ai
   ```
2. Container status:
   ```bash
   docker inspect scrapegoat-crawl4ai | jq '.[0].State'
   ```

**Common Causes:**
- Port 8001 already in use
- Insufficient shared memory (need shm_size: 2gb)
- Missing privileged: true in docker-compose.yml

### MCP/Web Services Can't Connect to Worker

**Symptoms:** MCP or Web service fails with connection errors

**Check:**
1. Worker is running:
   ```bash
   systemctl status scrapegoat-worker
   curl http://localhost:8080/api/health
   ```
2. Service logs:
   ```bash
   journalctl -u scrapegoat-mcp -n 50
   journalctl -u scrapegoat-web -n 50
   ```

**Common Causes:**
- Worker not started yet (dependency issue)
- Port 8080 blocked or in use
- Wrong --server-url in service definition

### Database Migration Errors

**Symptoms:** Migrations fail or tables missing

**Check:**
1. pgvector extension:
   ```bash
   PGPASSWORD='password' psql -h postgres.den.lan -U scrapegoat -d scrapegoat -c "\dx"
   ```
2. User permissions:
   ```sql
   -- As postgres superuser
   GRANT ALL ON SCHEMA public TO scrapegoat;
   GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO scrapegoat;
   GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO scrapegoat;
   ```

**Common Causes:**
- pgvector extension not installed
- Insufficient database permissions
- Migrations run out of order

### High Memory Usage

**Symptoms:** Services using more memory than expected

**Check:**
1. Resource usage:
   ```bash
   systemctl status scrapegoat-worker  # Shows memory usage
   docker stats scrapegoat-crawl4ai
   ```

**Solutions:**
- Adjust MemoryLimit in systemd unit files
- Reduce MAX_CONCURRENT_CRAWLS for Crawl4AI
- Check for memory leaks in logs

### Network Issues in Proxmox LXC

**Symptoms:** Services can't communicate, sysctl errors

**Solution:** Ensure using `network_mode: host` for Docker containers:
```yaml
# In docker-compose.yml
services:
  crawl4ai:
    network_mode: host  # Required for Proxmox LXC
    privileged: true    # Required for Chromium
```

## 7. Security Considerations

### File Permissions

```bash
# Verify correct ownership
ls -la /opt/scrapegoat
# All files should be owned by scrapegoat:scrapegoat

# Secure environment file
chmod 600 /opt/scrapegoat/.env
```

### Network Security

- Services bind to 0.0.0.0 (all interfaces)
- Consider firewall rules if exposed to untrusted networks:
  ```bash
  # Example: Allow only local network
  ufw allow from 192.168.1.0/24 to any port 6280
  ufw allow from 192.168.1.0/24 to any port 6281
  ```

### Database Security

- Use strong password for PostgreSQL user
- Enable SSL for database connections (optional):
  ```bash
  # In .env
  DATABASE_URL=postgresql://scrapegoat:password@postgres.den.lan:5432/scrapegoat?sslmode=require
  ```

### Docker Security

- Crawl4AI runs as `privileged: true` (required for Playwright)
- Consider using seccomp profiles for additional hardening
- Regularly update base images for security patches

## 8. Monitoring and Maintenance

### Health Monitoring

Create a simple monitoring script:

```bash
cat > /opt/scrapegoat/healthcheck.sh << 'EOF'
#!/bin/bash
# Health check script for Scrapegoat services

echo "=== Scrapegoat Health Check ==="
echo

echo "1. Crawl4AI (Docker):"
curl -sf http://localhost:8001/health > /dev/null && echo "   OK" || echo "   FAILED"

echo "2. Worker (systemd):"
systemctl is-active --quiet scrapegoat-worker && echo "   OK" || echo "   FAILED"

echo "3. MCP (systemd):"
systemctl is-active --quiet scrapegoat-mcp && echo "   OK" || echo "   FAILED"

echo "4. Web (systemd):"
systemctl is-active --quiet scrapegoat-web && echo "   OK" || echo "   FAILED"

echo "5. Database connection:"
PGPASSWORD='password' psql -h postgres.den.lan -U scrapegoat -d scrapegoat -c "SELECT 1;" > /dev/null 2>&1 && echo "   OK" || echo "   FAILED"

echo
echo "=== Resource Usage ==="
echo "Worker memory: $(systemctl show scrapegoat-worker -p MemoryCurrent --value | numfmt --to=iec-i --suffix=B)"
echo "MCP memory: $(systemctl show scrapegoat-mcp -p MemoryCurrent --value | numfmt --to=iec-i --suffix=B)"
echo "Web memory: $(systemctl show scrapegoat-web -p MemoryCurrent --value | numfmt --to=iec-i --suffix=B)"
echo "Crawl4AI: $(docker stats scrapegoat-crawl4ai --no-stream --format "{{.MemUsage}}")"
EOF

chmod +x /opt/scrapegoat/healthcheck.sh
```

Run periodically:
```bash
/opt/scrapegoat/healthcheck.sh
```

### Log Rotation

Systemd journals rotate automatically. For application logs:

```bash
cat > /etc/logrotate.d/scrapegoat << 'EOF'
/opt/scrapegoat/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0640 scrapegoat scrapegoat
    sharedscripts
    postrotate
        systemctl reload scrapegoat-worker scrapegoat-mcp scrapegoat-web
    endscript
}
EOF
```

### Backup Strategy

```bash
# Backup script
cat > /opt/scrapegoat/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/scrapegoat/backups"
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p "$BACKUP_DIR"

# Backup environment config
cp /opt/scrapegoat/.env "$BACKUP_DIR/.env.$DATE"

# Backup database
PGPASSWORD='password' pg_dump \
  -h postgres.den.lan \
  -U scrapegoat \
  -d scrapegoat \
  -F c \
  -f "$BACKUP_DIR/scrapegoat-db-$DATE.dump"

# Backup data directory
tar -czf "$BACKUP_DIR/data-$DATE.tar.gz" /opt/scrapegoat/data

# Keep only last 7 days
find "$BACKUP_DIR" -type f -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

chmod +x /opt/scrapegoat/backup.sh
```

Schedule with cron:
```bash
# Daily backup at 2 AM
0 2 * * * /opt/scrapegoat/backup.sh >> /opt/scrapegoat/logs/backup.log 2>&1
```

## 9. Performance Tuning

### Worker Concurrency

Adjust worker concurrency in systemd unit:

```ini
[Service]
Environment="UV_THREADPOOL_SIZE=4"
Environment="NODE_OPTIONS=--max-old-space-size=1536"
```

### PostgreSQL Connection Pooling

If using many connections, consider pgbouncer:

```bash
# Install pgbouncer on postgres.den.lan
apt-get install pgbouncer

# Configure connection pooling
# Then update DATABASE_URL to use pgbouncer port
```

### Crawl4AI Performance

Adjust concurrency in docker-compose.yml:

```yaml
environment:
  - MAX_CONCURRENT_CRAWLS=10  # Increase for more throughput
```

## 10. Rollback Procedures

### Rollback to Previous Version

```bash
# Stop services
systemctl stop scrapegoat-worker scrapegoat-mcp scrapegoat-web

# Revert to previous commit
cd /opt/scrapegoat/repo
git log --oneline -5  # Find commit to revert to
git checkout <previous-commit>

# Rebuild
npm ci --omit=dev
npm run build

# Rollback database migrations (if needed)
# Run down migration scripts from db/migrations/

# Restart services
systemctl start scrapegoat-worker scrapegoat-mcp scrapegoat-web
```

### Complete Reinstall

```bash
# Stop and disable all services
systemctl stop scrapegoat-worker scrapegoat-mcp scrapegoat-web
systemctl disable scrapegoat-worker scrapegoat-mcp scrapegoat-web
cd /opt/scrapegoat && docker compose down

# Remove systemd units
rm /etc/systemd/system/scrapegoat-*.service
systemctl daemon-reload

# Remove installation
rm -rf /opt/scrapegoat

# Remove user
userdel scrapegoat

# Drop database
PGPASSWORD='password' psql -h postgres.den.lan -U postgres -c "DROP DATABASE scrapegoat;"

# Then follow installation steps from beginning
```

## 11. Post-Installation Configuration

### Configure Embedding Provider

Edit `/opt/scrapegoat/.env`:

```bash
# For OpenAI embeddings
OPENAI_API_KEY=sk-proj-your-key-here
DOCS_MCP_EMBEDDING_MODEL=text-embedding-3-small

# For local embeddings (Ollama)
OPENAI_API_KEY=ollama
OPENAI_API_BASE=http://localhost:11434/v1
DOCS_MCP_EMBEDDING_MODEL=nomic-embed-text
```

Restart worker:
```bash
systemctl restart scrapegoat-worker
```

### Enable Authentication (Optional)

For OAuth2/OIDC authentication, see [docs/authentication.md](docs/authentication.md)

### Configure MCP Client

Add to your MCP client configuration (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "scrapegoat": {
      "type": "sse",
      "url": "http://docs.den.lan:6280/sse"
    }
  }
}
```

## 12. Quick Reference

### Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Worker API | http://docs.den.lan:8080/api | Internal API |
| MCP Endpoint (SSE) | http://docs.den.lan:6280/sse | MCP client connection |
| MCP Endpoint (HTTP) | http://docs.den.lan:6280/mcp | Alternative MCP transport |
| Web Interface | http://docs.den.lan:6281 | Browser UI |
| Crawl4AI | http://localhost:8001 | Internal crawling service |

### Common Commands

```bash
# Check all services
systemctl status scrapegoat-*
docker ps | grep scrapegoat

# Restart all services
systemctl restart scrapegoat-worker scrapegoat-mcp scrapegoat-web
docker compose -f /opt/scrapegoat/docker-compose.yml restart crawl4ai

# View logs
journalctl -u scrapegoat-worker -f
docker logs -f scrapegoat-crawl4ai

# Test health
curl http://localhost:8001/health
curl http://localhost:8080/api/health
curl http://localhost:6280/health
curl http://localhost:6281/health

# List indexed libraries
cd /opt/scrapegoat/repo && node dist/index.js list

# Update application
cd /opt/scrapegoat/repo && git pull && npm ci --omit=dev && npm run build
systemctl restart scrapegoat-worker scrapegoat-mcp scrapegoat-web
```

### Port Summary

| Port | Service | Protocol | Binding |
|------|---------|----------|---------|
| 8080 | Worker | HTTP | 0.0.0.0 |
| 6280 | MCP | HTTP/SSE | 0.0.0.0 |
| 6281 | Web | HTTP | 0.0.0.0 |
| 8001 | Crawl4AI | HTTP | localhost (host network) |
| 5432 | PostgreSQL | TCP | postgres.den.lan (external) |

## 13. Success Criteria

Installation is successful when:

- [ ] All 4 services are running and healthy
- [ ] Database connection established and migrations applied
- [ ] Web UI accessible at http://docs.den.lan:6281
- [ ] MCP endpoint responding at http://docs.den.lan:6280/sse
- [ ] Health checks pass for all services
- [ ] Test crawl completes successfully
- [ ] Services restart automatically after reboot
- [ ] Logs are accessible via systemd/docker

## 14. Support and Documentation

### Internal Documentation

- Project README: `/opt/scrapegoat/repo/README.md`
- Architecture: `/opt/scrapegoat/repo/ARCHITECTURE.md`
- Phase Documentation: `/opt/scrapegoat/repo/PHASE_*.md`
- Resume: `/opt/scrapegoat/repo/RESUME.txt`

### External Resources

- MCP Protocol: https://modelcontextprotocol.io
- Crawl4AI: https://github.com/unclecode/crawl4ai
- PostgreSQL pgvector: https://github.com/pgvector/pgvector

### Troubleshooting Resources

- Service logs: `journalctl -u scrapegoat-<service>`
- Docker logs: `docker logs scrapegoat-crawl4ai`
- Database logs: On postgres.den.lan
- Health checks: Run `/opt/scrapegoat/healthcheck.sh`

---

## Appendix A: Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `DOCS_MCP_STORE_PATH` | Yes | `/opt/scrapegoat/data` | Data storage directory |
| `CRAWL4AI_ENABLED` | No | `false` | Enable Crawl4AI fetcher |
| `CRAWL4AI_SERVICE_URL` | No | `http://localhost:8001` | Crawl4AI service endpoint |
| `OPENAI_API_KEY` | No | - | OpenAI API key for embeddings |
| `DOCS_MCP_EMBEDDING_MODEL` | No | `text-embedding-3-small` | Embedding model to use |
| `NODE_ENV` | No | `development` | Node.js environment |
| `DOCS_MCP_TELEMETRY` | No | `true` | Enable telemetry |

## Appendix B: Database Schema

See migration files in `/opt/scrapegoat/repo/db/migrations/`:

- `001-initial-schema.sql` - Base tables (libraries, versions, pages, documents)
- `002-gin-indexes.sql` - Full-text search indexes
- `003-hnsw-indexes.sql` - Vector similarity indexes (pgvector)
- `010-add-indexed-at-column.sql` - Timestamp tracking
- `011-enhanced-crawl4ai.sql` - Crawl4AI enhancements (screenshot_path, fetcher_type)

## Appendix C: Service Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        docs.den.lan                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Systemd Services                        │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐    │   │
│  │  │   Worker   │  │    MCP     │  │    Web     │    │   │
│  │  │  (8080)    │◄─┤   (6280)   │  │  (6281)    │    │   │
│  │  └─────┬──────┘  └────────────┘  └─────┬──────┘    │   │
│  └────────┼────────────────────────────────┼───────────┘   │
│           │                                 │               │
│  ┌────────┼─────────────────────────────────┼───────────┐  │
│  │        │     Docker Container            │           │  │
│  │  ┌─────▼─────────────────────────────────▼────────┐  │  │
│  │  │             Crawl4AI (8001)                     │  │  │
│  │  │  network_mode: host, privileged: true          │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ DATABASE_URL
                        ▼
┌────────────────────────────────────────┐
│          postgres.den.lan              │
│  ┌────────────────────────────────┐   │
│  │  PostgreSQL + pgvector          │   │
│  │  Database: scrapegoat           │   │
│  └────────────────────────────────┘   │
└────────────────────────────────────────┘
```

---

**Document End**

**Version History:**
- 1.0 (2025-11-09): Initial comprehensive installation plan
