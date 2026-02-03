# Scrapegoat Docker Compose BYO Deployment Plan

**Project**: Scrapegoat MCP Server - Docker Compose BYO Deployment
**Target Environment**: docs.den.lan (10.1.1.27)
**Configuration**: BYO (Bring Your Own) - External PostgreSQL and Embedding Service
**Planning Date**: 2025-11-10
**Status**: READY FOR EXECUTION

---

## Executive Summary

This is a comprehensive deployment plan for deploying Scrapegoat MCP Server using Docker Compose BYO configuration on docs.den.lan. The deployment uses external PostgreSQL (postgres.den.lan) and embedding services (embed.den.lan), deploying only the Scrapegoat application services in Docker containers.

**Deployment Type**: Fresh installation (previous deployment completely removed)

### Key Infrastructure

| Component | Server | IP | Details |
|-----------|--------|-----|---------|
| Application | docs.den.lan | 10.1.1.27 | Docker Compose deployment target |
| Database | postgres.den.lan | 10.1.1.15 | PostgreSQL with pgvector extension |
| Embeddings | embed.den.lan | 10.1.1.61 | OpenAI-compatible embedding API |

### Services to Deploy

1. **scrapegoat-worker** (Port 8080) - Documentation processing and API
2. **scrapegoat-mcp** (Port 6280) - Model Context Protocol server
3. **scrapegoat-web** (Port 80) - Web management interface
4. **scrapegoat-crawl4ai** (Port 8001) - AI-optimized web crawler (optional)

---

## Quick Navigation

### Planning Documents
- **[Deployment Phases](planning/deployment-phases.md)** - Complete phase-by-phase deployment plan
- **[Execution Checklist](planning/execution-checklist.md)** - Step-by-step execution guide
- **[Risk Assessment](risks/risk-assessment.md)** - Identified risks and mitigation strategies

### Configuration
- **[Configuration Reference](documentation/configuration-reference.md)** - All environment variables and settings
- **[Validation Procedures](documentation/validation-procedures.md)** - Testing and verification steps

### Technical Details
- **[Infrastructure Overview](architecture/infrastructure-overview.md)** - Architecture and service dependencies
- **[Database Setup](documentation/database-setup.md)** - PostgreSQL initialization procedures

---

## Deployment Overview

### Prerequisites Verified
- Clean slate: Previous scrapegoat installation removed
- Docker and Docker Compose available on docs.den.lan
- PostgreSQL 18.0 available on postgres.den.lan with pgvector
- Embedding service available on embed.den.lan
- Network connectivity between all servers

### Deployment Approach
1. **Phase 1**: Pre-deployment verification (15 min)
2. **Phase 2**: Database initialization (10 min)
3. **Phase 3**: File deployment and configuration (10 min)
4. **Phase 4**: Service startup (5 min)
5. **Phase 5**: Validation and testing (15 min)
6. **Phase 6**: Post-deployment tasks (10 min)

**Total Estimated Time**: 65 minutes

---

## Key Configuration Values

### Database Configuration
```bash
Database Host: postgres.den.lan
Database Port: 5432
Database Name: scrapegoat
Database User: scrapegoat_user
Database Password: [Generated during deployment]
```

### Embedding Service Configuration
```bash
Service URL: http://embed.den.lan
API Endpoint: http://embed.den.lan/v1
Model: nomic-ai/nomic-embed-text-v1.5
API Key: not-required
```

### Service Ports
```bash
Worker API: 8080
MCP Server: 6280
Web Interface: 80
Crawl4AI: 8001 (optional)
```

---

## Critical Success Factors

1. **Database Preparation**
   - Clean PostgreSQL database with pgvector extension enabled
   - Proper user permissions and access controls
   - Database accessible from docs.den.lan

2. **Network Configuration**
   - Host networking mode for Proxmox compatibility
   - All required ports available
   - Connectivity to external services verified

3. **Service Dependencies**
   - Worker service must be healthy before MCP/Web start
   - Database must be accessible before worker starts
   - Embedding service must be accessible for vector operations

4. **Data Persistence**
   - Named Docker volume for application data
   - Database persistence on postgres.den.lan
   - Proper backup strategy in place

---

## Risk Mitigation

### Identified Risks
1. **Port Conflicts**: Verify no services running on required ports
2. **Database Connectivity**: Test connection before deployment
3. **Docker Image Availability**: Verify gitlab.fenrirsden.org/pub/scrapegoat:latest is accessible
4. **Service Startup Order**: Docker Compose handles with depends_on and health checks

### Mitigation Strategies
- Pre-deployment verification phase catches issues early
- Comprehensive health checks ensure proper startup
- Rollback procedure documented for quick recovery
- Step-by-step validation ensures each phase succeeds

---

## Getting Started

### For Quick Execution
1. Review **[Execution Checklist](planning/execution-checklist.md)**
2. Follow step-by-step instructions
3. Validate each phase before proceeding

### For Detailed Understanding
1. Start with **[Deployment Phases](planning/deployment-phases.md)**
2. Review **[Configuration Reference](documentation/configuration-reference.md)**
3. Understand **[Risk Assessment](risks/risk-assessment.md)**
4. Then proceed with execution

---

## Post-Deployment

After successful deployment:
1. **Access Web Interface**: http://docs.den.lan
2. **Test Document Indexing**: Add a test library
3. **Monitor Logs**: `docker compose logs -f`
4. **Set Up Backups**: Database backup procedures
5. **Document Configuration**: Save .env and configurations

---

## Support and Documentation

### Internal Documentation
- Source Repository: /home/mp/Workspace/scrapegoat
- Docker Compose File: projects/docker-deployment-planning/configurations/docker-compose.byo.yml
- Environment Template: .env.byo.example

### Key Resources
- Scrapegoat Documentation: docs/ directory
- Docker Deployment Planning: projects/docker-deployment-planning/
- PostgreSQL Setup Guide: docs/POSTGRESQL_SETUP.md

---

## Version History

| Date | Version | Status | Notes |
|------|---------|--------|-------|
| 2025-11-10 | 1.0 | Planning Complete | Ready for execution |

---

**NEXT STEP**: Review [Deployment Phases](planning/deployment-phases.md) for detailed execution plan.

*Last Updated: 2025-11-10*
