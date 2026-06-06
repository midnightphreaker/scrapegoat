# src/web/

## Responsibility
Web UI layer: Fastify server bootstrap, SSE event bridge, and client-side Alpine.js/HTMX initialization for the ScrapeGoat dashboard.

## Design
- **web.ts** — Server entry point. `startWebServer()` creates a Fastify instance, registers `formbody` and `static` plugins, instantiates tool objects (ScrapeTool, ListLibrariesTool, SearchTool, etc.), delegates to per-domain route registration functions, then calls `server.listen()`. `stopWebServer()` gracefully closes the server.
- **EventClient.ts** — Browser-side SSE client. Wraps `EventSource("/web/events")`, subscribes to all `ServerEventName` typed events, parses JSON payloads, and fans out to a `Set<EventCallback>`. Provides `connect()` / `disconnect()` / `subscribe()` lifecycle.
- **main.client.ts** — Client bootstrap bundled as the app entry point. Registers Alpine.js plugins (collapse), exposes Alpine globally for Idiomorph, initializes a global `toast` Alpine store, creates and connects an `EventClient`, dispatches received SSE events as DOM `CustomEvent`s for HTMX triggers. Also manages: confirmation timeouts (survive HTMX swaps), Alpine lifecycle hooks (`beforeSwap` → `destroyTree`, `afterSwap` → `initTree`), global HTMX error/response handlers, and version update checking against GitHub Releases API.

## Flow
1. `startWebServer()` initializes Fastify → registers routes → listens on configured host:port.
2. Browser loads `main.client.ts` → Alpine starts → `EventClient` connects to `/web/events`.
3. SSE events from the server → `EventClient` → DOM `CustomEvent` → HTMX `hx-trigger` handlers → partial page swaps.
4. User interactions → HTMX requests → route handlers → tool invocations → pipeline/doc service mutations.
5. Version update check fires once on page load via Alpine `x-init`.

## Integration
- Consumed by: `src/index.ts` (calls `startWebServer` / `stopWebServer`)
- Depends on: `fastify`, `@fastify/formbody`, `@fastify/static`, `alpinejs`, `idiomorph/htmx`, `flowbite`, all route registration modules, all tool classes, `PipelineManager`, `DocumentManagementService`, `AppConfig`, event types from `src/events/types`
