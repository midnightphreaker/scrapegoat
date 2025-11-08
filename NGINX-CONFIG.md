# Nginx Configuration for Scrapegoat

When deploying Scrapegoat behind an nginx reverse proxy, you need to configure proper routing for the different API endpoints.

## Issue

The web service (port 6281) and worker API (port 8080) both expose endpoints under `/api/`, which can cause routing conflicts in nginx.

## Solution

Add a **specific location block for web service API endpoints** that matches **before** the general `/api/` location block:

```nginx
server {
    listen 80;
    server_name docs.den.lan;

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

## Endpoints Routing

| Endpoint | Backend | Port | Purpose |
|----------|---------|------|---------|
| `/api/health/mcp` | Web Service | 6281 | MCP server health check |
| `/api/config` | Web Service | 6281 | Application configuration |
| `/api/metrics` | Web Service | 6281 | Prometheus metrics (JSON) |
| `/api/pages/:id/screenshot` | Web Service | 6281 | Page screenshot serving |
| `/api/pages/:id/metadata` | Web Service | 6281 | Page metadata |
| `/metrics` | Web Service | 6281 | Prometheus metrics (text) |
| `/api/*` (other) | Worker API | 8080 | tRPC worker endpoints |
| `/mcp/*` | MCP Server | 6280 | MCP protocol endpoints |
| `/*` | Web Service | 6281 | Web UI and static assets |

## Testing

After applying the configuration:

```bash
# Test nginx config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx

# Verify endpoints work
curl http://your-domain/api/health/mcp
curl http://your-domain/api/config
```

## Note on Ordering

Nginx processes location blocks in a specific order. Regex locations (using `~`) are evaluated **after** exact matches but **before** prefix matches. By using a regex location for the web service API endpoints, we ensure they're matched before the general `/api/` prefix location.
