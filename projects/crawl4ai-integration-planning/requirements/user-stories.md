# User Stories: Crawl4AI Integration

## Epic 1: Basic Crawl4AI Integration

### US-1.1: Use Crawl4AI Mode
**As a** RAG application developer
**I want to** specify Crawl4AI as my scraping mode
**So that** I get cleaner, more LLM-friendly content

**Acceptance Criteria**:
- Can set `mode: 'crawl4ai'` in FetchUrlTool
- Receives clean markdown output
- Output is noticeably cleaner than Playwright mode
- Works for typical web pages

**Priority**: P0

---

### US-1.2: Automatic Fallback
**As a** production user
**I want** the system to fall back to Playwright if Crawl4AI is unavailable
**So that** my application continues working even if the Python service is down

**Acceptance Criteria**:
- If Crawl4AI service is down, Playwright is used instead
- Clear warning logged
- User gets content (from fallback) without application error
- Configurable fallback behavior

**Priority**: P0

---

### US-1.3: Disable Crawl4AI
**As a** system administrator
**I want to** disable Crawl4AI completely via configuration
**So that** I can run Scrapegoat without Python dependencies

**Acceptance Criteria**:
- Set `CRAWL4AI_ENABLED=false` in environment
- Python service doesn't start
- Crawl4AI mode returns clear error message
- Fetch and Playwright modes work normally

**Priority**: P0

---

## Epic 2: Content Quality

### US-2.1: Remove Noise
**As a** knowledge base builder
**I want** navigation, ads, and footers automatically removed
**So that** I only store relevant content

**Acceptance Criteria**:
- BM25 filtering removes common noise elements
- Navigation menus not in output
- Advertisements not in output
- Footer content not in output
- Main article content preserved

**Priority**: P0

---

### US-2.2: Remove Overlays
**As a** web scraper
**I want** cookie banners and popups removed
**So that** they don't appear in my extracted content

**Acceptance Criteria**:
- Cookie consent banners removed
- Newsletter signup popups removed
- Advertisement overlays removed
- Configuration option to control this behavior
- Works for common overlay patterns

**Priority**: P1

---

### US-2.3: Better Token Efficiency
**As a** cost-conscious developer
**I want** reduced token consumption
**So that** my RAG application costs less to run

**Acceptance Criteria**:
- Crawl4AI output is 30%+ smaller in tokens than Playwright
- Main content quality not reduced
- Measured on diverse set of pages
- Documented in comparison benchmarks

**Priority**: P1

---

## Epic 3: Configuration and Control

### US-3.1: Wait for Dynamic Content
**As a** JavaScript-heavy site scraper
**I want to** wait for specific elements to load
**So that** I capture dynamically loaded content

**Acceptance Criteria**:
- Can specify CSS selector in `waitFor` option
- Service waits up to configured timeout
- Fails gracefully if element never appears
- Works for AJAX-loaded content

**Priority**: P1

---

### US-3.2: Configure Timeout
**As a** performance-conscious user
**I want to** configure request timeout
**So that** slow pages don't hang my application

**Acceptance Criteria**:
- Can set `CRAWL4AI_TIMEOUT` environment variable
- Can override per-request
- Default is 30 seconds
- Clear timeout error message

**Priority**: P1

---

### US-3.3: Control Caching
**As a** development tester
**I want to** bypass caching
**So that** I always get fresh content during testing

**Acceptance Criteria**:
- `cacheMode: 'bypass'` option available
- Crawl4AI fetches fresh content
- Cache can be enabled/disabled globally
- Works with Scrapegoat's own caching

**Priority**: P1

---

## Epic 4: Advanced Features

### US-4.1: Capture Screenshots
**As a** visual documentation builder
**I want to** capture screenshots alongside markdown
**So that** I have visual reference of the page

**Acceptance Criteria**:
- `screenshot: true` option captures screenshot
- Screenshot returned as base64 or URL
- Full page or viewport options
- Stored with the document

**Priority**: P2

---

### US-4.2: Extract Media
**As a** media aggregator
**I want to** extract all images and videos from a page
**So that** I can download or reference them

**Acceptance Criteria**:
- `extractMedia: true` option returns media list
- Includes images, videos, audio
- Metadata includes URLs, alt text, dimensions
- Structured format

**Priority**: P2

---

### US-4.3: Use Proxy
**As a** enterprise user
**I want to** route requests through a proxy
**So that** I can comply with network policies

**Acceptance Criteria**:
- Configure proxy server URL
- Support authentication (username/password)
- Per-request proxy override
- Clear error messages for proxy failures

**Priority**: P2

---

