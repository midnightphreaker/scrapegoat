# Implementation Handoff Guide for @agent-typescript-pro

**Project**: Crawl4AI Enhancements (Phases 2-5)
**Base Branch**: `addCrawl4AI`
**Target**: Production deployment to docs.den.lan
**Date**: 2025-11-08

## Overview

This guide provides everything @agent-typescript-pro needs to implement the Crawl4AI enhancements. Follow the phases sequentially for best results.

## Project Context

### Current State (Phase 1 - Complete ✅)
- Crawl4AI Python service running at localhost:8001
- TypeScript Crawl4AIFetcher integrated
- Storage pipeline saves markdown to PostgreSQL/pgvector
- AutoDetectFetcher has `useCrawl4AI` flag for opt-in
- 25 tests passing (20 unit + 5 integration)
- Deployed to docs.den.lan

### Enhancement Goals
1. **Phase 2**: Explicit fetcher selection API
2. **Phase 3**: Screenshot capture, media extraction, link extraction
3. **Phase 4**: WebUI for monitoring and configuration
4. **Phase 5**: Production-ready configuration and monitoring

## Implementation Order

### Phase 2: Explicit Fetcher Selection (Week 1)

**Priority**: P0 (Must complete first)
**Effort**: 8-12 hours
**Plan**: [phase-2-fetcher-selection.md](../planning/phase-2-fetcher-selection.md)

#### Key Files to Modify
1. `src/scraper/fetcher/types.ts` - Add FetcherType and update FetchOptions
2. `src/scraper/fetcher/AutoDetectFetcher.ts` - Implement selection logic
3. `src/mcp/mcpServer.ts` - Add fetcher parameter to scrape_docs
4. `src/tools/scrape.ts` - Pass fetcher through pipeline

#### Implementation Steps
1. Add types (2 hours)
2. Update AutoDetectFetcher (3 hours)
3. Update MCP tool (1 hour)
4. Write tests (3 hours)
5. Update docs (2 hours)

#### Success Criteria
- [ ] All 4 fetcher types work: auto, http, browser, crawl4ai
- [ ] Backward compatibility: `useCrawl4AI` still works
- [ ] Error messages helpful when wrong fetcher for URL
- [ ] Tests pass with >85% coverage
- [ ] MCP tool accepts fetcher parameter

#### Testing Commands
```bash
# Unit tests
npm test -- AutoDetectFetcher.test.ts

# Integration tests
npm test -- Crawl4AIFetcher.integration.test.ts

# E2E test via MCP
npx tsx test-mcp-fetcher-selection.ts
```

### Phase 3: Enhanced Crawl4AI Features (Weeks 2-3)

**Priority**: P1
**Effort**: 28-36 hours
**Plan**: [phase-3-enhanced-features.md](../planning/phase-3-enhanced-features.md)

#### Sprint 3A: Schema & Infrastructure (Week 2, 16 hours)

**Key Files**:
1. `db/migrations/011-enhanced-crawl4ai.sql` - Add columns for screenshot_path, fetcher_type
2. `src/utils/screenshotStorage.ts` - New file for screenshot management
3. `src/scraper/fetcher/types.ts` - Extend RawContent with screenshot, media, links
4. `src/utils/config.ts` - Add Crawl4AI configuration

**Database Migration**:
```sql
ALTER TABLE pages ADD COLUMN screenshot_path TEXT;
ALTER TABLE pages ADD COLUMN fetcher_type TEXT DEFAULT 'http';
CREATE INDEX idx_pages_fetcher_type ON pages(fetcher_type);
```

**Test Migration**:
```bash
# Run migration
psql -U postgres -d scrapegoat < db/migrations/011-enhanced-crawl4ai.sql

# Verify
psql -U postgres -d scrapegoat -c "\d pages"

# Rollback if needed
psql -U postgres -d scrapegoat < db/migrations/011-enhanced-crawl4ai-down.sql
```

#### Sprint 3B: Integration (Week 3, 12 hours)

