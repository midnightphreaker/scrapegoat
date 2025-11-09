# Architecture Decision Records (ADRs)

## Overview

This document captures all significant architectural decisions made during the planning of Scrapegoat Docker deployment configurations.

---

## ADR-001: Use pgvector/pgvector:pg17 for PostgreSQL

**Date**: 2025-11-09
**Status**: Accepted

### Context

Need a PostgreSQL database with vector similarity search capabilities for storing and querying document embeddings. Multiple Docker images available with pgvector extension.

### Decision

Use `pgvector/pgvector:pg17` as the official PostgreSQL + pgvector image for AIO configuration.

### Rationale

**Why pgvector/pgvector:pg17:**
- Official image from pgvector project maintainers
- PostgreSQL 17 includes latest features and performance improvements
- pgvector extension pre-installed and pre-configured
- Regular updates and security patches
- Wide community adoption and documentation
- Proven in production environments

**Alternatives Considered:**
1. `ankane/pgvector` - Less certain update schedule
2. Custom Dockerfile with manual pgvector installation - More maintenance burden

### Consequences

**Positive:**
- Reliable, maintained image
- Automatic pgvector updates with image updates
- Standard PostgreSQL configuration
- Good documentation and community support

**Negative:**
- Tied to pgvector project release schedule
- PostgreSQL 17 may have compatibility concerns (minimal risk)

### Related Decisions
- ADR-003: Database connection configuration
- ADR-006: Data persistence strategy

---

## ADR-002: Use Text-Embeddings-Inference for Embedding API

**Date**: 2025-11-09
**Status**: Accepted

### Context

AIO configuration requires self-hosted OpenAI-compatible embedding API. Need CPU-optimized solution using sentence-transformers/all-MiniLM-L6-v2 model.

### Decision

Use HuggingFace Text-Embeddings-Inference (TEI) v1.8-cpu with all-MiniLM-L6-v2 model as the embedding service.

### Rationale

**Why TEI:**
- Official HuggingFace inference server (trusted source)
- Native OpenAI-compatible `/v1/embeddings` endpoint
- CPU-optimized build available (no GPU dependency)
- Production-ready with battle-tested reliability
- Excellent documentation and Swagger UI
- Supports exact model required (all-MiniLM-L6-v2)
- Standard API compatible with existing Scrapegoat code

**Why all-MiniLM-L6-v2:**
- Small model size (22MB)
- Fast CPU inference
- Good accuracy for semantic search
- 384-dimensional embeddings (efficient storage)
- Well-supported by sentence-transformers ecosystem

**Alternatives Considered:**
1. **LocalAI**: Full-featured but heavier, includes LLM support (overkill)
2. **Custom FastAPI**: Lightweight but requires maintenance, not standardized
3. **Ollama**: Better for LLMs than dedicated embeddings
4. **External API**: Would violate AIO self-contained principle

### Consequences

**Positive:**
- Zero external dependencies for embeddings
- OpenAI SDK compatibility
- CPU-only operation (no GPU required)
- Professional-grade reliability
- Easy to upgrade and maintain

**Negative:**
- ~2GB memory overhead
- Model download on first startup (~22MB)
- Limited to HuggingFace-supported models
- Overkill if only embedding single documents

### Related Decisions
- ADR-004: Network configuration for internal services
- ADR-007: Resource allocation

---

## ADR-003: Use Host Network Mode for Proxmox Compatibility

**Date**: 2025-11-09
**Status**: Accepted

### Context

Existing deployment on docs.den.lan (Proxmox VE) encountered Docker networking failures with bridge mode. Crawl4AI service requires specific network configuration for Playwright/Chromium.

### Problem

Docker containers failed with error in Proxmox VE:
```
OCI runtime create failed: unable to start container process:
error during container init: open sysctl net.ipv4.ip_unprivileged_port_start file:
reopen fd 8: permission denied
```

Attempted solutions failed:
- `cap_add: SYS_ADMIN` ❌
- `security_opt: seccomp:unconfined` ❌
- `privileged: true` ❌

### Decision

Use `network_mode: host` for all services in both BYO and AIO configurations.

### Rationale

**Why Host Mode:**
- **Proven**: Working in production on docs.den.lan
- **Proxmox Compatible**: Bypasses VE security restrictions
- **Crawl4AI Requirement**: Playwright/Chromium works reliably
- **Simpler Communication**: Services use localhost
- **Performance**: Lower network latency

