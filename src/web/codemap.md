## Responsibility

Implements the **web UI layer** — a Fastify-based HTTP server with server-rendered JSX components, HTMX-driven partial page updates, SSE-based real-time event streaming, and AlpineJS client-side interactivity. Provides routes for job management (create/cancel/clear/list), library browsing and search, file upload/import, health checks, analytics stats, and the main dashboard.

## Design

- **Server-Side Rendering with JSX**: Route handlers return JSX elements (kitajsn) rendered to HTML strings. Components live in `components/` and are pure functions accepting props, returning `JSX.Element`.
- **HTMX Hypermedia Pattern**: Routes return HTML fragments (not JSON) with `hx-get`/`hx-post`/`hx-trigger`/`hx-swap="morph:innerHTML"` attributes for partial DOM updates. SSE events (`job-status-change`, `job-progress`, `library-change`, etc.) trigger HTMX re-fetches of specific URL fragments.
- **AlpineJS + Idiomorph**: Client-side state (form toggles, confirmation dialogs, toast notifications, version checks) managed via Alpine stores and `x-data`. `idiomorph` handles DOM morphing during HTMX swaps. `Alpine.destroyTree`/`Alpine.initTree` manage lifecycle during swaps.
- **SSE Event Bridge** (`EventClient.ts`): Browser-side `EventSource` connects to `/web/events`, parses typed events, and dispatches them as DOM `CustomEvent`s for HTMX to consume. Server-side `registerEventsRoute` (`routes/events.ts`) subscribes to `EventBusService` and serializes events as SSE messages with heartbeat keep-alive.
- **Tool Instantiation in Server** (`web.ts`): `startWebServer` creates tool instances (`ScrapeTool`, `SearchTool`, `ListLibrariesTool`, `RemoveTool`, `CancelJobTool`, `ClearCompletedJobsTool`, `RefreshVersionTool`) with injected services and passes them to route registration functions.
- **Upload Subsystem** (`routes/upload/`): Full upload pipeline — multipart file handling via `@fastify/multipart`, rate limiting via `@fastify/rate-limit`, archive extraction, session-based staging via `UploadStagingService`, and commit-to-pipeline integration.
- **Version Check** (`utils/versionCheck.ts`): Client-side semver comparison against GitHub Releases API to surface update notifications.

## Flow

1. **Server Start**: `startWebServer(port, docService, pipelineManager, config)` creates a Fastify instance, registers formbody/static/plugins, instantiates all tools, and registers all route modules.
2. **Initial Page Load**: `GET /` renders the full HTML layout (`Layout` component) with HTMX-powered placeholders for stats (`/web/stats`), job queue (`/web/jobs`), and library list (`/web/libraries`).
3. **HTMX Partial Updates**: User actions (add job, cancel, delete library) POST to route handlers which invoke tool `.execute()` and return HTML fragments or HX-Trigger headers for toast notifications.
4. **Real-Time Updates**: `EventClient` subscribes to `/web/events` SSE endpoint. Backend `EventBusService` events (job status changes, progress, library mutations) are forwarded as SSE messages. HTMX `hx-trigger` attributes on elements listen for these custom DOM events and re-fetch their content URLs.
5. **Upload Flow**: `GET /web/upload` renders `LocalUploadPanel`. Client JS creates a session (`POST /web/upload/start`), uploads files (`POST /web/upload/files`), manipulates the tree, then commits (`POST /web/upload/commit`) which enqueues a pipeline import job.
6. **Shutdown**: `stopWebServer(server)` calls `server.close()`.

## Integration

- **Consumed by**: `src/index.ts` (entry point calls `startWebServer` / `stopWebServer`).
- **Depends on**: `fastify`, `@fastify/formbody`, `@fastify/static`, `@fastify/multipart`, `@fastify/rate-limit`, `alpinejs`, `idiomorph/htmx`, `flowbite` (Tailwind components). Internal deps: `src/tools/*` (all tool classes), `src/pipeline/PipelineManager`, `src/store/DocumentManagementService`, `src/upload/*`, `src/events/EventBusService`, `src/events/types`, `src/utils/config`, `src/utils/logger`, `src/utils/paths`.
