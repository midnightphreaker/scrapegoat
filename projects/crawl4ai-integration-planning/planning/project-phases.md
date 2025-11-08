# Project Phases: Crawl4AI Integration

## Phase Overview

| Phase | Name | Duration | Goal |
|-------|------|----------|------|
| 1 | Foundation | 1-2 weeks | Python service + basic HTTP integration |
| 2 | Core Integration | 1-2 weeks | Complete Node.js integration |
| 3 | Advanced Features | 1-2 weeks | Enhanced Crawl4AI capabilities |
| 4 | Production Readiness | 1-2 weeks | Testing, docs, deployment |
| 5 | Optimization | 1 week | Performance and monitoring |

**Total Timeline**: 5-9 weeks (depends on complexity and rigor)

---

## Phase 1: Foundation (1-2 weeks)

**Goal**: Create Python microservice and establish basic communication with Node.js

### Objectives
- Set up Python FastAPI service
- Implement basic `/crawl` endpoint
- Create Docker container
- Build Node.js HTTP client
- Add ScrapeMode enum value
- Establish basic error handling

### Deliverables

#### 1.1: Python Service Setup (3-4 days)
- [ ] Create `services/crawl4ai/` directory structure
- [ ] Set up FastAPI project with dependencies
- [ ] Implement Crawl4AI wrapper class
- [ ] Create `/health` endpoint
- [ ] Create basic `/crawl` endpoint
- [ ] Add request/response Pydantic models
- [ ] Implement basic error handling

**Files Created**:
```
services/crawl4ai/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── models.py
│   ├── crawler.py
│   └── config.py
├── requirements.txt
├── Dockerfile
└── README.md
```

**Tech Stack**:
- FastAPI 0.104+
- Crawl4AI latest
- Playwright (via Crawl4AI)
- Pydantic v2
- Uvicorn

#### 1.2: Docker Container (1 day)
- [ ] Create Dockerfile with multi-stage build
- [ ] Install Playwright browsers in image
- [ ] Configure environment variables
- [ ] Set up health check
- [ ] Test local Docker build
- [ ] Optimize image size

**Dockerfile highlights**:
```dockerfile
FROM python:3.11-slim
RUN pip install crawl4ai && crawl4ai-setup
EXPOSE 8001
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
```

#### 1.3: Node.js HTTP Client (2-3 days)
- [ ] Create `src/scraper/services/Crawl4AIClient.ts`
- [ ] Implement HTTP request with axios/fetch
- [ ] Add connection pooling (keep-alive)
- [ ] Implement timeout handling
- [ ] Add basic retry logic (2 attempts)
- [ ] Create TypeScript interfaces for API
- [ ] Unit tests with mocked responses

**Key Classes**:
```typescript
class Crawl4AIClient {
  async crawl(url: string, options: Crawl4AIOptions): Promise<Crawl4AIResponse>
  async healthCheck(): Promise<boolean>
}
```

#### 1.4: ScrapeMode Extension (1 day)
- [ ] Add `Crawl4AI = 'crawl4ai'` to ScrapeMode enum
- [ ] Update type definitions
- [ ] Add validation logic
- [ ] Update mode selection logic
- [ ] Basic integration test

**Files Modified**:
- `src/scraper/types.ts`
- `src/tools/FetchUrlTool.ts` (preliminary)

### Success Criteria
- [ ] Python service starts and responds to `/health`
- [ ] Can POST to `/crawl` and get markdown back
- [ ] Docker container builds successfully
- [ ] Node.js client can communicate with Python service
- [ ] ScrapeMode enum includes Crawl4AI
- [ ] Basic end-to-end test passes: URL → Python → Markdown

### Testing
- Python service unit tests (pytest)
- Node.js client unit tests (mocked HTTP)
- Manual integration test with real service
- Docker health check works

### Risks
- Crawl4AI installation issues in Docker
- Playwright browser installation
- Network communication issues

---

## Phase 2: Core Integration (1-2 weeks)

**Goal**: Fully integrate Crawl4AI into Scrapegoat's scraping pipeline

### Objectives
- Implement Crawl4AIFetcher
- Integrate with pipeline system
- Add configuration system
- Implement circuit breaker
- Update FetchUrlTool
- Comprehensive error handling

### Deliverables

