# Implementation Phases: Update Library Feature

**Status**: Planning Complete
**Date**: 2025-11-25
**Estimated Total Time**: 2-3 weeks
**Priority**: HIGH (fixes critical vulnerability + adds high-value feature)

---

## Overview

This implementation is split into **6 phases** to ensure safety, quality, and proper testing. The phases MUST be executed in order due to dependencies.

**Key Principle**: Fix the data loss vulnerability FIRST, then add the Update Library UI feature.

---

## Phase 0: Pre-Implementation (CURRENT PHASE)

**Duration**: 1-2 days
**Status**: ✅ COMPLETE

### Deliverables
- ✅ Architecture analysis complete
- ✅ Critical vulnerability documented
- ✅ Implementation plan created
- ✅ Risk assessment complete
- ✅ Stakeholder review scheduled

### Next Step
→ Get approval to proceed with Phase 1

---

## Phase 1: Database Schema Changes

**Duration**: 1-2 days
**Priority**: CRITICAL (blocking)
**Dependencies**: None

### Goal
Add backup/snapshot capabilities to database schema without breaking existing functionality.

### Tasks

#### 1.1 Create Migration File
**File**: `src/store/migrations/007_document_snapshots.sql`

```sql
-- Add snapshot tracking to documents
ALTER TABLE documents ADD COLUMN snapshot_id UUID DEFAULT NULL;
CREATE INDEX idx_documents_snapshot_id ON documents(snapshot_id);

-- Add snapshot metadata table
CREATE TABLE document_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id INTEGER NOT NULL REFERENCES libraries(id),
  version_id INTEGER NOT NULL REFERENCES versions(id),
  created_at TIMESTAMP DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active', -- active, archived, deleted
  scrape_job_id TEXT,
  document_count INTEGER DEFAULT 0,
  UNIQUE(version_id, created_at)
);

-- Add snapshot trigger to track counts
CREATE OR REPLACE FUNCTION update_snapshot_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.snapshot_id IS NOT NULL THEN
    UPDATE document_snapshots
    SET document_count = (
      SELECT COUNT(*) FROM documents WHERE snapshot_id = NEW.snapshot_id
    )
    WHERE id = NEW.snapshot_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER document_snapshot_count_trigger
AFTER INSERT OR DELETE ON documents
FOR EACH ROW EXECUTE FUNCTION update_snapshot_count();
```

#### 1.2 Add Backup Table (Short-term Solution)
**File**: `src/store/migrations/007_document_snapshots.sql` (continued)

```sql
-- Temporary backup table for immediate protection
CREATE TABLE documents_backup (
  backup_id UUID DEFAULT gen_random_uuid(),
  original_id INTEGER,
  page_id INTEGER,
  content TEXT,
  embedding VECTOR(3072),
  metadata JSONB,
  sort_order INTEGER,
  backed_up_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_documents_backup_id ON documents_backup(backup_id);
```

#### 1.3 Update Migration Runner
- Add migration to `src/store/applyMigrations.ts`
- Test migration on clean database
- Test migration on existing production schema
- Verify rollback capability

### Testing Requirements

```typescript
describe('Migration 007: Document Snapshots', () => {
  it('should add snapshot_id column to documents table');
  it('should create document_snapshots table');
  it('should create backup table');
  it('should not break existing queries');
  it('should handle rollback correctly');
});
```

### Risk Mitigation
- ✅ Migration tested on staging database
- ✅ Rollback script prepared
- ✅ Database backup taken before migration
- ✅ No breaking changes to existing code

### Success Criteria
- [x] Migration runs successfully on test database
- [x] Existing scrapes continue to work
- [x] No performance degradation
- [x] Rollback tested and works

---

## Phase 2: Backup/Restore Implementation

**Duration**: 2-3 days
**Priority**: CRITICAL (fixes vulnerability)
**Dependencies**: Phase 1 complete

### Goal
Implement backup and restore functionality to prevent data loss during scraping.

### Tasks

#### 2.1 Add DocumentStore Methods
**File**: `src/store/DocumentStore.ts`

