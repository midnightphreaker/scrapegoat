# Data Storage

## Overview

The storage system uses PostgreSQL with pgvector extension, providing a normalized schema design for efficient document storage, retrieval, and version management with enterprise-grade scalability.

## Database Schema

### Libraries Table

Core library metadata and organization:

```sql
CREATE TABLE libraries (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index for case-insensitive lookups
CREATE INDEX idx_libraries_name_lower ON libraries(LOWER(name));
```

**Purpose:** Library name normalization and metadata storage.

### Versions Table

Version tracking with comprehensive status and configuration:

```sql
CREATE TABLE versions (
  id SERIAL PRIMARY KEY,
  library_id INTEGER NOT NULL,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  indexed_at TIMESTAMPTZ,
  error_message TEXT,
  job_status TEXT DEFAULT 'queued',
  progress_current INTEGER DEFAULT 0,
  progress_total INTEGER DEFAULT 0,
  scraper_config JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT versions_library_id_fkey FOREIGN KEY (library_id)
    REFERENCES libraries (id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_versions_library_id ON versions(library_id);
CREATE INDEX idx_versions_status ON versions(status);
CREATE UNIQUE INDEX idx_versions_library_version ON versions(library_id, name);
```

**Purpose:** Job state management, progress tracking, and scraper configuration persistence.

### Pages Table

Page-level information and metadata:

```sql
CREATE TABLE pages (
  id SERIAL PRIMARY KEY,
  version_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  content_type TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pages_version_id_fkey FOREIGN KEY (version_id)
    REFERENCES versions (id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_pages_version_id ON pages(version_id);
CREATE INDEX idx_pages_url ON pages(url);
```

**Purpose:** URL and page-level metadata storage.

### Documents Table

Document content with embeddings and metadata:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  page_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  sort_order INTEGER NOT NULL,
  embedding vector(1536),  -- pgvector type for semantic search
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT documents_page_id_fkey FOREIGN KEY (page_id)
    REFERENCES pages (id) ON DELETE CASCADE
);

-- Full-text search index (GIN)
CREATE INDEX idx_documents_content_fts ON documents
USING gin(to_tsvector('english', content));

-- Vector similarity search index (HNSW)
CREATE INDEX idx_documents_embedding_hnsw ON documents
USING hnsw (embedding vector_cosine_ops);

-- Other indexes
CREATE INDEX idx_documents_page_id ON documents(page_id);
CREATE INDEX idx_documents_sort_order ON documents(page_id, sort_order);
```

**Purpose:** Content storage with vector embeddings (pgvector) and full-text search capabilities.

## Schema Evolution

### Migration System

Sequential SQL migrations in `db/migrations/`:

- `001-initial-schema.sql`: Base schema with pgvector extension, all tables
- `002-gin-indexes.sql`: Full-text search GIN indexes
- `003-hnsw-indexes.sql`: Vector similarity HNSW indexes
- `010-add-indexed-at-column.sql`: Additional indexed_at timestamp column

### Migration Application

Automatic migration execution:

- Check current schema version using `_migrations` table
- Apply pending migrations in sequence
- Validate schema integrity with `information_schema` queries
- Handle migration failures gracefully with transaction rollback
- Support for both local and remote PostgreSQL instances

## Data Location

### Database Connection

PostgreSQL database connection configured via `DATABASE_URL` environment variable:

```bash
export DATABASE_URL="postgresql://user:password@host:port/database"
```

Connection resolution priority:

1. `DATABASE_URL` environment variable
2. `.env` file in project root
3. `.env.local` for local overrides (development)
4. `.env.test` for test environment

### Connection String Format

```
postgresql://[user[:password]@][host][:port][/database][?parameters]
```

**Examples:**

- Local development: `postgresql://scrapegoat:password@localhost:5432/scrapegoat`
- Docker: `postgresql://scrapegoat:password@postgres-container:5432/scrapegoat`
- Remote: `postgresql://scrapegoat:password@db.example.com:5432/scrapegoat?sslmode=require`

### Cross-Platform Support

PostgreSQL server can run on any platform:

- **Docker:** Recommended for development (includes pgvector)
- **Linux:** Via package manager or Docker
- **macOS:** Via Homebrew or Postgres.app
- **Windows:** Via official installer or WSL2

## Document Management

### DocumentManagementService

Handles document lifecycle operations:

**Core Operations:**

- Document addition and removal
- Version management and cleanup
- Library organization
- Duplicate detection

**Version Resolution:**

- Exact version matching
- Semantic version ranges
- Latest version fallback
- Version conflict resolution

### Document Storage Flow

1. Create or resolve library record
2. Create version record with job configuration
3. Process and store document chunks
4. Generate and store embeddings
5. Update version status and metadata

