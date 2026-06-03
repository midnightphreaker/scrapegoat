## Responsibility

User-facing command-line interface built on Yargs. Handles argument parsing, global middleware (config loading, logging, telemetry, service initialization), command dispatch, structured output formatting, and graceful shutdown for both one-shot and long-running commands.

## Design

- **Command pattern**: Each command (`commands/*.ts`) exports a `create*Command(cli)` function that registers a Yargs subcommand with its own options, validation, and handler. 12 commands: `default`, `scrape`, `search`, `list`, `remove`, `refresh`, `fetch-url`, `find-version`, `web`, `mcp`, `worker`, `config`.
- **Middleware-based setup**: `createCli()` attaches global Yargs middleware that runs before every command handler — validates options, resolves store path, loads `AppConfig`, initializes logging (`applyGlobalCliOutputMode`), telemetry (`initTelemetry`), and global services (`EventBusService`, `TelemetryService`).
- **Service registry**: `services.ts` holds module-level references to active long-lived services (`AppServer`, `McpServer`, `IPipeline`, `IDocumentManagement`, `TelemetryService`) for coordinated shutdown.
- **Output abstraction**: `output.ts` provides format-agnostic output (`json`, `yaml`, `toon`) via `renderStructuredOutput()` and scalar/text renderers. Log level is set based on `--verbose`/`--quiet` flags and TTY detection.
- **Utility helpers**: `utils.ts` centralizes Playwright browser install checks, protocol auto-detection (`resolveProtocol`), `AppServerConfig` construction (`createAppServerConfig`), auth config parsing/validation, and embedding model change handling.

## Flow

1. `runCli()` (entry from `main.ts`) calls `createCli(process.argv)` to build the Yargs instance with all commands.
2. Global middleware resolves store path, loads config, sets log level, inits telemetry/event bus.
3. The matched command handler executes — typically loads config, creates `DocumentManagementService`, creates a pipeline via `PipelineFactory`, invokes a tool, renders output.
4. Long-running commands (`default`, `web`, `mcp`, `worker`) start an `AppServer` or MCP stdio server and block with `await new Promise(() => {})`.
5. `main.ts` registers a SIGINT handler for graceful shutdown; `cleanupCliCommand()` handles teardown for one-shot commands (flush telemetry, `process.exit(0)`).

## Integration

- **Consumers**: `package.json` bin entry → `main.ts` → `runCli()`.
- **Dependencies**: `app` (AppServer), `pipeline` (PipelineFactory, IPipeline), `store` (DocumentManagementService), `mcp` (startStdioServer, initializeTools), `events` (EventBusService), `telemetry`, `tools` (ScrapeTool, SearchTool, etc.), `utils/config`.