**Why for All Services:**
- Consistent networking across all containers
- Simplified configuration
- No service-to-service networking issues
- Same behavior in development and production

### Consequences

**Positive:**
- Works in Proxmox VE environments
- No complex network debugging required
- Proven in production
- Simple localhost communication

**Negative:**
- Port conflicts must be avoided (services on different ports)
- All services exposed on host (use localhost binding where possible)
- No Docker DNS service discovery
- Cannot use default Docker networking features
- Less network isolation

**Port Allocation:**
- PostgreSQL: 5432 (internal only)
- Embeddings: 8082 (internal only)
- Worker: 8080
- MCP: 6280
- Web: 6281
- Crawl4AI: 8001

### Migration Path

For non-Proxmox deployments, bridge networking can be enabled with these changes:
1. Remove `network_mode: host`
2. Add `networks:` section
3. Use service names instead of localhost
4. Add port mappings

### Related Decisions
- ADR-008: Crawl4AI configuration
- ADR-005: Service communication patterns

---

## ADR-004: Separate BYO and AIO Configurations

**Date**: 2025-11-09
**Status**: Accepted

### Context

Different user scenarios require different levels of infrastructure. Some users have existing PostgreSQL and embedding APIs, others need complete self-contained deployment.

### Decision

Create two distinct Docker Compose configurations:
1. **BYO (Bring Your Own)**: Assumes external PostgreSQL and embedding API
2. **AIO (All-In-One)**: Includes all dependencies

### Rationale

**Why Two Configurations:**
- Different user needs and infrastructure scenarios
- BYO reduces resource overhead for users with existing services
- AIO provides zero-dependency deployment option
- Clearer separation of concerns
- Easier to understand and maintain

**BYO Use Cases:**
- Organizations with existing database infrastructure
- Multi-tenant PostgreSQL deployments
- Shared embedding API services
- Cloud-managed databases (RDS, Cloud SQL, etc.)
- Minimal resource footprint

**AIO Use Cases:**
- Quick start and evaluation
- Self-contained deployments
- Edge deployments without external dependencies
- Complete isolation
- Simplified operations

### Consequences

**Positive:**
- Flexibility for different deployment scenarios
- Optimized resource usage (BYO)
- Self-contained simplicity (AIO)
- Clear documentation per configuration
- Users choose what fits their needs

**Negative:**
- Two configurations to maintain
- Duplicate documentation
- Potential confusion about which to use
- Testing requires both configurations

**Mitigation:**
- Clear README with decision flowchart
- Shared base configuration where possible
- Comprehensive documentation per config

### Related Decisions
- ADR-001: PostgreSQL selection (AIO only)
- ADR-002: Embedding API selection (AIO only)

---

## ADR-005: Use Environment Variables for All Configuration

**Date**: 2025-11-09
**Status**: Accepted

### Context

Docker deployments require flexible configuration for different environments (development, staging, production) and user-specific settings.

### Decision

Use `.env` files for all environment-specific configuration with separate example files:
- `.env.byo.example` for BYO configuration template
- `.env.aio.example` for AIO configuration template

### Rationale

**Why .env Files:**
- Standard Docker Compose practice
- Separates configuration from code
- Easy to customize per environment
- Git-ignored by default (security)
- Single source of truth for settings

**Required Variables:**

