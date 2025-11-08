# System Architecture: Crawl4AI Integration

## High-Level Architecture

### Current Scrapegoat Architecture (Simplified)

```
┌─────────────────────────────────────────────────────────────┐
│                        Scrapegoat (Node.js)                 │
│                                                             │
│  ┌─────────────┐       ┌──────────────────┐               │
│  │ FetchUrlTool│──────▶│ AutoDetectFetcher│               │
│  └─────────────┘       └────────┬─────────┘               │
│                                 │                          │
│                    ┌────────────┼────────────┐             │
│                    │            │            │             │
│              ┌─────▼─────┐  ┌──▼────────┐  ┌▼────────┐   │
│              │   Fetch   │  │ Playwright│  │  Auto   │   │
│              │  Fetcher  │  │  Fetcher  │  │ (logic) │   │
│              └─────┬─────┘  └──┬────────┘  └─────────┘   │
│                    │            │                          │
│                    └────────────┼────────────┐             │
│                                 │            │             │
│                    ┌────────────▼────┐   ┌──▼─────────┐   │
│                    │   HtmlPipeline  │   │ Markdown   │   │
│                    │                 │   │  Pipeline  │   │
│                    └────────┬────────┘   └──┬─────────┘   │
│                             │              │              │
│                             └──────┬───────┘              │
│                                    │                      │
│                              ┌─────▼─────┐                │
│                              │  Chunking │                │
│                              └─────┬─────┘                │
│                                    │                      │
└────────────────────────────────────┼──────────────────────┘
                                     │
                          ┌──────────▼───────────┐
                          │   Infinity Server    │
                          │  (Embeddings)        │
                          └──────────┬───────────┘
                                     │
                          ┌──────────▼───────────┐
                          │   PostgreSQL +       │
                          │     pgvector         │
                          └──────────────────────┘
```

### New Architecture with Crawl4AI

```
┌─────────────────────────────────────────────────────────────┐
│                        Scrapegoat (Node.js)                 │
│                                                             │
│  ┌─────────────┐       ┌──────────────────┐               │
│  │ FetchUrlTool│──────▶│ AutoDetectFetcher│               │
│  └─────────────┘       └────────┬─────────┘               │
│                                 │                          │
│                    ┌────────────┼────────────┬──────────┐  │
│                    │            │            │          │  │
│              ┌─────▼─────┐  ┌──▼────────┐  ┌▼────────┐ │  │
│              │   Fetch   │  │ Playwright│  │ Crawl4AI│ │  │ NEW!
│              │  Fetcher  │  │  Fetcher  │  │ Fetcher │ │  │
│              └─────┬─────┘  └──┬────────┘  └─┬───────┘ │  │
│                    │            │            │         │  │
│                    │            │            │ HTTP    │  │
└────────────────────┼────────────┼────────────┼─────────┼──┘
                     │            │            │         │
                     │            │            │         │
                     │            │   ┌────────▼──────┐  │
                     │            │   │  Crawl4AI     │  │  NEW!
                     │            │   │  HTTP Client  │  │
                     │            │   │  (Circuit     │  │
                     │            │   │   Breaker)    │  │
                     │            │   └────────┬──────┘  │
                     │            │            │         │
                     │            │            │ HTTP    │
                     │            │            │         │
         ┌───────────┴────────────┼────────────┼─────────┴─────┐
         │                        │            │               │
    ┌────▼──────┐          ┌─────▼──────┐  ┌──▼─────────────┐ │
    │   Html    │          │  Markdown  │  │   Crawl4AI     │ │  NEW!
    │ Pipeline  │          │  Pipeline  │  │  Microservice  │ │
    └────┬──────┘          └─────┬──────┘  │  (Python/      │ │
         │                       │         │   FastAPI)     │ │
         │                       │         │                │ │
         └───────────┬───────────┘         │  ┌──────────┐  │ │
                     │                     │  │ Crawl4AI │  │ │
              ┌──────▼──────┐              │  │ Library  │  │ │
              │   Chunking  │              │  └────┬─────┘  │ │
              └──────┬──────┘              │       │        │ │
                     │                     │  ┌────▼─────┐  │ │
          ┌──────────▼───────────┐         │  │Playwright│  │ │
          │   Infinity Server    │         │  │ Browser  │  │ │
          │  (Embeddings)        │         │  └──────────┘  │ │
          └──────────┬───────────┘         └────────────────┘ │
                     │                                         │
          ┌──────────▼───────────┐                             │
          │   PostgreSQL +       │◀─────────────────────────────┘
          │     pgvector         │
          └──────────────────────┘
```

