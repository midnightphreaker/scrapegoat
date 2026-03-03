# System Architecture

## Overview

Scrapegoat is a documentation scraping and indexing service with Model Context Protocol (MCP) integration. It provides AI assistants with the ability to search, retrieve, and index web documentation using vector similarity search.

## Unified CLI Architecture

Scrapegoat uses a single unified CLI application with a modular AppServer that can enable or disable different features based on configuration. This architecture allows flexible deployment: run all features in one process for development, or run specialized instances for production.

### Entry Point

**Single entry point**: `src/index.ts` → `src/cli/main.ts` → `createCliProgram()`

All functionality runs through the same binary with different CLI commands configuring the AppServer differently.

### CLI Commands

The application supports multiple command modes:

#### Default Command (No Arguments)
```bash
node dist/index.js
```

Runs unified server with **all features enabled**:
- Web interface (port 6281)
- MCP server (port 6280)
- API server (port 8080)
- Background worker

**Use case**: Development mode, single-server deployments

#### MCP Command
```bash
node dist/index.js mcp
```

Runs **MCP server only** with optional worker integration.

**AppServer Configuration**:
- `enableMcpServer: true`
- `enableWebInterface: false`
- `enableApiServer: false`
- `enableWorker: true` (if no external worker URL configured)

**Endpoints**:
- `GET /health` - Health check
- `POST /mcp` - MCP protocol endpoint (SSE)

**Key Files**:
- `src/cli/commands/mcp.ts` - MCP command implementation
- `src/mcp/` - MCP server logic
- `src/tools/` - MCP tool definitions

#### Web Command
```bash
node dist/index.js web
```

Runs **web interface only** with optional worker integration.

**AppServer Configuration**:
- `enableWebInterface: true`
- `enableMcpServer: false`
- `enableApiServer: false`
- `enableWorker: true` (if no external worker URL configured)

**Endpoints**:
- `GET /` - Web UI
- `GET /api/health/mcp` - MCP health check
- `GET /api/config` - Application configuration
- `GET /api/metrics` - Prometheus metrics

**Key Files**:
- `src/cli/commands/web.ts` - Web command implementation
- `src/web/` - Web server logic and UI components

#### Worker Command
```bash
node dist/index.js worker
```

Runs **API server and worker only** for background processing.

**AppServer Configuration**:
- `enableApiServer: true`
- `enableWorker: true`
- `enableWebInterface: false`
- `enableMcpServer: false`

**Responsibilities**:
- Execute indexing jobs
- Manage fetcher pipeline
- Process and store documentation
- Handle Crawl4AI integration
- Store screenshots and metadata

**Key Files**:
- `src/cli/commands/worker.ts` - Worker command implementation
- `src/pipeline/` - Indexing pipeline
- `src/lib/fetchers/` - Fetcher implementations

### AppServer: Modular Core

The `AppServer` is the modular core that all CLI commands configure and use.

**Configuration Interface** (`src/app/AppServerConfig.ts`):
```typescript
interface AppServerConfig {
  enableWebInterface: boolean;  // Enable web UI
  enableMcpServer: boolean;     // Enable MCP protocol
  enableApiServer: boolean;     // Enable tRPC API
  enableWorker: boolean;        // Enable background processing
  port: number;                 // HTTP port
  host: string;                 // Bind address
  externalWorkerUrl?: string;   // External worker URL
  readOnly?: boolean;           // Read-only mode
  auth?: AuthConfig;            // Authentication config
}
```

**Key Files**:
- `src/app/AppServer.ts` - Core server implementation
- `src/app/AppServerConfig.ts` - Configuration interface

### Production Deployment

In production with systemd, you run **three instances of the same binary** with different CLI arguments:

```ini
# /etc/systemd/system/scrapegoat-mcp.service
ExecStart=/usr/bin/node dist/index.js mcp

# /etc/systemd/system/scrapegoat-web.service
ExecStart=/usr/bin/node dist/index.js web

# /etc/systemd/system/scrapegoat-worker.service
ExecStart=/usr/bin/node dist/index.js worker
```

This is **not** three separate services/binaries, but three instances of the unified application running in different modes.

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

| Component | Default Port | Purpose |
|-----------|--------------|---------|
| MCP Server | 6280 | MCP protocol endpoint |
| Web Interface | 6281 | Web UI and human-facing API |
| Worker API | 8080 | Background indexing API |
| Crawl4AI | 11235 | Docker scraping service |
| PostgreSQL | 5432 | Database server |

**Note**: In unified mode (default command), all HTTP services run on their respective ports within the same process. In production deployments, each CLI command runs in a separate process on its designated port.

## Communication Patterns

### Unified Architecture Communication

Since all features can run in the same process or in separate processes, communication patterns depend on deployment mode:

#### Single Process (Development)
```
Default Command → AppServer → {
  MCP Module → Database (via Drizzle)
  Web Module → Database (via Drizzle)
  Worker Module → {
    Fetcher Pipeline → Crawl4AI (HTTP)
    Storage Pipeline → Database (via Drizzle)
  }
}
```

All modules share the same database connection pool and runtime.

#### Multi-Process (Production)
```
MCP Process → Database (Drizzle)
Web Process → Database (Drizzle)
Worker Process → {
  API (tRPC) ← HTTP requests from MCP/Web
  Fetcher Pipeline → Crawl4AI (HTTP)
  Storage Pipeline → Database (Drizzle)
}
```

Each process runs independently with its own connection pool.

### Module Communication

- **MCP Module**: Direct database queries via Drizzle ORM for search operations
- **Web Module**: Direct database queries via Drizzle ORM for display operations
- **Worker Module**:
  - Exposes tRPC procedures for external API calls
  - Fetcher pipeline for content retrieval
  - Storage pipeline for database persistence
  - HTTP client for Crawl4AI integration

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

The unified architecture supports flexible horizontal scaling:

**Worker Scaling**:
- Run multiple worker instances (`node dist/index.js worker`)
- Load balance indexing requests across workers
- Shared PostgreSQL database for coordination

**MCP/Web Scaling**:
- Run multiple MCP or web instances if needed
- Configure `externalWorkerUrl` to point to dedicated worker pool
- Use nginx or load balancer for request distribution

**Example Multi-Instance Setup**:
```bash
# Single worker pool
node dist/index.js worker --port 8080

# Multiple MCP instances using shared worker
node dist/index.js mcp --port 6280
node dist/index.js mcp --port 6283
```

### Vertical Scaling
- Increase PostgreSQL resources (CPU, memory, storage)
- Tune IVFFlat index parameters (`lists` parameter)
- Optimize embedding batch sizes
- Increase Node.js memory limits (`--max-old-space-size`)

## Related Documentation

- [INSTALL.md](../INSTALL.md) - Installation guide
- [NGINX.md](NGINX.md) - Reverse proxy configuration
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues
- [CONTRIBUTING.md](CONTRIBUTING.md) - Development guide