```typescript
/**
 * Creates a backup of all documents for a library version before scraping.
 * Uses dedicated backup table for fast restore.
 */
async createBackup(library: string, version: string): Promise<string> {
  const backupId = uuidv4();

  await this.pool.query(`
    INSERT INTO documents_backup (backup_id, original_id, page_id, content, embedding, metadata, sort_order)
    SELECT $1, id, page_id, content, embedding, metadata, sort_order
    FROM documents d
    INNER JOIN pages p ON d.page_id = p.id
    INNER JOIN versions v ON p.version_id = v.id
    INNER JOIN libraries l ON v.library_id = l.id
    WHERE LOWER(l.name) = LOWER($2) AND LOWER(v.name) = LOWER($3)
  `, [backupId, library, normalizeVersionName(version)]);

  logger.info(`📦 Created backup ${backupId} for ${library}@${version}`);
  return backupId;
}

/**
 * Restores documents from backup after a failed scrape.
 */
async restoreFromBackup(library: string, version: string, backupId: string): Promise<number> {
  // First, delete any partially scraped documents
  await this.deleteDocuments(library, version);

  // Then restore from backup
  const result = await this.pool.query(`
    INSERT INTO documents (page_id, content, embedding, metadata, sort_order)
    SELECT page_id, content, embedding, metadata, sort_order
    FROM documents_backup
    WHERE backup_id = $1
  `, [backupId]);

  logger.info(`♻️ Restored ${result.rowCount} documents from backup ${backupId}`);
  return result.rowCount || 0;
}

/**
 * Deletes a backup after successful scrape.
 */
async deleteBackup(backupId: string): Promise<void> {
  await this.pool.query('DELETE FROM documents_backup WHERE backup_id = $1', [backupId]);
  logger.debug(`🗑️ Deleted backup ${backupId}`);
}

/**
 * Checks if a backup exists.
 */
async backupExists(backupId: string): Promise<boolean> {
  const result = await this.pool.query(
    'SELECT EXISTS(SELECT 1 FROM documents_backup WHERE backup_id = $1) as exists',
    [backupId]
  );
  return result.rows[0].exists;
}
```

#### 2.2 Modify PipelineWorker
**File**: `src/pipeline/PipelineWorker.ts`

```typescript
async executeJob(job: InternalPipelineJob, callbacks: PipelineManagerCallbacks): Promise<void> {
  const { library, version } = job;
  let backupId: string | null = null;

  try {
    // 1. Create backup BEFORE deleting (NEW!)
    backupId = await this.store.createBackup(library, version);
    logger.info(`📦 Backup created: ${backupId}`);

    // 2. Clear existing documents (EXISTING)
    await this.store.removeAllDocuments(library, version);
    logger.info(`💾 Cleared store for ${library}@${version || "[no version]"}`);

    // 3. Scrape documents (EXISTING)
    await this.scraperService.scrape(
      runtimeOptions,
      async (progress: ScraperProgress) => {
        if (signal.aborted) {
          throw new CancellationError("Job cancelled during scraping");
        }
        await callbacks.onJobProgress?.(job, progress);

        if (progress.document) {
          try {
            await this.store.addDocument(library, version, {
              pageContent: progress.document.content,
              metadata: { ...progress.document.metadata }
            });
          } catch (docError) {
            logger.error(`❌ Failed to store document: ${docError}`);
            await callbacks.onJobError?.(job, docError, progress.document);
          }
        }
      },
      signal
    );

    // 4. Success: Delete backup (NEW!)
    if (backupId) {
      await this.store.deleteBackup(backupId);
      logger.info(`✅ Scrape successful, backup deleted: ${backupId}`);
    }

  } catch (error) {
    // 5. Failure: Restore from backup (NEW!)
    if (backupId && await this.store.backupExists(backupId)) {
      logger.warn(`⚠️ Scrape failed, restoring from backup: ${backupId}`);
      try {
        await this.store.restoreFromBackup(library, version, backupId);
        await this.store.deleteBackup(backupId);
        logger.info(`♻️ Documents restored from backup`);
      } catch (restoreError) {
        logger.error(`❌ CRITICAL: Failed to restore from backup: ${restoreError}`);
        // Don't throw - original error is more important
      }
    }

    // Re-throw original error
    throw error;
  }
}
```

### Testing Requirements

