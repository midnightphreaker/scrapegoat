# Configuration Reference - Complete Environment Variables

**Deployment**: Scrapegoat Docker Compose BYO
**Target**: docs.den.lan (10.1.1.27)
**Date**: 2025-11-10

---

## Complete .env File Template

This is the complete .env file that should be created in `/opt/scrapegoat-docker/.env`:

```bash
# ============================================================================
# Scrapegoat BYO Configuration - docs.den.lan
# ============================================================================
# Created: 2025-11-10
# Configuration: BYO (Bring Your Own) - External PostgreSQL and Embedding
# Server: docs.den.lan (10.1.1.27)

# ----------------------------------------------------------------------------
# DATABASE CONFIGURATION (Required)
# ----------------------------------------------------------------------------
# PostgreSQL connection URL with pgvector extension
# Format: postgresql://username:password@host:port/database
# Replace YOUR_GENERATED_PASSWORD with actual password from Phase 2
DATABASE_URL=postgresql://scrapegoat_user:YOUR_GENERATED_PASSWORD@postgres.den.lan:5432/scrapegoat

# ----------------------------------------------------------------------------
# EMBEDDING API CONFIGURATION (Required)
# ----------------------------------------------------------------------------
# OpenAI-compatible embedding API endpoint
# IMPORTANT: Include /v1 suffix for OpenAI-compatible APIs
OPENAI_API_BASE=http://embed.den.lan/v1

# API key for embedding service
# Set to 'not-required' for local Infinity service without authentication
OPENAI_API_KEY=not-required

# Embedding model name
# Must match the model available on embed.den.lan
# Model: nomic-ai/nomic-embed-text-v1.5 (768 dimensions)
DOCS_MCP_EMBEDDING_MODEL=nomic-ai/nomic-embed-text-v1.5

# ----------------------------------------------------------------------------
# SERVICE PORTS
# ----------------------------------------------------------------------------
# MCP Server (Model Context Protocol) - AI tool integration endpoint
MCP_PORT=6280

# Web UI - Browser-based management interface
WEB_PORT=80

# Worker API - Background processing and documentation scraping
WORKER_PORT=8080

# ----------------------------------------------------------------------------
# CRAWL4AI CONFIGURATION (Optional)
# ----------------------------------------------------------------------------
# Enable Crawl4AI for enhanced web scraping with Playwright
# Set to 'true' to enable, 'false' to disable
# Requires --profile crawl4ai when starting docker compose
CRAWL4AI_ENABLED=true

# Crawl4AI service URL
# Use localhost when services use host networking
CRAWL4AI_SERVICE_URL=http://localhost:8001

# Crawl4AI verbosity for debugging
# Set to 'true' for detailed logs, 'false' for normal operation
CRAWL4AI_VERBOSE=false

# Crawl4AI headless mode
# Set to 'true' for headless Chromium (production)
# Set to 'false' to see browser (debugging only)
CRAWL4AI_HEADLESS=true

# Maximum concurrent Crawl4AI requests
# Lower value for resource-constrained systems
# Higher value for better throughput
CRAWL4AI_MAX_CONCURRENT=5

# Crawl4AI request timeout in seconds
# Increase for slow websites or complex JavaScript
CRAWL4AI_TIMEOUT=30

# ----------------------------------------------------------------------------
# APPLICATION CONFIGURATION
# ----------------------------------------------------------------------------
# Data storage path (used inside containers)
# Stores temporary files and caches
DOCS_MCP_STORE_PATH=/data

# Node.js environment
# Set to 'production' for deployment
NODE_ENV=production

# ----------------------------------------------------------------------------
# OPTIONAL TELEMETRY
# ----------------------------------------------------------------------------
# PostHog analytics API key
# Leave empty to disable analytics (recommended for private deployments)
POSTHOG_API_KEY=

# ----------------------------------------------------------------------------
# NOTES
# ----------------------------------------------------------------------------
# 1. This file contains sensitive information - never commit to version control
# 2. File permissions should be 600 (chmod 600 .env)
# 3. Ensure PostgreSQL has pgvector extension enabled before deployment
# 4. Verify embedding service is accessible before deployment
# 5. Test DATABASE_URL connection before starting services
```

