# Functional Requirements

## Core Documentation Management

### FR-1: Documentation Scraping
**Priority**: Critical
**Description**: System must scrape and index documentation from multiple sources

**Requirements**:
- FR-1.1: Support web-based documentation (HTML scraping with Playwright)
- FR-1.2: Support GitHub repository documentation
- FR-1.3: Support npm package documentation
- FR-1.4: Support PyPI package documentation
- FR-1.5: Support local file system documentation (file:// URLs)
- FR-1.6: Handle various content types (HTML, Markdown, code files)
- FR-1.7: Extract and preserve document structure (headings, code blocks, tables)
- FR-1.8: Store library name, version, URL, and metadata

### FR-2: Content Processing
**Priority**: Critical
**Description**: Process and chunk documentation for optimal search

**Requirements**:
- FR-2.1: Semantic chunking preserving document structure
- FR-2.2: Code block extraction and preservation
- FR-2.3: Table structure maintenance
- FR-2.4: HTML to Markdown conversion
- FR-2.5: Navigation and boilerplate removal
- FR-2.6: Size optimization for embedding generation
- FR-2.7: Metadata extraction (title, language, type)

### FR-3: Vector Embeddings
**Priority**: Critical
**Description**: Generate and store vector embeddings for semantic search

**Requirements**:
- FR-3.1: Support OpenAI embedding models
- FR-3.2: Support Google Gemini/Vertex AI embeddings
- FR-3.3: Support Azure OpenAI embeddings
- FR-3.4: Support AWS Bedrock embeddings
- FR-3.5: Support OpenAI-compatible APIs (Ollama, LM Studio)
- FR-3.6: Store embeddings as pgvector VECTOR type
- FR-3.7: Configurable embedding dimensions
- FR-3.8: Batch embedding generation for performance

## Search and Retrieval

### FR-4: Semantic Search
**Priority**: Critical
**Description**: Vector similarity search using pgvector

**Requirements**:
- FR-4.1: Cosine similarity search
- FR-4.2: HNSW index for performance
- FR-4.3: Configurable result limit (1-100)
- FR-4.4: Results include relevance score
- FR-4.5: Filter by library and version
- FR-4.6: Exact version matching support
- FR-4.7: Version range matching (semver)

### FR-5: Full-Text Search
**Priority**: High
**Description**: PostgreSQL tsvector/tsquery full-text search

**Requirements**:
- FR-5.1: GIN index on content
- FR-5.2: English language stemming
- FR-5.3: Phrase matching
- FR-5.4: Keyword matching
- FR-5.5: Ranking by relevance

### FR-6: Hybrid Search
**Priority**: High
**Description**: Combine vector and full-text search results

**Requirements**:
- FR-6.1: Reciprocal Rank Fusion (RRF) for result combination
- FR-6.2: Configurable weights for vector vs FTS
- FR-6.3: Deduplication of results
- FR-6.4: Configurable overfetch factor

### FR-7: Version-Aware Search
**Priority**: Critical
**Description**: Search specific versions or version ranges

**Requirements**:
- FR-7.1: Search exact version (e.g., "react@18.2.0")
- FR-7.2: Search version ranges (e.g., "react@^18.0.0")
- FR-7.3: Search latest version
- FR-7.4: List all available versions for library
- FR-7.5: Version validation and error messaging

## Job Queue and Processing

### FR-8: Asynchronous Job Processing
**Priority**: Critical
**Description**: Background processing of scraping and indexing jobs

**Requirements**:
- FR-8.1: Queue jobs with priority
- FR-8.2: Track job states (QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED)
- FR-8.3: Progress reporting during execution
- FR-8.4: Job cancellation support
- FR-8.5: Job recovery after restart
- FR-8.6: Concurrent job execution (configurable limit)
- FR-8.7: Job error capture and reporting
- FR-8.8: Job history retention

### FR-9: Job Management
**Priority**: High
**Description**: Monitor and control jobs

**Requirements**:
- FR-9.1: List all jobs with filtering
- FR-9.2: Get detailed job information
- FR-9.3: Cancel running jobs
- FR-9.4: Clear completed jobs
- FR-9.5: Retry failed jobs
- FR-9.6: Job progress percentage

## MCP Protocol Integration

### FR-10: MCP Server
**Priority**: Critical
**Description**: Model Context Protocol server implementation

**Requirements**:
- FR-10.1: stdio transport for embedded mode
- FR-10.2: HTTP transport (Streamable HTTP)
- FR-10.3: SSE transport (Server-Sent Events)
- FR-10.4: Auto-detect transport based on TTY
- FR-10.5: Manual protocol override flag

### FR-11: MCP Tools
**Priority**: Critical
**Description**: Expose functionality as MCP tools

**Requirements**:
- FR-11.1: `search_docs` tool - semantic search
- FR-11.2: `scrape_docs` tool - queue scraping job
- FR-11.3: `list_libraries` tool - list indexed libraries
- FR-11.4: `find_version` tool - resolve version patterns
- FR-11.5: `remove_library` tool - delete library data
- FR-11.6: `list_jobs` tool - view job queue
- FR-11.7: `cancel_job` tool - cancel running job
- FR-11.8: `get_job_info` tool - detailed job status
- FR-11.9: `fetch_url` tool - fetch and convert URL to markdown
- FR-11.10: Tool input validation and error handling

## Web Interface

### FR-12: Web UI
**Priority**: High
**Description**: Browser-based management interface

**Requirements**:
- FR-12.1: Queue new scraping jobs
- FR-12.2: View job queue and status
- FR-12.3: Monitor job progress in real-time
- FR-12.4: Cancel jobs
- FR-12.5: Clear completed jobs
- FR-12.6: List indexed libraries
- FR-12.7: Remove libraries
- FR-12.8: Search documentation
- FR-12.9: View search results with syntax highlighting
- FR-12.10: Filter and sort results

## CLI Interface

### FR-13: Command-Line Interface
**Priority**: High
**Description**: CLI for scripting and automation

**Requirements**:
- FR-13.1: `docs-mcp-server` default command (starts server)
- FR-13.2: `docs-mcp-server scrape` - queue scraping job
- FR-13.3: `docs-mcp-server search` - search documentation
- FR-13.4: `docs-mcp-server list` - list libraries
- FR-13.5: `docs-mcp-server remove` - delete library
- FR-13.6: `docs-mcp-server web` - start web interface only
- FR-13.7: `docs-mcp-server worker` - start worker only
- FR-13.8: `docs-mcp-server mcp` - start MCP server only
- FR-13.9: Configuration via environment variables
- FR-13.10: Configuration via CLI flags

## Data Management

### FR-14: Library Management
**Priority**: Critical
**Description**: Manage libraries and versions

**Requirements**:
- FR-14.1: Create library entries
- FR-14.2: List all libraries with versions
- FR-14.3: Delete library (all versions)
- FR-14.4: Delete specific version
- FR-14.5: Update library metadata
- FR-14.6: Validate library existence

### FR-15: Document Management
**Priority**: Critical
**Description**: Store and retrieve document chunks

**Requirements**:
- FR-15.1: Bulk insert documents
- FR-15.2: Update documents
- FR-15.3: Delete documents by library/version
- FR-15.4: Retrieve documents by ID
- FR-15.5: Count documents per library/version
- FR-15.6: Document deduplication

## Database Operations

### FR-16: PostgreSQL Integration
**Priority**: Critical
**Description**: Core PostgreSQL database operations

**Requirements**:
- FR-16.1: Connection pooling (configurable min/max)
- FR-16.2: Connection health checks
- FR-16.3: Automatic reconnection on failure
- FR-16.4: Transaction support
- FR-16.5: Prepared statement usage
- FR-16.6: Query timeout configuration
- FR-16.7: SSL/TLS connection support

### FR-17: Schema Migrations
**Priority**: Critical
**Description**: Database schema versioning and migration

**Requirements**:
- FR-17.1: Automatic migration on startup
- FR-17.2: Migration version tracking
- FR-17.3: Migration rollback support
- FR-17.4: Migration validation
- FR-17.5: Idempotent migrations

### FR-18: pgvector Extension
**Priority**: Critical
**Description**: Vector extension management

**Requirements**:
- FR-18.1: Verify pgvector extension installed
- FR-18.2: Create vector indexes (HNSW)
- FR-18.3: Configure index parameters (m, ef_construction)
- FR-18.4: Support multiple distance functions (cosine, L2, inner product)
- FR-18.5: Dimension validation

## Configuration and Deployment

### FR-19: Configuration Management
**Priority**: High
**Description**: Flexible configuration system

**Requirements**:
- FR-19.1: Environment variable configuration
- FR-19.2: CLI flag override
- FR-19.3: Configuration validation on startup
- FR-19.4: Default values for all settings
- FR-19.5: Configuration documentation

### FR-20: Docker Deployment
**Priority**: High
**Description**: Containerized deployment support

**Requirements**:
- FR-20.1: Docker image with Node.js runtime
- FR-20.2: Docker Compose configuration
- FR-20.3: PostgreSQL service definition
- FR-20.4: Volume persistence for database
- FR-20.5: Environment variable injection
- FR-20.6: Health check endpoints
- FR-20.7: Multi-container orchestration

## Authentication and Security

### FR-21: OAuth2/OIDC Authentication (Optional)
**Priority**: Medium
**Description**: Enterprise authentication support

**Requirements**:
- FR-21.1: OAuth2/OIDC provider integration
- FR-21.2: Dynamic client registration
- FR-21.3: Token validation
- FR-21.4: Protected resource metadata endpoint
- FR-21.5: Authentication bypass for internal services
- FR-21.6: Read-only mode support

## Observability

### FR-22: Logging
**Priority**: High
**Description**: Application logging and debugging

**Requirements**:
- FR-22.1: Structured logging with levels (debug, info, warn, error)
- FR-22.2: Component-specific logging
- FR-22.3: Request/response logging
- FR-22.4: Performance metrics logging
- FR-22.5: Error stack traces

### FR-23: Telemetry (Optional)
**Priority**: Low
**Description**: Anonymous usage analytics

**Requirements**:
- FR-23.1: Privacy-first telemetry (no query content, URLs, or documents)
- FR-23.2: Command usage tracking
- FR-23.3: Tool execution metrics
- FR-23.4: Performance metrics
- FR-23.5: Error categorization
- FR-23.6: Opt-out mechanism

### FR-24: Health Checks
**Priority**: High
**Description**: Service health monitoring

**Requirements**:
- FR-24.1: /health endpoint
- FR-24.2: /health/database endpoint
- FR-24.3: PostgreSQL connection verification
- FR-24.4: pgvector extension verification
- FR-24.5: Worker service health
- FR-24.6: JSON health status response

---

*Last Updated: 2025-11-08*
