# Configuration Reference

Complete configuration guide for Scrapegoat, covering database connections, embedding providers, authentication, and deployment options.

## Table of Contents

1. [Environment Variables](#environment-variables)
2. [Database Configuration](#database-configuration)
3. [Embedding Provider Configuration](#embedding-provider-configuration)
4. [Authentication Configuration](#authentication-configuration)
5. [Server Configuration](#server-configuration)
6. [Search Configuration](#search-configuration)
7. [Performance Tuning](#performance-tuning)
8. [Logging and Telemetry](#logging-and-telemetry)
9. [Docker Configuration](#docker-configuration)
10. [Production Deployment](#production-deployment)

---

## Environment Variables

### Core Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | **Yes** | - | PostgreSQL connection string |
| `PORT` | No | `6280` | Server HTTP port |
| `HOST` | No | `localhost` | Server bind address |
| `NODE_ENV` | No | `production` | Environment mode (`development`, `production`, `test`) |

### Embedding Provider Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | No | - | OpenAI API key for embeddings |
| `OPENAI_BASE_URL` | No | `https://api.openai.com/v1` | Custom OpenAI-compatible endpoint |
| `EMBEDDING_MODEL` | No | `text-embedding-3-small` | Embedding model to use |
| `EMBEDDING_DIMENSIONS` | No | `1536` | Vector dimensions (must match model) |
| `INFINITY_API_URL` | No | `http://localhost:7997` | Infinity embedding server URL |
| `GOOGLE_VERTEX_PROJECT_ID` | No | - | Google Cloud project ID |
| `GOOGLE_VERTEX_LOCATION` | No | `us-central1` | Vertex AI region |
| `AWS_REGION` | No | `us-east-1` | AWS region for Bedrock |
| `AWS_ACCESS_KEY_ID` | No | - | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | No | - | AWS secret key |
| `AZURE_OPENAI_API_KEY` | No | - | Azure OpenAI API key |
| `AZURE_OPENAI_ENDPOINT` | No | - | Azure OpenAI endpoint URL |
| `AZURE_OPENAI_DEPLOYMENT` | No | - | Azure deployment name |

### Authentication Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AUTH_ENABLED` | No | `false` | Enable OAuth2/OIDC authentication |
| `AUTH_ISSUER_URL` | No | - | OIDC issuer URL |
| `AUTH_CLIENT_ID` | No | - | OAuth2 client ID |
| `AUTH_CLIENT_SECRET` | No | - | OAuth2 client secret |
| `AUTH_REDIRECT_URI` | No | - | OAuth2 redirect URI |

### Testing Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TEST_DATABASE_URL` | No | - | PostgreSQL connection for tests |
| `CI` | No | `false` | Continuous integration mode |

---

## Database Configuration

### Connection String Format

```
postgresql://[user[:password]@][host][:port][/database][?parameters]
```

### Basic Examples

**Local Development:**
```bash
export DATABASE_URL="postgresql://scrapegoat:password@localhost:5432/scrapegoat"
```

**Docker Container:**
```bash
export DATABASE_URL="postgresql://scrapegoat:password@scrapegoat-db:5432/scrapegoat"
```

**Remote Server:**
```bash
export DATABASE_URL="postgresql://scrapegoat:password@db.example.com:5432/scrapegoat"
```

**With SSL:**
```bash
export DATABASE_URL="postgresql://scrapegoat:password@db.example.com:5432/scrapegoat?sslmode=require"
```

### Connection Pool Parameters

Add query parameters to the connection string:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `max_pool_size` | `10` | Maximum connections in pool |
| `min_pool_size` | `0` | Minimum connections in pool |
| `connection_timeout` | `30` | Connection timeout (seconds) |
| `idle_timeout` | `30` | Idle connection timeout (seconds) |
| `statement_timeout` | `60000` | Query timeout (milliseconds) |

**Example with pool configuration:**
```bash
export DATABASE_URL="postgresql://user:pass@host:5432/db?max_pool_size=20&connection_timeout=10&statement_timeout=30000"
```

### SSL/TLS Configuration

| sslmode | Description | Use Case |
|---------|-------------|----------|
| `disable` | No SSL (insecure) | Local development only |
| `allow` | Try SSL, fallback to non-SSL | Not recommended |
| `prefer` | Prefer SSL, fallback allowed | Development |
| `require` | Require SSL, no verification | Basic security |
| `verify-ca` | Require SSL, verify CA | Production |
| `verify-full` | Require SSL, verify CA and hostname | Maximum security |

**Production example:**
```bash
export DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=verify-full&sslrootcert=/path/to/ca.crt"
```

### Test Database Configuration

For running tests (separate from production database):

```bash
# .env.test file
TEST_DATABASE_URL=postgresql://scrapegoat:password@localhost:5432/scrapegoat_test
```

Tests use schema-based isolation, creating unique schemas per test:
```
test_1699564234_abc123
test_1699564235_def456
```

Each schema is automatically created and cleaned up after tests.

---

## Embedding Provider Configuration

### OpenAI (Default)

**Official OpenAI API:**
```bash
export OPENAI_API_KEY="sk-..."
export EMBEDDING_MODEL="text-embedding-3-small"  # or text-embedding-3-large
export EMBEDDING_DIMENSIONS="1536"  # 1536 for small, 3072 for large
```

**OpenAI-Compatible Endpoints (Ollama, LM Studio, etc.):**
```bash
export OPENAI_API_KEY="not-needed"  # Some endpoints don't require a key
export OPENAI_BASE_URL="http://localhost:11434/v1"  # Ollama
export EMBEDDING_MODEL="nomic-embed-text"
export EMBEDDING_DIMENSIONS="768"  # Model-specific
```

### Google Vertex AI

**Setup:**
```bash
export GOOGLE_VERTEX_PROJECT_ID="your-gcp-project"
export GOOGLE_VERTEX_LOCATION="us-central1"
export EMBEDDING_MODEL="textembedding-gecko@003"
export EMBEDDING_DIMENSIONS="768"
```

**Authentication:**
- Service account key: `export GOOGLE_APPLICATION_CREDENTIALS="/path/to/key.json"`
- Or use gcloud: `gcloud auth application-default login`

### Azure OpenAI

**Setup:**
```bash
export AZURE_OPENAI_API_KEY="your-azure-key"
export AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com/"
export AZURE_OPENAI_DEPLOYMENT="your-embedding-deployment"
export EMBEDDING_DIMENSIONS="1536"
```

### AWS Bedrock

**Setup:**
```bash
export AWS_REGION="us-east-1"
export AWS_ACCESS_KEY_ID="AKIA..."
export AWS_SECRET_ACCESS_KEY="..."
export EMBEDDING_MODEL="amazon.titan-embed-text-v1"
export EMBEDDING_DIMENSIONS="1536"
```

**IAM Permissions Required:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": "arn:aws:bedrock:*::foundation-model/amazon.titan-embed-*"
    }
  ]
}
```

### Infinity (Local Embedding Server)

**Setup:**
```bash
export INFINITY_API_URL="http://embed.den.lan"  # Or http://localhost:7997
export EMBEDDING_MODEL="infinity:nomic-ai/nomic-embed-text-v1.5"
export EMBEDDING_DIMENSIONS="768"  # Model-specific
```

**Features:**
- ✅ **Free & unlimited**: No API costs
- ✅ **Low latency**: Local network or same host
- ✅ **Privacy**: Data stays on your infrastructure
- ✅ **High throughput**: Batch processing up to 2048 items
- ✅ **OpenAI compatible**: Drop-in replacement API
- ✅ **Multi-modal**: Text, image, and audio embeddings (model dependent)

**Running Infinity Server:**

Using Docker:
```bash
docker run -p 7997:7997 \
  michaelf34/infinity:latest \
  v2 --model-id nomic-ai/nomic-embed-text-v1.5
```

Or using pip:
```bash
pip install infinity-emb
infinity_emb v2 --model-id nomic-ai/nomic-embed-text-v1.5
```

**Available Models:**
- `nomic-ai/nomic-embed-text-v1.5` (768 dims, recommended)
- `BAAI/bge-small-en-v1.5` (384 dims)
- `BAAI/bge-base-en-v1.5` (768 dims)
- `sentence-transformers/all-MiniLM-L6-v2` (384 dims)
- And many more from HuggingFace

**Documentation:**
- GitHub: https://github.com/michaelfeil/infinity
- OpenAPI docs: http://localhost:7997/docs (when running)

### Disable Embeddings (Keyword-Only Search)

To use only full-text search without vector embeddings:

```bash
# Don't set any embedding provider variables
# Or explicitly disable:
export DISABLE_EMBEDDINGS="true"
```

This mode:
- ✅ Faster indexing (no embedding generation)
- ✅ Lower cost (no API calls)
- ❌ No semantic search capabilities
- ✅ Full-text search still works

---

## Authentication Configuration

### OAuth2/OIDC Setup

**Enable Authentication:**
```bash
export AUTH_ENABLED="true"
export AUTH_ISSUER_URL="https://auth.example.com"
export AUTH_CLIENT_ID="scrapegoat-client-id"
export AUTH_CLIENT_SECRET="your-secret-here"
export AUTH_REDIRECT_URI="http://localhost:6280/auth/callback"
```

### Supported Providers

**Keycloak:**
```bash
export AUTH_ISSUER_URL="https://keycloak.example.com/realms/your-realm"
export AUTH_CLIENT_ID="scrapegoat"
export AUTH_CLIENT_SECRET="..."
```

**Auth0:**
```bash
export AUTH_ISSUER_URL="https://your-tenant.auth0.com"
export AUTH_CLIENT_ID="..."
export AUTH_CLIENT_SECRET="..."
```

**Okta:**
```bash
export AUTH_ISSUER_URL="https://your-domain.okta.com/oauth2/default"
export AUTH_CLIENT_ID="..."
export AUTH_CLIENT_SECRET="..."
```

**Google:**
```bash
export AUTH_ISSUER_URL="https://accounts.google.com"
export AUTH_CLIENT_ID="....apps.googleusercontent.com"
export AUTH_CLIENT_SECRET="..."
```

### Dynamic Client Registration

Scrapegoat supports dynamic client registration for compatible OIDC providers:

```bash
export AUTH_DYNAMIC_REGISTRATION="true"
export AUTH_ISSUER_URL="https://auth.example.com"
# Client ID and secret will be auto-registered
```

### Disable Authentication (Development)

```bash
export AUTH_ENABLED="false"
# Or omit AUTH_ENABLED (defaults to false)
```

---

## Server Configuration

### HTTP Server

**Basic Configuration:**
```bash
export PORT="6280"
export HOST="0.0.0.0"  # Bind to all interfaces
export NODE_ENV="production"
```

**Development Mode:**
```bash
export NODE_ENV="development"
export PORT="3000"
export HOST="localhost"
```

### CORS Configuration

For web interface access from different origins:

```javascript
// In src/app/AppServer.ts (if customizing)
const corsOptions = {
  origin: ['http://localhost:3000', 'https://app.example.com'],
  credentials: true
};
```

### HTTPS/TLS

**Using Reverse Proxy (Recommended):**

Configure nginx or Apache with SSL, proxy to Scrapegoat:

```nginx
server {
  listen 443 ssl http2;
  server_name docs.example.com;

  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;

  location / {
    proxy_pass http://localhost:6280;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

**Direct HTTPS (Advanced):**

Requires code modification to load SSL certificates.

---

## Search Configuration

### Search Behavior

Search parameters are configured per-request via API/MCP:

**Hybrid Search (Default):**
- Combines vector similarity and full-text search
- Uses Reciprocal Rank Fusion (RRF) to merge results
- Requires embeddings to be enabled

**Vector-Only Search:**
- Only if embeddings are enabled and FTS query fails
- Useful for semantic similarity without keywords

**Keyword-Only Search:**
- When embeddings are disabled
- Pure PostgreSQL full-text search with GIN indexes

### Search Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | required | Search query text |
| `library` | string | required | Library name |
| `version` | string | optional | Library version (latest if omitted) |
| `limit` | number | `20` | Maximum results to return |

**Example MCP tool call:**
```json
{
  "name": "search",
  "arguments": {
    "query": "authentication middleware",
    "library": "express",
    "version": "4.18.0",
    "limit": 10
  }
}
```

### Full-Text Search Configuration

Configured in PostgreSQL:

```sql
-- Set default text search configuration
ALTER DATABASE scrapegoat SET default_text_search_config = 'english';

-- For multi-language support, create custom configuration
CREATE TEXT SEARCH CONFIGURATION multilang (COPY = english);
```

### Vector Search Configuration

HNSW index parameters (set during index creation in migrations):

```sql
-- Adjust m and ef_construction for accuracy vs speed tradeoff
CREATE INDEX idx_documents_embedding_hnsw
ON documents USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `m` | `16` | 4-64 | Max connections per layer (higher = better recall, larger index) |
| `ef_construction` | `64` | 4-1000 | Build-time search effort (higher = better quality, slower build) |

At query time, `ef_search` can be adjusted:

```sql
SET hnsw.ef_search = 100;  -- Higher = better recall, slower search
```

---

## Performance Tuning

### Application-Level Tuning

**Connection Pool Size:**
```bash
# Increase for high concurrency
export DATABASE_URL="postgresql://user:pass@host:5432/db?max_pool_size=50"
```

Rule of thumb: `max_pool_size = (CPU cores * 2) + disk spindles`

**Query Timeout:**
```bash
# Prevent long-running queries
export DATABASE_URL="postgresql://user:pass@host:5432/db?statement_timeout=30000"
```

### Embedding Generation Tuning

**Batch Size:**

Embeddings are generated in batches. Adjust batch size for your provider:

```typescript
// In src/store/embeddings/EmbeddingFactory.ts (if customizing)
const batchSize = 100;  // Process 100 documents at a time
```

**Rate Limiting:**

For API rate limits, implement delays:

```typescript
// Add delay between embedding API calls
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
await delay(100);  // 100ms delay between requests
```

### Indexing Performance

**Bulk Data Loading:**

For initial large data loads:

1. Disable indexes during load
2. Load data
3. Create indexes after

```sql
-- Drop indexes before bulk load
DROP INDEX idx_documents_embedding_hnsw;
DROP INDEX idx_documents_content_fts;

-- Load data here

-- Recreate indexes (with CONCURRENTLY for production)
CREATE INDEX CONCURRENTLY idx_documents_embedding_hnsw
ON documents USING hnsw (embedding vector_cosine_ops);

CREATE INDEX CONCURRENTLY idx_documents_content_fts
ON documents USING gin(to_tsvector('english', content));
```

### Search Performance

**Increase ef_search for better recall:**
```sql
SET hnsw.ef_search = 200;
```

**Adjust RRF overfetch factor** (in DocumentStore.ts):
```typescript
private static readonly SEARCH_OVERFETCH_FACTOR = 10;  // Increase for better fusion
```

---

## Logging and Telemetry

### Application Logging

**Log Level:**
```bash
export LOG_LEVEL="info"  # debug, info, warn, error
```

**Log Format:**
```bash
export LOG_FORMAT="json"  # or "text"
```

### PostgreSQL Logging

Configure in `postgresql.conf`:

```ini
# Log all queries (development only!)
log_statement = 'all'

# Log slow queries
log_min_duration_statement = 1000  # Log queries > 1 second

# Log connections
log_connections = on
log_disconnections = on

# Log locks
log_lock_waits = on
```

### PostHog Analytics (Optional)

Scrapegoat includes PostHog for product analytics:

**Enable:**
```bash
export POSTHOG_API_KEY="phc_..."
export POSTHOG_HOST="https://app.posthog.com"
```

**Disable:**
```bash
export DISABLE_TELEMETRY="true"
# Or omit POSTHOG_API_KEY
```

### Monitoring

**pg_stat_statements:**
```sql
-- Enable extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- View query statistics
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

**Connection Monitoring:**
```sql
-- View active connections
SELECT * FROM pg_stat_activity WHERE datname = 'scrapegoat';
```

---

## Docker Configuration

### Docker Compose Example

```yaml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: scrapegoat-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: scrapegoat
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: scrapegoat
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U scrapegoat"]
      interval: 10s
      timeout: 5s
      retries: 5

  scrapegoat:
    image: ghcr.io/yourusername/scrapegoat:latest
    container_name: scrapegoat-app
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://scrapegoat:${DB_PASSWORD}@postgres:5432/scrapegoat
      PORT: 6280
      HOST: 0.0.0.0
      NODE_ENV: production
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      EMBEDDING_MODEL: text-embedding-3-small
    ports:
      - "6280:6280"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6280/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres-data:
```

### Environment File (.env)

```bash
# Database
DB_PASSWORD=your_secure_password_here

# Embeddings
OPENAI_API_KEY=sk-...

# Authentication (optional)
AUTH_ENABLED=false

# Telemetry (optional)
DISABLE_TELEMETRY=true
```

### Docker Run Command

```bash
docker run -d \
  --name scrapegoat \
  --restart unless-stopped \
  -e DATABASE_URL="postgresql://scrapegoat:password@postgres.den.lan:5432/scrapegoat" \
  -e OPENAI_API_KEY="sk-..." \
  -p 6280:6280 \
  ghcr.io/yourusername/scrapegoat:latest
```

---

## Production Deployment

### Environment Variables Checklist

Production-ready configuration:

```bash
# Database (required)
export DATABASE_URL="postgresql://scrapegoat:STRONG_PASSWORD@db.example.com:5432/scrapegoat?sslmode=verify-full"

# Server
export NODE_ENV="production"
export PORT="6280"
export HOST="0.0.0.0"

# Embeddings (recommended)
export OPENAI_API_KEY="sk-..."
export EMBEDDING_MODEL="text-embedding-3-small"

# Authentication (recommended for multi-user)
export AUTH_ENABLED="true"
export AUTH_ISSUER_URL="https://auth.example.com"
export AUTH_CLIENT_ID="scrapegoat-prod"
export AUTH_CLIENT_SECRET="..."
export AUTH_REDIRECT_URI="https://docs.example.com/auth/callback"

# Telemetry (optional)
export DISABLE_TELEMETRY="true"  # Or configure PostHog

# Logging
export LOG_LEVEL="info"
export LOG_FORMAT="json"
```

### Security Hardening

1. **Use SSL for Database:**
   ```bash
   export DATABASE_URL="...?sslmode=verify-full&sslrootcert=/etc/ssl/certs/ca.crt"
   ```

2. **Enable Authentication:**
   ```bash
   export AUTH_ENABLED="true"
   ```

3. **Use Secrets Management:**
   - AWS Secrets Manager
   - HashiCorp Vault
   - Kubernetes Secrets
   - Azure Key Vault

4. **Restrict Network Access:**
   - Use firewall rules
   - VPN for database access
   - Reverse proxy with rate limiting

5. **Regular Updates:**
   ```bash
   docker pull pgvector/pgvector:pg16
   docker pull ghcr.io/yourusername/scrapegoat:latest
   ```

### High Availability

**Database Replication:**
```bash
# Primary-replica setup
export DATABASE_URL="postgresql://scrapegoat:pass@primary:5432/scrapegoat"
export DATABASE_REPLICA_URL="postgresql://scrapegoat:pass@replica:5432/scrapegoat"
```

**Load Balancing:**

Use HAProxy or nginx to load balance multiple Scrapegoat instances:

```nginx
upstream scrapegoat_backend {
  least_conn;
  server scrapegoat1:6280;
  server scrapegoat2:6280;
  server scrapegoat3:6280;
}
```

**Horizontal Scaling:**

Scrapegoat is stateless (except database), so scale horizontally:

```bash
# Start multiple instances
docker run -d --name scrapegoat-1 ... scrapegoat
docker run -d --name scrapegoat-2 ... scrapegoat
docker run -d --name scrapegoat-3 ... scrapegoat
```

### Backup Strategy

**Automated PostgreSQL Backups:**

```bash
#!/bin/bash
# backup.sh - Run daily via cron

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/postgres"

pg_dump "$DATABASE_URL" -Fc -f "${BACKUP_DIR}/scrapegoat_${DATE}.dump"

# Retain 7 days of backups
find "$BACKUP_DIR" -name "*.dump" -mtime +7 -delete
```

**Restore:**
```bash
pg_restore -d scrapegoat -c /backups/postgres/scrapegoat_20250108.dump
```

### Monitoring Endpoints

**Health Check:**
```bash
curl http://localhost:6280/health
# Response: {"status":"ok","database":"connected"}
```

**Metrics (if implemented):**
```bash
curl http://localhost:6280/metrics
```

---

## Summary

### Minimal Configuration

```bash
# .env file
DATABASE_URL=postgresql://scrapegoat:password@localhost:5432/scrapegoat
```

### Recommended Configuration

```bash
# .env file
DATABASE_URL=postgresql://scrapegoat:password@localhost:5432/scrapegoat
OPENAI_API_KEY=sk-...
EMBEDDING_MODEL=text-embedding-3-small
PORT=6280
NODE_ENV=production
```

### Production Configuration

```bash
# .env file
DATABASE_URL=postgresql://scrapegoat:PASSWORD@db.example.com:5432/scrapegoat?sslmode=verify-full&max_pool_size=20
OPENAI_API_KEY=sk-...
EMBEDDING_MODEL=text-embedding-3-small
PORT=6280
HOST=0.0.0.0
NODE_ENV=production
AUTH_ENABLED=true
AUTH_ISSUER_URL=https://auth.example.com
AUTH_CLIENT_ID=scrapegoat-prod
AUTH_CLIENT_SECRET=...
AUTH_REDIRECT_URI=https://docs.example.com/auth/callback
LOG_LEVEL=info
LOG_FORMAT=json
DISABLE_TELEMETRY=true
```

---

## Additional Resources

- [PostgreSQL Setup Guide](./POSTGRESQL_SETUP.md)
- [Migration Guide](./MIGRATION.md)
- [Deployment Modes](./deployment-modes.md)
- [Data Storage Architecture](./data-storage.md)
- [PostgreSQL Connection String Documentation](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING)
- [pgvector Configuration](https://github.com/pgvector/pgvector#configuration)

---

**Need Help?** See [Troubleshooting](./POSTGRESQL_SETUP.md#troubleshooting) in the PostgreSQL Setup Guide.
