# Data Models and API Schemas

## TypeScript Interfaces (Node.js)

### ScrapeMode Enum

```typescript
enum ScrapeMode {
  Fetch = 'fetch',
  Playwright = 'playwright',
  Crawl4AI = 'crawl4ai',  // NEW
  Auto = 'auto'
}
```

### Crawl4AI Options

```typescript
interface Crawl4AIOptions {
  // Wait configuration
  waitFor?: string;              // CSS selector to wait for
  waitForTimeout?: number;       // Wait timeout in ms (default: 10000)

  // Markdown output
  useFitMarkdown?: boolean;      // Use BM25-filtered markdown (default: true)

  // Cache control
  cacheMode?: 'enabled' | 'disabled' | 'bypass';  // Default: 'enabled'

  // Advanced features
  removeOverlays?: boolean;      // Remove popups/overlays (default: true)
  screenshot?: boolean | 'full' | 'viewport';  // Capture screenshot (default: false)
  extractMedia?: boolean;        // Extract media links (default: false)
  customJS?: string;            // Custom JavaScript to execute

  // Proxy configuration (optional)
  proxy?: {
    server: string;              // Proxy server URL
    username?: string;           // Proxy username
    password?: string;           // Proxy password
  };

  // Fallback behavior
  fallbackToPlaywright?: boolean;  // Fallback if service unavailable (default: false)
  fallbackOnTimeout?: boolean;     // Fallback on timeout (default: true)
  fallbackOnError?: boolean;       // Fallback on error (default: false)
}
```

### FetchUrlTool Options

```typescript
interface FetchUrlOptions {
  mode?: ScrapeMode;
  crawl4ai?: Crawl4AIOptions;
  // ... existing options
}

// Example usage:
await fetchUrl('https://example.com', {
  mode: ScrapeMode.Crawl4AI,
  crawl4ai: {
    waitFor: '.content-loaded',
    useFitMarkdown: true,
    removeOverlays: true,
    screenshot: false
  }
});
```

### Crawl4AI Client Interfaces

```typescript
// Client configuration
interface Crawl4AIClientConfig {
  serviceUrl: string;                // Default: http://localhost:8001
  timeout: number;                   // Default: 30000 (30s)
  retries: number;                   // Default: 2
  circuitBreakerThreshold: number;   // Default: 3
  circuitBreakerTimeout: number;     // Default: 30000 (30s)
}

// Request to Python service
interface Crawl4AIRequest {
  url: string;
  config: {
    cacheMode?: 'enabled' | 'disabled' | 'bypass';
    waitFor?: string;
    waitForTimeout?: number;
    useFitMarkdown?: boolean;
    removeOverlays?: boolean;
    screenshot?: boolean | 'full' | 'viewport';
    extractMedia?: boolean;
    customJS?: string;
    proxy?: {
      server: string;
      username?: string;
      password?: string;
    };
  };
}

// Response from Python service
interface Crawl4AIResponse {
  success: boolean;
  data: {
    markdown: string;              // The markdown content (fit or raw based on config)
    rawMarkdown?: string;          // Always raw markdown
    fitMarkdown?: string;          // BM25-filtered markdown
    metadata: {
      title?: string;
      description?: string;
      statusCode: number;
      url: string;
      crawlTime: number;           // Time taken in seconds
    };
    screenshot?: string;           // Base64 encoded image (if requested)
    media?: MediaItem[];          // Media items (if requested)
    links?: LinkItem[];           // Extracted links
  } | null;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  } | null;
}

interface MediaItem {
  type: 'image' | 'video' | 'audio';
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

interface LinkItem {
  url: string;
  text: string;
  rel?: string;
}
```

### Fetcher Interface

```typescript
interface Fetcher {
  fetch(url: string, options: FetchOptions): Promise<FetchResult>;
}

interface FetchOptions {
  mode: ScrapeMode;
  crawl4ai?: Crawl4AIOptions;
  // ... other options
}

interface FetchResult {
  content: string;               // The scraped content
  contentType: 'html' | 'markdown' | 'text';
  metadata: {
    title?: string;
    description?: string;
    statusCode: number;
    mode: string;                // Which mode was used (important for fallback)
    screenshot?: string;         // If screenshot was captured
    media?: MediaItem[];        // If media was extracted
    [key: string]: unknown;
  };
}
```

### Error Types

```typescript
class Crawl4AIError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'Crawl4AIError';
  }
}

class ServiceUnavailableError extends Crawl4AIError {
  constructor(message: string = 'Crawl4AI service unavailable') {
    super(message, 'SERVICE_UNAVAILABLE');
  }
}

class TimeoutError extends Crawl4AIError {
  constructor(message: string = 'Request timed out') {
    super(message, 'TIMEOUT');
  }
}

class CircuitBreakerOpenError extends Crawl4AIError {
  constructor(message: string = 'Circuit breaker is open') {
    super(message, 'CIRCUIT_BREAKER_OPEN');
  }
}
```

