## Responsibility

Implements the **local file/archive upload and import staging system** for the web UI. Manages the full lifecycle of upload sessions: creating sessions, staging files to disk, extracting archives (ZIP, TAR, TAR.GZ) with security validation, building hierarchical import trees, committing sessions to the ingestion pipeline, and cleaning up expired sessions.

## Design

- **Session-Based State Machine**: `UploadStagingService` manages `UploadSession` objects with statuses (`ACTIVE` → `COMMITTED` / `CANCELLED` / `EXPIRED`). Each session owns a temporary staging directory, a `Map<string, StagedFile>`, and tracking for failed/renamed files.
- **Strategy Pattern (Archive Extraction)**: `ArchiveExtractor` auto-detects archive type via **magic bytes** (not extension) — ZIP (`PK\x03\x04`), GZIP (`\x1f\x8b`), TAR (ustar at offset 257) — and dispatches to `extractZip`, `extractTarGz`, or `extractTar`. Nested archives are flagged and rejected.
- **Defense-in-Depth Security** (`security.ts`): `validateSafePath` (path traversal), `validateArchiveEntryPath` (zip-slip), `ensureWithinBase` (containment check), `validateFileSize` / `validateTotalSize` / `validateUncompressedSize` / `validateArchiveEntryCount` (decompression bomb limits), `sanitizeFileName` (dangerous character removal), `isIngestibleFileType` (extension allowlist).
- **Tree Builder** (`ImportTreeBuilder`): Constructs `ImportTreeNode[]` from flat `StagedFile[]` + `ImportFolder[]`, supporting virtual folder creation, rename, delete, move, duplicate resolution (numeric suffix), and canonical `file:///import/` URI generation.
- **TTL-Based Cleanup**: Periodic timer in `UploadStagingService` expires idle sessions; `dispose()` stops the timer.
- **Typed Configuration**: `UploadConfig` with `DEFAULT_UPLOAD_CONFIG` (999 MB total, 100 MB per file, 999 files, 1 hour TTL).

## Flow

1. **Create Session**: `UploadStagingService.createSession(library, version)` generates a unique session ID, creates a staging directory (`os.tmpdir()` or configured path), and stores the `UploadSession` in an in-memory `Map`.
2. **Stage Files**: `stageFile(sessionId, fileName, content)` validates sizes, sanitizes the filename, writes to disk, detects MIME type, and records the `StagedFile` in the session. Archives are routed through `ArchiveExtractor.extract` first.
3. **Manage Tree**: `getImportTree(sessionId)` delegates to `ImportTreeBuilder.buildTree` to produce a hierarchical view; `renameFile`, `moveFile`, `createVirtualFolder` mutate both disk and session state.
4. **Commit**: `commitSession(sessionId)` marks the session as `COMMITTED`. The caller (upload route handler) then enqueues a pipeline scrape job with `localImportStagingPath` pointing to the staging directory.
5. **Cleanup**: Expired sessions are removed by the periodic cleanup timer. On successful pipeline completion, the staging directory is deleted; on failure it is retained for debugging.

## Integration

- **Consumed by**: `src/web/routes/upload/index.ts` (Fastify upload API routes instantiate `UploadStagingService`, `ArchiveExtractor`, and call their methods per HTTP request).
- **Depends on**: `src/utils/config` (`loadConfig` for `webImport` settings), `yauzl` (ZIP), `tar` (TAR/TAR.GZ), `mime` (MIME detection), Node.js `fs`, `crypto`, `os`, `path`.
