# Technical Requirements - Phase 1.2

## Overview

This document defines the technical requirements for the TypeScript integration with the Crawl4AI Python service.

---

## Functional Requirements

### FR-1: ContentFetcher Implementation

**Requirement**: Crawl4AIFetcher must implement the ContentFetcher interface.

**Details**:
- Implement `canFetch(source: string): boolean`
- Implement `fetch(source: string, options?: FetchOptions): Promise<RawContent>`
- Implement optional `close(): Promise<void>` for cleanup

**Acceptance Criteria**:
- [ ] Implements ContentFetcher interface correctly
- [ ] Type-checks without errors
- [ ] Can be used interchangeably with other fetchers

---

### FR-2: HTTP Communication

**Requirement**: Communicate with Crawl4AI Python service via HTTP.

**Details**:
- Use Crawl4AIClient for HTTP requests
- Support configurable service URL
- Handle HTTP errors gracefully
- Support request cancellation via AbortSignal

**Acceptance Criteria**:
- [ ] Makes POST requests to /crawl endpoint
- [ ] Respects service URL configuration
- [ ] Handles HTTP errors with clear messages
- [ ] Supports AbortSignal for cancellation

---

### FR-3: Markdown Content Return

**Requirement**: Return fetched content as markdown in RawContent format.

**Details**:
- Use fitMarkdown (BM25-filtered) when available
- Fall back to rawMarkdown or markdown
- Set mimeType to "text/markdown"
- Preserve final URL after redirects

**Acceptance Criteria**:
- [ ] Returns RawContent with mimeType="text/markdown"
- [ ] Prefers fitMarkdown over other variants
- [ ] Handles empty content gracefully
- [ ] Uses final URL from Crawl4AI metadata

---

### FR-4: Service Availability Detection

**Requirement**: Detect when Crawl4AI service is unavailable.

**Details**:
- Provide `isAvailable()` method
- Check service health before fetching
- Provide clear error messages when unavailable

**Acceptance Criteria**:
- [ ] isAvailable() returns true when service is healthy
- [ ] isAvailable() returns false when service is down
- [ ] Clear error message when service unavailable
- [ ] Doesn't hang indefinitely

---

## Non-Functional Requirements

### NFR-1: Performance

**Requirement**: Minimal performance overhead for HTTP communication.

**Details**:
- HTTP requests complete within configured timeout
- No unnecessary service calls
- Efficient error handling

**Acceptance Criteria**:
- [ ] Health check completes in <5s
- [ ] Fetch operations respect timeout config
- [ ] No blocking operations
- [ ] Minimal memory allocation

**Metrics**:
- Health check: <5s
- Fetch timeout: configurable (default 30s)
- Memory overhead: <10MB per request

---

### NFR-2: Reliability

**Requirement**: Handle service failures gracefully without cascading failures.

**Details**:
- Circuit breaker pattern prevents cascading failures
- Automatic retry for transient failures
- Clear error messages for debugging
- Graceful degradation when service unavailable

**Acceptance Criteria**:
- [ ] Circuit breaker opens after 5 consecutive failures
- [ ] Circuit breaker attempts recovery after 60s
- [ ] Retries transient errors with exponential backoff
- [ ] No cascading failures when service down

**Metrics**:
- Circuit breaker threshold: 5 failures
- Recovery timeout: 60s
- Max retries: 3 (configurable)
- Retry backoff: exponential (1s, 2s, 4s)

---

### NFR-3: Error Handling

**Requirement**: Comprehensive error handling with clear messages.

**Details**:
- Use ScraperError for all failures
- Include original error context
- Provide actionable error messages
- Distinguish retryable vs non-retryable errors

**Acceptance Criteria**:
- [ ] All errors wrapped in ScraperError
- [ ] Error messages include URL and reason
- [ ] Original errors preserved in cause
- [ ] Retryable flag set appropriately

**Error Types**:
| Error | Type | Retryable | Message Pattern |
|-------|------|-----------|----------------|
| Service down | ScraperError | false | "service is not available" |
| Circuit open | ScraperError | false | "circuit breaker is open" |
| Timeout | ScraperError | true | "request timed out" |
| Invalid URL | ScraperError | false | "invalid URL" |
| Service error | ScraperError | false | "service error: {code}" |

---

### NFR-4: Configuration

**Requirement**: Flexible configuration via environment variables.

**Details**:
- Service URL configurable
- Timeout configurable
- Max retries configurable
- Sensible defaults for development

**Acceptance Criteria**:
- [ ] CRAWL4AI_SERVICE_URL environment variable
- [ ] CRAWL4AI_TIMEOUT environment variable
- [ ] CRAWL4AI_MAX_RETRIES environment variable
- [ ] Defaults work without configuration

**Defaults**:
```
CRAWL4AI_SERVICE_URL=http://localhost:8001
CRAWL4AI_TIMEOUT=30000
CRAWL4AI_MAX_RETRIES=3
```

---

### NFR-5: Type Safety

**Requirement**: Full TypeScript type safety with no `any` types.

