# Update Library Feature - Implementation Planning

**Status**: Research Complete - Implementation Planning
**Date**: 2025-11-25
**Coordinator**: Tech Lead Orchestrator (Planning Agent)
**Coordination Memory ID**: d9c433ec-8f78-4a5c-8b0a-c1856f3ea138

---

## Project Overview

This document contains the comprehensive implementation plan for adding an "Update Library" feature to ScrapeGoat that allows users to re-scrape existing documentation libraries using their original settings.

### Feature Summary

Add a blue circular-arrow refresh icon next to the trash bin in the library list that triggers a re-scrape of the existing library using the exact same settings as the original scrape, with robust error handling and data integrity guarantees.

---

## Directory Structure

```
update-library-feature-planning/
├── README.md (this file)
├── requirements/
│   ├── functional-requirements.md
│   ├── non-functional-requirements.md
│   └── user-stories.md
├── research/
│   ├── existing-architecture.md
│   ├── data-loss-vulnerability.md
│   ├── versioning-strategies.md
│   └── error-detection-approaches.md
├── architecture/
│   ├── system-architecture.md
│   ├── database-changes.md
│   ├── api-design.md
│   └── architecture-decisions.md
├── planning/
│   ├── implementation-phases.md
│   ├── task-breakdown.md
│   ├── dependencies.md
│   └── timeline-estimates.md
├── risks/
│   ├── risk-assessment.md
│   └── mitigation-strategies.md
└── documentation/
    ├── developer-guide.md
    └── testing-strategy.md
```

---

## Quick Links

- [Functional Requirements](requirements/functional-requirements.md)
- [Existing Architecture Analysis](research/existing-architecture.md)
- [Critical Data Loss Vulnerability](research/data-loss-vulnerability.md)
- [Implementation Phases](planning/implementation-phases.md)
- [Risk Assessment](risks/risk-assessment.md)

---

## Key Findings

### Existing Infrastructure (Good News!)

1. **PipelineManager.enqueueJobWithStoredOptions()** already exists
   - Retrieves scraper_options from database
   - Creates job with exact same settings
   - Queues job normally through existing pipeline

2. **Database already persists scrape settings**
   - `versions.scraper_options` (JSON column)
   - `versions.source_url`
   - Ready for re-use

3. **Pages table uses UPSERT pattern**
   - `ON CONFLICT DO UPDATE` - good for updates
   - Existing pages get refreshed automatically

### Critical Issues (Bad News!)

1. **Data Loss Vulnerability (PipelineWorker.ts:46)**
   ```typescript
   await this.store.removeAllDocuments(library, version);
   ```
   - Deletes ALL documents BEFORE scraping starts
   - NO backup mechanism
   - NO rollback capability
   - If scrape fails → data permanently lost

2. **No Quality Validation**
   - No detection of blank content
   - No detection of corrupted files
   - No detection of HTTP error pages (404, 500, etc.)
   - Bad data gets committed to database

3. **No Versioning System**
   - Cannot track scrape history
   - Cannot compare old vs new
   - Cannot rollback to previous version

---

## Implementation Strategy

### Phase 1: Database Versioning System
Add snapshot/backup capabilities before implementing UI

### Phase 2: Quality Validation
Implement content quality detection

### Phase 3: UI Implementation
Add refresh button to WebUI

### Phase 4: Error Handling & Rollback
Implement two-option error recovery

### Phase 5: Testing & Documentation
Comprehensive testing and user documentation

---

## Agent Coordination

This is a RESEARCH-ONLY task. Implementation will be coordinated through:

- **Service Coordination Memory**: d9c433ec-8f78-4a5c-8b0a-c1856f3ea138
- **Other Active Agents**: A1 (Dark Mode), A2 (Wide Mode) may restart service
- **Available for Consultation**: backend-architect, database-architect, frontend-developer

---

## Next Steps

1. ✅ Complete architecture research
2. ✅ Document existing infrastructure
3. ✅ Identify critical vulnerabilities
4. 🔄 Create detailed implementation plans (in progress)
5. ⏳ Risk assessment and mitigation
6. ⏳ Get stakeholder approval
7. ⏳ Begin Phase 1 implementation

---

*Last Updated: 2025-11-25*
