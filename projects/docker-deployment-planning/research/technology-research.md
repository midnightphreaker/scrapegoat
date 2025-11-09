# Technology Research for Scrapegoat Docker Deployment

**Research Date**: 2025-11-09
**Researcher**: Claude (AI Agent)
**Purpose**: Identify and evaluate technologies for Docker-based deployment of Scrapegoat

## Executive Summary

This document captures comprehensive research into technologies required for deploying Scrapegoat in Docker containers. Research focused on three critical components:

1. PostgreSQL database with pgvector extension
2. OpenAI-compatible embedding API using MiniLM-L6-v2
3. Network configuration for Proxmox VE environments

## 1. PostgreSQL with pgvector Extension

### Requirements
- PostgreSQL database with vector similarity search capability
- pgvector extension for storing and querying embeddings
- Docker-based deployment
- Production-ready and well-maintained

### Research Findings

#### Official Docker Images

**Primary Choice: pgvector/pgvector**
- Official image maintained by pgvector project
- Latest recommended version: `pgvector/pgvector:pg17`
- Combines PostgreSQL 17 with pgvector extension pre-installed
- Regular updates and community support

**Alternative: ankane/pgvector**
- Alternative official image
- Less certain update schedule
- Same functionality but pgvector/pgvector preferred

### Docker Configuration

#### Basic Docker Run Command
```bash
docker run -d \
  --name scrapegoat-postgres \
  -e POSTGRES_USER=scrapegoat \
  -e POSTGRES_PASSWORD=secure_password \
  -e POSTGRES_DB=scrapegoat \
  -p 5432:5432 \
  -v postgres-data:/var/lib/postgresql/data \
  pgvector/pgvector:pg17
```

#### Docker Compose Configuration
```yaml
services:
  postgres:
    image: pgvector/pgvector:pg17
    environment:
      POSTGRES_USER: scrapegoat
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: scrapegoat
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
```

### Extension Activation

The pgvector extension must be activated in the database:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

This is typically handled by Scrapegoat's migration scripts automatically on first connection.

### Performance Considerations

- **Memory**: PostgreSQL with pgvector requires at least 512MB RAM
- **Recommended**: 1-2GB for production workloads
- **Storage**: Plan for vector data (768 dimensions × number of chunks)
- **Connections**: Default max_connections=100 suitable for most deployments

### Sources
- GitHub: https://github.com/pgvector/pgvector
- Docker Hub: https://hub.docker.com/r/pgvector/pgvector
- Official documentation: Multiple community guides (Medium, DEV.to)

### Decision

**Selected**: `pgvector/pgvector:pg17`

**Rationale**:
- Official and actively maintained
- PostgreSQL 17 provides latest features and performance
- pgvector pre-installed and tested
- Wide community adoption
- Clear documentation

---

## 2. OpenAI-Compatible Embedding API

### Requirements
- OpenAI-compatible `/v1/embeddings` endpoint
- Support for `sentence-transformers/all-MiniLM-L6-v2` model
- CPU-optimized (no GPU dependency for AIO configuration)
- Lightweight and production-ready
- Docker-based deployment

### Research Findings

#### Embedding Model: all-MiniLM-L6-v2

**Model Characteristics**:
- Source: sentence-transformers (HuggingFace)
- Model size: Only 22MB
- Embedding dimensions: 384
- Performance: Fast on CPU (suitable for single sentences)
- Quality: Good accuracy for semantic search
- Memory footprint: ~1-2GB total with inference server

**Model Page**: https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2

#### Evaluated Solutions

##### 1. Text-Embeddings-Inference (TEI) - HuggingFace

**Description**: Official HuggingFace inference server for text embeddings

**Docker Image**: `ghcr.io/huggingface/text-embeddings-inference:1.8-cpu`

**Features**:
- ✅ OpenAI-compatible `/v1/embeddings` endpoint
- ✅ Supports sentence-transformers models
- ✅ CPU-optimized version available
- ✅ Production-ready and battle-tested
- ✅ Official HuggingFace support
- ✅ Comprehensive documentation
- ✅ Swagger UI at `/docs`

**Docker Configuration**:
```bash
docker run -p 8080:80 \
  -v $PWD/data:/data \
  ghcr.io/huggingface/text-embeddings-inference:1.8-cpu \
  --model-id sentence-transformers/all-MiniLM-L6-v2
```

**API Usage** (OpenAI SDK compatible):
```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key="not-needed"  # TEI doesn't require API key
)

response = client.embeddings.create(
    input="What is Deep Learning?",
    model="text-embeddings-inference"
)
```

**cURL Example**:
```bash
curl http://localhost:8080/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "input": "What is Deep Learning?",
    "model": "text-embeddings-inference",
    "encoding_format": "float"
  }'
```

