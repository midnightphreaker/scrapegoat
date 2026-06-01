# Issue #12 — WebUI Local Documentation Upload: Code Audit Report

## Executive Summary

Issue #12 tracks the "WebUI local documentation upload" feature. Based on exhaustive code analysis, **the feature is partially implemented but fundamentally incomplete**. The upload staging UI and API exist, but **commit does NOT trigger any ingestion pipeline or scraping job**. Files sit in `/tmp/scrapegoat-upload/<sessionId>/` indefinitely after commit.

---

## Part 1: "Add New Documentation" Button Flow

### Button Component
**File**: `src/web/components/AddJobButton.tsx` (line 7-16)

```tsx
const AddJobButton = () => {
  return (
    <PrimaryButton
      hx-get="/web/jobs/new"
      hx-target="#addJobForm"
      hx-swap="innerHTML"
    >
      Add New Documentation
    </PrimaryButton>
  );
};
```

**Behavior**: On click, issues HTMX GET to `/web/jobs/new`, targets `#addJobForm` with innerHTML swap.

---

### Route: GET /web/jobs/new
**File**: `src/web/routes/jobs/new.tsx` (line 24-32)

```tsx
server.get("/web/jobs/new", async () => {
  return (
    <ScrapeForm
      defaultExcludePatterns={DEFAULT_EXCLUSION_PATTERNS}
      scraperConfig={scraperConfig}
    />
  );
});
```

Returns `<ScrapeForm>` wrapped in its own container. **ScrapeForm → ScrapeFormContent** with mode="new" (default), title "Add New Documentation".

---

### ScrapeFormContent Title
**File**: `src/web/components/ScrapeFormContent.tsx` (line 85)

```tsx
const title = isAddVersionMode ? "Add New Version" : "Add New Documentation";
```

---

### POST /web/jobs/scrape (the actual submission handler)
**File**: `src/web/routes/jobs/new.tsx` (line 40-187)

Key flow:
1. Validates `url` and `library` fields (required)
2. Normalizes version (treats "latest", empty, null as null → "latest")
3. Calls `scrapeTool.execute(scrapeOptions)` with `waitForCompletion: false`
4. On success → returns `AddJobButton` (collapses form)
5. On error → returns `<Alert>`

```tsx
const result = await scrapeTool.execute(scrapeOptions);

if ("jobId" in result) {
  // Success: Collapse form back to button and show toast via HX-Trigger
  reply.header("HX-Trigger", JSON.stringify({ toast: { message: `Indexing started for ${body.library}@${versionDisplay}`, type: "success" } }));
  return <AddJobButton />;
}
```

**ScrapeTool.execute** delegates to `pipeline.enqueueScrapeJob(...)` and returns `{ jobId }` immediately because `waitForCompletion: false`. The job enters the pipeline queue and gets processed asynchronously.

---

## Part 2: Upload-Related Frontend Files

### LocalUploadPanel Component
**File**: `src/web/components/upload/LocalUploadPanel.tsx`

**Purpose**: Upload local files/archives for documentation import. Uses HTMX + Alpine.js.

**Key Props**:
- `library: string`
- `version?: string`

**Key Alpine.js methods** (defined in `public/js/localUpload.js`):
- `init()` — creates upload session via `POST /web/upload/start`
- `handleFiles(fileList)` — uploads via `POST /web/upload/files?sessionId=...`
- `handleDrop(event)` — drag-and-drop handler
- `refreshTree()` — fetches import tree via `GET /web/upload/tree?sessionId=...`
- `startRename(node)` — renames via `POST /web/upload/tree/rename`
- `removeNode(node)` — deletes via `POST /web/upload/tree/delete`
- `commitImport()` — commits via `POST /web/upload/commit` — **THE CRITICAL CALL**
- `cancelImport()` — cancels via `POST /web/upload/cancel`

**UI Flow**:
1. Drop zone accepts: `.md,.markdown,.txt,.zip,.tar,.tar.gz,.tgz,.tar.bz2`
2. Shows upload progress bar (XMLHttpRequest onprogress)
3. Staged files count shown with "Review import tree" toggle
4. Import tree with file/folder icons, rename/delete actions
5. Stats grid: Files, Total Size, Folders
6. Two action buttons: **"Import Documentation"** (blue, primary), **"Cancel"** (gray)

---

