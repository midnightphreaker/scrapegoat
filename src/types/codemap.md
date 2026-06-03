## Responsibility

Provides **shared type declarations** for the application: a generic `ProgressCallback<T>` type and `ProgressResponse` interface used across pipeline and tool layers, build-time environment variable declarations (`__POSTHOG_API_KEY__`, `__APP_VERSION__`), and ambient module declarations for untyped third-party packages (`@joplin/turndown-plugin-gfm`).

## Design

- **Ambient Module Declarations**: `build-env.d.ts` declares compile-time globals injected by Vite's `define` config; `turndown-plugin-gfm.d.ts` provides TypeScript bindings for a JS-only package using `declare module`.
- **Generic Progress Types**: `ProgressCallback<T>` enables typed progress reporting across heterogeneous pipeline stages; `ProgressResponse` standardises the wire format for MCP/tool progress events.
- **No Runtime Code**: All files are pure type declarations — no emitted JavaScript.

## Flow

1. TypeScript compiler loads these declarations during type-checking.
2. `build-env.d.ts` constants are resolved at build time by Vite's `define` replacements.
3. `turndown-plugin-gfm.d.ts` enables `import { gfm, tables }` with full type safety.
4. `ProgressCallback<T>` and `ProgressResponse` are imported by pipeline tools, MCP handlers, and any module that reports incremental progress.

## Integration

- **Consumed by**: All modules importing `ProgressCallback` or `ProgressResponse` (pipeline, tools, MCP), `src/scraper/` (turndown GFM plugin usage), Vite build (env variable substitution).
- **Depends on**: `turndown` (peer type dependency for GFM plugin declarations).
