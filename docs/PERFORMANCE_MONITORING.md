# Performance Monitoring Guide

## Overview

Scrapegoat includes comprehensive performance monitoring for tracking the performance of critical operations across the application. The monitoring system tracks timing, success rates, and provides configurable slow operation logging.

## Architecture

### Components

1. **PerformanceMetrics** (`src/monitoring/PerformanceMetrics.ts`)
   - Core metrics collection engine
   - Tracks operations across 5 categories: database, embedding, search, processing, fetcher
   - Calculates percentiles (p95, p99) and statistics
   - Exports Prometheus-compatible metrics

2. **Decorator Utilities** (`src/monitoring/decorator.ts`)
   - `measurePerformance()` - Wrapper function for tracking async operations
   - `createMeasured()` - Creates a measured version of a function
   - `measureBatch()` - Tracks batch operations with individual timing

3. **Metrics Types** (`src/monitoring/types.ts`)
   - Type definitions for performance tracking
   - Context interfaces for different operation types

### Categories

| Category | Description | Example Operations |
|----------|-------------|-------------------|
| `database` | Database queries and operations | query, insert, update, delete |
| `embedding` | Text and image embedding generation | text_generation, image_generation |
| `search` | Vector and full-text search | vector_search, fulltext_search, hybrid_search |
| `processing` | Document processing and splitting | chunk, split, transform |
| `fetcher` | Web scraping fetcher operations | http, crawl4ai, auto |

## Usage

### Basic Usage

```typescript
import { measurePerformance } from "../monitoring/decorator";

// Track a database query
const result = await measurePerformance(
  "database",
  "query",
  async () => {
    return await pool.query("SELECT * FROM documents");
  },
  { context: { library: "react", version: "18.2.0" } }
);

// Track embedding generation
const embeddings = await measurePerformance(
  "embedding",
  "text_generation",
  async () => {
    return await embeddingModel.embedDocuments(texts);
  },
  {
    context: {
      batchSize: texts.length,
      totalChars: texts.reduce((sum, t) => sum + t.length, 0),
    },
  }
);
```

### Creating Measured Functions

```typescript
import { createMeasured } from "../monitoring/decorator";

// Create a reusable measured function
const measuredQuery = createMeasured(
  "database",
  "select_by_url",
  pool.query.bind(pool)
);

// Use it like normal
const result = await measuredQuery("SELECT * FROM pages WHERE url = $1", [url]);
```

### Batch Operations

```typescript
import { measureBatch } from "../monitoring/decorator";

const operations = [
  async () => await query1(),
  async () => await query2(),
  async () => await query3(),
];

const results = await measureBatch("database", "parallel_query", operations);
console.log(`Query 1 took ${results[0].durationMs}ms`);
```

## Configuration

### Environment Variables

```bash
# Performance Monitoring (default values shown)
PERF_THRESHOLD_DATABASE=1000        # 1 second - Database slow operation threshold
PERF_THRESHOLD_EMBEDDING=5000       # 5 seconds - Embedding slow operation threshold
PERF_THRESHOLD_SEARCH=2000          # 2 seconds - Search slow operation threshold
PERF_THRESHOLD_PROCESSING=10000     # 10 seconds - Processing slow operation threshold
PERF_THRESHOLD_FETCHER=30000        # 30 seconds - Fetcher slow operation threshold
PERF_MAX_SAMPLES=1000               # Max timing samples to keep per operation
DETAILED_LOGGING=false              # Enable detailed performance logging
```

### Runtime Configuration

```typescript
// src/utils/config.ts
monitoring: {
  enabled: true,
  exportInterval: 60000,
  detailedLogging: false,
  performance: {
    database: 1000,
    embedding: 5000,
    search: 2000,
    processing: 10000,
    fetcher: 30000,
  },
  maxSamples: 1000,
}
```

## API Endpoints

### GET `/api/performance`

Get all performance metrics in JSON format.