### Alpine.js Component Script
**File**: `public/js/localUpload.js` (240 lines)

Loaded via `<script src="/js/localUpload.js">` in the upload page.

**commitImport()** implementation (line 170-206):
```javascript
async commitImport() {
  if (!this.sessionId) return;
  this.committing = true;
  try {
    const resp = await fetch("/web/upload/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: this.sessionId }),
    });
    if (resp.ok) {
      const result = await resp.json();
      document.dispatchEvent(new CustomEvent("toast", { detail: { message: `Successfully imported ${result.library}@${result.version}`, type: "success" } }));
      this.sessionId = null;
      this.stagedFiles = [];
      this.tree = null;
      // ... reset state
    }
  } finally {
    this.committing = false;
  }
}
```

---

### Upload Page Route
**File**: `src/web/routes/upload/page.tsx`

**Route**: `GET /web/upload?library=<name>&version=<ver>`

Renders `<Layout><LocalUploadPanel library={...} version={...} /></Layout>` plus loads the Alpine script.

---

## Part 3: Upload-Related Backend Files

### Upload Routes Registration
**File**: `src/web/routes/upload/index.ts` (338 lines)

#### POST /web/upload/start (line 65-82)
Creates a new upload session. Returns `{ sessionId, library, version }`.

```typescript
server.post("/web/upload/start", async (request, reply) => {
  const body = request.body as Record<string, string> | undefined;
  const library = body?.library?.trim();
  const version = body?.version?.trim();
  if (!library) return reply.code(400).send({ error: "library is required" });
  const session = await getStagingService().createSession(library, version || "latest");
  return { sessionId: session.id, library: session.library, version: session.version };
});
```

#### POST /web/upload/files (line 84-160)
Handles multipart file upload. Uses `ArchiveExtractor` for ZIP/TAR processing. For each file:
1. If archive buffer → extract to `__extract_<timestamp>/`, stage extracted files
2. If regular file → stage directly
3. Calls `service.stageFile(sessionId, fileName, content, fromArchive, archiveSource)`

#### GET /web/upload/tree (line 162-173)
Returns `{ sessionId, tree, stats }` for the import tree UI.

#### POST /web/upload/tree/rename (line 175-192)
Renames a file in the staging area.

#### POST /web/upload/tree/delete (line 194-209)
Removes a file from staging.

#### POST /web/upload/tree/move (line 211-231)
Moves a file within staging.

#### POST /web/upload/commit (line 233-257) — **THE CRITICAL ENDPOINT**
```typescript
server.post("/web/upload/commit", async (request, reply) => {
  const { sessionId } = request.body as Record<string, string>;
  if (!sessionId) return reply.code(400).send({ error: "sessionId is required" });
  const service = getStagingService();
  const session = service.getSession(sessionId);
  if (!session) return reply.code(404).send({ error: "Session not found" });
  try {
    await service.commitSession(sessionId);
    return { success: true, sessionId, library: session.library, version: session.version, stats: service.getSessionStats(sessionId), stagingPath: session.stagingPath };
  } catch (err) {
    return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) });
  }
});
```

#### POST /web/upload/cancel (line 259-267)
Cancels and cleans up session.

#### GET /web/upload/report/failed (line 269-292)
Returns text report of failed files.

#### GET /web/upload/report/renamed (line 294-319)
Returns text report of renamed files.

#### GET /web/upload/stats (line 321-337)
Returns session stats.

---

### UploadStagingService
**File**: `src/upload/UploadStagingService.ts` (441 lines)

**createSession(library, version)** (line 82-108):
```typescript
const stagingPath =
  this.config.stagingMode === "filesystem" && this.config.stagingPath
    ? path.resolve(this.config.stagingPath, id)
    : path.join(os.tmpdir(), "scrapegoat-upload", id);
await fs.mkdir(stagingPath, { recursive: true });
```
Session stored in memory Map. Files written to `stagingPath`.

**commitSession(sessionId)** (line 305-309):
```typescript
async commitSession(sessionId: UploadSessionId): Promise<void> {
  const session = this.requireActiveSession(sessionId);
  session.status = UploadSessionStatus.COMMITTED;  // ← JUST THIS
  session.updatedAt = new Date();
}
```

**CRITICAL**: `commitSession` only marks the session as COMMITTED. It does NOT:
- Start any pipeline job
- Create a scraping job
- Convert `file:///import/<lib>/<ver>/<path>` URIs into actual scraping tasks