## Component Description

### New Components

#### 1. Crawl4AI HTTP Client (Node.js)
**Location**: `src/scraper/services/Crawl4AIClient.ts`

**Responsibilities**:
- Make HTTP requests to Crawl4AI microservice
- Handle timeouts and retries
- Implement circuit breaker pattern
- Validate responses
- Convert service responses to internal format

**Key Features**:
- Connection pooling (keep-alive)
- Exponential backoff retry (2 retries max)
- Circuit breaker (open after 3 failures)
- Request/response logging
- Health check method

**Configuration**:
```typescript
interface Crawl4AIClientConfig {
  serviceUrl: string;        // Default: http://localhost:8001
  timeout: number;          // Default: 30000ms
  retries: number;          // Default: 2
  circuitBreakerThreshold: number; // Default: 3
}
```

#### 2. Crawl4AI Fetcher (Node.js)
**Location**: `src/scraper/strategies/Crawl4AIFetcher.ts`

**Responsibilities**:
- Implement fetcher interface
- Call Crawl4AI HTTP client
- Handle errors and fallbacks
- Return markdown content
- Extract metadata

**Interface**:
```typescript
interface Fetcher {
  fetch(url: string, options: FetchOptions): Promise<FetchResult>;
}

interface FetchResult {
  content: string;      // Markdown content
  contentType: 'markdown';
  metadata: {
    title?: string;
    description?: string;
    statusCode: number;
    mode: 'crawl4ai';
  };
}
```

#### 3. Crawl4AI Microservice (Python)
**Location**: `services/crawl4ai/`

**Responsibilities**:
- Expose HTTP API for crawling
- Wrap Crawl4AI library
- Manage browser pool
- Cache crawling results
- Return markdown and metadata

**Technology Stack**:
- FastAPI (async web framework)
- Crawl4AI library
- Playwright (browser automation)
- Uvicorn (ASGI server)

**API Endpoints**:
```
POST /crawl          - Crawl a URL
GET  /health         - Health check
GET  /metrics        - Metrics (future)
```

## Data Flow

### Successful Crawl4AI Request

```
1. User calls FetchUrlTool with mode='crawl4ai'
   ↓
2. AutoDetectFetcher selects Crawl4AIFetcher
   ↓
3. Crawl4AIFetcher calls Crawl4AIClient
   ↓
4. Crawl4AIClient checks circuit breaker (CLOSED → proceed)
   ↓
5. HTTP POST to http://crawl4ai:8001/crawl
   ↓
6. Crawl4AI service receives request
   ↓
7. Crawl4AI library crawls URL with Playwright
   ↓
8. BM25 filtering applied → fit_markdown
   ↓
9. Response returned: {markdown, metadata}
   ↓
10. Crawl4AIClient validates and returns
   ↓
11. Crawl4AIFetcher formats as FetchResult
   ↓
12. MarkdownPipeline processes markdown
   ↓
13. Chunking → Infinity embeddings → PostgreSQL
```

### Crawl4AI Service Unavailable

```
1. User calls FetchUrlTool with mode='crawl4ai'
   ↓
2. AutoDetectFetcher selects Crawl4AIFetcher
   ↓
3. Crawl4AIFetcher calls Crawl4AIClient
   ↓
4. Crawl4AIClient checks circuit breaker (OPEN → fast fail)
   ↓
5. Circuit breaker throws ServiceUnavailableError
   ↓
6. Crawl4AIFetcher catches error
   ↓
7. Check fallbackToPlaywright option
   ↓
8a. If fallback=true: Use PlaywrightFetcher (log warning)
   ↓
8b. If fallback=false: Throw error to user
```

### Circuit Breaker State Machine

