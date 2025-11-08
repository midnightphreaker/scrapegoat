# Docs MCP Server PostgreSQL Fork - Project Planning

## Project Overview

A complete fork of [denmaster/scrapegoat](https://github.com/denmaster/scrapegoat) replacing SQLite/sqlite-vec with PostgreSQL/pgvector for enterprise-grade documentation indexing and search.

**Status**: Planning Complete ✅
**Target Version**: 1.0.0 (Fork)
**Planning Started**: 2025-11-08
**Planning Completed**: 2025-11-08
**Ready for Implementation**: Yes

## Key Changes from Original

- **Complete SQLite Removal**: All SQLite and sqlite-vec dependencies removed
- **PostgreSQL Core**: PostgreSQL with pgvector extension as the only database
- **No Migration Support**: Clean break - users start fresh or manually migrate
- **Simplified Architecture**: Single database implementation, no abstraction layer
- **Enterprise Focus**: Optimized for production deployments with scaling capabilities

## Planning Documentation

### Requirements
- [Functional Requirements](requirements/functional-requirements.md) - What the system must do
- [Non-Functional Requirements](requirements/non-functional-requirements.md) - Performance, scalability, etc.
- [User Stories](requirements/user-stories.md) - User-centric feature descriptions

### Research
- [Technology Research](research/technology-research.md) - PostgreSQL, pgvector, client libraries
- [Architecture Patterns](research/architecture-patterns.md) - Pattern research and selection
- [Similar Projects](research/similar-projects.md) - Case studies and learning
- [Tools & Libraries](research/tools-libraries.md) - Specific tools and library research

### Architecture
- [System Architecture](architecture/system-architecture.md) - High-level system design
- [Component Design](architecture/component-design.md) - Detailed component breakdown
- [Data Models](architecture/data-models.md) - PostgreSQL schemas and indexes
- [Integration Points](architecture/integration-points.md) - External systems and APIs
- [Architecture Decisions](architecture/architecture-decisions.md) - ADRs

### Planning
- [Project Phases](planning/project-phases.md) - Major phases and milestones
- [Sprint Breakdown](planning/sprint-breakdown.md) - Detailed task breakdown
- [Dependencies](planning/dependencies.md) - Task and tech dependencies
- [Timeline Estimates](planning/timeline-estimates.md) - Time estimates and schedule
- [Resource Requirements](planning/resource-requirements.md) - Skills, tools, budget needed

### Risks
- [Risk Assessment](risks/risk-assessment.md) - Identified risks and mitigation
- [Technical Challenges](risks/technical-challenges.md) - Known technical hurdles
- [Contingency Plans](risks/contingency-plans.md) - Backup approaches

### Documentation
- [Getting Started](documentation/getting-started.md) - Initial setup guide
- [Development Guide](documentation/development-guide.md) - Development practices
- [Deployment Guide](documentation/deployment-guide.md) - Deployment strategy
- [Maintenance Plan](documentation/maintenance-plan.md) - Post-launch considerations

## Quick Links

- Original Repository: https://github.com/denmaster/scrapegoat
- PostgreSQL Documentation: https://www.postgresql.org/docs/
- pgvector Documentation: https://github.com/pgvector/pgvector
- MCP Protocol: https://modelcontextprotocol.io/

## Executive Summary

### Project Overview
Complete fork of denmaster/scrapegoat replacing SQLite/sqlite-vec with PostgreSQL/pgvector. Targets enterprise users requiring production-grade scalability, concurrent access, and advanced vector search capabilities.

### Key Decisions
- **Complete SQLite Removal**: No dual-database support, clean break (ADR-001)
- **User-Provided PostgreSQL**: Users bring their own PostgreSQL, application initializes schema (ADR-002)
- **HNSW Vector Indexes**: Default to HNSW for superior query performance (ADR-003)
- **node-postgres Client**: Industry-standard pg library for reliability (ADR-004)
- **Single Container Default**: Unified deployment with scale-out documentation (ADR-006)
- **Automatic Initialization**: Database schema created automatically on startup (ADR-007)

### Timeline
- **Total Duration**: 9 weeks (45 working days)
- **Effort**: 1 full-time senior developer
- **With Buffer**: 10-11 weeks recommended
- **Critical Phases**: Storage Layer (2 weeks), Testing (1 week)

### Success Criteria
- ✅ Complete SQLite removal
- ✅ Feature parity with original (MCP tools, Web UI, CLI)
- ✅ Vector search performance ≥2x faster than original @ 100K docs
- ✅ Support 50+ concurrent users
- ✅ Comprehensive documentation
- ✅ 80%+ test coverage
- ✅ Production-ready release

### Next Steps
1. Review and approve planning documents
2. Fork repository and create `postgres-fork` branch
3. Begin Phase 1: Foundation & Setup
4. Follow 9-week implementation plan

## Document Update Log

| Date | Document | Change |
|------|----------|--------|
| 2025-11-08 | All | Initial planning structure created |
| 2025-11-08 | All | Complete planning documentation finished |

---

*Last Updated: 2025-11-08*