---

### ImportTreeBuilder
**File**: `src/upload/ImportTreeBuilder.ts` (487 lines)

**generateSourceUri(library, version, relativePath)** (line 348-353):
```typescript
generateSourceUri(library: string, version: string, relativePath: string): string {
  const encodedLib = encodeURIComponent(library);
  const encodedVer = encodeURIComponent(version);
  const encodedPath = relativePath.split("/").map(encodeURIComponent).join("/");
  return `file:///import/${encodedLib}/${encodedVer}/${encodedPath}`;
}
```

This generates URIs like `file:///import/react/18.0.0/docs/api.md`, but **these URIs are never used anywhere**. The commit endpoint doesn't call this method or pass these URIs to any pipeline.

---

### Upload Types
**File**: `src/upload/types.ts` (132 lines)

**UploadSessionStatus enum**:
- `ACTIVE` — session in progress
- `COMMITTED` — user confirmed import
- `CANCELLED` — user cancelled
- `EXPIRED` — TTL expired

**StagedFile** interface includes `absolutePath: string` — the actual file path on disk.

**UploadConfig** defaults:
```typescript
stagingMode: "memory",  // os.tmpdir() based
maxTotalSizeBytes: 500MB,
maxFileSizeBytes: 100MB,
maxFiles: 10,000,
sessionTtlSeconds: 3600,
maxArchiveEntries: 50,000,
maxArchiveUncompressedBytes: 2GB
```

> **⚠️ Defaults Divergence**: The current `UploadConfig` defaults differ from the SPEC FR-3.6.2 target values:
> - `maxTotalSizeBytes`: 500MB (code) vs 999MB (SPEC)
> - `maxFiles`: 10,000 (code) vs 999 (SPEC)
> - `maxArchiveUncompressedBytes`: 2GB (code) vs 999MB (SPEC)
> - Missing config fields: `maxArchiveCompressedBytes`, `maxDepth`, `maxFilenameLength`, `maxPathLength`
> 
> The implementation plan includes a task to align these defaults.

---

## Part 4: "Add New Version" Flow

### Button Component
**File**: `src/web/components/AddVersionButton.tsx` (line 14-24)

```tsx
const AddVersionButton = ({ libraryName }: AddVersionButtonProps) => {
  return (
    <PrimaryButton
      hx-get={`/web/libraries/${encodeURIComponent(libraryName)}/add-version-form`}
      hx-target="#add-version-form-container"
      hx-swap="innerHTML"
    >
      Add New Version
    </PrimaryButton>
  );
};
```

**Route**: `GET /web/libraries/:libraryName/add-version-form`

---

### Add Version Form Handler
**File**: `src/web/routes/libraries/detail.tsx` (line 208-299)

Pre-fills form with latest version's scraper options (URL, maxPages, maxDepth, scope, includePatterns, excludePatterns, scrapeMode, headers, followRedirects, ignoreErrors).

Returns `<ScrapeFormContent initialValues={initialValues} mode="add-version" />`.

---

### ScrapeFormContent with mode="add-version"
**File**: `src/web/components/ScrapeFormContent.tsx` (line 45, 85)

- Title becomes "Add New Version" instead of "Add New Documentation"
- `library` field is **hidden** (pre-filled, shown as text) — not editable
- Close button targets `#add-version-form-container` with HTMX
- Form submits to `POST /web/jobs/scrape` with `formMode: "add-version"` hidden field

---

### On Submit (POST /web/jobs/scrape)
**File**: `src/web/routes/jobs/new.tsx` (line 153-157)

```typescript
if (body.formMode === "add-version") {
  return <AddVersionButton libraryName={body.library} />;
}
return <AddJobButton />;
```

**Uses the same ScrapeTool pipeline as "Add New Documentation"**. Both flows create a scrape job for a URL.

---

## Part 5: What Happens AFTER Commit

### The Critical Gap

**There is NO connection between commit and any ingestion pipeline.**

Evidence:

1. **`/web/upload/commit` endpoint** (line 234-257 in `src/web/routes/upload/index.ts`):
   - Only calls `service.commitSession(sessionId)` which sets status to COMMITTED
   - Returns `{ success: true, sessionId, library, version, stats, stagingPath }`
   - **Does NOT call ScrapeTool, does NOT enqueue any job, does NOT create any scrape pipeline**

2. **`UploadStagingService.commitSession()`** (line 305-309):
   ```typescript
   async commitSession(sessionId: UploadSessionId): Promise<void> {
     const session = this.requireActiveSession(sessionId);
     session.status = UploadSessionStatus.COMMITTED;  // JUST THIS
     session.updatedAt = new Date();
   }
   ```

3. **`ImportTreeBuilder.generateSourceUri()`** (line 348-353):
   - Generates `file:///import/<lib>/<ver>/<path>` URIs
   - **But this method is NEVER CALLED in the commit flow**
   - The commit endpoint doesn't call it, and no pipeline job references these URIs

4. **ScrapeTool** (line 86-178 in `src/tools/ScrapeTool.ts`):
   - Expects a `url` parameter (web URL or `file://` path)
   - But the upload commit never calls ScrapeTool

5. **PipelineManager.enqueueScrapeJob()** (line 213 in `src/pipeline/PipelineManager.ts`):
   - Takes `url: string` as the first property of options
   - Upload commit has `stagingPath` but doesn't use it to create any scrape job

### What the commit response looks like

After `POST /web/upload/commit`, the frontend receives:
```json
{
  "success": true,
  "sessionId": "upl_<uuid>",
  "library": "react",
  "version": "18.0.0",
  "stats": { "totalFiles": 5, "totalSize": 102400, "failedFiles": 0, "renamedFiles": 0 },
  "stagingPath": "/tmp/scrapegoat-upload/upl_<uuid>"
}
```

The staging path contains the uploaded files at `stagingPath/<relativePath>`. But this path is never used to start any scraping or ingestion.

### How a normal scrape job works (for comparison)

A normal scrape via `AddJobButton` → `POST /web/jobs/scrape`:
1. `ScrapeTool.execute()` is called with URL
2. `ScrapeTool` calls `pipeline.enqueueScrapeJob(library, version, { url, ... })`
3. `PipelineManager` creates a job with `sourceUrl: options.url`
4. `PipelineWorker` runs `ScraperService.scrape()` which creates a strategy based on the URL protocol

For local files via `file://` URL, the `FileScraperStrategy` would be used (if it exists and handles `file://` URLs). The `BaseScraperStrategy` has `internalAllowedFileRoots` but this is not connected to upload staging paths.

### Conclusion on Part 5

**The commit endpoint marks the session as COMMITTED and returns success, but nothing else happens.** The files remain in the staging directory (`/tmp/scrapegoat-upload/<sessionId>/`). No pipeline job is created. No documents are ingested. The `file:///import/<lib>/<ver>/<path>` URIs exist conceptually but are never used as scrape sources.

---

## Part 6: Staging Modes and Configuration

### Staging Configuration
**File**: `src/web/routes/upload/index.ts` (line 29-51)

```typescript
function getStagingService(): UploadStagingService {
  const config: Partial<UploadConfig> = {
    stagingMode:
      (process.env.SCRAPEGOAT_WEBUI_IMPORT_STAGING_MODE as "memory" | "filesystem") ??
      "memory",
    stagingPath: process.env.SCRAPEGOAT_WEBUI_IMPORT_STAGING_INTERNAL_PATH,
    maxTotalSizeBytes: process.env.SCRAPEGOAT_WEBUI_IMPORT_MAX_TOTAL_SIZE_BYTES
      ? Number.parseInt(process.env.SCRAPEGOAT_WEBUI_IMPORT_MAX_TOTAL_SIZE_BYTES, 10)
      : undefined,
    maxFileSizeBytes: process.env.SCRAPEGOAT_WEBUI_IMPORT_MAX_FILE_SIZE_BYTES
      ? Number.parseInt(process.env.SCRAPEGOAT_WEBUI_IMPORT_MAX_FILE_SIZE_BYTES, 10)
      : undefined,
    maxFiles: process.env.SCRAPEGOAT_WEBUI_IMPORT_MAX_FILES
      ? Number.parseInt(process.env.SCRAPEGOAT_WEBUI_IMPORT_MAX_FILES, 10)
      : undefined,
    sessionTtlSeconds: process.env.SCRAPEGOAT_WEBUI_IMPORT_SESSION_TTL_SECONDS
      ? Number.parseInt(process.env.SCRAPEGOAT_WEBUI_IMPORT_SESSION_TTL_SECONDS, 10)
      : undefined,
  };
  stagingService = new UploadStagingService(config);
}
```

