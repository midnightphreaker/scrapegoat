# Deployment Guide

Complete guide for deploying Scrapegoat in development, staging, and production environments.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Local Development Deployment](#local-development-deployment)
4. [Docker Deployment](#docker-deployment)
5. [Cloud Deployment](#cloud-deployment)
6. [Production Configuration](#production-configuration)
7. [Service Modes](#service-modes)
8. [Monitoring and Maintenance](#monitoring-and-maintenance)
9. [Backup and Recovery](#backup-and-recovery)
10. [Health Checks](#health-checks)
11. [Troubleshooting](#troubleshooting)
12. [Rollback Procedures](#rollback-procedures)

---

## Overview

Scrapegoat can be deployed in multiple configurations depending on your needs:

- **Local Development**: Single-process server for development and testing
- **Docker**: Containerized deployment with Docker Compose
- **Cloud**: Managed PostgreSQL services (AWS RDS, Azure Database, GCP Cloud SQL)
- **Kubernetes**: Scalable container orchestration (advanced)

### Architecture Components

```
┌─────────────────┐
│   Web Interface │  (Port 6280 or 6281)
└────────┬────────┘
         │
┌────────▼────────┐
│   MCP Server    │  (HTTP/SSE endpoints)
└────────┬────────┘
         │
┌────────▼────────┐
│  Worker Process │  (Documentation scraping & indexing)
└────────┬────────┘
         │
┌────────▼────────┐
│   PostgreSQL    │  (Database with pgvector)
└─────────────────┘
```

---

## Prerequisites

### Required Software

1. **PostgreSQL 14+** with pgvector extension
   - See [POSTGRESQL_SETUP.md](./POSTGRESQL_SETUP.md) for installation
   - Minimum version: 14.0
   - Recommended version: 16.x

2. **Node.js 20+**
   - Minimum version: 20.0.0
   - Recommended version: 22.x LTS

3. **System Requirements**
   - RAM: 2GB minimum, 4GB+ recommended for production
   - Storage: 10GB minimum, 50GB+ recommended for large documentation sets
   - CPU: 2 cores minimum, 4+ cores recommended

### Optional Dependencies

- **Docker** (for containerized deployment)
- **Docker Compose** (for multi-service orchestration)
- **Embedding API access** (OpenAI, Google Vertex AI, AWS Bedrock, or Azure OpenAI)
  - Required for vector search
  - Optional if using full-text search only

### Network Requirements

- PostgreSQL port (default: 5432) accessible
- HTTP/HTTPS ports (default: 6280, 6281) open
- Outbound internet access for:
  - Documentation scraping
  - Embedding API calls
  - npm package downloads

---

## Local Development Deployment

### Step 1: Install PostgreSQL and pgvector

**Option A: Docker (Quickest)**

```bash
docker run -d \
  --name scrapegoat-db \
  --restart unless-stopped \
  -e POSTGRES_USER=scrapegoat \
  -e POSTGRES_PASSWORD=dev_password \
  -e POSTGRES_DB=scrapegoat \
  -v scrapegoat-data:/var/lib/postgresql/data \
  -p 5432:5432 \
  pgvector/pgvector:pg16
```

**Option B: Local Installation**

See [POSTGRESQL_SETUP.md](./POSTGRESQL_SETUP.md) for platform-specific instructions.

### Step 2: Configure Environment

Create a `.env` file in your project directory:

```bash
# Database Configuration
DATABASE_URL=postgresql://scrapegoat:dev_password@localhost:5432/scrapegoat

# Embedding Provider (optional - enables vector search)
OPENAI_API_KEY=sk-proj-your-api-key-here
DOCS_MCP_EMBEDDING_MODEL=text-embedding-3-small

# Server Configuration
DOCS_MCP_PORT=6280
DOCS_MCP_HOST=localhost

# Development Settings
NODE_ENV=development
DOCS_MCP_TELEMETRY=false
```

### Step 3: Install and Build

```bash
# Clone repository (if not already done)
git clone http://gitlab.den.lan/pub/scrapegoat.git
cd scrapegoat

# Install dependencies
npm install

# Build the project
npm run build
```

### Step 4: Initialize Database

The database will be automatically initialized on first run. To manually verify:

```bash
# Connect to PostgreSQL
psql postgresql://scrapegoat:dev_password@localhost:5432/scrapegoat

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify migrations (run application first to auto-migrate)
\dt  -- List tables
\di  -- List indexes
```

### Step 5: Start the Server

**Standalone Mode (All-in-One)**

```bash
npm start
```

Access:
- Web Interface: http://localhost:6280
- MCP Endpoint (HTTP): http://localhost:6280/mcp
- MCP Endpoint (SSE): http://localhost:6280/sse

**Development Mode (Hot Reload)**

```bash
npm run dev
```

---

## Docker Deployment

### Single Container Deployment

**Create docker-compose.yml:**

```yaml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg16
    restart: unless-stopped
    environment:
      POSTGRES_USER: scrapegoat
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: scrapegoat
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U scrapegoat"]
      interval: 10s
      timeout: 5s
      retries: 5

  scrapegoat:
    image: ghcr.io/arabold/docs-mcp-server:latest
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://scrapegoat:${POSTGRES_PASSWORD}@postgres:5432/scrapegoat
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      DOCS_MCP_EMBEDDING_MODEL: text-embedding-3-small
      DOCS_MCP_PORT: 6280
      DOCS_MCP_HOST: 0.0.0.0
    ports:
      - "6280:6280"
    volumes:
      - scrapegoat-data:/data

volumes:
  postgres-data:
  scrapegoat-data:
```

**Create .env file:**

```bash
POSTGRES_PASSWORD=your_secure_password_here
OPENAI_API_KEY=sk-proj-your-api-key-here
```

**Start services:**

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f scrapegoat

# Stop services
docker compose down

# Stop and remove data (WARNING: destroys database)
docker compose down -v
```

### Multi-Service Architecture

For production deployments with separate worker processes:

```yaml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg16
    restart: unless-stopped
    environment:
      POSTGRES_USER: scrapegoat
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: scrapegoat
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - scrapegoat-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U scrapegoat"]
      interval: 10s
      timeout: 5s
      retries: 5

  worker:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://scrapegoat:${POSTGRES_PASSWORD}@postgres:5432/scrapegoat
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      DOCS_MCP_EMBEDDING_MODEL: text-embedding-3-small
      DOCS_MCP_PORT: 8080
      DOCS_MCP_HOST: 0.0.0.0
      NODE_ENV: production
    command: ["worker", "--port", "8080"]
    ports:
      - "8080:8080"
    networks:
      - scrapegoat-network
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 2G
          cpus: '1.0'

  mcp-server:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      - postgres
      - worker
    environment:
      DATABASE_URL: postgresql://scrapegoat:${POSTGRES_PASSWORD}@postgres:5432/scrapegoat
      WORKER_URL: http://worker:8080
      DOCS_MCP_PORT: 6280
      DOCS_MCP_HOST: 0.0.0.0
      NODE_ENV: production
    command: ["mcp", "--protocol", "http", "--port", "6280"]
    ports:
      - "6280:6280"
    networks:
      - scrapegoat-network

  web:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      - postgres
      - worker
    environment:
      DATABASE_URL: postgresql://scrapegoat:${POSTGRES_PASSWORD}@postgres:5432/scrapegoat
      WORKER_URL: http://worker:8080
      DOCS_MCP_PORT: 6281
      DOCS_MCP_HOST: 0.0.0.0
      NODE_ENV: production
    command: ["web", "--port", "6281"]
    ports:
      - "6281:6281"
    networks:
      - scrapegoat-network

networks:
  scrapegoat-network:
    driver: bridge

volumes:
  postgres-data:
```

---

## Cloud Deployment

### AWS (RDS + EC2)

**Step 1: Create RDS PostgreSQL Instance**

```bash
# Using AWS CLI
aws rds create-db-instance \
  --db-instance-identifier scrapegoat-db \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 16.1 \
  --master-username scrapegoat \
  --master-user-password YOUR_SECURE_PASSWORD \
  --allocated-storage 50 \
  --vpc-security-group-ids sg-xxxxxxxxxxxxx \
  --db-subnet-group-name your-subnet-group \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "sun:04:00-sun:05:00" \
  --storage-encrypted \
  --publicly-accessible false
```

**Step 2: Install pgvector Extension**

```bash
# Connect to RDS instance
psql -h scrapegoat-db.xxxxx.us-east-1.rds.amazonaws.com \
     -U scrapegoat -d postgres

-- Install pgvector (if available in RDS)
CREATE EXTENSION IF NOT EXISTS vector;
```

**Note:** RDS may not support pgvector by default. Consider:
- Using Aurora PostgreSQL with pgvector support
- Running self-managed PostgreSQL on EC2
- Using AWS MemoryDB for Vector Search

**Step 3: Deploy Application to EC2**

```bash
# SSH into EC2 instance
ssh -i your-key.pem ec2-user@your-instance.amazonaws.com

# Install Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Install application
git clone http://gitlab.den.lan/pub/scrapegoat.git
cd scrapegoat
npm install
npm run build

# Configure environment
cat > .env << EOF
DATABASE_URL=postgresql://scrapegoat:PASSWORD@scrapegoat-db.xxxxx.us-east-1.rds.amazonaws.com:5432/scrapegoat
OPENAI_API_KEY=sk-proj-your-key
DOCS_MCP_PORT=6280
DOCS_MCP_HOST=0.0.0.0
NODE_ENV=production
EOF

# Start with PM2 for process management
npm install -g pm2
pm2 start npm --name scrapegoat -- start
pm2 startup
pm2 save
```

### Azure (Azure Database for PostgreSQL)

**Step 1: Create Azure PostgreSQL Server**

```bash
# Using Azure CLI
az postgres flexible-server create \
  --name scrapegoat-db \
  --resource-group your-resource-group \
  --location eastus \
  --admin-user scrapegoat \
  --admin-password YOUR_SECURE_PASSWORD \
  --sku-name Standard_D2s_v3 \
  --tier GeneralPurpose \
  --version 16 \
  --storage-size 128 \
  --backup-retention 7 \
  --high-availability Disabled
```

**Step 2: Enable pgvector**

```bash
# Connect to Azure PostgreSQL
psql "host=scrapegoat-db.postgres.database.azure.com port=5432 dbname=postgres user=scrapegoat password=YOUR_PASSWORD sslmode=require"

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
```

**Step 3: Deploy to Azure App Service**

```bash
# Create App Service Plan
az appservice plan create \
  --name scrapegoat-plan \
  --resource-group your-resource-group \
  --sku B2 \
  --is-linux

# Create Web App
az webapp create \
  --name scrapegoat-app \
  --resource-group your-resource-group \
  --plan scrapegoat-plan \
  --runtime "NODE:20-lts"

# Configure application settings
az webapp config appsettings set \
  --name scrapegoat-app \
  --resource-group your-resource-group \
  --settings \
    DATABASE_URL="postgresql://scrapegoat:PASSWORD@scrapegoat-db.postgres.database.azure.com:5432/scrapegoat?sslmode=require" \
    OPENAI_API_KEY="sk-proj-your-key" \
    DOCS_MCP_PORT=8080 \
    NODE_ENV=production

# Deploy application
az webapp deployment source config-zip \
  --name scrapegoat-app \
  --resource-group your-resource-group \
  --src scrapegoat.zip
```

### GCP (Cloud SQL + Cloud Run)

**Step 1: Create Cloud SQL PostgreSQL Instance**

```bash
# Using gcloud CLI
gcloud sql instances create scrapegoat-db \
  --database-version=POSTGRES_16 \
  --tier=db-custom-2-8192 \
  --region=us-central1 \
  --backup \
  --backup-start-time=03:00 \
  --maintenance-window-day=SUN \
  --maintenance-window-hour=4 \
  --storage-type=SSD \
  --storage-size=50GB

# Set root password
gcloud sql users set-password postgres \
  --instance=scrapegoat-db \
  --password=YOUR_SECURE_PASSWORD
```

**Step 2: Enable pgvector**

```bash
# Connect via Cloud SQL Proxy
./cloud_sql_proxy -instances=PROJECT:REGION:scrapegoat-db=tcp:5432 &

# Connect to database
psql "host=localhost port=5432 dbname=postgres user=postgres"

-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Create application user
CREATE USER scrapegoat WITH PASSWORD 'app_password';
CREATE DATABASE scrapegoat OWNER scrapegoat;
```

**Step 3: Deploy to Cloud Run**

```bash
# Build container
gcloud builds submit --tag gcr.io/YOUR_PROJECT/scrapegoat

# Deploy to Cloud Run
gcloud run deploy scrapegoat \
  --image gcr.io/YOUR_PROJECT/scrapegoat \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL="postgresql://scrapegoat:app_password@/scrapegoat?host=/cloudsql/PROJECT:REGION:scrapegoat-db" \
  --set-env-vars OPENAI_API_KEY="sk-proj-your-key" \
  --set-env-vars DOCS_MCP_PORT=8080 \
  --add-cloudsql-instances PROJECT:REGION:scrapegoat-db \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 10
```

---

## Production Configuration

### Environment Variables

Complete list of production-critical environment variables:

```bash
# === Database Configuration (REQUIRED) ===
DATABASE_URL=postgresql://user:pass@host:port/database

# === Embedding Provider (OPTIONAL - enables vector search) ===
OPENAI_API_KEY=sk-proj-xxxxx
DOCS_MCP_EMBEDDING_MODEL=text-embedding-3-small

# === Server Configuration ===
DOCS_MCP_PORT=6280
DOCS_MCP_HOST=0.0.0.0
DOCS_MCP_PROTOCOL=http  # auto, stdio, http

# === Performance Tuning ===
MAX_CONCURRENCY=3  # Concurrent scraping jobs
WORKER_URL=http://worker:8080  # For distributed architecture

# === Security ===
NODE_ENV=production
DOCS_MCP_TELEMETRY=false
DOCS_MCP_AUTH_ENABLED=true  # OAuth2/OIDC authentication
DOCS_MCP_AUTH_ISSUER_URL=https://auth.example.com
DOCS_MCP_AUTH_AUDIENCE=scrapegoat-api

# === Monitoring ===
LOG_LEVEL=info  # debug, info, warn, error
```

### PostgreSQL Connection Strings

**Standard Format:**
```
postgresql://username:password@hostname:port/database
```

**With SSL (Production):**
```
postgresql://username:password@hostname:port/database?sslmode=require
```

**With Connection Pooling:**
```
postgresql://username:password@hostname:port/database?sslmode=require&pool_size=20&connect_timeout=10
```

**Cloud-Specific Examples:**

```bash
# AWS RDS
DATABASE_URL="postgresql://scrapegoat:pass@scrapegoat.xxxxx.us-east-1.rds.amazonaws.com:5432/scrapegoat?sslmode=require"

# Azure Database
DATABASE_URL="postgresql://scrapegoat@servername:pass@servername.postgres.database.azure.com:5432/scrapegoat?sslmode=require"

# GCP Cloud SQL (via Unix socket)
DATABASE_URL="postgresql://scrapegoat:pass@/scrapegoat?host=/cloudsql/project:region:instance"

# GCP Cloud SQL (via TCP with Cloud SQL Proxy)
DATABASE_URL="postgresql://scrapegoat:pass@localhost:5432/scrapegoat"
```

### Performance Configuration

**PostgreSQL Settings** (`postgresql.conf`):

```ini
# Connection Pooling
max_connections = 100

# Memory Settings (for 8GB RAM server)
shared_buffers = 2GB
effective_cache_size = 6GB
maintenance_work_mem = 512MB
work_mem = 32MB

# Vector Search Performance
hnsw.ef_search = 40  # Higher = better recall, slower queries

# Query Planner
random_page_cost = 1.1  # For SSD storage
effective_io_concurrency = 200

# Write Performance
checkpoint_completion_target = 0.9
wal_buffers = 16MB
```

**Application Settings:**

```bash
# Scraping Concurrency (adjust based on server resources)
MAX_CONCURRENCY=5  # 2-4 cores: 3, 4-8 cores: 5, 8+ cores: 10

# Database Connection Pool (per worker)
# Formula: (max_connections - superuser_reserved_connections) / number_of_workers
# Example: (100 - 3) / 2 workers = 48 connections per worker
PGPOOL_MIN=10
PGPOOL_MAX=48
```

### Security Hardening

See [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md) for complete security configuration.

**Quick Checklist:**

- [ ] Use strong database passwords (16+ characters)
- [ ] Enable SSL/TLS for database connections
- [ ] Restrict database user privileges
- [ ] Enable firewall rules (PostgreSQL port 5432)
- [ ] Use environment variables for secrets (never hardcode)
- [ ] Enable authentication for web interface
- [ ] Regular security updates (`npm audit`)
- [ ] Monitor access logs

---

## Service Modes

Scrapegoat can run in different service modes depending on your deployment:

### Standalone Mode (Default)

All-in-one server with web UI, MCP endpoints, and worker in single process.

```bash
npm start
# or
npm start -- --protocol http --port 6280
```

**Access:**
- Web UI: http://localhost:6280
- MCP HTTP: http://localhost:6280/mcp
- MCP SSE: http://localhost:6280/sse

### MCP Server Only

MCP endpoints without web interface.

```bash
npm start mcp -- --protocol http --port 6280
```

**Access:**
- MCP HTTP: http://localhost:6280/mcp
- MCP SSE: http://localhost:6280/sse

### Web Interface Only

Management interface without MCP endpoints (requires separate worker).

```bash
npm start web -- --port 6281
```

**Access:**
- Web UI: http://localhost:6281

### Worker Only

Background worker for documentation processing (no HTTP endpoints).

```bash
npm start worker -- --port 8080
```

### Embedded Mode (stdio)

For AI assistant integration via stdio transport.

```json
{
  "mcpServers": {
    "scrapegoat": {
      "command": "node",
      "args": ["/path/to/scrapegoat/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://user:pass@host/db"
      }
    }
  }
}
```

---

## Monitoring and Maintenance

### Health Checks

**HTTP Health Endpoint:**

```bash
# Check server health
curl http://localhost:6280/health

# Expected response
{
  "status": "ok",
  "database": "connected",
  "version": "1.0.0"
}
```

**Database Health:**

```sql
-- Check PostgreSQL status
SELECT version();

-- Check active connections
SELECT count(*) FROM pg_stat_activity WHERE datname = 'scrapegoat';

-- Check database size
SELECT pg_size_pretty(pg_database_size('scrapegoat'));

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Performance Monitoring

**PostgreSQL Monitoring Queries:**

```sql
-- Slow queries (> 1 second)
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 1000
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Index usage
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Cache hit ratio (should be > 99%)
SELECT
  sum(heap_blks_read) as heap_read,
  sum(heap_blks_hit)  as heap_hit,
  sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100 as ratio
FROM pg_statio_user_tables;

-- HNSW index stats
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE indexname LIKE '%hnsw%';
```

### Maintenance Tasks

**Daily:**

```bash
# Backup database
pg_dump -h localhost -U scrapegoat scrapegoat | gzip > backup-$(date +%Y%m%d).sql.gz

# Monitor disk usage
df -h /var/lib/postgresql/data
```

**Weekly:**

```sql
-- Vacuum and analyze
VACUUM ANALYZE;

-- Reindex if needed (during off-peak hours)
REINDEX DATABASE scrapegoat;
```

**Monthly:**

```bash
# Update application
cd scrapegoat
git pull
npm install
npm run build
pm2 restart scrapegoat

# Security updates
npm audit fix
```

### Logging

**Application Logs:**

```bash
# Standalone mode
npm start 2>&1 | tee -a scrapegoat.log

# Docker
docker compose logs -f scrapegoat

# PM2
pm2 logs scrapegoat
```

**PostgreSQL Logs:**

```bash
# Ubuntu/Debian
tail -f /var/log/postgresql/postgresql-16-main.log

# Docker
docker logs scrapegoat-db

# Find slow queries
grep "duration:" /var/log/postgresql/postgresql-16-main.log | grep -v "duration: 0."
```

---

## Backup and Recovery

### Database Backup

**Automated Backup Script:**

```bash
#!/bin/bash
# backup-scrapegoat.sh

BACKUP_DIR="/backup/scrapegoat"
DATE=$(date +%Y%m%d-%H%M%S)
DATABASE_URL="postgresql://scrapegoat:password@localhost:5432/scrapegoat"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Dump database
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_DIR/scrapegoat-$DATE.sql.gz"

# Keep only last 30 days
find "$BACKUP_DIR" -name "scrapegoat-*.sql.gz" -mtime +30 -delete

echo "Backup completed: scrapegoat-$DATE.sql.gz"
```

**Schedule with cron:**

```bash
# Edit crontab
crontab -e

# Add daily backup at 3 AM
0 3 * * * /path/to/backup-scrapegoat.sh
```

**Cloud Storage Backup:**

```bash
# AWS S3
pg_dump "$DATABASE_URL" | gzip | aws s3 cp - s3://my-backups/scrapegoat-$(date +%Y%m%d).sql.gz

# Google Cloud Storage
pg_dump "$DATABASE_URL" | gzip | gsutil cp - gs://my-backups/scrapegoat-$(date +%Y%m%d).sql.gz

# Azure Blob Storage
pg_dump "$DATABASE_URL" | gzip | az storage blob upload \
  --account-name mystorageaccount \
  --container-name backups \
  --name scrapegoat-$(date +%Y%m%d).sql.gz \
  --file -
```

### Database Recovery

**Restore from Backup:**

```bash
# Stop application
pm2 stop scrapegoat

# Drop and recreate database (WARNING: destroys all data)
psql -h localhost -U postgres << EOF
DROP DATABASE IF EXISTS scrapegoat;
CREATE DATABASE scrapegoat OWNER scrapegoat;
EOF

# Restore from backup
gunzip -c backup-20250108.sql.gz | psql -h localhost -U scrapegoat scrapegoat

# Restart application
pm2 start scrapegoat
```

### Point-in-Time Recovery (PITR)

For cloud-managed databases:

**AWS RDS:**

```bash
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier scrapegoat-db \
  --target-db-instance-identifier scrapegoat-db-restored \
  --restore-time 2025-01-08T10:00:00Z
```

**Azure PostgreSQL:**

```bash
az postgres flexible-server restore \
  --resource-group your-resource-group \
  --name scrapegoat-db-restored \
  --source-server scrapegoat-db \
  --restore-time "2025-01-08T10:00:00Z"
```

**GCP Cloud SQL:**

```bash
gcloud sql backups restore BACKUP_ID \
  --backup-instance=scrapegoat-db \
  --target-instance=scrapegoat-db-restored
```

---

## Health Checks

### Kubernetes Readiness Probe

```yaml
readinessProbe:
  httpGet:
    path: /health
    port: 6280
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
```

### Kubernetes Liveness Probe

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 6280
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

### Docker Healthcheck

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:6280/health || exit 1
```

### Custom Health Check Script

```bash
#!/bin/bash
# health-check.sh

# Check HTTP endpoint
if ! curl -sf http://localhost:6280/health > /dev/null; then
  echo "ERROR: HTTP health check failed"
  exit 1
fi

# Check database connection
if ! psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
  echo "ERROR: Database connection failed"
  exit 1
fi

# Check pgvector extension
if ! psql "$DATABASE_URL" -c "SELECT extname FROM pg_extension WHERE extname='vector'" | grep -q vector; then
  echo "ERROR: pgvector extension not installed"
  exit 1
fi

echo "OK: All health checks passed"
exit 0
```

---

## Troubleshooting

### Common Deployment Issues

**Issue: Application fails to start**

```bash
# Check logs for errors
npm start 2>&1 | tee error.log

# Common causes:
# 1. Database connection failure
psql "$DATABASE_URL" -c "SELECT 1"

# 2. Missing environment variables
env | grep DATABASE_URL

# 3. Port already in use
lsof -i :6280
```

**Issue: Database connection refused**

```bash
# Check PostgreSQL is running
systemctl status postgresql
# or for Docker:
docker ps | grep postgres

# Check firewall
sudo ufw status
sudo ufw allow 5432/tcp

# Test connection
psql -h localhost -U scrapegoat -d scrapegoat
```

**Issue: pgvector extension not found**

```sql
-- Install pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify installation
SELECT * FROM pg_extension WHERE extname = 'vector';
```

**Issue: Slow performance**

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for detailed performance debugging.

Quick checks:

```sql
-- Check for missing indexes
SELECT * FROM pg_stat_user_tables WHERE idx_scan = 0 AND seq_scan > 0;

-- Check cache hit ratio
SELECT sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100 AS cache_hit_ratio
FROM pg_statio_user_tables;

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM documents WHERE embedding <-> '[...]' < 0.5;
```

### Rollback Procedures

**Application Rollback:**

```bash
# Using PM2
pm2 list
pm2 stop scrapegoat
git checkout previous-stable-tag
npm install
npm run build
pm2 start scrapegoat

# Using Docker
docker pull ghcr.io/arabold/docs-mcp-server:previous-tag
docker compose up -d scrapegoat
```

**Database Rollback:**

```bash
# Restore from backup
pm2 stop scrapegoat
gunzip -c backup-before-migration.sql.gz | psql -U scrapegoat scrapegoat
pm2 start scrapegoat
```

**Migration Rollback:**

If migrations need to be reversed (no built-in down migrations):

```sql
-- Manual rollback example (Phase 5 → Phase 4)
DROP INDEX IF EXISTS idx_documents_embedding_hnsw;
DROP INDEX IF EXISTS idx_documents_content_gin;
-- Continue dropping Phase 5 changes...
```

---

## Additional Resources

- [PostgreSQL Setup Guide](./POSTGRESQL_SETUP.md) - Database installation
- [Configuration Reference](./CONFIGURATION.md) - All environment variables
- [Performance Tuning](./PERFORMANCE.md) - Optimization guide
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues and solutions
- [Security Checklist](./SECURITY_CHECKLIST.md) - Production security hardening
- [Migration Guide](./MIGRATION.md) - SQLite to PostgreSQL migration

---

**Document Version**: 1.0
**Last Updated**: 2025-11-08
**Applies to**: Scrapegoat v1.0.0+
