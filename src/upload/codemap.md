# src/upload/

## Responsibility
Manages local file/folder/archive upload sessions with staging, security validation, and hierarchical import tree construction for the WebUI.

## Design
**UploadStagingService** — central orchestrator managing in-memory session state (`Map<UploadSessionId, UploadSession>`). Each session has a filesystem staging directory, tracks `StagedFile` entries and virtual `ImportFolder` nodes, and auto-expires via TTL timer. Supports two staging modes: `memory` (tmpdir) and `filesystem` (configurable path).

**ArchiveExtractor** — extracts ZIP/TAR/TAR.GZ archives via magic-byte detection (not extensions). Enforces entry count limits, uncompressed size limits, zip-slip prevention, and rejects nested archives.

**ImportTreeBuilder** — builds hierarchical `ImportTreeNode[]` from flat staged files and virtual folders. Provides immutable tree operations (create folder, rename, delete, move) returning new trees + rename records. Resolves duplicate paths with numeric suffixes. Generates canonical `file:///import/<library>/<version>/<path>` source URIs.

**security.ts** — pure validation functions: path traversal prevention, zip-slip detection, symlink blocking, decompression bomb limits, file sanitization, and ingestible file type checking (`.md`, `.txt`, `.zip`, `.tar`, `.tgz`, etc.).

**types.ts** — domain types (`StagedFile`, `UploadSession`, `ImportTreeNode`, `UploadConfig`, etc.) and `DEFAULT_UPLOAD_CONFIG` constants.

## Flow
1. `createSession(library, version)` → creates staging directory and session
2. `stageFile(sessionId, fileName, content)` → validates, writes to disk, records `StagedFile`
3. For archives: `ArchiveExtractor.extract()` → validates entries → writes files → returns `ExtractionResult`
4. Tree operations via `getImportTree()` → `ImportTreeBuilder.buildTree()` for UI rendering
5. `commitSession()` marks ready for ingestion; `cancelSession()`/`destroySession()` cleans up

## Integration
- Consumed by: WebUI upload API routes, ingestion pipeline
- Depends on: `yauzl` (ZIP), `tar` (TAR), `mime` (MIME detection), Node.js `fs`/`crypto`/`path`
