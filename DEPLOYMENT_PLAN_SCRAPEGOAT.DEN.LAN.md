# Scrapegoat Deployment Plan - scrapegoat.den.lan

**Date**: 2025-12-09
**Target**: scrapegoat.den.lan (10.1.1.83)
**Mode**: BYO PostgreSQL (4 services)
**Status**: Ready for Implementation

---

## Server Specifications

| Component | Details |
|-----------|---------|
| Hostname | scrapegoat.den.lan |
| IP Address | 10.1.1.83/24 |
| OS | Debian 12.12 (LXC Container) |
| CPU | 4 vCPU |
| RAM | 16 GiB |
| Storage | 80 GB SSD |
| Docker | Installed ✓ |
| Docker Compose | V2 Installed ✓ |
| SSH Access | root / P@ssw0rd |

---

## External Services

### PostgreSQL Database
| Component | Details |
|-----------|---------|
| Hostname | postgres.den.lan |
| IP Address | 10.1.1.8 |
| Port | 5432 |
| Admin User | postgres |
| Admin Password | P@ssw0rd |
| SSH Access | root / P@ssw0rd |
| **Database** | scrapegoat (to be created) |
| **User** | scrapegoat (to be created) |
| **Password** | scrapegoat_P@ssw0rd (to be created) |

### Embeddings Service
| Component | Details |
|-----------|---------|
| Hostname | embed.den.lan |
| Endpoint | http://embed.den.lan/v1 |
| Model | Jina-Embedding-v3 |
| Dimensions | 1024 |
| Context Length | 8192 tokens |
| API Format | OpenAI-compatible |

### DNS Configuration
| Component | Details |
|-----------|---------|
| DNS Server | 10.1.1.53 |
| Domain | *.den.lan (resolved locally) |
| External | Forwarded |

---

## Architecture

**Deployment Mode**: BYO PostgreSQL (4 services)

```
┌─────────────────────────────────────────────────┐
│        scrapegoat.den.lan (10.1.1.83)           │
├─────────────────────────────────────────────────┤
│  Web UI (port 80)         ← http://scrapegoat.den.lan/
│  MCP Server (port 6280)   ← MCP clients         │
│  Worker API (port 8080)   ← Background jobs     │
│  Crawl4AI (port 8001)     ← Internal only       │
└──────────────┬──────────────────────────────────┘
               │
               ├─→ postgres.den.lan:5432 (Database)
               └─→ embed.den.lan/v1 (Embeddings)
```

**Services:**
1. **Web UI** - Port 80 (HTTP) - User interface
2. **MCP Server** - Port 6280 - Model Context Protocol
3. **Worker API** - Port 8080 - Document processing
4. **Crawl4AI** - Port 8001 - Web scraping (internal)

**External Dependencies:**
- PostgreSQL 17+ with pgvector (postgres.den.lan)
- Jina-Embedding-v3 (embed.den.lan)

---

## Deployment Steps

### Step 1: Create PostgreSQL Database and User

SSH to postgres.den.lan and create dedicated database:

```bash
ssh root@postgres.den.lan
# Password: P@ssw0rd

# Connect to PostgreSQL as admin
psql -U postgres

-- Create dedicated user for scrapegoat
CREATE USER scrapegoat WITH PASSWORD 'scrapegoat_P@ssw0rd';

-- Create database
CREATE DATABASE scrapegoat OWNER scrapegoat;

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE scrapegoat TO scrapegoat;

-- Connect to scrapegoat database
\c scrapegoat

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO scrapegoat;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO scrapegoat;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO scrapegoat;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO scrapegoat;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO scrapegoat;

-- Verify setup
\l scrapegoat
\dx vector
SELECT current_user;

-- Exit
\q
exit
```

**Verification:**
```bash
# Test connection from scrapegoat.den.lan
psql -h postgres.den.lan -U scrapegoat -d scrapegoat -c "SELECT version();"
psql -h postgres.den.lan -U scrapegoat -d scrapegoat -c "SELECT * FROM pg_extension WHERE extname='vector';"
```

---

### Step 2: Deploy to scrapegoat.den.lan

SSH to scrapegoat.den.lan and deploy:

