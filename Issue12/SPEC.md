# Issue #12 — WebUI Local Documentation Upload: Specification

## 1. Overview

ScrapeGoat currently only supports adding documentation via remote URL scraping. Users cannot upload local files, folders, or archives through the WebUI. This issue tracks the implementation of a complete browser-based local documentation upload system that integrates with the existing ingestion pipeline.

**Issue URL**: https://git.phrk.org/pub/scrapegoat/issues/12
**State**: Open
**Author**: Midnight Phreaker (mp)

---

## 2. User Stories

### US-1: Source Selection
As a user, when I click "Add New Documentation", I want to choose between a Remote URL or Local Documentation so I can import docs from either source.

### US-2: Remote URL Ingestion (existing)
As a user choosing Remote URL, I want to enter a URL and library name so that ScrapeGoat scrapes and indexes the remote documentation (existing behavior, preserved).

### US-3: Local File Upload
As a user choosing Local Documentation, I want to upload files, folders, or archives from my device so that ScrapeGoat ingests and indexes my local documentation.

### US-4: Import Tree Editing
As a user uploading local documentation, I want to preview and edit the import tree (rename, move, delete files/folders) before submission so that the final source paths match my desired structure.

### US-5: Version Management
As a user viewing an existing library, I want to add a new version via local upload so that I can maintain multiple versions of my documentation.

### US-6: Source Path Transparency
As a user submitting local documentation, I want to see the final source path for each file before submission so that I understand how my files will be referenced in search results.

---

## 3. Functional Requirements

### 3.1 Source Selection Modal

**FR-3.1.1**: Clicking "Add New Documentation" MUST open a centered modal titled "Documentation Source Selection".

**FR-3.1.2**: The modal MUST block background page interaction while open.

**FR-3.1.3**: The modal MUST offer exactly two choices:
- "Remote URL" — for websites and remote documents accessible via HTTP/HTTPS
- "Local Documentation" — for uploading documents, folders, or archives from the user's device

**FR-3.1.4**: Choosing "Remote URL" MUST open the existing remote ingestion form, retitled to "Add Remote Documentation Source".

**FR-3.1.5**: Choosing "Local Documentation" MUST open the local upload panel titled "Add Local Documentation Source".

**FR-3.1.6**: The modal MUST include a Cancel button that closes it without action.

### 3.2 Remote URL Flow (Existing, Renamed)

**FR-3.2.1**: The existing URL-based scraping form MUST work without regression.

**FR-3.2.2**: The form title MUST change from "Add New Documentation" to "Add Remote Documentation Source".

**FR-3.2.3**: The "Add New Version" flow for existing libraries MUST be retitled to "Add Remote Documentation Version" and work without regression.

### 3.3 Local Documentation Upload Panel

**FR-3.3.1**: The panel MUST be titled "Add Local Documentation Source".

**FR-3.3.2**: The panel MUST include editable Library Name (required) and Version (optional, defaults to "latest") fields.

**FR-3.3.3**: The panel MUST provide the following upload controls:
- **Add File** — select one or more files
- **Add Folder** — select a folder (using `webkitdirectory` attribute or equivalent)
- **Add Virtual Folder** — create an empty folder node in the import tree

**FR-3.3.4**: The panel MUST accept files via drag-and-drop in addition to button-based upload.

**FR-3.3.5**: Accepted file types: `.md`, `.markdown`, `.txt`, plus archive formats `.zip`, `.tar`, `.tar.gz`, `.tgz`, `.tar.bz2`.

**FR-3.3.6**: The panel MUST display an editable import tree showing all staged files/folders with:
- File and folder icons
- Rename action for any node
- Move action for any node
- Delete action for any node

**FR-3.3.7**: The panel MUST display a source path preview for the currently selected file, showing: `<library> <version> > <path>`.

**FR-3.3.8**: The panel MUST display upload stats: file count, total size, folder count.

**FR-3.3.9**: The panel MUST show upload progress for active uploads.

### 3.4 Archive Handling

**FR-3.4.1**: Archives (.zip, .tar, .tar.gz, .tgz, .tar.bz2) MUST be automatically extracted on upload.

**FR-3.4.2**: Nested archives (archives within archives) MUST be rejected and reported in the failed files report.

**FR-3.4.3**: Archive extraction MUST prevent zip-slip and path traversal attacks.

### 3.5 Import Tree Operations

**FR-3.5.1**: Users MUST be able to rename any file or folder in the import tree.

**FR-3.5.2**: Users MUST be able to move any file or folder to a different location in the tree.

**FR-3.5.3**: Users MUST be able to delete any file or folder from the import tree.

**FR-3.5.4**: Auto-renaming of duplicate paths MUST append a numeric suffix (e.g., `file.md` → `file-1.md`).

**FR-3.5.5**: Auto-renamed files MUST be tracked and reported.

### 3.6 Validation

