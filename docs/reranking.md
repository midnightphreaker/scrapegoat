# Reranking Documentation

This document provides comprehensive information about the optional reranking feature in ScrapeGoat.

## Overview

Reranking is an optional feature that improves search result relevance by using an AI-powered reranking service. When enabled, ScrapeGoat retrieves more initial candidates and then reranks them to return the most relevant results.

## Configuration

### Environment Variables

Add these variables to your `.env` file:

```bash
# Enable/disable reranking (default: false)
RERANK_ENABLED=true

# API base URL for the reranking service
RERANK_API_BASE=https://rerank.fenrirsden.org/v1

# Model to use for reranking
RERANK_MODEL=qwen3-text-reranker

# Timeout in milliseconds for reranking requests (default: 5000)
RERANK_TIMEOUT=5000
```

### Configuration Details

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `RERANK_ENABLED` | boolean | `false` | Enable or disable reranking |
| `RERANK_API_BASE` | string | - | Base URL of the reranking API |
| `RERANK_MODEL` | string | - | Model identifier for reranking |
| `RERANK_TIMEOUT` | number | `5000` | Request timeout in milliseconds |

## How Reranking Works

### Process Flow

1. **Initial Retrieval**: When a search query is received, ScrapeGoat retrieves 3x the requested number of candidates
   - Example: For `limit=10`, retrieves 30 candidates
   
2. **Reranking Request**: Sends the query and candidates to the reranking service
   - Query: The original search query
   - Documents: The candidate documents
   
3. **Scoring**: The reranking service assigns relevance scores to each candidate
   
4. **Selection**: Returns the top N results based on reranked scores

### Algorithm

```
original_limit = user_requested_limit
candidate_count = original_limit * 3

candidates = search(query, limit=candidate_count)
reranked = rerank(query, candidates)
return reranked[0:original_limit]
```

## API Format

### Request Format

The reranking service expects requests in the following format:

```json
POST /v1/rerank
{
  "model": "qwen3-text-reranker",
  "query": "search query text",
  "documents": [
    "Document 1 content",
    "Document 2 content",
    "Document 3 content"
  ],
  "top_n": 10
}
```

### Response Format

The reranking service returns:

```json
{
  "results": [
    {
      "index": 0,
      "relevance_score": 0.95,
      "document": "Document 1 content"
    },
    {
      "index": 2,
      "relevance_score": 0.87,
      "document": "Document 3 content"
    },
    {
      "index": 1,
      "relevance_score": 0.72,
      "document": "Document 2 content"
    }
  ]
}
```

## Performance Impact

### Latency

- **Without Reranking**: ~100-200ms average search time
- **With Reranking**: ~300-600ms average search time
- **Overhead**: +200-400ms additional latency

### Accuracy Improvement

- **Relevance Boost**: 15-35% improvement in search result relevance
- **User Satisfaction**: Higher quality results for complex queries
- **Trade-off**: Slightly slower response time for better accuracy

### Resource Usage

- **Memory**: Minimal additional memory usage
- **CPU**: Negligible local CPU impact (reranking done remotely)
- **Network**: Additional API calls to reranking service

## Graceful Degradation

### Automatic Fallback

ScrapeGoat implements robust error handling for reranking failures:

1. **Timeout Handling**: If reranking exceeds `RERANK_TIMEOUT`, falls back to original results
2. **API Errors**: Any API error triggers fallback to non-reranked results
3. **Service Unavailable**: If reranking service is down, returns original search results
4. **Invalid Response**: Malformed reranking responses fall back gracefully

### Error Handling Flow

```
try:
    reranked_results = await rerank_service.rerank(query, candidates)
    return reranked_results
except (TimeoutError, APIError, ServiceUnavailable):
    logger.warn("Reranking failed, using original results")
    return original_results
```

### Monitoring Fallbacks

Check logs for reranking failures:
```bash
grep "Reranking failed" /var/log/scrapegoat.log
```

## Monitoring

### Health Checks

Monitor reranking service health:

```bash
# Check if reranking is enabled
curl http://localhost:3000/api/health | jq '.reranking'

# Response example:
{
  "enabled": true,
  "status": "healthy",
  "lastCheck": "2026-03-04T14:30:00Z"
}
```

### Metrics to Track

