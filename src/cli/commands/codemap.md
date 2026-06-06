# src/cli/commands/

## Responsibility
Individual CLI command implementations — each file registers one Yargs subcommand with its own options, handler logic, and output rendering.

## Design
- **Factory pattern** — Each export is a `create*Command(cli: Argv)` function that calls `cli.command(name, description, builder, handler)` on the shared Yargs instance. No classes; pure functions.
- **Two command categories**:
  - **Long-running servers** — `default.ts`, `mcp.ts`, `web.ts`, `worker.ts` start `AppServer` or MCP stdio server and block forever (`await new Promise(() => {})`). They register services for SIGINT cleanup.
  - **Short-lived tools** — `scrape.ts`, `refresh.ts`, `search.ts`, `list.ts`, `remove.ts`, `find-version.ts`, `fetch-url.ts` create temporary `IDocumentManagement` + optional `IPipeline`, execute a tool, render output, then shut down in a `finally` block.
  - **Utility** — `config.ts` reads/writes configuration directly via `loadConfig`/`setConfigValue` without creating document services.
- **Common patterns across commands**:
  - Telemetry tracking as first line of handler: `telemetry.track(TelemetryEvent.CLI_COMMAND, { command, ... })`
  - Config loading: `loadConfig(argv, { configPath, searchDir })`
  - Service creation via helpers: `createDocumentManagement({ serverUrl, eventBus, appConfig })`, `PipelineFactory.createPipeline(...)`
  - EventBus extraction: `getEventBus(argv as CliContext)`
  - Progress subscription for local pipelines (scrape, refresh): subscribes to `JOB_PROGRESS` / `JOB_STATUS_CHANGE` events
  - Remote worker support: commands accept `--server-url` to delegate to an external `DocumentManagementClient` + remote pipeline

## Flow
Per-command lifecycle (typical tool command):
1. Handler invoked by Yargs with parsed `argv`
2. Track telemetry event
3. `loadConfig()` merges CLI args → config file → defaults
4. `getEventBus(argv)` retrieves the middleware-injected `EventBusService`
5. `createDocumentManagement()` creates local service or remote client
6. Optionally `PipelineFactory.createPipeline()` + `pipeline.start()`
7. Instantiate tool class (`ScrapeTool`, `SearchTool`, etc.) and call `.execute()`
8. Render result via `renderStructuredOutput()` or `renderTextOutput()`
9. `finally`: stop pipeline, shutdown doc service

Server command lifecycle (default, mcp, web, worker):
1. Steps 1–6 above, then resolve protocol (stdio vs http)
2. For stdio: `startStdioServer(mcpTools, appConfig)` → blocks forever
3. For http: `startAppServer(...)` → `registerGlobalServices()` → blocks forever
4. SIGINT in `main.ts` tears down registered services

## Commands Summary
| File | Command | Description | Long-running? |
|------|---------|-------------|--------------|
| `default.ts` | `$0` / `server` | Unified server (web + MCP + API + worker) | Yes |
| `mcp.ts` | `mcp` | MCP server only (stdio or HTTP) | Yes |
| `web.ts` | `web` | Web dashboard only | Yes |
| `worker.ts` | `worker` | External pipeline worker (HTTP API) | Yes |
| `scrape.ts` | `scrape <library> <url>` | Download & index documentation | No |
| `refresh.ts` | `refresh <library>` | Re-scrape using ETags for changed pages | No |
| `search.ts` | `search <library> <query>` | Full-text + vector search | No |
| `list.ts` | `list` | List indexed libraries/versions | No |
| `remove.ts` | `remove <library>` | Delete library documentation | No |
| `find-version.ts` | `find-version <library>` | Resolve best matching version | No |
| `fetch-url.ts` | `fetch-url <url>` | Fetch URL → Markdown | No |
| `config.ts` | `config [get\|set]` | View/modify configuration | No |

## Integration
- Consumed by: `../index.ts` (registers all commands on the root Yargs instance)
- Depends on: `../output.ts` (rendering), `../utils.ts` (helpers, validation), `../services.ts` (global service registry), `../../app`, `../../mcp`, `../../pipeline`, `../../store`, `../../tools`, `../../telemetry`, `../../scraper`