## Python Models (FastAPI/Pydantic)

### Request Models

```python
from pydantic import BaseModel, Field, validator
from typing import Optional, Literal
from enum import Enum

class CacheMode(str, Enum):
    enabled = "enabled"
    disabled = "disabled"
    bypass = "bypass"

class ProxyConfig(BaseModel):
    server: str
    username: Optional[str] = None
    password: Optional[str] = None

class CrawlConfig(BaseModel):
    cache_mode: CacheMode = Field(default=CacheMode.enabled)
    wait_for: Optional[str] = Field(default=None, description="CSS selector to wait for")
    wait_for_timeout: int = Field(default=10000, ge=0, le=60000)
    use_fit_markdown: bool = Field(default=True)
    remove_overlays: bool = Field(default=True)
    screenshot: Optional[Literal[False, True, "full", "viewport"]] = Field(default=False)
    extract_media: bool = Field(default=False)
    custom_js: Optional[str] = Field(default=None)
    proxy: Optional[ProxyConfig] = None

    @validator('wait_for_timeout')
    def validate_timeout(cls, v):
        if v < 0 or v > 60000:
            raise ValueError('Timeout must be between 0 and 60000ms')
        return v

class CrawlRequest(BaseModel):
    url: str
    config: CrawlConfig = Field(default_factory=CrawlConfig)

    @validator('url')
    def validate_url(cls, v):
        # URL validation logic
        if not v.startswith(('http://', 'https://')):
            raise ValueError('URL must start with http:// or https://')
        return v
```

### Response Models

```python
class MediaItem(BaseModel):
    type: Literal["image", "video", "audio"]
    url: str
    alt: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None

class LinkItem(BaseModel):
    url: str
    text: str
    rel: Optional[str] = None

class CrawlMetadata(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status_code: int
    url: str
    crawl_time: float  # Time taken in seconds

class CrawlData(BaseModel):
    markdown: str
    raw_markdown: Optional[str] = None
    fit_markdown: Optional[str] = None
    metadata: CrawlMetadata
    screenshot: Optional[str] = None  # Base64 encoded
    media: Optional[list[MediaItem]] = None
    links: Optional[list[LinkItem]] = None

class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Optional[dict] = None

class CrawlResponse(BaseModel):
    success: bool
    data: Optional[CrawlData] = None
    error: Optional[ErrorDetail] = None

class HealthResponse(BaseModel):
    status: Literal["ok", "degraded", "down"]
    version: str
    uptime: float
    browser_pool: dict
```

## API Endpoints

### POST /crawl

**Description**: Crawl a URL and return markdown content

**Request**:
```json
{
  "url": "https://example.com",
  "config": {
    "cache_mode": "enabled",
    "wait_for": ".content-loaded",
    "wait_for_timeout": 10000,
    "use_fit_markdown": true,
    "remove_overlays": true,
    "screenshot": false,
    "extract_media": false,
    "custom_js": null,
    "proxy": null
  }
}
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "markdown": "# Page Title\n\nClean content without navigation...",
    "raw_markdown": "# Page Title\n\nNav | Home | About...\n\nClean content...\n\nFooter...",
    "fit_markdown": "# Page Title\n\nClean content without navigation...",
    "metadata": {
      "title": "Page Title",
      "description": "Page description meta tag",
      "status_code": 200,
      "url": "https://example.com",
      "crawl_time": 2.34
    },
    "screenshot": null,
    "media": null,
    "links": null
  },
  "error": null
}
```

**Error Response (4xx/5xx)**:
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "TIMEOUT",
    "message": "Request timed out after 30 seconds",
    "details": {
      "url": "https://example.com",
      "timeout": 30000
    }
  }
}
```

**Error Codes**:
- `INVALID_URL`: URL validation failed
- `TIMEOUT`: Request exceeded timeout
- `NETWORK_ERROR`: Network connection failed
- `BROWSER_ERROR`: Browser automation error
- `CRAWL_ERROR`: Crawl4AI library error
- `INTERNAL_ERROR`: Unexpected server error

### GET /health

**Description**: Health check endpoint

**Response (200 OK)**:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 3600.5,
  "browser_pool": {
    "size": 5,
    "active": 2,
    "available": 3
  }
}
```

**Status Values**:
- `ok`: Service operational
- `degraded`: Service running but issues detected
- `down`: Service not operational

### GET /metrics (Future)

**Description**: Prometheus-compatible metrics

**Response (200 OK)**:
```
# HELP crawl4ai_requests_total Total number of crawl requests
# TYPE crawl4ai_requests_total counter
crawl4ai_requests_total{status="success"} 1234
crawl4ai_requests_total{status="error"} 56

# HELP crawl4ai_request_duration_seconds Request duration in seconds
# TYPE crawl4ai_request_duration_seconds histogram
crawl4ai_request_duration_seconds_bucket{le="1.0"} 100
crawl4ai_request_duration_seconds_bucket{le="5.0"} 500
crawl4ai_request_duration_seconds_bucket{le="+Inf"} 1234

# HELP crawl4ai_browser_pool_size Current browser pool size
# TYPE crawl4ai_browser_pool_size gauge
crawl4ai_browser_pool_size 5
```