**Response:**
```json
{
  "metrics": {
    "database": {
      "query": {
        "total": 1250,
        "success": 1230,
        "failure": 20,
        "avgTime": 45.2,
        "p95Time": 120.5,
        "p99Time": 250.8,
        "minTime": 5.2,
        "maxTime": 1500.0,
        "errorsByType": {
          "ConnectionError": 15,
          "QueryError": 5
        }
      }
    },
    "embedding": {
      "text_generation": { ... },
      "image_generation": { ... }
    }
  },
  "summaries": {
    "database": {
      "totalOperations": 5000,
      "totalSuccess": 4950,
      "totalFailure": 50,
      "overallSuccessRate": 99.0,
      "avgTime": 52.3
    }
  },
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### GET `/api/performance/:category`

Get metrics for a specific category.

**Categories:** `database`, `embedding`, `search`, `processing`, `fetcher`

### GET `/metrics`

Prometheus-compatible metrics endpoint combining fetcher and performance metrics.

**Example Output:**
```
# HELP scrapegoat_operation_total Total number of operations
# TYPE scrapegoat_operation_total counter
scrapegoat_operation_total{category="database",operation="query"} 1250
scrapegoat_operation_total{category="embedding",operation="text_generation"} 450

# HELP scrapegoat_operation_duration_ms Average operation duration in milliseconds
# TYPE scrapegoat_operation_duration_ms gauge
scrapegoat_operation_duration_ms{category="database",operation="query",quantile="avg"} 45.20
scrapegoat_operation_duration_ms{category="database",operation="query",quantile="p95"} 120.50
```

## Integration Points

### Database Operations

DocumentStore uses the `trackedQuery()` helper to wrap database operations:

```typescript
private async trackedQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>,
  context?: Record<string, string | number | undefined>
): Promise<T> {
  return measurePerformance("database", queryName, queryFn, { context });
}

// Usage
await this.trackedQuery("resolve_version", async () => {
  return await this.pool.query(sql, params);
}, { library, version });
```

### Embedding Generation

Both text and image embedding generation are tracked:

```typescript
// Text embeddings (DocumentStore)
const embeddings = await measurePerformance(
  "embedding",
  "text_generation",
  async () => await this.embeddings.embedDocuments(texts),
  { context: { batchSize, totalChars, dimension } }
);

// Image embeddings (ImageEmbeddingService)
const embeddings = await measurePerformance(
  "embedding",
  "image_generation",
  () => this.withTimeout(this.embeddings!.embedImages(images), this.timeout, "..."),
  { context: { model, batchSize, dimension } }
);
```

### Document Processing

DocumentManagementService tracks processing time:

```typescript
const processingStart = performance.now();
// ... processing logic ...
const processingTime = performance.now() - processingStart;

// Track via telemetry
analytics.track(TelemetryEvent.DOCUMENT_PROCESSED, {
  processingTimeMs: Math.round(processingTime),
  chunksCreated: splitDocs.length,
  // ... more metrics
});
```

## Metrics and Percentiles

### Statistics Tracked

For each operation, the following metrics are collected:

- **total** - Total number of operations
- **success** - Number of successful operations
- **failure** - Number of failed operations
- **avgTime** - Average execution time (ms)
- **p95Time** - 95th percentile execution time (ms)
- **p99Time** - 99th percentile execution time (ms)
- **minTime** - Minimum execution time (ms)
- **maxTime** - Maximum execution time (ms)
- **errorsByType** - Error counts by error type

### Percentile Calculation

Percentiles are calculated from stored timing samples (up to `maxSamples` per operation).

- **p95** - 95% of operations complete within this time
- **p99** - 99% of operations complete within this time

## Slow Operation Logging

Operations exceeding configured thresholds are automatically logged:

```
[WARN] Slow operation: embedding:image_generation took 8500ms (threshold: 5000ms) {"batchSize": 10}
[WARN] Slow operation: database:query took 2500ms (threshold: 1000ms) {"library": "react"}
```

### Threshold Configuration

Adjust thresholds based on your requirements:

```bash
# Stricter thresholds for development
PERF_THRESHOLD_DATABASE=500
PERF_THRESHOLD_EMBEDDING=2000

