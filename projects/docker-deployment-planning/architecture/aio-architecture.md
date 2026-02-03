# AIO (All-In-One) Architecture

**Configuration**: All-In-One Docker Deployment
**Date**: 2025-11-09
**Status**: Planning Complete

## Overview

The AIO configuration provides a complete, self-contained Scrapegoat deployment with zero external dependencies. All required services are included and automatically configured.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           HOST SYSTEM (Proxmox VE)                       │
│                         network_mode: host (all services)                │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     INTERNAL SERVICES                             │  │
│  │                    (localhost access only)                        │  │
│  │                                                                    │  │
│  │  ┌────────────────────────────────────────────────────────┐      │  │
│  │  │  PostgreSQL 17 + pgvector                              │      │  │
│  │  │  Container: scrapegoat-postgres                        │      │  │
│  │  │  Port: 5432                                            │      │  │
│  │  │  Image: pgvector/pgvector:pg17                         │      │  │
│  │  │  Volume: scrapegoat-postgres-data                      │      │  │
│  │  │  Resources: 2GB RAM limit, 512MB reserved              │      │  │
│  │  └────────────────────────────────────────────────────────┘      │  │
│  │                              │                                    │  │
│  │                              │ SQL queries                        │  │
│  │                              │ Vector storage                     │  │
│  │  ┌────────────────────────────────────────────────────────┐      │  │
│  │  │  Text-Embeddings-Inference (TEI)                       │      │  │
│  │  │  Container: scrapegoat-embeddings                      │      │  │
│  │  │  Port: 8082                                            │      │  │
│  │  │  Image: ghcr.io/huggingface/text-embeddings-          │      │  │
│  │  │         inference:1.8-cpu                              │      │  │
│  │  │  Model: sentence-transformers/all-MiniLM-L6-v2         │      │  │
│  │  │  API: OpenAI-compatible /v1/embeddings                 │      │  │
│  │  │  Volume: scrapegoat-embeddings-cache                   │      │  │
│  │  │  Resources: 2GB RAM limit, 1GB reserved                │      │  │
│  │  └────────────────────────────────────────────────────────┘      │  │
│  │                              │                                    │  │
│  │                              │ Embedding requests                 │  │
│  └──────────────────────────────┼────────────────────────────────────┘  │
│                                 │                                       │
│  ┌──────────────────────────────┼────────────────────────────────────┐  │
│  │                              ▼                                     │  │
│  │  ┌────────────────────────────────────────────────────────┐      │  │
│  │  │  Scrapegoat Worker                                     │      │  │
│  │  │  Container: scrapegoat-worker                          │      │  │
│  │  │  Port: 8080                                            │      │  │
│  │  │  Image: gitlab.fenrirsden.org/pub/scrapegoat:latest            │      │  │
│  │  │  Command: worker --host 0.0.0.0 --port 8080            │      │  │
│  │  │  Volume: scrapegoat-data                               │      │  │
│  │  │  Resources: 2GB RAM limit, 1GB reserved                │      │  │
│  │  │                                                          │      │  │
│  │  │  Features:                                              │      │  │
│  │  │  • Documentation scraping and processing                │      │  │
│  │  │  • Content chunking and embedding                       │      │  │
│  │  │  • Vector storage in PostgreSQL                         │      │  │
│  │  │  • RESTful API on port 8080                             │      │  │
│  │  │  • Optional Crawl4AI integration                        │      │  │
│  │  └────────────────────────────────────────────────────────┘      │  │
│  │                     │              │                              │  │
│  │         ┌───────────┴──────┬───────┴──────────┐                  │  │
│  │         │                  │                  │                  │  │
│  │         ▼                  ▼                  ▼                  │  │
│  │  ┌─────────────┐   ┌─────────────┐   ┌─────────────────┐       │  │
│  │  │ MCP Server  │   │   Web UI    │   │   Crawl4AI      │       │  │
│  │  │ :6280       │   │   :6281     │   │   :8001         │       │  │
│  │  │             │   │             │   │   (optional)    │       │  │
│  │  │ AI tool     │   │ Browser     │   │   AI-optimized  │       │  │
│  │  │ integration │   │ management  │   │   web scraping  │       │  │
│  │  │ 512MB RAM   │   │ interface   │   │   2GB RAM       │       │  │
│  │  │             │   │ 512MB RAM   │   │   privileged    │       │  │
│  │  └─────────────┘   └─────────────┘   └─────────────────┘       │  │
│  │                                                                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  External Access Points:                                                 │
│  • Worker API: localhost:8080                                           │
│  • MCP Server: localhost:6280                                           │
│  • Web UI: localhost:6281                                               │
│  • Crawl4AI: localhost:8001 (optional)                                  │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. PostgreSQL (scrapegoat-postgres)