### Supported Environment Variables
| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SCRAPEGOAT_WEBUI_IMPORT_STAGING_MODE` | `"memory"` \| `"filesystem"` | `"memory"` | Where to store staged files |
| `SCRAPEGOAT_WEBUI_IMPORT_STAGING_INTERNAL_PATH` | string | undefined | Base path for filesystem staging |
| `SCRAPEGOAT_WEBUI_IMPORT_MAX_TOTAL_SIZE_BYTES` | number | 500MB | Max total upload size |
| `SCRAPEGOAT_WEBUI_IMPORT_MAX_FILE_SIZE_BYTES` | number | 100MB | Max single file size |
| `SCRAPEGOAT_WEBUI_IMPORT_MAX_FILES` | number | 10,000 | Max files per session |
| `SCRAPEGOAT_WEBUI_IMPORT_SESSION_TTL_SECONDS` | number | 3600 | Session expiry time |

### StagingMode: memory vs filesystem

**memory mode** (default): Files stored in `os.tmpdir()/scrapegoat-upload/<sessionId>/` = `/tmp/scrapegoat-upload/<sessionId>/`

**filesystem mode**: Requires `SCRAPEGOAT_WEBUI_IMPORT_STAGING_INTERNAL_PATH` to be set. Files stored at `<stagingPath>/<sessionId>/`

### Implementation Status of Staging

The staging infrastructure is **fully implemented and operational**:
- Session creation/destruction ✅
- File staging with size limits ✅
- Archive extraction (ZIP/TAR handling) ✅
- Import tree management (rename/delete/move) ✅
- Session commit ✅
- Session cancellation with cleanup ✅
- TTL-based cleanup timer ✅

### What is NOT implemented

- **No ingestion pipeline trigger on commit**
- **No conversion of stagingPath files to scrapeable content**
- **No file:///import/<lib>/<ver>/<path> URI generation and usage**
- **No integration with ScrapeTool**
- **No library/version database creation for uploaded content**
- **No page tracking for uploaded files**

---

## Issue #12: Complete Gap Analysis

### What EXISTS:
1. Upload UI panel with drag-drop ✅
2. Upload API endpoints (start, files, tree, rename, delete, move, commit, cancel) ✅
3. Session staging in temp directory ✅
4. Archive extraction (ZIP/TAR) ✅ (but not audited for event-loop blocking on large files)
5. Import tree with rename/delete/move ✅
6. Commit endpoint that marks session COMMITTED ✅

### What IS MISSING:

1. **After commit, no scraping job is created**
   - `commitSession()` only changes status to COMMITTED
   - No call to `ScrapeTool`, no `pipeline.enqueueScrapeJob()`, no job creation

2. **Uploaded files are not connected to any pipeline**
   - Files sit in `/tmp/scrapegoat-upload/<sessionId>/` after commit
   - No mechanism to convert them into scrapeable content

3. **The `file:///import/<lib>/<ver>/<path>` URI scheme is defined but unused**
   - `ImportTreeBuilder.generateSourceUri()` exists
   - No code calls this method
   - The URL scheme is never passed to any scraper

4. **No library/version entry is created in database**
   - `UploadStagingService` doesn't interact with `DocumentManagementService`
   - No `libraries` or `versions` records created for upload sessions

5. **No "Add New Version" for local upload exists**
   - `AddVersionButton` → `ScrapeFormContent` with mode="add-version" → `POST /web/jobs/scrape`
   - This creates a scrape job for a URL, but there's no equivalent path for local files
   - There's no route to show upload UI pre-filled for an existing library version

6. **The upload page requires manual navigation**
   - Can't add local upload to a library's version from library detail page
   - No "Upload" button on library detail alongside "Add New Version"
   - User must navigate to `/web/upload?library=<name>&version=<ver>` manually

7. **Nested archive rejection is defined but never enforced**
   - `ArchiveExtractor.isNestedArchive()` method exists (line 144 in `src/upload/ArchiveExtractor.ts`)
   - **This method is never called anywhere in the codebase**
   - The issue requires nested archives to be rejected and reported in the failed files report
   - Implementation must wire `isNestedArchive()` into the extraction flow

