## Responsibility

Application-wide event distribution system. `EventBusService` provides a typed pub/sub layer that decouples event producers (pipeline, store) from consumers (web UI via SSE, remote workers via tRPC, telemetry). `RemoteEventProxy` bridges events from an external tRPC worker to the local event bus.

## Design

- **Observer pattern**: `EventBusService` wraps Node.js `EventEmitter` with typed `emit()`/`on()`/`once()`/`off()` methods constrained to `EventType` enum and `EventPayloads` mapped type.
- **Event taxonomy**: `types.ts` defines `EventType` enum (JOB_STATUS_CHANGE, JOB_PROGRESS, LIBRARY_CHANGE, JOB_LIST_CHANGE, DB_UPDATE_FAILED, JOB_CANCEL_TIMEOUT), typed payloads (`EventPayloads`), SSE wire format (`SseEventPayloads`), and `ServerEventName` mapping from internal enum to wire names.
- **tRPC subscriptions**: `trpc/router.ts` exposes a `subscribe` procedure using tRPC observables, allowing remote clients to subscribe to filtered or all event types over WebSocket.
- **Remote bridging**: `RemoteEventProxy` creates a tRPC client with split link (WS for subscriptions, HTTP for queries), subscribes to `events.subscribe`, and re-emits received events on the local `EventBusService`. Uses exponential backoff with jitter for reconnection (max 10 attempts, 1s–30s range).

## Flow

1. `EventBusService` is instantiated in CLI middleware and passed to all services.
2. Producers (e.g., `PipelineManager.updateJobStatus()`) call `eventBus.emit(EventType.JOB_STATUS_CHANGE, payload)`.
3. Local consumers subscribe via `eventBus.on(EventType, callback)` — returns unsubscribe function.
4. For tRPC: `eventsRouter.subscribe` creates an observable that listens on the event bus and forwards events to connected clients.
5. For remote workers: `RemoteEventProxy.connect()` subscribes to the remote tRPC events router; `onData` calls `localEventBus.emit()` to replay events locally.

## Integration

- **Consumers**: `AppServer` (creates instance), `PipelineManager` (emits job events), web service (SSE bridge), tRPC router (subscription endpoint), `TelemetryService` (listens for events), `PipelineClient.waitForJobCompletion()` (listens for status changes).
- **Dependencies**: `@trpc/server` (observables), `@trpc/client` (WebSocket/http split link), `superjson`.