**BYO Configuration:**
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_BASE`: Embedding API endpoint
- `OPENAI_API_KEY`: API key if required
- `CRAWL4AI_ENABLED`: Enable/disable Crawl4AI
- `CRAWL4AI_SERVICE_URL`: Crawl4AI endpoint

**AIO Configuration:**
- `POSTGRES_USER`: Database user
- `POSTGRES_PASSWORD`: Database password
- `POSTGRES_DB`: Database name
- Internal services auto-configured
- `CRAWL4AI_ENABLED`: Enable/disable Crawl4AI

### Consequences

**Positive:**
- Flexible and secure configuration
- Easy environment switching
- Standard practice well-understood
- Secrets not in version control

**Negative:**
- Users must create .env file
- Potential for misconfiguration
- Documentation must be clear

**Mitigation:**
- Provide comprehensive .example files
- Document all variables
- Include validation in startup scripts

### Related Decisions
- ADR-009: Security practices

---

## ADR-006: Use Named Volumes for Data Persistence

**Date**: 2025-11-09
**Status**: Accepted

### Context

Critical data (database, embeddings, scraped content) must persist across container restarts and updates.

### Decision

Use Docker named volumes for all persistent data:
- `scrapegoat-postgres-data` - PostgreSQL data (AIO)
- `scrapegoat-embeddings-cache` - TEI model cache (AIO)
- `scrapegoat-data` - Scrapegoat application data (both)

### Rationale

**Why Named Volumes:**
- Docker-managed lifecycle
- Portable across environments
- Better performance than bind mounts
- Easy backup/restore procedures
- Survives container removal

**Volume Mapping:**

**AIO Configuration:**
```yaml
volumes:
  scrapegoat-postgres-data:
    name: scrapegoat-postgres-data
  scrapegoat-embeddings-cache:
    name: scrapegoat-embeddings-cache
  scrapegoat-data:
    name: scrapegoat-data
```

**BYO Configuration:**
```yaml
volumes:
  scrapegoat-data:
    name: scrapegoat-data
```

### Consequences

**Positive:**
- Data safety across updates
- Standard Docker practice
- Easy backup with docker volume commands
- Clear data ownership

**Negative:**
- Volumes not visible in filesystem by default
- Requires docker volume commands for access
- Can accumulate if not cleaned up

**Backup Strategy:**
```bash
# Backup PostgreSQL
docker exec scrapegoat-postgres pg_dump -U scrapegoat scrapegoat > backup.sql

# Backup volume
docker run --rm -v scrapegoat-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/scrapegoat-data.tar.gz /data
```

### Related Decisions
- ADR-001: PostgreSQL configuration
- ADR-010: Backup and recovery procedures

---

## ADR-007: Set Conservative Resource Limits

**Date**: 2025-11-09
**Status**: Accepted

### Context

Docker services can consume unbounded resources leading to host instability. Need to protect host system while ensuring service functionality.

### Decision

Set explicit memory limits for all services with reservations:

**AIO Configuration:**
```yaml
worker:
  deploy:
    resources:
      limits:
        memory: 2G
      reservations:
        memory: 1G

postgres:
  deploy:
    resources:
      limits:
        memory: 2G
      reservations:
        memory: 512M

embeddings:
  deploy:
    resources:
      limits:
        memory: 2G
      reservations:
        memory: 1G

crawl4ai:
  deploy:
    resources:
      limits:
        memory: 2G
      reservations:
        memory: 1G
```

### Rationale

**Why Resource Limits:**
- Prevent resource exhaustion
- Ensure fair resource allocation
- Protect host system stability
- Predictable performance
- Easier capacity planning

**Limit Selection:**
- Based on observed usage patterns
- Conservative but functional
- Allow headroom for spikes
- Prevent OOM killer

**No CPU Limits:**
- Allow services to use available CPU
- CPU is easily shared resource
- Memory is harder limit

### Consequences

**Positive:**
- System stability
- Predictable performance
- Protection from runaway processes
- Clear resource requirements for deployment

**Negative:**
- May need tuning for specific workloads
- Could limit performance if too restrictive
- Requires monitoring to optimize

**Monitoring Recommendations:**
```bash
docker stats
```

Adjust limits based on actual usage.

### Related Decisions
- ADR-002: TEI resource requirements

---

## ADR-008: Keep Crawl4AI Configuration Unchanged

**Date**: 2025-11-09
**Status**: Accepted

### Context

Crawl4AI service currently working in production with specific configuration required for Proxmox VE environment.

### Decision

Maintain existing Crawl4AI Docker configuration:
```yaml
crawl4ai:
  build:
    context: ./services/crawl4ai
    dockerfile: Dockerfile
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
  shm_size: 2gb
  privileged: true
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s
```

### Rationale

**Why Unchanged:**
- Currently working in production
- Proven configuration on Proxmox VE
- Playwright/Chromium requirements met
- `shm_size: 2gb` required for Chromium
- `privileged: true` required for Proxmox
- `network_mode: host` required for networking

**Critical Settings:**
- `shm_size: 2gb`: Chromium shared memory
- `privileged: true`: Proxmox sysctl access
- `network_mode: host`: Networking compatibility

### Consequences

**Positive:**
- No risk of breaking working service
- Proven reliability
- Documented requirements

**Negative:**
- Requires privileged mode (security concern)
- Host networking required
- Resource intensive (2GB shm + 2GB memory limit)

**Security Note:**
Privileged mode required for Proxmox VE only. Standard Docker environments may work without it, but not tested.

### Related Decisions
- ADR-003: Host networking decision

---

## ADR-009: Implement Health Checks for All Services

**Date**: 2025-11-09
**Status**: Accepted

### Context

Docker Compose service dependencies require health checks to ensure services start in correct order and are actually ready.

### Decision

Implement health checks for all services:

**PostgreSQL:**
```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U scrapegoat -d scrapegoat"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 10s
```

**Text-Embeddings-Inference:**
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:80/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 60s  # Allow time for model download
```

