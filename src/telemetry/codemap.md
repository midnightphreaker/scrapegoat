## Responsibility

The telemetry module provides privacy-first analytics for the application using PostHog. It tracks application lifecycle events (startup, shutdown), CLI usage, tool invocations, and pipeline job lifecycle (started, completed, failed). All event data is sanitized, property keys are converted to snake_case for PostHog compatibility, and the system supports opt-out via configuration. A unique installation ID is persisted to disk to anonymously identify installations without collecting personal data.

## Design

- **`Telemetry`** (class in `telemetry.ts`): High-level coordinator and public API. Created via `Telemetry.create()` factory method. Holds a `PostHogClient` instance, a `distinctId` (installation ID), and an optional `globalContext` record merged into every event. Exposes `track()`, `captureException()`, `setGlobalContext()`, `shutdown()`, and `isEnabled()`. A module-level `Proxy`-based `telemetry` export delegates all property access to the lazily-initialized singleton, ensuring configuration changes are always reflected.
- **`TelemetryEvent`** (enum in `telemetry.ts`): Defines all tracked event names — `APP_STARTED`, `APP_SHUTDOWN`, `CLI_COMMAND`, `TOOL_USED`, `PIPELINE_JOB_STARTED`, `PIPELINE_JOB_COMPLETED`, `PIPELINE_JOB_FAILED`.
- **`TelemetryEventPropertiesMap`** (interface in `eventTypes.ts`): Maps each `TelemetryEvent` enum value to its strongly-typed properties interface (e.g., `PipelineJobCompletedProperties`). Provides compile-time type safety for `track()` calls.
- **`PostHogClient`** (class in `postHogClient.ts`): Wraps the `posthog-node` SDK. Configured for privacy (no geoip, no session recording, memory-only persistence). Transforms camelCase property keys to snake_case via `convertPropertiesToSnakeCase()` and maps standard properties (`sessionId` → `$session_id`, `startTime` → `$start_timestamp`, `appVersion` → `$app_version`). Batches events (flush at 20 or 10 seconds).
- **`TelemetryConfig`** (singleton in `TelemetryConfig.ts`): Manages the enabled/disabled state. `isEnabled()` checks both the user preference flag and the `__POSTHOG_API_KEY__` compile-time global. `generateInstallationId()` persists a UUID to `<storePath>/installation.id` for cross-run identification.
- **`TelemetryService`** (class in `TelemetryService.ts`): Event-driven bridge that subscribes to `EventBusService` events (`JOB_STATUS_CHANGE`, `JOB_PROGRESS`). Translates pipeline job state transitions into `telemetry.track()` calls with computed metrics (duration, throughput, queue wait time).
- **`sanitizer.ts`**: Utility functions for privacy-safe data extraction — `extractHostname()`, `extractProtocol()`, `analyzeSearchQuery()`, `sanitizeErrorMessage()`, `sanitizeError()`, and `extractCliFlags()`.
- **`index.ts`**: Barrel file re-exporting all public types, classes, and functions.

## Flow

1. Application startup calls `initTelemetry({ enabled, storePath })`, which configures `TelemetryConfig`, generates/retrieves the installation ID, and creates the `Telemetry` singleton.
2. `Telemetry.create()` reads the config, instantiates `PostHogClient` (or skips if disabled/no API key), and stores the `distinctId`.
3. `TelemetryService` subscribes to `EventBusService` events at construction time.
4. When a pipeline job changes status, `TelemetryService.handleJobStatusChange()` computes metrics and calls `telemetry.track()` with a typed `TelemetryEvent` and properties.
5. `telemetry.track()` merges global context into properties, adds a timestamp, and delegates to `PostHogClient.capture()`.
6. `PostHogClient.capture()` adds PostHog standard properties, converts keys to snake_case, and calls `posthog-node`'s `capture()`.
7. On shutdown, `telemetry.shutdown()` flushes pending events through `PostHogClient.shutdown()`, and `TelemetryService.shutdown()` unsubscribes from the event bus.

## Integration

- **Consumed by**: `src/app.ts` (init and shutdown), `src/events/EventBusService` (subscribed by `TelemetryService`), CLI entry points, any module importing `telemetry` proxy for ad-hoc tracking
- **Depends on**: `posthog-node` (npm package), `src/utils/logger`, `src/utils/paths` (store path resolution), `src/events/EventBusService` and `src/events/types` (event-driven integration), `src/pipeline/types` (`PipelineJob`, `PipelineJobStatus`), `src/scraper/types` (`ScraperProgressEvent`)