#### 2.1: Crawl4AIFetcher Implementation (2-3 days)
- [ ] Create `src/scraper/strategies/Crawl4AIFetcher.ts`
- [ ] Implement Fetcher interface
- [ ] Call Crawl4AIClient
- [ ] Format response as FetchResult
- [ ] Extract and map metadata
- [ ] Handle errors with fallback logic
- [ ] Unit tests with mocked client

**Implementation**:
```typescript
class Crawl4AIFetcher implements Fetcher {
  async fetch(url: string, options: FetchOptions): Promise<FetchResult> {
    // 1. Validate URL
    // 2. Call Crawl4AIClient
    // 3. Handle errors
    // 4. Return formatted result
  }
}
```

#### 2.2: Pipeline Integration (2-3 days)
- [ ] Ensure Crawl4AI output works with MarkdownPipeline
- [ ] Test chunking with Crawl4AI markdown
- [ ] Verify embedding generation
- [ ] Test PostgreSQL storage
- [ ] Integration tests for full flow
- [ ] Compare output with Playwright mode

**Testing Focus**:
- Same URL through Crawl4AI vs Playwright
- Verify chunks are created
- Verify embeddings stored
- Verify search works

#### 2.3: Circuit Breaker Implementation (1-2 days)
- [ ] Install circuit breaker library (opossum)
- [ ] Configure circuit breaker for Crawl4AI client
- [ ] Define failure thresholds (3 failures → open)
- [ ] Implement health check monitoring
- [ ] Add circuit breaker state logging
- [ ] Unit tests for circuit breaker logic

**Configuration**:
```typescript
const circuitBreaker = new CircuitBreaker(crawl4aiCall, {
  timeout: 30000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
});
```

#### 2.4: Configuration System (1-2 days)
- [ ] Add environment variables to `src/config.ts`
- [ ] Create Crawl4AI configuration schema
- [ ] Implement validation with defaults
- [ ] Per-request option passing
- [ ] Documentation for all options
- [ ] Environment variable template

**Environment Variables**:
```bash
CRAWL4AI_SERVICE_URL=http://localhost:8001
CRAWL4AI_ENABLED=true
CRAWL4AI_TIMEOUT=30000
CRAWL4AI_RETRY_ATTEMPTS=2
CRAWL4AI_USE_FIT_MARKDOWN=true
```

#### 2.5: FetchUrlTool Update (1 day)
- [ ] Update FetchUrlTool to accept Crawl4AI options
- [ ] Pass options to Crawl4AIFetcher
- [ ] Update documentation
- [ ] Add examples for Crawl4AI mode
- [ ] Integration tests with FetchUrlTool

**API Extension**:
```typescript
interface FetchUrlOptions {
  mode?: ScrapeMode;
  crawl4ai?: {
    waitFor?: string;
    useCache?: boolean;
    screenshot?: boolean;
  };
}
```

### Success Criteria
- [ ] Can scrape URL with `mode: 'crawl4ai'`
- [ ] Content flows through MarkdownPipeline correctly
- [ ] Embeddings generated and stored in PostgreSQL
- [ ] Search works with Crawl4AI content
- [ ] Circuit breaker prevents cascading failures
- [ ] Fallback to Playwright works when service down
- [ ] All configuration options work as expected

### Testing
- Unit tests for Crawl4AIFetcher
- Integration tests with real service
- Circuit breaker behavior tests
- Full E2E test: URL → Database → Search
- Comparison tests vs Playwright

### Risks
- Circuit breaker configuration tuning
- Fallback logic edge cases
- Performance degradation

---

## Phase 3: Advanced Features (1-2 weeks)

**Goal**: Add Crawl4AI-specific advanced features

### Objectives
- BM25 filtering configuration
- Screenshot support
- Media extraction
- Proxy support
- Custom JavaScript execution

### Deliverables

#### 3.1: BM25 Filtering Configuration (1 day)
- [ ] Expose `useFitMarkdown` option
- [ ] Allow choosing raw vs fit markdown
- [ ] Add option to configure BM25 threshold
- [ ] Test quality difference
- [ ] Document recommendations

#### 3.2: Screenshot Support (1-2 days)
- [ ] Add `screenshot` option to API
- [ ] Implement in Python service
- [ ] Return screenshot as base64
- [ ] Store screenshot in database (optional)
- [ ] Add screenshot to FetchResult
- [ ] Tests for screenshot capture

