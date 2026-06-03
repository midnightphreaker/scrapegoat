## Responsibility

Implements the application's **tool layer** — a collection of stateless, single-responsibility command objects that encapsulate all user-facing operations: scraping URLs, searching indexed documentation, fetching single pages, listing/querying libraries and jobs, cancelling/clearing jobs, resolving versions, removing indexed data, and refreshing versions. Each tool validates its own inputs, delegates to lower-level services, and returns typed result objects. Also provides a standalone `search-provider` CLI for Promptfoo evaluation pipelines.

## Design

- **Command Pattern**: Every tool is a class exposing a single `execute()` method (`ScrapeTool.execute`, `SearchTool.execute`, `FetchUrlTool.execute`, `ListLibrariesTool.execute`, `ListJobsTool.execute`, `GetJobInfoTool.execute`, `CancelJobTool.execute`, `ClearCompletedJobsTool.execute`, `FindVersionTool.execute`, `RemoveTool.execute`, `RefreshVersionTool.execute`).
- **Dependency Injection**: Tools receive their collaborators via constructor — `IPipeline` for job management tools, `IDocumentManagement` for search/store tools, `AutoDetectFetcher` + `AppConfig` for fetch. No tools import service singletons directly.
- **Typed Error Hierarchy**: `ToolError` (base) carries `toolName`; `ValidationError` (subclass) signals client-side input failures. Tools throw these rather than returning error codes.
- **Version Coercion**: `ScrapeTool` and `RefreshVersionTool` use `semver.valid` / `semver.coerce` to normalize partial version strings (`"1"`, `"1.2"`) into full semver before enqueuing jobs.
- **Conditional Blocking**: `ScrapeTool` and `RefreshVersionTool` support `waitForCompletion` — when `true`, they block until the pipeline finishes; when `false`, they return `{ jobId }` immediately.
- **Barrel Export**: `index.ts` re-exports all tools and error types for consumers.

## Flow

1. Consumer instantiates a tool with required service dependencies (e.g., `new SearchTool(docService)`).
2. Consumer calls `execute(options)` with a validated options object.
3. Tool performs **input validation** — throws `ValidationError` on missing/invalid params.
4. Tool delegates to injected services: `IPipeline.enqueueScrapeJob`, `IDocumentManagement.searchStore`, `IDocumentManagement.findBestVersion`, etc.
5. Tool transforms raw service results into a simplified DTO (`JobInfo`, `ListLibrariesResult`, `SearchToolResult`, etc.) and returns it.
6. Errors from services are either re-thrown (if already `ToolError`) or wrapped in `ToolError` with context.

## Integration

- **Consumed by**: `src/web/web.ts` (Fastify route handlers instantiate tools and call `execute`), `src/tools/search-provider.ts` (CLI script for Promptfoo), MCP server layer.
- **Depends on**: `src/pipeline/trpc/interfaces` (`IPipeline`), `src/store/trpc/interfaces` (`IDocumentManagement`), `src/scraper/fetcher` (`AutoDetectFetcher`), `src/scraper/pipelines/PipelineFactory`, `src/utils/config` (`AppConfig`), `src/utils/logger`.
