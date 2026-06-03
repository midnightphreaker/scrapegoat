## Responsibility

Central application server that provides modular service composition over a single Fastify HTTP instance. `AppServer` conditionally enables web UI, MCP endpoints, tRPC API, and an embedded worker based on `AppServerConfig`, and manages their shared lifecycle (start, stop, WebSocket upgrade, telemetry, and authentication).

## Design

- **Composition pattern**: `AppServer` delegates to service registration functions (`registerWebService`, `registerMcpService`, `registerTrpcService`, `registerWorkerService`) rather than owning service implementations directly.
- **Configuration separation**: `AppServerConfig` controls runtime service composition (which services to enable, port, external worker URL), while `AppConfig` is the source of truth for host, auth, telemetry, and scraper settings.
- **WebSocket gateway**: A `WebSocketServer` (`ws`) is attached to the HTTP server after `listen()` and wired to tRPC's subscription handler via `applyTrpcWebSocketHandler`.
- **Telemetry integration**: Startup, shutdown, and unhandled errors are tracked through the global `telemetry` singleton with `TelemetryEvent` enum values.
- **OAuth2 proxy**: Auth is initialized through `ProxyAuthManager`, which registers OAuth2/OIDC routes (authorization, token, revocation, registration, well-known metadata) on the Fastify instance.
- **Remote event bridging**: When using an external worker, a `RemoteEventProxy` subscribes to remote tRPC events and re-emits them on the local `EventBusService`.

## Flow

1. `start()` validates config, initializes telemetry, then calls `setupServer()`.
2. `setupServer()` registers error handlers, creates `RemoteEventProxy` (if external worker), initializes auth, registers Fastify plugins (`formbody`), then conditionally enables each service via dedicated `enable*()` methods.
3. `server.listen()` binds the HTTP port; if API server is enabled, `setupWebSocketServer()` creates a `WebSocketServer` and applies the tRPC WS handler.
4. If `remoteEventProxy` exists, its `connect()` is called (non-blocking) to start forwarding remote events.
5. `stop()` disconnects the remote proxy, stops the worker, cleans up MCP, closes the WebSocket server (terminating all clients), flushes telemetry, and closes Fastify.

## Integration

- **Consumers**: CLI commands (`default`, `web`, `mcp`, `worker`) construct and start `AppServer` via the `startAppServer()` convenience export.
- **Dependencies**: `IDocumentManagement` (store), `IPipeline` (pipeline), `EventBusService` (events), `AppConfig`, service modules from `../services/*`.
