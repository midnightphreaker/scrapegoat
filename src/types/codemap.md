# src/types/

## Responsibility
Shared type definitions and ambient module declarations used across the project.

## Design
- `index.ts` — generic `ProgressCallback<T>` type and `ProgressResponse` interface for streaming progress updates
- `build-env.d.ts` — ambient `const` declarations for Vite-injected build-time variables (`__POSTHOG_API_KEY__`, `__APP_VERSION__`)
- `turndown-plugin-gfm.d.ts` — handwritten type declarations for `@joplin/turndown-plugin-gfm` (untyped third-party package), exporting GFM plugin functions

## Flow
Types are imported directly by consuming modules. Build-time constants are replaced at compile time by Vite's `define` feature.

## Integration
- Consumed by: all modules that need progress reporting or use turndown GFM plugins
- Depends on: nothing (leaf module)
