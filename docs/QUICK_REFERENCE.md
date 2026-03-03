# Quick Reference Guide

Fast reference for common Scrapegoat operations and commands.

## Service Management

**Note**: Scrapegoat uses a unified CLI application. In production, these three systemd services run the same binary (`node dist/index.js`) with different commands (`mcp`, `web`, `worker`) to enable specific features.

### Start Services
```bash
sudo systemctl start scrapegoat-mcp
sudo systemctl start scrapegoat-web
sudo systemctl start scrapegoat-worker
```

### Stop Services
```bash
sudo systemctl stop scrapegoat-mcp
sudo systemctl stop scrapegoat-web
sudo systemctl stop scrapegoat-worker
```

### Restart Services
```bash
sudo systemctl restart scrapegoat-mcp
sudo systemctl restart scrapegoat-web
sudo systemctl restart scrapegoat-worker
```

### Check Status
```bash
sudo systemctl status scrapegoat-mcp
sudo systemctl status scrapegoat-web
sudo systemctl status scrapegoat-worker
```

### View Logs
```bash
# Follow logs in real-time
sudo journalctl -u scrapegoat-mcp -f
sudo journalctl -u scrapegoat-web -f
sudo journalctl -u scrapegoat-worker -f

# Last 50 lines
sudo journalctl -u scrapegoat-mcp -n 50
```

## Development

### Start Development Servers
```bash
# Run unified server with all features (recommended)
npm run dev

# Or run separately:
# Terminal 1: Server (MCP + Worker + hot reload)
npm run dev:server

# Terminal 2: Web UI (compilation watch mode)
npm run dev:web
```

### Build
```bash
npm run build
```

### Test
```bash
npm test
npm run lint
npm run type-check
```

## Database Operations

### Connect to Database
```bash
psql -U scrapegoat -d scrapegoat
```

### Common Queries
```sql
-- Count documents
SELECT COUNT(*) FROM pages;

-- Recent documents
SELECT id, url, title, created_at 
FROM pages 
ORDER BY created_at DESC 
LIMIT 10;

-- Documents without embeddings
SELECT COUNT(*) FROM pages WHERE embedding IS NULL;

-- Search by URL
SELECT * FROM pages WHERE url LIKE '%example.com%';
```

### Database Maintenance
```bash
# Run migrations
npm run db:push

# Database studio
npm run db:studio
```

## API Operations

### Health Checks
```bash
curl http://localhost:6280/health  # MCP
curl http://localhost:6281/health  # Web
curl http://localhost:8080/health  # Worker
```

### Index a URL
```bash
curl -X POST http://localhost:8080/api/indexing/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

## Docker (Crawl4AI)

### Start Crawl4AI
```bash
docker run -d \
  --name crawl4ai \
  -p 11235:11235 \
  --security-opt seccomp=unconfined \
  --cap-add=SYS_ADMIN \
  unclecode/crawl4ai:basic
```

### Check Status
```bash
docker ps | grep crawl4ai
curl http://localhost:11235/health
```

### View Logs
```bash
docker logs crawl4ai -f
```

### Restart
```bash
docker restart crawl4ai
```

## nginx Operations

### Test Configuration
```bash
sudo nginx -t
```

### Reload Configuration
```bash
sudo systemctl reload nginx
```

### View Logs
```bash
# Access logs
sudo tail -f /var/log/nginx/access.log

# Error logs
sudo tail -f /var/log/nginx/error.log
```

## Troubleshooting

### Port Check
```bash
# Check what's using a port
sudo lsof -i :6280
sudo lsof -i :6281
sudo lsof -i :8080

# List all listening ports
sudo ss -tlnp
```

### Process Check
```bash
# Find Scrapegoat processes
ps aux | grep scrapegoat

# Kill a process
kill -9 <PID>
```

## Configuration Files

### Location of Important Files
```
/opt/scrapegoat/.env                    # Environment variables
/etc/systemd/system/scrapegoat-*.service # Service definitions
/etc/nginx/sites-available/scrapegoat   # nginx config
```

### Edit Configuration
```bash
# Environment
sudo nano /opt/scrapegoat/.env

# systemd service
sudo nano /etc/systemd/system/scrapegoat-mcp.service

# nginx
sudo nano /etc/nginx/sites-available/scrapegoat

# After editing systemd
sudo systemctl daemon-reload
```

## MCP Integration

### Claude Desktop Config
```bash
# macOS
nano ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Linux
nano ~/.config/Claude/claude_desktop_config.json
```

### Config Format
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

## Environment Variables

### Essential Variables
```bash
DATABASE_URL="postgresql://user:pass@localhost:5432/scrapegoat"
OPENAI_API_KEY="sk-..."
CRAWL4AI_URL="http://localhost:11235"
MCP_PORT=6280
WEB_PORT=6281
WORKER_PORT=8080
```

### Reload After Changes
```bash
sudo systemctl restart scrapegoat-mcp
sudo systemctl restart scrapegoat-web
sudo systemctl restart scrapegoat-worker
```

## Git Operations

### Update Code
```bash
cd /opt/scrapegoat
git pull origin main
npm install
npm run build
sudo systemctl restart scrapegoat-*
```

## Backup and Restore

### Backup Database
```bash
pg_dump -U scrapegoat scrapegoat > backup.sql
```

### Restore Database
```bash
psql -U scrapegoat scrapegoat < backup.sql
```

## For More Information

- Full documentation: [docs/](.)
- Installation: [INSTALL.md](../INSTALL.md)
- Troubleshooting: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- Architecture: [ARCHITECTURE.md](ARCHITECTURE.md)
