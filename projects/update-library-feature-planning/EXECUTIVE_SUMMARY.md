# Update Library Feature - Executive Summary

**Date**: 2025-11-25
**Status**: ✅ Planning Complete - Ready for Implementation
**Estimated Timeline**: 2-3 weeks
**Overall Risk**: 🟡 MEDIUM (becomes 🟢 LOW after Phase 2)

---

## TL;DR

**What**: Add blue refresh button to library list that re-scrapes documentation using stored settings

**Why**: Users need to update existing libraries when documentation changes

**Problem**: Current system has CRITICAL data loss vulnerability that MUST be fixed first

**Solution**: 6-phase implementation fixing vulnerability, then adding feature

**Timeline**: 2-3 weeks

**Recommendation**: ✅ **PROCEED** with phased implementation

---

## The Feature

### User Experience

```
User sees library list with versions:
  React 18.0.0  [🔄 Update] [🗑️ Delete]

User clicks 🔄 Update:
  → Confirmation dialog appears
  → User confirms
  → Re-scrape starts with original settings
  → Progress shown in real-time
  → Success: Library updated ✅
  → Failure: User chooses:
      ✅ Keep cleaned data (discard errors)
      ↩️ Rollback to previous version
```

### Technical Flow

```
1. User clicks Update button (blue circular arrows icon)
2. POST /web/libraries/{lib}/versions/{ver}/update
3. PipelineManager.enqueueJobWithStoredOptions(lib, ver)
   → Retrieves scraper_options from database
   → Creates backup of existing documents ⭐ NEW
   → Queues job normally
4. PipelineWorker executes with backup protection ⭐ MODIFIED
5. Quality validation filters bad content ⭐ NEW
6. On success: Delete backup, commit new docs
7. On failure: User chooses keep or rollback ⭐ NEW
```

---

## Critical Finding: Data Loss Vulnerability 🔴

### The Problem

**PipelineWorker.ts line 46** deletes ALL documents BEFORE scraping:

```typescript
await this.store.removeAllDocuments(library, version); // ⚠️ NO BACKUP!
await this.scraperService.scrape(...); // If this fails → DATA LOST!
```

**Impact**:
- ✅ Affects ALL scraping operations (not just updates)
- ✅ Production database with 131K documents at risk
- ✅ Any failure = permanent data loss
- ✅ Already identified in previous code review but not fixed

**Update Feature Makes This WORSE**:
- Current: Users scrape new libraries (empty → populated)
  - Failure = no data (expected)
- Update: Users update existing libraries (populated → deleted → partial)
  - Failure = data loss (UNEXPECTED!)

### The Solution

**Short-term (Phase 2)**:
```typescript
backupId = await store.createBackup(library, version); // NEW!
try {
  await store.removeAllDocuments(library, version);
  await scrapeDocuments();
  await store.deleteBackup(backupId);
} catch (error) {
  await store.restoreFromBackup(library, version, backupId); // NEW!
  throw error;
}
```

**Benefits**:
- ✅ Eliminates data loss for ALL scrapes
- ✅ Simple to implement
- ✅ Minimal performance impact (<10%)
- ✅ Fixes vulnerability BEFORE adding UI

---

## Good News: 80% Already Built! 🎉

### What Already Exists

1. ✅ **PipelineManager.enqueueJobWithStoredOptions()**
   - Retrieves scraper_options from database
   - Creates job with exact same settings
   - Perfect for Update feature!

2. ✅ **Database stores all scrape settings**
   - `versions.scraper_options` (JSONB column)
   - `versions.source_url`
   - Everything needed to reproduce scrape

3. ✅ **Pages table uses UPSERT**
   - `ON CONFLICT DO UPDATE`
   - Automatically updates existing pages

4. ✅ **Job queue system**
   - Concurrency control
   - Job recovery on restart
   - Progress tracking
   - Cancellation support

### What Needs Implementation

1. ⏳ Backup/restore system (2-3 days)
2. ⏳ Quality validation (2-3 days)
3. ⏳ Update button UI (1-2 days)
4. ⏳ Error recovery UI (2-3 days)

**UI is the EASY part - backend safety is the hard part!**

---

## Implementation Plan

### 6 Phases (Must Execute in Order)

