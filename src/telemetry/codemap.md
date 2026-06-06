# src/telemetry/

## Responsibility
Privacy-first analytics system that tracks application lifecycle, tool usage, and pipeline job events via PostHog with automatic data sanitization.

## Design
- **Layered architecture**: `Telemetry` (public API) → `PostHogClient` (SDK wrapper) → PostHog cloud. Global context is merged into every event.
- **Singleton + Proxy**: `TelemetryConfig` is a singleton controlling the enabled flag. The exported `telemetry` object is a JS `Proxy` that always delegates to the lazily-initialized global `Telemetry` instance, ensuring config changes take effect immediately.
- **Installation identity**: `generateInstallationId()` persists a UUID in the data directory for cross-run distinct ID tracking.
- **Event enum + typed properties**: `TelemetryEvent` enum defines event names. `TelemetryEventPropertiesMap` maps each event to its strongly-typed property interface.
- **Property conversion**: `PostHogClient` automatically converts camelCase keys to snake_case and maps standard properties (`sessionId` → `$session_id`, etc.) before capture.
- **Event-driven tracking**: `TelemetryService` subscribes to `EventBusService` events (`JOB_STATUS_CHANGE`, `JOB_PROGRESS`) and translates pipeline state transitions into telemetry events, decoupling analytics from pipeline internals.
- **Sanitization utilities**: `sanitizer.ts` provides hostname extraction, query pattern analysis, error message redaction, and CLI flag extraction — all designed to preserve diagnostic value without exposing sensitive data.

## Flow
1. `initTelemetry({ enabled, storePath })` → configures `TelemetryConfig` singleton → creates `Telemetry` instance via factory.
2. `Telemetry.create()` → reads config → instantiates `PostHogClient` → generates `distinctId`.
3. `telemetry.track(event, properties)` → merges global context + timestamp → `PostHogClient.capture()` → converts to snake_case → sends to PostHog.
4. `TelemetryService` listens on `EventBusService` → on `JOB_STATUS_CHANGE` (running/completed/failed) → calls `telemetry.track()` with job metrics.
5. On shutdown: `telemetry.shutdown()` → `PostHogClient.shutdown()` → flushes queued events.

## Integration
- Consumed by: `../mcp/mcpServer.ts` (tool usage tracking), `../services/mcpService.ts` (connection logging), `../pipeline/*` (via TelemetryService), `AppServer` (lifecycle events)
- Depends on: `posthog-node`, `../events/EventBusService`, `../events/types`, `../pipeline/types`, `../utils/logger`, `../utils/paths`