**FR-3.6.1**: File type validation MUST verify file content. For archive formats (.zip, .tar, .tar.gz, .tgz, .tar.bz2), the existing `ArchiveExtractor.detectArchiveType()` magic-byte validation MUST be used. For document formats (.md, .markdown, .txt), extension-based validation is acceptable since these formats have no reliable magic bytes.

**FR-3.6.2**: The following limits MUST be enforced. Default values are specified below. All limits MUST be configurable via environment variables.

| Limit | Default Value | Env Variable |
|-------|---------------|--------------|
| Single file size | 100 MB | `SCRAPEGOAT_WEBUI_IMPORT_MAX_FILE_SIZE_BYTES` |
| Total upload size | 999 MB | `SCRAPEGOAT_WEBUI_IMPORT_MAX_TOTAL_SIZE_BYTES` |
| Compressed archive size | 500 MB | `SCRAPEGOAT_WEBUI_IMPORT_MAX_ARCHIVE_SIZE_BYTES` |
| Extracted archive size | 999 MB | `SCRAPEGOAT_WEBUI_IMPORT_MAX_ARCHIVE_UNCOMPRESSED_BYTES` |
| File count per session | 999 | `SCRAPEGOAT_WEBUI_IMPORT_MAX_FILES` |
| Folder/archive depth | 9 levels | `SCRAPEGOAT_WEBUI_IMPORT_MAX_DEPTH` |
| Filename length | 99 characters | `SCRAPEGOAT_WEBUI_IMPORT_MAX_FILENAME_LENGTH` |
| Source path length | 255 characters | `SCRAPEGOAT_WEBUI_IMPORT_MAX_PATH_LENGTH` |

> **Note**: The current `UploadConfig` defaults (500MB total, 10,000 files, 2GB archive uncompressed) differ from these SPEC targets. The implementation MUST align `UploadConfig` defaults with the values above and add the four missing config fields (`maxArchiveCompressedBytes`, `maxDepth`, `maxFilenameLength`, `maxPathLength`).

**FR-3.6.3**: Files exceeding limits MUST be rejected with clear error messages.

**FR-3.6.4**: Unsupported file types MUST be skipped and listed in the failed files report.

### 3.7 Duplicate Library/Version Detection

**FR-3.7.1**: Before submission, the system MUST check if the library name + version combination already exists in the database.

**FR-3.7.2**: If a duplicate is detected, the submission MUST be rejected with a message indicating the library/version already exists and suggesting a different version.

### 3.8 Submission and Pipeline Integration

**FR-3.8.1**: The panel MUST include an "Accept & Submit" button.

> **Note**: The existing "Import Documentation" button in `LocalUploadPanel` MUST be renamed to "Accept & Submit".

**FR-3.8.2**: Clicking "Accept & Submit" MUST show a confirmation dialog warning that the current tree structure will define retrieval source paths.

**FR-3.8.3**: After confirmation, the backend MUST:
1. Mark the session as COMMITTED
2. Create library and version records in the database (if not existing)
3. Enqueue a pipeline ingestion job for the staged files
4. The pipeline MUST process files using existing document processing (chunking, embedding, vectorization)

**FR-3.8.4**: The pipeline job MUST use the import tree structure as the source layout, producing canonical source URIs in the format: `file:///import/<library>/<version>/<path>`.

**FR-3.8.5**: After successful ingestion, the staging directory MUST be cleaned up.

**FR-3.8.6**: After failed ingestion, the staging directory MUST be preserved for debugging.

### 3.9 Source Path Behavior

**FR-3.9.1**: Final source paths in the database MUST use the canonical URI format: `file:///import/<library>/<version>/<path>`.

**FR-3.9.2**: Source metadata MUST NOT expose temporary staging paths, Docker container paths, or host filesystem paths.

**FR-3.9.3**: Search results and chunk retrieval MUST display source paths as: `<library> <version> > <path>`.

### 3.10 Reports

**FR-3.10.1**: After submission, if any files failed to upload, the browser MUST prompt the user to download `Scrapegoat-FailedToUpload.txt`.

**FR-3.10.2**: After submission, if any files were auto-renamed, the browser MUST prompt the user to download `Scrapegoat-RenamedFiles.txt`.

**FR-3.10.3**: Report files MUST list each affected file with its original path and the reason for failure or the new name.

### 3.11 Library Detail Integration

**FR-3.11.1**: The library detail page MUST include a button to upload a new version for that library via local upload.

**FR-3.11.2**: This button MUST pre-fill the library name field with the current library name.

**FR-3.11.3**: The existing "Add New Version" (URL-based) flow MUST continue working.

### 3.12 Staging Modes

**FR-3.12.1**: Two staging modes MUST be supported:
- **Memory mode** (default): Files stored in temp directory (`os.tmpdir()/scrapegoat-upload/`)
- **Filesystem mode**: Files stored in a configurable path

**FR-3.12.2**: Staging mode MUST be configurable via `SCRAPEGOAT_WEBUI_IMPORT_STAGING_MODE` environment variable.

