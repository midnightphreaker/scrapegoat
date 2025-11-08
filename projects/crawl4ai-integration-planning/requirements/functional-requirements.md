# Functional Requirements: Crawl4AI Integration

## Overview
This document defines what the Crawl4AI integration must do from a functional perspective.

## Core Requirements

### FR-1: New Scrape Mode
**Priority**: P0 (Must Have)

The system must add a new scraping mode called `Crawl4AI` alongside existing Fetch and Playwright modes.

**Acceptance Criteria**:
- ScrapeMode enum includes `Crawl4AI` value
- Users can specify `mode: 'crawl4ai'` in FetchUrlTool
- Mode selection is validated and enforced
- Invalid mode returns clear error message

### FR-2: Python Microservice
**Priority**: P0 (Must Have)

The system must include a Python-based microservice that wraps Crawl4AI functionality.

**Acceptance Criteria**:
- FastAPI service exposes `/crawl` endpoint
- Service accepts URL and configuration options
- Service returns markdown and metadata
- Service includes `/health` endpoint for monitoring
- Service runs in Docker container

### FR-3: HTTP Communication
**Priority**: P0 (Must Have)

The Node.js application must communicate with Python service via HTTP.

**Acceptance Criteria**:
- HTTP client with proper error handling
- Configurable service URL via environment variable
- Request/response validation
- Timeout handling (configurable, default 30s)
- Retry logic with exponential backoff

### FR-4: Markdown Output
**Priority**: P0 (Must Have)

Crawl4AI mode must return clean markdown content.

**Acceptance Criteria**:
- Returns "fit_markdown" by default (BM25-filtered)
- Optional: return raw_markdown via configuration
- Markdown format compatible with existing MarkdownPipeline
- Metadata includes title, description, status code

### FR-5: Graceful Degradation
**Priority**: P0 (Must Have)

The system must handle Crawl4AI service unavailability gracefully.

**Acceptance Criteria**:
- If service unavailable, log clear error
- Option to fallback to Playwright (configurable)
- Existing modes (Fetch/Playwright) unaffected
- Health check monitors service availability
- Circuit breaker prevents repeated failed attempts

### FR-6: Configuration System
**Priority**: P0 (Must Have)

The system must support configuration of Crawl4AI behavior.

**Acceptance Criteria**:
- Environment variables for service connection
  - `CRAWL4AI_SERVICE_URL`
  - `CRAWL4AI_ENABLED`
  - `CRAWL4AI_TIMEOUT`
- Per-request options:
  - `waitFor` (CSS selector)
  - `useCache` (boolean)
  - `useFitMarkdown` (boolean)
- Configuration validation with sensible defaults

### FR-7: Error Handling
**Priority**: P0 (Must Have)

The system must handle errors comprehensively.

**Acceptance Criteria**:
- Network errors: clear message, fallback behavior
- Timeout errors: configurable timeout, retry logic
- Invalid URL: validation before sending to service
- Service errors: structured error response
- Crawl4AI errors: detailed error propagation
- All errors logged with context

## Enhanced Requirements

### FR-8: Overlay Removal
**Priority**: P1 (Should Have)

The system should support automatic removal of overlays and popups.

**Acceptance Criteria**:
- Configuration option: `removeOverlays` (default: true)
- Crawl4AI removes common overlay patterns
- Works for cookie banners, popups, modals
- Configurable per-request

### FR-9: Wait for Element
**Priority**: P1 (Should Have)

The system should support waiting for specific elements.

**Acceptance Criteria**:
- `waitFor` option accepts CSS selector
- `waitForTimeout` option (default: 10s)
- Fails gracefully if element not found
- Works for dynamic content loading

### FR-10: Caching Control
**Priority**: P1 (Should Have)

The system should support caching control.

**Acceptance Criteria**:
- Crawl4AI internal cache can be enabled/disabled
- Cache mode options: `enabled`, `disabled`, `bypass`
- Coordinated with Scrapegoat's database cache
- Cache hits logged for monitoring

### FR-11: Screenshot Capture
**Priority**: P2 (Nice to Have)

The system could support screenshot capture.

**Acceptance Criteria**:
- `screenshot` option (boolean or 'full'/'viewport')
- Screenshot returned as base64 or URL
- Stored alongside markdown content
- Optional feature, disabled by default

### FR-12: Media Extraction
**Priority**: P2 (Nice to Have)

The system could extract media links from pages.

**Acceptance Criteria**:
- `extractMedia` option (boolean)
- Returns array of image/video URLs
- Includes metadata (alt text, dimensions)
- Stored in structured format

### FR-13: Custom JavaScript Execution
**Priority**: P2 (Nice to Have)

The system could support custom JavaScript execution.

**Acceptance Criteria**:
- `customJS` option accepts JavaScript code
- Executed before content extraction
- Error handling for malformed JS
- Security considerations documented

### FR-14: Proxy Support
**Priority**: P2 (Nice to Have)

The system could support proxy configuration.

**Acceptance Criteria**:
- Proxy server URL configuration
- Authentication support (username/password)
- Per-request proxy override
- Secure credential handling

## Advanced Requirements (Future)

### FR-15: LLM-Based Extraction
**Priority**: P3 (Future Enhancement)

The system may support LLM-based structured extraction.

**Acceptance Criteria**:
- Define extraction schemas
- Use LLM to extract structured data
- Return JSON matching schema
- Configuration for LLM provider

### FR-16: Custom Extraction Strategies
**Priority**: P3 (Future Enhancement)

The system may support custom CSS/XPath extraction.

**Acceptance Criteria**:
- Define CSS selectors for extraction
- Define XPath queries for extraction
- Combine multiple extraction methods
- Return structured results

### FR-17: Multi-Page Crawling
**Priority**: P3 (Future Enhancement)

The system may support crawling multiple pages.

**Acceptance Criteria**:
- Follow links within domain
- Depth limit configuration
- URL pattern filtering
- Aggregate results from multiple pages

## Integration Requirements

### FR-18: Pipeline Compatibility
**Priority**: P0 (Must Have)

Crawl4AI output must integrate with existing pipelines.

**Acceptance Criteria**:
- Markdown feeds into MarkdownPipeline
- Chunking works as expected
- Embeddings generated via Infinity server
- Stored in PostgreSQL/pgvector
- Search functionality works correctly

### FR-19: FetchUrlTool Integration
**Priority**: P0 (Must Have)

FetchUrlTool must support Crawl4AI mode.

**Acceptance Criteria**:
- Accept `mode: 'crawl4ai'` parameter
- Pass through Crawl4AI options
- Return same response format as other modes
- Documented with examples

### FR-20: Backward Compatibility
**Priority**: P0 (Must Have)

Existing functionality must remain unchanged.

**Acceptance Criteria**:
- All existing tests pass
- Fetch mode behavior unchanged
- Playwright mode behavior unchanged
- Auto mode behavior unchanged (initially)
- Database schema unchanged
- API interfaces unchanged (only extended)

## Non-Functional Requirements Cross-Reference

See [Non-Functional Requirements](./non-functional-requirements.md) for:
- Performance requirements
- Scalability requirements
- Reliability requirements
- Security requirements
- Usability requirements

---
*Last Updated: 2025-11-08*
