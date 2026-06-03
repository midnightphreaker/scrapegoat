## Responsibility

Implements the Model Context Protocol (MCP) server that exposes documentation scraping, searching, and management as tools and resources to AI assistants. Supports both HTTP (SSE/streamable) and stdio transports. Conditionally gates write tools in read-only mode.

## Design

- **Factory pattern**: `createMcpServerInstance(tools, config)` creates an `McpServer` from the MCP SDK and registers all tools and resources conditionally based on `config.app.readOnly`.
- **Tool abstraction**: `McpServerTools` interface defines 11 tool instances (`ScrapeTool`, `SearchTool`, `RefreshVersionTool`, `ListLibrariesTool`, `FindVersionTool`, `ListJobsTool`, `GetJobInfoTool`, `CancelJobTool`, `ClearCompletedJobsTool`, `RemoveTool`, `FetchUrlTool`). `initializeTools()` constructs them with resolved dependencies.
- **Response helpers**: `utils.ts` provides `createResponse()` and `createError()` to produce `CallToolResult` objects with standardized `isError` flag.
- **Dual transport**: `startStdioServer()` connects an MCP server via `StdioServerTransport` for IDE/CLI integration; HTTP transport is handled by `AppServer` through the MCP SDK's Fastify integration.
- **Resource URIs**: Exposes `docs://libraries`, `docs://libraries/{library}/versions`, `docs://jobs`, and `docs://jobs/{jobId}` as dynamic resource templates.
- **Telemetry**: Every tool invocation is tracked with `TelemetryEvent.TOOL_USED` including tool name, library, version, and sanitized URL.

## Flow

1. CLI command creates `IDocumentManagement` + `IPipeline` → calls `initializeTools(docService, pipeline, config)`.
2. For stdio: `startStdioServer(tools, config)` creates MCP server, connects `StdioServerTransport`, returns `McpServer`.
3. For HTTP: `registerMcpService()` in `AppServer` creates MCP server and attaches it to the Fastify HTTP/SSE handlers.
4. Tool handlers receive validated Zod input → delegate to tool `.execute()` → return `createResponse()` or `createError()`.
5. Resource handlers call `listLibraries`/`listJobs`/`getJobInfo` tools and return URI-mapped content.

## Integration

- **Consumers**: CLI commands (`default`, `mcp`) via `startStdioServer` and `initializeTools`; `AppServer` via `registerMcpService`.
- **Dependencies**: `@modelcontextprotocol/sdk` (McpServer, StdioServerTransport, ResourceTemplate), `../tools` (all tool classes), `../pipeline` (IPipeline), `../store` (IDocumentManagement), `../telemetry`.
