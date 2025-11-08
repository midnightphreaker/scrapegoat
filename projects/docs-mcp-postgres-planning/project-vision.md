# Project Vision: Docs MCP Server PostgreSQL Fork

## Vision Statement

Create an enterprise-grade documentation indexing and semantic search server built on PostgreSQL/pgvector, providing AI coding assistants with reliable, version-aware access to up-to-date official documentation. This fork removes SQLite dependencies entirely, focusing on production deployments that require scalability, concurrent access, and robust vector search capabilities.

## Goals

1. **Enterprise-Ready Database Layer**: Replace SQLite with PostgreSQL/pgvector for production-grade scalability, concurrent access, and advanced vector search capabilities
2. **Simplified Architecture**: Single database implementation without abstraction layers, reducing complexity and maintenance overhead
3. **Performance Optimization**: Leverage PostgreSQL's advanced indexing (HNSW, GIN) and query optimization for superior search performance
4. **Production Focus**: Optimize for Docker deployments, Kubernetes orchestration, and enterprise infrastructure patterns
5. **Clean Codebase**: Remove all SQLite-related code, migrations, and dependencies for a focused PostgreSQL implementation

## Success Criteria

- [ ] Complete removal of SQLite and sqlite-vec dependencies
- [ ] Fully functional PostgreSQL/pgvector implementation with feature parity to original
- [ ] Vector search performance ≥2x faster than original on datasets >10K documents
- [ ] Concurrent access support for 50+ simultaneous users
- [ ] Docker deployment with PostgreSQL container running in <5 minutes
- [ ] Comprehensive documentation for PostgreSQL setup and tuning
- [ ] All original MCP tools and web interface functionality preserved
- [ ] Production-ready error handling and observability
- [ ] Automated database schema migrations
- [ ] Load testing validated at 100K+ documents

## Non-Goals

- **No SQLite Support**: SQLite is completely removed - users must use PostgreSQL
- **No Migration Tooling**: No tools to migrate from original SQLite-based server
- **No Backward Compatibility**: This is a fork, not a drop-in replacement
- **No Embedded Mode**: PostgreSQL requires external database - no embedded/single-file deployment
- **No Multi-Database Support**: PostgreSQL only - no abstraction for other databases

## Target Users

### Primary: Enterprise Development Teams
- Teams building AI-powered applications requiring reliable documentation search
- Organizations with existing PostgreSQL infrastructure
- Companies needing concurrent access and scalability
- DevOps teams managing containerized infrastructure

### Secondary: Individual Developers
- Developers comfortable with PostgreSQL setup and management
- Users requiring advanced vector search capabilities
- Developers building production-grade AI tooling
- Power users needing performance and scalability

### Use Cases
1. **Production AI Assistant Infrastructure**: Teams deploying MCP servers for multiple developers
2. **High-Volume Documentation Indexing**: Indexing large documentation sets (100K+ documents)
3. **Concurrent Multi-User Access**: Supporting teams of 10-100+ developers
4. **Enterprise Integration**: Integrating with existing PostgreSQL-based infrastructure
5. **Advanced Search Requirements**: Requiring sophisticated vector search and full-text capabilities

## Unique Value Proposition

**Enterprise PostgreSQL Power for AI Documentation Search**

While the original scrapegoat targets simplicity with SQLite, this fork targets production deployments requiring:

- **Scalability**: PostgreSQL handles millions of documents with proper indexing
- **Concurrency**: Multiple users querying simultaneously without performance degradation
- **Advanced Search**: pgvector's HNSW indexes provide superior vector search performance
- **Production Features**: Connection pooling, replication, backups, monitoring
- **Infrastructure Integration**: Seamless integration with existing PostgreSQL deployments
- **Performance**: Optimized for large-scale documentation indexing and search

This is not a replacement for the original - it's a specialized fork for users who need PostgreSQL's enterprise capabilities and are willing to manage database infrastructure.

## Key Differentiators from Original

| Aspect | Original (SQLite) | This Fork (PostgreSQL) |
|--------|-------------------|------------------------|
| **Database** | SQLite (embedded) | PostgreSQL (external) |
| **Deployment** | Single file, embedded | Docker, Kubernetes, managed |
| **Concurrency** | Limited (file locking) | High (connection pooling) |
| **Scalability** | ~100K documents | Millions of documents |
| **Setup Complexity** | Zero config | Requires PostgreSQL |
| **Vector Search** | sqlite-vec (basic) | pgvector (advanced HNSW) |
| **Use Case** | Individual developers | Enterprise teams |
| **Infrastructure** | Standalone | Integrated |

## Strategic Positioning

**Complementary, Not Competitive**

This fork serves users with different requirements than the original:
- Original: Simplicity, zero-config, embedded deployment
- Fork: Enterprise features, scalability, production infrastructure

Users should choose based on their needs:
- **Choose Original**: Simple setup, single-user, embedded deployment
- **Choose Fork**: Production deployment, team use, existing PostgreSQL, scalability needs

---

*Last Updated: 2025-11-08*