```bash
ssh root@scrapegoat.den.lan
# Password: P@ssw0rd

# Navigate to deployment directory
cd /opt

# Clone repository
git clone http://git.den.lan/pub/scrapegoat
cd scrapegoat

# Check if migration 014 exists
ls -la db/migrations/014-change-vector-dimensions-jina-v3.sql

# If migration 014 does NOT exist, create it
cat > db/migrations/014-change-vector-dimensions-jina-v3.sql << 'EOF'
-- Migration 014: Change Vector Dimensions for Jina-Embedding-v3
-- Date: 2025-12-09
-- Purpose: Update vector dimensions from 1536 (OpenAI ada-002) to 1024 (Jina-Embedding-v3)

ALTER TABLE documents ALTER COLUMN embedding TYPE VECTOR(1024);

COMMENT ON COLUMN documents.embedding IS
  'Document embedding vector (1024 dimensions for Jina-Embedding-v3)';
EOF

# Create environment file
cat > .env << 'EOF'
# ============================================================================
# Scrapegoat Configuration - scrapegoat.den.lan
# ============================================================================

# ----------------------------------------------------------------------------
# DATABASE CONFIGURATION (External PostgreSQL)
# ----------------------------------------------------------------------------
DATABASE_URL=postgresql://scrapegoat:scrapegoat_P@ssw0rd@postgres.den.lan:5432/scrapegoat

# ----------------------------------------------------------------------------
# EMBEDDING API CONFIGURATION (External embed.den.lan)
# ----------------------------------------------------------------------------
OPENAI_API_BASE=http://embed.den.lan/v1
OPENAI_API_KEY=not-required
DOCS_MCP_EMBEDDING_MODEL=Jina-Embedding-v3

# ----------------------------------------------------------------------------
# CRAWL4AI CONFIGURATION (Always Enabled)
# ----------------------------------------------------------------------------
CRAWL4AI_ENABLED=true
CRAWL4AI_SERVICE_URL=http://localhost:8001

# ----------------------------------------------------------------------------
# SERVICE PORTS
# ----------------------------------------------------------------------------
MCP_PORT=6280
WEB_PORT=80
WORKER_PORT=8080

# ----------------------------------------------------------------------------
# OPTIONAL CONFIGURATIONS
# ----------------------------------------------------------------------------
POSTHOG_API_KEY=
DOCS_MCP_STORE_PATH=/data
NODE_ENV=production
EOF

# Build and start services
docker compose -f docker-compose.byo-postgres.yml build
docker compose -f docker-compose.byo-postgres.yml up -d

# Wait for services to initialize
sleep 30

# Check service status
docker compose -f docker-compose.byo-postgres.yml ps

# Check logs
docker compose -f docker-compose.byo-postgres.yml logs --tail=50
```

---

### Step 3: Create Systemd Service

Create systemd service for auto-start and management:

```bash
cat > /etc/systemd/system/scrapegoat.service << 'EOF'
[Unit]
Description=Scrapegoat Documentation Scraping Service
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/scrapegoat
ExecStart=/usr/bin/docker compose -f docker-compose.byo-postgres.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.byo-postgres.yml down
ExecReload=/usr/bin/docker compose -f docker-compose.byo-postgres.yml restart
Restart=on-failure
RestartSec=10s
TimeoutStartSec=300
TimeoutStopSec=120

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
systemctl daemon-reload

# Enable service (start on boot)
systemctl enable scrapegoat.service

# Start service
systemctl start scrapegoat.service

# Check status
systemctl status scrapegoat.service
```

---

### Step 4: Verification

**Check Services:**
```bash
# Service status
systemctl status scrapegoat.service

# Docker containers
docker compose -f /opt/scrapegoat/docker-compose.byo-postgres.yml ps

# Expected output:
# NAME                   STATUS          PORTS
# scrapegoat-worker      Up (healthy)    0.0.0.0:8080->8080/tcp
# scrapegoat-mcp         Up              0.0.0.0:6280->6280/tcp
# scrapegoat-web         Up              0.0.0.0:80->3000/tcp
# scrapegoat-crawl4ai    Up (healthy)    8001/tcp

# Service logs
docker compose -f /opt/scrapegoat/docker-compose.byo-postgres.yml logs --tail=100
```

**Test Endpoints:**
```bash
# Web UI (should return HTML)
curl -I http://scrapegoat.den.lan/

# MCP Server health
curl http://scrapegoat.den.lan:6280/health

# Worker API health
curl http://scrapegoat.den.lan:8080/api/health

# Crawl4AI health (internal)
curl http://localhost:8001/health
```

**Test from Workstation:**
```bash
# Open browser
firefox http://scrapegoat.den.lan/

# Or curl from workstation
curl http://scrapegoat.den.lan/
```

**Check Database:**
```bash
# Verify migrations ran
psql -h postgres.den.lan -U scrapegoat -d scrapegoat -c "SELECT * FROM migrations ORDER BY id;"

# Verify vector dimension (should show 1028 = 1024 + 4 byte header)
psql -h postgres.den.lan -U scrapegoat -d scrapegoat -c "SELECT atttypmod FROM pg_attribute WHERE attrelid = 'documents'::regclass AND attname = 'embedding';"

# Check tables
psql -h postgres.den.lan -U scrapegoat -d scrapegoat -c "\dt"
```

---

## Post-Deployment Configuration

### Service Management

```bash
# Start service
systemctl start scrapegoat

# Stop service
systemctl stop scrapegoat

# Restart service
systemctl restart scrapegoat

# Check status
systemctl status scrapegoat

# View logs
journalctl -u scrapegoat -f

# Docker compose logs
docker compose -f /opt/scrapegoat/docker-compose.byo-postgres.yml logs -f

# Specific service logs
docker compose -f /opt/scrapegoat/docker-compose.byo-postgres.yml logs -f worker
docker compose -f /opt/scrapegoat/docker-compose.byo-postgres.yml logs -f mcp
docker compose -f /opt/scrapegoat/docker-compose.byo-postgres.yml logs -f web
```

### Updates

```bash
cd /opt/scrapegoat

# Pull latest code
git pull

# Rebuild images
docker compose -f docker-compose.byo-postgres.yml build

# Restart services
systemctl restart scrapegoat

# Or via docker compose
docker compose -f docker-compose.byo-postgres.yml up -d --build
```

---

## Troubleshooting

### Services Not Starting

```bash
# Check Docker status
systemctl status docker

# Check container logs
docker compose -f /opt/scrapegoat/docker-compose.byo-postgres.yml logs

# Check specific service
docker compose -f /opt/scrapegoat/docker-compose.byo-postgres.yml logs worker

# Rebuild from scratch
docker compose -f /opt/scrapegoat/docker-compose.byo-postgres.yml down
docker compose -f /opt/scrapegoat/docker-compose.byo-postgres.yml build --no-cache
docker compose -f /opt/scrapegoat/docker-compose.byo-postgres.yml up -d
```

### Database Connection Issues

```bash
# Test connection from scrapegoat.den.lan
psql -h postgres.den.lan -U scrapegoat -d scrapegoat -c "SELECT version();"

# Check pgvector extension
psql -h postgres.den.lan -U scrapegoat -d scrapegoat -c "SELECT * FROM pg_extension WHERE extname='vector';"

# Check DATABASE_URL in .env
cat /opt/scrapegoat/.env | grep DATABASE_URL
```

### Embeddings Issues

```bash
# Test embed.den.lan from scrapegoat.den.lan
curl -X POST http://embed.den.lan/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model":"Jina-Embedding-v3","input":"test"}'

# Check worker logs for embedding errors
docker compose -f /opt/scrapegoat/docker-compose.byo-postgres.yml logs worker | grep -i embed
```

### Port Conflicts

```bash
# Check what's using port 80
ss -tlnp | grep :80

# Check all Scrapegoat ports
ss -tlnp | grep -E ':(80|6280|8080|8001)'
```

---

## Security Notes

**Production Recommendations:**

1. **Change Default Passwords:**
   ```bash
   # Update .env with stronger password
   nano /opt/scrapegoat/.env
   # Change DATABASE_URL password
   ```

2. **Firewall Configuration:**
   ```bash
   # Only allow access from trusted IPs
   # Example with ufw (if installed):
   ufw allow from 10.1.1.0/24 to any port 80
   ufw allow from 10.1.1.0/24 to any port 6280
   ufw allow from 10.1.1.0/24 to any port 8080
   ```

3. **HTTPS (if needed later):**
   - Add Nginx reverse proxy
   - Configure SSL certificate
   - Update WEB_PORT back to 3000, proxy from 80→3000

---

## Quick Reference

**Service URLs:**
- Web UI: http://scrapegoat.den.lan/
- MCP Server: http://scrapegoat.den.lan:6280
- Worker API: http://scrapegoat.den.lan:8080
- Crawl4AI: http://localhost:8001 (internal)

**Key Files:**
- Docker Compose: `/opt/scrapegoat/docker-compose.byo-postgres.yml`
- Environment: `/opt/scrapegoat/.env`
- Systemd Service: `/etc/systemd/system/scrapegoat.service`
- Migrations: `/opt/scrapegoat/db/migrations/`

**Database:**
- Host: postgres.den.lan:5432
- Database: scrapegoat
- User: scrapegoat
- Password: scrapegoat_P@ssw0rd

**Embeddings:**
- URL: http://embed.den.lan/v1
- Model: Jina-Embedding-v3
- Dimensions: 1024

---

## Success Criteria

✅ All 4 services running and healthy
✅ Web UI accessible at http://scrapegoat.den.lan/
✅ MCP server responding on port 6280
✅ Worker API responding on port 8080
✅ Database connection successful
✅ Migration 014 applied (VECTOR(1024))
✅ Embeddings service reachable
✅ Systemd service enabled and running
✅ Auto-restart on crash working
✅ Can index and search documentation

---

**Status**: Ready for deployment
**Estimated Time**: 15-20 minutes
**Complexity**: Low (all services external, straightforward setup)
