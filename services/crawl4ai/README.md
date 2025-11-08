# Crawl4AI Service

AI-optimized web crawling microservice for Scrapegoat using Crawl4AI.

## Features

- FastAPI web service
- Crawl4AI integration for AI-optimized content extraction
- BM25-filtered markdown for better LLM consumption
- Docker containerized
- Health check endpoint

## API Endpoints

### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 123.45
}
```

### Crawl URL

```bash
POST /crawl
Content-Type: application/json

{
  "url": "https://example.com",
  "config": {
    "use_fit_markdown": true,
    "cache_mode": "enabled"
  }
}
```

Response:
```json
{
  "success": true,
  "data": {
    "markdown": "# Example Domain...",
    "raw_markdown": "# Example Domain...",
    "fit_markdown": "# Example Domain...",
    "metadata": {
      "title": "Example Domain",
      "status_code": 200,
      "url": "https://example.com",
      "crawl_time": 2.34
    }
  }
}
```

## Development

### Local Testing

```bash
# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium

# Run service
python -m app.main
```

### Docker

```bash
# Build image
docker build -t scrapegoat-crawl4ai .

# Run container
docker run -p 8001:8001 scrapegoat-crawl4ai

# Test
curl http://localhost:8001/health
```

## Environment Variables

- `HOST`: Server host (default: 0.0.0.0)
- `PORT`: Server port (default: 8001)
- `VERBOSE`: Enable verbose logging (default: false)
- `HEADLESS`: Run browser in headless mode (default: true)
- `MAX_CONCURRENT_CRAWLS`: Maximum concurrent crawls (default: 5)
- `REQUEST_TIMEOUT`: Request timeout in seconds (default: 30)

## Configuration

See `app/config.py` for all configuration options.

## Architecture

- **FastAPI**: Web framework
- **Crawl4AI**: AI-optimized web crawler
- **Playwright**: Headless browser
- **Pydantic**: Request/response validation

## Phase 1: Foundation (Current)

- [x] FastAPI service setup
- [x] Basic /health endpoint
- [x] Basic /crawl endpoint
- [x] Docker container
- [ ] Integration with Node.js client
- [ ] End-to-end testing