**Worker (existing):**
```yaml
healthcheck:
  test: 'node -e ''require("net").connect(8080, "127.0.0.1")...'''
  interval: 5s
  timeout: 3s
  retries: 10
  start_period: 10s
```

**Crawl4AI (existing):**
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### Rationale

**Why Health Checks:**
- Ensure service readiness before dependencies start
- Automatic restart if service becomes unhealthy
- Better orchestration with `depends_on` conditions
- Monitoring integration (Docker status)

**Why Different Intervals:**
- Critical services (DB, Worker): Shorter intervals (5-10s)
- Resource-intensive checks (TEI): Longer intervals (30s)
- Start periods allow initialization time

### Consequences

**Positive:**
- Reliable service orchestration
- Automatic failure detection
- Better startup reliability
- Health status visibility

**Negative:**
- Additional resource overhead (health check processes)
- May delay startup if checks too strict
- Requires careful tuning

### Related Decisions
- ADR-010: Service dependency order

---

## ADR-010: Define Explicit Service Dependencies

**Date**: 2025-11-09
**Status**: Accepted

### Context

Services have dependencies that must be respected during startup and shutdown. Worker needs database and embeddings, MCP/Web need Worker.

### Decision

Use `depends_on` with health check conditions:

**AIO Configuration:**
```yaml
worker:
  depends_on:
    postgres:
      condition: service_healthy
    embeddings:
      condition: service_healthy

mcp:
  depends_on:
    worker:
      condition: service_healthy

web:
  depends_on:
    worker:
      condition: service_healthy
```

**Crawl4AI:**
- Optional dependency (enabled via env var)
- Worker can start without it
- Falls back to other fetchers if unavailable

### Rationale

**Why Explicit Dependencies:**
- Correct startup order
- Wait for service readiness (not just start)
- Prevent connection errors during initialization
- Clear architecture documentation

**Dependency Chain:**
```
PostgreSQL ─┐
            ├─→ Worker ─┬─→ MCP
Embeddings ─┘           └─→ Web

Crawl4AI (optional) ──→ Worker
```

### Consequences

**Positive:**
- Reliable startup sequence
- No race conditions
- Clear service relationships
- Graceful failure handling

**Negative:**
- Slower startup (sequential)
- Cascading failures possible
- Requires all dependencies healthy

**Startup Time:**
- PostgreSQL: ~5s
- Embeddings: ~30-60s (model download first time)
- Worker: ~10s after dependencies
- MCP/Web: ~5s after worker
- **Total**: ~60-90s (first run), ~20-30s (subsequent)

### Related Decisions
- ADR-009: Health check implementation

---

## Summary of Decisions

| ADR | Decision | Status | Impact |
|-----|----------|--------|--------|
| ADR-001 | pgvector/pgvector:pg17 | Accepted | AIO database choice |
| ADR-002 | Text-Embeddings-Inference | Accepted | AIO embedding API |
| ADR-003 | Host network mode | Accepted | Proxmox compatibility |
| ADR-004 | Separate BYO/AIO configs | Accepted | Deployment flexibility |
| ADR-005 | Environment variable config | Accepted | Configuration management |
| ADR-006 | Named volumes | Accepted | Data persistence |
| ADR-007 | Resource limits | Accepted | System stability |
| ADR-008 | Crawl4AI unchanged | Accepted | Production stability |
| ADR-009 | Health checks | Accepted | Service reliability |
| ADR-010 | Service dependencies | Accepted | Startup orchestration |

---

*Last Updated: 2025-11-09*
