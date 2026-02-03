# GitLab Issues to Create for TODOs

Since GitLab API authorization failed, these issues should be created manually or via the GitLab web interface.

## Project: pub/scrapegoat

---

## Issue 1: Frontend HTML5 Validation Implementation

**Title**: Frontend: Implement HTML5 maxlength validation in ScrapeFormContent

**Description**:
```markdown
## Issue Description

Backend validation for form field lengths has been implemented in Issue #58, but the frontend validation (HTML5 maxlength attributes, character count displays, visual feedback) has not yet been implemented.

## Current Status

**Backend**: ✅ Complete
- `validateFormFields()` function implemented in `src/web/routes/jobs/new.tsx`
- `VALIDATION_LIMITS` constants defined in `src/web/utils/validation.ts`
- Returns 400 status with specific error messages when limits exceeded

**Frontend**: ❌ TODO
- No maxlength attributes on form inputs
- No character count displays
- No visual feedback when approaching limits
- No AlpineJS helper functions for color/border classes

## Implementation Required

The complete implementation guide is documented in `/docs/VALIDATION_IMPLEMENTATION.md`.

### Key Changes Needed:

1. **Add import**: `import { VALIDATION_LIMITS } from "../utils/validation"`

2. **Add AlpineJS helper functions** to x-data:
   - `getCharColor(current, max)` - Returns color based on usage
   - `getBorderClass(current, max)` - Returns border class based on usage

3. **Add x-model bindings** to text fields:
   - url
   - library
   - version
   - includePatterns
   - excludePatterns

4. **Add maxlength attributes** to all inputs

5. **Add character count displays** with visual feedback

## Validation Limits Reference

- URL: 2048 characters (browser limit)
- Library: 100 characters
- Version: 50 characters
- Include/Exclude Patterns: 2000 characters each
- Header Name: 100 characters
- Header Value: 500 characters

## Documentation

See `/docs/VALIDATION_IMPLEMENTATION.md` for detailed implementation steps with code examples.

## Related Issues

- Part of Issue #58: Form Validation Implementation
- Backend validation already complete
```

**Labels**: `frontend`, `validation`, `TODO`, `good-first-issue`
**Priority**: High
**Estimate**: 2-4 hours

---

## Issue 2: API Documentation Update

**Title**: Docs: Update API documentation after crawl4ai enhancements

**Description**:
```markdown
## Issue Description

API documentation needs to be updated after the implementation of crawl4ai enhancements.

## Location

Projects/crawl4ai-enhancements-planning/EXECUTIVE_SUMMARY.md

## Current Status

From the executive summary:
- [x] Deployment procedures
- [x] Troubleshooting guide
- [x] API documentation updates (TODO: after implementation)
- [x] User guide (TODO: after implementation)

The implementation is complete, but the API documentation has not been updated to reflect the new features and changes.

## Required Updates

1. Update API documentation with new Crawl4AI fetcher options:
   - enableScreenshots parameter
   - enableMedia parameter
   - enableLinks parameter
   - fetcher selection (auto/http/crawl4ai)

2. Document new request/response formats

3. Add examples for new features

4. Update authentication/authorization docs if needed

## Acceptance Criteria

- [ ] API docs reflect all new Crawl4AI features
- [ ] Request/response examples are accurate
- [ ] All new parameters documented
- [ ] Feature flags/switches explained
- [ ] Error cases documented

## Related Issues

- Phase: crawl4ai-enhancements
- Documentation review needed
```

**Labels**: `documentation`, `TODO`, `low-priority`
**Priority**: Low
**Estimate**: 3-4 hours

---

## Issue 3: User Guide Update

**Title**: Docs: Update user guide after crawl4ai enhancements