**Performance**:
- Startup time: 10-20 seconds (model download on first run)
- Inference: Fast on CPU for single requests
- Memory: ~1.5-2GB typical usage
- Concurrent requests: Good throughput with batching

**Sources**:
- GitHub: https://github.com/huggingface/text-embeddings-inference
- Documentation: https://huggingface.co/docs/text-embeddings-inference/
- Docker: ghcr.io registry

##### 2. LocalAI

**Description**: Full OpenAI-compatible server supporting multiple backends

**Features**:
- ✅ OpenAI-compatible API
- ✅ Supports sentence-transformers
- ✅ Multiple model backends
- ⚠️ Heavier weight (includes LLM support)
- ⚠️ More complex configuration

**Assessment**: Overkill for embeddings-only use case

##### 3. Custom FastAPI Solutions

**Description**: Lightweight custom servers using sentence-transformers library

**Features**:
- ✅ Very lightweight (~1.8GB)
- ✅ Simple and customizable
- ⚠️ Requires maintenance
- ⚠️ Not standardized (varies by implementation)
- ⚠️ May not be OpenAI-compatible out of the box

**Assessment**: Good for minimal deployments but less reliable than TEI

### CPU vs GPU Considerations

**MiniLM-L6-v2 on CPU**:
- Model is small enough for efficient CPU inference
- For single sentences, GPU overhead often slower than CPU
- CPU version eliminates GPU dependency
- Suitable for moderate request volumes
- Docker image size smaller without CUDA libraries

**Performance Benchmarks** (from research):
- Single embedding: ~10-50ms on modern CPU
- Batch of 10: ~100-200ms on modern CPU
- Memory: 1-2GB RAM sufficient
- Not recommended: < 2 CPU cores or < 4GB RAM

### Decision

**Selected**: Text-Embeddings-Inference (TEI) v1.8-cpu

**Docker Image**: `ghcr.io/huggingface/text-embeddings-inference:1.8-cpu`

**Model**: `sentence-transformers/all-MiniLM-L6-v2`

**Rationale**:
- Official HuggingFace solution (trusted source)
- Production-ready and well-maintained
- Native OpenAI-compatible API
- CPU-optimized for AIO configuration
- Excellent documentation and community support
- Suitable performance for Scrapegoat use case
- No GPU dependency
- Standard `/v1/embeddings` endpoint works with existing code

---

## 3. Network Configuration Research

### Context

Current Scrapegoat deployment on docs.den.lan uses `network_mode: host` for all services due to Proxmox VE security restrictions encountered with Crawl4AI service.

### Proxmox VE Issues Encountered

**Problem**: Docker containers failed to start with error:
```
failed to create task for container: failed to create shim task:
OCI runtime create failed: unable to start container process:
error during container init: open sysctl net.ipv4.ip_unprivileged_port_start file:
reopen fd 8: permission denied
```

**Root Cause**: Proxmox VE virtualization layer blocks certain sysctl operations required by Docker's default networking (bridge mode).

**Attempted Solutions** (all failed):
1. `cap_add: SYS_ADMIN` ❌
2. `security_opt: seccomp:unconfined` ❌
3. `privileged: true` ❌

**Working Solution**: `network_mode: host` ✅

### Network Mode Implications

#### Host Networking (`network_mode: host`)

**Advantages**:
- ✅ Works in Proxmox VE environment
- ✅ No port mapping required
- ✅ Lower network latency
- ✅ Simpler for Crawl4AI (Playwright/Chromium)

**Disadvantages**:
- ⚠️ Services must use different ports (cannot have conflicts)
- ⚠️ Exposes all ports on host
- ⚠️ Less isolated from host network
- ⚠️ Cannot use Docker DNS for service discovery

#### Bridge Networking (Default)

**Advantages**:
- ✅ Network isolation
- ✅ Docker DNS for service names
- ✅ Port mapping flexibility
- ✅ Better security isolation

**Disadvantages**:
- ❌ Fails on Proxmox VE (sysctl restrictions)
- ❌ Crawl4AI requires additional configuration

### Deployment Strategy

#### For Proxmox VE Environments
- Use `network_mode: host` for all services
- Services communicate via `localhost`
- PostgreSQL on 5432
- Embeddings on 8082
- Worker on 8080
- MCP on 6280
- Web on 6281
- Crawl4AI on 8001

#### For Standard Docker Hosts
- Can use bridge networking if preferred
- Docker Compose creates dedicated network
- Services communicate via service names
- Port mapping to host as needed

### Decision

**BYO Configuration**: Use `network_mode: host` for Proxmox compatibility

**AIO Configuration**: Use `network_mode: host` for Proxmox compatibility

**Rationale**:
- Proven to work on existing deployment (docs.den.lan)
- Avoids Proxmox VE sysctl issues
- Simpler service communication (localhost)
- Necessary for Crawl4AI with Playwright/Chromium
- Can document bridge mode as alternative for non-Proxmox environments