**Purpose**: Primary data store for documentation, vectors, and metadata

**Specifications**:
- Image: `pgvector/pgvector:pg17`
- Port: 5432 (localhost only)
- Database: scrapegoat
- Extensions: pgvector (vector similarity search)

**Data Storage**:
- Volume: `scrapegoat-postgres-data`
- Path: `/var/lib/postgresql/data/pgdata`
- Persistence: Survives container restarts/updates

**Schema**:
- `libraries` table: Documentation libraries
- `versions` table: Library versions
- `pages` table: Individual pages with content
- `chunks` table: Content chunks with vector embeddings (pgvector)

**Health Check**:
```bash
pg_isready -U scrapegoat -d scrapegoat
```

**Resource Allocation**:
- Memory limit: 2GB
- Memory reservation: 512MB
- Typical usage: 500MB-1.5GB

### 2. Text-Embeddings-Inference (scrapegoat-embeddings)

**Purpose**: Convert text to vector embeddings using AI model

**Specifications**:
- Image: `ghcr.io/huggingface/text-embeddings-inference:1.8-cpu`
- Port: 8082 (localhost only)
- Model: `sentence-transformers/all-MiniLM-L6-v2`
- API: OpenAI-compatible `/v1/embeddings`

**Model Characteristics**:
- Size: 22MB
- Embedding dimensions: 384
- CPU-optimized inference
- Good accuracy for semantic search

**Configuration**:
```yaml
command:
  - --model-id sentence-transformers/all-MiniLM-L6-v2
  - --port 8082
  - --hostname 0.0.0.0
  - --max-concurrent-requests 32
  - --max-batch-tokens 16384
```

**Data Storage**:
- Volume: `scrapegoat-embeddings-cache`
- Purpose: Cache downloaded model
- First start: Downloads model (~22MB)
- Subsequent starts: Uses cached model

**Health Check**:
```bash
curl -f http://localhost:8082/health
```

**API Compatibility**:
- OpenAI SDK compatible
- Endpoint: `http://localhost:8082/v1/embeddings`
- No API key required
- Model name: `text-embeddings-inference`

**Resource Allocation**:
- Memory limit: 2GB
- Memory reservation: 1GB
- Typical usage: 1-1.5GB

### 3. Scrapegoat Worker (scrapegoat-worker)

**Purpose**: Core application logic for documentation processing

**Specifications**:
- Image: `gitlab.fenrirsden.org/pub/scrapegoat:latest`
- Port: 8080
- Command: `worker --host 0.0.0.0 --port 8080`

**Dependencies**:
- PostgreSQL (health check required)
- Embeddings API (health check required)
- Crawl4AI (optional, soft dependency)

**Functionality**:
1. **Scraping**: Fetch documentation from URLs
2. **Processing**: Parse, clean, and structure content
3. **Chunking**: Split content into semantic chunks
4. **Embedding**: Generate vectors via embeddings API
5. **Storage**: Save to PostgreSQL with pgvector
6. **Searching**: Vector similarity search
7. **API**: RESTful interface for clients

**API Endpoints**:
- `POST /api/scrape` - Initiate scraping job
- `GET /api/libraries` - List libraries
- `GET /api/versions` - List versions
- `POST /api/search` - Semantic search
- `GET /api/health` - Health check

**Data Storage**:
- Volume: `scrapegoat-data`
- Path: `/data`
- Contents: Logs, cache, temporary files

**Health Check**:
```javascript
node -e 'require("net").connect(8080, "127.0.0.1")
  .on("connect",()=>process.exit(0))
  .on("error",()=>process.exit(1))'
```