```
       ┌─────────────────────┐
       │      CLOSED         │
       │  (Normal operation) │
       └──────────┬──────────┘
                  │
        3 consecutive failures
                  │
       ┌──────────▼──────────┐
       │       OPEN          │
       │  (Fail fast, no     │
       │   requests sent)    │
       └──────────┬──────────┘
                  │
          After timeout (30s)
                  │
       ┌──────────▼──────────┐
       │     HALF_OPEN       │
       │  (Test if service   │
       │   recovered)        │
       └──────────┬──────────┘
                  │
      ┌───────────┴───────────┐
      │                       │
  2 successes            1 failure
      │                       │
   CLOSED ◀─────────────────▶ OPEN
```

## Service Communication

### HTTP Request Format

**POST /crawl**

```json
{
  "url": "https://example.com",
  "config": {
    "cacheMode": "enabled",
    "waitFor": ".content-loaded",
    "waitForTimeout": 10000,
    "useFitMarkdown": true,
    "removeOverlays": true,
    "screenshot": false,
    "extractMedia": false
  }
}
```

### HTTP Response Format

**Success (200 OK)**

```json
{
  "success": true,
  "data": {
    "markdown": "# Page Title\n\nContent...",
    "rawMarkdown": "# Page Title\n\nNav...\n\nContent...\n\nFooter...",
    "fitMarkdown": "# Page Title\n\nContent...",
    "metadata": {
      "title": "Page Title",
      "description": "Page description",
      "statusCode": 200,
      "url": "https://example.com",
      "crawlTime": 2.3
    }
  },
  "error": null
}
```

**Error (4xx/5xx)**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "TIMEOUT",
    "message": "Request timed out after 30s",
    "details": {
      "url": "https://example.com",
      "timeout": 30000
    }
  }
}
```

## Deployment Architecture

### Docker Compose Services

```yaml
version: '3.8'

services:
  # Existing services
  scrapegoat:
    build: .
    environment:
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/scrapegoat
      - INFINITY_URL=http://infinity:7997
      - CRAWL4AI_SERVICE_URL=http://crawl4ai:8001  # NEW
      - CRAWL4AI_ENABLED=true                       # NEW
    depends_on:
      - postgres
      - infinity
      - crawl4ai  # NEW dependency
    networks:
      - scrapegoat-network

  postgres:
    image: pgvector/pgvector:pg16
    # ... existing config

  infinity:
    image: michaelf34/infinity:latest
    # ... existing config

  # NEW SERVICE
  crawl4ai:
    build: ./services/crawl4ai
    ports:
      - "8001:8001"  # Optional: expose for debugging
    environment:
      - PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
      - LOG_LEVEL=info
      - MAX_CONCURRENT_BROWSERS=5
    volumes:
      - playwright-cache:/ms-playwright
    networks:
      - scrapegoat-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    restart: unless-stopped

networks:
  scrapegoat-network:
    driver: bridge

volumes:
  playwright-cache:
```

### Network Architecture

```
┌──────────────────────────────────────────────────┐
│              Docker Network                      │
│         (scrapegoat-network)                     │
│                                                  │
│  ┌────────────┐          ┌──────────────┐       │
│  │ scrapegoat │─────────▶│   crawl4ai   │       │
│  │  :3000     │  HTTP    │    :8001     │       │
│  └──────┬─────┘          └──────────────┘       │
│         │                                        │
│         │                                        │
│  ┌──────▼─────┐          ┌──────────────┐       │
│  │  postgres  │          │   infinity   │       │
│  │   :5432    │          │    :7997     │       │
│  └────────────┘          └──────────────┘       │
│                                                  │
└──────────────────────────────────────────────────┘
         │                        │
         │                        │
    Host: 5432              Host: 8001 (optional)
```

## Scalability Considerations

### Current Design (Single Instance)
- All services on one machine
- Docker Compose orchestration
- Sufficient for MVP and typical usage

### Future Scaling Options

#### 1. Horizontal Scaling (Multiple Crawl4AI Instances)
```
scrapegoat → Load Balancer → crawl4ai-1
                          └─→ crawl4ai-2
                          └─→ crawl4ai-3
```

#### 2. Kubernetes Migration
```yaml
apiVersion: v1
kind: Service
metadata:
  name: crawl4ai
spec:
  selector:
    app: crawl4ai
  ports:
    - port: 8001
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crawl4ai
spec:
  replicas: 3  # Multiple instances
  # ... deployment config
```

#### 3. Resource Limits
```yaml
# In Docker Compose
crawl4ai:
  deploy:
    resources:
      limits:
        cpus: '2.0'
        memory: 2G
      reservations:
        cpus: '1.0'
        memory: 1G