# Relaxed thresholds for production
PERF_THRESHOLD_DATABASE=2000
PERF_THRESHOLD_EMBEDDING=10000
```

## Prometheus Integration

### Setup

1. Configure Prometheus to scrape the `/metrics` endpoint:

```yaml
scrape_configs:
  - job_name: 'scrapegoat'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

2. Use Grafana dashboards to visualize metrics:

   - Operation rates (total/success/failure)
   - Response time percentiles
   - Error rates by type
   - Category summaries

### Example Queries

```promql
# Average database query time
rate(scrapegoat_operation_duration_ms{category="database",quantile="avg"}[5m])

# P95 embedding generation time
scrapegoat_operation_duration_p95{category="embedding"}

# Error rate by operation type
rate(scrapegoat_operation_errors[5m])

# Success rate percentage
(
  sum(rate(scrapegoat_operation_success[5m])) by (category)
  /
  sum(rate(scrapegoat_operation_total[5m])) by (category)
) * 100
```

## Best Practices

### 1. Use Context Information

Always provide relevant context for better debugging:

```typescript
// Good
await measurePerformance("database", "query", fn, {
  context: { library, version, queryType: "SELECT" }
});

// Less useful
await measurePerformance("database", "query", fn);
```

### 2. Group Related Operations

Use consistent operation names for grouping:

```typescript
// Good: grouped by operation type
await measurePerformance("database", "insert_documents", fn);
await measurePerformance("database", "insert_version", fn);

// Less useful: too specific
await measurePerformance("database", "insert_react_18.2.0", fn);
```

### 3. Set Appropriate Thresholds

Configure thresholds based on expected performance:

```typescript
// Fast operations (queries, cache lookups): 100-500ms
// Medium operations (embeddings, searches): 1-5s
// Slow operations (batch processing, scraping): 10-30s
```

### 4. Monitor Trends

Track metrics over time to identify performance degradation:

```promql
# Compare current vs last week
rate(scrapegoat_operation_duration_p95[1h])
/
rate(scrapegoat_operation_duration_p95[1h] offset 1w)
```

### 5. Alert on Anomalies

Set up alerts for critical performance issues:

```yaml
# AlertRules example
- alert: HighErrorRate
  expr: rate(scrapegoat_operation_errors[5m]) > 0.1
  for: 5m

- alert: SlowDatabaseQueries
  expr: scrapegoat_operation_duration_p95{category="database"} > 2000
  for: 5m
```

## Troubleshooting

### High Memory Usage

If memory usage is high, reduce `maxSamples`:

```bash
PERF_MAX_SAMPLES=500  # Default is 1000
```

### Too Many Slow Operation Logs

Increase thresholds or disable slow operation logging:

```bash
PERF_THRESHOLD_DATABASE=5000  # Increase from 1000
# Or set detailed logging to false in config
```

### Missing Metrics

Ensure monitoring is enabled in config:

```typescript
// src/utils/config.ts
monitoring: {
  enabled: true,  // Must be true
  // ...
}
```

## Performance Considerations

### Overhead

Performance monitoring adds minimal overhead (~1-2ms per operation):

- Timing: Uses `performance.now()` (high precision)
- Memory: Stores up to `maxSamples` timestamps per operation
- Logging: Only logs slow operations (configurable thresholds)

### Optimization

For production deployments:

1. Set `detailedLogging: false` to reduce log volume
2. Adjust `maxSamples` based on number of operations (default: 1000)
3. Use Prometheus aggregation instead of frequent API polling
4. Configure appropriate thresholds to reduce noise

## Related Documentation

- [Configuration Guide](../README.md#configuration)
- [Monitoring Endpoints](../README.md#api-endpoints)
- [Prometheus Setup](https://prometheus.io/docs/prometheus/latest/getting_started/)
- [Grafana Dashboards](https://grafana.com/docs/grafana/latest/dashboards/)
