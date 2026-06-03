## Responsibility

Orchestrates document scraping/indexing jobs through a queue with concurrency control, cancellation, persistence, and RPC access. Provides two implementations of `IPipeline`: `PipelineManager` (in-process, with embedded worker) and `PipelineClient` (tRPC client to external worker). `PipelineFactory` selects the appropriate implementation.

## Design

- **Strategy pattern**: `PipelineFactory.createPipeline()` returns either `PipelineManager` (local) or `PipelineClient` (remote tRPC) based on presence of `serverUrl`. Both implement the `IPipeline` interface.
- **Manager-Worker separation**: `PipelineManager` owns the job queue, concurrency control (`activeWorkers` set with configurable limit), database write-through, and event emission. `PipelineWorker` is stateless — it executes a single job by delegating to `ScraperService` and reporting progress via callbacks.
- **Job lifecycle state machine**: `PipelineJobStatus` enum: QUEUED → RUNNING → COMPLETED | FAILED | CANCELLING → CANCELLED. Cancellation uses `AbortController` signals propagated to the scraper. A timeout mechanism force-cancels stuck CANCELLING jobs.
- **Write-through persistence**: `updateJobStatus()` and `updateJobProgress()` update both in-memory job state and database version status atomically with retry (`retryWithBackoff`).
- **Job recovery**: On startup, `recoverPendingJobs()` re-enqueues interrupted RUNNING/QUEUED jobs as refresh jobs; or `markInterruptedJobsAsFailed()` if recovery is disabled.
- **tRPC router**: `trpc/router.ts` exposes procedures: `ping`, `enqueueScrapeJob`, `enqueueRefreshJob`, `getJob`, `getJobs`, `cancelJob`, `clearCompletedJobs`. Uses Zod-validated input schemas.
- **Error hierarchy**: `PipelineError` → `PipelineStateError`, `CancellationError`.

## Flow

1. `PipelineFactory.createPipeline()` constructs the appropriate implementation and calls `start()`.
2. `PipelineManager.start()` recovers pending jobs (or marks failed), then calls `_processQueue()`.
3. `enqueueScrapeJob()` creates an `InternalPipelineJob` with `AbortController` and `completionPromise`, persists QUEUED status to DB, pushes to `jobQueue`, triggers `_processQueue()`.
4. `_processQueue()` dequeues jobs up to concurrency limit, spawns `PipelineWorker.executeJob()` per job.
5. `PipelineWorker.executeJob()` clears store (if not refresh), calls `scraperService.scrape()` with progress callback that stores results via `docService.addScrapeResult()`.
6. On completion/failure/cancellation, `_runJob()` updates status, resolves/rejects `completionPromise`, frees the worker slot, and re-invokes `_processQueue()`.
7. `PipelineClient` delegates all operations to tRPC mutations/queries; `waitForJobCompletion()` listens on `EventBusService` for `JOB_STATUS_CHANGE` events.

## Integration

- **Consumers**: `AppServer` (embedded worker), CLI commands (`scrape`, `refresh`, `default`, `mcp`, `web`, `worker`), MCP tools (`ScrapeTool`, `RefreshVersionTool`, `ListJobsTool`, etc.).
- **Dependencies**: `ScraperService` (scraping), `DocumentManagementService` (persistence), `EventBusService` (events), `@trpc/server` + `@trpc/client` (RPC), `zod` (validation), `uuid` (job IDs).
