# ScrapeGoat

Documentation scraping and search service with intelligent reranking capabilities.

## Features

- Scrape and index documentation from any URL
- Semantic search across multiple libraries and versions
- Optional AI-powered reranking for improved relevance
- RESTful API with comprehensive documentation

## Quick Start

1. Clone the repository
2. Copy `.env.example` to `.env` and configure
3. Run `npm install`
4. Start with `npm start`

## API Endpoints

- `GET /api/libraries` - List all indexed libraries
- `POST /api/scrape` - Scrape documentation from a URL
- `GET /api/search` - Search indexed documentation
- `GET /api/health` - Health check endpoint

## Configuration

See `.env.example` for all available configuration options.

## Documentation

Full documentation available in the [`docs/`](./docs/) directory.

## Reranking (Optional)

ScrapeGoat supports optional reranking to improve search result relevance by 15-35%.

### Enable Reranking

Add to `.env`:

```bash
RERANK_ENABLED=true
RERANK_API_BASE=https://rerank.fenrirsden.org/v1
RERANK_MODEL=qwen3-text-reranker
RERANK_TIMEOUT=5000
```

### How It Works

1. Retrieve 3x more candidates (e.g., 30 for limit=10)
2. Send query + candidates to reranker
3. Return top N reranked results

### Performance Impact

- Latency: +200-400ms when enabled
- Accuracy: +15-35% improvement
- Optional: Set RERANK_ENABLED=false to disable

### Graceful Degradation

If the reranker fails (timeout, error, etc.), ScrapeGoat automatically falls back to the original search results without reranking.

For detailed reranking documentation, see [docs/reranking.md](./docs/reranking.md).

## License

MIT License - see [LICENSE](./LICENSE) file.

## Contributing

See [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md) for guidelines.