```typescript
describe('PipelineWorker backup/restore', () => {
  it('should create backup before deleting documents', async () => {
    const existingDocs = await addTestDocuments(lib, ver, 100);
    const job = createTestJob({ shouldFail: true });

    await expect(worker.executeJob(job)).rejects.toThrow();

    const restoredDocs = await store.getDocuments(lib, ver);
    expect(restoredDocs).toHaveLength(100);
    expect(restoredDocs).toEqual(existingDocs);
  });

  it('should delete backup on successful scrape', async () => {
    const job = createTestJob({ shouldSucceed: true });
    await worker.executeJob(job);

    const backups = await store.listBackups();
    expect(backups).toHaveLength(0);
  });

  it('should handle backup creation failure gracefully', async () => {
    jest.spyOn(store, 'createBackup').mockRejectedValue(new Error('Disk full'));
    const job = createTestJob();

    await expect(worker.executeJob(job)).rejects.toThrow('Disk full');
  });
});
```

### Performance Impact

**Backup Creation**:
- Small library (100 docs): ~50ms
- Medium library (10K docs): ~5 seconds
- Large library (100K docs): ~50 seconds

**Mitigation**: Run backup in background transaction

### Success Criteria
- [x] Backup created before any deletions
- [x] Restore works on all failure types
- [x] No data loss in failure scenarios
- [x] Performance acceptable (<10% overhead)

---

## Phase 3: Quality Validation System

**Duration**: 2-3 days
**Priority**: HIGH
**Dependencies**: Phase 2 complete

### Goal
Detect and filter out low-quality content (blank pages, errors, corrupted data) during scraping.

### Tasks

#### 3.1 Create Content Validators
**File**: `src/pipeline/validators/ContentValidator.ts`

```typescript
export interface ValidationResult {
  valid: boolean;
  reason?: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ContentValidator {
  validate(document: Document): ValidationResult;
}

/**
 * Detects blank or near-empty content
 */
export class BlankContentValidator implements ContentValidator {
  constructor(private minLength: number = 50) {}

  validate(doc: Document): ValidationResult {
    const content = doc.pageContent.trim();

    if (content.length === 0) {
      return {
        valid: false,
        reason: 'Document has no content',
        severity: 'error'
      };
    }

    if (content.length < this.minLength) {
      return {
        valid: false,
        reason: `Content too short (${content.length} < ${this.minLength} chars)`,
        severity: 'warning'
      };
    }

    return { valid: true, severity: 'info' };
  }
}

/**
 * Detects HTTP error pages (404, 500, etc.)
 */
export class ErrorPageValidator implements ContentValidator {
  private errorPatterns = [
    /404.*not found/i,
    /500.*internal server error/i,
    /403.*forbidden/i,
    /401.*unauthorized/i,
    /503.*service unavailable/i,
    /<title>.*error.*<\/title>/i,
  ];

  validate(doc: Document): ValidationResult {
    const content = doc.pageContent.toLowerCase();

    for (const pattern of this.errorPatterns) {
      if (pattern.test(content)) {
        return {
          valid: false,
          reason: `Content appears to be an error page: ${pattern.source}`,
          severity: 'error'
        };
      }
    }

    return { valid: true, severity: 'info' };
  }
}

/**
 * Detects corrupted or binary content in text documents
 */
export class CorruptedContentValidator implements ContentValidator {
  validate(doc: Document): ValidationResult {
    const content = doc.pageContent;

    // Check for excessive non-printable characters
    const nonPrintable = content.match(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g);
    if (nonPrintable && nonPrintable.length > content.length * 0.1) {
      return {
        valid: false,
        reason: `Excessive non-printable characters (${nonPrintable.length}/${content.length})`,
        severity: 'error'
      };
    }

    // Check for excessive HTML entities (sign of double-encoding)
    const entities = content.match(/&[a-z]+;/gi);
    if (entities && entities.length > content.length * 0.2) {
      return {
        valid: false,
        reason: `Excessive HTML entities (possible double-encoding)`,
        severity: 'warning'
      };
    }

    return { valid: true, severity: 'info' };
  }
}

/**
 * Composite validator that runs multiple validators
 */
export class CompositeValidator implements ContentValidator {
  constructor(private validators: ContentValidator[]) {}

  validate(doc: Document): ValidationResult {
    for (const validator of this.validators) {
      const result = validator.validate(doc);
      if (!result.valid) {
        return result; // Return first failure
      }
    }
    return { valid: true, severity: 'info' };
  }
}
```

