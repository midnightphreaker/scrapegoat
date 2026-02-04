# Deployment Log: docs.fenrirsden.org
**Date:** 2026-02-04
**Deployment:** Scrapegoat v2.0.0 commit 4b9193b → dcf6ca4
**Status:** ✅ SUCCESS

---

## Deployment Summary

### What Was Deployed
- **From:** commit 4b9193b "refactor(types): improve type safety and status consistency"
- **To:** commit dcf6ca4 "fix: resolve all TypeScript compilation errors (96 → 0)"
- **Location:** docs.fenrirsden.org (/opt/scrapegoat/scrapegoat)

### Services Deployed
| Service | Status | Port | Notes |
|---------|--------|------|-------|
| Worker | ✓ Healthy | 8080 | API server, embedded worker |
| MCP | ✓ Running | 8888 | MCP protocol server |
| Web | ✓ Running | 9090 | Web UI |
| Crawl4AI | ✓ Healthy | 8001 | Advanced web scraper |

### Data Preservation
- **Database:** PostgreSQL at pgsql.fenrirsden.org:5432 (external, no changes)
- **Libraries indexed:** 26 libraries preserved
- **Backup location:** `/opt/scrapegoat/backup_20260204_173150/`

---

## Critical Findings & Fixes Required for Local Repo

### 1. API Format Change ⚠️ IMPORTANT

**Issue:** The API changed from REST to tRPC with different request format.

**Old API format (commit 4b9193b):**
```bash
# REST endpoints
curl http://localhost:8080/api/libraries
curl -X POST http://localhost:8080/api/search -H "Content-Type: application/json" -d '{"query":"test"}'
```

**New API format (commit dcf6ca4):**
```bash
# tRPC endpoints (query = GET, mutation = POST)
curl "http://localhost:8080/api/listLibraries?input=%7B%7D"
curl "http://localhost:8080/api/search?input=%7B%22query%22%3A%22test%22%2C%22limit%22%3A5%7D"

# For mutations (POST):
curl -X POST http://localhost:8080/api/enqueueJob \
  -H "Content-Type: application/json" \
  -d '{"library":"test","version":"1.0","options":{...}}'
```

**Impact:** Any code using the old REST API format will break.

**Action Required:** Update API documentation and examples.

---

### 2. Health Check Endpoint Changed

**Finding:** `/health` endpoint no longer exists on the new version.

**Old:** `curl http://localhost:8080/health`
**New:** `curl http://localhost:8080/api/ping` (returns `{"result":{"data":{"status":"ok","ts":...}}}`)

**Action Required:** Update monitoring scripts and health checks.

---

### 3. tRPC Query vs Mutation Request Methods

**Critical Detail:** tRPC procedures are called differently:
- **Query procedures** (read-only): Use GET with URL-encoded `input` parameter
- **Mutation procedures** (write): Use POST with JSON body

**Examples from deployment:**

Query (GET):
```bash
# List libraries
curl "http://localhost:8080/api/listLibraries?input=%7B%7D"

# Get jobs
curl "http://localhost:8080/api/getJobs?input=%7B%7D"
```

Mutation (POST):
```bash
# Enqueue job
curl -X POST http://localhost:8080/api/enqueueJob \
  -H "Content-Type: application/json" \
  -d '{"library":"test","version":"1.0","options":{"url":"https://example.com"}}'
```

**Action Required:** Update all API client code.

---

### 4. nginx Configuration Issue (Minor)

**Finding:** nginx returns 301 redirect for http://docs.fenrirsden.org/

**Status:** Not critical - services accessible via direct ports

**Action Required:** Review nginx configuration for proper proxy setup.

---

## Files Changed Between Versions

### Key Additions (relevant to API changes):
- `src/services/trpcService.ts` - New tRPC service
- `src/pipeline/trpc/router.ts` - Pipeline router with tRPC
- `src/store/trpc/router.ts` - Data router with tRPC
- `src/app/AppServer.ts` - Updated to use tRPC service

