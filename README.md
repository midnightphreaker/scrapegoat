# Scrapegoat: PostgreSQL-Powered Documentation Server

> **✅ PRODUCTION READY - Phase 5 Complete**
>
> PostgreSQL-powered MCP server for enterprise documentation search. Built for production-grade scalability and performance with pgvector hybrid search.
>
> **Status:** Production Ready
> - ✅ PostgreSQL 14+ with pgvector for vector search
> - ✅ Hybrid search (HNSW + GIN indexes + RRF)
> - ✅ Enterprise-grade connection pooling and MVCC
> - ✅ Comprehensive production documentation
> - ✅ 100% test pass rate (164/164 tests)
>
> **Production ready** - Security hardening, performance benchmarks, and deployment guides included.

AI coding assistants often struggle with outdated documentation and hallucinations. The **Docs MCP Server** solves this by providing a personal, always-current knowledge base for your AI. It **indexes 3rd party documentation** from various sources (websites, GitHub, npm, PyPI, local files) and offers powerful, version-aware search tools via the Model Context Protocol (MCP).

This enables your AI agent to access the **latest official documentation**, dramatically improving the quality and reliability of generated code and integration details. It's **free**, **open-source**, runs **locally** for privacy, and integrates seamlessly into your development workflow.

## Why Use the Docs MCP Server?

LLM-assisted coding promises speed and efficiency, but often falls short due to:

- 🌀 **Stale Knowledge:** LLMs train on snapshots of the internet and quickly fall behind new library releases and API changes.
- 👻 **Code Hallucinations:** AI can invent plausible-looking code that is syntactically correct but functionally wrong or uses non-existent APIs.
- ❓ **Version Ambiguity:** Generic answers rarely account for the specific version dependencies in your project, leading to subtle bugs.
- ⏳ **Verification Overhead:** Developers spend valuable time double-checking AI suggestions against official documentation.

**Docs MCP Server solves these problems by:**

- ✅ **Providing Up-to-Date Context:** Fetches and indexes documentation directly from official sources (websites, GitHub, npm, PyPI, local files) on demand.
- 🎯 **Delivering Version-Specific Answers:** Search queries can target exact library versions, ensuring information matches your project's dependencies.
- 💡 **Reducing Hallucinations:** Grounds the LLM in real documentation for accurate examples and integration details.
- ⚡ **Boosting Productivity:** Get trustworthy answers faster, integrated directly into your AI assistant workflow.

## ✨ Key Features

### PostgreSQL-Powered Architecture
- **PostgreSQL 14+ with pgvector:** Enterprise-grade database with native vector search support
- **Hybrid Search:** Combines vector similarity (HNSW index) + full-text search (GIN index) using Reciprocal Rank Fusion (RRF)
- **Production Scalability:** Handle millions of documents with proper indexing, connection pooling, and MVCC
- **Advanced Vector Indexing:** HNSW (Hierarchical Navigable Small World) for approximate nearest neighbor search

### Core Features
- **Accurate & Version-Aware AI Responses:** Provides up-to-date, version-specific documentation to reduce AI hallucinations and improve code accuracy.
- **Broad Source Compatibility:** Scrapes documentation from websites, GitHub repos, package manager sites (npm, PyPI), and local file directories.
- **Advanced Search & Processing:** Intelligently chunks documentation semantically, generates embeddings, and combines vector similarity with full-text search.
- **Flexible Embedding Models:** Supports various providers including OpenAI (and compatible APIs), Google Gemini/Vertex AI, Azure OpenAI, AWS Bedrock, and Infinity (local embedding server). Vector search is optional.
- **Enterprise Authentication:** Optional OAuth2/OIDC authentication with dynamic client registration for secure deployments.
- **Web Interface:** Easy-to-use web interface for searching and managing documentation.
- **Free & Open Source:** Community-driven and freely available.
- **Simple Deployment:** Easy setup via Docker or `npx`.
- **Seamless Integration:** Works with MCP-compatible clients (like Claude, Cline, Roo).

> **What is semantic chunking?**
>
> Semantic chunking splits documentation into meaningful sections based on structure—like headings, code blocks, and tables—rather than arbitrary text size. Docs MCP Server preserves logical boundaries, keeps code and tables intact, and removes navigation clutter from HTML docs. This ensures LLMs receive coherent, context-rich information for more accurate and relevant answers.

## Prerequisites

Before installing Scrapegoat, ensure you have:

### Required
- **PostgreSQL 14+** with pgvector extension
  - Quick Start: Use Docker with `pgvector/pgvector:pg16` image
  - Manual Setup: See [PostgreSQL Setup Guide](docs/POSTGRESQL_SETUP.md)
- **Node.js 20+**

### Optional
- **Embedding API Key** (for vector search)
  - OpenAI, Google Vertex AI, Azure OpenAI, or AWS Bedrock
  - Full-text search works without embeddings
- **Docker** (recommended for easy deployment)

## How to Run Scrapegoat

Choose your deployment method:

- [Quick Start (Docker)](#quick-start-docker)
- [Standalone Server](#standalone-server-recommended)
- [Embedded Server](#embedded-server)
- [Advanced: Docker Compose (Scaling)](#advanced-docker-compose-scaling)
- [Production Deployment](#production-deployment)

## Quick Start (Docker)

The fastest way to get started with PostgreSQL and Scrapegoat:

```bash
# 1. Start PostgreSQL with pgvector
docker run -d \
  --name scrapegoat-db \
  -e POSTGRES_USER=scrapegoat \
  -e POSTGRES_PASSWORD=your_password \
  -e POSTGRES_DB=scrapegoat \
  -v scrapegoat-data:/var/lib/postgresql/data \
  -p 5432:5432 \
  pgvector/pgvector:pg16

# 2. Start Scrapegoat
docker run -d \
  --name scrapegoat \
  --link scrapegoat-db:postgres \
  -e DATABASE_URL=postgresql://scrapegoat:your_password@postgres:5432/scrapegoat \
  -e OPENAI_API_KEY=sk-proj-your-key-here \
  -p 6280:6280 \
  ghcr.io/denmaster/scrapegoat:latest \
  --protocol http --host 0.0.0.0 --port 6280

# 3. Access the web interface
open http://localhost:6280
```

**Connection String Format:**
```
postgresql://username:password@hostname:port/database
```

### Production Example

**Den.Lan Infrastructure Setup:**

Scrapegoat is deployed on **http://docs.den.lan** using:
- **PostgreSQL**: postgres.den.lan:5432 (dedicated pgvector database)
- **Embeddings**: embed.den.lan (Infinity server with nomic-ai/nomic-embed-text-v1.5)
- **Web UI**: Port 80 (nginx reverse proxy to internal port 6280)

```bash
# Example production configuration
DATABASE_URL=postgresql://scrapegoat_user:secure_password@postgres.den.lan:5432/scrapegoat
INFINITY_API_URL=http://embed.den.lan
DOCS_MCP_EMBEDDING_MODEL=infinity:nomic-ai/nomic-embed-text-v1.5
NODE_ENV=production
PORT=6280
HOST=0.0.0.0
```

This setup provides:
- ✅ Free unlimited embeddings (local Infinity server)
- ✅ Enterprise PostgreSQL with pgvector
- ✅ Production-ready with systemd service
- ✅ Nginx reverse proxy for port 80 access

For complete deployment options, see [Deployment Guide](docs/DEPLOYMENT.md).

## Standalone Server (Recommended)

Run a standalone server that includes both MCP endpoints and web interface in a single process. This is the easiest way to get started.

### Option 1: Docker

1. **Install Docker.**
2. **Start PostgreSQL with pgvector:**

   ```bash
   docker run -d \
     --name scrapegoat-db \
     -e POSTGRES_USER=scrapegoat \
     -e POSTGRES_PASSWORD=your_secure_password \
     -e POSTGRES_DB=scrapegoat \
     -v scrapegoat-data:/var/lib/postgresql/data \
     -p 5432:5432 \
     pgvector/pgvector:pg16
   ```

3. **Start Scrapegoat server:**

   ```bash
   docker run --rm \
     --link scrapegoat-db:postgres \
     -e DATABASE_URL=postgresql://scrapegoat:your_secure_password@postgres:5432/scrapegoat \
     -e OPENAI_API_KEY="your-openai-api-key" \
     -p 6280:6280 \
     ghcr.io/denmaster/scrapegoat:latest \
     --protocol http --host 0.0.0.0 --port 6280
   ```

   **Note:** `DATABASE_URL` is required. `OPENAI_API_KEY` is optional for vector search.

### Option 2: npx

1. **Install Node.js 20.x or later.**
2. **Set up PostgreSQL with pgvector** (see [PostgreSQL Setup Guide](docs/POSTGRESQL_SETUP.md))
3. **Configure environment:**

   ```bash
   export DATABASE_URL=postgresql://scrapegoat:password@localhost:5432/scrapegoat
   export OPENAI_API_KEY="your-openai-api-key"  # Optional for vector search
   ```

4. **Start the server:**

   ```bash
   npx @denmaster/scrapegoat@latest
   ```

   This will run the server on port 6280 by default.

   **Note:** `DATABASE_URL` is required. The database will be auto-initialized on first run.

### Configure Your MCP Client

Add this to your MCP settings (VS Code, Claude Desktop, etc.):

```json
{
  "mcpServers": {
    "scrapegoat": {
      "type": "sse",
      "url": "http://localhost:6280/sse",
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

**Alternative connection types:**

```jsonc
// SSE (Server-Sent Events)
"type": "sse", "url": "http://localhost:6280/sse"

// HTTP (Streamable)
"type": "http", "url": "http://localhost:6280/mcp"
```

Restart your AI assistant after updating the config.

### Access the Web Interface

Open `http://localhost:6280` in your browser to manage documentation and monitor jobs.

### CLI Usage with Standalone Server

You can also use CLI commands to interact with the PostgreSQL database:

```bash
# Set database connection
export DATABASE_URL=postgresql://scrapegoat:password@localhost:5432/scrapegoat

# List indexed libraries
OPENAI_API_KEY="your-key" npx @denmaster/scrapegoat@latest list

# Search documentation
OPENAI_API_KEY="your-key" npx @denmaster/scrapegoat@latest search react "useState hook"

# Scrape new documentation (connects to running server's worker)
npx @denmaster/scrapegoat@latest scrape react https://react.dev/reference/react --server-url http://localhost:6280/api
```

**Note:** All CLI commands require `DATABASE_URL` to be set.

### Adding Library Documentation

1. Open the Web Interface at `http://localhost:6280`.
2. Use the "Queue New Scrape Job" form.
3. Enter the documentation URL, library name, and (optionally) version.
4. Click "Queue Job". Monitor progress in the Job Queue.
5. Repeat for each library you want indexed.

Once a job completes, the docs are searchable via your AI assistant or the Web UI.

![Scrapegoat Web Interface](docs/scrapegoat.png)

**Benefits:**

- Single command setup with both web UI and MCP server
- Persistent data storage (Docker volume or local directory)
- No repository cloning required
- Full feature access including web interface

To stop the server, press `Ctrl+C`.

## Embedded Server

Run the MCP server directly embedded in your AI assistant without a separate process or web interface. This method provides MCP integration only.

### Configure Your MCP Client

Add this to your MCP settings (VS Code, Claude Desktop, etc.):

```json
{
  "mcpServers": {
    "scrapegoat": {
      "command": "npx",
      "args": ["@denmaster/scrapegoat@latest"],
      "env": {
        "DATABASE_URL": "postgresql://scrapegoat:password@localhost:5432/scrapegoat",
        "OPENAI_API_KEY": "sk-proj-..."
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

**Required:** `DATABASE_URL` must be set to connect to PostgreSQL.
**Optional:** `OPENAI_API_KEY` enables vector search for improved results.

Restart your application after updating the config.

### Adding Library Documentation

**Option 1: Use MCP Tools**

Your AI assistant can index new documentation using the built-in `scrape_docs` tool:

```
Please scrape the React documentation from https://react.dev/reference/react for library "react" version "18.x"
```

**Option 2: Launch Web Interface**

Start a temporary web interface that shares the same database:

```bash
OPENAI_API_KEY="your-key" npx @denmaster/scrapegoat@latest web --port 6281
```

Then open `http://localhost:6281` to manage documentation. Stop the web interface when done (`Ctrl+C`).

**Option 3: CLI Commands**

Use CLI commands directly (avoid running scrape jobs concurrently with embedded server):

```bash
# Set database connection
export DATABASE_URL=postgresql://scrapegoat:password@localhost:5432/scrapegoat

# List libraries
OPENAI_API_KEY="your-key" npx @denmaster/scrapegoat@latest list

# Search documentation
OPENAI_API_KEY="your-key" npx @denmaster/scrapegoat@latest search react "useState hook"
```

**Benefits:**

- Direct integration with AI assistant
- No separate server process required
- Persistent data storage in user's home directory
- Shared database with standalone server and CLI

**Limitations:**

- No web interface (unless launched separately)
- Documentation indexing requires MCP tools or separate commands

## Scraping Local Files and Folders

You can index documentation from your local filesystem by using a `file://` URL as the source. This works in both the Web UI and CLI.

**Examples:**

- Web: `https://react.dev/reference/react`
- Local file: `file:///Users/me/docs/index.html`
- Local folder: `file:///Users/me/docs/my-library`

**Requirements:**

- All files with a MIME type of `text/*` are processed. This includes HTML, Markdown, plain text, and source code files such as `.js`, `.ts`, `.tsx`, `.css`, etc. Binary files, PDFs, images, and other non-text formats are ignored.
- You must use the `file://` prefix for local files/folders.
- The path must be accessible to the server process.
- **If running in Docker:**
  - You must mount the local folder into the container and use the container path in your `file://` URL.
  - Example Docker run:
    ```bash
    docker run --rm \
      -e OPENAI_API_KEY="your-key" \
      -v /absolute/path/to/docs:/docs:ro \
      -v scrapegoat-data:/data \
      -p 6280:6280 \
      ghcr.io/denmaster/scrapegoat:latest \
      scrape mylib file:///docs/my-library
    ```
  - In the Web UI, enter the path as `file:///docs/my-library` (matching the container path).

See the tooltips in the Web UI and CLI help for more details.

## Advanced: Docker Compose (Scaling)

For production deployments or when you need to scale processing, use Docker Compose to run separate services. The system selects either a local in-process worker or a remote worker client based on the configuration, ensuring consistent behavior across modes.

**Start the services:**

```bash
# Clone the repository (to get docker-compose.yml)
git clone http://gitlab.den.lan/pub/scrapegoat.git
cd scrapegoat

# Set your environment variables
export OPENAI_API_KEY="your-key-here"

# Start all services
docker compose up -d
```

**Service architecture:**

- **Worker** (port 8080): Handles documentation processing jobs
- **MCP Server** (port 6280): Provides `/sse` endpoint for AI tools
- **Web Interface** (port 6281): Browser-based management interface

**Configure your MCP client:**

```json
{
  "mcpServers": {
    "scrapegoat": {
      "type": "sse",
      "url": "http://localhost:6280/sse",
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

**Alternative connection types:**

```json
// SSE (Server-Sent Events)
"type": "sse", "url": "http://localhost:6280/sse"

// HTTP (Streamable)
"type": "http", "url": "http://localhost:6280/mcp"
```

**Access interfaces:**

- Web Interface: `http://localhost:6281`
- MCP Endpoint (HTTP): `http://localhost:6280/mcp`
- MCP Endpoint (SSE): `http://localhost:6280/sse`

This architecture allows independent scaling of processing (workers) and user interfaces.

## Production Deployment

For production environments, see the comprehensive [Deployment Guide](docs/DEPLOYMENT.md) which covers:

- Cloud deployment (AWS RDS, Azure Database, GCP Cloud SQL)
- Docker Compose multi-service architecture
- Production configuration and security hardening
- Monitoring, backup, and recovery procedures
- Health checks and troubleshooting

## Configuration

Scrapegoat requires PostgreSQL with pgvector. Configure via environment variables:

### Required Configuration

```bash
# Database connection (REQUIRED)
DATABASE_URL=postgresql://username:password@hostname:port/database
```

### Optional Configuration

To enable vector search for improved hybrid search results, configure an embedding provider:

### Command Line Argument Overrides

Many CLI arguments can be overridden using environment variables. This is useful for Docker deployments, CI/CD pipelines, or setting default values.

| Environment Variable       | CLI Argument           | Description                                     | Used by Commands          |
| -------------------------- | ---------------------- | ----------------------------------------------- | ------------------------- |
| `DOCS_MCP_STORE_PATH`      | `--store-path`         | Custom path for data storage directory          | all                       |
| `DOCS_MCP_TELEMETRY`       | `--no-telemetry`       | Disable telemetry (`false` to disable)          | all                       |
| `DOCS_MCP_PROTOCOL`        | `--protocol`           | MCP server protocol (auto, stdio, http)         | default, mcp              |
| `DOCS_MCP_PORT`            | `--port`               | Server port                                     | default, mcp, web, worker |
| `DOCS_MCP_WEB_PORT`        | `--port` (web command) | Web interface port (web command only)           | web                       |
| `PORT`                     | `--port`               | Server port (fallback if DOCS_MCP_PORT not set) | default, mcp, web, worker |
| `DOCS_MCP_HOST`            | `--host`               | Server host/bind address                        | default, mcp, web, worker |
| `HOST`                     | `--host`               | Server host (fallback if DOCS_MCP_HOST not set) | default, mcp, web, worker |
| `DOCS_MCP_EMBEDDING_MODEL` | `--embedding-model`    | Embedding model configuration                   | default, mcp, web, worker |
| `DOCS_MCP_AUTH_ENABLED`    | `--auth-enabled`       | Enable OAuth2/OIDC authentication               | default, mcp              |
| `DOCS_MCP_AUTH_ISSUER_URL` | `--auth-issuer-url`    | OAuth2 provider issuer/discovery URL            | default, mcp              |
| `DOCS_MCP_AUTH_AUDIENCE`   | `--auth-audience`      | JWT audience claim (resource identifier)        | default, mcp              |

**Usage Examples:**

```bash
# Set via environment variables
export DOCS_MCP_PORT=8080
export DOCS_MCP_HOST=0.0.0.0
export DOCS_MCP_EMBEDDING_MODEL=text-embedding-3-small
npx @denmaster/scrapegoat@latest

# Override with CLI arguments (takes precedence)
DOCS_MCP_PORT=8080 npx @denmaster/scrapegoat@latest --port 9090
```

### Embedding Provider Configuration

Configure embedding providers via environment variables. Set these in your shell, Docker, or MCP client config.

| Variable                           | Description                                           | Required |
| ---------------------------------- | ----------------------------------------------------- | -------- |
| `DATABASE_URL`                     | PostgreSQL connection string                          | **Yes**  |
| `DOCS_MCP_EMBEDDING_MODEL`         | Embedding model to use (see below for options).       | No       |
| `OPENAI_API_KEY`                   | OpenAI API key for embeddings.                        | No       |
| `OPENAI_API_BASE`                  | Custom OpenAI-compatible API endpoint (e.g., Ollama). | No       |
| `INFINITY_API_URL`                 | Infinity embedding server URL (e.g., http://embed.den.lan). | No       |
| `GOOGLE_API_KEY`                   | Google API key for Gemini embeddings.                 | No       |
| `GOOGLE_APPLICATION_CREDENTIALS`   | Path to Google service account JSON for Vertex AI.    | No       |
| `AWS_ACCESS_KEY_ID`                | AWS key for Bedrock embeddings.                       | No       |
| `AWS_SECRET_ACCESS_KEY`            | AWS secret for Bedrock embeddings.                    | No       |
| `AWS_REGION`                       | AWS region for Bedrock.                               | No       |
| `AZURE_OPENAI_API_KEY`             | Azure OpenAI API key.                                 | No       |
| `AZURE_OPENAI_API_INSTANCE_NAME`   | Azure OpenAI instance name.                           | No       |
| `AZURE_OPENAI_API_DEPLOYMENT_NAME` | Azure OpenAI deployment name.                         | No       |
| `AZURE_OPENAI_API_VERSION`         | Azure OpenAI API version.                             | No       |

See [examples above](#alternative-using-docker) for usage.

### Embedding Model Options

Set `DOCS_MCP_EMBEDDING_MODEL` to one of:

- `text-embedding-3-small` (default, OpenAI)
- `openai:snowflake-arctic-embed2` (OpenAI-compatible, Ollama)
- `infinity:nomic-ai/nomic-embed-text-v1.5` (Infinity local server)
- `vertex:text-embedding-004` (Google Vertex AI)
- `gemini:embedding-001` (Google Gemini)
- `aws:amazon.titan-embed-text-v1` (AWS Bedrock)
- `microsoft:text-embedding-ada-002` (Azure OpenAI)
- Or any OpenAI-compatible model name

### Provider-Specific Configuration Examples

Here are complete configuration examples for different embedding providers:

**OpenAI (Default):**

```bash
DATABASE_URL="postgresql://scrapegoat:password@localhost:5432/scrapegoat" \
OPENAI_API_KEY="sk-proj-your-openai-api-key" \
DOCS_MCP_EMBEDDING_MODEL="text-embedding-3-small" \
npx @denmaster/scrapegoat@latest
```

**Ollama (Local):**

```bash
OPENAI_API_KEY="ollama" \
OPENAI_API_BASE="http://localhost:11434/v1" \
DOCS_MCP_EMBEDDING_MODEL="nomic-embed-text" \
npx @denmaster/scrapegoat@latest
```

**LM Studio (Local):**

```bash
OPENAI_API_KEY="lmstudio" \
OPENAI_API_BASE="http://localhost:1234/v1" \
DOCS_MCP_EMBEDDING_MODEL="text-embedding-qwen3-embedding-4b" \
npx @denmaster/scrapegoat@latest
```

**Infinity (Local Embedding Server):**

```bash
DATABASE_URL="postgresql://scrapegoat:password@localhost:5432/scrapegoat" \
INFINITY_API_URL="http://embed.den.lan" \
DOCS_MCP_EMBEDDING_MODEL="infinity:nomic-ai/nomic-embed-text-v1.5" \
npx @denmaster/scrapegoat@latest
```

**Google Gemini:**

```bash
GOOGLE_API_KEY="your-google-api-key" \
DOCS_MCP_EMBEDDING_MODEL="gemini:embedding-001" \
npx @denmaster/scrapegoat@latest
```

**Google Vertex AI:**

```bash
GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/gcp-service-account.json" \
DOCS_MCP_EMBEDDING_MODEL="vertex:text-embedding-004" \
npx @denmaster/scrapegoat@latest
```

**AWS Bedrock:**

```bash
AWS_ACCESS_KEY_ID="your-aws-access-key-id" \
AWS_SECRET_ACCESS_KEY="your-aws-secret-access-key" \
AWS_REGION="us-east-1" \
DOCS_MCP_EMBEDDING_MODEL="aws:amazon.titan-embed-text-v1" \
npx @denmaster/scrapegoat@latest
```

**Azure OpenAI:**

```bash
AZURE_OPENAI_API_KEY="your-azure-openai-api-key" \
AZURE_OPENAI_API_INSTANCE_NAME="your-instance-name" \
AZURE_OPENAI_API_DEPLOYMENT_NAME="your-deployment-name" \
AZURE_OPENAI_API_VERSION="2024-02-01" \
DOCS_MCP_EMBEDDING_MODEL="microsoft:text-embedding-ada-002" \
npx @denmaster/scrapegoat@latest
```

## Documentation

Complete documentation is available in the `docs/` directory:

- **[PostgreSQL Setup Guide](docs/POSTGRESQL_SETUP.md)** - Database installation and configuration
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment strategies
- **[Configuration Reference](docs/CONFIGURATION.md)** - All environment variables
- **[Migration Guide](docs/MIGRATION.md)** - SQLite to PostgreSQL migration
- **[Performance Tuning](docs/PERFORMANCE.md)** - Optimization and benchmarks
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[Security Checklist](docs/SECURITY_CHECKLIST.md)** - Production security hardening
- **[Authentication Guide](docs/authentication.md)** - OAuth2/OIDC enterprise auth

For more architectural details, see the [ARCHITECTURE.md](ARCHITECTURE.md).

## Telemetry

The Docs MCP Server includes privacy-first telemetry to help improve the product. We collect anonymous usage data to understand how the tool is used and identify areas for improvement.

### What We Collect

- Command usage patterns and success rates
- Tool execution metrics (counts, durations, error types)
- Pipeline job statistics (progress, completion rates)
- Service configuration patterns (auth enabled, read-only mode)
- Performance metrics (response times, processing efficiency)
- Protocol usage (stdio vs HTTP, transport modes)

### What We DON'T Collect

- Search query content or user input
- URLs being scraped or accessed
- Document content or scraped data
- Authentication tokens or credentials
- Personal information or identifying data

### Disabling Telemetry

You can disable telemetry collection entirely:

**Option 1: CLI Flag**

```bash
npx @denmaster/scrapegoat@latest --no-telemetry
```

**Option 2: Environment Variable**

```bash
DOCS_MCP_TELEMETRY=false npx @denmaster/scrapegoat@latest
```

**Option 3: Docker**

```bash
docker run \
  -e DOCS_MCP_TELEMETRY=false \
  -v docs-mcp-data:/data \
  -p 6280:6280 \
  ghcr.io/denmaster/scrapegoat:latest
```

For more details about our telemetry practices, see the [Telemetry Guide](docs/telemetry.md).

## Development

To develop or contribute to the Docs MCP Server:

- Fork the repository and create a feature branch.
- Follow the code conventions in [ARCHITECTURE.md](ARCHITECTURE.md).
- Write clear commit messages (see Git guidelines above).
- Open a pull request with a clear description of your changes.

For questions or suggestions, open an issue.

### Architecture

For details on the project's architecture and design principles, please see [ARCHITECTURE.md](ARCHITECTURE.md).

_Notably, the vast majority of this project's code was generated by the AI assistant Cline, leveraging the capabilities of this very MCP server._

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