---

## 4. Additional Research

### Crawl4AI Configuration

**Current Implementation**:
- Custom Docker image built from `services/crawl4ai/Dockerfile`
- Based on Python 3.11 with Playwright and Chromium
- Requires `shm_size: 2gb` for Chromium shared memory
- Requires `privileged: true` on Proxmox VE
- Uses `network_mode: host`

**No Changes Required**: Current configuration working in production

### Volume Management

**Research Findings**:
- Named volumes preferred for data persistence
- PostgreSQL data: `/var/lib/postgresql/data`
- TEI model cache: `/data`
- Scrapegoat data: `/data` (configurable via DOCS_MCP_STORE_PATH)

**Strategy**:
- Use named volumes for critical data (database)
- Optional bind mounts for easy access (screenshots, logs)
- Document backup procedures

### Health Checks

**PostgreSQL**:
```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U scrapegoat"]
  interval: 10s
  timeout: 5s
  retries: 5
```

**Text-Embeddings-Inference**:
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:80/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 30s
```

**Scrapegoat Services**: Already implemented (node.js socket connection test)

---

## 5. Resource Requirements

### Minimum Requirements (AIO)

| Component | CPU | Memory | Storage |
|-----------|-----|--------|---------|
| PostgreSQL | 0.5 cores | 512MB | 5GB+ |
| TEI Embeddings | 1 core | 2GB | 1GB |
| Worker | 1 core | 2GB | - |
| MCP | 0.25 cores | 256MB | - |
| Web | 0.25 cores | 256MB | - |
| Crawl4AI | 1 core | 2GB | 1GB |
| **Total** | **3-4 cores** | **7-8GB** | **10GB+** |

### Recommended Requirements (AIO)

| Component | CPU | Memory | Storage |
|-----------|-----|--------|---------|
| PostgreSQL | 1 core | 2GB | 20GB+ |
| TEI Embeddings | 2 cores | 2GB | 2GB |
| Worker | 2 cores | 2GB | - |
| MCP | 0.5 cores | 512MB | - |
| Web | 0.5 cores | 512MB | - |
| Crawl4AI | 2 cores | 2GB | 2GB |
| **Total** | **8 cores** | **9-10GB** | **25GB+** |

### BYO Requirements

Significantly lower as PostgreSQL and embeddings are external:

| Component | CPU | Memory | Storage |
|-----------|-----|--------|---------|
| Worker | 2 cores | 2GB | 5GB+ |
| MCP | 0.5 cores | 512MB | - |
| Web | 0.5 cores | 512MB | - |
| Crawl4AI | 2 cores | 2GB | 2GB |
| **Total** | **5 cores** | **5-6GB** | **10GB+** |

---

## 6. Security Considerations

### PostgreSQL
- Use strong passwords (environment variables)
- Not exposed to external network in AIO (host mode but localhost only)
- Regular backups recommended
- Consider encryption at rest for sensitive data

### Embedding API
- No authentication required by default (internal service)
- Not exposed externally in AIO configuration
- Firewall rules recommended for host mode

### Crawl4AI
- Runs privileged mode (Proxmox requirement)
- Access to browser and system resources
- Internal service only (localhost)

### General
- Use `.env` files for sensitive configuration
- Never commit `.env` to version control
- Rotate credentials regularly
- Monitor resource usage for anomalies

---

## 7. Research Sources

### PostgreSQL + pgvector
1. GitHub pgvector repository: https://github.com/pgvector/pgvector
2. Docker Hub: Various community guides
3. Medium articles on pgvector Docker setup
4. DEV.to tutorials on PostgreSQL with pgvector
5. Stack Overflow discussions

### Text-Embeddings-Inference
1. HuggingFace official documentation: https://huggingface.co/docs/text-embeddings-inference/
2. GitHub repository: https://github.com/huggingface/text-embeddings-inference
3. HuggingFace model page for all-MiniLM-L6-v2
4. Medium articles on TEI deployment
5. LangChain documentation on TEI integration

### Network Configuration
1. Existing Scrapegoat deployment (docs.den.lan)
2. OpenMemory records of Proxmox issues
3. Docker networking documentation
4. Proxmox VE security discussions

---

## 8. Conclusion

Research identified suitable technologies for both BYO and AIO Docker deployments:

**PostgreSQL with pgvector**: `pgvector/pgvector:pg17`
- Official, production-ready, well-documented

**Embedding API**: Text-Embeddings-Inference v1.8-cpu
- OpenAI-compatible, CPU-optimized, HuggingFace official

**Network Mode**: Host networking
- Required for Proxmox VE compatibility
- Simpler service communication

All components researched and validated. Ready to proceed with architecture design and Docker Compose configuration development.

*Research completed: 2025-11-09*
