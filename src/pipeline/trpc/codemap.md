# src/pipeline/trpc/

## Responsibility
Exposes the `IPipeline` interface as a tRPC RPC layer, enabling an external worker process to accept scrape job commands over HTTP+WebSocket.

## Design
- **IPipeline interface** (`interfaces.ts`): The abstract contract shared by `PipelineManager` and `PipelineClient`. Defines `PipelineOptions` (recoverJobs, serverUrl, appConfig).
- **PipelineRouter** (`router.ts`): tRPC router with procedures: `ping`, `enqueueScrapeJob`, `enqueueRefreshJob`, `getJob`, `getJobs`, `cancelJob`, `clearCompletedJobs`. Uses superjson transformer for Date serialization. Validates inputs with Zod schemas (`scraperOptionsInputSchema` filters out non-serializable runtime fields like `signal` and `initialQueue`).
- **Context**: `PipelineTrpcContext` carries an `IPipeline` instance injected at server setup time.
- **Factory pattern**: `createPipelineRouter(trpc)` allows composing the pipeline router under a shared tRPC instance. A default `pipelineRouter` is exported for standalone use.

## Flow
1. Server creates tRPC instance with `PipelineTrpcContext` containing an `IPipeline` impl.
2. Client calls procedures (e.g., `enqueueScrapeJob` mutation) → router delegates to `ctx.pipeline.enqueueScrapeJob()`.
3. `PipelineClient` (in main process) connects via split link: subscriptions → WebSocket, queries/mutations → HTTP batch.

## Integration
- Consumed by: `PipelineClient` (as tRPC client), server entrypoint (as tRPC router)
- Depends on: `IPipeline` (pipeline manager or client), `superjson`, `zod`, `@trpc/server`