---

## Key Files Summary

| File | Purpose | Status |
|------|---------|--------|
| `src/web/components/AddJobButton.tsx` | "Add New Documentation" button | ✅ Working |
| `src/web/components/AddVersionButton.tsx` | "Add New Version" button | ✅ Working |
| `src/web/components/ScrapeFormContent.tsx` | Scraping form (new + add-version) | ✅ Working |
| `src/web/routes/jobs/new.tsx` | /web/jobs/new and /web/jobs/scrape | ✅ Working |
| `src/web/routes/libraries/detail.tsx` | Library detail + add-version form | ✅ Working |
| `src/web/routes/upload/index.ts` | All upload API endpoints | ✅ Working (API only) |
| `src/web/routes/upload/page.tsx` | GET /web/upload | ✅ Working |
| `src/web/components/upload/LocalUploadPanel.tsx` | Upload UI panel | ✅ Working |
| `public/js/localUpload.js` | Alpine.js localUpload component | ✅ Working |
| `src/upload/UploadStagingService.ts` | Session and file staging | ✅ Working |
| `src/upload/ImportTreeBuilder.ts` | Import tree + URI generation | ⚠️ URI generation unused |
| `src/upload/types.ts` | Upload type definitions | ✅ Working |
| `src/upload/ArchiveExtractor.ts` | Archive extraction | ✅ Working (⚠️ `isNestedArchive()` is dead code; large archive sync I/O not audited) |
| `src/tools/ScrapeTool.ts` | Scrape job enqueueing | ✅ Working (for URL scraping) |
| `src/pipeline/PipelineManager.ts` | Job queue management | ✅ Working (for URL scraping) |

---

## Cross-Reference: Issue Requirements vs. Implementation Status

### Issue Requirement: Source Selection Modal

**Issue says** (lines 78-84): When user clicks **Add New Documentation**, a centered modal titled "Documentation Source Selection" should appear with two options:
1. **Remote URL** — preserves existing ingestion behavior
2. **Local Documentation** — opens local upload panel

**Current implementation**: No such modal exists. Clicking "Add New Documentation" directly shows the URL ingestion form (`ScrapeFormContent` with title "Add New Documentation"). There is no source selection step.

**Gap**: A source-selection modal must be implemented between `AddJobButton` click and form display.

---

### Issue Requirement: Local Upload Panel

**Issue says** (lines 115-119): Selecting "Local Documentation" should open a panel titled "Add Local Documentation Source" with file/folder/archive upload and an editable import tree.

**Current implementation**: 
- `LocalUploadPanel` component exists at `src/web/components/upload/LocalUploadPanel.tsx`
- Accessible via `GET /web/upload?library=<name>&version=<ver>`
- Title is "Upload Documentation Files" (not "Add Local Documentation Source")
- Supports file/folder/archive upload, import tree display, rename/delete
- Alpine.js component in `public/js/localUpload.js` provides all interactivity

**Gap**: 
- The upload panel is not accessible from the "Add New Documentation" flow — users must manually navigate to `/web/upload?library=<name>&version=<ver>`
- There's no way to add local upload to an existing library from the library detail page
- No "Add New Version" equivalent for local upload exists

---

### Issue Requirement: Source Paths from WebUI Import Tree

**Issue says** (lines 134-152): The WebUI import tree must define canonical source paths passed to the ingestion engine. Users can rename/move/delete files/folders before submission. At submit time, the backend must normalize the final WebUI tree into the import source layout.

**Current implementation**:
- `ImportTreeBuilder.generateSourceUri()` (line 348-353 in `src/upload/ImportTreeBuilder.ts`) generates `file:///import/<library>/<version>/<path>` URIs
- `UploadStagingService.commitSession()` only marks session as COMMITTED — does not call `generateSourceUri()` or pass these URIs anywhere

**Gap**: The URI generation function exists but is never invoked. No mechanism converts the final import tree into source metadata for ingestion.

---

### Issue Requirement: Commit Triggers Ingestion Pipeline

**Issue says** (lines 1657-1688, step 18): Backend creates an ingestion job using existing pipeline semantics. Existing ingestion/vectorization pipeline processes the normalized files.

