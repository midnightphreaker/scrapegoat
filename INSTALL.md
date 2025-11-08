# Installation Guide

This guide provides step-by-step instructions for installing and configuring Scrapegoat.

## Prerequisites

### Required Software
- **Node.js**: Version 18 or higher
- **PostgreSQL**: Version 14 or higher
- **Docker**: For Crawl4AI service (optional but recommended)
- **nginx**: For reverse proxy (recommended for production)

### System Requirements
- Linux/macOS/Windows with WSL2
- 2GB+ RAM
- 1GB+ disk space

## Installation Steps

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/scrapegoat.git
cd scrapegoat
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Database Setup

#### Install PostgreSQL with pgvector

**Ubuntu/Debian:**
```bash
sudo apt-get install postgresql postgresql-contrib
sudo apt-get install postgresql-14-pgvector
```

**macOS (Homebrew):**
```bash
brew install postgresql@14
brew install pgvector
```

**Arch Linux:**
```bash
sudo pacman -S postgresql pgvector
```

#### Initialize Database

```bash
# Start PostgreSQL service
sudo systemctl start postgresql

# Create database and user
sudo -u postgres psql
```

In PostgreSQL shell:
```sql
CREATE DATABASE scrapegoat;
CREATE USER scrapegoat WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE scrapegoat TO scrapegoat;
\c scrapegoat
CREATE EXTENSION vector;
\q
```

#### Run Migrations

```bash
npm run db:push
```

### 4. Environment Configuration

Create `.env` file from template:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```bash
# Database
DATABASE_URL="postgresql://scrapegoat:your_secure_password@localhost:5432/scrapegoat"

# Service Ports
MCP_PORT=6280
WEB_PORT=6281
WORKER_PORT=8080

# Crawl4AI Service (optional)
CRAWL4AI_URL="http://localhost:11235"

# Monitoring
HEALTH_CHECK_INTERVAL=30000
```

### 5. Crawl4AI Docker Setup (Optional)

For advanced scraping with screenshot capabilities:

```bash
# Pull and run Crawl4AI container
docker run -d \
  --name crawl4ai \
  -p 11235:11235 \
  --security-opt seccomp=unconfined \
  --cap-add=SYS_ADMIN \
  unclecode/crawl4ai:basic
```

Verify it's running:
```bash
curl http://localhost:11235/health
```

### 6. Build Application

```bash
npm run build
```

### 7. Service Installation (Linux Systemd)

#### Create Service Files

**MCP Server** (`/etc/systemd/system/scrapegoat-mcp.service`):
```ini
[Unit]
Description=Scrapegoat MCP Server
After=network.target postgresql.service

[Service]
Type=simple
User=scrapegoat
WorkingDirectory=/opt/scrapegoat
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/mcp/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Web Service** (`/etc/systemd/system/scrapegoat-web.service`):
```ini
[Unit]
Description=Scrapegoat Web Service
After=network.target postgresql.service

[Service]
Type=simple
User=scrapegoat
WorkingDirectory=/opt/scrapegoat
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/web/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Worker API** (`/etc/systemd/system/scrapegoat-worker.service`):
```ini
[Unit]
Description=Scrapegoat Worker API
After=network.target postgresql.service

[Service]
Type=simple
User=scrapegoat
WorkingDirectory=/opt/scrapegoat
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/worker/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### Enable and Start Services

```bash
# Create scrapegoat user
sudo useradd -r -s /bin/false scrapegoat

# Copy application files
sudo cp -r /path/to/scrapegoat /opt/scrapegoat
sudo chown -R scrapegoat:scrapegoat /opt/scrapegoat

# Enable services
sudo systemctl enable scrapegoat-mcp
sudo systemctl enable scrapegoat-web
sudo systemctl enable scrapegoat-worker

# Start services
sudo systemctl start scrapegoat-mcp
sudo systemctl start scrapegoat-web
sudo systemctl start scrapegoat-worker

# Check status
sudo systemctl status scrapegoat-mcp
sudo systemctl status scrapegoat-web
sudo systemctl status scrapegoat-worker
```

### 8. nginx Reverse Proxy (Recommended)

See [docs/NGINX.md](docs/NGINX.md) for detailed nginx configuration.

Basic configuration (`/etc/nginx/sites-available/scrapegoat`):

```nginx
server {
    listen 80;
    server_name scrapegoat.yourdomain.com;

    # MCP Server
    location /mcp {
        proxy_pass http://localhost:6280;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Web Service
    location / {
        proxy_pass http://localhost:6281;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Worker API
    location /trpc {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/scrapegoat /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Verification

### 1. Check Services

```bash
# MCP Server
curl http://localhost:6280/health

# Web Service
curl http://localhost:6281/health

# Worker API
curl http://localhost:8080/trpc/health
```

### 2. Check Database Connection

```bash
psql -U scrapegoat -d scrapegoat -c "SELECT version();"
psql -U scrapegoat -d scrapegoat -c "SELECT * FROM pg_extension WHERE extname = 'vector';"
```

### 3. Test Indexing

```bash
curl -X POST http://localhost:8080/trpc/index \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

### 4. Check MCP Integration

Add to Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "scrapegoat": {
      "url": "http://localhost:6280/mcp",
      "transport": "sse"
    }
  }
}
```

## Development Setup

For development without systemd:

```bash
# Terminal 1: MCP Server
npm run dev:mcp

# Terminal 2: Web Service
npm run dev:web

# Terminal 3: Worker API
npm run dev:worker
```

## Troubleshooting

See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for common issues and solutions.

### Quick Fixes

**Services won't start:**
```bash
# Check logs
sudo journalctl -u scrapegoat-mcp -f
sudo journalctl -u scrapegoat-web -f
sudo journalctl -u scrapegoat-worker -f
```

**Database connection errors:**
```bash
# Verify PostgreSQL is running
sudo systemctl status postgresql

# Check connection
psql -U scrapegoat -d scrapegoat
```

**Port conflicts:**
```bash
# Find process using port
sudo lsof -i :6280
sudo lsof -i :6281
sudo lsof -i :8080
```

## Next Steps

- Read [ARCHITECTURE.md](docs/ARCHITECTURE.md) to understand system design
- Configure nginx reverse proxy (see [docs/NGINX.md](docs/NGINX.md))
- Set up monitoring and logging
- Configure SSL/TLS certificates
- Review security best practices

## Support

For issues and questions:
- GitHub Issues: https://github.com/yourusername/scrapegoat/issues
- Documentation: https://github.com/yourusername/scrapegoat/tree/main/docs
