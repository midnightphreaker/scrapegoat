# src/services/

## Responsibility
Composable service registration layer that wires domain capabilities (MCP, tRPC API, web UI, background worker) onto shared Fastify server instances.

## Design
- **Modular registration**: Each service exports a `register*Service()` function that takes a `FastifyInstance` plus domain dependencies and registers routes/handlers on it. This allows `AppServer` to compose only the services needed for a given run mode.
- **Shared tool instances**: Both `mcpService` and `webService` instantiate their own tool objects from `../tools` classes, wired to the same `IDocumentManagement` / `IPipeline` backends.
- **Auth integration**: `mcpService` and `trpcService` accept an optional `ProxyAuthManager` and apply auth middleware to their routes.
- **Session lifecycle**: `mcpService` manages per-session SSE transports, heartbeat intervals, and streamable HTTP sessions with cleanup via `cleanupMcpService()`.
- **tRPC unification**: `trpcService` merges pipeline, data store, and events routers into a single tRPC endpoint at `/api`, with optional WebSocket subscriptions via `applyTrpcWebSocketHandler()`.
- **Minimal worker**: `workerService` simply starts/stops the pipeline; all callback wiring is done externally in `AppServer.setupPipelineEventBridge()`.

## Flow
1. `AppServer` creates a Fastify instance, then calls desired `register*Service()` functions in sequence.
2. `registerMcpService()` → initializes `McpServerTools` → creates `McpServer` → registers SSE (`/sse`, `/messages`) and Streamable HTTP (`/mcp`) routes with CORS and optional auth.
3. `registerTrpcService()` → builds unified tRPC router → registers `fastifyTRPCPlugin` at `/api`.
4. `registerWebService()` → instantiates tool classes → delegates to `../web/routes/*` register functions for human-facing HTML routes.
5. `registerWorkerService()` → calls `pipeline.start()` to begin background job processing.

## Integration
- Consumed by: `AppServer` (top-level server composition)
- Depends on: `fastify`, `@trpc/server`, `@modelcontextprotocol/sdk`, `../mcp/*`, `../tools/*`, `../pipeline/trpc/interfaces`, `../store/trpc/interfaces`, `../events/EventBusService`, `../auth/ProxyAuthManager`, `../web/routes/*`, `../utils/config`, `../utils/logger`