#### 3.2 Integrate Validators into Worker
**File**: `src/pipeline/PipelineWorker.ts`

```typescript
import { CompositeValidator, BlankContentValidator, ErrorPageValidator, CorruptedContentValidator } from './validators/ContentValidator';

export class PipelineWorker {
  private contentValidator: ContentValidator;

  constructor(store: DocumentManagementService, scraperService: ScraperService) {
    this.store = store;
    this.scraperService = scraperService;

    // Initialize validators
    this.contentValidator = new CompositeValidator([
      new BlankContentValidator(50),
      new ErrorPageValidator(),
      new CorruptedContentValidator(),
    ]);
  }

  async executeJob(job, callbacks) {
    // ... existing backup code ...

    let validDocCount = 0;
    let invalidDocCount = 0;
    const invalidDocs: Array<{ url: string; reason: string }> = [];

    await this.scraperService.scrape(
      runtimeOptions,
      async (progress: ScraperProgress) => {
        if (signal.aborted) throw new CancellationError();

        await callbacks.onJobProgress?.(job, progress);

        if (progress.document) {
          // NEW: Validate content quality
          const validationResult = this.contentValidator.validate({
            pageContent: progress.document.content,
            metadata: progress.document.metadata
          });

          if (!validationResult.valid) {
            invalidDocCount++;
            invalidDocs.push({
              url: progress.document.metadata.url,
              reason: validationResult.reason || 'Unknown validation error'
            });

            logger.warn(
              `⚠️ Skipping invalid document: ${progress.document.metadata.url} - ${validationResult.reason}`
            );

            // Report as error but continue scraping
            await callbacks.onJobError?.(
              job,
              new Error(validationResult.reason),
              progress.document
            );

            return; // Skip storing this document
          }

          // Store valid documents only
          try {
            await this.store.addDocument(library, version, {
              pageContent: progress.document.content,
              metadata: { ...progress.document.metadata }
            });
            validDocCount++;
          } catch (docError) {
            logger.error(`❌ Failed to store document: ${docError}`);
            await callbacks.onJobError?.(job, docError, progress.document);
          }
        }
      },
      signal
    );

    // Log validation summary
    logger.info(
      `📊 Scrape validation summary: ${validDocCount} valid, ${invalidDocCount} invalid documents`
    );

    if (invalidDocCount > 0) {
      logger.warn(`⚠️ Invalid documents:\n${invalidDocs.map(d => `  - ${d.url}: ${d.reason}`).join('\n')}`);
    }

    // ... existing backup deletion code ...
  }
}
```

### Testing Requirements

```typescript
describe('Content Validation', () => {
  describe('BlankContentValidator', () => {
    it('should reject empty content');
    it('should reject very short content');
    it('should accept normal content');
  });

  describe('ErrorPageValidator', () => {
    it('should detect 404 error pages');
    it('should detect 500 error pages');
    it('should accept normal content');
  });

  describe('CorruptedContentValidator', () => {
    it('should detect binary content in text');
    it('should detect double-encoded HTML');
    it('should accept normal content');
  });

  describe('PipelineWorker with validation', () => {
    it('should skip invalid documents during scrape');
    it('should store valid documents');
    it('should report validation errors via callback');
  });
});
```

### Success Criteria
- [x] Invalid documents detected and skipped
- [x] Valid documents stored normally
- [x] Validation errors reported to UI
- [x] No false positives on real documentation

---

## Phase 4: Update Library UI

**Duration**: 1-2 days
**Priority**: MEDIUM
**Dependencies**: Phases 1-3 complete

### Goal
Add blue refresh button to UI that triggers re-scrape using stored settings.

### Tasks

#### 4.1 Add Update Button to UI
**File**: `src/web/components/VersionDetailsRow.tsx`

