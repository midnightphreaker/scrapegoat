# src/mcp/

## Responsibility
Registers and serves all MCP (Model Context Protocol) tools and resources that AI agents use to scrape, search, and manage documentation.

## Design
- **Factory pattern**: `createMcpServerInstance()` builds a configured `McpServer` with all tools and resources registered. Tools are injected as a shared `McpServerTools` object to avoid re-instantiation.
- **Read-only gating**: Write/job tools (`scrape_docs`, `refresh_version`, `list_jobs`, `get_job_info`, `cancel_job`, `clear_completed_jobs`, `remove_docs`) are conditionally registered based on `config.app.readOnly`.
- **Transport-agnostic**: The factory returns a plain `McpServer`; transport binding (stdio, SSE, streamable HTTP) is handled by callers.
- **Tool interface**: `McpServerTools` defines 11 tool instances. `initializeTools()` wires each to its dependency (`IDocumentManagement`, `IPipeline`, `AppConfig`).
- **Response helpers**: `createResponse()` / `createError()` wrap text into the MCP `CallToolResult` shape.
- **Zod schemas**: Every tool parameter is validated via `zod` schemas declared inline with `server.tool()`.

## Flow
1. Entry point calls `initializeTools(docService, pipeline, config)` → returns `McpServerTools`.
2. `createMcpServerInstance(tools, config)` registers 8 tools + 2 resources (+ 4 more tools + 2 more resources if not read-only).
3. Each tool handler: tracks telemetry → delegates to the corresponding tool's `.execute()` → formats result via `createResponse`/`createError`.
4. Scrape/refresh jobs fire async (`waitForCompletion: false`), returning a jobId immediately.
5. Resources (`docs://libraries`, `docs://libraries/{library}/versions`, `docs://jobs`, `docs://jobs/{jobId}`) provide read-only URI-based access to indexed data.

## Integration
- Consumed by: `startStdioServer.ts` (CLI stdio mode), `mcpService.ts` (HTTP/SSE/Streamable HTTP via Fastify)
- Depends on: `@modelcontextprotocol/sdk`, `../tools` (tool classes), `../pipeline/types`, `../scraper/types`, `../telemetry`, `../utils/config`, `../utils/logger`
