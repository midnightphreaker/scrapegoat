# Rate Limiting Configuration

This document explains the rate limiting configuration options available in Scrapegoat and how to tune them for your use case.

## Overview

Scrapegoat includes multiple rate limiting mechanisms to prevent overwhelming resources and to respect external service limits:

- **Pipeline concurrency**: Controls parallel scraping jobs
- **Page concurrency**: Controls parallel page requests within a job
- **Embedding concurrency**: Controls parallel image embedding operations
- **Network rate limiting**: Controls HTTP retry behavior and circuit breaker settings
- **Database pooling**: Controls database connection limits

## Configuration

All rate limits are configured via environment variables. See `.env.example` for the complete list.

### Pipeline Concurrency

#### `PIPELINE_MAX_CONCURRENCY` (default: 3)

Controls how many scraping jobs can run simultaneously in the pipeline queue.

**When to adjust:**
- **Increase** (5-10) for faster processing on powerful hardware with many independent libraries to index
- **Decrease** (1-2) for resource-constrained environments or when indexing large, complex documentation sites

**Considerations:**
- Each concurrent job consumes memory for page queues, visited URL tracking, and content buffers
- Higher values may trigger rate limiting on target servers if multiple jobs target the same domain
- Pipeline concurrency is independent of page concurrency (see below)

**Example scenarios:**
```bash
# Development machine with limited RAM
PIPELINE_MAX_CONCURRENCY=1

# Production server with 32GB RAM indexing multiple libraries
PIPELINE_MAX_CONCURRENCY=5

# High-performance server with 64GB RAM
PIPELINE_MAX_CONCURRENCY=10
```

### Page Concurrency

#### `SCRAPER_PAGE_CONCURRENCY` (default: 3)

Controls how many pages are fetched in parallel **within a single scraping job**.

**When to adjust:**
- **Increase** (5-10) for faster crawling of well-behaved documentation sites
- **Decrease** (1-2) for sites with strict rate limits or anti-bot measures

**Considerations:**
- Higher values dramatically increase crawling speed but are more likely to trigger anti-bot protections
- Some sites may block IPs that make too many simultaneous requests
- This setting interacts with `PIPELINE_MAX_CONCURRENCY`: total concurrent requests = `PIPELINE_MAX_CONCURRENCY × SCRAPER_PAGE_CONCURRENCY`

**Example scenarios:**
```bash
# Conservative crawling for sites with rate limits
SCRAPER_PAGE_CONCURRENCY=1

# Normal documentation sites
SCRAPER_PAGE_CONCURRENCY=3

# Aggressive crawling for friendly, high-uptime APIs
SCRAPER_PAGE_CONCURRENCY=10
```

### Embedding Concurrency

#### `IMAGE_EMBEDDING_MAX_CONCURRENCY` (default: 5)

Controls how many screenshots are processed in parallel when generating image embeddings.

**When to adjust:**
- **Increase** (10-20) for faster processing with embedding APIs that support high throughput
- **Decrease** (1-3) when using free-tier embedding services with strict rate limits

**Considerations:**
- Each concurrent embedding request consumes memory and API quota
- Embeddings are typically the bottleneck after content is scraped
- Balance this based on your embedding provider's rate limits

**Example scenarios:**
```bash
# Free-tier OpenAI API (rate limited)
IMAGE_EMBEDDING_MAX_CONCURRENCY=2

# Paid OpenAI API with higher quotas
IMAGE_EMBEDDING_MAX_CONCURRENCY=10

# Self-hosted embedding model on powerful GPU
IMAGE_EMBEDDING_MAX_CONCURRENCY=20
```

### Network Rate Limits

#### HTTP Fetcher Retry Settings

**`HTTP_FETCHER_MAX_RETRIES`** (default: 6)
- Maximum number of retry attempts for failed HTTP requests
- Set to 0 to disable retries entirely

**`HTTP_FETCHER_RETRY_DELAY_MS`** (default: 1000)
- Base delay for exponential backoff (1000ms = 1 second)
- Delay multiplies by 2^n for each retry: 1000ms, 2000ms, 4000ms, 8000ms, etc.

**Example scenarios:**
```bash
# Fast failure for unreliable services
HTTP_FETCHER_MAX_RETRIES=2
HTTP_FETCHER_RETRY_DELAY_MS=500

# Persistent retries for important content
HTTP_FETCHER_MAX_RETRIES=10
HTTP_FETCHER_RETRY_DELAY_MS=2000
```

#### Crawl4AI Circuit Breaker

**`CRAWL4AI_CIRCUIT_BREAKER_THRESHOLD`** (default: 5)
- Number of consecutive failures before opening the circuit
- When open, the Crawl4AI service is temporarily disabled to prevent cascading failures

**`CRAWL4AI_CIRCUIT_BREAKER_RESET_TIMEOUT_MS`** (default: 60000)
- Time in milliseconds before attempting to recover from an open circuit (60000ms = 1 minute)

**How it works:**
1. Requests fail consecutively (e.g., Crawl4AI service crashes)
2. After `THRESHOLD` failures, circuit opens and requests are rejected immediately
3. After `RESET_TIMEOUT`, the circuit transitions to half-open and attempts a request
4. If successful, circuit closes; if not, it reopens