**Resource Allocation**:
- Memory limit: 2GB
- Memory reservation: 1GB
- Typical usage: 1-1.5GB

### 4. MCP Server (scrapegoat-mcp)

**Purpose**: Model Context Protocol server for AI tool integration

**Specifications**:
- Image: `gitlab.fenrirsden.org/pub/scrapegoat:latest`
- Port: 6280
- Command: `mcp --protocol http --host 0.0.0.0 --port 6280 --server-url http://localhost:8080/api`

**Dependencies**:
- Worker (health check required)

**Functionality**:
- Expose MCP tools for AI assistants
- Proxy requests to Worker API
- Provide standardized tool interface

**MCP Tools**:
- `scrape_docs` - Scrape and index documentation
- `search_docs` - Semantic search
- `list_libraries` - List available libraries
- `find_version` - Find library versions

**Resource Allocation**:
- Memory limit: 512MB
- Memory reservation: 256MB
- Typical usage: 200-400MB

### 5. Web UI (scrapegoat-web)

**Purpose**: Browser-based management interface

**Specifications**:
- Image: `gitlab.fenrirsden.org/pub/scrapegoat:latest`
- Port: 6281
- Command: `web --host 0.0.0.0 --port 6281 --server-url http://localhost:8080/api`

**Dependencies**:
- Worker (health check required)

**Functionality**:
- Library management (create, view, delete)
- Scraping job management
- Search interface
- System status monitoring

**Resource Allocation**:
- Memory limit: 512MB
- Memory reservation: 256MB
- Typical usage: 200-400MB

### 6. Crawl4AI (scrapegoat-crawl4ai) - Optional

**Purpose**: AI-optimized web crawling with Playwright

**Specifications**:
- Image: `scrapegoat-crawl4ai:latest` (custom build)
- Port: 8001
- Optional: Enable via `CRAWL4AI_ENABLED=true` and `--profile crawl4ai`

**Features**:
- Playwright headless browser
- Chromium-based rendering
- BM25-filtered markdown
- Screenshot capture
- Media extraction

**Requirements**:
- `shm_size: 2gb` - Chromium shared memory
- `privileged: true` - Proxmox VE compatibility
- `network_mode: host` - Networking

**Health Check**:
```bash
curl -f http://localhost:8001/health
```

**Resource Allocation**:
- Memory limit: 2GB
- Memory reservation: 1GB
- Shared memory: 2GB
- Typical usage: 1.5-2GB

## Data Flow

### Scraping Workflow

```
1. User → Web UI/MCP → Worker API
   ↓
2. Worker → Fetcher Selection
   ↓
3a. HTTP Fetcher → Direct HTTP request
3b. Browser Fetcher → Playwright rendering
3c. Crawl4AI Fetcher → AI-optimized crawling (if enabled)
   ↓
4. Content Processing → Parsing, cleaning
   ↓
5. Chunking → Semantic chunks
   ↓
6. Worker → Embeddings API (TEI)
   ↓
7. Embeddings API → Returns 384-dim vectors
   ↓
8. Worker → PostgreSQL (store chunks + vectors)
   ↓
9. PostgreSQL → Vector index (pgvector)
```

### Search Workflow

```
1. User query → Web UI/MCP → Worker API
   ↓
2. Worker → Embeddings API (embed query)
   ↓
3. Embeddings API → Returns query vector
   ↓
4. Worker → PostgreSQL (vector similarity search)
   ↓
5. PostgreSQL → Returns relevant chunks (pgvector)
   ↓
6. Worker → Rank and format results
   ↓
7. Worker → Return to client
```

## Network Architecture

### Host Networking

All services use `network_mode: host` for Proxmox VE compatibility.

**Port Allocation**:
```
5432  - PostgreSQL (internal only, bind to 127.0.0.1)
8082  - Embeddings API (internal only, bind to 127.0.0.1)
8080  - Worker API (external access)
6280  - MCP Server (external access)
6281  - Web UI (external access)
8001  - Crawl4AI (external access, optional)
```

**Security Implications**:
- Internal services (PostgreSQL, Embeddings) should bind to localhost
- External services can accept external connections
- Use firewall rules for additional security
- No Docker network isolation (host mode)

### Service Communication

All services communicate via `localhost`:

```
MCP/Web → Worker:      http://localhost:8080/api
Worker → PostgreSQL:   postgresql://localhost:5432/scrapegoat
Worker → Embeddings:   http://localhost:8082/v1/embeddings
Worker → Crawl4AI:     http://localhost:8001 (if enabled)
```

## Startup Sequence

```
1. postgres starts
   ↓ (10s)
2. postgres becomes healthy
   ↓
3. embeddings starts in parallel
   ↓ (30-60s on first start, 20s subsequent)
4. embeddings becomes healthy
   ↓
5. worker starts (waits for both dependencies)
   ↓ (10s)
6. worker becomes healthy
   ↓
7. mcp + web start in parallel
   ↓ (5s)
8. All services ready

Optional: crawl4ai starts independently if --profile crawl4ai used
```

**Total Startup Time**:
- First start: 60-90 seconds (model download)
- Subsequent starts: 20-30 seconds (cached model)

## Resource Requirements

### Total Resource Allocation

**Minimum**:
- CPU: 4 cores
- Memory: 8GB RAM
- Storage: 10GB

**Recommended**:
- CPU: 8 cores
- Memory: 10GB RAM
- Storage: 25GB

### Per-Service Breakdown

| Service | CPU (cores) | Memory Limit | Memory Reserved | Storage |
|---------|-------------|--------------|-----------------|---------|
| PostgreSQL | 1 | 2GB | 512MB | 5-20GB |
| Embeddings | 2 | 2GB | 1GB | 1-2GB |
| Worker | 2 | 2GB | 1GB | - |
| MCP | 0.5 | 512MB | 256MB | - |
| Web | 0.5 | 512MB | 256MB | - |
| Crawl4AI | 2 | 2GB | 1GB | 1-2GB |
| **Total** | **8** | **9GB** | **4GB** | **10-25GB** |

## Monitoring and Health

### Health Check Commands

```bash
# Check all service status
docker compose -f docker-compose.aio.yml ps

# Check specific service health
docker inspect scrapegoat-postgres | jq '.[0].State.Health'

# View logs
docker compose -f docker-compose.aio.yml logs -f [service]

# Check resource usage
docker stats
```

### Metrics to Monitor

1. **PostgreSQL**:
   - Connection count
   - Database size
   - Query performance
   - Vector index size

2. **Embeddings API**:
   - Request latency
   - Throughput (requests/sec)
   - Model cache size
   - Error rate

3. **Worker**:
   - Active jobs
   - Queue depth
   - Processing time
   - Error rate

4. **System**:
   - CPU usage per service
   - Memory usage per service
   - Disk I/O
   - Network traffic

## Backup and Recovery

### Database Backup

```bash
# Backup PostgreSQL
docker exec scrapegoat-postgres pg_dump -U scrapegoat scrapegoat > backup.sql

# Restore PostgreSQL
cat backup.sql | docker exec -i scrapegoat-postgres psql -U scrapegoat -d scrapegoat
```

### Volume Backup

```bash
# Backup volume
docker run --rm \
  -v scrapegoat-postgres-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/postgres-backup.tar.gz /data

# Restore volume
docker run --rm \
  -v scrapegoat-postgres-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/postgres-backup.tar.gz -C /
```

## Scaling Considerations

### Vertical Scaling
- Increase memory limits for services
- Add more CPU cores
- Optimize PostgreSQL settings

### Horizontal Scaling
- Multiple Worker instances (load balanced)
- PostgreSQL read replicas
- Dedicated embedding API cluster

### Current Limitations
- Single PostgreSQL instance
- Single embedding API instance
- Host networking prevents easy container scaling

## Security Hardening

1. **Database**:
   - Strong password in `.env`
   - Bind to localhost only
   - Regular backups
   - Encryption at rest (optional)

2. **Embedding API**:
   - No authentication required (internal service)
   - Bind to localhost only
   - Firewall rules

3. **Crawl4AI**:
   - Runs privileged (required for Proxmox)
   - Isolate if possible
   - Monitor resource usage

4. **General**:
   - Keep images updated
   - Monitor logs for anomalies
   - Use firewall rules
   - Restrict access to ports

---

*Architecture documented: 2025-11-09*
