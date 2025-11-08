# System Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Access Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │     CLI      │  │   Web UI     │  │  MCP Server  │          │
│  │  Commands    │  │   (HTMX)     │  │ (stdio/HTTP) │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
└─────────┼──────────────────┼──────────────────┼──────────────────┘
          │                  │                  │
          └──────────────────┴──────────────────┘
                              │
┌─────────────────────────────┼──────────────────────────────────────┐
│                        Tools Layer                                 │
│  ┌────────────┬──────────────┬──────────────┬────────────────┐   │
│  │SearchTool  │ ScrapeTool   │ ListLibs Tool│ RemoveTool...  │   │
│  └────────────┴──────────────┴──────────────┴────────────────┘   │
└────────────────────────────────┼──────────────────────────────────┘
                                 │
┌────────────────────────────────┼──────────────────────────────────┐
│                     Pipeline Management                            │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  PipelineManager (Job Queue, Worker Coordination)       │    │
│  │  - Job state tracking                                    │    │
│  │  - Concurrency management                                │    │
│  │  - Progress reporting                                    │    │
│  └────────────────────────┬─────────────────────────────────┘    │
│                            │                                       │
│  ┌────────────────────────▼─────────────────────────────────┐    │
│  │  PipelineWorker (Job Execution)                          │    │
│  │  - Fetches URLs/files                                    │    │
│  │  - Processes content                                     │    │
│  │  - Generates embeddings                                  │    │
│  │  - Stores in database                                    │    │
│  └──────────────────────────────────────────────────────────┘    │
└────────────────────────────────┼──────────────────────────────────┘
                                 │
┌────────────────────────────────┼──────────────────────────────────┐
│                   Content Processing                               │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐ │
│  │ Scraper        │  │ Splitters         │  │  Embedders      │ │
│  │ - Playwright   │  │ - Semantic        │  │  - OpenAI       │ │
│  │ - Cheerio      │  │ - Markdown        │  │  - Gemini       │ │
│  │ - Turndown     │  │ - Code/Text       │  │  - Azure        │ │
│  │ - Tree-sitter  │  │ - Size optimize   │  │  - Bedrock      │ │
│  └─────────────────┘  └──────────────────┘  └─────────────────┘ │
└────────────────────────────────┼──────────────────────────────────┘
                                 │
┌────────────────────────────────┼──────────────────────────────────┐
│                       Storage Layer                                │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  DocumentStore (PostgreSQL Operations)                   │    │
│  │  - CRUD operations                                        │    │
│  │  - Vector search (pgvector)                              │    │
│  │  - Full-text search (tsvector)                           │    │
│  │  - Hybrid search (RRF)                                   │    │
│  │  - Connection pooling                                    │    │
│  └────────────────────────┬─────────────────────────────────┘    │
└────────────────────────────┼──────────────────────────────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │  PostgreSQL + pgvector       │
              │  (User-Provided)             │
              │  - Libraries table           │
              │  - Versions table            │
              │  - Documents table           │
              │  - Vector indexes (HNSW)     │
              │  - FTS indexes (GIN)         │
              └──────────────────────────────┘
