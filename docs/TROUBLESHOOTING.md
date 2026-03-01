# Troubleshooting Guide

Comprehensive troubleshooting guide for common Scrapegoat issues with PostgreSQL.

## Table of Contents

1. [Connection Issues](#connection-issues)
2. [Migration Failures](#migration-failures)
3. [Slow Query Performance](#slow-query-performance)
4. [pgvector Extension Issues](#pgvector-extension-issues)
5. [Memory Issues with Large Datasets](#memory-issues-with-large-datasets)
6. [Index Issues](#index-issues)
7. [Data Integrity Issues](#data-integrity-issues)

---

## 1. Connection Issues

### 1.1 Connection Refused

**Symptom**:
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Diagnostic Steps**:

1. **Check PostgreSQL is running**:
   ```bash
   # Linux
   sudo systemctl status postgresql

   # macOS
   brew services list | grep postgresql

   # Docker
   docker ps | grep postgres
   ```

2. **Verify port is listening**:
   ```bash
   sudo netstat -plnt | grep 5432
   # Or
   sudo lsof -i :5432
   ```

3. **Check listen_addresses**:
   ```sql
   SHOW listen_addresses;
   ```
   Should be `'localhost'` or `'*'` for remote connections.

**Solutions**:

- **Start PostgreSQL**:
  ```bash
  # Linux
  sudo systemctl start postgresql

  # macOS
  brew services start postgresql@16

  # Docker
  docker start scrapegoat-db
  ```

- **Fix listen_addresses** (in `postgresql.conf`):
  ```ini
  listen_addresses = 'localhost'  # Or '*' for all interfaces
  ```
  Then reload: `sudo systemctl reload postgresql`

- **Check firewall**:
  ```bash
  # Ubuntu
  sudo ufw allow 5432/tcp

  # CentOS
  sudo firewall-cmd --add-port=5432/tcp --permanent
  sudo firewall-cmd --reload
  ```

### 1.2 Authentication Failed

**Symptom**:
```
Error: password authentication failed for user "scrapegoat"
```

**Diagnostic Steps**:

1. **Verify password is correct**:
   ```bash
   psql -U scrapegoat -d scrapegoat -h localhost
   # Enter password when prompted
   ```

2. **Check pg_hba.conf**:
   ```bash
   sudo cat /etc/postgresql/16/main/pg_hba.conf | grep scrapegoat
   ```

**Solutions**:

- **Reset password**:
  ```sql
  ALTER USER scrapegoat WITH PASSWORD 'new_password';
  ```

- **Update pg_hba.conf**:
  ```
  # TYPE  DATABASE    USER        ADDRESS         METHOD
  local   scrapegoat  scrapegoat                  scram-sha-256
  host    scrapegoat  scrapegoat  127.0.0.1/32    scram-sha-256
  host    scrapegoat  scrapegoat  ::1/128         scram-sha-256
  ```
  Then reload: `sudo systemctl reload postgresql`

- **Update DATABASE_URL** with correct password:
  ```bash
  export DATABASE_URL="postgresql://scrapegoat:new_password@localhost:5432/scrapegoat"
  ```

### 1.3 SSL/TLS Certificate Errors

**Symptom**:
```
Error: self signed certificate in certificate chain
```

**Solutions**:

- **Allow self-signed certificates** (development only):
  ```bash
  export DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require&rejectUnauthorized=false"
  ```

- **Use proper CA certificate**:
  ```bash
  export DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=verify-full&sslrootcert=/path/to/ca.crt"
  ```

- **Disable SSL** (local development only):
  ```bash
  export DATABASE_URL="postgresql://user:pass@localhost:5432/db?sslmode=disable"
  ```

### 1.4 Connection Timeout

**Symptom**:
```
Error: timeout exceeded when trying to connect
```

**Solutions**:

- **Increase connection timeout**:
  ```bash
  export DATABASE_URL="postgresql://user:pass@host:5432/db?connection_timeout=30000"
  ```

- **Check network connectivity**:
  ```bash
  ping database-host
  telnet database-host 5432
  ```

- **Verify firewall allows connections**

### 1.5 Connection Pool Exhaustion

**Symptom**:
```
Error: timeout acquiring client from pool
Error: all connections in use
```

**Diagnostic**:
```sql
SELECT count(*) FROM pg_stat_activity WHERE datname = 'scrapegoat';
```

**Solutions**:

- **Increase pool size**:
  ```bash
  export DATABASE_URL="postgresql://user:pass@host:5432/db?max_pool_size=50"
  ```

- **Fix connection leaks** - ensure all queries release connections properly

- **Optimize long-running queries** - reduce query execution time

- **Add statement timeout**:
  ```bash
  export DATABASE_URL="postgresql://user:pass@host:5432/db?statement_timeout=30000"
  ```

---

## 2. Migration Failures

### 2.1 pgvector Extension Not Found

**Symptom**:
```
Error: extension "vector" does not exist
```

**Diagnostic**:
```sql
SELECT * FROM pg_available_extensions WHERE name = 'vector';
```

**Solutions**:

- **Install pgvector** - see [POSTGRESQL_SETUP.md](./POSTGRESQL_SETUP.md#pgvector-extension-installation)

- **Verify installation**:
  ```bash
  # Ubuntu/Debian
  ls /usr/lib/postgresql/16/lib/vector.so

  # macOS
  ls /opt/homebrew/lib/postgresql@16/vector.so
  ```

- **Create extension**:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ```

### 2.2 Migration Already Applied

**Symptom**:
```
Error: migration 001_initial_schema has already been applied
```

**Diagnostic**:
```sql
SELECT * FROM migrations ORDER BY id;
```

**Solutions**:

- **Skip migration** if already applied correctly

- **Manual fix** if migration table is corrupted:
  ```sql
  -- Verify table exists and has correct data
  SELECT * FROM documents LIMIT 1;

  -- If table is correct, mark migration as applied
  INSERT INTO migrations (id, name, applied_at)
  VALUES (1, '001_initial_schema', NOW());
  ```

### 2.3 Permission Denied During Migration

**Symptom**:
```
Error: permission denied for schema public
Error: permission denied to create extension "vector"
```

**Solutions**:

- **Grant necessary permissions**:
  ```sql
  GRANT ALL ON SCHEMA public TO scrapegoat;
  GRANT CREATE ON DATABASE scrapegoat TO scrapegoat;
  ```

- **For extension creation**, user needs superuser or specific privileges:
  ```sql
  ALTER USER scrapegoat WITH SUPERUSER;  -- Development only!
  ```

  Or install extension as postgres user:
  ```sql
  -- As postgres user
  \c scrapegoat
  CREATE EXTENSION IF NOT EXISTS vector;
  GRANT USAGE ON SCHEMA public TO scrapegoat;
  ```

---

## 3. Slow Query Performance

### 3.1 Index Not Being Used

**Symptom**:
Queries are slow (>1s), EXPLAIN shows "Seq Scan"

**Diagnostic**:
```sql
EXPLAIN ANALYZE
SELECT * FROM documents
WHERE to_tsvector('english', content) @@ plainto_tsquery('english', 'search')
LIMIT 20;
```

Look for "Seq Scan on documents" instead of "Index Scan"

**Solutions**:

- **Run ANALYZE** to update statistics:
  ```sql
  ANALYZE documents;
  ```

- **Verify index exists**:
  ```sql
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE tablename = 'documents';
  ```

- **Rebuild index** if corrupted:
  ```sql
  REINDEX INDEX CONCURRENTLY idx_documents_content_fts;
  ```

- **Check query matches index** - ensure query uses indexed column correctly

### 3.2 Missing Statistics

**Symptom**:
Query planner makes poor choices, performance inconsistent

**Diagnostic**:
```sql
SELECT
  schemaname,
  tablename,
  last_analyze,
  last_autoanalyze,
  n_tup_ins + n_tup_upd + n_tup_del AS mutations
FROM pg_stat_user_tables
WHERE tablename = 'documents';
```

**Solutions**:

- **Manual ANALYZE**:
  ```sql
  ANALYZE documents;
  ANALYZE pages;
  ANALYZE versions;
  ANALYZE libraries;
  ```

- **Ensure autovacuum is enabled**:
  ```sql
  SHOW autovacuum;  -- Should be 'on'

  ALTER TABLE documents SET (autovacuum_enabled = true);
  ```

### 3.3 Memory Pressure

**Symptom**:
Queries slow, PostgreSQL logs show memory allocation errors

**Diagnostic**:
```sql
SHOW work_mem;
SHOW shared_buffers;
```

**Solutions**:

- **Increase work_mem** (in `postgresql.conf`):
  ```ini
  work_mem = 50MB  # Per-operation memory
  ```

- **Increase shared_buffers** (in `postgresql.conf`):
  ```ini
  shared_buffers = 4GB  # 25% of total RAM
  ```

- **For specific session**:
  ```sql
  SET work_mem = '100MB';
  -- Run query
  ```

### 3.4 Connection Pool Saturation

**Symptom**:
Queries queue, delays waiting for connections

**Diagnostic**:
```sql
SELECT
  state,
  count(*)
FROM pg_stat_activity
WHERE datname = 'scrapegoat'
GROUP BY state;
```

**Solutions**:

- **Increase pool size** - see Connection Issues above

- **Optimize query patterns** - reduce concurrent queries

- **Add query timeout** to prevent long-running queries

---

## 4. pgvector Extension Issues

### 4.1 Vector Dimension Mismatch

**Symptom**:
```
Error: vector dimension mismatch: expected 1536, got 768
```

**Cause**: Embedding model changed or misconfigured

**Solutions**:

- **Verify EMBEDDING_DIMENSIONS** matches model:
  ```bash
  # text-embedding-3-small = 1536
  # text-embedding-3-large = 3072
  # nomic-embed-text = 768
  export EMBEDDING_DIMENSIONS="1536"
  ```

- **Re-index documents** if model changed:
  ```sql
  TRUNCATE TABLE documents CASCADE;
  -- Re-scrape with correct embedding model
  ```

### 4.2 HNSW Index Build Failure

**Symptom**:
```
Error: out of memory
Error: HNSW index build failed
```

**Solutions**:

- **Increase maintenance_work_mem**:
  ```sql
  SET maintenance_work_mem = '2GB';
  CREATE INDEX idx_documents_embedding_hnsw ON documents
  USING hnsw (embedding vector_cosine_ops);
  ```

- **Create index CONCURRENTLY** (slower but doesn't lock):
  ```sql
  CREATE INDEX CONCURRENTLY idx_documents_embedding_hnsw
  ON documents USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
  ```

- **Create index after data load**, not before

### 4.3 Poor Vector Search Recall

**Symptom**:
Search results don't include expected documents

**Diagnostic**:
```sql
-- Test exact vs approximate search
-- Exact (slow but accurate)
SELECT id, content FROM documents
ORDER BY embedding <-> '[query_vector]'::vector
LIMIT 10;

-- Approximate (fast, uses HNSW)
SELECT id, content FROM documents
ORDER BY embedding <=> '[query_vector]'::vector
LIMIT 10;
```

**Solutions**:

- **Increase ef_search**:
  ```sql
  SET hnsw.ef_search = 200;  -- Higher = better recall
  ```

- **Rebuild index with higher ef_construction**:
  ```sql
  DROP INDEX idx_documents_embedding_hnsw;
  CREATE INDEX idx_documents_embedding_hnsw
  ON documents USING hnsw (embedding vector_cosine_ops)
  WITH (m = 24, ef_construction = 256);
  ```

---

## 5. Memory Issues with Large Datasets

### 5.1 Out of Memory (OOM) Errors

**Symptom**:
```
Error: out of memory
PostgreSQL process killed by OOM killer
```

**Diagnostic**:
```bash
# Check PostgreSQL memory usage
ps aux | grep postgres
free -h
dmesg | grep -i oom
```

**Solutions**:

- **Reduce shared_buffers** (in `postgresql.conf`):
  ```ini
  shared_buffers = 2GB  # Was 4GB
  ```

- **Reduce work_mem**:
  ```ini
  work_mem = 25MB  # Was 50MB
  ```

- **Limit connection pool size**:
  ```bash
  export DATABASE_URL="postgresql://user:pass@host:5432/db?max_pool_size=10"
  ```

- **Add swap space** (Linux):
  ```bash
  sudo fallocate -l 4G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  ```

- **Use smaller batches** when indexing large datasets

### 5.2 Embedding Memory Pressure

**Symptom**:
Node.js process runs out of memory during embedding generation

**Solutions**:

- **Reduce EMBEDDING_BATCH_SIZE**:
  ```bash
  export EMBEDDING_BATCH_SIZE=50  # Default: 100
  ```

- **Process documents in chunks**:
  ```typescript
  // Process 1000 documents at a time
  const chunkSize = 1000;
  for (let i = 0; i < documents.length; i += chunkSize) {
    const chunk = documents.slice(i, i + chunkSize);
    await store.addDocuments(library, version, chunk);
  }
  ```

- **Increase Node.js memory limit**:
  ```bash
  export NODE_OPTIONS="--max-old-space-size=4096"  # 4GB
  ```

---

## 6. Index Issues

### 6.1 Index Bloat

**Symptom**:
Index size growing unexpectedly, queries getting slower

**Diagnostic**:
```sql
SELECT
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
  idx_scan AS scans
FROM pg_stat_user_indexes
WHERE tablename = 'documents'
ORDER BY pg_relation_size(indexrelid) DESC;
```

**Solutions**:

- **VACUUM**:
  ```sql
  VACUUM ANALYZE documents;
  ```

- **REINDEX**:
  ```sql
  REINDEX INDEX CONCURRENTLY idx_documents_embedding_hnsw;
  REINDEX INDEX CONCURRENTLY idx_documents_content_fts;
  ```

- **Schedule regular maintenance**:
  ```bash
  # Add to cron (weekly)
  0 2 * * 0 psql -U scrapegoat -d scrapegoat -c "VACUUM ANALYZE;"
  ```

### 6.2 Invalid Index State

**Symptom**:
Index exists but not being used, or shows as invalid

**Diagnostic**:
```sql
SELECT
  indexname,
  indexdef,
  indisvalid
FROM pg_indexes
JOIN pg_index ON indexrelid = (schemaname||'.'||indexname)::regclass
WHERE tablename = 'documents';
```

**Solutions**:

- **Drop and recreate index**:
  ```sql
  DROP INDEX idx_documents_embedding_hnsw;
  CREATE INDEX idx_documents_embedding_hnsw ON documents
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
  ```

- **Verify index creation succeeded**:
  ```sql
  \d+ documents
  ```

---

## 7. Data Integrity Issues

### 7.1 Missing Documents After Migration

**Symptom**:
Document count doesn't match expectations

**Diagnostic**:
```sql
SELECT
  l.name AS library,
  v.name AS version,
  count(d.id) AS document_count,
  count(DISTINCT p.url) AS page_count
FROM libraries l
JOIN versions v ON v.library_id = l.id
LEFT JOIN pages p ON p.version_id = v.id
LEFT JOIN documents d ON d.page_id = p.id
GROUP BY l.name, v.name
ORDER BY l.name, v.name;
```

**Solutions**:

- **Re-scrape affected libraries**:
  ```bash
  npm run scrape -- --library mylib --url https://example.com/docs
  ```

- **Check for errors during migration** - review logs

- **Verify foreign key relationships**:
  ```sql
  SELECT
    COUNT(DISTINCT page_id) as unique_pages,
    COUNT(*) as total_documents
  FROM documents;
  ```

### 7.2 Duplicate Documents

**Symptom**:
Same content appearing multiple times in search results

**Diagnostic**:
```sql
SELECT
  content,
  count(*) AS duplicate_count
FROM documents
GROUP BY content
HAVING count(*) > 1
ORDER BY duplicate_count DESC
LIMIT 10;
```

**Solutions**:

- **Remove duplicates**:
  ```sql
  DELETE FROM documents
  WHERE id NOT IN (
    SELECT MIN(id)
    FROM documents
    GROUP BY page_id, content, sort_order
  );
  ```

- **Prevent duplicates** - check scraper logic for idempotency

### 7.3 Null Embeddings

**Symptom**:
Some documents have NULL embeddings, breaking vector search

**Diagnostic**:
```sql
SELECT count(*) FROM documents WHERE embedding IS NULL;
```

**Solutions**:

- **Find documents without embeddings**:
  ```sql
  SELECT id, page_id, substring(content, 1, 100)
  FROM documents
  WHERE embedding IS NULL
  LIMIT 10;
  ```

- **Re-generate embeddings**:
  ```sql
  -- Delete documents without embeddings
  DELETE FROM documents WHERE embedding IS NULL;

  -- Re-scrape to regenerate
  ```

- **Check embedding API** - ensure API is working and has valid credentials

---

## Quick Reference

### Diagnostic Commands

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# View PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-16-main.log

# Check active connections
psql -U scrapegoat -d scrapegoat -c "SELECT * FROM pg_stat_activity;"

# Check index usage
psql -U scrapegoat -d scrapegoat -c "SELECT * FROM pg_stat_user_indexes WHERE tablename = 'documents';"

# Check table sizes
psql -U scrapegoat -d scrapegoat -c "SELECT tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) FROM pg_tables WHERE schemaname = 'public';"
```

### Common Fixes

```sql
-- Rebuild statistics
ANALYZE documents;

-- Rebuild index
REINDEX INDEX CONCURRENTLY idx_documents_embedding_hnsw;

-- Vacuum table
VACUUM ANALYZE documents;

-- Check query plan
EXPLAIN ANALYZE SELECT ...;
```

---

## Additional Resources

- [PostgreSQL Setup Guide](./POSTGRESQL_SETUP.md) - Installation and configuration
- [Performance Tuning Guide](./PERFORMANCE.md) - Optimization strategies
- [Configuration Reference](./CONFIGURATION.md) - All configuration options
- [PostgreSQL Documentation](https://www.postgresql.org/docs/16/) - Official PostgreSQL docs
- [pgvector Documentation](https://github.com/pgvector/pgvector) - pgvector extension docs

---

**Still Having Issues?** Open an issue on Git with:
- Error message (full text)
- PostgreSQL version (`SELECT version();`)
- pgvector version (`SELECT * FROM pg_available_extensions WHERE name = 'vector';`)
- Scrapegoat version
- Steps to reproduce
