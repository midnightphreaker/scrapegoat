# PostgreSQL Setup Guide

Complete guide for installing and configuring PostgreSQL with pgvector for Scrapegoat.

## Table of Contents

1. [Quick Start (Docker)](#quick-start-docker)
2. [Platform-Specific Installation](#platform-specific-installation)
3. [pgvector Extension Installation](#pgvector-extension-installation)
4. [Database Creation](#database-creation)
5. [User and Permissions](#user-and-permissions)
6. [Performance Tuning](#performance-tuning)
7. [Remote Server Setup](#remote-server-setup)
8. [Security Best Practices](#security-best-practices)
9. [Verification](#verification)
10. [Troubleshooting](#troubleshooting)

---

## Quick Start (Docker)

**Recommended** for development and testing. Includes PostgreSQL 16 with pgvector pre-installed.

### Production-Ready Setup

```bash
# Create data volume for persistence
docker volume create scrapegoat-data

# Run PostgreSQL with pgvector
docker run -d \
  --name scrapegoat-db \
  --restart unless-stopped \
  -e POSTGRES_USER=scrapegoat \
  -e POSTGRES_PASSWORD=your_secure_password_here \
  -e POSTGRES_DB=scrapegoat \
  -v scrapegoat-data:/var/lib/postgresql/data \
  -p 5432:5432 \
  pgvector/pgvector:pg16
```

### Verify Installation

```bash
# Check container is running
docker ps | grep scrapegoat-db

# Test connection
docker exec scrapegoat-db psql -U scrapegoat -c "SELECT version();"

# Verify pgvector extension
docker exec scrapegoat-db psql -U scrapegoat -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

**Connection String:**
```
postgresql://scrapegoat:your_secure_password_here@localhost:5432/scrapegoat
```

---

## Platform-Specific Installation

### Ubuntu/Debian

**PostgreSQL 16 (Recommended)**

```bash
# Add PostgreSQL APT repository
sudo apt install -y wget ca-certificates
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list

# Install PostgreSQL 16
sudo apt update
sudo apt install -y postgresql-16 postgresql-client-16

# Start and enable service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify installation
psql --version
```

### macOS

**Using Homebrew (Recommended)**

```bash
# Install PostgreSQL 16
brew install postgresql@16

# Start service
brew services start postgresql@16

# Verify installation
psql --version
```

**Alternative: Postgres.app**

1. Download from https://postgresapp.com/
2. Drag to Applications folder
3. Open Postgres.app
4. Click "Initialize" to create a new server
5. PostgreSQL is now running

### Windows

**Using Official Installer (Recommended)**

1. Download from https://www.postgresql.org/download/windows/
2. Run the installer (select PostgreSQL 16)
3. During installation:
   - Set data directory (default: `C:\Program Files\PostgreSQL\16\data`)
   - Set superuser password
   - Select port 5432 (default)
   - Select locale (default: English)
4. Complete installation
5. PostgreSQL service starts automatically

**Using WSL2 (Alternative)**

Follow Ubuntu/Debian instructions within WSL2.

### CentOS/RHEL/Fedora

```bash
# Add PostgreSQL repository
sudo dnf install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-$(rpm -E %{rhel})-x86_64/pgdg-redhat-repo-latest.noarch.rpm

# Disable built-in PostgreSQL module
sudo dnf -qy module disable postgresql

# Install PostgreSQL 16
sudo dnf install -y postgresql16-server postgresql16-contrib

# Initialize database
sudo /usr/pgsql-16/bin/postgresql-16-setup initdb

# Start and enable service
sudo systemctl start postgresql-16
sudo systemctl enable postgresql-16

# Verify installation
psql --version
```

### Arch Linux

```bash
# Install PostgreSQL
sudo pacman -S postgresql

# Initialize database cluster
sudo -u postgres initdb -D /var/lib/postgres/data

# Start and enable service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify installation
psql --version
```

---

## pgvector Extension Installation

The pgvector extension is required for vector similarity search.

### Ubuntu/Debian

```bash
# Install build dependencies
sudo apt install -y build-essential postgresql-server-dev-16 git

# Clone and build pgvector
cd /tmp
git clone --branch v0.8.1 https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install

# Verify installation
sudo -u postgres psql -c "CREATE EXTENSION vector;" -d postgres
```

### macOS

```bash
# Install using Homebrew
brew install pgvector

# Verify installation (after creating a database)
psql -U postgres -c "CREATE EXTENSION vector;" -d postgres
```

### Windows

**Option 1: Pre-built Binary**

1. Download from https://github.com/pgvector/pgvector/releases
2. Extract files to PostgreSQL extension directory:
   - DLL: `C:\Program Files\PostgreSQL\16\lib\`
   - Control/SQL: `C:\Program Files\PostgreSQL\16\share\extension\`
3. Restart PostgreSQL service

**Option 2: Build from Source (WSL2)**

Follow Ubuntu/Debian instructions within WSL2.

### Docker (Pre-installed)

pgvector is pre-installed in the `pgvector/pgvector:pg16` image. No additional setup needed.

### Verify pgvector Installation

```bash
psql -U postgres -d postgres -c "SELECT * FROM pg_available_extensions WHERE name = 'vector';"
```

Expected output shows `vector` extension with version `0.8.1` or later.

---

## Database Creation

### Create Database and User

```bash
# Switch to postgres user (Linux/macOS)
sudo -u postgres psql

# Or connect directly (Docker/Windows)
psql -U postgres
```

```sql
-- Create database user
CREATE USER scrapegoat WITH PASSWORD 'your_secure_password';

-- Create database
CREATE DATABASE scrapegoat OWNER scrapegoat;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE scrapegoat TO scrapegoat;

-- Connect to new database
\c scrapegoat

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify extension
\dx vector
```

### Connection String

After setup, your connection string should be:

```
postgresql://scrapegoat:your_secure_password@localhost:5432/scrapegoat
```

For remote servers, replace `localhost` with the server hostname or IP.

---

## User and Permissions

### Minimal Permissions (Production)

For production, limit user permissions:

```sql
-- Create user with minimal privileges
CREATE USER scrapegoat WITH PASSWORD 'your_secure_password';

-- Grant database creation (for migrations)
ALTER USER scrapegoat CREATEDB;

-- Create database
CREATE DATABASE scrapegoat OWNER scrapegoat;

-- Connect as scrapegoat user
\c scrapegoat scrapegoat

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
```

### Development Permissions

For development/testing, use broader permissions:

```sql
-- Create superuser (development only!)
CREATE USER scrapegoat WITH SUPERUSER PASSWORD 'dev_password';

-- Create database
CREATE DATABASE scrapegoat OWNER scrapegoat;
```

⚠️ **Never use SUPERUSER in production!**

### Test Database Setup

For running tests (as done in Phase 5.2):

```sql
-- Create test database
CREATE DATABASE scrapegoat_test OWNER scrapegoat;

-- Connect to test database
\c scrapegoat_test

-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;
```

---

## Performance Tuning

### Recommended Settings for Scrapegoat

Edit `postgresql.conf` (location varies by platform):

- **Ubuntu/Debian**: `/etc/postgresql/16/main/postgresql.conf`
- **macOS (Homebrew)**: `/opt/homebrew/var/postgresql@16/postgresql.conf`
- **Windows**: `C:\Program Files\PostgreSQL\16\data\postgresql.conf`
- **Docker**: Mount config file or use environment variables

```ini
# Memory Configuration (adjust based on available RAM)
shared_buffers = 4GB                # 25% of total RAM
effective_cache_size = 12GB         # 75% of total RAM
work_mem = 50MB                     # Per-operation memory
maintenance_work_mem = 1GB          # For VACUUM, CREATE INDEX

# Vector Search Optimization
# (No specific pgvector settings needed, uses above memory config)

# Full-Text Search Optimization
default_text_search_config = 'english'

# Connection Pooling
max_connections = 100
shared_preload_libraries = 'pg_stat_statements'

# Write-Ahead Logging (for safety)
wal_level = replica
archive_mode = on
archive_command = 'cp %p /path/to/archive/%f'

# Query Optimization
random_page_cost = 1.1              # SSD optimized (default: 4.0)
effective_io_concurrency = 200      # SSD parallel I/O

# Logging (helpful for debugging)
log_statement = 'mod'               # Log all data-modifying statements
log_duration = on
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
```

### Apply Configuration Changes

```bash
# Ubuntu/Debian
sudo systemctl reload postgresql

# macOS (Homebrew)
brew services restart postgresql@16

# Windows (run as Administrator)
pg_ctl reload -D "C:\Program Files\PostgreSQL\16\data"

# Docker
docker restart scrapegoat-db
```

### Index Tuning for HNSW

HNSW indexes are created by migrations. To tune for your workload:

```sql
-- Check index size
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE tablename = 'documents';

-- Reindex if needed (after bulk data load)
REINDEX INDEX CONCURRENTLY idx_documents_embedding_hnsw;
```

### Vacuum and Analyze

Run regularly to maintain performance:

```bash
# Manual vacuum (run after large data changes)
psql $DATABASE_URL -c "VACUUM ANALYZE documents;"

# Enable autovacuum (should be on by default)
psql $DATABASE_URL -c "ALTER TABLE documents SET (autovacuum_enabled = true);"
```

---

## Remote Server Setup

### Network Configuration

**Allow Remote Connections**

Edit `postgresql.conf`:

```ini
listen_addresses = '*'  # Or specify IP addresses
port = 5432
```

Edit `pg_hba.conf`:

```
# TYPE  DATABASE        USER            ADDRESS                 METHOD
host    scrapegoat      scrapegoat      0.0.0.0/0               scram-sha-256
host    scrapegoat      scrapegoat      ::/0                    scram-sha-256
```

For production, restrict to specific IP ranges:

```
host    scrapegoat      scrapegoat      192.168.1.0/24          scram-sha-256
host    scrapegoat      scrapegoat      10.0.0.0/8              scram-sha-256
```

**Restart PostgreSQL** to apply changes.

### Firewall Configuration

**Ubuntu/Debian (ufw)**

```bash
sudo ufw allow 5432/tcp
sudo ufw reload
```

**CentOS/RHEL (firewalld)**

```bash
sudo firewall-cmd --permanent --add-port=5432/tcp
sudo firewall-cmd --reload
```

**Docker**

```bash
# Expose port in docker run
docker run -p 5432:5432 pgvector/pgvector:pg16

# Or in docker-compose.yml
ports:
  - "5432:5432"
```

### SSL/TLS Configuration (Recommended)

**Generate Self-Signed Certificate** (for testing):

```bash
# Create SSL certificate
cd /var/lib/postgresql/16/main  # Adjust path for your OS
sudo -u postgres openssl req -new -x509 -days 365 -nodes -text \
  -out server.crt -keyout server.key -subj "/CN=postgres.example.com"

# Set permissions
sudo chmod 600 server.key
sudo chown postgres:postgres server.key server.crt
```

**Configure PostgreSQL** (in `postgresql.conf`):

```ini
ssl = on
ssl_cert_file = 'server.crt'
ssl_key_file = 'server.key'
```

**Connection String with SSL**:

```
postgresql://scrapegoat:password@hostname:5432/scrapegoat?sslmode=require
```

For production, use a proper certificate from Let's Encrypt or your CA.

---

## Security Best Practices

### 1. Strong Passwords

```bash
# Generate strong password
openssl rand -base64 32

# Set password in PostgreSQL
ALTER USER scrapegoat WITH PASSWORD 'generated_password_here';
```

### 2. Limit User Permissions

```sql
-- Revoke unnecessary privileges
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO scrapegoat;

-- Prevent user from creating new databases
ALTER USER scrapegoat NOCREATEDB;

-- Prevent user from creating roles
ALTER USER scrapegoat NOCREATEROLE;
```

### 3. Network Security

- Use SSL/TLS for all connections
- Restrict `pg_hba.conf` to specific IP ranges
- Use firewall rules to limit access
- Consider VPN for remote access

### 4. Regular Backups

```bash
# Daily backup script
#!/bin/bash
BACKUP_DIR="/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup
pg_dump "postgresql://scrapegoat:password@localhost:5432/scrapegoat" \
  -Fc -f "${BACKUP_DIR}/scrapegoat_${DATE}.dump"

# Compress old backups
find "$BACKUP_DIR" -name "*.dump" -mtime +7 -exec gzip {} \;

# Delete backups older than 30 days
find "$BACKUP_DIR" -name "*.dump.gz" -mtime +30 -delete
```

### 5. Monitoring

Install `pg_stat_statements` for query monitoring:

```sql
-- Enable extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View slow queries
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

---

## Verification

### Check PostgreSQL Version

```bash
psql --version
# Expected: psql (PostgreSQL) 16.x or later
```

### Check pgvector Extension

```bash
psql -U scrapegoat -d scrapegoat -c "\dx vector"
# Should show vector extension version 0.8.1 or later
```

### Test Vector Operations

```sql
-- Create test table
CREATE TABLE test_vectors (
  id serial PRIMARY KEY,
  embedding vector(3)
);

-- Insert test data
INSERT INTO test_vectors (embedding) VALUES
  ('[1,2,3]'),
  ('[4,5,6]'),
  ('[7,8,9]');

-- Test cosine distance
SELECT id, embedding <=> '[2,3,4]'::vector AS distance
FROM test_vectors
ORDER BY distance
LIMIT 2;

-- Cleanup
DROP TABLE test_vectors;
```

### Test Full-Text Search

```sql
-- Create test table
CREATE TABLE test_fts (
  id serial PRIMARY KEY,
  content text
);

-- Create GIN index
CREATE INDEX test_fts_idx ON test_fts USING gin(to_tsvector('english', content));

-- Insert test data
INSERT INTO test_fts (content) VALUES
  ('PostgreSQL is a powerful database'),
  ('Full-text search is fast'),
  ('Vector search with pgvector');

-- Test search
SELECT id, content,
  ts_rank(to_tsvector('english', content), plainto_tsquery('english', 'database')) as rank
FROM test_fts
WHERE to_tsvector('english', content) @@ plainto_tsquery('english', 'database')
ORDER BY rank DESC;

-- Cleanup
DROP TABLE test_fts;
```

### Run Scrapegoat Migrations

```bash
# Set connection string
export DATABASE_URL="postgresql://scrapegoat:password@localhost:5432/scrapegoat"

# Navigate to project directory
cd /path/to/scrapegoat

# Run migrations
npm run migrate
# Or if built:
node dist/cli.js migrate
```

Expected output:
```
✓ Applied migration 001: initial schema
✓ Applied migration 002: GIN indexes
✓ Applied migration 003: HNSW indexes
✓ Applied migration 010: indexed_at column
All migrations applied successfully!
```

---

## Troubleshooting

### Connection Refused

**Problem**: `ECONNREFUSED` error when connecting

**Solutions**:

1. Check PostgreSQL is running:
   ```bash
   # Linux
   sudo systemctl status postgresql

   # macOS
   brew services list | grep postgresql

   # Docker
   docker ps | grep scrapegoat-db
   ```

2. Verify port:
   ```bash
   sudo netstat -plnt | grep 5432
   # Or
   sudo lsof -i :5432
   ```

3. Check `listen_addresses` in `postgresql.conf`:
   ```ini
   listen_addresses = 'localhost'  # Or '*' for all interfaces
   ```

### Authentication Failed

**Problem**: `password authentication failed for user "scrapegoat"`

**Solutions**:

1. Reset password:
   ```sql
   ALTER USER scrapegoat WITH PASSWORD 'new_password';
   ```

2. Check `pg_hba.conf` authentication method:
   ```
   local   all   scrapegoat   scram-sha-256
   host    all   scrapegoat   127.0.0.1/32   scram-sha-256
   ```

3. Reload configuration:
   ```bash
   sudo systemctl reload postgresql
   ```

### pgvector Extension Not Found

**Problem**: `extension "vector" does not exist`

**Solutions**:

1. Verify pgvector is installed:
   ```bash
   # Check for vector library
   ls /usr/lib/postgresql/16/lib/vector.so
   # Or
   ls /opt/homebrew/lib/postgresql@16/vector.so
   ```

2. Reinstall pgvector (see [Installation](#pgvector-extension-installation))

3. Check PostgreSQL version compatibility (requires 12+)

### Slow HNSW Index Creation

**Problem**: Index creation takes very long or times out

**Solutions**:

1. Increase `maintenance_work_mem`:
   ```sql
   SET maintenance_work_mem = '2GB';
   CREATE INDEX idx_documents_embedding_hnsw ON documents
   USING hnsw (embedding vector_cosine_ops);
   ```

2. Use `CONCURRENTLY` to avoid locking:
   ```sql
   CREATE INDEX CONCURRENTLY idx_documents_embedding_hnsw
   ON documents USING hnsw (embedding vector_cosine_ops);
   ```

3. Create index after data load (not before)

### Out of Memory

**Problem**: PostgreSQL crashes or OOM killer terminates process

**Solutions**:

1. Reduce `shared_buffers` and `work_mem` in `postgresql.conf`

2. Limit connection pool size in application:
   ```bash
   export DATABASE_URL="postgresql://user:pass@host:5432/db?max_pool_size=10"
   ```

3. Add swap space (Linux):
   ```bash
   sudo fallocate -l 4G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

### Docker Container Exits

**Problem**: Container stops unexpectedly

**Solutions**:

1. Check logs:
   ```bash
   docker logs scrapegoat-db
   ```

2. Verify volume permissions:
   ```bash
   docker volume inspect scrapegoat-data
   ```

3. Increase container memory limit:
   ```bash
   docker run -m 4g pgvector/pgvector:pg16
   ```

---

## Additional Resources

- [PostgreSQL Official Documentation](https://www.postgresql.org/docs/16/)
- [pgvector GitHub Repository](https://github.com/pgvector/pgvector)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Scrapegoat Configuration Guide](./CONFIGURATION.md)
- [Scrapegoat Migration Guide](./MIGRATION.md)

---

## Summary

Key steps to set up PostgreSQL for Scrapegoat:

1. ✅ Install PostgreSQL 16+ (or use Docker with `pgvector/pgvector:pg16`)
2. ✅ Install pgvector extension (v0.8.1+)
3. ✅ Create database and user with appropriate permissions
4. ✅ Enable pgvector extension in database
5. ✅ Configure performance settings in `postgresql.conf`
6. ✅ Set up SSL/TLS for remote connections (production)
7. ✅ Configure firewall and network access
8. ✅ Run Scrapegoat migrations to create schema
9. ✅ Verify with test queries

**Next Steps**: See [CONFIGURATION.md](./CONFIGURATION.md) for application configuration and [MIGRATION.md](./MIGRATION.md) for migrating from SQLite.
