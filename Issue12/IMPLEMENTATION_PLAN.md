# Issue #12 — WebUI Local Documentation Upload: Implementation Plan

## Overview

This plan breaks the implementation into 5 phases, ordered by dependency. Each phase produces a testable increment. Phases must be completed in order.

---

## Phase 1: Source Selection Modal

**Goal**: The "Add New Documentation" button opens a modal offering Remote URL or Local Documentation choices.

**Why first**: This is the primary UX change and the gateway to all other features. It also renames the existing form, which is a low-risk change.

### Tasks

#### 1.1 Create SourceSelectionModal component
- **File**: `src/web/components/SourceSelectionModal.tsx` (NEW)
- **What**: TSX component rendering a centered modal with:
  - Title: "Documentation Source Selection"
  - Subtitle: "Choose where your documentation source is located."
  - Two cards: "Remote URL" and "Local Documentation"
  - Remote URL card: description "Use this for websites and remote documents accessible via HTTP/HTTPS.", HTMX `hx-get="/web/jobs/new"` targeting `#addJobForm`
  - Local Documentation card: description "Upload documents, folders, or archives from your current device.", HTMX `hx-get="/web/upload"` targeting `#addJobForm`
  - Cancel button: closes modal
- **Style**: TailwindCSS. Modal centered with backdrop. Cards with hover effects. Follow existing component patterns (check how other modals/overlays work in the codebase).

#### 1.2 Create source-selection route
- **File**: `src/web/routes/jobs/source-selection.tsx` (NEW)
- **What**: Fastify route handler returning `<SourceSelectionModal />` HTML via HTMX
- **Route**: `GET /web/jobs/source-selection`

#### 1.3 Register route in web server
- **File**: `src/web/web.ts` or wherever routes are registered
- **What**: Import and register the source-selection route

#### 1.4 Modify AddJobButton
- **File**: `src/web/components/AddJobButton.tsx`
- **What**: Change `hx-get` from `/web/jobs/new` to `/web/jobs/source-selection`

#### 1.5 Rename ScrapeFormContent titles
- **File**: `src/web/components/ScrapeFormContent.tsx`
- **What**: 
  - Change "Add New Documentation" to "Add Remote Documentation Source"
  - Change "Add New Version" to "Add Remote Documentation Version"

### Verification
1. `npm run build` passes
2. `npm run typecheck` passes
3. `npm run lint` passes
4. Open WebUI → Click "Add New Documentation" → Modal appears with two choices
5. Click "Remote URL" → Existing form appears with new title
6. Click Cancel → Modal closes

### Estimated complexity: Medium

---

## Phase 2: LocalUploadPanel Enhancements

**Goal**: Upload panel has editable library/version fields, folder upload, virtual folders, move action, source path preview, and confirmation dialog.

**Why second**: These are frontend-only changes that don't depend on the pipeline integration. They improve the upload panel to match issue requirements.

### Tasks

#### 2.1 Add Library Name and Version fields to panel
- **File**: `src/web/components/upload/LocalUploadPanel.tsx`
- **What**: Add input fields for Library Name (required) and Version (optional, default "latest") at the top of the panel. These should be editable by default. If the panel receives library/version from URL params, pre-fill them.
- **File**: `public/js/localUpload.js`
- **What**: Bind Alpine.js data properties for `library` and `version` fields. Pass these to `createSession()` call.

#### 2.2 Change panel title
- **File**: `src/web/components/upload/LocalUploadPanel.tsx`
- **What**: Change "Upload Documentation Files" to "Add Local Documentation Source"

#### 2.3 Align UploadConfig defaults with SPEC limits
- **File**: `src/upload/types.ts`
- **What**: Update `UploadConfig` defaults to match SPEC FR-3.6.2:
  - `maxTotalSizeBytes`: 500MB → 999MB
  - `maxFiles`: 10,000 → 999
  - `maxArchiveUncompressedBytes`: 2GB → 999MB
  - Add new fields: `maxArchiveCompressedBytes` (default 500MB), `maxDepth` (default 9), `maxFilenameLength` (default 99), `maxPathLength` (default 255)
- **File**: `src/upload/UploadStagingService.ts`
- **What**: Apply the new limits in validation logic. Add depth, filename length, and path length checks during file staging.
- **File**: `src/web/routes/upload/index.ts`
- **What**: Wire the new environment variables for the added config fields.

#### 2.4 Wire nested archive rejection
- **File**: `src/upload/ArchiveExtractor.ts`
- **What**: Ensure `isNestedArchive()` is called during extraction. When a nested archive is detected, add a `FailedFileEntry` with reason "Nested archives are not supported" and skip extraction. Use `detectArchiveType()` magic bytes (not just file extension) to identify archive file types.
- **File**: `src/upload/UploadStagingService.ts`
- **What**: In the file staging flow, check the `fromArchive` flag. If the file being staged is itself an archive and it came from inside another archive, reject it and record as a failed file.

