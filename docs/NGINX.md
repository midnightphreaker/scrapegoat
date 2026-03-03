# nginx Reverse Proxy Configuration

This guide explains how to configure nginx as a reverse proxy for Scrapegoat's three services.

## Why nginx?

- **Single Entry Point**: Access all services through one domain/port
- **SSL/TLS Termination**: Handle HTTPS certificates centrally
- **Load Balancing**: Distribute requests across multiple instances
- **Static File Serving**: Efficient delivery of web assets
- **Security**: Rate limiting, IP filtering, request sanitization

## Architecture Overview

```
Client Request
    ↓
nginx (Port 80/443)
    ↓
    ├─→ /mcp/*      → MCP Server (localhost:6280)
    ├─→ /api/*      → Web Service (localhost:6281)
    └─→ /*          → Web Service (localhost:6281)
```

## Complete nginx Configuration

File: `/etc/nginx/sites-available/scrapegoat`

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name scrapegoat.yourdomain.com;

    client_max_body_size 100M;

    # Web service API endpoints (MUST come before /api/ to match first)
    location ~ ^/api/(health|config|metrics|pages)/ {
        proxy_pass http://127.0.0.1:6281;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Web UI (port 6281)
    location / {
        proxy_pass http://127.0.0.1:6281;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_cache_bypass $http_upgrade;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # MCP Server endpoint (port 6280)
    location /mcp/ {
        proxy_pass http://127.0.0.1:6280/;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Worker API endpoint (port 8080) - MUST come after web service API block
    location /api/ {
        proxy_pass http://127.0.0.1:8080/api/;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

## Endpoint Routing Table

| Endpoint | Backend | Port | Purpose |
|----------|---------|------|---------|
| `/api/health/mcp` | Web Service | 6281 | MCP server health check |
| `/api/config` | Web Service | 6281 | Application configuration |
| `/api/metrics` | Web Service | 6281 | Prometheus metrics (JSON) |
| `/api/pages/:id/screenshot` | Web Service | 6281 | Page screenshot serving |
| `/api/pages/:id/metadata` | Web Service | 6281 | Page metadata |
| `/metrics` | Web Service | 6281 | Prometheus metrics (text) |
| `/api/*` (other) | Worker API | 8080 | Worker endpoints |
| `/mcp/*` | MCP Server | 6280 | MCP protocol endpoints |
| `/*` | Web Service | 6281 | Web UI and static assets |

## Location Block Precedence

nginx processes location blocks in this order:

1. **Exact match** (`=`): Highest priority
2. **Prefix match** (`^~`): Second highest
3. **Regex match** (`~` or `~*`): Third
4. **Prefix match** (no modifier): Lowest priority, longest prefix wins

### Critical Ordering for Scrapegoat

```nginx
# 1. FIRST: Regex for specific web service API paths
location ~ ^/api/(health|config|metrics|pages)/ { ... }

# 2. MIDDLE: Prefix matches for MCP
location /mcp/ { ... }

# 3. LAST: General prefix matches
location /api/ { ... }  # Worker API catch-all
location / { ... }      # Web UI catch-all
```

**Why this matters**: If `/api/` comes before the regex match, `/api/health/mcp` would be routed to the worker API instead of the web service.

## SSL/TLS Configuration

### Using Let's Encrypt

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d scrapegoat.yourdomain.com

# Auto-renewal is configured automatically
```

### Manual SSL Configuration

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name scrapegoat.yourdomain.com;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/scrapegoat.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/scrapegoat.yourdomain.com/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/scrapegoat.yourdomain.com/chain.pem;

    # ... rest of configuration
}

# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name scrapegoat.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

## Testing Configuration

### Syntax Check

```bash
sudo nginx -t
```

### Reload Configuration

```bash
sudo systemctl reload nginx
```

### Test Routing

```bash
# Test MCP endpoint
curl http://localhost/mcp/health

# Test Web Service API
curl http://localhost/api/health/mcp

# Test Web UI
curl http://localhost/
```

### Debug Routing Issues

```bash
# Watch nginx error log
sudo tail -f /var/log/nginx/error.log

# Watch access log
sudo tail -f /var/log/nginx/access.log
```

## Common Issues and Solutions

### Issue: 502 Bad Gateway

**Cause**: Backend service not running or not listening on expected port.

**Solution**:
```bash
# Check services are running
sudo systemctl status scrapegoat-mcp
sudo systemctl status scrapegoat-web
sudo systemctl status scrapegoat-worker

# Check ports are listening
sudo ss -tlnp | grep -E '6280|6281|8080'
```

### Issue: Wrong service handling request

**Cause**: Location blocks in wrong order.

**Solution**: Ensure specific paths (`/api/health`, `/mcp`) come before catch-all (`/api/`, `/`).

### Issue: WebSocket/SSE connection fails

**Cause**: Missing upgrade headers or HTTP/1.0.

**Solution**: Ensure these headers are set:
```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection 'upgrade';
```

## Related Documentation

- [INSTALL.md](../INSTALL.md) - Installation guide
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues
