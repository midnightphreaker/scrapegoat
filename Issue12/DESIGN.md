# Issue #12 — WebUI Local Documentation Upload: Technical Design

## 1. Architecture Overview

The local upload system extends ScrapeGoat's existing architecture with three new integration points:

1. **Source Selection Modal** — new frontend component between AddJobButton and form rendering
2. **Commit-to-Pipeline Bridge** — connects upload commit endpoint to the existing pipeline
3. **Local Scraper Strategy** — new scraper strategy for reading staged files

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   WebUI      │     │  Upload Staging   │     │  Existing Pipeline   │
│              │     │                   │     │                     │
│ AddJobButton │────►│ Source Selection  │     │ PipelineManager     │
│       │      │     │     Modal         │     │       │             │
│       ▼      │     │  ┌─────┐ ┌──────┐│     │       ▼             │
│  Modal opens │     │  │Remote│ │Local ││     │  PipelineWorker     │
│              │     │  │ URL  │ │ Docs ││     │       │             │
│              │     │  └──┬──┘ └──┬───┘│     │       ▼             │
│              │     │     │       │    │     │  ScraperService     │
│              │     │     ▼       ▼    │     │    ┌──────────┐    │
│              │     │  ScrapeForm  Local│     │    │Strategy  │    │
│              │     │  (existing) Upload│     │    │Resolver  │    │
│              │     │              Panel│     │    └────┬─────┘    │
│              │     │                │  │     │   ┌─────┼─────┐   │
│              │     │          Commit │  │     │   ▼     ▼     ▼   │
│              │     │                ▼  │     │  Web  Local  File  │
│              │     │  POST /web/upload │     │  Strat Strat Strat │
│              │     │     /commit      │     │     │     │        │
│              │     │        │         │     │     ▼     ▼        │
│              │     │        ▼         │     │  Process docs       │
│              │     │  Enqueue ScrapeJob│────►│  Chunk + Embed     │
│              │     │  with file:// URL │     │  Store in DB       │
│              │     │                   │     │                     │
└─────────────┘     └──────────────────┘     └─────────────────────┘
```

---

## 2. Component Design

### 2.1 Source Selection Modal

**Component**: New `src/web/components/SourceSelectionModal.tsx`

**Rendering approach**: The modal will be an HTMX response from a new route. When AddJobButton is clicked, it requests the modal content via HTMX, which renders in a designated target container.

**Design**:
- Route: `GET /web/jobs/source-selection` returns modal HTML
- `AddJobButton` changes `hx-get` from `/web/jobs/new` to `/web/jobs/source-selection`
- Modal contains two cards/buttons: Remote URL and Local Documentation
- Clicking Remote URL: HTMX GET to `/web/jobs/new` → returns ScrapeForm into modal body (or replaces modal)
- Clicking Local Documentation: HTMX GET to `/web/upload?library=&version=` → returns upload panel into modal body (or navigates)
- Cancel: closes modal via HTMX `hx-swap="none"` with a response that removes the modal

**Key consideration**: The upload panel is a full page component. Two approaches:
- **Option A (Recommended)**: Modal acts as a router — selecting an option closes the modal and loads the chosen form into the existing `#addJobForm` target. This keeps the existing HTMX swap pattern.
- **Option B**: Modal body swaps to show either ScrapeForm or LocalUploadPanel. More complex but keeps everything in one modal.

**Choosing Option A** because it preserves the existing HTMX pattern and requires minimal changes to existing components.

### 2.2 LocalUploadPanel Enhancements

**Component**: Existing `src/web/components/upload/LocalUploadPanel.tsx`

**Changes needed**:
1. **Title**: Change from "Upload Documentation Files" to "Add Local Documentation Source"
2. **Library/Version fields**: Add editable input fields at the top of the panel (currently passed as URL params only)
3. **Add Folder button**: Add button using `<input webkitdirectory>` for folder selection
4. **Add Virtual Folder button**: Add button that prompts for folder name and creates empty node in tree
5. **Move action**: Add move UI (select target folder via dropdown or drag-drop)
6. **Source path preview**: Add display area showing `library version > path` for selected file
7. **Confirmation dialog**: Add JS confirmation before commit with warning about source paths
8. **Report prompts**: After commit, check for failed/renamed files and prompt downloads

### 2.3 Commit-to-Pipeline Bridge

**This is the critical missing piece.** The design connects `POST /web/upload/commit` to the existing `PipelineManager.enqueueScrapeJob()`.