**Description**:
```markdown
## Issue Description

User guide needs to be updated after the implementation of crawl4ai enhancements to help users understand and use the new features.

## Location

Projects/crawl4ai-enhancements-planning/EXECUTIVE_SUMMARY.md

## Current Status

From the executive summary, the user guide is marked as "TODO: after implementation". The implementation is complete, but user-facing documentation has not been updated.

## Required Updates

1. **New Fetcher Options**:
   - Explain fetcher selection (auto/http/crawl4ai)
   - When to use each fetcher
   - Performance characteristics

2. **Crawl4AI Features**:
   - How to enable screenshots
   - How to enable media extraction
   - How to enable link extraction
   - Use cases for each feature

3. **Configuration Examples**:
   - Basic usage
   - Advanced options
   - Common scenarios

4. **Migration Guide**:
   - Changes from previous version
   - Breaking changes (if any)
   - New capabilities

## Acceptance Criteria

- [ ] User guide covers all new features
- [ ] Clear examples provided
- [ ] Use cases documented
- [ ] Performance guidance included
- [ ] Screenshots/diagrams where helpful

## Related Issues

- Phase: crawl4ai-enhancements
- Related to API documentation update issue
```

**Labels**: `documentation`, `TODO`, `low-priority`
**Priority**: Low
**Estimate**: 2-3 hours

---

## Issue 4: Close Method Documentation

**Title**: Code: Document close() method design decision in Crawl4AIFetcher

**Description**:
```markdown
## Issue Description

The `close()` method in `Crawl4AIFetcher.ts` (lines 223-226) is currently a no-op with only a comment explaining why. This design decision should be more thoroughly documented.

## Location

File: `src/scraper/fetcher/crawl4ai/Crawl4AIFetcher.ts`
Lines: 223-226

## Current Code

\`\`\`typescript
public close(): void {
  // Crawl4AI HTTP client doesn't require explicit cleanup
  // Connections are managed by the underlying fetch API
}
\`\`\`

## Recommendation

From the unified issues report:

> The close method is a no-op with only a comment explaining why.
>
> **Recommendation:**
> Add a TODO or document the design decision more thoroughly.

## Options

1. **Add comprehensive JSDoc**: Document why no cleanup is needed, references to fetch API behavior

2. **Add inline TODO comment**: Track this as a known design decision for future review

3. **Extract to constant**: Define a class-level constant explaining the cleanup strategy

4. **Implement actual cleanup**: If cleanup is actually needed (verify with Crawl4AI docs)

## Acceptance Criteria

- [ ] Design decision documented in JSDoc
- [ ] Rationale explained (fetch API connection management)
- [ ] Future considerations noted
- [ ] Related code referenced

## Related Issues

- Issue #88: TODO comments cleanup
- Code quality improvement
```

**Labels**: `code-quality`, `documentation`, `TODO`, `low-priority`
**Priority**: Low
**Estimate**: 30 minutes

---

## Issue 5: Extract Feature Logging Helper

**Title**: Refactor: Extract verbose feature logging to helper function

**Description**:
```markdown
## Issue Description

There is verbose feature logging code in `Crawl4AIFetcher.ts` (lines 117-122) that could be extracted to a helper function for reusability and better code organization.

## Location

File: `src/scraper/fetcher/crawl4ai/Crawl4AIFetcher.ts`
Lines: 117-122

## Current Code Pattern

\`\`\`typescript
// Log enabled features
if (options?.enableScreenshots) {
  this.logger.debug('Screenshots enabled');
}
if (options?.enableMedia) {
  this.logger.debug('Media extraction enabled');
}
if (options?.enableLinks) {
  this.logger.debug('Link extraction enabled');
}
\`\`\`

## Recommendation

From the unified issues report:

> Small utility that could be extracted to a helper function for reusability.

## Proposed Solution

\`\`\`typescript
private logEnabledFeatures(options?: FetchOptions): void {
  const features = {
    enableScreenshots: 'Screenshots',
    enableMedia: 'Media extraction',
    enableLinks: 'Link extraction'
  };

  for (const [key, label] of Object.entries(features)) {
    if (options?.[key as keyof FetchOptions]) {
      this.logger.debug(\`\${label} enabled\`);
    }
  }
}
\`\`\`

## Benefits

- DRY principle
- Easier to add new features
- Consistent logging format
- Easier to test
- Cleaner main logic

## Acceptance Criteria

- [ ] Extract logging to helper method
- [ ] Update call sites
- [ ] Add unit tests for helper
- [ ] Verify logging output unchanged
- [ ] Code review approved

## Related Issues

- Issue #88: TODO comments cleanup
- Code quality improvement
- Crawl4AI fetcher enhancements
```