```
Phase 0: Planning ✅ COMPLETE (1-2 days)
  └─> Architecture research
  └─> Vulnerability analysis
  └─> Implementation plan

Phase 1: Database Schema (1-2 days)
  └─> Add snapshot_id column
  └─> Create backup table
  └─> Migration scripts

Phase 2: Backup/Restore 🎯 CRITICAL (2-3 days)
  └─> Implement backup methods
  └─> Modify PipelineWorker
  └─> Fix data loss vulnerability
  └─> Comprehensive tests

Phase 3: Quality Validation (2-3 days)
  └─> Blank content detection
  └─> Error page detection
  └─> Corrupted content detection
  └─> Integration with worker

Phase 4: Update UI (1-2 days)
  └─> Blue refresh button
  └─> Backend route handler
  └─> Progress feedback
  └─> Status updates

Phase 5: Error Handling (2-3 days)
  └─> Error dialog UI
  └─> "Keep cleaned data" option
  └─> "Rollback" option
  └─> Recovery workflows

Phase 6: Testing & Docs (2-3 days)
  └─> Integration tests
  └─> Performance tests
  └─> User documentation
  └─> Developer documentation
```

**Total**: 11-18 days (2-3 weeks)

---

## Architecture Changes

### Database Schema

**NEW Tables**:
```sql
-- Track snapshots
CREATE TABLE document_snapshots (
  id UUID PRIMARY KEY,
  version_id INTEGER REFERENCES versions(id),
  created_at TIMESTAMP,
  status TEXT,
  document_count INTEGER
);

-- Backup storage
CREATE TABLE documents_backup (
  backup_id UUID,
  original_id INTEGER,
  page_id INTEGER,
  content TEXT,
  embedding VECTOR(3072),
  metadata JSONB,
  sort_order INTEGER
);
```

**Modified Tables**:
```sql
-- Add snapshot tracking
ALTER TABLE documents ADD COLUMN snapshot_id UUID;
```

### Code Changes

**Modified Files**:
- `src/pipeline/PipelineWorker.ts` - Add backup/restore logic
- `src/store/DocumentStore.ts` - Add backup methods

**New Files**:
- `src/pipeline/validators/ContentValidator.ts` - Quality validation
- `src/web/components/UpdateButton.tsx` - UI component
- `src/web/components/UpdateErrorDialog.tsx` - Error recovery UI
- `src/web/routes/libraries/update.tsx` - Backend routes

---

## Risk Assessment

### Before Implementation
**Risk Level**: 🔴 **CRITICAL**
- Data loss vulnerability unmitigated
- Update feature would be dangerous

### After Phase 2
**Risk Level**: 🟡 **MEDIUM**
- Data loss risk eliminated
- Performance impact minimal
- Other risks manageable

### After Full Implementation
**Risk Level**: 🟢 **LOW**
- All risks mitigated
- Comprehensive testing complete
- Monitoring in place

### Top Risks & Mitigation

| Risk | Severity | Mitigation |
|------|----------|------------|
| Data loss | 🔴 CRITICAL | Backup/restore in Phase 2 |
| Performance | 🟡 MEDIUM | <10% overhead, optimizations |
| Migration | 🟡 MEDIUM | Tested rollback plan |
| False positives | 🟢 LOW | Conservative thresholds |

---

## Success Criteria

### Technical
- ✅ Zero data loss in failure scenarios
- ✅ <10% performance overhead
- ✅ >95% invalid content detection accuracy
- ✅ 100% test coverage on critical paths

### User Experience
- ✅ One-click update for existing libraries
- ✅ Clear error recovery options
- ✅ Real-time progress feedback
- ✅ Intuitive UI matching existing patterns

### Business
- ✅ Fixes critical vulnerability (benefits all users)
- ✅ Enables documentation refresh workflow
- ✅ Reduces manual re-scraping effort
- ✅ Improves user trust and satisfaction

---

## Recommendations

### ✅ PROCEED with Implementation

**Justification**:
1. **Critical vulnerability must be fixed anyway** - benefits all scraping
2. **80% of infrastructure already exists** - low implementation risk
3. **High user value** - requested feature with clear use case
4. **Phased approach de-risks** - can stop at any phase if issues arise
5. **Timeline is reasonable** - 2-3 weeks with proper testing

### Conditions for Success

1. ✅ **Complete Phases 1-2 BEFORE UI implementation**
   - Fix vulnerability first
   - Ensure data safety

2. ✅ **Comprehensive testing at each phase**
   - Unit tests
   - Integration tests
   - Performance tests

