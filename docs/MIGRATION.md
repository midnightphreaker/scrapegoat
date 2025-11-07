# Migration Guide: SQLite to PostgreSQL

This guide helps you migrate from the original docs-mcp-server (SQLite-based) to Scrapegoat (PostgreSQL-based).

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Before You Begin](#before-you-begin)
4. [Migration Steps](#migration-steps)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)
7. [Rollback Procedures](#rollback-procedures)

---

## Overview

### Why PostgreSQL?

Scrapegoat uses PostgreSQL with the pgvector extension to provide:

- **Better Scalability**: Handle millions of documents with proper indexing
- **Advanced Vector Search**: Native pgvector support with HNSW indexing
- **Full-Text Search**: PostgreSQL's powerful FTS with GIN indexes
- **Hybrid Search**: Reciprocal Rank Fusion combining vector and keyword search
- **Production Ready**: ACID compliance, robust backup/restore, replication

### What Changes?

**Database**:
- SQLite file-based storage → PostgreSQL server
- sqlite-vec extension → pgvector extension
- File path configuration → Connection string configuration

**Search**:
- Basic vector search → Hybrid search (vector + full-text + RRF)
- Sequential scan → Optimized HNSW and GIN indexes

**Configuration**:
- `--store-path` parameter → `DATABASE_URL` environment variable
- Local file permissions → Database user permissions

---

## Prerequisites

### Required

1. **PostgreSQL 14 or later** with pgvector extension
2. **Node.js 20 or later**
3. **Backup of existing SQLite data** (if applicable)
4. **Database access credentials** (username, password, host, port)

### Installation Options

**Option A: Docker (Recommended)**
```bash
docker run -d \
  --name scrapegoat-db \
  -e POSTGRES_USER=scrapegoat \
  -e POSTGRES_PASSWORD=your_secure_password \
  -e POSTGRES_DB=scrapegoat \
  -p 5432:5432 \
  pgvector/pgvector:pg16
```

**Option B: Manual Installation**
See [POSTGRESQL_SETUP.md](./POSTGRESQL_SETUP.md) for detailed instructions.

---

## Before You Begin

### 1. Backup Existing Data

If you have an existing SQLite database with indexed documentation:

```bash
# Identify your SQLite database location
# Default: ~/.local/share/docs-mcp-server/store.db

# Create backup
cp ~/.local/share/docs-mcp-server/store.db ~/docs-mcp-backup-$(date +%Y%m%d).db
```

### 2. Document Current State

List all indexed libraries before migration:

```bash
# Using original docs-mcp-server
docs-mcp-server list
```

Save this output for verification after migration.

### 3. Verify PostgreSQL Access

Test your PostgreSQL connection:

```bash
# Using psql
psql "postgresql://scrapegoat:your_secure_password@localhost:5432/scrapegoat" \
  -c "SELECT version();"

# Using Docker
docker exec scrapegoat-db psql -U scrapegoat -d scrapegoat -c "SELECT version();"
```

---

## Migration Steps

### Step 1: Install Scrapegoat

```bash
# Install globally
npm install -g scrapegoat

# Or use locally
git clone https://github.com/yourusername/scrapegoat.git
cd scrapegoat
npm install
npm run build
```

### Step 2: Configure Database Connection

Set the `DATABASE_URL` environment variable:

```bash
export DATABASE_URL="postgresql://scrapegoat:your_secure_password@localhost:5432/scrapegoat"
```

Or create a `.env` file in your working directory:

```env
DATABASE_URL=postgresql://scrapegoat:your_secure_password@localhost:5432/scrapegoat
```

### Step 3: Initialize PostgreSQL Database

Run migrations to create the database schema:

```bash
scrapegoat init
```

This command:
- Creates all required tables (libraries, versions, pages, documents)
- Installs the pgvector extension
- Creates HNSW index for vector search
- Creates GIN index for full-text search
- Sets up foreign key constraints

Expected output:
```
Initializing PostgreSQL database...
✓ Created pgvector extension
✓ Applied migration 001: initial schema
✓ Applied migration 002: add version status
✓ Applied migration 003: add scraper options
✓ Created HNSW index for embeddings
✓ Created GIN index for full-text search
Database initialized successfully!
```

### Step 4: Re-index Documentation

**Important**: There is no automated data migration from SQLite to PostgreSQL. You need to re-index your documentation.

#### Option A: Re-index from Original Sources

If you have the original documentation URLs:

```bash
# Re-index each library
scrapegoat scrape https://docs.example.com --library example --version 1.0.0
```

#### Option B: Batch Re-indexing

Create a script to re-index multiple libraries:

```bash
#!/bin/bash
# reindex.sh

libraries=(
  "react:https://react.dev"
  "nextjs:https://nextjs.org/docs"
  "postgres:https://www.postgresql.org/docs/current/"
)

for lib in "${libraries[@]}"; do
  name="${lib%%:*}"
  url="${lib#*:}"
  echo "Indexing $name from $url..."
  scrapegoat scrape "$url" --library "$name"
done
```

#### Option C: Export/Import (Advanced)

If you need to preserve exact content and metadata:

**Export from SQLite** (requires custom script):
```sql
-- Export documents to JSON
SELECT json_group_array(
  json_object(
    'content', content,
    'metadata', metadata,
    'url', url,
    'title', title
  )
) FROM documents
JOIN pages ON documents.page_id = pages.id;
```

**Import to PostgreSQL** (requires custom import tool):
```bash
# Custom import script (not included, needs to be written)
node scripts/import-from-json.js exported-data.json
```

### Step 5: Configure Embedding Provider (Optional)

If using embeddings for semantic search:

```bash
# OpenAI
export OPENAI_API_KEY="sk-..."

# Or Google Vertex AI
export GOOGLE_VERTEX_PROJECT_ID="your-project"
export GOOGLE_VERTEX_LOCATION="us-central1"

# Or AWS Bedrock
export AWS_REGION="us-east-1"
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
```

---

## Verification

### 1. Check Database Schema

Verify tables were created:

```bash
psql $DATABASE_URL -c "\dt"
```

Expected tables:
- libraries
- versions
- pages
- documents

### 2. Verify Extensions

```bash
psql $DATABASE_URL -c "\dx"
```

Should show: `vector` extension

### 3. Verify Indexes

```bash
psql $DATABASE_URL -c "
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE tablename = 'documents';
"
```

Should show:
- HNSW index on embeddings
- GIN index on content (for full-text search)

### 4. Test Indexing

Index a small documentation site:

```bash
scrapegoat scrape https://example.com/docs --library test --version 1.0.0
```

### 5. Test Search

Search the indexed content:

```bash
scrapegoat search "your search query" --library test
```

### 6. Verify Counts

Check indexed document counts:

```bash
scrapegoat list
```

Compare with your pre-migration list to ensure all libraries are re-indexed.

---

## Troubleshooting

### Connection Refused

**Problem**: Cannot connect to PostgreSQL

**Solutions**:
1. Verify PostgreSQL is running:
   ```bash
   # Docker
   docker ps | grep scrapegoat-db

   # System service
   sudo systemctl status postgresql
   ```

2. Check connection string format:
   ```bash
   # Correct format
   postgresql://username:password@hostname:port/database

   # Example
   postgresql://scrapegoat:mypass@localhost:5432/scrapegoat
   ```

3. Verify firewall settings (PostgreSQL port 5432 or custom port)

### pgvector Extension Not Found

**Problem**: `ERROR: extension "vector" does not exist`

**Solutions**:
1. Install pgvector extension:
   ```bash
   # Ubuntu/Debian
   sudo apt install postgresql-16-pgvector

   # macOS
   brew install pgvector

   # Docker - use pgvector/pgvector image (already includes extension)
   ```

2. Create extension manually:
   ```bash
   psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"
   ```

### Migration Failed

**Problem**: `scrapegoat init` fails

**Solutions**:
1. Check PostgreSQL logs:
   ```bash
   # Docker
   docker logs scrapegoat-db

   # System
   sudo tail -f /var/log/postgresql/postgresql-16-main.log
   ```

2. Verify user permissions:
   ```bash
   psql $DATABASE_URL -c "
     SELECT has_database_privilege('scrapegoat', 'scrapegoat', 'CREATE');
   "
   ```

3. Manually create database if needed:
   ```bash
   psql postgresql://postgres@localhost:5432/postgres -c "
     CREATE DATABASE scrapegoat OWNER scrapegoat;
   "
   ```

### Slow Indexing Performance

**Problem**: Re-indexing is very slow

**Solutions**:
1. Increase connection pool size:
   ```bash
   export DATABASE_URL="postgresql://user:pass@host:5432/db?max_pool_size=20"
   ```

2. Tune PostgreSQL for write performance:
   ```sql
   -- Temporarily disable fsync for faster initial load (UNSAFE for production!)
   ALTER SYSTEM SET fsync = off;
   ALTER SYSTEM SET synchronous_commit = off;
   SELECT pg_reload_conf();

   -- REMEMBER TO RE-ENABLE AFTER INITIAL LOAD:
   ALTER SYSTEM RESET fsync;
   ALTER SYSTEM RESET synchronous_commit;
   SELECT pg_reload_conf();
   ```

3. Increase shared_buffers in postgresql.conf:
   ```
   shared_buffers = 1GB
   work_mem = 50MB
   maintenance_work_mem = 512MB
   ```

### Embedding API Rate Limits

**Problem**: Hitting rate limits during re-indexing

**Solutions**:
1. Reduce concurrency:
   ```bash
   scrapegoat scrape URL --max-concurrency 2
   ```

2. Add delays between requests (modify scraper settings)

3. Use batching for embeddings (automatically done, but verify batch size)

---

## Rollback Procedures

### If Migration Fails

**Option 1: Keep Using Original System**
- Your original SQLite database remains untouched
- Continue using docs-mcp-server as before
- No data loss

**Option 2: Clean PostgreSQL and Retry**
```bash
# Drop PostgreSQL database
psql postgresql://postgres@localhost:5432/postgres -c "DROP DATABASE scrapegoat;"

# Recreate
psql postgresql://postgres@localhost:5432/postgres -c "
  CREATE DATABASE scrapegoat OWNER scrapegoat;
"

# Retry migration
scrapegoat init
```

### If PostgreSQL Becomes Unstable

**Option 1: Restore from PostgreSQL Backup**
```bash
# If you created a PostgreSQL backup after initial migration
psql $DATABASE_URL < backup.sql
```

**Option 2: Switch Back to SQLite**
- Reinstall original docs-mcp-server
- Your SQLite backup remains available
- No permanent changes to original setup

---

## Post-Migration Checklist

- [ ] PostgreSQL connection tested and working
- [ ] All required libraries re-indexed
- [ ] Search functionality verified
- [ ] Embedding provider configured (if using)
- [ ] Connection pool sized appropriately
- [ ] Backup procedures established
- [ ] Monitoring configured
- [ ] Documentation URLs saved for future re-indexing
- [ ] Original SQLite backup stored safely
- [ ] Team members trained on new commands

---

## Additional Resources

- [PostgreSQL Setup Guide](./POSTGRESQL_SETUP.md)
- [Configuration Reference](./CONFIGURATION.md)
- [Performance Tuning](./PERFORMANCE.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [Deployment Guide](./DEPLOYMENT.md)

---

## Support

If you encounter issues not covered in this guide:

1. Check the [Troubleshooting Guide](./TROUBLESHOOTING.md)
2. Review [GitHub Issues](https://github.com/yourusername/scrapegoat/issues)
3. Open a new issue with:
   - PostgreSQL version
   - Error messages
   - Steps to reproduce
   - Database logs

---

## Summary

Key differences after migration:

| Aspect | SQLite (Original) | PostgreSQL (Scrapegoat) |
|--------|-------------------|------------------------|
| Database | File-based (store.db) | Server-based (PostgreSQL) |
| Vector Search | sqlite-vec | pgvector with HNSW |
| Full-Text Search | Basic FTS5 | Advanced FTS with GIN |
| Hybrid Search | No | Yes (RRF algorithm) |
| Scaling | Limited by file size | Scales to millions of docs |
| Concurrent Access | Limited | Full MVCC support |
| Backup | File copy | pg_dump / PITR |
| Configuration | `--store-path` | `DATABASE_URL` |

The migration process requires re-indexing your documentation, but provides significant improvements in search quality, performance, and scalability.