**FR-3.12.3**: Filesystem staging path MUST be configurable via `SCRAPEGOAT_WEBUI_IMPORT_STAGING_INTERNAL_PATH`.

**FR-3.12.4**: Sessions MUST have a configurable TTL (default: 3600 seconds) via `SCRAPEGOAT_WEBUI_IMPORT_SESSION_TTL_SECONDS`.

**FR-3.12.5**: Expired sessions MUST be automatically cleaned up.

### 3.13 Cancel Behavior

**FR-3.13.1**: The panel MUST include a Cancel button.

**FR-3.13.2**: Canceling MUST remove all staged files and clean up the session.

**FR-3.13.3**: Canceling MUST return the user to the previous view.

---

## 4. Non-Functional Requirements

### 4.1 Security

**NFR-4.1.1**: Archive extraction MUST prevent zip-slip attacks (path traversal outside staging directory).

**NFR-4.1.2**: All file paths MUST be validated to stay within the staging directory boundary.

**NFR-4.1.3**: File names MUST be sanitized to prevent directory traversal.

**NFR-4.1.4**: Upload size limits MUST be enforced server-side (not just client-side).

### 4.2 Docker Deployment

**NFR-4.2.1**: The local upload feature MUST work correctly when ScrapeGoat runs in Docker containers.

**NFR-4.2.2**: Filesystem staging mode MUST support Docker volume mounts for persistent staging.

**NFR-4.2.3**: Source paths in the database MUST NOT expose Docker container-internal paths.

### 4.3 Performance

**NFR-4.3.1**: Upload progress MUST be reported to the client in real-time.

**NFR-4.3.2**: Large archive extraction MUST not block the server event loop. Archive extraction for files exceeding 10MB MUST use async I/O or worker threads to avoid blocking the Node.js event loop.

**NFR-4.3.3**: Session cleanup MUST not block new session creation. Cleanup operations MUST run asynchronously and not hold locks on the session store.

---

## 5. Acceptance Criteria

### AC-1: Source Selection
- [ ] Clicking "Add New Documentation" opens a centered modal
- [ ] Modal is titled "Documentation Source Selection"
- [ ] Modal blocks background interaction
- [ ] Modal offers "Remote URL" and "Local Documentation" choices
- [ ] Cancel closes the modal

### AC-2: Remote URL Flow
- [ ] Choosing "Remote URL" opens existing form with title "Add Remote Documentation Source"
- [ ] URL scraping works without regression
- [ ] "Add New Version" for existing libraries works without regression

### AC-3: Local Upload Flow
- [ ] Choosing "Local Documentation" opens upload panel titled "Add Local Documentation Source"
- [ ] Library Name and Version fields are present and editable
- [ ] Files can be uploaded via drag-drop and Add File button
- [ ] Folders can be uploaded via Add Folder button
- [ ] Archives are automatically extracted
- [ ] Import tree is displayed and editable (rename, move, delete)
- [ ] Source path preview is shown for selected files

### AC-4: Submission Pipeline
- [ ] "Accept & Submit" shows confirmation dialog
- [ ] After confirmation, a pipeline ingestion job is created
- [ ] Library and version records appear in the database
- [ ] Documents are indexed and searchable
- [ ] Source paths use `file:///import/<library>/<version>/<path>` format
- [ ] Search results show correct source paths
- [ ] Staging directory is cleaned up after successful ingestion

### AC-5: Reports
- [ ] Failed files report is offered for download after submission
- [ ] Renamed files report is offered for download after submission

### AC-6: Library Detail
- [ ] Library detail page has upload button for new versions
- [ ] Upload from library detail pre-fills library name

### AC-7: Validation
- [ ] Duplicate library/version is rejected before submission
- [ ] File size limits are enforced
- [ ] Nested archives are rejected
- [ ] Zip-slip attacks are prevented

### AC-8: Docker Testing
- [ ] Feature works in Docker container deployment
- [ ] Both memory and filesystem staging modes are tested
- [ ] Source paths do not expose container-internal paths

---

## 6. Constraints and Guardrails

- Must NOT break existing URL-based scraping functionality
- Must NOT require changes to the existing pipeline architecture (use existing pipeline semantics)
- Must NOT expose server filesystem paths to users
- Must NOT store uploaded files permanently — only as temporary staging
- Must use existing embedding and vectorization pipeline for uploaded content
- Must be compatible with Docker-based deployment
- Must follow existing project code style (Biome, TypeScript strict, AlpineJS + HTMX + TailwindCSS)
- Closing this issue requires explicit approval from Midnight Phreaker

---

## 7. Out of Scope

- Changes to the existing embedding or vectorization pipeline
- New embedding models or dimension changes
- Authentication or authorization changes
- Database schema changes beyond library/version/page creation
- Mobile-responsive design changes beyond current Tailwind usage
- Real-time collaboration on import trees
- Resumable uploads across browser sessions
