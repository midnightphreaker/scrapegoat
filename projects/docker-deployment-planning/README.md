# Scrapegoat Docker Deployment Planning

**Project**: Scrapegoat Documentation Scraping and Indexing Service
**Planning Date**: 2025-11-09
**Status**: Planning Phase Complete

## Overview

This planning package contains comprehensive research, architecture designs, and deployment configurations for deploying Scrapegoat using Docker Compose. Two deployment configurations are provided:

1. **BYO (Bring Your Own)**: For users with existing PostgreSQL and embedding API infrastructure
2. **AIO (All-In-One)**: Complete self-contained deployment with all dependencies

## Contents

### Research (`research/`)
- `technology-research.md` - Comprehensive technology stack research and decisions
- `deployment-considerations.md` - Deployment-specific considerations and constraints

### Architecture (`architecture/`)
- `byo-architecture.md` - BYO configuration architecture and service interactions
- `aio-architecture.md` - AIO configuration architecture and service interactions
- `network-topology.md` - Network configuration and communication patterns
- `architecture-decisions.md` - Architecture Decision Records (ADRs)

### Configurations (`configurations/`)
- `docker-compose.byo.yml` - BYO Docker Compose configuration
- `docker-compose.aio.yml` - AIO Docker Compose configuration
- `.env.byo.example` - BYO environment variable template
- `.env.aio.example` - AIO environment variable template

### Documentation (`documentation/`)
- `deployment-guide-byo.md` - Step-by-step BYO deployment instructions
- `deployment-guide-aio.md` - Step-by-step AIO deployment instructions
- `environment-variables.md` - Complete environment variable reference
- `troubleshooting.md` - Common issues and solutions
- `migration-guide.md` - Migrating from systemd to Docker deployment

## Quick Start

### BYO Configuration
For users with existing PostgreSQL and embedding API services:
```bash
cp configurations/.env.byo.example .env
# Edit .env with your database and API endpoints
docker compose -f configurations/docker-compose.byo.yml up -d
```

### AIO Configuration
For complete self-contained deployment:
```bash
cp configurations/.env.aio.example .env
# Edit .env with desired passwords and settings
docker compose -f configurations/docker-compose.aio.yml up -d
```

## Key Features

### BYO Configuration
- Minimal infrastructure requirements
- Uses existing PostgreSQL database
- Uses existing embedding API endpoint
- Includes: Scrapegoat services (worker, mcp, web) + Crawl4AI
- Network mode: host (Proxmox compatible)

### AIO Configuration
- Complete self-contained deployment
- Internal PostgreSQL 17 with pgvector extension
- Internal embedding API using Text-Embeddings-Inference (CPU)
- Includes: All services + database + embedding API
- Zero external dependencies
- Production-ready configuration

## Technology Stack

| Component | Technology | Version/Image |
|-----------|-----------|---------------|
| **Scrapegoat** | Node.js 22 | Custom build (git.fenrirsden.org/pub/scrapegoat:latest) |
| **Database (AIO)** | PostgreSQL + pgvector | pgvector/pgvector:pg17 |
| **Embeddings (AIO)** | Text-Embeddings-Inference | ghcr.io/huggingface/text-embeddings-inference:1.8-cpu |
| **Web Crawler** | Crawl4AI + Playwright | Custom build (services/crawl4ai) |

## Service Ports

| Service | Port | Description |
|---------|------|-------------|
| Worker API | 8080 | Documentation processing API |
| MCP Server | 6280 | Model Context Protocol endpoint |
| Web UI | 6281 | Web management interface |
| Crawl4AI | 8001 | AI-optimized web crawling service |
| PostgreSQL (AIO) | 5432 | Database server (internal only) |
| Embeddings (AIO) | 8082 | OpenAI-compatible embedding API (internal only) |

## Architecture Highlights

### Service Dependencies
```
PostgreSQL (AIO) → Worker → MCP/Web
Embeddings (AIO) → Worker
Crawl4AI → Worker (optional, via CRAWL4AI_ENABLED flag)
```

### Data Flow
1. Web UI or MCP triggers scraping job
2. Worker processes documentation using selected fetcher
3. Crawl4AI provides AI-optimized content extraction (if enabled)
4. Content chunked and embedded via embedding API
5. Vectors stored in PostgreSQL with pgvector
6. Semantic search available via MCP tools

## Next Steps

1. Review architecture documents in `architecture/`
2. Choose deployment configuration (BYO or AIO)
3. Follow deployment guide in `documentation/`
4. Configure environment variables
5. Deploy using Docker Compose
6. Verify all services are healthy
7. Test functionality

## Documentation Structure

```
docker-deployment-planning/
├── README.md (this file)
├── research/
│   ├── technology-research.md
│   └── deployment-considerations.md
├── architecture/
│   ├── byo-architecture.md
│   ├── aio-architecture.md
│   ├── network-topology.md
│   └── architecture-decisions.md
├── configurations/
│   ├── docker-compose.byo.yml
│   ├── docker-compose.aio.yml
│   ├── .env.byo.example
│   └── .env.aio.example
└── documentation/
    ├── deployment-guide-byo.md
    ├── deployment-guide-aio.md
    ├── environment-variables.md
    ├── troubleshooting.md
    └── migration-guide.md
```

## Support and Issues

For questions or issues with deployment:
1. Consult `troubleshooting.md`
2. Review architecture decisions in `architecture-decisions.md`
3. Check environment variable configuration in `environment-variables.md`

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2025-11-09 | 1.0 | Initial planning package created |

*Last Updated: 2025-11-09*
