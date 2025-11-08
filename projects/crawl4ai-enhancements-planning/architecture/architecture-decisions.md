# Architecture Decision Records (ADRs)

This document contains all major architectural decisions for the Crawl4AI enhancements project.

---

## ADR-001: Explicit Fetcher Selection via Options Parameter

**Date**: 2025-11-08
**Status**: Accepted

### Context

Currently, users can only enable Crawl4AI via the `useCrawl4AI` boolean flag. There's no way to explicitly force HTTP or Browser fetchers, and the auto-detection logic is opaque.

Users need more control over fetcher selection for:
- Debugging (test specific fetchers)
- Performance optimization (force fast HTTP when JS not needed)
- Reliability (fallback manually if auto-detection fails)

### Decision

Add a `fetcher?: FetcherType` parameter to FetchOptions with values: `'auto' | 'http' | 'browser' | 'crawl4ai' | 'file'`

**Priority**: `fetcher` param > `useCrawl4AI` flag > auto-detection

**Default**: `'auto'` (maintains existing behavior)

### Rationale

1. **User Control**: Gives explicit control while maintaining auto-detection as default
2. **Backward Compatible**: Existing code continues to work, `useCrawl4AI` flag preserved
3. **Debugging**: Enables testing specific fetchers
4. **Progressive Enhancement**: Can add more fetcher types in future

### Consequences

**Positive:**
- Users have explicit control over fetcher selection
- Easier debugging and troubleshooting
- Backward compatible (zero breaking changes)
- Self-documenting API

**Negative:**
- Slight API complexity increase
- Need to maintain backward compatibility code
- Documentation needs updating

### Alternatives Considered

**Alternative 1**: Replace `useCrawl4AI` with `fetcher`
- **Rejected**: Breaking change, would require migration

**Alternative 2**: Separate `forceFetcher` parameter
- **Rejected**: Confusing to have both `fetcher` and `forceFetcher`

**Alternative 3**: Configuration file-based selection
- **Rejected**: Too inflexible, can't vary per-request

### Related Decisions
- ADR-002 (MCP Tool Enhancement)

---

## ADR-002: Expose Fetcher Selection in MCP Tools

**Date**: 2025-11-08
**Status**: Accepted

### Context

MCP tools (like `scrape_docs`) are the primary user interface for Claude and other LLMs. Currently, they don't expose fetcher selection, limiting user control.

### Decision

Add optional `fetcher` parameter to `scrape_docs` MCP tool with enum values: `"auto" | "http" | "browser" | "crawl4ai"`

**Default**: `"auto"`

```typescript
z.enum(["auto", "http", "browser", "crawl4ai"])
  .optional()
  .default("auto")
  .describe("Content fetcher to use...")
```

### Rationale

1. **User Empowerment**: LLM users can specify fetcher in natural language
2. **Consistency**: Matches FetchOptions API design
3. **Documentation**: Self-documenting via Zod schema descriptions
4. **MCP Best Practices**: Optional parameters with sensible defaults

### Consequences

**Positive:**
- LLMs can intelligently choose fetchers
- Users can override in prompts ("use browser fetcher")
- Consistent with backend API

**Negative:**
- MCP tool schema more complex
- Need to validate fetcher parameter

### Related Decisions
- ADR-001 (Explicit Fetcher Selection)

---

## ADR-003: Hybrid Storage Strategy for Screenshots

**Date**: 2025-11-08
**Status**: Accepted

### Context

Screenshots can be 100KB-2MB each. Storing as database blobs would bloat PostgreSQL. Need efficient storage strategy.

**Options Considered:**
1. Store as base64 in database
2. Store as binary blobs in database
3. Store as files on disk
4. Store in S3/object storage

### Decision

**Hybrid Approach**:
- Store screenshot files on disk in `public/screenshots/{library}/{version}/{hash}.png`
- Store relative path in `pages.screenshot_path` column (TEXT)
- Serve via Fastify static file serving

**Rationale:**
1. **Performance**: Disk storage faster than DB blobs for large files
2. **Scalability**: Can easily migrate to S3 later (just update file paths)
3. **Simplicity**: No external dependencies (S3, CDN) needed initially
4. **Caching**: Static files easily cached by browsers/CDNs
5. **Size**: Database stays lean, only stores paths

### Consequences

**Positive:**
- Efficient storage (no database bloat)
- Fast serving (static files)
- Easy migration path to cloud storage
- Standard web practices

**Negative:**
- Need file management (cleanup, backups)
- Need to ensure directory permissions
- Not transactional with database
- Need separate backup strategy

### Implementation Details

```sql
ALTER TABLE pages ADD COLUMN screenshot_path TEXT;
```