---

## Environment Variables Detailed Reference

### DATABASE_URL

**Required**: Yes
**Format**: `postgresql://username:password@host:port/database`
**Example**: `postgresql://scrapegoat_user:Xk7mN9pQwR2tY5vL8zB3nH6jF4sD1gA@postgres.den.lan:5432/scrapegoat`

**Description**: PostgreSQL connection string for the scrapegoat database.

**Components**:
- **Protocol**: `postgresql://` (required)
- **Username**: `scrapegoat_user` (created in Phase 2)
- **Password**: Generated secure password from Phase 2 (base64, 32 characters)
- **Host**: `postgres.den.lan` (10.1.1.15)
- **Port**: `5432` (PostgreSQL default)
- **Database**: `scrapegoat` (created in Phase 2)

**Validation**:
```bash
# Test connection
psql "${DATABASE_URL}" -c "SELECT version();"

# Should return PostgreSQL version
```

**Common Issues**:
- Missing password or incorrect password
- Host not accessible (firewall, network)
- Database not created
- User not granted privileges

---

### OPENAI_API_BASE

**Required**: Yes (for vector search)
**Format**: `http://host:port/v1` or `https://host:port/v1`
**Example**: `http://embed.den.lan/v1`

**Description**: Base URL for OpenAI-compatible embedding API endpoint.

**IMPORTANT**: Must include `/v1` suffix for OpenAI-compatible APIs like Infinity.

**Target Service**: Infinity embedding service on embed.den.lan (10.1.1.61)

**Validation**:
```bash
# Test models endpoint
curl ${OPENAI_API_BASE}/models

# Should return list of available models including nomic-ai/nomic-embed-text-v1.5
```

**Common Issues**:
- Missing `/v1` suffix
- Service not running on embed.den.lan
- Firewall blocking connection
- Wrong port number

---

### OPENAI_API_KEY

**Required**: Yes (can be placeholder)
**Format**: String
**Example**: `not-required`

**Description**: API key for embedding service authentication.

**For Local Infinity Service**: Set to `not-required` since Infinity doesn't require authentication in local deployment.

**For External OpenAI**: Set to actual API key (e.g., `sk-proj-...`)

**Validation**: API key is validated when first embedding request is made.

---

### DOCS_MCP_EMBEDDING_MODEL

**Required**: Yes (for vector search)
**Format**: String (model identifier)
**Example**: `nomic-ai/nomic-embed-text-v1.5`

**Description**: Embedding model to use for vector generation.

**Target Model**: nomic-ai/nomic-embed-text-v1.5
- **Dimensions**: 768
- **Provider**: Infinity on embed.den.lan
- **Performance**: ~0.5s per batch

**Supported Models** (on embed.den.lan):
- `nomic-ai/nomic-embed-text-v1.5` (recommended, 768 dim)

**Validation**:
```bash
# Verify model is available
curl http://embed.den.lan/models | jq '.[] | select(.id=="nomic-ai/nomic-embed-text-v1.5")'

# Test embedding generation
curl -X POST http://embed.den.lan/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "input": ["test document"],
    "model": "nomic-ai/nomic-embed-text-v1.5"
  }' | jq '.data[0].embedding | length'

# Should return: 768
```

**Common Issues**:
- Model name typo
- Model not loaded on embedding service
- Embedding dimension mismatch

---

### Service Ports

#### MCP_PORT

**Required**: Yes
**Default**: `6280`
**Description**: Port for Model Context Protocol server (AI tool integration)

**Endpoints**:
- HTTP: `http://localhost:6280/mcp`
- SSE: `http://localhost:6280/sse`
- Health: `http://localhost:6280/health`

**Access**: External access via http://docs.den.lan:6280

---

#### WEB_PORT

**Required**: Yes
**Default**: `80`
**Description**: Port for web management interface

**Endpoints**:
- Web UI: `http://localhost:80/`
- Health: `http://localhost:80/health`

**Access**: External access via http://docs.den.lan

---

#### WORKER_PORT