**Flow**:
```
1. User clicks "Accept & Submit"
2. Browser shows confirmation dialog
3. POST /web/upload/commit with { sessionId }
4. Backend:
   a. Validate session exists and is ACTIVE
   b. Check for duplicate library/version in DB
   c. Mark session as COMMITTED
   d. Generate staging URL: file:///import/<library>/<version>/
      This URL points to the session's staging directory
   e. Call pipeline.enqueueScrapeJob(library, version, {
        url: stagingUrl,
        sourceType: "local-upload",
        stagingPath: session.stagingPath,
        ...scraperOptions
      })
   f. Return { success: true, jobId: ... }
5. Browser shows toast with job ID
6. Pipeline processes the job asynchronously
7. On job completion, cleanup hook removes staging directory
```

**Why this works with the existing pipeline**:
- `PipelineManager.enqueueScrapeJob()` already accepts arbitrary `ScraperOptions` including `url`
- The pipeline already has a strategy resolver that picks the right scraper based on URL protocol
- We add a new `LocalImportStrategy` that handles `file:///import/` URLs
- The strategy reads from the staging directory and produces documents

### 2.4 LocalImportStrategy

**New file**: `src/scraper/strategies/LocalImportStrategy.ts`

**Purpose**: Reads files from the upload staging directory and produces scraped pages.

**Design**:
```typescript
class LocalImportStrategy implements ScraperStrategy {
  canHandle(url: string): boolean {
    return url.startsWith("file:///import/");
  }

  async scrapePage(url: string, options): Promise<ScrapedPage> {
    // 1. Parse the URL to extract library, version, and file path
    // 2. Resolve the file path within the staging directory
    // 3. Read the file content
    // 4. Return ScrapedPage with:
    //    - url: file:///import/<library>/<version>/<path>
    //    - content: file content
    //    - title: filename or first heading
    //    - metadata: { source: "local-upload", library, version }
    // 5. Discover other files in the staging directory as links
  }

  async *scrapeSite(url, options): AsyncGenerator<ScrapedPage> {
    // Yield all files in the staging directory
    // Walk the directory tree and scrape each file
  }
}
```

**Key design decisions**:
- Uses the staging directory as the "site root"
- Produces canonical `file:///import/<lib>/<ver>/<path>` source URIs
- Supports `.md`, `.markdown`, `.txt` file types (same as web scraping)
- Respects the import tree structure (post-user-editing)
- Uses the same content pipeline (markdown parsing, chunking) as web scraping

**Alternative considered**: Extend `LocalFileStrategy` instead of creating a new strategy. Rejected because `LocalFileStrategy` is designed for nested file references within web scraping, not for standalone local import workflows.

### 2.5 Strategy Registration and Ordering

The strategy resolver must be updated to recognize `file:///import/` URLs and route them to `LocalImportStrategy`.

**File**: `src/scraper/ScraperService.ts` or strategy resolver

**Critical ordering requirement**: `LocalImportStrategy` MUST be checked BEFORE `LocalFileStrategy` in the strategy resolver. Since `file:///import/` is a subset of `file://`, both strategies would match `file:///import/...` URLs. The resolver must check the more specific `file:///import/` prefix first:

```typescript
// Order matters — check LocalImport BEFORE LocalFile
if (url.startsWith("file:///import/")) {
  return new LocalImportStrategy(stagingRootPath);
}
if (url.startsWith("file://")) {
  return new LocalFileStrategy();
}
```

This ordering must be verified with a unit test that confirms `file:///import/...` URLs resolve to `LocalImportStrategy`, not `LocalFileStrategy`.

### 2.6 Staging Directory as Scrape Source

**Design**: The upload staging directory (`/tmp/scrapegoat-upload/<sessionId>/`) becomes the scrape source root.

When the pipeline worker processes the job:
1. It receives `url: file:///import/<library>/<version>/` and `stagingPath: /tmp/scrapegoat-upload/<sessionId>/`
2. `LocalImportStrategy` maps `file:///import/<library>/<version>/<path>` to `<stagingPath>/<path>`
3. It walks the directory tree, reading each file
4. Each file becomes a `ScrapedPage` with the canonical source URI
5. The existing document processing pipeline (chunking, embedding, storage) handles the rest

**Security**: Path resolution must validate that resolved paths stay within the staging directory. Reuse `ensureWithinBase()` from `src/upload/security.ts`.

### 2.7 Post-Ingestion Cleanup

**Design**: Register a job completion callback that cleans up the staging directory.

**Option A**: Extend `PipelineManager` with a `onJobComplete` hook that fires when a local-import job finishes.

**Option B (Recommended)**: In the commit endpoint, after enqueuing the job, register a listener on the EventBus for `JOB_STATUS_CHANGE` events for that job ID. When the job reaches `completed` or `failed` status:
- If `completed`: remove the staging directory
- If `failed`: keep the staging directory for debugging, but schedule TTL-based cleanup