## Database Schema

**No changes to existing database schema required!**

Crawl4AI produces markdown that flows through the existing pipeline:
- Markdown is chunked using existing chunking logic
- Chunks are embedded using Infinity server
- Embeddings stored in PostgreSQL with pgvector

The only difference is the `mode` field in metadata might indicate `crawl4ai`:

```sql
-- Existing documents table (no changes)
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  url TEXT NOT NULL,
  content TEXT NOT NULL,  -- Markdown from Crawl4AI
  metadata JSONB,         -- May include "mode": "crawl4ai"
  created_at TIMESTAMP DEFAULT NOW()
);

-- Existing chunks table (no changes)
CREATE TABLE chunks (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id),
  content TEXT NOT NULL,
  embedding vector(384),  -- From Infinity server
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Environment Variables

```bash
# Crawl4AI Service Connection
CRAWL4AI_SERVICE_URL=http://localhost:8001  # URL to Python service
CRAWL4AI_ENABLED=true                       # Enable/disable Crawl4AI mode
CRAWL4AI_TIMEOUT=30000                      # Request timeout in ms
CRAWL4AI_RETRY_ATTEMPTS=2                   # Number of retries

# Crawl4AI Feature Defaults
CRAWL4AI_USE_FIT_MARKDOWN=true             # Use BM25-filtered markdown
CRAWL4AI_REMOVE_OVERLAYS=true              # Remove popups/overlays
CRAWL4AI_CACHE_MODE=enabled                # Default cache mode

# Circuit Breaker Configuration
CRAWL4AI_CIRCUIT_BREAKER_THRESHOLD=3       # Failures before opening
CRAWL4AI_CIRCUIT_BREAKER_TIMEOUT=30000     # Timeout before half-open (ms)

# Python Service Configuration (for service itself)
MAX_CONCURRENT_BROWSERS=5                   # Browser pool size
LOG_LEVEL=info                             # Logging level
PLAYWRIGHT_BROWSERS_PATH=/ms-playwright    # Browser cache location
```

## Configuration Examples

### Minimal Configuration (Defaults)

```typescript
await fetchUrl('https://example.com', {
  mode: ScrapeMode.Crawl4AI
});
```

### With Wait For Element

```typescript
await fetchUrl('https://spa-app.com', {
  mode: ScrapeMode.Crawl4AI,
  crawl4ai: {
    waitFor: '.content-loaded',
    waitForTimeout: 15000
  }
});
```

### With Screenshot

```typescript
await fetchUrl('https://example.com', {
  mode: ScrapeMode.Crawl4AI,
  crawl4ai: {
    screenshot: 'full',  // or 'viewport' or true
  }
});
```

### With Proxy

```typescript
await fetchUrl('https://example.com', {
  mode: ScrapeMode.Crawl4AI,
  crawl4ai: {
    proxy: {
      server: 'http://proxy.example.com:8080',
      username: 'user',
      password: 'pass'
    }
  }
});
```

### With Fallback Enabled

```typescript
await fetchUrl('https://example.com', {
  mode: ScrapeMode.Crawl4AI,
  crawl4ai: {
    fallbackToPlaywright: true,  // Use Playwright if Crawl4AI fails
  }
});
```

### With Custom JavaScript

```typescript
await fetchUrl('https://example.com', {
  mode: ScrapeMode.Crawl4AI,
  crawl4ai: {
    customJS: `
      // Click accept cookies button
      document.querySelector('.cookie-accept')?.click();
      // Wait a bit
      await new Promise(r => setTimeout(r, 1000));
    `
  }
});
```

### Raw Markdown (No Filtering)

```typescript
await fetchUrl('https://example.com', {
  mode: ScrapeMode.Crawl4AI,
  crawl4ai: {
    useFitMarkdown: false  // Get raw markdown, no BM25 filtering
  }
});
```

## Version Compatibility

### Supported Versions

| Component | Version | Notes |
|-----------|---------|-------|
| Node.js | 18.x, 20.x | LTS versions |
| TypeScript | 5.x | Latest stable |
| Python | 3.10, 3.11 | Required for Crawl4AI |
| Crawl4AI | 1.x | Pin specific minor version |
| FastAPI | 0.104+ | Latest stable |
| Playwright | Latest | Via Crawl4AI |

### API Versioning Strategy

For future API changes:
- URL versioning: `/v1/crawl`, `/v2/crawl`
- Header versioning: `API-Version: 1`
- Backward compatibility maintained for at least 2 minor versions

---
*Last Updated: 2025-11-08*
