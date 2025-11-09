# Docker Deployment Guide

Complete guide for deploying Scrapegoat using Docker Compose. Two configurations are available: BYO (Bring Your Own) for existing infrastructure, and AIO (All-In-One) for self-contained deployments.

## Table of Contents

- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Configuration Options](#configuration-options)
- [BYO Deployment](#byo-deployment-bring-your-own)
- [AIO Deployment](#aio-deployment-all-in-one)
- [Troubleshooting](#troubleshooting)
- [Operations](#operations)

## Quick Start

### BYO (Bring Your Own)
```bash
# 1. Copy and configure environment
cp .env.byo .env
nano .env  # Configure DATABASE_URL and OPENAI_API_BASE

# 2. Ensure database exists with pgvector
PGPASSWORD='your-password' psql -U postgres -h your-postgres-host \
  -c 'CREATE DATABASE scrapegoat;'
PGPASSWORD='your-password' psql -U postgres -h your-postgres-host -d scrapegoat \
  -c 'CREATE EXTENSION IF NOT EXISTS vector;'

# 3. Deploy
docker compose -f docker-compose.byo.yml --profile crawl4ai up -d
```

### AIO (All-In-One)
```bash
# 1. Copy and configure environment
cp .env.aio .env
nano .env  # Set POSTGRES_PASSWORD

# 2. Deploy
docker compose -f docker-compose.aio.yml --profile crawl4ai up -d
```

## Prerequisites

### Required
- Docker 20.10+ with Compose v2
- 5-10GB RAM (depending on configuration)
- 10-25GB disk space

### BYO Additional Requirements
- External PostgreSQL 14+ with pgvector extension
- OpenAI-compatible embedding API endpoint

## Configuration Options

| Feature | BYO | AIO |
|---------|-----|-----|
| PostgreSQL | External (yours) | Included |
| Embedding API | External (yours) | Included |
| Services | Worker, MCP, Web, Crawl4AI | Same + PostgreSQL + Embeddings |
| RAM Required | 5-6GB | 9-10GB |
| Disk Required | 10GB | 25GB |
| CPU Cores | 5 | 8 |
| Setup Complexity | Medium | Low |

## BYO Deployment (Bring Your Own)

### Step 1: Prepare External Services

#### PostgreSQL Setup
Your PostgreSQL server must have:
1. PostgreSQL 14+
2. pgvector extension installed
3. Database created with pgvector enabled

```bash
# On your PostgreSQL server
CREATE DATABASE scrapegoat OWNER postgres;
\c scrapegoat
CREATE EXTENSION IF NOT EXISTS vector;
```

#### Embedding API Setup
Your embedding API must:
1. Support OpenAI-compatible `/v1/embeddings` endpoint
2. Accept the model name you configure in DOCS_MCP_EMBEDDING_MODEL
3. Be accessible from the Docker host

Supported embedding services:
- OpenAI API (text-embedding-3-small, text-embedding-3-large)
- Text-Embeddings-Inference (HuggingFace)
- LocalAI
- Custom OpenAI-compatible services

### Step 2: Configure Environment

Copy the BYO environment template:
```bash
cp .env.byo .env
```

Edit `.env` with your values:
```bash
# Required: Your PostgreSQL connection
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@postgres.example.com:5432/scrapegoat

# Required: Your embedding API endpoint
OPENAI_API_BASE=http://embed.example.com/v1
OPENAI_API_KEY=your-api-key-or-not-required

# Important: Match your embedding service's model name
DOCS_MCP_EMBEDDING_MODEL=text-embedding-3-small
```

**Critical Notes**:
1. **DATABASE_URL**: Must point to a database with pgvector extension enabled
2. **OPENAI_API_BASE**: Must end with `/v1` for OpenAI-compatible APIs
3. **DOCS_MCP_EMBEDDING_MODEL**: Must match exactly what your embedding service expects
   - For OpenAI: `text-embedding-3-small` or `text-embedding-3-large`
   - For Text-Embeddings-Inference: model ID from HuggingFace (e.g., `sentence-transformers/all-MiniLM-L6-v2`)

### Step 3: Build Images

```bash
docker compose -f docker-compose.byo.yml build
```

**Build time**: ~4-5 minutes

**Note**: The build uses `--legacy-peer-deps` to resolve npm dependency conflicts. This is expected and handled automatically.

### Step 4: Deploy Services

```bash
# With Crawl4AI (recommended)
docker compose -f docker-compose.byo.yml --profile crawl4ai up -d

# Without Crawl4AI
docker compose -f docker-compose.byo.yml up -d
```

**Startup sequence**:
1. Volume creation (scrapegoat-data)
2. Worker starts and connects to PostgreSQL
3. Crawl4AI starts (if enabled)
4. Worker becomes healthy
5. MCP and Web services start

### Step 5: Verify Deployment

```bash
# Check all services running
docker compose -f docker-compose.byo.yml ps

# Should show:
# - scrapegoat-worker: Up (healthy)
# - scrapegoat-mcp: Up
# - scrapegoat-web: Up
# - scrapegoat-crawl4ai: Up (healthy) [if enabled]

# Check service endpoints
curl http://localhost:6281              # Web UI (HTML page)
curl http://localhost:8001/health       # Crawl4AI (JSON response)
docker logs scrapegoat-worker           # Worker logs
docker logs scrapegoat-mcp              # MCP logs
```

## AIO Deployment (All-In-One)

### Step 1: Configure Environment

Copy the AIO environment template:
```bash
cp .env.aio .env
```

Edit `.env` - **only one required change**:
```bash
# Set a strong PostgreSQL password
POSTGRES_PASSWORD=your-strong-password-here
```

All other defaults are pre-configured and ready to use.

### Step 2: Deploy

```bash
# Deploy all services (including Crawl4AI)
docker compose -f docker-compose.aio.yml --profile crawl4ai up -d
```

**First startup time**: 60-90 seconds
- PostgreSQL initialization: 10s
- Embedding model download: 30-60s
- Service startup: 20-30s

**Subsequent startups**: 20-30 seconds (model cached)

### Step 3: Verify Deployment

```bash
# Check all services
docker compose -f docker-compose.aio.yml ps

# Should show 6 services:
# - scrapegoat-postgres: Up (healthy)
# - scrapegoat-embeddings: Up (healthy)
# - scrapegoat-worker: Up (healthy)
# - scrapegoat-mcp: Up
# - scrapegoat-web: Up
# - scrapegoat-crawl4ai: Up (healthy)

# Test endpoints
curl http://localhost:6281              # Web UI
curl http://localhost:8001/health       # Crawl4AI
curl http://localhost:5432              # PostgreSQL (should refuse, normal)
curl http://localhost:8082/health       # Embeddings API
```

## Troubleshooting

### Common Issues

#### 1. npm Dependency Conflicts During Build

**Symptom**:
```
npm error ERESOLVE could not resolve
npm error While resolving: @langchain/aws@0.1.15
```

**Solution**: Already fixed in Dockerfile with `--legacy-peer-deps` flag. If you see this error, ensure you're using the latest Dockerfile from this repository.

#### 2. Database Does Not Exist (BYO)

**Symptom**:
```
ConnectionError: Failed to connect to PostgreSQL caused by error: database "scrapegoat" does not exist
```

**Solution**:
```bash
# Create database on your PostgreSQL server
PGPASSWORD='your-password' psql -U postgres -h your-postgres-host \
  -c 'CREATE DATABASE scrapegoat OWNER postgres;'

# Enable pgvector extension
PGPASSWORD='your-password' psql -U postgres -h your-postgres-host -d scrapegoat \
  -c 'CREATE EXTENSION IF NOT EXISTS vector;'

# Restart worker
docker restart scrapegoat-worker
```

#### 3. Invalid Embedding Model Name (BYO)

**Symptom**:
```
Error: Invalid embedding model: text-embeddings-inference
```

**Solution**: The model name must match what your embedding service expects. Update `.env`:

For OpenAI or OpenAI-compatible services:
```bash
DOCS_MCP_EMBEDDING_MODEL=text-embedding-3-small
```

For Text-Embeddings-Inference with HuggingFace models:
```bash
DOCS_MCP_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
```

Restart services after changing:
```bash
docker compose -f docker-compose.byo.yml restart
```

#### 4. Crawl4AI Not Starting (Proxmox)

**Symptom**:
```
permission denied: open sysctl net.ipv4.ping_group_range
```

**Solution**: This is a Proxmox VE security restriction. The docker-compose files are already configured with:
```yaml
security_opt:
  - seccomp=unconfined
cap_add:
  - SYS_ADMIN
```

If still failing, try:
```bash
# On Proxmox host, adjust container settings
pct set <CTID> -features nesting=1
```

#### 5. Worker Not Connecting to External Services (BYO)

**Symptom**:
```
ConnectionError: Failed to connect to PostgreSQL
```

**Checklist**:
1. Verify DATABASE_URL is correct (check host, port, password)
2. Ensure PostgreSQL allows connections from Docker host
3. Check firewall rules allow connection
4. Verify pgvector extension is enabled:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'vector';
   ```

For embedding API:
1. Verify OPENAI_API_BASE is reachable from Docker host
2. Test endpoint: `curl http://your-embed-api/v1/embeddings`
3. Check API key if required

### Health Check Debugging

```bash
# Check container health
docker inspect scrapegoat-worker | grep -A 10 Health

# View health check logs
docker logs scrapegoat-worker 2>&1 | grep health

# Manual health test (for Crawl4AI)
curl http://localhost:8001/health
```

### Log Inspection

```bash
# View all logs
docker compose -f docker-compose.byo.yml logs

# Follow logs in real-time
docker compose -f docker-compose.byo.yml logs -f

# Specific service logs
docker logs scrapegoat-worker
docker logs -f scrapegoat-mcp
docker logs --tail 100 scrapegoat-web

# Search for errors
docker logs scrapegoat-worker 2>&1 | grep -i error
```

## Operations

### Starting Services

```bash
# Start all services
docker compose -f docker-compose.byo.yml up -d

# Start with Crawl4AI
docker compose -f docker-compose.byo.yml --profile crawl4ai up -d

# Start specific service
docker compose -f docker-compose.byo.yml up -d worker
```

### Stopping Services

```bash
# Stop all services
docker compose -f docker-compose.byo.yml down

# Stop but keep volumes
docker compose -f docker-compose.byo.yml down

# Stop and remove volumes (⚠️ data loss)
docker compose -f docker-compose.byo.yml down -v
```

### Updating Services

```bash
# Pull latest code
git pull origin main

# Rebuild images
docker compose -f docker-compose.byo.yml build

# Restart services with new images
docker compose -f docker-compose.byo.yml up -d
```

### Backup and Restore

#### BYO Configuration
Backup your external PostgreSQL database using your standard procedures.

#### AIO Configuration

**Backup**:
```bash
# Backup PostgreSQL
docker exec scrapegoat-postgres pg_dump -U scrapegoat scrapegoat > backup.sql

# Backup volumes
docker run --rm -v scrapegoat-postgres-data:/data \
  -v $(pwd):/backup alpine tar czf /backup/postgres.tar.gz /data
```

**Restore**:
```bash
# Restore PostgreSQL
docker exec -i scrapegoat-postgres psql -U scrapegoat scrapegoat < backup.sql

# Restore volumes
docker run --rm -v scrapegoat-postgres-data:/data \
  -v $(pwd):/backup alpine tar xzf /backup/postgres.tar.gz -C /
```

### Monitoring

```bash
# Resource usage
docker stats

# Service status
docker compose -f docker-compose.byo.yml ps

# Container inspection
docker inspect scrapegoat-worker

# Disk usage
docker system df
```

## Service Endpoints

| Service | Port | Endpoint | Purpose |
|---------|------|----------|---------|
| Web UI | 6281 | http://localhost:6281 | Web interface |
| Worker API | 8080 | http://localhost:8080 | Background processing |
| MCP Server | 6280 | http://localhost:6280 | Model Context Protocol |
| Crawl4AI | 8001 | http://localhost:8001 | Web scraping service |

**AIO Additional Endpoints** (internal only):
| Service | Port | Purpose |
|---------|------|---------|
| PostgreSQL | 5432 | Database (localhost only) |
| Embeddings | 8082 | Embedding API (localhost only) |

## Environment Variables Reference

### Required (BYO)
| Variable | Description | Example |
|----------|-------------|---------|
| DATABASE_URL | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| OPENAI_API_BASE | Embedding API endpoint | `http://embed.example.com/v1` |
| DOCS_MCP_EMBEDDING_MODEL | Model name | `text-embedding-3-small` |

### Required (AIO)
| Variable | Description | Default |
|----------|-------------|---------|
| POSTGRES_PASSWORD | Database password | (must set) |

### Optional (Both)
| Variable | Description | Default |
|----------|-------------|---------|
| MCP_PORT | MCP server port | 6280 |
| WEB_PORT | Web UI port | 6281 |
| WORKER_PORT | Worker API port | 8080 |
| CRAWL4AI_ENABLED | Enable Crawl4AI | true |
| CRAWL4AI_SERVICE_URL | Crawl4AI endpoint | http://localhost:8001 |
| POSTHOG_API_KEY | Analytics key | (empty) |

## Architecture

### BYO Architecture
```
┌─────────────────┐      ┌──────────────┐
│ scrapegoat-web  │◄────►│ External     │
└─────────────────┘      │ PostgreSQL   │
                         │ + pgvector   │
┌─────────────────┐      └──────────────┘
│ scrapegoat-mcp  │
└─────────────────┘      ┌──────────────┐
                         │ External     │
┌─────────────────┐      │ Embedding    │
│scrapegoat-worker│◄────►│ API          │
└─────────────────┘      └──────────────┘
        │
        ▼
┌─────────────────┐
│scrapegoat-      │
│crawl4ai         │
└─────────────────┘
```

### AIO Architecture
```
┌─────────────────┐      ┌──────────────┐
│ scrapegoat-web  │◄────►│ scrapegoat-  │
└─────────────────┘      │ postgres     │
                         └──────────────┘
┌─────────────────┐
│ scrapegoat-mcp  │      ┌──────────────┐
└─────────────────┘      │ scrapegoat-  │
                         │ embeddings   │
┌─────────────────┐      └──────────────┘
│scrapegoat-worker│◄────────────┘
└─────────────────┘
        │
        ▼
┌─────────────────┐
│scrapegoat-      │
│crawl4ai         │
└─────────────────┘
```

## Additional Resources

- **Full Planning Documentation**: `projects/docker-deployment-planning/`
- **Architecture Decisions**: `projects/docker-deployment-planning/architecture/architecture-decisions.md`
- **Technology Research**: `projects/docker-deployment-planning/research/technology-research.md`
- **Installation Notes** (Real deployment): `INSTALL_NOTES.md`

## Support

For issues or questions:
1. Check this guide's [Troubleshooting](#troubleshooting) section
2. Review `INSTALL_NOTES.md` for real-world deployment insights
3. Check logs: `docker compose logs`
4. Open an issue on GitHub

## Security Considerations

1. **Passwords**: Set strong `POSTGRES_PASSWORD` in AIO configuration
2. **Network**: Services use host networking by default (Proxmox compatible)
3. **Firewall**: Configure firewall rules to restrict access to services
4. **TLS/SSL**: Not configured by default - add reverse proxy for HTTPS
5. **API Keys**: Store securely, never commit `.env` to version control

## Production Checklist

Before production deployment:
- [ ] Set strong passwords in `.env`
- [ ] Configure firewall rules
- [ ] Set up SSL/TLS (reverse proxy)
- [ ] Configure backup procedures
- [ ] Set up monitoring and alerting
- [ ] Configure log rotation
- [ ] Document runbook procedures
- [ ] Test disaster recovery
- [ ] Configure resource limits
- [ ] Review security settings