**Details**:
- All interfaces properly typed
- No `any` or `unknown` without type guards
- Request/response types match Python models
- Proper error typing

**Acceptance Criteria**:
- [ ] No `any` types in public API
- [ ] TypeScript strict mode passes
- [ ] Types match Python Pydantic models
- [ ] Proper generic types used

---

### NFR-6: Testability

**Requirement**: Comprehensive test coverage with unit and integration tests.

**Details**:
- Unit tests for all methods
- Integration tests with real service
- Mocking support for testing
- Test coverage >90%

**Acceptance Criteria**:
- [ ] Unit tests cover all methods
- [ ] Integration tests verify real service communication
- [ ] Mock support for dependent code
- [ ] Coverage >90%

**Test Types**:
1. **Unit Tests**:
   - canFetch() logic
   - Markdown selection logic
   - Error handling paths
   - Circuit breaker state checks

2. **Integration Tests**:
   - Real service communication
   - Actual web page fetching
   - Redirect handling
   - Service unavailability

---

### NFR-7: Observability

**Requirement**: Proper logging and monitoring support.

**Details**:
- Log service communication
- Log errors with context
- Expose circuit breaker state
- Performance metrics

**Acceptance Criteria**:
- [ ] Logs service availability checks
- [ ] Logs successful fetches with timing
- [ ] Logs errors with full context
- [ ] Circuit state exposed via getCircuitState()

**Log Levels**:
- DEBUG: Service communication details
- INFO: Successful fetches
- WARN: Retries and transient errors
- ERROR: Fatal errors and service failures

---

## Integration Requirements

### IR-1: Existing Codebase Integration

**Requirement**: Integrate seamlessly with existing fetcher architecture.

**Details**:
- Follow existing patterns (HttpFetcher, BrowserFetcher)
- Use existing error types (ScraperError)
- Use existing logging (logger)
- Export via barrel exports

**Acceptance Criteria**:
- [ ] Follows existing fetcher patterns
- [ ] Uses existing error types
- [ ] Uses existing logger
- [ ] Exported from fetcher module

---

### IR-2: Pipeline Compatibility

**Requirement**: RawContent output compatible with existing pipelines.

**Details**:
- MarkdownPipeline can process output
- Content flows through middleware correctly
- Metadata preserved correctly

**Acceptance Criteria**:
- [ ] MarkdownPipeline accepts output
- [ ] Middleware processes content correctly
- [ ] No pipeline errors with markdown content

---

## Security Requirements

### SR-1: Input Validation

**Requirement**: Validate input URLs before processing.

**Details**:
- Reject invalid URLs
- Only support HTTP/HTTPS
- Prevent injection attacks

**Acceptance Criteria**:
- [ ] Invalid URLs rejected
- [ ] Only HTTP/HTTPS URLs accepted
- [ ] No code injection vulnerabilities

---

### SR-2: Service Communication Security

**Requirement**: Secure communication with Python service.

**Details**:
- Support HTTPS for production
- No credentials in logs
- Timeout prevents indefinite hangs

**Acceptance Criteria**:
- [ ] HTTPS supported
- [ ] No sensitive data in logs
- [ ] Timeouts prevent DoS

---

## Documentation Requirements

### DR-1: Code Documentation

**Requirement**: Comprehensive inline documentation.

**Details**:
- JSDoc comments for all public methods
- Examples in documentation
- Type documentation
- Error conditions documented

**Acceptance Criteria**:
- [ ] All public methods have JSDoc
- [ ] Examples provided
- [ ] Error conditions documented
- [ ] Return types documented

---

### DR-2: Usage Documentation

**Requirement**: Clear usage documentation for developers.

**Details**:
- README with examples
- Configuration guide
- Troubleshooting guide
- Integration examples

**Acceptance Criteria**:
- [ ] README includes examples
- [ ] Configuration documented
- [ ] Troubleshooting guide exists
- [ ] Integration examples provided

---

## Dependencies

### Required Dependencies

**Already Available**:
- axios (for HTTP requests in Crawl4AIClient)
- TypeScript types for existing interfaces
- Logger utility
- Error classes (ScraperError)

**No New Dependencies Required**: All required dependencies already exist in the codebase.

---

## Backward Compatibility

### BC-1: No Breaking Changes

**Requirement**: Integration must not break existing functionality.

**Details**:
- Existing fetchers continue to work
- No changes to existing interfaces
- New functionality is additive only

**Acceptance Criteria**:
- [ ] All existing tests still pass
- [ ] No changes to existing fetcher interfaces
- [ ] Backward compatible with existing code

---

## Quality Gates

Before marking Phase 1.2 as complete:

- [ ] All unit tests pass
- [ ] All integration tests pass (with service running)
- [ ] Type checking passes (npm run type-check)
- [ ] Linting passes (npm run lint)
- [ ] Test coverage >90%
- [ ] Documentation complete
- [ ] Code review approved
- [ ] Manual testing successful

---

Last Updated: 2025-11-08
