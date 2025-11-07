# Scrapegoat Documentation

Comprehensive documentation for Scrapegoat, the PostgreSQL-powered documentation indexing and search system.

## Quick Links

### Getting Started
- [PostgreSQL Setup Guide](./POSTGRESQL_SETUP.md) - Install and configure PostgreSQL with pgvector
- [Migration Guide](./MIGRATION.md) - Migrate from SQLite-based docs-mcp-server
- [Configuration Reference](./CONFIGURATION.md) - Complete environment variable reference

### Operations
- [Deployment Guide](./DEPLOYMENT.md) - Production deployment procedures
- [Performance Tuning](./PERFORMANCE.md) - Optimize indexes, queries, and connection pools
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues and solutions

### Security
- [Security Checklist](./SECURITY_CHECKLIST.md) - Security review and best practices

## Documentation Status

| Document | Status | Purpose |
|----------|--------|---------|
| [MIGRATION.md](./MIGRATION.md) | ✅ Complete | SQLite to PostgreSQL migration guide |
| [POSTGRESQL_SETUP.md](./POSTGRESQL_SETUP.md) | 🚧 Coming in Phase 5.2 | Database installation and setup |
| [CONFIGURATION.md](./CONFIGURATION.md) | 🚧 Coming in Phase 5.2 | Environment variables and settings |
| [PERFORMANCE.md](./PERFORMANCE.md) | 🚧 Coming in Phase 5.3 | Performance tuning and optimization |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | 🚧 Coming in Phase 5.3 | Common issues and solutions |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | 🚧 Coming in Phase 5.4 | Production deployment guide |
| [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md) | 🚧 Coming in Phase 5.4 | Security review checklist |

## Architecture Overview

Scrapegoat uses PostgreSQL with pgvector for advanced documentation search:

```
┌─────────────────────────────────────────────────────────────┐
│                      Scrapegoat                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐    ┌──────────────┐   ┌──────────────┐  │
│  │   Scraper    │───▶│   Splitter   │──▶│  Embeddings  │  │
│  │   Pipeline   │    │   Pipeline   │   │   Service    │  │
│  └──────────────┘    └──────────────┘   └──────────────┘  │
│         │                    │                   │         │
│         └────────────────────┴───────────────────┘         │
│                             │                              │
│                             ▼                              │
│                 ┌───────────────────────┐                  │
│                 │   DocumentStore       │                  │
│                 │   (PostgreSQL)        │                  │
│                 └───────────────────────┘                  │
│                             │                              │
│              ┌──────────────┴──────────────┐              │
│              │                             │              │
│              ▼                             ▼              │
│    ┌─────────────────┐          ┌─────────────────┐      │
│    │  Vector Search  │          │  Full-Text      │      │
│    │  (pgvector)     │          │  Search (GIN)   │      │
│    │  HNSW Index     │          │  FTS Index      │      │
│    └─────────────────┘          └─────────────────┘      │
│              │                             │              │
│              └──────────────┬──────────────┘              │
│                             │                              │
│                             ▼                              │
│                 ┌───────────────────────┐                  │
│                 │  Hybrid Search (RRF)  │                  │
│                 └───────────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### Key Features

- **Hybrid Search**: Combines vector similarity (pgvector) with full-text search (GIN indexes) using Reciprocal Rank Fusion
- **HNSW Indexing**: Approximate nearest neighbor search for fast vector similarity
- **GIN Indexing**: Fast full-text search with stemming and phrase matching
- **Connection Pooling**: Efficient PostgreSQL connection management
- **Scalability**: Handle millions of documents with proper indexing

## Support

- **GitHub Issues**: [Report bugs and request features](https://github.com/yourusername/scrapegoat/issues)
- **Discussions**: [Ask questions and share ideas](https://github.com/yourusername/scrapegoat/discussions)

## Contributing

Contributions welcome! See the main [README.md](../README.md) for development setup.

---

*Documentation is actively being developed as part of Phase 5. Check back for updates.*