#### 3.3: Media Extraction (1-2 days)
- [ ] Add `extractMedia` option
- [ ] Implement media extraction in Python
- [ ] Return media list with metadata
- [ ] Store media references
- [ ] Tests for media extraction

#### 3.4: Proxy Support (1-2 days)
- [ ] Add proxy configuration options
- [ ] Implement proxy in Crawl4AI service
- [ ] Support authentication
- [ ] Secure credential handling
- [ ] Tests with proxy (may need mock)
- [ ] Documentation on proxy usage

#### 3.5: Custom JavaScript (2-3 days)
- [ ] Add `customJS` option
- [ ] Security validation for JS code
- [ ] Execute before extraction
- [ ] Error handling for malformed JS
- [ ] Tests and examples
- [ ] Security documentation

### Success Criteria
- [ ] All advanced features work as documented
- [ ] Screenshots captured successfully
- [ ] Media extraction returns correct data
- [ ] Proxy configuration works (if testable)
- [ ] Custom JS executes safely
- [ ] Documentation covers all features

### Testing
- Feature-specific unit tests
- Integration tests with real scenarios
- Security testing for custom JS
- Performance impact testing

### Risks
- Security implications of custom JS
- Proxy testing complexity
- Feature bloat vs usability

---

## Phase 4: Production Readiness (1-2 weeks)

**Goal**: Prepare for production deployment with comprehensive testing and documentation

### Objectives
- Comprehensive test coverage
- Performance benchmarking
- Complete documentation
- Deployment automation
- Monitoring and logging

### Deliverables

#### 4.1: Comprehensive Testing (3-4 days)
- [ ] Unit test coverage >80%
- [ ] Integration tests for all features
- [ ] E2E tests with diverse URLs
- [ ] Error scenario tests
- [ ] Timeout and retry tests
- [ ] Circuit breaker tests
- [ ] Fallback logic tests

**Test Categories**:
1. Unit: Crawl4AIClient, Crawl4AIFetcher, circuit breaker
2. Integration: Full service communication
3. E2E: URL → Database → Search
4. Performance: Benchmarks
5. Resilience: Failure scenarios

#### 4.2: Performance Benchmarking (2-3 days)
- [ ] Create benchmark test suite
- [ ] Test 10+ diverse URLs
- [ ] Compare Fetch vs Playwright vs Crawl4AI
- [ ] Measure response times (p50, p95, p99)
- [ ] Measure token count reduction
- [ ] Measure resource usage
- [ ] Document results

**Benchmark URLs**:
- Static HTML (Wikipedia)
- Dynamic SPA (modern web apps)
- Heavy JS (news sites)
- Complex layout (documentation sites)

#### 4.3: Documentation (3-4 days)
- [ ] Update main README.md
- [ ] Create architecture documentation
- [ ] Write API reference
- [ ] Create usage guide
- [ ] Write troubleshooting guide
- [ ] Document deployment process
- [ ] Add inline code comments
- [ ] Create migration guide

**Documentation Structure**:
- README update (quick start)
- docs/crawl4ai-integration.md (detailed guide)
- docs/api-reference.md (API docs)
- docs/troubleshooting.md (common issues)
- services/crawl4ai/README.md (Python service)

#### 4.4: Deployment Automation (2 days)
- [ ] Update docker-compose.yml
- [ ] Add environment variable template
- [ ] Create deployment script
- [ ] Health check configuration
- [ ] Restart policies
- [ ] Resource limits
- [ ] Test deployment on docs.den.lan staging

**Docker Compose Updates**:
```yaml
services:
  crawl4ai:
    build: ./services/crawl4ai
    restart: unless-stopped
    healthcheck: ...
    deploy:
      resources:
        limits: ...
```

#### 4.5: Monitoring and Logging (2 days)
- [ ] Structured logging implementation
- [ ] Request correlation IDs
- [ ] Performance metrics collection
- [ ] Error tracking
- [ ] Health check monitoring
- [ ] Dashboard (optional)
- [ ] Alerting strategy

**Metrics to Track**:
- Request count by mode
- Response times
- Error rates
- Circuit breaker state
- Cache hit rates
- Resource usage