**Required**: Yes
**Default**: `8080`
**Description**: Port for worker API (documentation processing)

**Endpoints**:
- API: `http://localhost:8080/api`
- Health: `http://localhost:8080/health`

**Access**: Internal only (MCP and Web connect to worker)

---

### Crawl4AI Configuration

#### CRAWL4AI_ENABLED

**Required**: No
**Default**: `false`
**Values**: `true` | `false`
**Description**: Enable/disable Crawl4AI service for AI-optimized web scraping

**When Enabled**:
- Use `docker compose --profile crawl4ai up -d` to start
- Provides better content extraction
- Requires more resources (2GB RAM, Chromium)

**When Disabled**:
- Standard HTTP fetcher used
- Lower resource usage
- Still functional, less optimized

---

#### CRAWL4AI_SERVICE_URL

**Required**: If CRAWL4AI_ENABLED=true
**Default**: `http://localhost:8001`
**Description**: URL to Crawl4AI service

**Note**: Use `localhost` for host networking mode (Proxmox compatibility)

---

#### CRAWL4AI_VERBOSE

**Required**: No
**Default**: `false`
**Values**: `true` | `false`
**Description**: Enable detailed Crawl4AI logging for debugging

---

#### CRAWL4AI_HEADLESS

**Required**: No
**Default**: `true`
**Values**: `true` | `false`
**Description**: Run Chromium in headless mode (no GUI)

**Production**: Always use `true`
**Debugging**: Set to `false` to see browser window

---

#### CRAWL4AI_MAX_CONCURRENT

**Required**: No
**Default**: `5`
**Range**: 1-10
**Description**: Maximum concurrent web scraping requests

**Tuning**:
- Low resources: 2-3
- Medium resources: 5 (recommended)
- High resources: 8-10

---

#### CRAWL4AI_TIMEOUT

**Required**: No
**Default**: `30` (seconds)
**Range**: 10-120
**Description**: Timeout for web scraping requests

**Tuning**:
- Fast sites: 15-20 seconds
- Slow sites or complex JS: 60-90 seconds

---

### Application Configuration

#### DOCS_MCP_STORE_PATH

**Required**: No
**Default**: `/data`
**Description**: Path for storing application data inside containers

**Note**: Mapped to Docker volume `scrapegoat-data`

---

#### NODE_ENV

**Required**: No
**Default**: `development`
**Recommended**: `production`
**Values**: `development` | `production` | `test`

**Description**: Node.js runtime environment

**Production Mode**:
- Optimized performance
- Reduced logging
- Error handling for stability

---

### Optional Telemetry

#### POSTHOG_API_KEY

**Required**: No
**Default**: Empty (disabled)
**Description**: PostHog analytics API key

**Recommendation**: Leave empty for private deployments to disable telemetry

---

## Configuration Validation Checklist

Before starting services, verify all configuration:

### Database Configuration
- [ ] DATABASE_URL format is correct
- [ ] Username is `scrapegoat_user`
- [ ] Password matches generated password from Phase 2
- [ ] Host is `postgres.den.lan`
- [ ] Port is `5432`
- [ ] Database name is `scrapegoat`
- [ ] Connection test successful

### Embedding Configuration
- [ ] OPENAI_API_BASE includes `/v1` suffix
- [ ] Host is `embed.den.lan`
- [ ] OPENAI_API_KEY is `not-required`
- [ ] DOCS_MCP_EMBEDDING_MODEL is `nomic-ai/nomic-embed-text-v1.5`
- [ ] Model availability test successful

### Port Configuration
- [ ] MCP_PORT is `6280`
- [ ] WEB_PORT is `80`
- [ ] WORKER_PORT is `8080`
- [ ] All ports are available (not in use)

### Crawl4AI Configuration
- [ ] CRAWL4AI_ENABLED set to desired value
- [ ] If enabled, service URL is correct
- [ ] CRAWL4AI_HEADLESS is `true` for production
- [ ] Concurrent limit appropriate for resources

### Security
- [ ] .env file permissions set to 600
- [ ] No sensitive data in version control
- [ ] Passwords are strong and unique

---