#### 2.5 Add "Add Folder" button
- **File**: `src/web/components/upload/LocalUploadPanel.tsx`
- **What**: Add button with hidden `<input type="file" webkitdirectory>` for folder selection
- **File**: `public/js/localUpload.js`
- **What**: Add `handleFolderSelect(event)` method that reads files from the directory input and uploads them

#### 2.6 Add "Add Virtual Folder" button
- **File**: `src/web/components/upload/LocalUploadPanel.tsx`
- **What**: Add button that prompts for folder name
- **File**: `public/js/localUpload.js`
- **What**: Add `createVirtualFolder()` method that sends request to backend to create empty folder node
- **File**: `src/upload/UploadStagingService.ts`
- **What**: Add `createVirtualFolder(sessionId, folderPath)` method that creates an empty directory in the staging area

#### 2.7 Add "Move" action to import tree
- **File**: `src/web/components/upload/LocalUploadPanel.tsx`
- **What**: Add "Move" button next to rename/delete in tree node actions
- **File**: `public/js/localUpload.js`
- **What**: Add `moveNode(node)` method that prompts for target folder, then calls `POST /web/upload/tree/move`

#### 2.8 Add source path preview
- **File**: `src/web/components/upload/LocalUploadPanel.tsx`
- **What**: Add a section below the import tree that shows the source path for the selected file: `<library> <version> > <relative-path>`
- **File**: `public/js/localUpload.js`
- **What**: Track `selectedNode` in Alpine data, compute display path

#### 2.9 Add confirmation dialog before commit
- **File**: `public/js/localUpload.js`
- **What**: In `commitImport()`, add `window.confirm()` dialog before the POST. Message: "Submit this import tree? The current file/folder structure will define the retrieval source paths for all imported documents."
- **What**: If user cancels, abort the commit
- **What**: Rename the "Import Documentation" button text to "Accept & Submit" in `LocalUploadPanel.tsx`

#### 2.10 Add report download prompts after commit
- **File**: `public/js/localUpload.js`
- **What**: After successful commit, check if `result.failedFiles > 0` or `result.renamedFiles > 0`. If so, prompt download via `window.confirm()` then trigger download of report from `/web/upload/report/failed` or `/web/upload/report/renamed`.

### Verification
1. Build and typecheck pass
2. Open upload panel → Library Name and Version fields are visible and editable
3. "Add Folder" button opens folder picker
4. "Add Virtual Folder" button prompts for name and creates empty folder
5. "Move" action works on tree nodes
6. Selecting a file shows source path preview
7. "Accept & Submit" shows confirmation dialog
8. After commit with renamed files, report download is prompted
9. Archive file type validation uses `detectArchiveType()` magic bytes (not just extension)
10. Report endpoints `/web/upload/report/failed` and `/web/upload/report/renamed` produce output matching SPEC FR-3.10.3 (each file listed with original path and reason/new name)

### Estimated complexity: Medium

---

## Phase 3: Commit-to-Pipeline Bridge (Critical)

**Goal**: Committing an upload session creates a real pipeline ingestion job that processes the staged files and stores them in the database.

**Why third**: This is the most critical piece — it connects the upload UI to the actual document processing. It depends on having the upload panel working (Phase 2) but is independent of the source selection modal (Phase 1).

### Tasks

#### 3.1 Create LocalImportStrategy
- **File**: `src/scraper/strategies/LocalImportStrategy.ts` (NEW)
- **What**:
  - `canHandle(url)`: returns true for `file:///import/` URLs
  - `scrapePage(url, options)`: reads a single file from staging directory, returns ScrapedPage
  - `scrapeSite(url, options)`: async generator yielding all files in the staging directory as ScrapedPages
  - Path resolution: maps `file:///import/<lib>/<ver>/<path>` → `<stagingPath>/<path>`
  - Security: validate resolved path stays within staging directory (reuse `ensureWithinBase`)
  - Supports `.md`, `.markdown`, `.txt` files
  - Skips unsupported files (similar to web scraper behavior)

#### 3.2 Register strategy in ScraperService (with ordering)
- **File**: `src/scraper/ScraperService.ts` (or wherever strategy resolution happens)
- **What**: Add `LocalImportStrategy` to the strategy resolver for `file:///import/` URLs
- **CRITICAL**: `LocalImportStrategy` MUST be checked BEFORE `LocalFileStrategy` in the resolver. Since `file:///import/` is a subset of `file://`, both strategies match. The more specific prefix must be checked first.
- **Test**: Add unit test confirming `file:///import/...` resolves to `LocalImportStrategy`, not `LocalFileStrategy`