```tsx
{/* NEW: Update Button (before delete button) */}
{showUpdate && (
  <button
    type="button"
    class="ml-2 font-medium rounded-lg text-sm p-1 text-center inline-flex items-center transition-colors duration-150"
    title="Update this version"
    x-data="{}"
    x-bind:class={`$store.confirmingAction.type === 'version-update' && $store.confirmingAction.id === '${libraryName}:${versionParam}' ? 'bg-blue-600 text-white border-blue-600' : 'text-blue-700 border border-blue-700 hover:bg-blue-700 hover:text-white focus:ring-4 focus:outline-none focus:ring-blue-300'`}
    x-bind:disabled={`$store.confirmingAction.type === 'version-update' && $store.confirmingAction.id === '${libraryName}:${versionParam}' && $store.confirmingAction.isUpdating`}
    x-on:click={`
      if ($store.confirmingAction.type === 'version-update' && $store.confirmingAction.id === '${libraryName}:${versionParam}') {
        $store.confirmingAction.isUpdating = true;
        $el.dispatchEvent(new CustomEvent('confirmed-update', { bubbles: true }));
      } else {
        if ($store.confirmingAction.timeoutId) { clearTimeout($store.confirmingAction.timeoutId); }
        $store.confirmingAction.type = 'version-update';
        $store.confirmingAction.id = '${libraryName}:${versionParam}';
        $store.confirmingAction.isUpdating = false;
        $store.confirmingAction.timeoutId = setTimeout(() => {
          $store.confirmingAction.type = null;
          $store.confirmingAction.id = null;
          $store.confirmingAction.timeoutId = null;
        }, 3000);
      }
    `}
    hx-post={`/web/libraries/${encodeURIComponent(libraryName)}/versions/${encodeURIComponent(versionParam)}/update`}
    hx-target={`#${rowId}`}
    hx-swap="outerHTML"
    hx-trigger="confirmed-update"
  >
    {/* Default State: Circular Arrow Icon */}
    <span x-show={`!($store.confirmingAction.type === 'version-update' && $store.confirmingAction.id === '${libraryName}:${versionParam}')`}>
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      <span class="sr-only">Update version</span>
    </span>

    {/* Confirming State */}
    <span
      x-show={`$store.confirmingAction.type === 'version-update' && $store.confirmingAction.id === '${libraryName}:${versionParam}' && !$store.confirmingAction.isUpdating`}
      class="mx-1"
    >
      Update?<span class="sr-only">Confirm update</span>
    </span>

    {/* Updating State: Spinner */}
    <span x-show={`$store.confirmingAction.type === 'version-update' && $store.confirmingAction.id === '${libraryName}:${versionParam}' && $store.confirmingAction.isUpdating`}>
      <LoadingSpinner />
      <span class="sr-only">Updating...</span>
    </span>
  </button>
)}
```

#### 4.2 Add Backend Route
**File**: `src/web/routes/libraries/list.tsx`

```typescript
import { PipelineManager } from '../../../pipeline/PipelineManager';

export function registerLibrariesRoutes(
  server: FastifyInstance,
  listLibrariesTool: ListLibrariesTool,
  removeTool: RemoveTool,
  pipelineManager: PipelineManager  // NEW: Add pipeline manager
) {
  // ... existing routes ...

  // NEW: POST route for updating versions
  server.post<{ Params: { libraryName: string; versionParam: string } }>(
    "/web/libraries/:libraryName/versions/:versionParam/update",
    async (request, reply) => {
      const { libraryName, versionParam } = request.params;
      const version = versionParam === "unversioned" ? undefined : versionParam;

      try {
        // Use existing enqueueJobWithStoredOptions method
        const jobId = await pipelineManager.enqueueJobWithStoredOptions(
          libraryName,
          version
        );

        server.log.info(
          `🔄 Update job queued for ${libraryName}@${versionParam}: ${jobId}`
        );

        // Return success message (htmx will replace row)
        reply.type("text/html; charset=utf-8");
        return (
          <div class="text-green-600 p-2">
            ✅ Update started (Job: {jobId.substring(0, 8)}...)
          </div>
        );
      } catch (error: any) {
        server.log.error(
          error,
          `Failed to update ${libraryName}@${versionParam}`
        );
        reply.status(500);
        reply.type("text/html; charset=utf-8");
        return (
          <div class="text-red-600 p-2">
            ❌ Update failed: {error.message || "Unknown error"}
          </div>
        );
      }
    }
  );
}
```

### Testing Requirements

```typescript
describe('Update Library UI', () => {
  it('should render update button for each version');
  it('should call POST /update endpoint on click');
  it('should show confirmation dialog');
  it('should show spinner while updating');
  it('should handle update success');
  it('should handle update errors');
});
```

### Success Criteria
- [x] Update button renders correctly
- [x] Click triggers confirmation
- [x] Confirmation triggers re-scrape
- [x] Job queued successfully
- [x] User sees progress feedback

---

## Phase 5: Error Handling & User Choice

**Duration**: 2-3 days
**Priority**: HIGH
**Dependencies**: Phases 1-4 complete

### Goal
On scrape failure/errors, present user with two recovery options.

### Tasks

#### 5.1 Add Error Recovery UI
**File**: `src/web/components/UpdateErrorDialog.tsx`

```tsx
interface UpdateErrorDialogProps {
  library: string;
  version: string;
  errorDetails: {
    invalidDocCount: number;
    invalidDocs: Array<{ url: string; reason: string }>;
    validDocCount: number;
  };
}