## Embedding Management

### Vector Storage

Embeddings stored using pgvector's native `vector` type:

- Consistent 1536-dimensional vectors (configurable)
- Native PostgreSQL type with optimized storage
- Efficient cosine distance calculations using `<=>` operator
- HNSW indexing for fast approximate nearest neighbor search
- Null handling for missing embeddings

### EmbeddingFactory

Centralized embedding generation:

- Multiple provider support (OpenAI, Google, Azure, AWS)
- Consistent vector dimensions
- Error handling and retry logic
- Rate limiting and quota management

### Provider Configuration

Support for multiple embedding providers:

**OpenAI:**

- `text-embedding-3-small` (default)
- `text-embedding-3-large`
- Custom API endpoints (Ollama compatibility)

**Google:**

- Gemini embedding models
- Vertex AI integration
- Service account authentication

**Azure:**

- Azure OpenAI service
- Custom deployment support
- Region-specific endpoints

**AWS:**

- Bedrock embedding models
- IAM-based authentication
- Regional deployment support

## Search Implementation

### DocumentRetrieverService

Handles search and retrieval operations using PostgreSQL's advanced search capabilities:

**Search Methods:**

- **Vector Similarity Search:** Using pgvector's HNSW index and `<=>` operator
- **Full-Text Search:** Using PostgreSQL's native FTS with GIN indexes and `@@` operator
- **Hybrid Search:** Reciprocal Rank Fusion (RRF) combining both methods
- **Context-Aware Ranking:** Using `ts_rank()` for FTS and cosine distance for vectors

**Context Retrieval:**

- Parent-child chunk relationships via JOIN queries
- Sibling chunk context through `sort_order` column
- Document-level metadata stored as JSONB
- Sequential ordering preservation with indexed sort_order

### Search Optimization

Performance optimizations using PostgreSQL features:

**Vector Search:**
- HNSW index for approximate nearest neighbor search
- Cosine distance operator (`<=>`) for similarity
- Efficient vector operations in C (pgvector extension)
- Configurable `ef_search` parameter for accuracy/speed tradeoff

**Full-Text Search:**
- GIN index on `to_tsvector('english', content)`
- `plainto_tsquery()` for safe user input handling
- `phraseto_tsquery()` for exact phrase matching
- `ts_rank()` for relevance scoring (higher = better)

**Hybrid Search:**
- Parallel execution of vector and FTS queries
- Reciprocal Rank Fusion (RRF) algorithm
- Overfetch factor (10x) for better result merging
- Final ranking combining both relevance signals

**Query Optimization:**
- Connection pooling with `pg` driver
- Prepared statements for common queries
- Index-only scans where possible
- Efficient JOIN operations on foreign keys

## Data Consistency

### Write-Through Architecture

Immediate persistence of state changes:

- Job status updates committed immediately
- Progress tracking with real-time updates
- Configuration changes stored in JSONB
- Error information logged with timestamps

### Transaction Management

PostgreSQL ACID transactions for consistency:

- Atomic document storage with `BEGIN/COMMIT` blocks
- Version state transitions using row-level locking
- Batch operations with transaction boundaries
- Automatic rollback on error using `try/catch` with `ROLLBACK`

### Concurrent Access

PostgreSQL's MVCC for safe concurrent database access:

- Connection pooling with `pg` driver (default: 10 connections)
- Multi-Version Concurrency Control (MVCC) for isolation
- Row-level locking with `SELECT ... FOR UPDATE` when needed
- Deadlock detection and automatic resolution
- Serializable isolation level available for critical operations

## Performance Considerations

### Index Strategy

PostgreSQL indexes optimized for workload:

- **Primary Keys:** B-tree indexes (SERIAL columns)
- **Foreign Keys:** B-tree indexes on all FKs for JOIN performance
- **Vector Search:** HNSW index on `embedding` column
- **Full-Text Search:** GIN index on `to_tsvector(content)`
- **Composite Indexes:** On `(page_id, sort_order)` for ordered retrieval
- **Partial Indexes:** On `WHERE embedding IS NOT NULL` to save space

### Query Optimization

PostgreSQL-specific optimization techniques:

- **Prepared Statements:** All queries use parameterized statements ($1, $2)
- **Batch Operations:** Multi-row INSERT with `VALUES (...), (...), ...`
- **Result Pagination:** `LIMIT` and `OFFSET` for large result sets
- **Query Planner:** EXPLAIN ANALYZE for query tuning
- **Connection Pooling:** Reuse connections to avoid overhead
- **Index-Only Scans:** Queries satisfied entirely from index

### Storage Efficiency

Space-efficient storage using PostgreSQL features:

- **TOAST:** Automatic compression for large content (>2KB)
- **Native Vector Type:** Efficient binary storage for embeddings
- **JSONB:** Compressed, indexed JSON for metadata
- **VACUUM:** Automatic cleanup of deleted rows (autovacuum)
- **Partitioning:** Table partitioning for very large datasets (optional)

## Backup and Recovery

### Data Export

PostgreSQL backup tools for data portability:

**pg_dump:**
```bash
# Full database backup
pg_dump "$DATABASE_URL" -Fc -f scrapegoat_backup.dump

# Schema-only backup
pg_dump "$DATABASE_URL" -s -f scrapegoat_schema.sql

# Data-only backup
pg_dump "$DATABASE_URL" -a -f scrapegoat_data.sql

# Specific table backup
pg_dump "$DATABASE_URL" -t documents -Fc -f documents_backup.dump
```

**pg_basebackup:**
```bash
# Physical backup for PITR (Point-in-Time Recovery)
pg_basebackup -h localhost -U postgres -D /backups/base -Ft -z -P
```

### Data Import

Import from backups:

**pg_restore:**
```bash
# Restore from custom format backup
pg_restore -d scrapegoat -c scrapegoat_backup.dump

# Parallel restore (faster)
pg_restore -d scrapegoat -j 4 scrapegoat_backup.dump
```

**psql:**
```bash
# Restore from SQL file
psql "$DATABASE_URL" -f scrapegoat_schema.sql
```

### Disaster Recovery

PostgreSQL disaster recovery capabilities:

- **WAL (Write-Ahead Logging):** Continuous archiving for point-in-time recovery
- **Streaming Replication:** Real-time replica for high availability
- **pg_checksums:** Data corruption detection
- **Transaction Rollback:** Automatic on error
- **Schema Validation:** Using `information_schema` queries

**Point-in-Time Recovery Example:**
```bash
# Restore to specific timestamp
pg_restore -d scrapegoat scrapegoat_backup.dump
psql "$DATABASE_URL" -c "SELECT pg_wal_replay_resume();"
```

## Monitoring and Maintenance

### Database Health

PostgreSQL monitoring tools and queries:

**Storage Utilization:**
```sql
-- Database size
SELECT pg_size_pretty(pg_database_size('scrapegoat'));

-- Table sizes
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index sizes
SELECT
  indexname,
  pg_size_pretty(pg_relation_size(schemaname||'.'||indexname)) AS size
FROM pg_indexes
WHERE schemaname = 'public';
```

**Query Performance:**
```sql
-- Slow queries (requires pg_stat_statements)
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Connection Pool:**
```sql
-- Active connections
SELECT * FROM pg_stat_activity
WHERE datname = 'scrapegoat';

-- Connection count
SELECT count(*) FROM pg_stat_activity
WHERE datname = 'scrapegoat';
```

### Maintenance Operations

Regular PostgreSQL maintenance:

**VACUUM:**
```sql
-- Analyze all tables
VACUUM ANALYZE;

-- Vacuum specific table
VACUUM ANALYZE documents;

-- Full vacuum (requires table lock)
VACUUM FULL documents;
```

**REINDEX:**
```sql
-- Rebuild all indexes
REINDEX DATABASE scrapegoat;

-- Rebuild specific index
REINDEX INDEX CONCURRENTLY idx_documents_embedding_hnsw;
```

**ANALYZE:**
```sql
-- Update statistics for query planner
ANALYZE;

-- Analyze specific table
ANALYZE documents;
```

**Autovacuum Configuration** (in `postgresql.conf`):
```ini
autovacuum = on
autovacuum_vacuum_scale_factor = 0.1
autovacuum_analyze_scale_factor = 0.05
```

### Diagnostics

PostgreSQL diagnostic tools:

**EXPLAIN ANALYZE:**
```sql
-- Analyze query performance
EXPLAIN ANALYZE
SELECT * FROM documents
WHERE to_tsvector('english', content) @@ plainto_tsquery('english', 'search term');
```

**pg_stat_user_tables:**
```sql
-- Table access patterns
SELECT
  schemaname,
  tablename,
  seq_scan,
  idx_scan,
  n_tup_ins,
  n_tup_upd,
  n_tup_del
FROM pg_stat_user_tables;
```

**pg_stat_user_indexes:**
```sql
-- Index usage statistics
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0;  -- Unused indexes
```

**Bloat Detection:**
```sql
-- Detect table bloat
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS bloat
FROM pg_tables
WHERE schemaname = 'public';
```

---

## Additional Resources

- [PostgreSQL Setup Guide](./POSTGRESQL_SETUP.md)
- [Configuration Reference](./CONFIGURATION.md)
- [Migration Guide](./MIGRATION.md)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [PostgreSQL Full-Text Search](https://www.postgresql.org/docs/current/textsearch.html)