This avoids modifying `PipelineManager` internals.

### 2.8 Non-Blocking Operations

**Archive extraction**: For archives exceeding 10MB, extraction MUST use async I/O to avoid blocking the Node.js event loop. The existing `ArchiveExtractor` should be audited for synchronous operations and updated to use streaming extraction where feasible.

**Session cleanup**: Cleanup of expired or completed sessions MUST be non-blocking. The existing TTL-based cleanup timer already runs asynchronously. The EventBus-based post-ingestion cleanup (§2.7) must also be asynchronous and must not hold locks on the session store during file system operations.

### 2.9 Duplicate Detection

**Design**: Before enqueuing the pipeline job, query `DocumentManagementService` for the library+version.

```typescript
// In commit handler:
const existing = await docService.findVersion(library, version);
if (existing) {
  return reply.code(409).send({ 
    error: "Library/version already exists",
    library, 
    version 
  });
}
```

This happens in the commit endpoint, before `commitSession()` and before `enqueueScrapeJob()`.

### 2.10 Library Detail Integration

**Design**: Add an "Upload Version" button next to "Add New Version" on the library detail page.

**File**: `src/web/routes/libraries/detail.tsx`

```tsx
<UploadVersionButton libraryName={library.name} />
```

This button links to `/web/upload?library=<name>&version=` (version empty for user to fill in).

The existing `AddVersionButton` continues to work for URL-based versions.

---

## 3. Data Flow

### 3.1 Local Upload Data Flow

```
User clicks "Add New Documentation"
       │
       ▼
GET /web/jobs/source-selection  →  Source Selection Modal
       │
       ├── "Remote URL"  ──►  GET /web/jobs/new  →  ScrapeForm (existing)
       │
       └── "Local Docs"  ──►  GET /web/upload?library=&version=
                                       │
                                       ▼
                               LocalUploadPanel
                                       │
                              User uploads files
                                       │
                              Files staged in /tmp/scrapegoat-upload/<sessionId>/
                                       │
                              User edits tree (rename/move/delete)
                                       │
                              User clicks "Accept & Submit"
                                       │
                              Confirmation dialog
                                       │
                              POST /web/upload/commit
                                       │
                              ┌────────────────────────────────┐
                              │ 1. Validate session            │
                              │ 2. Check duplicate lib/version  │
                              │ 3. commitSession(sessionId)     │
                              │ 4. enqueueScrapeJob(            │
                              │      library, version,          │
                              │      { url: file:///import/...  │
                              │        stagingPath: /tmp/... }  │
                              │    )                            │
                              │ 5. Register cleanup listener    │
                              │ 6. Return { jobId }             │
                              └────────────────────────────────┘
                                       │
                                       ▼
                              PipelineManager processes job
                                       │
                                       ▼
                              LocalImportStrategy reads files
                                       │
                                       ▼
                              Documents chunked, embedded, stored
                                       │
                                       ▼
                              Job completes → cleanup staging dir
```

### 3.2 Source URI Format

```
Staging directory: /tmp/scrapegoat-upload/upl_abc123/
  ├── getting-started/
  │   ├── installation.md
  │   └── quick-start.md
  └── api/
      └── reference.md

Library: "mydocs", Version: "1.0"

Resulting source URIs in database:
  file:///import/mydocs/1.0/getting-started/installation.md
  file:///import/mydocs/1.0/getting-started/quick-start.md
  file:///import/mydocs/1.0/api/reference.md

Display format in search results:
  mydocs 1.0 > getting-started/installation.md
  mydocs 1.0 > getting-started/quick-start.md
  mydocs 1.0 > api/reference.md
```

---

## 4. API Design

### 4.1 New Routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/web/jobs/source-selection` | Returns source selection modal HTML |

### 4.2 Modified Routes

| Method | Path | Change |
|--------|------|--------|
| GET | `/web/jobs/new` | No change (called from modal for Remote URL) |
| POST | `/web/upload/commit` | Add pipeline integration, duplicate check |
| GET | `/web/upload` | Support self-contained mode with library/version fields |

### 4.3 Modified Commit Endpoint

**Before**:
```typescript
POST /web/upload/commit
  → commitSession(sessionId)
  → return { success: true, library, version, stats, stagingPath }
```

**After**:
```typescript
POST /web/upload/commit
  → validate session (ACTIVE status)
  → check duplicate library/version in DB
  → commitSession(sessionId)
  → generate file:///import/<lib>/<ver>/ URL
  → pipeline.enqueueScrapeJob(library, version, {
      url: generatedUrl,
      localImportStagingPath: session.stagingPath,
      maxPages: session.files.size,
      maxDepth: 9,
    })
  → register cleanup on job completion
  → return { success: true, library, version, jobId }
```

