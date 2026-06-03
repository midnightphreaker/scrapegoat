<div align="center">

<img src="assets/ScrapeGoat-Banner.svg" alt="ScrapeGoat Logo" width="700">

<br>

**ScrapeGoat: Your AI's Documentation GOAT!**

<br>

</div>


**ScrapeGoat** solves the problem of AI hallucinations and outdated knowledge by providing a personal, always-current documentation index for your AI coding assistant. It fetches official docs from websites, GitHub, npm, PyPI, and local files, allowing your AI to query the exact version you are using.

## ❄️ Why ScrapeGoat?

The open-source alternative to **Context7**, **NiA**, and **Ref.Tools**.

-   ❄️ **Up-to-Date Context:** Fetches documentation directly from official sources on demand.
-   📦 **Version-Specific:** Queries target the exact library versions in your project.
-   🔥 **Reduces Hallucinations:** Grounds LLMs in real documentation.
-   🔒 **Private & Local:** Runs entirely on your machine; your code never leaves your network.
-   🐐 **Broad Compatibility:** Works with any MCP-compatible client (Claude, Cline, etc.).
-   📚 **Multiple Sources:** Index websites, GitHub repositories, local folders, and zip archives — or upload files directly from the browser.
-   📄 **Rich File Support:** Processes HTML, Markdown, PDF, Office documents (Word, Excel, PowerPoint), OpenDocument, RTF, EPUB, Jupyter Notebooks, and [90+ source code languages](docs/concepts/supported-formats.md).
-   🛡️ **Built-in Security:** SSRF protection on all outbound fetches and tRPC API authentication enforcement.

---

## 📄 Supported Formats

| Category | Formats |
|----------|---------|
| **Documents** | PDF, Word (.docx/.doc), Excel (.xlsx/.xls), PowerPoint (.pptx/.ppt), OpenDocument (.odt/.ods/.odp), RTF, EPUB, FictionBook, Jupyter Notebooks |
| **Archives** | ZIP, TAR, gzipped TAR (contents are extracted and processed individually) |
| **Web** | HTML, XHTML |
| **Markup** | Markdown, MDX, reStructuredText, AsciiDoc, Org Mode, Textile, R Markdown |
| **Source Code** | TypeScript, JavaScript, Python, Go, Rust, C/C++, Java, Kotlin, Ruby, PHP, Swift, C#, and [many more](docs/concepts/supported-formats.md#source-code) |
| **Data** | JSON, YAML, TOML, CSV, XML, SQL, GraphQL, Protocol Buffers |
| **Config** | Dockerfile, Makefile, Terraform/HCL, INI, dotenv, Bazel |

See **[Supported Formats](docs/concepts/supported-formats.md)** for the complete reference including MIME types and processing details.

---

## 🐐 Quick Start

### CLI First

For agents and scripts, the CLI is usually the simplest way to use ScrapeGoat.

**1. Index documentation** (requires Node.js 22+):

```bash
npx @midnightphreaker/scrapegoat@latest scrape react https://react.dev/reference/react
```

**2. Query the index:**

```bash
npx @midnightphreaker/scrapegoat@latest search react "useEffect cleanup" --output yaml
```

**3. Fetch a single page as Markdown:**

```bash
npx @midnightphreaker/scrapegoat@latest fetch-url https://react.dev/reference/react/useEffect
```

### Output Behavior

- Structured commands default to clean JSON on stdout in non-interactive runs.
- Use `--output json|yaml|toon` to pick a structured format.
- Plain-text commands such as `fetch-url` keep their text payload on stdout.
- Diagnostics go through the shared logger and are kept off stdout in non-interactive runs.
- Use `--quiet` to suppress non-error diagnostics or `--verbose` to enable debug output.

### Agent Skills