### Success Criteria
- [ ] All tests pass (unit, integration, E2E)
- [ ] Test coverage >80%
- [ ] Benchmarks show acceptable performance
- [ ] Complete documentation published
- [ ] Deployment automated and tested
- [ ] Monitoring and logging operational
- [ ] Stakeholder review approved

### Testing
- Full test suite execution
- Deployment test (staging environment)
- Load testing
- Documentation review

### Risks
- Documentation completeness
- Performance not meeting goals
- Deployment issues on docs.den.lan

---

## Phase 5: Optimization (1 week)

**Goal**: Optimize performance and refine monitoring

### Objectives
- Performance tuning
- Resource optimization
- Enhanced metrics
- Fine-tune configuration

### Deliverables

#### 5.1: Performance Tuning (3 days)
- [ ] Optimize browser pool configuration
- [ ] Tune circuit breaker thresholds
- [ ] HTTP connection pooling optimization
- [ ] Cache strategy refinement
- [ ] Identify and fix bottlenecks
- [ ] Re-run benchmarks

**Optimization Areas**:
- Browser pool size
- Request timeout values
- Retry configuration
- Cache TTL
- Connection keep-alive

#### 5.2: Resource Optimization (2 days)
- [ ] Memory usage profiling
- [ ] Browser cleanup verification
- [ ] Docker image size optimization
- [ ] Resource limit tuning
- [ ] Graceful shutdown handling

#### 5.3: Metrics and Observability (2 days)
- [ ] Implement Prometheus metrics (optional)
- [ ] Add detailed performance metrics
- [ ] Business metrics tracking
- [ ] Create monitoring dashboard
- [ ] Set up alerting rules

**Metrics Enhancements**:
- Histogram for response times
- Counter for requests by mode
- Gauge for circuit breaker state
- Custom metrics for token reduction

### Success Criteria
- [ ] Performance meets or exceeds benchmarks
- [ ] Resource usage within limits
- [ ] Comprehensive metrics collected
- [ ] Optimization documented

### Testing
- Performance regression tests
- Load testing with optimized config
- Resource usage monitoring
- Metrics validation

### Risks
- Premature optimization
- Over-complication
- Diminishing returns

---

## Phase Dependencies

```
Phase 1 (Foundation)
    │
    ├─▶ Phase 2 (Core Integration)
    │       │
    │       ├─▶ Phase 3 (Advanced Features)
    │       │       │
    │       │       └─▶ Phase 4 (Production Readiness)
    │       │                   │
    │       └─▶ Phase 4 ────────┘
    │                   │
    └───────────────────┴─▶ Phase 5 (Optimization)
```

**Critical Path**: Phase 1 → Phase 2 → Phase 4
**Parallel Work**: Phase 3 can overlap with Phase 2/4

---

## Milestone Checklist

### MVP Milestone (End of Phase 2)
- [ ] Crawl4AI mode functional
- [ ] Basic features working
- [ ] Integration with pipeline complete
- [ ] Circuit breaker implemented
- [ ] Fallback logic working
- [ ] Basic documentation

**Ready for**: Internal testing, alpha users

### Beta Milestone (End of Phase 3)
- [ ] Advanced features implemented
- [ ] Enhanced functionality available
- [ ] Feature-complete for initial release

**Ready for**: Beta testing, power users

### Production Milestone (End of Phase 4)
- [ ] Comprehensive testing complete
- [ ] Documentation complete
- [ ] Deployment automated
- [ ] Monitoring operational
- [ ] Performance validated

**Ready for**: Production deployment on docs.den.lan

### Optimization Milestone (End of Phase 5)
- [ ] Performance optimized
- [ ] Resources tuned
- [ ] Metrics enhanced
- [ ] System fully polished

**Ready for**: General availability, promotion

---

## Resource Requirements

### Development Resources
- **Developer time**: 5-9 weeks (1 developer full-time)
- **Code review**: 1-2 hours per week
- **Testing infrastructure**: Docker environment
- **Deployment access**: docs.den.lan

### Infrastructure Resources
- **Development**: Local Docker Compose
- **Staging**: docs.den.lan staging environment
- **Production**: docs.den.lan production

### Skills Required
- TypeScript/Node.js (strong)
- Python/FastAPI (moderate)
- Docker/containers (moderate)
- HTTP/REST APIs (strong)
- Testing frameworks (moderate)

---
*Last Updated: 2025-11-08*
