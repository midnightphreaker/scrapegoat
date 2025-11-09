# Scrapegoat

> Documentation scraping and indexing service with Model Context Protocol (MCP) integration

Scrapegoat enables AI assistants to search, retrieve, and index web documentation using vector similarity search. It provides a three-service architecture optimized for both AI integration and human use.

## Features

- **MCP Integration**: Native Model Context Protocol support for AI assistants
- **Vector Search**: PostgreSQL + pgvector for semantic similarity search
- **Multi-Fetcher Pipeline**: Choose from HTTP, Playwright, or Crawl4AI
- **Screenshot Capture**: Visual documentation with Crawl4AI integration
- **Three-Service Architecture**: Specialized services for MCP, Web UI, and background processing
- **Web Interface**: Easy-to-use web UI for searching and managing documentation

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 14+ with pgvector extension
- Docker (optional, for Crawl4AI)

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/scrapegoat.git
cd scrapegoat

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your settings

# Set up database
createdb scrapegoat
psql scrapegoat -c "CREATE EXTENSION vector;"
npm run db:push

# Build and start
npm run build
npm start
```

For detailed installation instructions, see [INSTALL.md](INSTALL.md).

## Architecture

Scrapegoat runs three specialized services:

- **MCP Server** (port 6280): AI integration via Model Context Protocol
- **Web Service** (port 6281): Web UI and human-facing API  
- **Worker API** (port 8080): Background indexing and processing

All services connect to a shared PostgreSQL database with pgvector for vector similarity search.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed system design.

## Usage

### Indexing Documentation

```bash
# Index a URL
curl -X POST http://localhost:8080/api/indexing/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://docs.example.com"}'
```

### Searching with MCP

Configure Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "scrapegoat": {
      "url": "http://localhost:6280/mcp",
      "transport": "sse"
    }
  }
}
```

Ask Claude to search your indexed documentation:
```
Search the documentation for authentication examples
```

### Web Interface

Access the web UI at `http://localhost:6281` to:
- Search indexed documentation
- View system statistics
- Monitor MCP server status
- Browse indexed URLs

## Configuration

Key environment variables:

```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/scrapegoat"

# Service Ports
MCP_PORT=6280
WEB_PORT=6281
WORKER_PORT=8080

# Crawl4AI (optional)
CRAWL4AI_URL="http://localhost:11235"

# OpenAI (for embeddings)
OPENAI_API_KEY="sk-..."
```

See [.env.example](.env.example) for all configuration options.

## Fetcher Types

Choose the appropriate fetcher for your content:

| Fetcher | Use Case | Features |
|---------|----------|----------|
| **HTTP** | Static HTML | Fast, no JavaScript |
| **Playwright** | Dynamic content | Full browser, JavaScript execution |
| **Crawl4AI** | Advanced scraping | Screenshots, LLM-friendly extraction |

## Development

Run in development mode with hot reload:

```bash
# Run all services
npm run dev

# Or run separately:
# Terminal 1: Server (includes MCP)
npm run dev:server

# Terminal 2: Web UI
npm run dev:web
```

See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for development guidelines.

## Production Deployment

### Using systemd

Install as systemd services:

```bash
# Copy service files to /etc/systemd/system/
sudo cp systemd/*.service /etc/systemd/system/

# Enable and start services
sudo systemctl enable scrapegoat-{mcp,web,worker}
sudo systemctl start scrapegoat-{mcp,web,worker}
```

### Using nginx

Configure reverse proxy for all services:

```nginx
location /mcp { proxy_pass http://localhost:6280; }
location / { proxy_pass http://localhost:6281; }
```

See [docs/NGINX.md](docs/NGINX.md) for complete nginx configuration.

## Documentation

- [INSTALL.md](INSTALL.md) - Detailed installation guide
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - System architecture and design
- [docs/NGINX.md](docs/NGINX.md) - Reverse proxy configuration
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) - Common issues and solutions
- [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) - Development and contribution guide
- [docs/QUICK_REFERENCE.md](docs/QUICK_REFERENCE.md) - Command quick reference

## Technology Stack

- **Backend**: Node.js, TypeScript, Fastify
- **Database**: PostgreSQL with pgvector extension
- **MCP**: Model Context Protocol for AI integration
- **Scraping**: Playwright, Crawl4AI (Docker)
- **ORM**: Drizzle
- **Vector Search**: OpenAI embeddings + pgvector

## Troubleshooting

**Services won't start:**
```bash
sudo journalctl -u scrapegoat-mcp -f
sudo journalctl -u scrapegoat-web -f
sudo journalctl -u scrapegoat-worker -f
```

**Database connection issues:**
```bash
psql -U scrapegoat -d scrapegoat
```

**MCP not connecting:**
```bash
curl http://localhost:6280/health
```

See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for detailed solutions.

## Contributing

Contributions are welcome! Please read [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/scrapegoat/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/scrapegoat/discussions)
- **Documentation**: [docs/](docs/)

## Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io/) by Anthropic
- [Crawl4AI](https://github.com/unclecode/crawl4ai) for advanced web scraping
- [pgvector](https://github.com/pgvector/pgvector) for vector similarity search
