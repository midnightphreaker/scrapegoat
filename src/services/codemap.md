# src/services/

## Responsibility

This module provides modular service registration functions that compose the application's Fastify server. Each service file registers a distinct capability onto a shared `FastifyInstance`: MCP protocol endpoints for AI tool integration (`mcpService`), tRPC API routes and WebSocket subscriptions (`trpcService`), human-facing web UI routes (`webService`), and embedded background job processing (`workerService`). The pattern enables `AppServer` to selectively activate only the services needed for a given deployment mode (local, worker, remote).

## Design

- **Registration pattern**: Every service exports an async `register*Service(server, ...dependencies)` function that receives a `FastifyInstance` and the domain services it needs. The caller (`AppServer`) orchestrates startup order and dependency wiring.
- **`mcpService.ts`** — `registerMcpService()` and `cleanupMcpService()`. Manages three MCP transport types: SSE (`/sse` + `/messages`), and Streamable HTTP (`/mcp`). Creates per-session `McpServer` instances with tools from `initializeTools()`. Tracks transports, servers, and heartbeat intervals in plain `Record<string, T>` maps attached to the returned `McpServer` for cleanup. CORS is applied via an `onRequest` hook scoped to `/mcp`, `/sse`, `/messages`. Optional `ProxyAuthManager` gates `/sse` and `/mcp` via `createAuthMiddleware`.
- **`trpcService.ts`** — `registerTrpcService()` and `applyTrpcWebSocketHandler()`. Builds a unified tRPC router merging procedures from `createPipelineRouter`, `createDataRouter`, `createEventsRouter`, and a root `ping` health-check. Uses a `UnifiedContext` type combining `PipelineTrpcContext`, `DataTrpcContext`, and `EventsTrpcContext`. Auth is enforced per-request in `createContext` when `ProxyAuthManager.authConfig.enabled` is true. WebSocket support attaches the same router to a `WebSocketServer` via `applyWSSHandler`.
- **`webService.ts`** — `registerWebService()`. Instantiates tool classes (`ListLibrariesTool`, `ScrapeTool`, `RemoveTool`, `RefreshVersionTool`, `SearchTool`, `CancelJobTool`, `ClearCompletedJobsTool`, `ListJobsTool`) and delegates to individual route registration functions from `src/web/routes/`. Supports an optional `externalWorkerUrl` for distributed mode.
- **`workerService.ts`** — `registerWorkerService()` and `stopWorkerService()`. Thin wrappers around `IPipeline.start()` / `IPipeline.stop()`. Does **not** call `pipeline.setCallbacks()` to avoid overwriting the event bus bridge configured in `AppServer`.

## Flow

1. `AppServer` creates a `FastifyInstance` and resolves dependencies (pipeline, docService, eventBus, authManager, config).
2. Based on deployment mode, `AppServer` calls the appropriate `register*Service()` functions.
3. `registerTrpcService` merges feature routers and registers the tRPC Fastify plugin at `/api`.
4. `registerMcpService` initializes tools, creates an MCP server, and registers SSE/HTTP routes with CORS and optional auth.
5. `registerWebService` instantiates tool classes and delegates to granular route registration functions for each UI feature.
6. `registerWorkerService` starts the pipeline for background job processing.
7. On shutdown, `cleanupMcpService` clears heartbeats, closes SSE transports/servers, and shuts down the MCP server. `stopWorkerService` stops the pipeline.

## Integration

- **Consumed by**: `src/appServer.ts` (calls all register/stop functions during startup and shutdown)
- **Depends on**:
  - `src/pipeline/trpc/interfaces.ts` (`IPipeline`) — pipeline operations for job management
  - `src/store/trpc/interfaces.ts` (`IDocumentManagement`) — document/store CRUD
  - `src/events/EventBusService.ts` (`EventBusService`) — event bus for real-time notifications
  - `src/auth/ProxyAuthManager.ts` (`ProxyAuthManager`) — optional OAuth2/OIDC authentication
  - `src/auth/middleware.ts` (`createAuthMiddleware`) — Fastify auth preHandler for MCP routes
  - `src/mcp/mcpServer.ts` (`createMcpServerInstance`) — MCP server factory
  - `src/mcp/tools.ts` (`initializeTools`) — MCP tool registration
  - `src/tools/` — tool classes instantiated by `webService` (ScrapeTool, RemoveTool, etc.)
  - `src/web/routes/` — individual web route registration functions
  - `src/utils/config.ts` (`AppConfig`) — application configuration
  - `src/utils/logger.ts` — structured logging
  - `src/telemetry.ts` — telemetry enablement checks
  - External: `@trpc/server`, `@modelcontextprotocol/sdk`, `fastify`, `ws`, `superjson`