### API Changes Summary:
| Old (4b9193b) | New (dcf6ca4) |
|---------------|---------------|
| REST API `/api/libraries` | tRPC `/api/listLibraries?input={}` |
| POST to `/api/search` | GET to `/api/search?input={...}` |
| `/health` endpoint | `/api/ping` endpoint |
| Fastify routes | tRPC with Fastify adapter |

---

## Deployment Timeline

| Phase | Planned | Actual | Notes |
|-------|---------|--------|-------|
| Pre-flight checks | 15 min | ~5 min | All passed |
| Backup | 30 min | ~5 min | Quick backup (no DB dump) |
| Build images | 90 min | ~15 min | Built while services running |
| Stop services | 5 min | ~1 min | Quick stop |
| Start services | 20 min | ~3 min | Started successfully |
| Verification | 30 min | ~10 min | API format discovery took time |
| **Total** | **~4 hours** | **~40 min** | **Only ~3 min actual downtime!** |

---

## Fixes to Apply to Local Repository

### 1. Update API Documentation

Files to update:
- `README.md`
- `docs/DEPLOYMENT.md`
- `docs/CONFIGURATION.md`
- Any MCP tool examples

### 2. Update Health Check References

Search for:
- `/health` endpoint references
- Update to `/api/ping`

### 3. Create Migration Guide for API Users

Document the breaking API change from REST to tRPC format.

### 4. Update Monitoring/Health Check Scripts

If any scripts check `/health`, update them to use `/api/ping`.

---

## Verification Commands (for future reference)

```bash
# Check service status
docker ps | grep scrapegoat

# Check API health
curl "http://localhost:8080/api/ping"

# List libraries (tRPC format)
curl "http://localhost:8080/api/listLibraries?input=%7B%7D" | jq .

# Get jobs
curl "http://localhost:8080/api/getJobs?input=%7B%7D" | jq .

# Check container health
docker inspect scrapegoat-worker | jq .[0].State.Health.Status
docker inspect scrapegoat-crawl4ai | jq .[0].State.Health.Status
```

---

## Lessons Learned

1. **Pre-flight checks saved time** - Caught capacity and connectivity issues early
2. **Building before stopping** - Key improvement from original plan, minimized downtime significantly
3. **Image versioning with tags** - Enabled instant rollback capability (used 4b9193b-backup tags)
4. **tRPC format different from REST** - Important discovery for API documentation

---

## Rollback Capability

Rollback images are tagged and available:
- `gitlab.fenrirsden.org/pub/scrapegoat:4b9193b-backup`
- `scrapegoat-crawl4ai:4b9193b-backup`

Rollback command (if needed):
```bash
systemctl stop scrapegoat
cd /opt/scrapegoat/scrapegoat
git checkout 4b9193b
docker tag gitlab.fenrirsden.org/pub/scrapegoat:4b9193b-backup gitlab.fenrirsden.org/pub/scrapegoat:latest
docker tag scrapegoat-crawl4ai:4b9193b-backup scrapegoat-crawl4ai:latest
systemctl start scrapegoat
```

---

## Post-Migration Action Items

- [ ] Update README.md with new tRPC API format
- [ ] Update DEPLOYMENT.md with health check change
- [ ] Create API migration guide for users
- [ ] Update any monitoring scripts
- [ ] Review nginx proxy configuration
- [ ] Document accessibility improvements for users
- [ ] Schedule 7-day backup cleanup
- [ ] Monitor for 30 days for any issues

---

## Sign-Off

**Deployment completed by:** Claude (automated deployment)
**Date:** 2026-02-04
**Status:** ✅ SUCCESS
**Rollback available:** Yes (images tagged as 4b9193b-backup)

**Notes for next deployment:**
- Use tRPC query format (GET with `?input={}`)
- Use tRPC mutation format (POST with JSON body)
- Health check is at `/api/ping`, not `/health`
- Consider blue-green deployment for zero downtime in future