```

## Security Architecture

### Network Security
- Crawl4AI service on internal Docker network only
- No public internet exposure
- No authentication needed (internal only)
- Optional: Add API key for extra security layer

### Input Validation
```typescript
// Node.js side
validateUrl(url: string): boolean {
  // Valid URL format
  // Optional: Allow/deny list for domains
  // Prevent localhost/internal IP access
}

// Python side
@app.post("/crawl")
async def crawl(request: CrawlRequest):
    # Pydantic validates request structure
    # Additional URL validation
    # Sanitize error responses
```

### SSRF Protection Considerations
- Validate URLs before crawling
- Consider blocking private IP ranges
- Document security implications
- User responsibility for URL safety

## Performance Characteristics

### Expected Latencies

| Operation | Expected Time | Notes |
|-----------|---------------|-------|
| Simple page (Crawl4AI) | 2-5s | Static content |
| Complex page (Crawl4AI) | 5-15s | Heavy JavaScript |
| Playwright (comparison) | 3-10s | Similar pages |
| HTTP overhead | <50ms | Localhost communication |
| Circuit breaker (open) | <5ms | Fast fail |

### Resource Requirements

| Component | CPU | Memory | Disk |
|-----------|-----|--------|------|
| Crawl4AI service | 1-2 cores | 1-2GB | 500MB (browsers) |
| Chromium instance | 0.5-1 core | 200-500MB | - |
| Browser pool (5) | 2-5 cores | 1-2.5GB | - |

### Browser Pool Configuration

```python
# Optimal configuration
MAX_CONCURRENT_BROWSERS = 5  # Balance concurrency vs resources
BROWSER_TIMEOUT = 30000      # 30 seconds
PAGE_TIMEOUT = 30000         # 30 seconds
BROWSER_IDLE_TIMEOUT = 60000 # Keep browsers warm for 60s
```

## Error Handling Architecture

### Error Categories

1. **Network Errors**: Connection refused, timeout
2. **Service Errors**: Crawl4AI service crashed, out of memory
3. **Crawl Errors**: Invalid URL, page load failed, timeout
4. **Validation Errors**: Invalid request parameters

### Error Flow

```
Error Occurs
    │
    ▼
Is it retryable? ──No──▶ Return error to user
    │Yes
    ▼
Retry with backoff (2 times)
    │
    ▼
Still failing? ──No──▶ Return success
    │Yes
    ▼
Circuit breaker: increment failure count
    │
    ▼
Threshold reached? ──No──▶ Return error to user
    │Yes
    ▼
Open circuit ──▶ Fast fail future requests
    │
    ▼
After timeout (30s) ──▶ Half-open (test recovery)
```

## Monitoring and Observability

### Metrics to Collect

**Service-Level Metrics**:
- Request count (total, success, failure)
- Response time (p50, p95, p99)
- Error rate by type
- Circuit breaker state changes

**Resource Metrics**:
- Memory usage
- CPU usage
- Browser pool size
- Active browser count

**Business Metrics**:
- Crawl4AI vs other modes usage
- Average token count reduction
- Cache hit rate

### Logging Strategy

```typescript
// Structured logging
logger.info('Crawl4AI request', {
  url,
  mode: 'crawl4ai',
  correlationId,
  timestamp
});

logger.warn('Crawl4AI fallback to Playwright', {
  url,
  reason: 'circuit_breaker_open',
  correlationId
});

logger.error('Crawl4AI request failed', {
  url,
  error: err.message,
  stack: err.stack,
  correlationId
});
```

## Testing Architecture

### Test Layers

1. **Unit Tests**
   - Crawl4AIClient (mocked HTTP)
   - Crawl4AIFetcher (mocked client)
   - Circuit breaker logic
   - Request validation

2. **Integration Tests**
   - Real Crawl4AI service
   - Full request/response cycle
   - Error scenarios
   - Timeout handling

3. **E2E Tests**
   - URL → Crawl4AI → Pipeline → Database
   - Verify embeddings
   - Verify search

4. **Performance Tests**
   - Benchmark vs Playwright
   - Load testing (concurrent requests)
   - Resource usage monitoring

---
*Last Updated: 2025-11-08*