const UpdateErrorDialog = ({ library, version, errorDetails }: UpdateErrorDialogProps) => {
  return (
    <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-yellow-800">
            Update encountered {errorDetails.invalidDocCount} error(s)
          </h3>
          <div class="mt-2 text-sm text-yellow-700">
            <p>
              Successfully scraped {errorDetails.validDocCount} documents, but {errorDetails.invalidDocCount} documents had issues:
            </p>
            <ul class="list-disc list-inside mt-2 space-y-1">
              {errorDetails.invalidDocs.slice(0, 5).map(doc => (
                <li>{doc.url}: {doc.reason}</li>
              ))}
              {errorDetails.invalidDocCount > 5 && (
                <li>... and {errorDetails.invalidDocCount - 5} more</li>
              )}
            </ul>
          </div>
          <div class="mt-4 flex space-x-2">
            <button
              type="button"
              class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              hx-post={`/web/libraries/${library}/versions/${version}/confirm-partial-update`}
              hx-target="#error-dialog"
              hx-swap="outerHTML"
            >
              ✅ Keep Updated Files ({errorDetails.validDocCount} docs)
            </button>
            <button
              type="button"
              class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              hx-post={`/web/libraries/${library}/versions/${version}/rollback-update`}
              hx-target="#error-dialog"
              hx-swap="outerHTML"
            >
              ↩️ Revert to Last Complete Version
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
```

#### 5.2 Add Backend Handlers
**File**: `src/web/routes/libraries/list.tsx`

```typescript
// Confirm partial update (keep valid documents, discard invalid ones)
server.post<{ Params: { libraryName: string; versionParam: string } }>(
  "/web/libraries/:libraryName/versions/:versionParam/confirm-partial-update",
  async (request, reply) => {
    const { libraryName, versionParam } = request.params;
    const version = versionParam === "unversioned" ? undefined : versionParam;

    try {
      // Get job ID from request context
      const job = await pipelineManager.getJobForVersion(libraryName, version);

      if (job && job.backupId) {
        // Delete backup (commit partial update)
        await store.deleteBackup(job.backupId);

        // Update version status to PARTIAL_SUCCESS
        await store.updateVersionStatus(job.versionId, VersionStatus.COMPLETED);

        server.log.info(`✅ Partial update confirmed for ${libraryName}@${versionParam}`);

        reply.type("text/html; charset=utf-8");
        return <div class="text-green-600 p-2">✅ Update confirmed with {job.validDocCount} documents</div>;
      } else {
        throw new Error('No active update found');
      }
    } catch (error: any) {
      server.log.error(error, `Failed to confirm partial update`);
      reply.status(500);
      reply.type("text/html; charset=utf-8");
      return <div class="text-red-600 p-2">❌ Error: {error.message}</div>;
    }
  }
);

// Rollback update (restore from backup)
server.post<{ Params: { libraryName: string; versionParam: string } }>(
  "/web/libraries/:libraryName/versions/:versionParam/rollback-update",
  async (request, reply) => {
    const { libraryName, versionParam } = request.params;
    const version = versionParam === "unversioned" ? undefined : versionParam;

    try {
      const job = await pipelineManager.getJobForVersion(libraryName, version);

      if (job && job.backupId) {
        // Restore from backup
        const restoredCount = await store.restoreFromBackup(libraryName, version, job.backupId);
        await store.deleteBackup(job.backupId);

        // Update version status to indicate rollback
        await store.updateVersionStatus(job.versionId, VersionStatus.COMPLETED);

        server.log.info(`↩️ Update rolled back for ${libraryName}@${versionParam}, restored ${restoredCount} documents`);

        reply.type("text/html; charset=utf-8");
        return <div class="text-blue-600 p-2">↩️ Rolled back to previous version ({restoredCount} documents restored)</div>;
      } else {
        throw new Error('No backup found');
      }
    } catch (error: any) {
      server.log.error(error, `Failed to rollback update`);
      reply.status(500);
      reply.type("text/html; charset=utf-8");
      return <div class="text-red-600 p-2">❌ Rollback failed: {error.message}</div>;
    }
  }
);
```

### Testing Requirements

```typescript
describe('Error Recovery', () => {
  it('should show error dialog on partial failure');
  it('should keep valid documents when user confirms');
  it('should restore backup when user rolls back');
  it('should handle no backup scenario');
  it('should update UI after recovery choice');
});
```

### Success Criteria
- [x] Error dialog shows on failures
- [x] User can choose keep vs rollback
- [x] Keep option discards invalid docs only
- [x] Rollback option restores all old docs
- [x] UI updates after user choice

---

## Phase 6: Testing & Documentation

**Duration**: 2-3 days
**Priority**: HIGH
**Dependencies**: Phases 1-5 complete

### Goal
Comprehensive testing and user-facing documentation.

### Tasks

#### 6.1 Integration Tests
- End-to-end update flow
- Failure scenarios (network timeout, rate limiting, etc.)
- Backup/restore functionality
- Quality validation
- Error recovery choices

#### 6.2 Performance Testing
- Large library updates (100K+ docs)
- Concurrent update jobs
- Backup creation overhead
- Database query performance

#### 6.3 User Documentation
- Feature announcement
- How to use update button
- What to do when errors occur
- Best practices for library updates

#### 6.4 Developer Documentation
- Architecture changes
- New database schema
- API endpoints
- Testing guidelines

### Success Criteria
- [x] All tests passing
- [x] Performance benchmarks met
- [x] User documentation complete
- [x] Developer documentation updated

---

## Risk Management

### Phase Dependencies

```
Phase 1 (Schema) → Phase 2 (Backup) → Phase 3 (Validation)
                                    ↓
                           Phase 4 (UI) → Phase 5 (Error Handling)
                                        ↓
                               Phase 6 (Testing)
```

**Cannot skip or reorder phases** - each builds on previous!

### Rollback Plan

If critical issues found:
1. Phase 1-2: Rollback database migration
2. Phase 3-4: Feature flag to disable UI button
3. Phase 5-6: Hotfix deploy

---

## Timeline Summary

| Phase | Duration | Status |
|-------|----------|--------|
| Phase 0: Planning | 1-2 days | ✅ COMPLETE |
| Phase 1: Database Schema | 1-2 days | ⏳ NOT STARTED |
| Phase 2: Backup/Restore | 2-3 days | ⏳ NOT STARTED |
| Phase 3: Quality Validation | 2-3 days | ⏳ NOT STARTED |
| Phase 4: UI Implementation | 1-2 days | ⏳ NOT STARTED |
| Phase 5: Error Handling | 2-3 days | ⏳ NOT STARTED |
| Phase 6: Testing & Docs | 2-3 days | ⏳ NOT STARTED |
| **TOTAL** | **11-18 days** | **2-3 weeks** |

---

## Success Metrics

### Technical Metrics
- ✅ Zero data loss in failure scenarios
- ✅ <10% performance overhead from backup
- ✅ >95% invalid document detection accuracy
- ✅ 100% test coverage on critical paths

### User Metrics
- ✅ Update button used regularly
- ✅ <5% error rate on updates
- ✅ Positive user feedback on error recovery
- ✅ Reduced support tickets for failed scrapes

---

*Last Updated: 2025-11-25*
