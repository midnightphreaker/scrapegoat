# app/

## Responsibility
Modular application server that composes configurable services (web UI, MCP, tRPC API, worker) onto a single Fastify HTTP instance.

## Design
- **`AppServer`** — central orchestrator. Receives DI dependencies (`IDocumentManagement`, `IPipeline`, `EventBusService`), an `AppServerConfig` (service toggles), and an `AppConfig` (env/YAML settings). Validates config, sets up error handling/telemetry, then conditionally enables services via dedicated service-registration modules (`registerWebService`, `registerMcpService`, `registerTrpcService`, `registerWorkerService`).
- **`AppServerConfig`** — pure interface. Controls service composition and runtime wiring (port, feature flags, external worker URL, startup telemetry context). Does not duplicate `AppConfig` settings.
- Lifecycle: `start()` → `validateConfig()` → `setupServer()` → `listen()` → optionally `setupWebSocketServer()` → `logStartupInfo()`. `stop()` tears down in reverse order (remote proxy → worker → MCP → WebSocket → telemetry → HTTP).
- Telemetry hooks are wired early: global `unhandledRejection`/`uncaughtException` listeners, Fastify error handler, and startup/shutdown tracking events.
- Static file serving (`public/`) is registered last as a fallback route.

## Flow
1. `AppServer.start()` validates config, initializes telemetry.
2. `setupServer()` registers plugins (formbody, auth hooks, auth metadata endpoints), then conditionally enables each service.
3. Fastify `listen()` binds the HTTP port.
4. If API server is enabled, a `WebSocketServer` is attached to the HTTP server for tRPC subscriptions.
5. If an external worker URL is configured, `RemoteEventProxy.connect()` starts in the background.
6. On shutdown, all resources are cleaned up in reverse dependency order.

## Integration
- Consumed by: CLI entry points and test harnesses that construct `AppServerConfig` based on command flags.
- Depends on: `auth` (ProxyAuthManager), `events` (EventBusService, RemoteEventProxy), `services/*` (mcpService, trpcService, webService, workerService), `store/trpc/interfaces` (IDocumentManagement), `pipeline/trpc/interfaces` (IPipeline), `telemetry`, `utils/config`, `utils/logger`.