#### 3.3 Add staging path to ScraperOptions
- **File**: `src/scraper/types.ts`
- **What**: Add optional `localImportStagingPath?: string` to ScraperOptions

#### 3.4 Rewrite commit endpoint
- **File**: `src/web/routes/upload/index.ts`
- **What**: Replace the current `POST /web/upload/commit` handler with:
  1. Validate session exists and is ACTIVE
  2. Check for duplicate library/version (query DocumentManagementService)
  3. If duplicate, return 409 with error message
  4. Mark session as COMMITTED
  5. Generate source URL: `file:///import/<library>/<version>/`
  6. Get pipeline reference (from app context or service locator)
  7. Call `pipeline.enqueueScrapeJob(library, version, { url: sourceUrl, localImportStagingPath: session.stagingPath })`
  8. Register EventBus listener for job completion to clean up staging directory
  9. Return `{ success: true, library, version, jobId }`

#### 3.5 Inject pipeline and doc service into upload routes
- **File**: `src/web/routes/upload/index.ts`
- **What**: The upload routes currently don't have access to `PipelineManager` or `DocumentManagementService`. These need to be injected via the route plugin registration or a service locator pattern used elsewhere in the codebase.

#### 3.6 Add cleanup on job completion
- **File**: `src/web/routes/upload/index.ts` (or new file)
- **What**: On `JOB_STATUS_CHANGE` event for the upload's job ID:
  - If status is "completed": remove staging directory
  - If status is "failed": keep staging directory, schedule TTL-based cleanup
  - If status is "cancelled": remove staging directory immediately

#### 3.7 Add duplicate detection method
- **File**: `src/store/DocumentManagementService.ts` or `src/store/DocumentStore.ts`
- **What**: Add `versionExists(library: string, version: string): Promise<boolean>` method

### Verification
1. Build, typecheck, lint pass
2. Write unit tests for LocalImportStrategy (reading from temp directory)
3. Start server with Docker PostgreSQL
4. Upload files via WebUI → commit → verify pipeline job is created
5. Wait for job completion → verify documents appear in database
6. Search for uploaded content → verify results with correct source URIs
7. Verify staging directory is cleaned up after completion
8. Try uploading duplicate library/version → verify 409 error

### Estimated complexity: High

---

## Phase 4: Library Detail Integration

**Goal**: Users can upload a new version for an existing library from the library detail page.

**Why fourth**: Depends on Phases 2 and 3 being complete.

### Tasks

#### 4.1 Add "Upload Version" button to library detail
- **File**: `src/web/routes/libraries/detail.tsx`
- **What**: Add a new button alongside "Add New Version" that links to `/web/upload?library=<name>`

#### 4.2 Create UploadVersionButton component
- **File**: `src/web/components/UploadVersionButton.tsx` (NEW)
- **What**: Similar to `AddVersionButton` but uses `hx-get` to `/web/upload?library=<name>` targeting `#add-version-form-container`

### Verification
1. Navigate to library detail page
2. "Upload Version" button appears alongside "Add New Version"
3. Clicking it opens upload panel with library name pre-filled
4. Upload and commit works for the new version

### Estimated complexity: Low

---

## Phase 5: Docker-Based Testing

**Goal**: Comprehensive testing of the entire local upload feature in a Docker environment, as required by the issue.

**Why last**: Requires all previous phases to be complete.

### Tasks

#### 5.0 Docker volume mount configuration
- **What**: Document the required Docker volume mount for filesystem staging mode:
  - Volume: `<host-path>:/data/staging`
  - Env: `SCRAPEGOAT_WEBUI_IMPORT_STAGING_MODE=filesystem`
  - Env: `SCRAPEGOAT_WEBUI_IMPORT_STAGING_INTERNAL_PATH=/data/staging`
- **File**: Update `docker-compose.yml` and `docker-compose.postgres.yml` with optional staging volume mount (commented out by default)
- **File**: Update `README.md` with Docker volume mount instructions for local upload

#### 5.1 Create Docker test script
- **File**: `test/local-upload-e2e.test.ts` (NEW)
- **What**: E2E test that:
  - Starts PostgreSQL container with randomized credentials
  - Starts ScrapeGoat container from built image
  - Uses randomized ports and container names
  - Tests the complete upload flow:
    1. Open WebUI
    2. Click "Add New Documentation" → verify modal appears
    3. Select "Local Documentation" → verify upload panel opens
    4. Enter library name and version
    5. Upload a test file via API
    6. Verify import tree is correct
    7. Commit → verify job is created
    8. Wait for job completion
    9. Search → verify results
  - Tests duplicate detection
  - Tests cancel flow
  - Cleans up all Docker resources (trap EXIT)