**Example scenarios:**
```bash
# Faster failover for unreliable Crawl4AI service
CRAWL4AI_CIRCUIT_BREAKER_THRESHOLD=3
CRAWL4AI_CIRCUIT_BREAKER_RESET_TIMEOUT_MS=30000

# More tolerant of transient failures
CRAWL4AI_CIRCUIT_BREAKER_THRESHOLD=10
CRAWL4AI_CIRCUIT_BREAKER_RESET_TIMEOUT_MS=120000
```

### Database Connection Pool

**`DB_POOL_MIN`** (default: 2)
- Minimum number of connections kept open even when idle

**`DB_POOL_MAX`** (default: 10)
- Maximum number of connections in the pool

**`DB_CONNECTION_TIMEOUT_MS`** (default: 10000)
- Maximum time to wait when establishing a new connection (10000ms = 10 seconds)

**`DB_IDLE_TIMEOUT_MS`** (default: 30000)
- How long to keep idle connections open before closing them (30000ms = 30 seconds)

**When to adjust:**
- **Increase pool size** for high-concurrency deployments with many simultaneous operations
- **Decrease pool size** for databases with strict connection limits
- **Increase timeouts** for databases over high-latency networks

**Example scenarios:**
```bash
# Small deployment with limited database connections
DB_POOL_MIN=1
DB_POOL_MAX=5

# Large deployment with high query volume
DB_POOL_MIN=5
DB_POOL_MAX=50

# Database over slow network (remote PostgreSQL)
DB_CONNECTION_TIMEOUT_MS=30000
DB_IDLE_TIMEOUT_MS=60000
```

## Tuning Guidelines

### Development Environment

For local development with limited resources:

```bash
PIPELINE_MAX_CONCURRENCY=1
SCRAPER_PAGE_CONCURRENCY=2
IMAGE_EMBEDDING_MAX_CONCURRENCY=3
DB_POOL_MIN=1
DB_POOL_MAX=5
```

### Production - Small Scale

For a production server indexing a few libraries:

```bash
PIPELINE_MAX_CONCURRENCY=3
SCRAPER_PAGE_CONCURRENCY=3
IMAGE_EMBEDDING_MAX_CONCURRENCY=5
DB_POOL_MIN=2
DB_POOL_MAX=10
```

### Production - Large Scale

For a high-performance server indexing many libraries:

```bash
PIPELINE_MAX_CONCURRENCY=10
SCRAPER_PAGE_CONCURRENCY=5
IMAGE_EMBEDDING_MAX_CONCURRENCY=20
DB_POOL_MIN=5
DB_POOL_MAX=50
```

## Monitoring and Debugging

### Checking Current Configuration

At startup, Scrapegoat logs the rate limiting configuration:

```
Pipeline concurrency: 3
Page concurrency: 3
Embedding concurrency: 5
```

### Circuit Breaker State

To check the Crawl4AI circuit breaker state programmatically:

```typescript
import { Crawl4AIClient } from "./scrapegoat";

const client = new Crawl4AIClient();
const state = client.getCircuitState();
console.log(state);
// { state: 'closed', failureCount: 0, lastFailureTime: 0 }
```

### Common Issues

**Problem: High memory usage**
- Solution: Reduce `PIPELINE_MAX_CONCURRENCY` and `SCRAPER_PAGE_CONCURRENCY`

**Problem: "Too many connections" database error**
- Solution: Reduce `DB_POOL_MAX` or increase PostgreSQL's `max_connections` setting

**Problem: Rate limiting errors from target sites**
- Solution: Reduce `SCRAPER_PAGE_CONCURRENCY` and increase `HTTP_FETCHER_RETRY_DELAY_MS`

**Problem: Slow embedding performance**
- Solution: Increase `IMAGE_EMBEDDING_MAX_CONCURRENCY` (check your API's rate limits first)

**Problem: Crawl4AI service unavailable errors**
- Solution: Check circuit breaker state, increase `CRAWL4AI_CIRCUIT_BREAKER_THRESHOLD` for more tolerance

## Validation

Scrapegoat validates rate limit configuration at startup and will fail to start with invalid values:

```
Error: Invalid rate limiting configuration:
  - PIPELINE_MAX_CONCURRENCY must be between 1 and 20 (got: 50)
  - DB_POOL_MIN (10) must be less than DB_POOL_MAX (5)
```

Warnings are logged for potentially problematic configurations but won't prevent startup:

```
Rate limit configuration warning: PIPELINE_MAX_CONCURRENCY is set to 10. High values may cause memory issues or rate limiting from target servers.
```

## Interaction with Other Settings

Rate limits interact with other configuration options:

- **`EMBEDDING_BATCH_SIZE`**: Larger batches may require reducing `IMAGE_EMBEDDING_MAX_CONCURRENCY`
- **`DEFAULT_MAX_PAGES`**: More pages per job may require reducing `PIPELINE_MAX_CONCURRENCY`
- **Crawl4AI timeout**: Longer timeouts may allow higher concurrency without failures

## Best Practices

1. **Start with defaults** and adjust incrementally based on observed behavior
2. **Monitor resource usage** (CPU, memory, database connections) when increasing limits
3. **Respect external services** by keeping page concurrency conservative for public websites
4. **Test with realistic workloads** before deploying high-concurrency configurations to production
5. **Document your settings** when deviating from defaults for your specific use case

## Further Reading

- [Deployment Guide](DEPLOYMENT.md) - Production deployment configuration
- [Architecture Documentation](ARCHITECTURE.md) - System design and service interaction
- [Environment Variables](../.env.example) - Complete configuration reference
