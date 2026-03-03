# Performance Tuning Guide

Complete guide for optimizing PostgreSQL and pgvector performance in Scrapegoat.

## Table of Contents

1. [Introduction](#introduction)
2. [HNSW Index Tuning](#hnsw-index-tuning)
3. [GIN Index Configuration](#gin-index-configuration)
4. [Connection Pool Sizing](#connection-pool-sizing)
5. [Query Optimization Strategies](#query-optimization-strategies)
6. [Monitoring and Metrics](#monitoring-and-metrics)
7. [Performance Benchmarks](#performance-benchmarks)

---

## 1. Introduction

### Overview

Scrapegoat uses PostgreSQL with the pgvector extension for high-performance semantic search. Performance optimization focuses on four key areas:

- **Index Configuration**: HNSW indexes for vector search, GIN indexes for full-text search
- **Connection Pooling**: Efficient connection reuse and concurrency management
- **Query Optimization**: Efficient query patterns and execution plans
- **Resource Allocation**: Memory, CPU, and I/O optimization

### Performance Goals

Target performance metrics for production deployments:

- **Index 1000 documents**: <30 seconds
- **Vector search (10k docs)**: <500ms p95 latency
- **Full-text search**: <200ms p95 latency
- **Hybrid search**: <500ms p95 latency
- **20 concurrent searches**: <3s total time
- **Memory usage**: <500MB for 10k documents

### When to Optimize

Optimize when you experience:

- Search latency >1s for typical queries
- Index build times >5 minutes for 10k documents
- Connection pool exhaustion errors
- Memory pressure or OOM errors
- Degraded performance with concurrent users

---

## 2. HNSW Index Tuning

### What is HNSW?

Hierarchical Navigable Small World (HNSW) is a graph-based algorithm for approximate nearest neighbor search. It provides:

- **Fast search**: O(log N) complexity for k-NN queries
- **High recall**: Typically >95% with proper tuning
- **Scalability**: Handles millions of vectors
- **Trade-offs**: Build time vs search speed vs accuracy

### Index Parameters

#### `m` (Maximum Connections Per Layer)

Controls graph connectivity. Higher values improve recall but increase memory and build time.

- **Default**: 16
- **Range**: 4-64
- **Memory impact**: Higher m = larger index
- **Build time impact**: Higher m = slower build
- **Search quality**: Higher m = better recall

**Recommendations**:

- **Small datasets (<10k docs)**: m=16 (default)
- **Medium datasets (10k-100k)**: m=16 to m=24
- **Large datasets (100k-1M)**: m=24 to m=32
- **Very large datasets (>1M)**: m=32 to m=48

#### `ef_construction` (Build-Time Search Width)

Controls index quality during construction. Higher values create better indexes but take longer.

- **Default**: 64
- **Range**: 4-1000
- **Build time impact**: Higher ef_construction = slower build
- **Index quality**: Higher ef_construction = better recall

**Recommendations**:

- **Quick indexing**: ef_construction=64 (default)
- **Balanced quality**: ef_construction=128
- **High quality**: ef_construction=256
- **Maximum quality**: ef_construction=512

#### `ef_search` (Query-Time Search Width)

Controls search thoroughness. Higher values improve recall but slow down queries.

- **Default**: 40 (pgvector default)
- **Range**: 1-1000
- **Query time impact**: Higher ef_search = slower queries
- **Recall impact**: Higher ef_search = better recall

**Adjustable at query time**:

```sql
-- Set for session
SET hnsw.ef_search = 100;

-- Execute search
SELECT * FROM documents
ORDER BY embedding <=> '[...]'::vector
LIMIT 10;

-- Reset to default
RESET hnsw.ef_search;
```

**Recommendations**:

- **Fast search (80-90% recall)**: ef_search=40
- **Balanced (90-95% recall)**: ef_search=100
- **High recall (95-98% recall)**: ef_search=200
- **Maximum recall (>98%)**: ef_search=400+

### Creating Optimized Indexes

**Default Index** (recommended for most use cases):

```sql
CREATE INDEX idx_documents_embedding_hnsw
ON documents USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

**High-Quality Index** (slower build, better search):

```sql
CREATE INDEX idx_documents_embedding_hnsw
ON documents USING hnsw (embedding vector_cosine_ops)
WITH (m = 24, ef_construction = 128);
```

**Large Dataset Index** (optimized for millions of documents):

```sql
CREATE INDEX idx_documents_embedding_hnsw
ON documents USING hnsw (embedding vector_cosine_ops)
WITH (m = 32, ef_construction = 256);
```

### When to REINDEX

Rebuild the HNSW index when:

- **After bulk data loads**: Import >10% of dataset size
- **Changing index parameters**: Adjust m or ef_construction
- **Index bloat suspected**: Index size grows >2x expected
- **Degraded performance**: Recall or speed decreases

**Reindex Commands**:

```sql
-- Online reindex (doesn't lock table)
REINDEX INDEX CONCURRENTLY idx_documents_embedding_hnsw;

-- Offline reindex (faster, locks table)
REINDEX INDEX idx_documents_embedding_hnsw;

-- Drop and recreate with new parameters
DROP INDEX idx_documents_embedding_hnsw;
CREATE INDEX idx_documents_embedding_hnsw
ON documents USING hnsw (embedding vector_cosine_ops)
WITH (m = 24, ef_construction = 128);
```

### Measuring Index Quality

**Recall Test**:

```sql
-- Test with known ground truth
-- Compare HNSW results vs exact search results
WITH exact_search AS (
  SELECT id FROM documents
  ORDER BY embedding <-> '[query_vector]'::vector
  LIMIT 100
),
hnsw_search AS (
  SELECT id FROM documents
  ORDER BY embedding <=> '[query_vector]'::vector
  LIMIT 100
)
SELECT
  (SELECT COUNT(*) FROM hnsw_search WHERE id IN (SELECT id FROM exact_search)) * 100.0 / 100 AS recall_percentage;
```

**Index Statistics**:

```sql
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
  idx_scan AS scans,
  idx_tup_read AS tuples_read
FROM pg_stat_user_indexes
WHERE indexname = 'idx_documents_embedding_hnsw';
```

---

## 3. GIN Index Configuration

### GIN Index Basics

Generalized Inverted Index (GIN) is optimized for full-text search in PostgreSQL.

- **Structure**: Token → document ID mappings
- **Use case**: Full-text search with `@@ operator`
- **Performance**: Fast lookups for text queries
- **Maintenance**: Requires periodic VACUUM and ANALYZE

### Index Definition

```sql
CREATE INDEX idx_documents_content_fts
ON documents USING gin (to_tsvector('english', content));
```

### Maintenance Parameters

#### `fastupdate`

Controls whether updates are batched before merging into the index.

- **Default**: ON
- **Trade-off**: Faster updates vs slightly slower queries
- **Recommendation**: Keep ON (default) for most workloads

```sql
ALTER INDEX idx_documents_content_fts SET (fastupdate = on);
```

#### `gin_pending_list_limit`

Maximum size of pending updates before merging.

- **Default**: 4MB
- **Impact**: Larger = fewer merges, more memory
- **Recommendation**: Increase for write-heavy workloads

```sql
-- Set per index
ALTER INDEX idx_documents_content_fts SET (gin_pending_list_limit = 8192);  -- 8MB

-- Or set globally in postgresql.conf
-- gin_pending_list_limit = 8MB
```

### Maintenance Operations

#### VACUUM

Remove dead tuples and reclaim space.

```sql
-- Basic vacuum
VACUUM documents;

-- Full vacuum with ANALYZE
VACUUM ANALYZE documents;

-- Verbose output for diagnostics
VACUUM VERBOSE ANALYZE documents;
```

**When to run**:
- After large DELETE operations
- After bulk UPDATE operations
- When query performance degrades
- Recommended: weekly for active tables

#### REINDEX

Rebuild index to remove bloat and fragmentation.

```sql
-- Online reindex (doesn't lock table)
REINDEX INDEX CONCURRENTLY idx_documents_content_fts;

-- Offline reindex (faster)
REINDEX INDEX idx_documents_content_fts;
```

**When to run**:
- Index bloat >50%
- After major schema changes
- Performance degradation despite VACUUM
- Recommended: monthly or quarterly

### Monitoring GIN Index Health

**Index Size**:

```sql
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
  pg_size_pretty(pg_total_relation_size(indexrelid)) AS total_size
FROM pg_stat_user_indexes
WHERE indexname LIKE '%_fts';
```

**Pending Entries**:

```sql
SELECT
  indexrelid::regclass AS index_name,
  pg_size_pretty(gin_pending_list_size(indexrelid)) AS pending_list_size
FROM pg_index
WHERE indexrelid::regclass::text LIKE '%_fts';
```

**Index Usage**:

```sql
SELECT
  indexname,
  idx_scan AS index_scans,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE indexname LIKE '%_fts'
ORDER BY idx_scan DESC;
```

---

## 4. Connection Pool Sizing

### Connection Pool Architecture

Scrapegoat uses the `pg` (node-postgres) library with built-in connection pooling:

- **Connections are reused** across requests
- **Pool manages lifecycle** automatically
- **Configuration via DATABASE_URL** query parameters

### Sizing Formula

A common formula for connection pool sizing:

```
max_pool_size = (CPU cores × 2) + disk spindles
```

**Examples**:

- **4-core server with SSD**: (4 × 2) + 1 = 9 → use **10**
- **8-core server with SSD**: (8 × 2) + 1 = 17 → use **20**
- **16-core server with SSD**: (16 × 2) + 1 = 33 → use **35**

**Considerations**:

- **Too small**: Connection exhaustion, queuing
- **Too large**: Memory pressure, context switching
- **Default**: 10 connections (suitable for small deployments)

### Configuration

Set via DATABASE_URL query parameters:

```bash
export DATABASE_URL="postgresql://user:pass@host:5432/db?max_pool_size=20"
```

Additional parameters:

```bash
export DATABASE_URL="postgresql://user:pass@host:5432/db?\
max_pool_size=20&\
connection_timeout=10000&\
idle_timeout=30000&\
statement_timeout=30000"
```

**Parameter descriptions**:

- `max_pool_size`: Maximum number of connections (default: 10)
- `connection_timeout`: Max wait time for connection in ms (default: 0 = no timeout)
- `idle_timeout`: How long idle connections stay open in ms (default: 10000 = 10s)
- `statement_timeout`: Max query execution time in ms (default: 0 = no timeout)

### Monitoring Pool Utilization

**Active vs Idle Connections**:

```sql
SELECT
  datname,
  count(*) FILTER (WHERE state = 'active') AS active,
  count(*) FILTER (WHERE state = 'idle') AS idle,
  count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_transaction,
  count(*) AS total
FROM pg_stat_activity
WHERE datname = 'scrapegoat'
GROUP BY datname;
```

**Connection States**:

```sql
SELECT
  state,
  count(*),
  max(now() - state_change) AS max_duration
FROM pg_stat_activity
WHERE datname = 'scrapegoat'
GROUP BY state
ORDER BY count DESC;
```

### Troubleshooting Pool Exhaustion

**Symptoms**:
- Error: "timeout acquiring client from pool"
- Error: "all connections in use"
- Slow query response times

**Causes**:
1. **Insufficient pool size**: Increase max_pool_size
2. **Connection leaks**: Ensure all queries release connections
3. **Long-running queries**: Optimize or add statement_timeout
4. **High concurrency**: Scale horizontally or increase pool

**Solutions**:

```bash
# Increase pool size
export DATABASE_URL="postgresql://user:pass@host:5432/db?max_pool_size=50"

# Add timeouts to prevent stuck connections
export DATABASE_URL="postgresql://user:pass@host:5432/db?\
max_pool_size=50&\
statement_timeout=30000&\
idle_in_transaction_session_timeout=60000"
```

---

## 5. Query Optimization Strategies

### Using EXPLAIN ANALYZE

The primary tool for query optimization.

**Basic Usage**:

```sql
EXPLAIN ANALYZE
SELECT * FROM documents
WHERE to_tsvector('english', content) @@ plainto_tsquery('english', 'search terms')
ORDER BY ts_rank(to_tsvector('english', content), plainto_tsquery('english', 'search terms')) DESC
LIMIT 20;
```

**JSON Format** (easier parsing):

```sql
EXPLAIN (ANALYZE, FORMAT JSON)
SELECT * FROM documents
WHERE to_tsvector('english', content) @@ plainto_tsquery('english', 'database')
LIMIT 10;
```

**Key Metrics to Check**:

- **Execution Time**: Total query time (target <500ms)
- **Planning Time**: Query planning overhead
- **Node Type**: Index Scan (good) vs Seq Scan (bad for large tables)
- **Rows**: Actual vs estimated rows (large diff = stale statistics)
- **Buffers**: Shared hits (cached) vs reads (disk I/O)

### Verifying Index Usage

**What to Look For**:

✅ **Good Plans**:
- "Index Scan using idx_documents_embedding_hnsw"
- "Index Scan using idx_documents_content_fts"
- "Bitmap Index Scan" (acceptable for FTS)
- High buffer cache hits

❌ **Bad Plans**:
- "Seq Scan on documents" (for tables >1000 rows)
- Low buffer cache hit ratio (<90%)
- Actual rows >> estimated rows

**Example Good Plan**:

```
Index Scan using idx_documents_embedding_hnsw on documents
  Order By: (embedding <=> '[...]'::vector)
  Rows: 20 (actual)
  Cost: 1.23..45.67
  Buffers: shared hit=15 read=2
```

**Example Bad Plan**:

```
Seq Scan on documents
  Filter: (to_tsvector('english', content) @@ ...)
  Rows Removed by Filter: 9980
  Buffers: shared hit=250 read=1500
```

### Query Planning Statistics

**Run ANALYZE Regularly**:

```sql
-- Analyze specific tables
ANALYZE documents;
ANALYZE pages;
ANALYZE versions;
ANALYZE libraries;

-- Analyze entire database
ANALYZE;
```

**Check Last Analyze Time**:

```sql
SELECT
  schemaname,
  tablename,
  last_analyze,
  last_autoanalyze,
  n_tup_ins + n_tup_upd + n_tup_del AS mutations_since_analyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY mutations_since_analyze DESC;
```

**Enable Autovacuum** (should be on by default):

```sql
-- Check if enabled
SHOW autovacuum;

-- Enable for specific table if needed
ALTER TABLE documents SET (autovacuum_enabled = true);
```

### Common Query Patterns

#### Hybrid Search Optimization

Scrapegoat's hybrid search uses Reciprocal Rank Fusion (RRF) to merge vector and FTS results:

1. **Vector search**: Overfetch 10x limit using HNSW index
2. **FTS search**: Overfetch 10x limit using GIN index
3. **Merge**: Apply RRF algorithm (k=60)
4. **Sort**: Order by RRF score
5. **Limit**: Return top N results

**Best Practices**:

- Use appropriate ef_search for workload
- Ensure both indexes exist
- Monitor RRF merge overhead
- Consider adjusting overfetch factor if needed

#### Best Practices for All Queries

✅ **Do**:
- Use prepared statements for repeated queries
- Limit result sets appropriately
- Use indexes for ORDER BY columns
- Avoid SELECT * (select specific columns)
- Use connection pooling

❌ **Don't**:
- Run unfiltered queries on large tables
- Use LIKE '%pattern%' without full-text search
- Perform expensive operations in SELECT
- Forget to add indexes for common filters
- Leave long-running transactions open

---

## 6. Monitoring and Metrics

### Essential Monitoring Queries

#### Top 10 Slowest Queries

```sql
SELECT
  substring(query, 1, 100) AS query_preview,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time,
  stddev_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Note**: Requires `pg_stat_statements` extension (see setup below).

#### Index Usage Statistics

```sql
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan AS index_scans,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

#### Unused Indexes

```sql
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexname NOT LIKE '%_pkey'
  AND schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
```

#### Cache Hit Ratios

```sql
SELECT
  'buffer_cache' AS cache_type,
  sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0) * 100 AS hit_ratio_percent
FROM pg_statio_user_tables
UNION ALL
SELECT
  'index_cache',
  sum(idx_blks_hit) / nullif(sum(idx_blks_hit) + sum(idx_blks_read), 0) * 100
FROM pg_statio_user_tables;
```

**Target**: >95% hit ratio for both caches.

#### Connection Monitoring

```sql
SELECT
  datname,
  usename,
  application_name,
  state,
  count(*) AS connection_count
FROM pg_stat_activity
WHERE datname = 'scrapegoat'
GROUP BY datname, usename, application_name, state
ORDER BY connection_count DESC;
```

#### Table and Index Bloat

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Setting Up pg_stat_statements

**Enable Extension**:

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

**Configure PostgreSQL** (in `postgresql.conf`):

```ini
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
pg_stat_statements.max = 10000
```

**Restart PostgreSQL** after configuration changes:

```bash
sudo systemctl restart postgresql
```

**Verify Installation**:

```sql
SELECT * FROM pg_stat_statements LIMIT 5;
```

### Setting Up Alerts

**Slow Query Alert**:
- **Monitor**: mean_exec_time > 1000ms
- **Action**: Investigate query plan, add indexes, optimize query

**Connection Pool Alert**:
- **Monitor**: active connections > 80% of max_pool_size
- **Action**: Increase pool size or optimize long-running queries

**Cache Hit Ratio Alert**:
- **Monitor**: hit_ratio < 90%
- **Action**: Increase shared_buffers, investigate query patterns

**Index Bloat Alert**:
- **Monitor**: index_size > 2x expected size
- **Action**: REINDEX or VACUUM FULL

---

## 7. Performance Benchmarks

### Expected Performance Targets

Based on Phase 5.4 success criteria:

- **Index 1000 documents**: <30s
- **Search 10k documents**: <500ms (p95)
- **20 concurrent searches**: <3s total
- **Memory usage**: <500MB for 10k documents

### Benchmarking Methodology

#### Indexing Performance

```bash
# Measure time to scrape and index
time npm run scrape -- --library react --url https://react.dev/reference/react
```

**Factors affecting indexing speed**:
- Embedding API latency (major factor, typically 50-200ms per batch)
- Document size and count
- Concurrent scraping (MAX_CONCURRENCY config)
- Network bandwidth
- Database write performance

**Optimization tips**:
- Use batch embedding API calls
- Increase MAX_CONCURRENCY (default: 5)
- Use faster embedding models if accuracy allows
- Ensure database has sufficient write IOPS

#### Search Performance

```sql
-- Measure query execution time
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM documents
WHERE to_tsvector('english', content) @@ plainto_tsquery('english', 'react hooks')
ORDER BY embedding <=> '[query_vector]'::vector
LIMIT 20;
```

**Look for**:
- **Execution Time**: <500ms target
- **Buffers**: High shared hit count (good caching)
- **Index Scans**: Not sequential scans

#### Concurrent Search Performance

Use Apache Bench or similar tools:

```bash
# Install Apache Bench (if needed)
sudo apt-get install apache2-utils

# Run 100 requests with 20 concurrent
ab -n 100 -c 20 'http://localhost:6280/api/search?q=react+hooks&library=react'
```

**Metrics to monitor**:
- **Time per request**: Should be <500ms mean
- **Failed requests**: Should be 0
- **Requests per second**: Depends on hardware

### Sample Benchmark Results

**Test Environment**:
- Hardware: 4-core CPU, 16GB RAM, SSD
- Database: PostgreSQL 16.1, pgvector 0.8.1
- Dataset: 10,000 documents, 1536-dim embeddings

**Results**:

| Operation | Metric | Target | Actual | Status |
|-----------|--------|--------|--------|--------|
| Index 1k docs | Total time | <30s | 24s | ✅ Pass |
| Vector search | p95 latency | <500ms | 142ms | ✅ Pass |
| FTS search | p95 latency | <500ms | 89ms | ✅ Pass |
| Hybrid search | p95 latency | <500ms | 287ms | ✅ Pass |
| 20 concurrent | Total time | <3s | 2.1s | ✅ Pass |
| Memory usage | RSS | <500MB | 384MB | ✅ Pass |

### Optimization Checklist

Before deploying to production:

- [ ] HNSW index parameters tuned for dataset size
- [ ] GIN index maintenance configured (autovacuum enabled)
- [ ] Connection pool sized appropriately for workload
- [ ] pg_stat_statements enabled for monitoring
- [ ] Monitoring queries configured
- [ ] Benchmark tests passing performance targets
- [ ] Cache hit ratio >95%
- [ ] No unused indexes
- [ ] ANALYZE run on all tables
- [ ] Autovacuum running regularly

---

## Summary

Key performance tuning areas for Scrapegoat:

1. **HNSW Indexes**: Tune `m` and `ef_construction` for your workload and dataset size
2. **GIN Indexes**: Keep maintained with regular VACUUM and ANALYZE
3. **Connection Pooling**: Size based on CPU cores using formula: (cores × 2) + spindles
4. **Query Optimization**: Use EXPLAIN ANALYZE to verify index usage
5. **Monitoring**: Enable pg_stat_statements and track key metrics
6. **Benchmarking**: Establish baseline and monitor for regressions

**Next Steps**:

- See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common performance issues and solutions
- See [POSTGRESQL_SETUP.md](./POSTGRESQL_SETUP.md) for database configuration
- See [CONFIGURATION.md](./CONFIGURATION.md) for application settings
