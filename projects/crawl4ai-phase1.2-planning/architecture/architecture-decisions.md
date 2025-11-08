# Architecture Decision Records (ADRs) - Phase 1.2

## ADR-001: Crawl4AIFetcher as Separate Fetcher (Not in AutoDetectFetcher)

**Date**: 2025-11-08
**Status**: Accepted

### Context

We need to integrate Crawl4AI into the existing fetcher architecture. Two options:
1. Add Crawl4AIFetcher to AutoDetectFetcher's fallback chain
2. Keep Crawl4AIFetcher separate and allow explicit usage

### Decision

Keep Crawl4AIFetcher separate from AutoDetectFetcher initially. It can be explicitly instantiated by strategies that want to use it.

### Rationale

1. **Service Dependency**: Crawl4AI requires a separate Python service to be running. If integrated into AutoDetectFetcher, it would create unexpected dependencies for all scraping operations.

2. **Opt-in Behavior**: Keeping it separate allows users to explicitly choose when to use Crawl4AI vs standard fetchers.

3. **Performance Trade-offs**: Crawl4AI is more powerful but slower (HTTP round-trip to Python service). Not all use cases need this capability.

4. **Circuit Breaker Impact**: If the service is down and it's in AutoDetectFetcher, the circuit breaker would affect all fetching operations.

5. **Future Flexibility**: We can later add it to AutoDetectFetcher with a feature flag if needed.

### Consequences

**Positive:**
- Clear separation of concerns
- No unexpected service dependencies
- Users explicitly opt-in to Crawl4AI
- Easier to debug and reason about

**Negative:**
- Strategies need to explicitly use Crawl4AIFetcher if they want Crawl4AI
- Not automatically available in all scraping contexts

### Future Considerations

If we want AutoDetectFetcher integration later:
```typescript
// Add to AutoDetectFetcher with env var flag
if (process.env.CRAWL4AI_ENABLED === 'true') {
  this.crawl4aiFetcher = new Crawl4AIFetcher();
}
```

---

## ADR-002: Return Markdown as RawContent

**Date**: 2025-11-08
**Status**: Accepted

### Context

Crawl4AI returns content as markdown. We need to decide how to integrate this into the RawContent → Pipeline flow.

Options:
1. Return markdown as RawContent with mimeType="text/markdown"
2. Convert markdown back to HTML for consistency
3. Return raw HTML from Crawl4AI's result

### Decision

Return markdown as RawContent with `mimeType: "text/markdown"`.

### Rationale

1. **Efficient**: Crawl4AI already produces high-quality markdown. No need to convert.

2. **Pipeline Support**: The codebase already has MarkdownPipeline that can process markdown content.

3. **Best Quality**: Use `fitMarkdown` (BM25-filtered) when available, as it removes boilerplate and ads.

4. **Consistent Flow**: Maintains the RawContent → Pipeline architecture pattern.

### Implementation

```typescript
return {
  content: Buffer.from(markdown, 'utf-8'),
  mimeType: 'text/markdown',
  charset: 'utf-8',
  encoding: undefined,
  source: finalUrl,
};
```

### Consequences

**Positive:**
- Leverages existing MarkdownPipeline
- Preserves Crawl4AI's high-quality markdown output
- Simple and efficient

**Negative:**
- Different content type than other fetchers (they return HTML)
- May need to adjust pipeline selection logic

---

## ADR-003: Circuit Breaker Pattern in Crawl4AIClient

**Date**: 2025-11-08
**Status**: Implemented (Phase 1.1)

### Context

The Crawl4AI Python service is a separate process that may fail or become unavailable.

### Decision

Implement circuit breaker pattern in Crawl4AIClient to prevent cascading failures.

### Rationale

1. **Fail Fast**: When service is down, don't waste time on repeated failed requests
2. **Resource Protection**: Prevents overwhelming the service during recovery
3. **Clear Feedback**: Users get immediate error when circuit is open
4. **Auto-recovery**: Circuit attempts to close after timeout period

### Implementation Details