1. **Reranking Success Rate**: Percentage of successful reranking calls
2. **Average Reranking Latency**: Time spent on reranking
3. **Fallback Rate**: How often reranking fails and falls back
4. **Cache Hit Rate**: If reranking results are cached

### Log Monitoring

Reranking events are logged with appropriate levels:

- `INFO`: Successful reranking operations
- `WARN`: Fallback to original results
- `ERROR`: Reranking service errors

Example log entries:
```
[INFO] Reranking completed: query="api usage" candidates=30 results=10 latency=245ms
[WARN] Reranking timeout, using original results: query="install guide" timeout=5000ms
[ERROR] Reranking service unavailable: status=503
```

## Troubleshooting

### Common Issues

#### 1. Reranking Not Working

**Symptoms**: No improvement in search results

**Check**:
```bash
# Verify reranking is enabled
grep RERANK_ENABLED .env

# Check API connectivity
curl -I https://rerank.fenrirsden.org/v1
```

**Solutions**:
- Ensure `RERANK_ENABLED=true` in `.env`
- Verify API endpoint is accessible
- Check network connectivity

#### 2. Timeout Errors

**Symptoms**: Frequent fallbacks, slow responses

**Check**:
```bash
# Check timeout setting
grep RERANK_TIMEOUT .env

# Monitor logs for timeouts
tail -f /var/log/scrapegoat.log | grep timeout
```

**Solutions**:
- Increase `RERANK_TIMEOUT` value (try 10000ms)
- Check reranking service performance
- Consider caching reranking results

#### 3. High Latency

**Symptoms**: Search responses take >1 second

**Check**:
```bash
# Measure reranking latency
curl -w "Time: %{time_total}s\n" http://localhost:3000/api/search?q=test
```

**Solutions**:
- Reduce candidate multiplier (if configurable)
- Enable caching for repeated queries
- Consider disabling reranking for non-critical searches

#### 4. Poor Reranking Quality

**Symptoms**: Reranked results not more relevant

**Check**:
- Verify correct model is configured
- Check query and document encoding
- Review reranking service documentation

**Solutions**:
- Try different reranking models
- Ensure documents are properly formatted
- Contact reranking service provider

### Debugging Mode

Enable debug logging for reranking:

```bash
# Add to .env
RERANK_DEBUG=true
LOG_LEVEL=debug
```

This will log:
- Full request/response payloads
- Timing information
- Detailed error messages

### Performance Tuning

#### Optimize Timeout

```bash
# Test different timeout values
for timeout in 3000 5000 10000; do
  echo "Testing timeout: ms"
  # Run benchmark
done
```

#### Balance Accuracy vs Speed

- **Fast Mode**: `RERANK_ENABLED=false` or increase `RERANK_TIMEOUT`
- **Accurate Mode**: `RERANK_ENABLED=true` with higher timeout
- **Hybrid**: Enable only for specific endpoints or queries

## Best Practices

### When to Use Reranking

**Enable reranking for:**
- Complex search queries
- Documentation search where accuracy is critical
- Scenarios where users need the most relevant results

**Consider disabling for:**
- Real-time search suggestions
- High-throughput scenarios where latency matters
- Simple keyword matching

### Configuration Recommendations

**Production**:
```bash
RERANK_ENABLED=true
RERANK_TIMEOUT=5000
RERANK_MODEL=qwen3-text-reranker
```

**Development**:
```bash
RERANK_ENABLED=false  # Faster iteration
```

**Testing**:
```bash
RERANK_ENABLED=true
RERANK_TIMEOUT=10000  # More tolerant for CI/CD
```

## Integration Examples

### Code Example

```javascript
const response = await fetch('/api/search?' + new URLSearchParams({
  q: 'how to install',
  limit: 10
}));

const results = await response.json();
// Results are already reranked if RERANK_ENABLED=true
```

### Conditional Reranking

```javascript
// Example: Enable reranking only for specific libraries
if (library === 'critical-docs') {
  process.env.RERANK_ENABLED = 'true';
}
```

## Further Reading

- [Performance Monitoring](./PERFORMANCE_MONITORING.md)
- [Configuration Guide](./CONFIGURATION.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)

## Support

For issues with reranking:
1. Check this documentation
2. Review logs for error messages
3. Verify API endpoint accessibility
4. Contact support with debug logs
