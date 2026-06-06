# src/cli/

## Responsibility
CLI framework for ScrapeGoat: parses arguments via Yargs, registers commands, manages global service lifecycle (startup, shutdown, HMR), and renders structured output.

## Design
- **Yargs-based command registration** — `index.ts` creates the root `Argv` instance, registers global options (`--verbose`, `--quiet`, `--telemetry`, `--store-path`, `--config`, `--logo`), attaches a middleware that resolves config/paths/logging/telemetry/event-bus per command invocation, and delegates to per-command `create*Command(cli)` functions.
- **Service registry** — `services.ts` holds module-level singletons (`activeAppServer`, `activeMcpStdioServer`, `activeDocService`, `activePipelineManager`, `activeTelemetryService`) with getter/setter pairs and a `registerGlobalServices()` bulk setter, enabling coordinated shutdown from `main.ts`.
- **Structured output** — `output.ts` defines `OutputFormat` (`json | yaml | toon`), with renderers (`renderStructuredOutput`, `renderScalarOutput`, `renderTextOutput`), log-level management (`applyGlobalCliOutputMode`), and a Yargs option helper (`registerGlobalOutputOptions`).
- **Type definitions** — `types.ts` provides `GlobalOptions`, `CommandContext`, `CommandDefinition`, and `OptionDefinition` (partially legacy; commands now use raw Yargs `Argv` builders).
- **Shared utilities** — `utils.ts` centralizes: Playwright browser installation check, protocol resolution (auto/stdio/http), port/host validation, auth config parsing/validation, `AppServerConfig` factory, HTTP header parsing, event-service creation, embedding model resolution, and interactive embedding-model-change confirmation.
- **Lifecycle** — `main.ts` owns `runCli()`, the SIGINT handler, `cleanupCliCommand()` (exits for short-lived commands), and HMR cleanup for vite-node `--watch`.

## Flow
1. `runCli()` → `createCli(argv)` builds the Yargs parser with all commands + global middleware
2. Middleware runs before each command: validates options → resolves store path → loads config → sets log level → initializes telemetry → creates EventBusService/TelemetryService → attaches `_eventBus` to argv context
3. Command handler executes: tracks telemetry → loads config (again, for command-specific overrides) → creates `IDocumentManagement` (local or remote) → optionally creates `IPipeline` → runs the tool → renders output
4. For long-running commands (default, mcp, web, worker): blocks with `await new Promise(() => {})` and registers services via `registerGlobalServices()` for SIGINT-driven shutdown
5. For short-lived commands (list, search, scrape, refresh, remove, find-version, fetch-url, config): `main.ts` auto-calls `cleanupCliCommand()` → `process.exit(0)`

## Integration
- Consumed by: `bin/scrapegoat` entry point, vite-node dev mode
- Depends on: `yargs`, `@toon-format/toon`, `yaml`, `playwright`, `../app` (AppServer), `../mcp` (stdio server), `../pipeline` (PipelineFactory), `../store` (DocumentManagementService/Client), `../telemetry`, `../events`, `../tools`, `../scraper`, `../auth`, `../utils/config`, `../utils/logger`, `../utils/paths`
