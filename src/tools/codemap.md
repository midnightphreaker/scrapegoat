# src/tools/

## Responsibility
MCP tool implementations for documentation scraping, searching, version management, and pipeline job control.

## Design
Each tool is a class with an `execute()` method that receives typed input and returns typed output. Tools depend on two core interfaces injected via constructor: `IPipeline` (job lifecycle) and `IDocumentManagement` (store queries). Errors are discriminated via `ValidationError` (client-side) vs `ToolError` (general failure), both extending a common `ToolError` base.

**Tool inventory** (by dependency):
- **Pipeline tools** (depend on `IPipeline`): `ScrapeTool`, `RefreshVersionTool`, `CancelJobTool`, `ClearCompletedJobsTool`, `ListJobsTool`, `GetJobInfoTool`
- **Store tools** (depend on `IDocumentManagement`): `SearchTool`, `FindVersionTool`, `ListLibrariesTool`
- **Hybrid tools** (both interfaces): `RemoveTool`, `FetchUrlTool`

`FetchUrlTool` is unique — it holds its own `AutoDetectFetcher` + content pipelines, fetches a single URL, and converts to markdown without storing. `search-provider.ts` is a standalone CLI entry point for Promptfoo evaluation that bootstraps a headless `SearchTool` and outputs JSON to stdout.

## Flow
1. MCP server receives tool call → validates input schema → calls `tool.execute(input)`
2. Tool validates params, calls into `IPipeline`/`IDocumentManagement`
3. Results are returned as plain objects; errors thrown as `ToolError` subclasses
4. For async jobs (`ScrapeTool`, `RefreshVersionTool`): optionally `waitForCompletion` or return `{ jobId }` immediately

## Integration
- Consumed by: MCP server layer (`src/mcp/`), tRPC router, `search-provider.ts` CLI
- Depends on: `src/pipeline/` (IPipeline interface), `src/store/` (IDocumentManagement interface), `src/scraper/` (fetcher, pipelines, types), `src/utils/` (config, logger)
