# ScrapeGoat

Documentation scraping and search service with intelligent reranking, MCP server, and modern WebUI.

## Features

- **Scrape & Index** - Crawl documentation from any URL with configurable depth and scope
- **Semantic Search** - Query across multiple libraries and versions
- **AI Reranking** - Optional reranking for 15-35% improved relevance
- **WebUI** - Modern Svelte 5 SPA with dark mode and real-time job progress
- **MCP Server** - Model Context Protocol for AI assistant integration
- **REST & tRPC APIs** - Full API coverage with type-safe client

## Quick Start

```bash
# Clone and install
git clone https://github.com/your-org/scrapegoat.git
cd scrapegoat
npm install

# Configure
cp .env.example .env

# Start server
npm start
```

Access the WebUI at `http://localhost:6281`

## Ports

| Port | Service |
|------|---------|
| 6281 | Main server (HTTP API + WebUI) |
| 6280 | MCP server (stdio/SSE) |
| 8080 | Health/metrics endpoint |

## WebUI

Modern Svelte 5 + SvelteKit SPA with:
- Real-time job progress via SSE
- Multi-URL scrape jobs (up to 10 URLs)
- Library management with search
- Dark/Wide mode toggles
- MCP status indicator

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/libraries` | List all indexed libraries |
| `POST /api/scrape` | Scrape documentation from URL |
| `GET /api/search` | Search indexed documentation |
| `GET /api/health` | Health check |
| `/api/trpc/*` | tRPC endpoints |

## MCP Integration

ScrapeGoat includes a Model Context Protocol server for AI assistant integration:

```bash
# Configure in Claude Desktop or other MCP clients
{
  "mcpServers": {
    "scrapegoat": {
      "command": "node",
      "args": ["/path/to/scrapegoat/dist/mcp/index.js"]
    }
  }
}
```

## Configuration

See `.env.example` for all options. Key settings:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Main server port | `6281` |
| `MCP_PORT` | MCP server port | `6280` |
| `RERANK_ENABLED` | Enable AI reranking | `false` |

## Reranking

Optional reranking improves search relevance by 15-35%:

```bash
RERANK_ENABLED=true
RERANK_API_BASE=https://rerank.example.com/v1
RERANK_MODEL=qwen3-text-reranker
```

Latency: +200-400ms when enabled. Graceful degradation on failure.

## Development

```bash
# Run in development
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Build Docker image
docker build -t scrapegoat .
```

## Documentation

Full documentation in [`docs/`](./docs/):
- [Architecture](./docs/ARCHITECTURE.md)
- [Configuration](./docs/CONFIGURATION.md)
- [Deployment](./docs/DEPLOYMENT.md)
- [API Reference](./docs/api/)
- [Contributing](./docs/CONTRIBUTING.md)

## License

MIT License - see [LICENSE](./LICENSE)

## Contributing

See [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md)
