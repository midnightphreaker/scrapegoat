# src/web/routes/

## Responsibility
Fastify route registration modules for the ScrapeGoat web UI: health checks and real-time SSE event streaming.

## Design
Each file exports a single `register*Route(server, ...deps)` function that attaches routes to a Fastify instance. This pattern keeps route registration declarative in `web.ts` while allowing dependency injection of services/tools.

### Files

**health.ts**
- `registerHealthRoute(server)` — Registers `GET /api/health` returning `{ status: "ok" }`. Used for health checks (e.g., Docker, load balancers).

**events.ts**
- `registerEventsRoute(server, eventBus)` — Registers `GET /web/events` as an SSE (Server-Sent Events) endpoint.
  - Sets `text/event-stream` headers with `Cache-Control: no-cache` and `X-Accel-Buffering: no`.
  - Subscribes to all `EventType` variants on the `EventBusService` (`JOB_STATUS_CHANGE`, `JOB_PROGRESS`, `LIBRARY_CHANGE`, `JOB_LIST_CHANGE`, `DB_UPDATE_FAILED`).
  - `convertToSsePayload()` maps internal event payloads to wire-safe SSE shapes (serializes dates, strips internals). Uses exhaustive switch for type safety.
  - `sendSseMessage()` writes `event: <name>\ndata: <json>\n\n` frames to the raw response.
  - Sends 30-second heartbeats (`: heartbeat\n\n`) to keep connections alive through proxies.
  - Cleans up all subscriptions and heartbeat interval on client disconnect/error.

## Flow
1. `web.ts` calls `registerHealthRoute(server)` and `registerEventsRoute(server, eventBus)`.
2. Browser `EventClient` connects to `/web/events` → server subscribes to EventBusService.
3. Internal events (job status changes, progress, library changes) → event bus → SSE frames → browser.
4. `/api/health` returns a simple JSON status for infrastructure monitoring.

## Integration
- Consumed by: `src/web/web.ts` (registers all routes)
- Depends on: `fastify`, `src/events/EventBusService`, `src/events/types` (EventType, ServerEventName, SseEventPayloads), `src/pipeline/types`, `src/scraper/types`, `src/utils/logger`
