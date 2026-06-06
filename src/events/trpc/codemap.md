# events/trpc/

## Responsibility
tRPC router that exposes event bus subscriptions to remote tRPC clients (used by `RemoteEventProxy` in distributed deployments).

## Design
- **`createEventsRouter(trpc)`** — factory function that accepts a tRPC instance and returns a router with a single `subscribe` procedure.
- **`subscribe`** — tRPC subscription procedure. Accepts optional input filtering by event types (defaults to all `EventType` values). Returns an `observable` that listens on the `EventBusService` for each requested event type and emits `{ type, payload }` objects. Properly cleans up all listeners on client disconnect.
- **`EventsTrpcContext`** — required context shape: `{ eventBus: EventBusService }`.
- **`eventsRouter`** — default exported instance for standalone usage. `EventsRouter` type exported for consumer type inference.
- Uses `superjson` transformer and `zod` for input validation.

## Flow
1. Remote `RemoteEventProxy` connects via tRPC WebSocket client to `events.subscribe`.
2. Router creates observables that listen to `ctx.eventBus.on(eventType, ...)` for each requested event type.
3. Events flow: local bus → observable → tRPC WebSocket → remote `RemoteEventProxy` → remote local bus.

## Integration
- Consumed by: `services/trpcService` (mounted as a sub-router in the main tRPC API), `events/RemoteEventProxy` (client-side consumer).
- Depends on: `@trpc/server`, `events/EventBusService`, `events/types` (EventType).
