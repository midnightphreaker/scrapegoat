# Project Vision: Crawl4AI Enhancements

## Vision Statement

Transform Scrapegoat's Crawl4AI integration from a basic markdown extraction service into a comprehensive, feature-rich documentation scraping solution with explicit fetcher control, rich media capture, and professional monitoring capabilities.

## Goals

### Primary Goals
1. **User Control**: Give users explicit control over which fetcher to use (HTTP, Browser, Crawl4AI) instead of relying solely on auto-detection
2. **Rich Data Capture**: Leverage Crawl4AI's advanced features to capture screenshots, media assets, and link relationships
3. **Operational Excellence**: Provide monitoring, metrics, and configuration tools for production use
4. **Developer Experience**: Maintain backward compatibility while adding powerful new features

### Secondary Goals
1. Improve observability into scraping operations
2. Reduce operational friction through better configuration management
3. Enable new use cases (visual documentation, media cataloging)
4. Position Scrapegoat as best-in-class documentation MCP server

## Success Criteria

### Phase 2: Explicit Fetcher Selection ✅
- [ ] Users can specify fetcher type in MCP tools
- [ ] All four fetchers (auto, http, browser, crawl4ai) work correctly
- [ ] Backward compatibility maintained with useCrawl4AI flag
- [ ] API documentation updated
- [ ] Test coverage >85%

### Phase 3: Enhanced Crawl4AI Features ✅
- [ ] Screenshots captured and stored efficiently
- [ ] Media items extracted and cataloged
- [ ] Links extracted and stored
- [ ] Database schema supports new data types
- [ ] Storage growth managed with size limits
- [ ] Integration tests pass for all enhanced features

### Phase 4: WebUI Integration ✅
- [ ] Crawl4AI health status visible in UI
- [ ] Fetcher selection available in job creation
- [ ] Screenshots displayed in page viewer
- [ ] Media gallery functional
- [ ] Links table displayed
- [ ] Configuration controls accessible

### Phase 5: Configuration & Management ✅
- [ ] Centralized configuration management
- [ ] Monitoring dashboard operational
- [ ] Metrics collection working
- [ ] Documentation complete
- [ ] Production-ready deployment

## Non-Goals

### What This Project Will NOT Do
- Replace existing fetchers (HTTP, Browser remain available)
- Store videos/audio files (only metadata)
- Provide real-time streaming of scrape operations
- Support non-documentation websites (scope unchanged)
- Implement AI-powered content analysis (beyond Crawl4AI's built-in BM25)

### Scope Boundaries
- Screenshots: Viewport/full page only (no element-specific screenshots)
- Media: Metadata only (URLs, dimensions), no file downloading
- Links: Internal/external categorization only (no link validation)
- Configuration: Environment variables + UI (no database-backed config)

## Target Users

### Primary User Persona: "DevOps Danny"
- Role: Platform engineer maintaining docs infrastructure
- Needs: Reliability, observability, control over scraping behavior
- Pain Points: Black box auto-detection, lack of visibility, no control over fetcher choice
- Value: Explicit fetcher selection, health monitoring, operational metrics

### Secondary User Persona: "API Developer Alice"
- Role: Software engineer integrating Scrapegoat via MCP
- Needs: Rich API, consistent behavior, good documentation
- Pain Points: Limited data (markdown only), unclear when to use which fetcher
- Value: Enhanced metadata (screenshots, media), clear fetcher selection API

### Use Cases

#### Use Case 1: Documentation with Visual Content
User wants to index documentation that relies heavily on diagrams and screenshots. They enable screenshot capture to preserve visual context alongside markdown content.

#### Use Case 2: Troubleshooting Scrape Failures
User's scrape job fails. They check the WebUI monitoring dashboard to see that the Crawl4AI service is degraded, and switch to browser fetcher for reliability.

#### Use Case 3: Archival Documentation
User needs complete archival of documentation including all media assets. They enable media extraction to catalog all images, videos, and audio referenced in the docs.

#### Use Case 4: Link Analysis
User wants to understand documentation structure through link relationships. They enable link extraction to analyze internal navigation patterns.

## Unique Value Proposition

**What makes this enhancement special:**

1. **Best of All Worlds**: Combines speed of HTTP fetching, reliability of browser automation, and AI-optimized markdown from Crawl4AI - with user control over which to use

2. **Production-Ready Monitoring**: Unlike basic scrapers, provides health checks, metrics, and observability needed for production deployments

3. **Rich Data Capture**: Goes beyond plain markdown to capture visual and structural context (screenshots, media, links)

4. **Backward Compatible**: Enhances existing functionality without breaking existing integrations

5. **MCP-Native**: Designed specifically for Model Context Protocol integration, making LLM documentation access first-class

## Alignment with Scrapegoat's Mission

Scrapegoat aims to be the definitive documentation indexing solution for LLMs via MCP. These enhancements directly support this mission by:

- **Reliability**: Explicit fetcher control ensures scraping works even for challenging sites
- **Richness**: Screenshots and media provide visual context that improves LLM understanding
- **Observability**: Monitoring enables confident production deployment
- **Flexibility**: User control over fetcher selection adapts to different documentation sites

*Last Updated: 2025-11-08*