---

## 5. Frontend Component Tree

```
AddJobButton
  └── hx-get="/web/jobs/source-selection"
      └── SourceSelectionModal
          ├── Title: "Documentation Source Selection"
          ├── Subtitle: "Choose where your documentation source is located."
          ├── Option 1: Remote URL card
          │   └── hx-get="/web/jobs/new" → ScrapeFormContent
          │       └── Title: "Add Remote Documentation Source"
          ├── Option 2: Local Documentation card
          │   └── hx-get="/web/upload" → LocalUploadPanel
          │       └── Title: "Add Local Documentation Source"
          │       ├── Library Name input (required)
          │       ├── Version input (optional, default "latest")
          │       ├── Drop zone
          │       ├── Add File / Add Folder / Add Virtual Folder buttons
          │       ├── Import tree (editable)
          │       │   ├── File/folder icons
          │       │   ├── Rename / Move / Delete actions
          │       │   └── Source path preview for selected item
          │       ├── Stats: files, size, folders
          │       ├── Accept & Submit button (with confirmation dialog)
          │       └── Cancel button
          └── Cancel button
```

---

## 6. New Files

| File | Purpose |
|------|---------|
| `src/web/components/SourceSelectionModal.tsx` | Modal component for source selection |
| `src/web/routes/jobs/source-selection.tsx` | Route handler returning modal HTML |
| `src/scraper/strategies/LocalImportStrategy.ts` | Scraper strategy for staged local files |

---

## 7. Modified Files

| File | Change |
|------|--------|
| `src/web/components/AddJobButton.tsx` | Change hx-get to `/web/jobs/source-selection` |
| `src/web/components/ScrapeFormContent.tsx` | Update title to "Add Remote Documentation Source" |
| `src/web/components/upload/LocalUploadPanel.tsx` | Add library/version fields, folder upload, virtual folders, move, source path preview, confirmation |
| `public/js/localUpload.js` | Add folder upload handler, virtual folder creation, move UI, confirmation dialog, report download prompts |
| `src/web/routes/upload/index.ts` | Rewrite commit endpoint with pipeline integration and duplicate detection |
| `src/web/routes/libraries/detail.tsx` | Add upload version button |
| `src/web/web.ts` | Register source-selection route |
| `src/scraper/ScraperService.ts` | Register LocalImportStrategy for file:///import/ URLs |
| `src/upload/UploadStagingService.ts` | Add method to enumerate files with source URIs |
| `src/scraper/types.ts` | Add `localImportStagingPath` field to ScraperOptions |
| `src/store/DocumentManagementService.ts` | Add `versionExists(library, version)` method for duplicate detection |

---

## 8. Design Decisions

### D-1: Pipeline Integration via ScrapeJob
**Decision**: Use existing `pipeline.enqueueScrapeJob()` with a `file:///import/` URL instead of creating a parallel import path.
**Rationale**: The issue explicitly requires "existing pipeline semantics." This reuses job queuing, status tracking, version management, document processing, embedding, and storage without duplication.

### D-2: New Strategy vs Extended LocalFileStrategy
**Decision**: Create a new `LocalImportStrategy` rather than extending `LocalFileStrategy`.
**Rationale**: `LocalFileStrategy` handles nested file:// references within web scraping. Local import has different semantics (directory walking, source URI generation, import tree structure). Separation of concerns is cleaner.

### D-3: Source Selection as Modal Router
**Decision**: The modal acts as a router, loading either Remote URL form or Local Documentation panel into the existing page target.
**Rationale**: Preserves the existing HTMX swap pattern. Minimal changes to existing components. The modal is a lightweight routing layer.

### D-4: Staging Directory as Scrape Source
**Decision**: The staging directory IS the scrape source. No file copying or transformation before pipeline processing.
**Rationale**: Avoids duplication of potentially large files. The import tree edits are already reflected in the staging directory (rename/move/delete operations modify the actual files).

### D-5: Cleanup via EventBus
**Decision**: Register job completion listener via EventBus instead of extending PipelineManager.
**Rationale**: Avoids modifying pipeline internals. EventBus already emits `JOB_STATUS_CHANGE` events. Cleanup logic stays in the upload module where it belongs.

### D-6: Library/Version Fields in Upload Panel
**Decision**: Make library name and version editable fields in the upload panel, not just URL parameters.
**Rationale**: The upload panel may be accessed from different entry points (global "Add New" button, library detail "Upload Version"). Self-contained fields are more robust than requiring URL params.