#### 5.2 Test both staging modes
- Run tests with `SCRAPEGOAT_WEBUI_IMPORT_STAGING_MODE=memory`
- Run tests with `SCRAPEGOAT_WEBUI_IMPORT_STAGING_MODE=filesystem`

#### 5.3 Browser validation
- Use `stealth-browser-mcp` to visually verify:
  - Source selection modal renders correctly
  - Upload panel has all required controls
  - Confirmation dialog appears before submission
  - Post-submission reports are offered

### Verification
1. All E2E tests pass in Docker
2. Both staging modes tested
3. Browser screenshots confirm UX matches issue requirements
4. All Docker resources cleaned up

### Estimated complexity: Medium

---

## File Change Summary

### New Files (5)
| File | Phase |
|------|-------|
| `src/web/components/SourceSelectionModal.tsx` | 1 |
| `src/web/routes/jobs/source-selection.tsx` | 1 |
| `src/scraper/strategies/LocalImportStrategy.ts` | 3 |
| `src/web/components/UploadVersionButton.tsx` | 4 |
| `test/local-upload-e2e.test.ts` | 5 |

### Modified Files (12)
| File | Phase | Change |
|------|-------|--------|
| `src/web/components/AddJobButton.tsx` | 1 | Change hx-get target |
| `src/web/components/ScrapeFormContent.tsx` | 1 | Rename title |
| `src/web/web.ts` | 1 | Register source-selection route |
| `src/web/components/upload/LocalUploadPanel.tsx` | 2 | Title, library/version fields, folder/virtual folder/move buttons, source path preview |
| `src/upload/types.ts` | 2 | Align defaults with SPEC, add missing config fields |
| `public/js/localUpload.js` | 2 | Folder upload, virtual folder, move, source path, confirmation, reports |
| `src/upload/UploadStagingService.ts` | 2,3 | Virtual folder method, file enumeration for pipeline |
| `src/scraper/types.ts` | 3 | Add staging path to ScraperOptions |
| `src/scraper/ScraperService.ts` | 3 | Register LocalImportStrategy |
| `src/web/routes/upload/index.ts` | 3 | Rewrite commit with pipeline bridge |
| `src/store/DocumentManagementService.ts` | 3 | Add versionExists() method |
| `src/web/routes/libraries/detail.tsx` | 4 | Add upload version button |

---

## Dependency Graph

```
Phase 1: Source Selection Modal ──────────────────────────────┐
                                                               │
Phase 2: LocalUploadPanel Enhancements ─────────────────────┤
                                                               │
Phase 3: Commit-to-Pipeline Bridge ─────── (depends on 2) ──┤
                                                               │
Phase 4: Library Detail Integration ────── (depends on 3) ──┤
                                                               │
Phase 5: Docker-Based Testing ──────────── (depends on 1-4) ─┘
```

Phases 1 and 2 are independent and can be worked on in parallel.

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Pipeline integration breaks existing scraping | Phase 3 adds new strategy, doesn't modify existing ones. Strategy resolver only activates for `file:///import/` URLs. |
| Staging directory path resolution is insecure | Reuse `ensureWithinBase()` from `src/upload/security.ts`. Add tests for path traversal attempts. |
| Large uploads exhaust disk space | Upload limits already enforced. TTL-based cleanup for abandoned sessions. |
| Source URIs expose internal paths | `LocalImportStrategy` generates only `file:///import/<lib>/<ver>/<path>` URIs. Staging path is never stored in DB. |
| Docker volume mount issues with filesystem staging | Document required volume mounts. Test both modes in Phase 5. |
| Strategy resolver ordering conflict | `LocalImportStrategy` checked before `LocalFileStrategy` for `file:///import/` URLs. Unit test verifies ordering. |
| Nested archives not rejected | Wire existing `isNestedArchive()` into extraction flow. Add to Phase 2 tasks. |
| Archive extraction blocks event loop | Audit `ArchiveExtractor` for sync I/O. Use streaming extraction for large archives (>10MB). |
| SPEC limit defaults misaligned with code | Phase 2 Task 2.3 aligns `UploadConfig` defaults with SPEC FR-3.6.2 values. |

---

## Testing Strategy

### Unit Tests
- `LocalImportStrategy`: reading from temp directory, path resolution, security validation
- `UploadStagingService.commitSession()`: state transitions
- `DocumentManagementService.versionExists()`: duplicate detection
- Source selection modal rendering

### Integration Tests
- Upload → commit → pipeline job created
- Duplicate detection → 409 error
- Cancel → staging directory cleaned

### E2E Tests (Docker)
- Full flow: modal → upload → commit → search
- Both staging modes
- Archive extraction
- Import tree operations
- Report downloads

### Browser Tests
- Source selection modal UX
- Upload panel controls
- Confirmation dialog
- Post-commit behavior