```typescript
const path = await saveScreenshot({
  library, version, url, data
}); // Returns: /screenshots/react/18.0.0/abc123.png
```

### Alternatives Considered

**Alternative 1**: Database blob storage
- **Rejected**: Would bloat PostgreSQL, poor performance for large files

**Alternative 2**: S3/Object Storage
- **Rejected**: Adds external dependency, overkill for MVP, can migrate later

**Alternative 3**: Base64 in metadata JSON
- **Rejected**: Even worse than blobs, parsing overhead, size issues

### Related Decisions
- ADR-004 (Metadata Storage Strategy)

---

## ADR-004: JSON Metadata Storage for Media and Links

**Date**: 2025-11-08
**Status**: Accepted

### Context

Need to store extracted media items and links. These are:
- Variable in quantity (0-100+ items)
- Infrequently queried (mostly display)
- Closely tied to specific pages

**Options:**
1. Separate tables (`page_media`, `page_links`)
2. JSON in existing `pages.metadata` column
3. JSON in new dedicated columns

### Decision

Store media and links as JSON in existing `pages.metadata` TEXT column.

**Structure**:
```json
{
  "media": [
    { "type": "image", "url": "...", "alt": "...", "width": 100, "height": 100 }
  ],
  "links": [
    { "url": "...", "text": "...", "rel": "..." }
  ]
}
```

### Rationale

1. **Simplicity**: No schema changes (column already exists)
2. **Flexibility**: Easy to add new metadata fields
3. **Performance**: Acceptable for read-heavy, infrequent queries
4. **PostgreSQL JSON**: Native JSON support for querying if needed

### Consequences

**Positive:**
- No migration needed (column exists)
- Flexible schema (can add fields)
- Single atomic update (page + metadata)
- PostgreSQL JSON operators available if needed

**Negative:**
- Can't efficiently query across all media/links
- No foreign key constraints
- Parsing overhead (minor)
- No schema enforcement

### When to Reconsider

If we need to:
- Query "all images across all pages"
- Enforce referential integrity
- Index media/links for search
- Support complex queries

→ Then migrate to normalized tables

### Related Decisions
- ADR-003 (Screenshot Storage)

---

## ADR-005: Feature Flags via Environment Variables

**Date**: 2025-11-08
**Status**: Accepted

### Context

Enhanced features (screenshots, media, links) should be:
- Disabled by default (storage/performance impact)
- Configurable globally (ops control)
- Overridable per-request (user control)

### Decision

**Three-tier configuration**:

1. **Global Defaults** (Environment Variables):
   ```bash
   CRAWL4AI_ENABLE_SCREENSHOTS=false
   CRAWL4AI_ENABLE_MEDIA=false
   CRAWL4AI_ENABLE_LINKS=false
   ```

2. **MCP Tool Parameters** (Optional):
   ```typescript
   scrape_docs({ url, enableScreenshots: true })
   ```

3. **FetchOptions** (Direct API):
   ```typescript
   fetch(url, { crawl4ai: { enableScreenshot: true } })
   ```

**Priority**: FetchOptions > MCP params > Environment defaults

### Rationale

1. **Safety**: Disabled by default prevents surprise storage growth
2. **Flexibility**: Ops can enable globally, users can override per-request
3. **Standard Practice**: Environment variables for infrastructure config
4. **Gradual Rollout**: Can enable features incrementally

### Consequences

**Positive:**
- Safe defaults (no surprise costs)
- Operator control via environment
- User control via API
- Clear configuration hierarchy

**Negative:**
- Three places to check configuration
- Documentation burden
- Testing complexity (all combinations)

### Related Decisions
- ADR-006 (Centralized Configuration)

---

## ADR-006: Centralized Configuration Management

**Date**: 2025-11-08
**Status**: Accepted

### Context

Configuration scattered across multiple files. Need single source of truth for:
- Fetcher settings (timeouts, retries)
- Crawl4AI settings (service URL, features)
- Storage settings (paths, limits)
- Monitoring settings

### Decision

Create centralized `src/utils/config.ts` module that:
1. Loads all configuration from environment variables
2. Provides typed configuration objects
3. Validates configuration on startup
4. Exports singleton config instance

```typescript
import { config } from './utils/config';

// Usage
const timeout = config.fetcher.http.timeout;
const crawl4aiUrl = config.fetcher.crawl4ai.serviceUrl;
```

### Rationale

1. **Single Source of Truth**: All config in one place
2. **Type Safety**: TypeScript interfaces for all config
3. **Validation**: Catch configuration errors early
4. **Testability**: Easy to mock configuration
5. **Documentation**: Self-documenting via types

### Consequences

**Positive:**
- Clear configuration structure
- Type-safe access
- Validation at startup
- Easy to test
- Discoverable (IDE autocomplete)