## Environment-Specific Configurations

### Development vs Production

**Development**:
```bash
NODE_ENV=development
CRAWL4AI_ENABLED=false  # Optional, save resources
CRAWL4AI_VERBOSE=true   # If testing Crawl4AI
```

**Production**:
```bash
NODE_ENV=production
CRAWL4AI_ENABLED=true   # For best quality
CRAWL4AI_VERBOSE=false
CRAWL4AI_HEADLESS=true
```

---

## Testing Configuration

After creating .env file:

```bash
# 1. Verify file exists and has correct permissions
ls -la /opt/scrapegoat-docker/.env
# Expected: -rw------- 1 root root

# 2. Check DATABASE_URL (password should be set)
grep DATABASE_URL /opt/scrapegoat-docker/.env | grep -v "YOUR_GENERATED_PASSWORD"
# Should show actual password

# 3. Validate Docker Compose can read config
cd /opt/scrapegoat-docker
docker compose config > /dev/null
# No errors = success

# 4. Test database connection
psql "$(grep DATABASE_URL .env | cut -d'=' -f2-)" -c "SELECT 1;"
# Expected: (1 row)

# 5. Test embedding service
EMBED_BASE=$(grep OPENAI_API_BASE .env | cut -d'=' -f2-)
curl -s "${EMBED_BASE}/models" | jq -r '.[0].id'
# Expected: Model name
```

---

## Troubleshooting Configuration Issues

### Database Connection Fails

```bash
# Check each component
echo "Testing database connection..."

# 1. Can we reach the host?
ping -c 3 postgres.den.lan

# 2. Is port accessible?
nc -zv postgres.den.lan 5432

# 3. Can we authenticate?
psql -h postgres.den.lan -U scrapegoat_user -d scrapegoat -c "SELECT 1;"

# 4. Is DATABASE_URL formatted correctly?
grep DATABASE_URL .env
# Should be: postgresql://scrapegoat_user:PASSWORD@postgres.den.lan:5432/scrapegoat
```

### Embedding Service Connection Fails

```bash
# Check each component
echo "Testing embedding service..."

# 1. Can we reach the host?
ping -c 3 embed.den.lan

# 2. Is service responding?
curl -v http://embed.den.lan/models

# 3. Is /v1 suffix included?
grep OPENAI_API_BASE .env
# Should be: http://embed.den.lan/v1 (WITH /v1)

# 4. Is model available?
curl -s http://embed.den.lan/models | jq -r '.[].id' | grep nomic
```

---

## Configuration Management

### Backup Configuration

```bash
# Backup .env file (without sensitive data committed to repo)
cp /opt/scrapegoat-docker/.env /opt/scrapegoat-docker/.env.backup.$(date +%Y%m%d)
```

### Update Configuration

```bash
# To update configuration:
# 1. Edit .env file
nano /opt/scrapegoat-docker/.env

# 2. Restart services to apply changes
cd /opt/scrapegoat-docker
docker compose restart

# 3. Verify changes took effect
docker compose logs worker | grep -i "database\|embedding"
```

---

## Security Best Practices

1. **Never commit .env to version control**
   - Add to .gitignore
   - Use .env.example as template

2. **Use strong passwords**
   - Minimum 32 characters
   - Generated with cryptographic randomness
   - Unique per environment

3. **Restrict file permissions**
   ```bash
   chmod 600 /opt/scrapegoat-docker/.env
   ```

4. **Rotate credentials regularly**
   - Database passwords: Quarterly
   - API keys: As needed

5. **Monitor access logs**
   - Check for unauthorized access attempts
   - Review failed authentication logs

---

## Additional Resources

- **PostgreSQL Configuration**: /home/mp/Workspace/scrapegoat/docs/POSTGRESQL_SETUP.md
- **Embedding Providers**: /home/mp/Workspace/scrapegoat/docs/CONFIGURATION.md
- **Docker Deployment**: /home/mp/Workspace/scrapegoat/projects/docker-deployment-planning/
- **Troubleshooting**: See risk-assessment.md for common issues

---

*Last Updated: 2025-11-10*
*Configuration Version: 1.0*
