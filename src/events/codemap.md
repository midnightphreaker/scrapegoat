# events/

## Responsibility
Application-wide pub/sub event bus and remote event forwarding for distributing pipeline/job lifecycle events to local subscribers, tRPC clients, and SSE consumers.

## Design
- **`EventBusService`** — thin wrapper over Node.js `EventEmitter`. Typed `emit`/`on`/`once`/`off` API using `EventType` enum and `EventPayloads` map. Max listeners raised to 100 to support multiple subscribers. Returns unsubscribe functions from `on()`.
- **`RemoteEventProxy`** — bridges events from a remote tRPC worker to the local `EventBusService`. Creates a tRPC client with split link (WebSocket for subscriptions, HTTP batch for queries/mutations). Subscribes to all events from the remote worker and re-emits them locally. Implements exponential-backoff reconnection with jitter (max 10 attempts, base 1s, cap 30s).
- **`types.ts`** — `EventType` enum (6 event types: job status/progress, library change, job list change, db update failed, job cancel timeout). `EventPayloads` maps each type to its typed payload (references `PipelineJob`, `ScraperProgressEvent`). `ServerEventName` maps internal enum values to SSE wire names. `SseEventPayloads` defines the exact JSON shape sent to frontend clients.

## Flow
1. Services (e.g., DocumentManagementService, worker) call `eventBus.emit(EventType.X, payload)`.
2. Local subscribers (web service SSE handlers, tRPC subscription router) receive events immediately.
3. For external worker deployments: `RemoteEventProxy` subscribes to remote tRPC `events.subscribe` and re-emits on the local bus, making remote events transparent to local consumers.

## Integration
- Consumed by: `app/AppServer`, `services/webService` (SSE), `services/trpcService` (tRPC router), `services/workerService`, `store/*` (emits LIBRARY_CHANGE, DB_UPDATE_FAILED).
- Depends on: `@trpc/client` (RemoteEventProxy), `pipeline/types` (PipelineJob), `scraper/types` (ScraperProgressEvent), `utils/logger`.