**Current implementation**: `POST /web/upload/commit` (line 234-257 in `src/web/routes/upload/index.ts`) returns success but does not:
- Create any pipeline job
- Call `ScrapeTool.execute()`
- Call `pipeline.enqueueScrapeJob()`
- Interact with `DocumentManagementService`

**Gap**: Commit is a no-op with respect to document ingestion. Files remain in staging indefinitely after commit.

---

### Issue Requirement: Duplicate Library/Version Detection

**Issue says** (lines 1198-1223): Duplicate library name/version combinations must be rejected before ingestion starts.

**Current implementation**: None. `UploadStagingService` has no database interaction. `commitSession` does not check for existing libraries/versions.

**Gap**: No duplicate detection exists. Uploading a library/version that already exists will not be prevented.

---

### Issue Requirement: Library Name + Version Fields in Upload UI

**Issue says** (lines 366-368): Required metadata fields are Library Name and Version.

**Current implementation**: 
- `LocalUploadPanel` accepts `library` and `version` props
- Upload page route (`src/web/routes/upload/page.tsx`) reads from query params
- But there's no editable library name/version field in the panel itself — these are passed as URL params, not user-editable fields

**Gap**: Users cannot specify or edit library name and version in the upload UI — these must come from URL query params.

---

### Issue Requirement: "Add New Version" for Local Upload

**Issue says**: User should be able to upload a new version for an existing library from the library detail page.

**Current implementation**: Library detail page has "Add New Version" button that opens `ScrapeFormContent` with mode="add-version". This only supports URL-based scraping, not local file upload.

**Gap**: No "Upload Version" or "Add Local Version" equivalent exists on the library detail page.

---

### Issue Requirement: Staging Mode Configuration

**Issue says** (lines 777-895): Must support memory and filesystem staging modes with specific environment variables.

**Current implementation**:
- `SCRAPEGOAT_WEBUI_IMPORT_STAGING_MODE` ✅ (line 32-34)
- `SCRAPEGOAT_WEBUI_IMPORT_STAGING_INTERNAL_PATH` ✅ (line 35)
- `SCRAPEGOAT_WEBUI_IMPORT_MAX_TOTAL_SIZE_BYTES` ✅ (line 36-38)
- `SCRAPEGOAT_WEBUI_IMPORT_MAX_FILE_SIZE_BYTES` ✅ (line 39-41)
- `SCRAPEGOAT_WEBUI_IMPORT_MAX_FILES` ✅ (line 42-44)
- `SCRAPEGOAT_WEBUI_IMPORT_SESSION_TTL_SECONDS` ✅ (line 45-47)

**Gap**: None — staging config is fully implemented. But the staging is only used for the upload session management, not for feeding files into the ingestion pipeline.

---

### Issue Requirement: Cleanup After Ingestion

**Issue says** (lines 939, 1843-1852): Uploaded files are deleted after successful ingestion. Temporary files are deleted after failed ingestion or cancellation.

**Current implementation**: `UploadStagingService.cancelSession()` removes staging directory. `destroySession()` also cleans up. But `commitSession()` does NOT trigger cleanup — only marks as COMMITTED.

**Gap**: Files are never cleaned up after "successful" ingestion because no ingestion occurs. Cleanup would need to happen as part of the (non-existent) post-ingestion flow.

---

## Required Implementation for Issue #12

To fully implement Issue #12, the following changes are required:

### 1. Source Selection Modal (High Priority)
Add a modal that appears when clicking "Add New Documentation" with two options:
- **Remote URL** → shows existing `ScrapeFormContent`
- **Local Documentation** → navigates to `/web/upload?library=<name>&version=<ver>`

Implementation locations:
- New component: `src/web/components/SourceSelectionModal.tsx`
- Modify `AddJobButton` or its container to show modal first
- Or add a new route `/web/jobs/new` that shows modal with two buttons

### 2. Upload UI Library/Version Fields (High Priority)
The `LocalUploadPanel` must allow users to enter/edit library name and version, not just receive them as props.

Implementation:
- Add editable `library` and `version` input fields to `LocalUploadPanel`
- Modify upload page route to accept these as form fields, not just query params
- Or redesign `LocalUploadPanel` to be self-contained with form fields

### 3. Commit-to-Pipeline Bridge (Critical Missing Piece)
`POST /web/upload/commit` must trigger the ingestion pipeline:

```typescript
// In src/web/routes/upload/index.ts commit handler:
async commitImport() {
  // After marking session as COMMITTED:
  
  // 1. Get all staged files from session
  const files = Array.from(session.files.values());
  
  // 2. Build a "virtual scrape" job that uses file:///import/... URIs
  //    OR directly invoke the document processing pipeline
  //    OR call a new ImportJobTool that creates library/version records
  
  // 3. For each staged file, convert to source URI:
  for (const file of files) {
    const sourceUri = importTreeBuilder.generateSourceUri(
      session.library,
      session.version,
      file.relativePath
    );
    // Queue file for processing
  }
  
  // 4. After processing, clean up staging directory
}
```

The key question is whether to:
- **Option A**: Create a `ScrapeJob` with `file:///import/<lib>/<ver>/<path>` URLs and let the existing scraper strategies handle `file://` protocol
- **Option B**: Create a new `ImportJobTool`/`LocalUploadTool` that processes staged files directly without going through the URL-based scraper
- **Option C**: Add a new `LocalScraperStrategy` that handles `file:///import/...` URIs and reads from staging directory

Option A would integrate most cleanly with existing pipeline but requires a scraper strategy that understands the staging path. Option B is simpler but introduces a parallel code path. Option C is cleanest architecturally but requires the most new code.

> **⚠️ Strategy Ordering Warning**: `LocalFileStrategy` already handles `file://` URLs (confirmed in `src/scraper/strategies/LocalFileStrategy.ts`). If Option A or C is chosen, the strategy resolver MUST check `LocalImportStrategy` (for `file:///import/...`) BEFORE `LocalFileStrategy` (for `file://...`). Without this ordering, `file:///import/...` URLs would be routed to the wrong strategy.

### 4. Library/Version Database Creation
When a local upload is committed, the system must:
1. Create a `libraries` record (if not exists)
2. Create a `versions` record
3. Store scraper options in `scraper_options` table
4. Create `pages` records for each uploaded file
5. Create `documents` records with correct source metadata

This mirrors what `ScrapeTool.execute()` does through the pipeline, but for locally-uploaded files instead of URL-based scraping.

### 5. Duplicate Library/Version Detection
Before committing an upload, check if the library name + version combination already exists. If so, show an error asking user to use a different version.

### 6. "Add Version" Upload Path
Add an "Upload Documentation" button alongside "Add New Version" on the library detail page that opens the upload UI pre-filled with the library name.

### 7. Post-Ingestion Cleanup
After a local upload job completes successfully, clean up the staging directory. This requires hook into the job completion event or polling.

### 8. Source Path Preview UI
Show users the final source path that will be used for a selected file, formatted as `<library> <version> > <path>` before they submit. This helps users understand that their tree edits affect retrieval metadata.

---

## Implementation Complexity Assessment

| Component | Complexity | Notes |
|-----------|------------|-------|
| Source selection modal | Medium | New component, existing button flow modification |
| Library/Version form fields in upload | Medium | Modify LocalUploadPanel to be self-contained |
| Commit-to-pipeline bridge | **High** | Core architectural change — needs careful design |
| Library/Version DB creation | High | Must mirror existing scrape job DB writes |
| Duplicate detection | Low | Simple DB lookup before commit |
| Add Version upload path | Medium | New route + button on library detail |
| Post-ingestion cleanup | Medium | Event hook or completion polling |
| Source path preview | Low | UI change to show final path |

---

## Files That Need Changes (Summary)

| File | Change |
|------|--------|
| `src/web/components/AddJobButton.tsx` | May need modification for modal flow |
| `src/web/routes/jobs/new.tsx` | May become source-selection entry point |
| `src/web/components/upload/LocalUploadPanel.tsx` | Add editable library/version fields |
| `src/web/routes/upload/index.ts` | Add commit-to-pipeline bridge in `POST /web/upload/commit` |
| `src/web/routes/upload/page.tsx` | Support post-submission library creation |
| `src/upload/UploadStagingService.ts` | Add method to get all files as source URIs |
| `src/upload/ImportTreeBuilder.ts` | `generateSourceUri` must be called during commit |
| New: `src/tools/ImportTool.ts` | New tool to process committed upload sessions |
| New: `src/pipeline/strategies/LocalScraperStrategy.ts` | Strategy for `file:///import/...` URIs (or reuse existing) |
| `src/web/routes/libraries/detail.tsx` | Add "Upload Version" button |