**Negative:**
- Initial refactoring needed
- Need to update existing code
- Singleton pattern (harder to test in some cases)

### Migration Plan

1. Create `config.ts` with all configuration
2. Update code to use `config` instead of `process.env`
3. Add validation tests
4. Document all environment variables

### Related Decisions
- ADR-005 (Feature Flags)

---

## ADR-007: Metrics Collection with In-Memory Aggregation

**Date**: 2025-11-08
**Status**: Accepted

### Context

Need to monitor fetcher performance (success rates, response times) for operational visibility.

**Requirements:**
- Track per-fetcher metrics
- Calculate percentiles (p50, p95, p99)
- Minimal performance overhead
- Exportable to external systems

### Decision

Implement in-memory metrics collection with:
- `MetricsCollector` class storing recent measurements
- Automatic percentile calculation
- Prometheus-compatible export format
- API endpoint for real-time access

**Storage**: Keep last 1000 measurements per fetcher in memory

### Rationale

1. **Performance**: In-memory is fast (<5ms overhead)
2. **Simplicity**: No external dependencies
3. **Real-time**: Immediate metric availability
4. **Standard**: Prometheus format for compatibility

### Consequences

**Positive:**
- Fast metrics collection
- Real-time visibility
- No external dependencies
- Prometheus-compatible

**Negative:**
- Metrics lost on restart
- Limited history (1000 samples)
- Memory usage (small, ~100KB)
- Not suitable for long-term storage

### When to Reconsider

If we need:
- Historical analysis (>1000 samples)
- Metrics persistence across restarts
- Multi-instance aggregation

→ Then integrate with Prometheus/Grafana/InfluxDB

### Related Decisions
- ADR-008 (Monitoring Dashboard)

---

## ADR-008: React-Based Monitoring Dashboard in WebUI

**Date**: 2025-11-08
**Status**: Accepted

### Context

Need to visualize metrics from ADR-007 in user-facing interface. Users should see:
- Service health status
- Fetcher success rates
- Response time distributions
- Error breakdowns

### Decision

Build monitoring dashboard as React components in existing WebUI:
- `MonitoringDashboard` - Main container
- `MetricsCard` - Per-fetcher summary
- Charts for visualization (success rate, response times)
- Real-time updates via polling

**API**: GET `/api/metrics` returns current metrics JSON

### Rationale

1. **Integration**: Uses existing WebUI infrastructure
2. **Familiar**: React components like other pages
3. **Real-time**: Polling provides near-real-time updates
4. **Self-contained**: No external monitoring tools required

### Consequences

**Positive:**
- Integrated with existing UI
- No additional tools to deploy
- Users see metrics immediately
- Standard web development

**Negative:**
- Limited compared to Grafana/Datadog
- Basic charting capabilities
- Polling overhead (mitigated by 10s interval)

### Future Enhancement Path

Can later add:
- Grafana dashboard (using Prometheus export)
- External alerting (PagerDuty, etc.)
- Long-term storage (InfluxDB, etc.)

### Related Decisions
- ADR-007 (Metrics Collection)

---

## ADR-009: Fetcher Type Tracking in Pages Table

**Date**: 2025-11-08
**Status**: Accepted

### Context

Users want to know which fetcher was used for each page (for debugging, analysis, optimization).

### Decision

Add `fetcher_type` column to `pages` table:

```sql
ALTER TABLE pages ADD COLUMN fetcher_type TEXT DEFAULT 'http';
```

Store actual fetcher used (even if 'auto' was specified).

### Rationale

1. **Visibility**: Users see what actually fetched the page
2. **Debugging**: Helps troubleshoot fetcher issues
3. **Analysis**: Can analyze which fetchers work best for which sites
4. **Audit**: Historical record of scraping method

### Consequences

**Positive:**
- Complete audit trail
- Debugging information
- Analysis opportunities
- Minimal storage cost

**Negative:**
- Schema change (migration required)
- One more field to manage

### Implementation

```typescript
await storage.savePage({
  url, title, content, metadata,
  fetcherType: rawContent.fetcherType || 'auto'
});
```

### Related Decisions
- ADR-001 (Explicit Fetcher Selection)

---

## Summary of Key Decisions

1. **ADR-001**: Explicit fetcher selection via `fetcher` parameter
2. **ADR-002**: Expose fetcher selection in MCP tools
3. **ADR-003**: Hybrid storage (files for screenshots, DB for paths)
4. **ADR-004**: JSON storage for media/links metadata
5. **ADR-005**: Three-tier feature flag configuration
6. **ADR-006**: Centralized configuration management
7. **ADR-007**: In-memory metrics collection
8. **ADR-008**: React monitoring dashboard
9. **ADR-009**: Track fetcher type in database

*Last Updated: 2025-11-08*