The [`skills/`](skills/) directory contains [Agent Skills](https://agentskills.io) that teach AI coding assistants how to use the CLI — covering documentation search, index management, and URL fetching.

### MCP Server

If you want a long-running MCP endpoint for Claude, Cline, Copilot, Gemini CLI, or other MCP clients:

**1. Start the server:**

```bash
npx @midnightphreaker/scrapegoat@latest
```

**2. Open the Web UI** at **[http://localhost:6280](http://localhost:6280)** to add documentation.

**3. Connect your AI client** by adding this to your MCP settings (e.g., `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "scrapegoat": {
      "type": "sse",
      "url": "http://localhost:6280/sse"
    }
  }
}
```

See **[Connecting Clients](docs/guides/mcp-clients.md)** for VS Code (Cline, Roo) and other setup options.

### Health Check

ScrapeGoat exposes a health endpoint for monitoring and load balancer integrations:

```
GET /api/health → { "status": "ok" }
```

<details>
<summary>Alternative: Run with Docker</summary>

```bash
docker run --rm \
  -v scrapegoat-data:/data \
  -v scrapegoat-config:/config \
  -p 6280:6280 \
  ghcr.io/midnightphreaker/scrapegoat:latest \
  --protocol http --host 0.0.0.0 --port 6280
```

</details>

### 🧠 Configure Embedding Model (Recommended)

Using an embedding model is **optional** but dramatically improves search quality by enabling semantic vector search.

**Example: Enable OpenAI Embeddings**

```bash
OPENAI_API_KEY="sk-proj-..." npx @midnightphreaker/scrapegoat@latest
```

See **[Embedding Models](docs/guides/embedding-models.md)** for configuring **Ollama**, **Gemini**, **Azure**, and others.

### 📁 Local Upload

ScrapeGoat supports uploading local documentation files through the Web UI. Upload files, folders, or archives directly from the browser — the backend parser validates content, so there are no file extension restrictions.

The source selection modal provides three options:

-   **Add File** — pick individual documents, archives, or code files.
-   **Add Folder** — select an entire directory.
-   **Add Virtual Folder** — group files into a named collection.

Uploaded files are staged temporarily before being processed.

**Staging Modes:**

| Mode | Description |
|------|-------------|
| `memory` (default) | Files are held in memory during the upload session. No volume mount required. |
| `filesystem` | Files are written to a staging directory on disk. Requires a Docker volume mount. |

**To enable filesystem staging mode in Docker:**

1. Uncomment the staging volume mount and environment variables in `docker-compose.yml` (or `docker-compose.postgres.yml`) for the **worker** and **web** services:

   ```yaml
   environment:
     SCRAPEGOAT_WEBUI_IMPORT_STAGING_MODE: filesystem
     SCRAPEGOAT_WEBUI_IMPORT_STAGING_INTERNAL_PATH: /data/staging
   volumes:
     - scrapegoat-staging:/data/staging
   ```

2. Uncomment the `scrapegoat-staging` volume definition at the bottom of the compose file.

**Relevant environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `SCRAPEGOAT_WEBUI_IMPORT_STAGING_MODE` | `memory` | Staging mode: `memory` or `filesystem` |
| `SCRAPEGOAT_WEBUI_IMPORT_STAGING_INTERNAL_PATH` | — | Container path for filesystem staging (e.g. `/data/staging`) |

### 🔄 Switching Embedding Models or Dimensions

When you change the embedding model or vector dimensions (e.g., from 1536 to 768), ScrapeGoat throws an `EmbeddingModelChangedError` because existing vectors are incompatible. This requires manual confirmation and invalidates all stored embeddings — full-text search continues to work, but vector search won't return results until libraries are re-scraped.

> **⚠️ Always back up your database before changing dimensions.**

#### Interactive (non-Docker) usage

Start the server normally — it will detect the change and prompt for confirmation:

```
Embedding dimension mismatch: stored=1536, configured=768
This will invalidate all existing vectors. Continue? (y/N):
```

Type `y` to confirm. Then re-scrape libraries to regenerate vectors:

```bash
scrapegoat scrape <library> <version>
```

#### Docker usage

The worker runs non-interactively and can't prompt for confirmation. Use one of these approaches:

**Option A — Run the worker interactively once:**

```bash
docker compose run --rm -it worker
# Type y when prompted, then Ctrl+C
docker compose up -d
```

**Option B — Direct database migration:**

```bash
# 1. Stop the worker
docker compose stop worker

# 2. Connect to postgres
docker exec -it scrapegoat-postgres psql -U scrapegoat -d scrapegoat

# 3. Nullify existing vectors
UPDATE documents SET embedding = NULL;

# 4. Alter the column type (replace NEW_DIMENSION, e.g. 768)
ALTER TABLE documents ALTER COLUMN embedding TYPE vector(NEW_DIMENSION);

# 5. Update metadata
INSERT INTO metadata (key, value) VALUES ('embedding_dimension', 'NEW_DIMENSION')
  ON CONFLICT (key) DO UPDATE SET value = 'NEW_DIMENSION';

# 6. Restart
docker compose up -d
```

Then re-scrape libraries to regenerate vectors.

#### Common dimensions

| Model | Dimensions |
|-------|-----------|
| `text-embedding-3-small` | 1536 |
| `text-embedding-3-large` | 3072 |
| `nomic-embed-text` | 768 |
| `all-MiniLM-L6-v2` | 384 |

Check your model's documentation for the correct dimension.

---

## 📜 Documentation

### Getting Started
-   **[Installation](docs/setup/installation.md)**: Detailed setup guides for Docker, Node.js (npm), and Embedded mode.
-   **[Connecting Clients](docs/guides/mcp-clients.md)**: How to connect Claude, VS Code (Cline/Roo), and other MCP clients.
-   **[Basic Usage](docs/guides/basic-usage.md)**: Using the Web UI, CLI, and scraping local files.
-   **[Configuration](docs/setup/configuration.md)**: Full reference for config files and environment variables.
-   **[Supported Formats](docs/concepts/supported-formats.md)**: Complete file format and MIME type reference.
-   **[Embedding Models](docs/guides/embedding-models.md)**: Configure OpenAI, Ollama, Gemini, and other providers.

### Key Concepts & Architecture
-   **[Deployment Modes](docs/infrastructure/deployment-modes.md)**: Standalone vs. Distributed (Docker Compose).
-   **[Authentication](docs/infrastructure/authentication.md)**: Securing your server with OAuth2/OIDC.
-   **[Telemetry](docs/infrastructure/telemetry.md)**: Privacy-first usage data collection.
-   **[Architecture](ARCHITECTURE.md)**: Deep dive into the system design.

---

## 🛡️ Security

ScrapeGoat includes several built-in security measures:

-   **SSRF Protection:** All outbound URL fetches are validated against private IP ranges, loopback addresses, link-local addresses, and cloud metadata endpoints. Requests to internal hosts are blocked.
-   **API Authentication:** tRPC API endpoints enforce authentication when OAuth2/OIDC is enabled.
-   **Configurable Host Binding:** By default, services bind to `127.0.0.1` (localhost only). Bind to `0.0.0.0` or a specific IP using `SCRAPEGOAT_HOST` when exposing to a network.
-   **Token Safety:** Authentication tokens are excluded from debug logs to prevent credential leakage.

---

## ❤️ Contributing

We welcome contributions! Please see **[CONTRIBUTING.md](CONTRIBUTING.md)** for development guidelines and setup instructions.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
