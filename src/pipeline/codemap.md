# src/pipeline/

## Responsibility
Orchestrates document scraping/indexing jobs — manages a concurrent job queue, bridges in-memory job state to the persistent store, and provides both local (in-process) and remote (tRPC) execution modes.

## Design
- **IPipeline interface** (`trpc/interfaces.ts`): Unified contract for `PipelineManager` (local) and `PipelineClient` (remote). Methods: `enqueueScrapeJob`, `enqueueRefreshJob`, `getJob`, `getJobs`, `cancelJob`, `clearCompletedJobs`, `waitForJobCompletion`.
- **PipelineManager**: In-process job scheduler. Owns a `jobMap` (ID → `InternalPipelineJob`), a FIFO `jobQueue`, and an `activeWorkers` set for concurrency control. Delegates actual scraping to short-lived `PipelineWorker` instances. Writes through job status/progress to the database on every state change. Emits events to `EventBusService`.
- **PipelineWorker**: Stateless executor for a single job. Calls `ScraperService.scrape()` and feeds results back via callbacks to the manager. Handles per-page store operations (add/delete documents).
- **PipelineFactory**: Factory function with overloads — creates `PipelineManager` when no `serverUrl`, `PipelineClient` when `serverUrl` is provided.
- **PipelineClient**: tRPC proxy that delegates all `IPipeline` calls to a remote worker over HTTP + WebSocket. Uses `EventBusService` for `waitForJobCompletion`.
- **Job lifecycle**: `QUEUED → RUNNING → COMPLETED | FAILED | CANCELLING → CANCELLED`. Cancellation uses `AbortController` with a configurable force-cancel timeout.
- **Recovery**: On startup, `PipelineManager` can recover interrupted jobs (RUNNING/QUEUED) from the database via `enqueueRefreshJob`, or mark them FAILED if recovery is disabled.
- **Types**: `PipelineJob` (public, serializable) vs `InternalPipelineJob` (extends with `AbortController`, completion promise). `PipelineJobStatus` enum. `PipelineManagerCallbacks` for lifecycle hooks.
- **Errors**: `PipelineError` base, `PipelineStateError` (state violations), `CancellationError` (abort signals).

## Flow
1. `PipelineManager.enqueueScrapeJob()` creates an `InternalPipelineJob`, cancels duplicates for same library+version, stores scraper options to DB, pushes to queue.
2. `_processQueue()` loop: dequeues jobs up to `concurrency` limit, spawns `PipelineWorker` per job.
3. `PipelineWorker.executeJob()`: clears existing docs (unless refresh), calls `ScraperService.scrape()`, stores each `ScrapeResult` via `store.addScrapeResult()`, handles 304/deleted pages.
4. Manager updates job status/progress to DB with retry (exponential backoff), emits `JOB_STATUS_CHANGE`, `JOB_PROGRESS`, `LIBRARY_CHANGE` events.
5. On completion/failure/cancellation, resolves/rejects the job's `completionPromise`.

## Integration
- Consumed by: MCP tools layer (scrape_docs, refresh_docs, job management tools), tRPC router
- Depends on: `DocumentManagementService` (store), `EventBusService` (events), `ScraperService`/`ScraperRegistry` (scraping), `AppConfig`