```

## Component Responsibilities

### Access Layer

**CLI (Command-Line Interface)**
- Entry point for all commands
- Protocol detection (stdio vs HTTP based on TTY)
- Configuration parsing (env vars + CLI flags)
- Delegates to Tools layer

**Web UI (Fastify + HTMX + AlpineJS)**
- Server-side rendered interface
- Real-time job monitoring (3s polling)
- Documentation search and preview
- Library management
- Delegates to Tools layer

**MCP Server**
- Protocol compliance (stdio, HTTP, SSE transports)
- Tool registration and validation
- Request/response handling
- Delegates to Tools layer

### Tools Layer

Interface-agnostic business logic implementations:

**SearchTool**
- Version resolution (exact, semver, latest)
- Hybrid search execution
- Result formatting

**ScrapeTool**
- Job queueing with configuration
- Source validation
- Strategy selection (web, npm, PyPI, local)

**ListLibrariesTool**
- Library enumeration with versions
- Metadata aggregation
- Sorting and filtering

**RemoveTool**
- Library/version deletion
- Cascade delete handling
- Cleanup operations

**JobManagementTools**
- Job listing and filtering
- Job cancellation
- Job info retrieval
- Progress monitoring

### Pipeline Management

**PipelineManager**
- Job queue management (FIFO with priority)
- Concurrency control (configurable limit)
- Job state transitions (QUEUED → RUNNING → COMPLETED/FAILED)
- Worker coordination
- Progress callbacks to tools
- Job recovery after restart

**PipelineWorker**
- Individual job execution
- Strategy pattern for different sources
- Content fetching orchestration
- Processing pipeline execution
- Progress reporting
- Error handling and retry

### Content Processing

**Scraper Strategies**
- WebStrategy: Playwright-based HTML scraping
- GitHubStrategy: Repository documentation extraction
- NpmStrategy: npm package documentation
- PyPIStrategy: Python package documentation
- LocalStrategy: Filesystem documentation

**Content Pipeline**
- Middleware chain for transformations
- HTML → Markdown conversion
- Code block extraction
- Table preservation
- Navigation/boilerplate removal
- Metadata extraction

**Document Splitters**
- SemanticMarkdownSplitter: Structure-aware chunking
- JsonDocumentSplitter: Hierarchical JSON splitting
- TextDocumentSplitter: Line-based code/text splitting
- GreedySplitter: Universal size optimization

**Embedders**
- Provider abstraction (OpenAI, Gemini, Azure, Bedrock, local)
- Batch processing for efficiency
- Rate limiting and retry
- Dimension validation

### Storage Layer

**DocumentStore**
- PostgreSQL connection management
- Pool configuration and health checks
- Transaction handling
- Prepared statement execution

**DocumentManagementService**
- CRUD operations for libraries, versions, documents
- Version resolution logic
- Validation and constraint enforcement
- Batch operations

**DocumentRetrieverService**
- Vector search (cosine similarity via pgvector)
- Full-text search (tsvector/tsquery)
- Hybrid search with RRF ranking
- Result assembly and formatting

## Database Schema

### Libraries Table
```sql
CREATE TABLE libraries (
  id SERIAL PRIMARY KEY,
  library TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_libraries_library ON libraries(library);
```

### Versions Table
```sql
CREATE TABLE versions (
  id SERIAL PRIMARY KEY,
  library_id INTEGER REFERENCES libraries(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  status TEXT NOT NULL,  -- QUEUED, INDEXING, INDEXED, FAILED
  source_url TEXT,
  scraper_config JSONB,  -- Scraping configuration
  progress INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0,
  error TEXT,
  indexed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(library_id, version)
);

CREATE INDEX idx_versions_library_id ON versions(library_id);
CREATE INDEX idx_versions_status ON versions(status);
```

### Documents Table
```sql
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  version_id INTEGER REFERENCES versions(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR(1536),  -- Dimension configurable based on provider
  metadata JSONB,           -- Title, URL, language, type, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- B-tree index for FK lookups
CREATE INDEX idx_documents_version_id ON documents(version_id);

-- HNSW index for vector search (cosine distance)
CREATE INDEX idx_documents_embedding ON documents
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- GIN index for full-text search
ALTER TABLE documents ADD COLUMN content_tsv tsvector
GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

CREATE INDEX idx_documents_content_tsv ON documents USING gin(content_tsv);

-- GIN index for metadata search
CREATE INDEX idx_documents_metadata ON documents USING gin(metadata);
```

## Data Flow

### Scraping Flow
```
1. User triggers scrape (CLI/Web/MCP)
   ↓
2. ScrapeTool validates input
   ↓
3. ScrapeTool creates library + version records
   ↓
4. ScrapeTool queues job via PipelineManager
   ↓
5. PipelineManager starts PipelineWorker
   ↓
6. Worker selects strategy (Web/GitHub/npm/PyPI/Local)
   ↓
7. Strategy fetches content (Playwright/HTTP/FS)
   ↓
8. Content processed through middleware chain
   ↓
9. Documents split semantically
   ↓
10. Embeddings generated (batch)
   ↓
11. Documents inserted to PostgreSQL (batch)
   ↓
12. Progress updated in versions table
   ↓
13. Job marked COMPLETED, indexed_at set
```

### Search Flow
```
1. User queries (CLI/Web/MCP)
   ↓
2. SearchTool validates query + library/version
   ↓
3. SearchTool resolves version (exact/semver/latest)
   ↓
4. SearchTool calls DocumentRetrieverService
   ↓
5. Retriever performs vector search (pgvector)
   ├─ Generate query embedding
   ├─ Execute similarity search with HNSW index
   └─ Returns top-k candidates
   ↓
6. Retriever performs FTS search (tsvector)
   ├─ Convert query to tsquery
   ├─ Execute FTS with GIN index
   └─ Returns top-k candidates
   ↓
7. Retriever combines results via RRF
   ├─ Rank vector results
   ├─ Rank FTS results
   ├─ Merge using reciprocal rank fusion
   └─ Deduplicate and re-rank
   ↓
8. Results assembled with metadata
   ↓
9. Formatted and returned to user
```

## Deployment Architecture

### Single-Container Deployment (Recommended)
```
┌─────────────────────────────────────┐
│  Docker Container (Node.js app)    │
│  ┌──────────────────────────────┐  │
│  │  AppServer                   │  │
│  │  - MCP Server (stdio/HTTP)   │  │
│  │  - Web Interface             │  │
│  │  - Embedded Worker           │  │
│  └──────────────────────────────┘  │
└──────────────┬──────────────────────┘
               │ DATABASE_URL
               ▼
┌──────────────────────────────────────┐
│  PostgreSQL + pgvector               │
│  (User-Provided)                     │
│  - Managed service (RDS, Cloud SQL)  │
│  - Self-hosted PostgreSQL            │
│  - Docker PostgreSQL container       │
└──────────────────────────────────────┘
```

**Deployment Steps**:
1. User provides PostgreSQL connection string
2. Application starts, validates connection
3. Application initializes database:
   - Creates pgvector extension (if not exists)
   - Runs schema migrations
   - Creates tables and indexes
4. Application ready to accept requests

### Multi-Container Deployment (Scaling)
```
┌──────────────────────┐  ┌──────────────────────┐
│  MCP Server          │  │  Web Interface       │
│  Container           │  │  Container           │
└──────────┬───────────┘  └───────────┬──────────┘
           │                          │
           └────────────┬─────────────┘
                        │
           ┌────────────▼─────────────┐
           │  Worker Container(s)     │
           │  (Scalable)              │
           └────────────┬─────────────┘
                        │ DATABASE_URL
                        ▼
           ┌──────────────────────────┐
           │  PostgreSQL + pgvector   │
           │  (User-Provided)         │
           └──────────────────────────┘
```

## Database Initialization

### Startup Sequence
```
1. Application starts
   ↓
2. Parse DATABASE_URL from environment
   ↓
3. Create connection pool
   ↓
4. Verify connection health
   ↓
5. Check pgvector extension
   ├─ If exists: continue
   └─ If not exists:
      ├─ Attempt CREATE EXTENSION vector
      ├─ If success: continue
      └─ If failure: exit with clear error message
   ↓
6. Check migrations table
   ├─ If not exists: create migrations table
   └─ If exists: read current version
   ↓
7. Run pending migrations sequentially
   ├─ Migration 001: Initial schema
   ├─ Migration 002: GIN indexes
   ├─ Migration 003: HNSW indexes
   ├─ Migration 004: Additional features
   └─ Record migration version after each success
   ↓
8. Validate schema (check tables exist)
   ↓
9. Ready to serve requests
```

### Required PostgreSQL Permissions
```sql
-- Minimum required permissions
GRANT USAGE ON SCHEMA public TO app_user;
GRANT CREATE ON SCHEMA public TO app_user;  -- For pgvector extension
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
```

## Error Handling Strategy

### Connection Errors
- Retry with exponential backoff (3 attempts)
- Clear error messages for user
- Graceful degradation (search fails, writes queued)

### Extension Errors
- Check if pgvector installed at startup
- Clear instructions if missing
- Verify extension version compatibility

### Query Errors
- Catch and categorize errors
- Provide user-friendly messages
- Log full details for debugging
- Don't expose SQL errors directly

### Migration Errors
- Atomic transactions (rollback on failure)
- Clear indication of which migration failed
- Resume capability (track completed migrations)

---

*Last Updated: 2025-11-08*