```typescript
// Circuit States
enum CircuitState {
  Closed = "closed",      // Normal operation
  Open = "open",          // Rejecting requests
  HalfOpen = "half-open"  // Testing recovery
}

// Circuit opens after 5 consecutive failures
failureThreshold = 5;

// Try to recover after 60 seconds
resetTimeout = 60000;
```

### Consequences

**Positive:**
- Prevents cascading failures
- Fast failure when service unavailable
- Automatic recovery attempts
- Resource efficient

**Negative:**
- Adds complexity to client
- May reject requests during recovery attempts
- Need monitoring to detect open circuits

---

## ADR-004: Environment-Based Configuration

**Date**: 2025-11-08
**Status**: Accepted

### Context

Need to configure Crawl4AI service URL and enable/disable functionality.

### Decision

Use environment variables with sensible defaults:
- `CRAWL4AI_SERVICE_URL`: Service location (default: http://localhost:8001)
- `CRAWL4AI_ENABLED`: Feature flag (default: false for backward compatibility)
- `CRAWL4AI_TIMEOUT`: Request timeout in ms (default: 30000)
- `CRAWL4AI_MAX_RETRIES`: Max retry attempts (default: 3)

### Rationale

1. **Consistency**: Matches existing config pattern (see DATABASE_URL, etc.)
2. **Flexibility**: Easy to change per environment (dev/staging/prod)
3. **No Code Changes**: Configuration changes don't require code deployment
4. **12-Factor App**: Follows twelve-factor app principles

### Implementation

Add to `/home/mp/Workspace/scrapegoat/src/utils/config.ts`:

```typescript
/** Crawl4AI service URL */
export const CRAWL4AI_SERVICE_URL =
  process.env.CRAWL4AI_SERVICE_URL || "http://localhost:8001";

/** Crawl4AI request timeout in milliseconds */
export const CRAWL4AI_TIMEOUT =
  parseInt(process.env.CRAWL4AI_TIMEOUT || "30000", 10);

/** Crawl4AI maximum retry attempts */
export const CRAWL4AI_MAX_RETRIES =
  parseInt(process.env.CRAWL4AI_MAX_RETRIES || "3", 10);
```

### Consequences

**Positive:**
- Easy to configure per environment
- Defaults work for local development
- Can override in production
- No hardcoded URLs

**Negative:**
- Environment variables need documentation
- Must be set before service starts

---

## ADR-005: Graceful Error Handling with ScraperError

**Date**: 2025-11-08
**Status**: Accepted

### Context

Multiple error types can occur: network errors, service unavailable, circuit breaker open, invalid responses.

### Decision

Use ScraperError consistently with descriptive messages and isRetryable flag.

### Rationale

1. **Consistency**: Matches existing error handling patterns
2. **Rich Context**: ScraperError includes original error and retry flag
3. **Clear Messages**: Users get actionable error messages
4. **Proper Propagation**: Errors propagate correctly through pipeline

### Error Scenarios

| Scenario | Error Type | Retryable | Message |
|----------|-----------|-----------|---------|
| Service down | ScraperError | false | "Crawl4AI service unavailable" |
| Circuit open | ScraperError | false | "Circuit breaker is open. Try again in Xs" |
| Timeout | ScraperError | true | "Request timed out after Xms" |
| Invalid URL | ScraperError | false | "Invalid URL provided" |
| Service error | ScraperError | false | "Crawl4AI returned error: {code}" |

### Implementation Pattern

```typescript
try {
  const response = await this.client.crawl(request, options);

  if (!response.success && response.error) {
    throw new ScraperError(
      `Crawl4AI service error: ${response.error.code} - ${response.error.message}`,
      false, // Not retryable - service explicitly returned error
    );
  }

  // Process response...
} catch (error) {
  if (error instanceof ScraperError) {
    throw error; // Re-throw ScraperErrors as-is
  }

  // Wrap other errors
  throw new ScraperError(
    `Crawl4AI fetch failed: ${error instanceof Error ? error.message : String(error)}`,
    false,
    error instanceof Error ? error : undefined,
  );
}
```

### Consequences

**Positive:**
- Clear error messages
- Proper error propagation
- Consistent with codebase
- Includes retry guidance

**Negative:**
- Need to handle multiple error paths
- Error messages need to be maintained

---

Last Updated: 2025-11-08
