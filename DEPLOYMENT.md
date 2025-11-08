# Scrapegoat Deployment Guide

## Architecture

Scrapegoat uses a **hybrid deployment** approach:
- **Systemd services** for Node.js applications (worker, MCP, web)
- **Docker** only for Crawl4AI (requires Playwright/Chromium)
- **External PostgreSQL** database with pgvector extension

## Production Deployment on docs.den.lan

### Services Running

1. **scrapegoat-worker.service** (port 8080)
   - Documentation processing API
   - Main backend service
   - Location: `/opt/scrapegoat`

2. **scrapegoat-mcp.service** (port 6280)
   - Model Context Protocol endpoint
   - Connects to worker API

3. **scrapegoat-web.service** (port 6281)
   - Web UI for management
   - Connects to worker API

4. **scrapegoat-crawl4ai** (Docker, port 8001)
   - AI-optimized web crawling service
   - Runs Playwright/Chromium in container

### Database

- **Host**: postgres.den.lan:5432
- **Database**: scrapegoat
- **Extensions**: pgvector enabled
- **Connection**: Via DATABASE_URL environment variable

### Environment Configuration

Create `/opt/scrapegoat/.env` with:

```bash
# Database Configuration
DATABASE_URL=postgresql://postgres:PASSWORD@postgres.den.lan:5432/scrapegoat

# Server Configuration
NODE_ENV=production
PORT=8080

# Crawl4AI Configuration
CRAWL4AI_ENABLED=true
CRAWL4AI_URL=http://localhost:8001

# Fetcher Configuration
DEFAULT_FETCHER=crawl4ai

# Skip Playwright installation (using Crawl4AI instead)
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/false

# Embedding Provider (optional)
EMBEDDING_PROVIDER=none
```

### Installation Steps

1. **Prerequisites**
```bash
# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# Install Docker
curl -fsSL https://get.docker.com | sh
```

2. **Deploy Application**
```bash
# Copy files to /opt/scrapegoat
mkdir -p /opt/scrapegoat
# ... copy application files ...

# Build
cd /opt/scrapegoat
npm ci
npm run build

# Create .env file
# ... add configuration ...
```

3. **Create Systemd Services**

**`/etc/systemd/system/scrapegoat-worker.service`**:
```ini
[Unit]
Description=Scrapegoat Worker - Documentation Processing API
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/scrapegoat
Environment=NODE_ENV=production
EnvironmentFile=/opt/scrapegoat/.env
ExecStart=/usr/bin/node --enable-source-maps /opt/scrapegoat/dist/index.js worker --host 0.0.0.0 --port 8080
Restart=always
RestartSec=10s
StandardOutput=journal
StandardError=journal
SyslogIdentifier=scrapegoat-worker

[Install]
WantedBy=multi-user.target
```

**`/etc/systemd/system/scrapegoat-mcp.service`**:
```ini
[Unit]
Description=Scrapegoat MCP Server - Model Context Protocol Endpoint
After=network-online.target scrapegoat-worker.service
Wants=network-online.target
Requires=scrapegoat-worker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/scrapegoat
Environment=NODE_ENV=production
EnvironmentFile=/opt/scrapegoat/.env
ExecStart=/usr/bin/node --enable-source-maps /opt/scrapegoat/dist/index.js mcp --protocol http --host 0.0.0.0 --port 6280 --server-url http://localhost:8080/api
Restart=always
RestartSec=10s
StandardOutput=journal
StandardError=journal
SyslogIdentifier=scrapegoat-mcp

[Install]
WantedBy=multi-user.target
```

**`/etc/systemd/system/scrapegoat-web.service`**:
```ini
[Unit]
Description=Scrapegoat Web UI - Browser Interface
After=network-online.target scrapegoat-worker.service
Wants=network-online.target
Requires=scrapegoat-worker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/scrapegoat
Environment=NODE_ENV=production
EnvironmentFile=/opt/scrapegoat/.env
ExecStart=/usr/bin/node --enable-source-maps /opt/scrapegoat/dist/index.js web --host 0.0.0.0 --port 6281 --server-url http://localhost:8080/api
Restart=always
RestartSec=10s
StandardOutput=journal
StandardError=journal
SyslogIdentifier=scrapegoat-web

[Install]
WantedBy=multi-user.target
```

4. **Set up Crawl4AI Docker Service**

**`/opt/scrapegoat/docker-compose.crawl4ai.yml`**:
```yaml
services:
  crawl4ai:
    build:
      context: ./services/crawl4ai
      dockerfile: Dockerfile
    image: scrapegoat-crawl4ai:latest
    container_name: scrapegoat-crawl4ai
    restart: unless-stopped
    network_mode: host
    environment:
      - HOST=0.0.0.0
      - PORT=8001
      - VERBOSE=false
      - HEADLESS=true
      - MAX_CONCURRENT_CRAWLS=5
      - REQUEST_TIMEOUT=30
    shm_size: 2gb
    privileged: true
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G
```

Start Crawl4AI:
```bash
cd /opt/scrapegoat
docker compose -f docker-compose.crawl4ai.yml up -d
```

5. **Database Setup**
```bash
# Create database
psql -h postgres.den.lan -U postgres -c "CREATE DATABASE scrapegoat;"

# Enable pgvector extension
psql -h postgres.den.lan -U postgres -d scrapegoat -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

6. **Start Services**
```bash
# Enable and start services
systemctl enable scrapegoat-worker scrapegoat-mcp scrapegoat-web
systemctl start scrapegoat-worker scrapegoat-mcp scrapegoat-web
```

### Verification

```bash
# Check service status
systemctl status scrapegoat-worker scrapegoat-mcp scrapegoat-web

# Check Docker container
docker ps --filter name=scrapegoat-crawl4ai

# Test endpoints
curl http://localhost:8001/health  # Crawl4AI
```

### Monitoring

```bash
# View logs
journalctl -u scrapegoat-worker -f
journalctl -u scrapegoat-mcp -f
journalctl -u scrapegoat-web -f

# Docker logs
docker logs -f scrapegoat-crawl4ai
```

## Troubleshooting

### Playwright Installation Errors

If MCP or Web services fail with Playwright installation errors:
- Ensure `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/false` is set in `.env`
- This skips Playwright browser installation (we use Crawl4AI instead)

### Database Connection Errors

- Verify `DATABASE_URL` is set with full PostgreSQL connection string
- Format: `postgresql://user:password@host:port/database`
- Individual `POSTGRES_*` variables are NOT used by the application

### Service Dependencies

- MCP and Web services require Worker to be running first
- Crawl4AI should be running before indexing with browser mode
- Check service dependencies with: `systemctl list-dependencies scrapegoat-mcp`

## Updates

To update the deployment:

```bash
cd /opt/scrapegoat
git pull
npm ci
npm run build
systemctl restart scrapegoat-worker scrapegoat-mcp scrapegoat-web
docker compose -f docker-compose.crawl4ai.yml up -d --build
```