### US-4.4: Custom JavaScript
**As a** advanced scraper
**I want to** execute custom JavaScript before extraction
**So that** I can manipulate the page for better extraction

**Acceptance Criteria**:
- `customJS` option accepts JavaScript code
- JavaScript executes before content extraction
- Errors handled gracefully
- Security implications documented

**Priority**: P2

---

## Epic 5: Developer Experience

### US-5.1: Easy Local Setup
**As a** new developer
**I want** simple local development setup
**So that** I can start contributing quickly

**Acceptance Criteria**:
- `docker-compose up` starts all services
- Clear README with setup instructions
- Environment variable template provided
- Works on macOS, Linux, Windows

**Priority**: P0

---

### US-5.2: Clear Error Messages
**As a** troubleshooting developer
**I want** clear error messages
**So that** I can quickly diagnose issues

**Acceptance Criteria**:
- Network errors include service URL
- Timeout errors include configured timeout
- Service unavailable includes troubleshooting hint
- Validation errors specify which parameter is invalid

**Priority**: P0

---

### US-5.3: Good Documentation
**As a** API consumer
**I want** comprehensive documentation
**So that** I understand how to use Crawl4AI mode

**Acceptance Criteria**:
- API reference with all options documented
- Usage examples for common scenarios
- Comparison guide (when to use which mode)
- Troubleshooting guide
- Architecture documentation

**Priority**: P0

---

### US-5.4: Development Without Python
**As a** frontend-focused developer
**I want** to develop without running Python service
**So that** I can work on other parts of Scrapegoat

**Acceptance Criteria**:
- Mock mode for testing
- Crawl4AI tests can be skipped
- Clear separation of concerns
- Python service is truly optional

**Priority**: P1

---

## Epic 6: Production Readiness

### US-6.1: Monitor Service Health
**As a** operations engineer
**I want** health check monitoring
**So that** I know when the service is down

**Acceptance Criteria**:
- `/health` endpoint returns status
- Health checks in Docker Compose
- Automatic restart on failure
- Metrics on health check results

**Priority**: P1

---

### US-6.2: Track Performance
**As a** performance analyst
**I want** performance metrics
**So that** I can optimize and monitor

**Acceptance Criteria**:
- Response time metrics (p50, p95, p99)
- Error rate tracking
- Cache hit rate
- Request count by mode
- Exportable metrics format

**Priority**: P1

---

### US-6.3: Debug Issues
**As a** support engineer
**I want** detailed logging
**So that** I can debug production issues

**Acceptance Criteria**:
- Structured JSON logs
- Request correlation IDs
- Error stack traces included
- Configurable log levels
- Log aggregation friendly

**Priority**: P1

---

### US-6.4: Compare Mode Quality
**As a** quality assurance tester
**I want** comparison benchmarks
**So that** I can validate Crawl4AI improves quality

**Acceptance Criteria**:
- Side-by-side comparison tool
- Same URL tested with all modes
- Metrics: token count, extraction quality, time
- Documented comparison results
- Test suite with diverse URLs

**Priority**: P1

---

## Epic 7: Future Enhancements

### US-7.1: LLM-Based Extraction
**As a** structured data extractor
**I want** LLM-based extraction with schemas
**So that** I can extract specific fields reliably

**Acceptance Criteria**:
- Define extraction schema (JSON)
- LLM extracts matching data
- Returns structured JSON result
- Configurable LLM provider

**Priority**: P3 (Future)

---

### US-7.2: Multi-Page Crawling
**As a** documentation scraper
**I want** to crawl multiple pages within a domain
**So that** I can extract entire documentation sites

**Acceptance Criteria**:
- Follow internal links
- Depth limit configuration
- URL pattern filtering
- Aggregate results
- Respect robots.txt

**Priority**: P3 (Future)

---

### US-7.3: Smart Auto Mode
**As a** simplicity-focused user
**I want** Auto mode to intelligently choose Crawl4AI
**So that** I get best quality without manual selection

**Acceptance Criteria**:
- Auto mode tries Crawl4AI first (if enabled)
- Fallback to Playwright on error
- Performance acceptable for Auto mode
- Configurable Auto mode strategy

**Priority**: P3 (Future)

---

## Story Mapping

```
Epic 1 (Basic) → Epic 2 (Quality) → Epic 3 (Config) → Epic 4 (Advanced)
                          ↓
Epic 5 (DevEx) → Epic 6 (Production) → Epic 7 (Future)
```

**MVP**: Epic 1, Epic 2 (partial), Epic 5 (partial)
**Production Ready**: Epic 1-3, Epic 5-6
**Full Featured**: All epics except 7
**Future**: Epic 7

---
*Last Updated: 2025-11-08*