3. ✅ **Gradual rollout**
   - Deploy to staging
   - Feature flag in production
   - Monitor metrics

4. ✅ **Prepared rollback plans**
   - Database migration rollback
   - Feature flag disable
   - Hotfix deployment ready

### Alternative: Do NOT Implement

**If rejected**, still recommend:
- ⚠️ **Fix Phase 1-2 anyway** (vulnerability affects ALL scrapes)
- ⏸️ Postpone UI implementation
- 📝 Document workaround (manual delete + re-scrape)

---

## Resource Requirements

### Development
- **Backend Developer**: 1 person, 1.5 weeks
- **Frontend Developer**: 1 person, 0.5 weeks
- **Database Engineer**: 1 person, 0.5 weeks (schema changes)
- **QA Engineer**: 1 person, 1 week (testing)

**Or**: 1 full-stack developer, 2-3 weeks

### Infrastructure
- **Database Storage**: +10-20% for backups (temporary)
- **Testing Environment**: Staging database with production data
- **Monitoring**: Metrics for backup/restore operations

### No Additional Costs
- ✅ No new dependencies
- ✅ No new services
- ✅ No infrastructure changes
- ✅ Uses existing PostgreSQL features

---

## Next Steps

### Immediate (Week 1)
1. ✅ Get stakeholder approval
2. ⏳ Create Phase 1 database migration
3. ⏳ Test migration on staging
4. ⏳ Begin Phase 2 implementation

### Short-term (Week 2)
1. ⏳ Complete backup/restore implementation
2. ⏳ Quality validation implementation
3. ⏳ Begin UI implementation
4. ⏳ Integration testing

### Medium-term (Week 3)
1. ⏳ Error handling UI
2. ⏳ Comprehensive testing
3. ⏳ Documentation
4. ⏳ Production deployment

### Long-term (Post-Launch)
1. ⏳ Monitor metrics
2. ⏳ Gather user feedback
3. ⏳ Consider snapshot versioning (Phase 7)
4. ⏳ Incremental update optimization

---

## Questions & Answers

### Why not just add the UI button first?

**Answer**: The data loss vulnerability is CRITICAL. Adding UI before fixing it would:
- Give users a dangerous feature
- Increase likelihood of data loss
- Damage user trust
- Create liability issues

**Fix the foundation first, then build on it.**

### Why 2-3 weeks? Seems long for a button.

**Answer**:
- UI button: 1 day ✅ EASY
- Backend safety: 10-15 days ⚠️ HARD
- Testing: 2-3 days ⚠️ CRITICAL

**We're not building a button - we're fixing a critical vulnerability and adding robust error handling.**

### Can we skip the backup/restore and just re-scrape if it fails?

**Answer**: **NO** - data is already deleted! Once `removeAllDocuments()` runs, original data is gone. Re-scraping would just scrape again (and likely fail again).

### What if Phase 2 takes longer than expected?

**Answer**:
- Phases 3-6 can wait
- Phase 2 is valuable standalone (fixes vulnerability)
- Can deploy Phase 2 to production immediately
- Add UI later when ready

### What's the minimum viable implementation?

**Answer**: **Phase 1 + Phase 2 + Phase 4**
- Database changes
- Backup/restore
- Basic UI button
- Skip quality validation and error recovery UI
- **Timeline**: ~1 week instead of 2-3

**Trade-off**: Less user-friendly error handling, but core feature works.

---

## Conclusion

**The Update Library feature is both necessary and achievable.**

The discovered data loss vulnerability is **already affecting production** - fixing it benefits all users, not just those using the Update feature.

With proper phased implementation, comprehensive testing, and gradual rollout, this feature can be delivered safely within 2-3 weeks.

**Recommendation**: ✅ **APPROVE and proceed with Phase 1**

---

## Documentation Index

- [Full README](README.md)
- [Functional Requirements](requirements/functional-requirements.md)
- [Existing Architecture](research/existing-architecture.md)
- [Data Loss Vulnerability](research/data-loss-vulnerability.md)
- [Implementation Phases](planning/implementation-phases.md)
- [Risk Assessment](risks/risk-assessment.md)

---

*Planning completed: 2025-11-25*
*Project: ScrapeGoat Update Library Feature*
*Coordination Memory: d9c433ec-8f78-4a5c-8b0a-c1856f3ea138*
