# System Architecture

## Overview

Scrapegoat is a documentation scraping and indexing service with Model Context Protocol (MCP) integration. It provides AI assistants with the ability to search, retrieve, and index web documentation using vector similarity search.

## Three-Service Architecture

### 1. MCP Server (Port 6280)

**Purpose**: Provides MCP protocol endpoints for AI integration

**Responsibilities**:
- Handle MCP protocol communication
- Expose search and retrieval tools to AI clients
- Manage MCP resource lifecycle
- Provide health status indicators

**Key Files**:
- `src/mcp/index.ts` - Main MCP server
- `src/tools/` - MCP tool definitions

**Endpoints**:
- `GET /health` - Health check
- `POST /mcp` - MCP protocol endpoint (SSE)

### 2. Web Service (Port 6281)

**Purpose**: Human-facing web UI and API

**Responsibilities**:
- Serve web interface
- Handle user authentication (future)
- Provide REST API for web clients
- Display search results and statistics

**Key Files**:
- `src/web/index.ts` - Web server
- `src/web/routes/` - HTTP routes
- `src/web/components/` - UI components

**Endpoints**:
- `GET /` - Web UI
- `GET /api/health/mcp` - MCP health check
- `GET /api/config` - Application configuration
- `GET /api/metrics` - Prometheus metrics

### 3. Worker API (Port 8080)

**Purpose**: Background processing and indexing operations

**Responsibilities**:
- Execute indexing jobs
- Manage fetcher pipeline
- Process and store documentation
- Handle Crawl4AI integration
- Store screenshots and metadata

**Key Files**:
- `src/worker/index.ts` - Worker server
- `src/pipeline/` - Indexing pipeline
- `src/lib/fetchers/` - Fetcher implementations

## Database Schema

### Tables

#### `pages`
Primary document storage with vector embeddings.

```sql
CREATE TABLE pages (
  id UUID PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  title TEXT,
  content TEXT,
  markdown TEXT,
  html TEXT,
  embedding vector(1536),
  screenshot_id UUID REFERENCES screenshots(id),
  fetcher_type TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pages_embedding ON pages 
  USING ivfflat (embedding vector_cosine_ops);
```

#### `screenshots`
Screenshot storage for visual documentation.

```sql
CREATE TABLE screenshots (
  id UUID PRIMARY KEY,
  data BYTEA,
  width INTEGER,
  height INTEGER,
  format TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `libraries`
Library version tracking.

```sql
CREATE TABLE libraries (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `chunks`
Document chunks for vector search.

```sql
CREATE TABLE chunks (
  id UUID PRIMARY KEY,
  page_id UUID REFERENCES pages(id),
  content TEXT,
  embedding vector(1536),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Pipeline Architecture

### Fetcher Pipeline

Three-tier fetcher system with explicit selection:

```typescript
enum FetcherType {
  HTTP = 'http',          // Fast, no JavaScript
  PLAYWRIGHT = 'playwright', // Full browser, JavaScript support
  CRAWL4AI = 'crawl4ai'   // Advanced, with screenshots
}
```

#### 1. HTTP Fetcher
**Use Case**: Static HTML pages, fast indexing

**Features**:
- HTTP GET request
- No JavaScript execution
- Fastest performance
- Lowest resource usage

**Implementation**: `src/lib/fetchers/http.ts`

#### 2. Playwright Fetcher
**Use Case**: JavaScript-heavy pages, dynamic content

**Features**:
- Full browser automation
- JavaScript execution
- Wait for network idle
- Screenshot capability

**Implementation**: `src/lib/fetchers/playwright.ts`

#### 3. Crawl4AI Fetcher
**Use Case**: Advanced scraping with visual context

**Features**:
- Docker-based isolation
- High-quality screenshots
- LLM-friendly extraction
- Markdown conversion

**Implementation**: `src/lib/fetchers/crawl4ai.ts`

**Docker Service**:
```bash
docker run -d \
  --name crawl4ai \
  -p 11235:11235 \
  --security-opt seccomp=unconfined \
  --cap-add=SYS_ADMIN \
  unclecode/crawl4ai:basic
```

### Processing Pipeline

```
URL Input → Select Fetcher → Fetch Content → Extract & Process → 
Generate Embedding → Store Document → Store Screenshot → Return Success
```

### Storage Pipeline

Enhanced storage system with screenshot and metadata support:

#### Document Storage
```typescript
await storage.savePage({
  url,
  title,
  content,
  embedding,
  screenshotId,
  metadata: {
    fetcher: fetcherType,
    indexed_at: new Date()
  }
});
```

#### Screenshot Storage
```typescript
await storage.saveScreenshot({
  data: base64Data,
  width: 1920,
  height: 1080,
  format: 'png'
});
```

## Vector Search

### Embedding Generation

Using OpenAI's text-embedding-ada-002 model:

```typescript
const embedding = await openai.embeddings.create({
  model: 'text-embedding-ada-002',
  input: content
});
```

**Dimensions**: 1536
**Cost**: ~$0.0001 per 1K tokens

### Similarity Search

PostgreSQL pgvector with cosine similarity:

```sql
SELECT 
  id,
  url,
  title,
  content,
  1 - (embedding <=> $1::vector) as similarity
FROM pages
WHERE 1 - (embedding <=> $1::vector) > 0.7
ORDER BY embedding <=> $1::vector
LIMIT 10;
```

## Port Allocation

| Service | Port | Purpose |
|---------|------|---------|
| MCP Server | 6280 | MCP protocol endpoint |
| Web Service | 6281 | Web UI and human API |
| Worker API | 8080 | Background indexing |
| Crawl4AI | 11235 | Docker scraping service |
| PostgreSQL | 5432 | Database server |

## Communication Patterns

### MCP → Database
Direct SQL queries via Drizzle ORM for search operations.

### Web → Database
Direct SQL queries via Drizzle ORM for display operations.

### Worker → Everything
- tRPC procedures for external API
- Fetcher pipeline for content retrieval
- Storage pipeline for persistence
- Crawl4AI via HTTP for advanced scraping

## Security Considerations

### Database
- Use connection pooling
- Implement row-level security (future)
- Encrypt sensitive data
- Regular backups

### API Access
- Rate limiting (future)
- API key authentication (future)
- CORS configuration
- Input validation

### Crawl4AI
- Isolated Docker container
- Security capabilities for Chromium
- Resource limits
- Network restrictions

## Scalability

### Horizontal Scaling
- Run multiple Worker instances
- Load balance requests
- Shared PostgreSQL database

### Vertical Scaling
- Increase PostgreSQL resources
- Tune IVFFlat index parameters
- Optimize embedding batch sizes

## Related Documentation

- [INSTALL.md](../INSTALL.md) - Installation guide
- [NGINX.md](NGINX.md) - Reverse proxy configuration
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues
- [CONTRIBUTING.md](CONTRIBUTING.md) - Development guide