**Labels**: `refactor`, `code-quality`, `TODO`, `low-priority`
**Priority**: Low
**Estimate**: 1 hour

---

## Issue 6: Extract Config Builder

**Title**: Refactor: Extract complex config building to separate method

**Description**:
```markdown
## Issue Description

The config building logic in `Crawl4AIFetcher.ts` (lines 68-112) is complex and could be extracted to a separate method for better maintainability.

## Location

File: `src/scraper/fetcher/crawl4ai/Crawl4AIFetcher.ts`
Lines: 68-112

## Current Code Pattern

Complex configuration building logic is inline, making the main method harder to read and test.

## Recommendation

From the unified issues report:

> Complex Config Building - Location: Crawl4AIFetcher.ts:68-112
>
> **Recommended Fix:**
> \`\`\`typescript
> private buildCrawl4AIConfig(options?: FetchOptions): Crawl4AIConfig {
>   // ... config building logic ...
> }
> \`\`\`

## Proposed Solution

Extract the configuration building logic into a dedicated private method:

\`\`\`typescript
private buildCrawl4AIConfig(options?: FetchOptions): Crawl4AIConfig {
  const config: Crawl4AIConfig = {
    // Base configuration
    // ...
  };

  // Feature flags
  // ...

  // Advanced options
  // ...

  return config;
}
\`\`\`

## Benefits

- Single Responsibility Principle
- Easier to test configuration logic
- Cleaner main method
- Easier to modify configuration
- Better error handling

## Acceptance Criteria

- [ ] Extract config building to `buildCrawl4AIConfig()` method
- [ ] Add JSDoc documentation
- [ ] Update call sites
- [ ] Add unit tests for config builder
- [ ] Verify behavior unchanged
- [ ] Code review approved

## Related Issues

- Issue #88: TODO comments cleanup
- Code quality improvement
- Crawl4AI fetcher enhancements
```

**Labels**: `refactor`, `code-quality`, `TODO`, `low-priority`
**Priority**: Low
**Estimate**: 2 hours

---

## Issue 7: Review MultimodalEmbeddings Pattern

**Title**: Refactor: Review MultimodalEmbeddings text embedding delegation pattern

**Description**:
```markdown
## Issue Description

The text embedding delegation in `FixedDimensionEmbeddings.ts` (lines 135-137) should be reviewed for code quality and potential improvements.

## Location

File: `src/store/embeddings/FixedDimensionEmbeddings.ts`
Lines: 135-137

## Current Code Pattern

From the unified issues report:

> MultimodalEmbeddings Text Embedding Delegation
>
> **Description:** [Incomplete in original report]

## Investigation Needed

1. **Current Implementation**: Review how text embedding is delegated
2. **Pattern Consistency**: Check if this follows established patterns
3. **Performance**: Any performance implications
4. **Maintainability**: Is this clear and maintainable?
5. **Alternatives**: Are there better approaches?

## Tasks

- [ ] Review current implementation
- [ ] Document current behavior
- [ ] Identify issues (if any)
- [ ] Propose improvements
- [ ] Create refactoring plan if needed
- [ ] Implement or document decision

## Acceptance Criteria

- [ ] Implementation reviewed and documented
- [ ] Issues identified and addressed OR documented as acceptable
- [ ] Code is maintainable and follows project patterns
- [ ] Performance acceptable

## Related Issues

- Issue #88: TODO comments cleanup
- Code quality improvement
- Embedding system review
```

**Labels**: `code-quality`, `investigation`, `TODO`, `low-priority`
**Priority**: Low
**Estimate**: 2-3 hours

---

## Bulk Creation Instructions

If using GitLab CLI or API:

```bash
# For each issue, use:
glab issue create \
  --title "Issue Title" \
  --description "file.md" \
  --label "label1,label2" \
  --pub/scrapegoat
```

Or use the web interface at:
https://gitlab.fenrirsden.org/pub/scrapegoat/-issues/new

---

*Generated for Issue #88: TODO Comments*
*Date: 2026-02-04*