**Key Files**:
1. `src/scraper/fetcher/crawl4ai/Crawl4AIFetcher.ts` - Accept Crawl4AIOptions
2. `src/pipeline/PipelineClient.ts` - Save screenshots and metadata
3. `src/store/*.ts` - Update database queries

**Environment Variables**:
```bash
CRAWL4AI_ENABLE_SCREENSHOTS=false
CRAWL4AI_ENABLE_MEDIA=false
CRAWL4AI_ENABLE_LINKS=false
SCREENSHOT_STORAGE_PATH=./public/screenshots
SCREENSHOT_MAX_SIZE_MB=5
```

#### Success Criteria
- [ ] Migration runs successfully
- [ ] Screenshots save to filesystem
- [ ] Screenshot path saved to database
- [ ] Media/links saved in metadata JSON
- [ ] Fetcher type tracked
- [ ] Size limits enforced
- [ ] Tests pass for all features
- [ ] Features disabled by default

### Phase 4: WebUI Integration (Weeks 3-4)

**Priority**: P1
**Effort**: 16-24 hours
**Plan**: [phase-4-webui-integration.md](../planning/phase-4-webui-integration.md)

#### Key Components to Create

**Directory**: `src/web/components/`

1. **ServiceStatus/** (4 hours)
   - `ServiceStatusCard.tsx` - Health monitoring
   - `ServiceHealthIndicator.tsx` - Status badges

2. **Jobs/** (4 hours)
   - `FetcherSelector.tsx` - Dropdown for fetcher selection
   - `Crawl4AIOptions.tsx` - Checkboxes for enhanced features
   - Update `JobForm.tsx` - Integrate new components

3. **Pages/** (6 hours)
   - `ScreenshotViewer.tsx` - Display screenshots
   - `MediaGallery.tsx` - Show extracted media
   - `LinksTable.tsx` - Display links
   - Update `PageView.tsx` - Integrate new components

4. **API Routes** (4 hours)
   ```typescript
   GET /api/health/crawl4ai
   GET /api/health/all
   GET /api/pages/:id/screenshot
   GET /api/pages/:id/metadata
   ```

#### Success Criteria
- [ ] Service health visible in UI
- [ ] Fetcher selection works in job creation
- [ ] Screenshots display correctly
- [ ] Media gallery renders
- [ ] Links table shows internal/external
- [ ] Real-time health polling works
- [ ] Mobile responsive
- [ ] No console errors

### Phase 5: Configuration & Management (Weeks 4-5)

**Priority**: P2
**Effort**: 12-16 hours
**Plan**: [phase-5-configuration.md](../planning/phase-5-configuration.md)

#### Key Files to Create

1. **`src/utils/config.ts`** (3 hours)
   - Centralized configuration loading
   - Validation logic
   - Type-safe config access

2. **`src/monitoring/metrics.ts`** (4 hours)
   - MetricsCollector class
   - Percentile calculations
   - Prometheus export

3. **`src/web/components/Monitoring/`** (5 hours)
   - `MonitoringDashboard.tsx`
   - `MetricsCard.tsx`
   - Charts (success rate, response times, errors)

4. **API Routes** (2 hours)
   ```typescript
   GET /api/metrics
   GET /metrics (Prometheus)
   GET /api/config
   ```

#### Success Criteria
- [ ] Config loads from environment
- [ ] Config validation runs on startup
- [ ] Metrics collect automatically
- [ ] Monitoring dashboard shows real-time data
- [ ] Charts update every 10 seconds
- [ ] All environment variables documented
- [ ] Configuration guide complete

## Testing Strategy

### Unit Tests
Run after each file modification:
```bash
npm test -- <filename>.test.ts
```

Target: >85% coverage for new code

### Integration Tests
Run after completing each sprint:
```bash
npm test -- *.integration.test.ts
```

### E2E Tests
Run after completing each phase:
```bash
npm run test:e2e
```

### Manual Testing Checklist

#### Phase 2
- [ ] Create job with `fetcher: 'auto'` → works
- [ ] Create job with `fetcher: 'http'` → uses HTTP
- [ ] Create job with `fetcher: 'browser'` → uses Browser
- [ ] Create job with `fetcher: 'crawl4ai'` → uses Crawl4AI
- [ ] Try `fetcher: 'file'` on http:// URL → error
- [ ] Backward compat: `useCrawl4AI: true` → uses Crawl4AI

#### Phase 3
- [ ] Enable screenshots → file saved, path in DB
- [ ] Enable media → metadata saved in DB
- [ ] Enable links → metadata saved in DB
- [ ] Screenshot exceeds 5MB → error
- [ ] Screenshot served via /api/pages/:id/screenshot
- [ ] Metadata retrieved via /api/pages/:id/metadata

#### Phase 4
- [ ] Service health shows green for all services
- [ ] Fetcher selector in job form works
- [ ] Screenshot displays on page view
- [ ] Media gallery shows images
- [ ] Links table categorizes internal/external
- [ ] Health polling updates every 30s

#### Phase 5
- [ ] Config loads from .env
- [ ] Metrics show on dashboard
- [ ] Charts update in real-time
- [ ] Prometheus endpoint returns metrics
- [ ] Configuration validation catches errors

## Code Quality Standards

### TypeScript
- Strict mode enabled
- No `any` types (use `unknown` or proper types)
- Interface over type for object shapes
- JSDoc comments for public APIs

### Testing
- Unit tests for all business logic
- Integration tests for cross-component flows
- E2E tests for user workflows
- Mock external dependencies (Crawl4AI service)

### Error Handling
- Use custom error classes (ScraperError, etc.)
- Provide helpful error messages
- Log errors with context
- Don't swallow errors silently

### Documentation
- Update README.md for user-facing changes
- JSDoc for all exported functions
- Inline comments for complex logic
- Migration guides for breaking changes

## Deployment Process

### Development
1. Work on feature branch (e.g., `feature/phase-2-fetcher-selection`)
2. Run tests locally
3. Commit with descriptive messages
4. Push to Git

### Staging
1. Merge to `addCrawl4AI` branch
2. Deploy to local docker-compose
3. Run smoke tests
4. Verify all features work

### Production (docs.den.lan)
1. SSH to server: `sshpass -p 'P@ssw0rd' ssh root@docs.den.lan`
2. Navigate to: `cd /opt/scrapegoat`
3. Pull latest: `git fetch && git checkout addCrawl4AI && git pull`
4. Build: `docker compose up -d --build`
5. Verify: Check logs, test endpoints
6. Monitor: Watch for errors in first hour

### Rollback Plan
If issues arise in production:
```bash
# On docs.den.lan
cd /opt/scrapegoat
git checkout <previous-commit-hash>
docker compose up -d --build
```

For database migrations:
```bash
psql -U postgres -d scrapegoat < db/migrations/<migration>-down.sql
```

## Common Patterns & Best Practices

### Adding Environment Variables
1. Add to `src/utils/config.ts`
2. Add to `.env.example`
3. Document in README.md
4. Add validation in `validateConfig()`
5. Update docker-compose.yml if needed

### Adding Database Columns
1. Create migration file: `db/migrations/<number>-description.sql`
2. Create rollback: `db/migrations/<number>-description-down.sql`
3. Update TypeScript types
4. Update queries in `src/store/`
5. Test migration up and down

### Adding API Routes
1. Define route in `src/web/web.ts` or `src/web/routes/`
2. Add request validation (Zod schema)
3. Add error handling
4. Write tests
5. Document in API reference

### Adding React Components
1. Create in appropriate directory: `src/web/components/<category>/`
2. Define prop interfaces
3. Add PropTypes or TypeScript types
4. Write component tests
5. Update parent component to use

## Troubleshooting Guide

### Crawl4AI Service Not Responding
```bash
# Check if service is running
docker ps | grep crawl4ai

# Check logs
docker logs scrapegoat-crawl4ai

# Restart service
docker-compose restart crawl4ai

# Test health endpoint
curl http://localhost:8001/health
```

### Screenshot Not Saving
```bash
# Check directory exists
ls -la public/screenshots

# Check permissions
chmod -R 755 public/screenshots

# Check disk space
df -h

# Check logs for errors
npm run dev  # Watch for errors
```

### Migration Failing
```bash
# Check current schema
psql -U postgres -d scrapegoat -c "\d pages"

# Check if migration already applied
psql -U postgres -d scrapegoat -c "SELECT * FROM pages LIMIT 1;"

# Manually verify migration
psql -U postgres -d scrapegoat
\d pages  -- Should show new columns
```

### Tests Failing
```bash
# Clear test cache
npm test -- --clearCache

# Run specific test
npm test -- --testNamePattern="AutoDetectFetcher"

# Run with coverage
npm run test:coverage

# Check for TypeScript errors
npm run build
```

## Phase Completion Checklist

### Before Starting Implementation
- [ ] Read all planning documents
- [ ] Understand architecture decisions
- [ ] Set up development environment
- [ ] Create feature branch
- [ ] Review current codebase

### After Each Phase
- [ ] All tests passing
- [ ] Code reviewed (if working with team)
- [ ] Documentation updated
- [ ] Manual testing complete
- [ ] Committed with clear message
- [ ] Pushed to Git

### Before Production Deployment
- [ ] All phases complete
- [ ] Full test suite passing
- [ ] Documentation complete
- [ ] Production environment variables set
- [ ] Database migration tested
- [ ] Rollback plan ready
- [ ] Monitoring in place

## Key Contacts & Resources

**Git**: http://gitlab.den.lan/pub/scrapegoat
**Production**: docs.den.lan (SSH: root@docs.den.lan, password: P@ssw0rd)
**Crawl4AI Docs**: https://docs.crawl4ai.com/
**Project Planning**: `/home/mp/Workspace/scrapegoat/projects/crawl4ai-enhancements-planning/`

## Quick Reference

### File Locations

```
src/
├── scraper/fetcher/
│   ├── types.ts                    # FetcherType, FetchOptions, RawContent
│   ├── AutoDetectFetcher.ts        # Main fetcher orchestration
│   └── crawl4ai/
│       ├── Crawl4AIFetcher.ts      # Crawl4AI integration
│       └── types.ts                # Crawl4AI-specific types
├── pipeline/
│   ├── PipelineClient.ts           # Scraping pipeline
│   └── types.ts                    # Pipeline types
├── store/
│   └── PgStore.ts                  # PostgreSQL storage
├── utils/
│   ├── config.ts                   # Centralized configuration
│   └── screenshotStorage.ts        # Screenshot file management
├── monitoring/
│   └── metrics.ts                  # Metrics collection
├── mcp/
│   └── mcpServer.ts                # MCP tool definitions
└── web/
    ├── components/                 # React components
    ├── routes/                     # API routes
    └── web.ts                      # Fastify server

db/migrations/
└── 011-enhanced-crawl4ai.sql       # Database schema changes
```

### Command Cheat Sheet

```bash
# Development
npm run dev                 # Start dev server
npm test                    # Run tests
npm run lint                # Check code style
npm run format              # Format code

# Database
psql -U postgres -d scrapegoat  # Connect to DB
npm run migrate                 # Run migrations (if script exists)

# Docker
docker-compose up -d            # Start services
docker-compose logs -f crawl4ai # Watch Crawl4AI logs
docker-compose restart          # Restart services

# Production Deployment
ssh root@docs.den.lan
cd /opt/scrapegoat
git pull && docker compose up -d --build
```

## Final Notes

- **Sequential Implementation**: Complete phases in order (2 → 3 → 4 → 5)
- **Test Continuously**: Run tests after each file modification
- **Commit Often**: Small, focused commits with clear messages
- **Document Changes**: Update docs as you implement
- **Ask Questions**: If unclear, refer back to planning documents

**Good luck! The planning is comprehensive - implementation should be straightforward.**

*Last Updated: 2025-11-08*
