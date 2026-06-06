# src/web/routes/upload/

## Responsibility
Upload/import API routes for local documentation ingestion: session lifecycle, file staging, import tree management, commit to pipeline, and report generation.

## Design

### Files

**index.ts** — `registerUploadRoutes(server, pipeline, docs)`
Registers the `@fastify/multipart` plugin and all upload API endpoints. Uses a lazily-initialized singleton `UploadStagingService` configured from `AppConfig.webImport`. Pipeline and doc service references are stored at registration time.

**Endpoints:**

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/web/upload` | Upload page UI fragment (renders `LocalUploadPanel` via `page.tsx`) |
| `POST` | `/web/upload/start` | Create upload session (library + version) |
| `POST` | `/web/upload/files` | Upload files via multipart; auto-extracts archives via `ArchiveExtractor` |
| `GET` | `/web/upload/tree` | Get import tree + session stats |
| `POST` | `/web/upload/tree/rename` | Rename a staged file |
| `POST` | `/web/upload/tree/delete` | Remove a staged file |
| `POST` | `/web/upload/tree/move` | Move a staged file to new path |
| `POST` | `/web/upload/tree/virtual-folder` | Create a virtual folder node |
| `POST` | `/web/upload/commit` | Commit session → enqueue pipeline job with `localImportStagingPath` |
| `POST` | `/web/upload/cancel` | Cancel and cleanup session |
| `GET` | `/web/upload/report/failed` | Download TSV report of failed files |
| `GET` | `/web/upload/report/renamed` | Download TSV report of renamed files |
| `GET` | `/web/upload/stats` | Session status and stats JSON |

**page.tsx** — `registerUploadPageRoute(server)`
Registers `GET /web/upload` returning an HTML fragment rendered by `LocalUploadPanel`. Accepts optional `library` and `version` query parameters for pre-filling. Returns a bare fragment (no Layout wrapper) since it's swapped into an existing page via HTMX innerHTML.

### Key Patterns
- **Staging cleanup**: `registerStagingCleanup()` attaches a one-shot listener via `pipeline.waitForJobCompletion()` — removes staging directory on success/cancel, preserves on failure for debugging.
- **Archive handling**: Files are checked with `ArchiveExtractor.isArchiveBuffer()`; archives are extracted to a temp dir, files are staged individually, then temp dir is cleaned up.
- **Duplicate prevention**: Commit checks `docService.versionExists()` before enqueuing, returning HTTP 409 on conflict.
- **Error tracking**: Failed and renamed files are tracked per-session for downloadable reports.

## Flow
1. User opens upload panel → `GET /web/upload?library=X&version=Y` → `LocalUploadPanel` fragment.
2. Library name entered → `POST /web/upload/start` creates session.
3. Files dropped → `POST /web/upload/files` stages files (with archive extraction).
4. User reviews/modifies tree via tree manipulation endpoints.
5. User commits → `POST /web/upload/commit` → duplicate check → pipeline job enqueued → staging cleanup registered.
6. Pipeline processes import; staging directory cleaned on completion.

## Integration
- Consumed by: `src/web/web.ts` (calls `registerUploadRoutes`)
- Depends on: `fastify`, `@fastify/multipart`, `src/upload/UploadStagingService`, `src/upload/ArchiveExtractor`, `src/upload/types`, `src/pipeline/trpc/interfaces` (IPipeline), `src/store/trpc/interfaces` (IDocumentManagement), `src/utils/config`, `src/utils/logger`, `src/web/components/upload/LocalUploadPanel` (via page.tsx)
