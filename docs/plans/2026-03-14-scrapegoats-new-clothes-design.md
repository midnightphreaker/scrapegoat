# ScrapeGoat's New Clothes - SvelteKit WebUI Design

**Date:** 2026-03-14
**Status:** Approved
**Author:** Claude (with Master)

## Overview

Complete redesign of Scrapegoat's WebUI from JSX SSR + Alpine.js + HTMX to Svelte 5 + SvelteKit. The goal is a simpler, more maintainable architecture with better debugging experience and smaller bundle size.

## Architecture Decision

**Chosen: Hybrid Static SPA + Fastify API**

```
Browser (SvelteKit SPA) ──► Fastify Server :6281
   │                           ├── tRPC /api/trpc/*
   │                           ├── SSE /web/jobs/events
   │                           ├── MCP /sse, /mcp
   │                           └── Static files public/webui/
   └── tRPC client
   └── EventSource (SSE)
```

**Why this approach:**
- Single port deployment
- Simple build (vite build → public/webui/)
- No separate server to manage
- Works with existing Docker setup

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Svelte 5 + SvelteKit | Latest |
| UI Components | shadcn-svelte + Bits UI | Latest |
| Styling | Tailwind CSS | v4.x (existing) |
| State | Svelte 5 runes (`$state`) | Built-in |
| API Client | tRPC | Existing |
| Real-time | Server-Sent Events | Native EventSource |
| Forms | Superforms + Zod | Latest |
| Tables | TanStack Table v8 | Latest |
| Build | Vite 6 | Existing |
| Testing | Vitest + Playwright | Latest |
| Linting | Biome + ESLint (Svelte) | Latest |

## Features

### Included

| Feature | Description |
|---------|-------------|
| Job Queue | Submit, view progress, cancel jobs |
| Library List | View all indexed libraries with versions |
| Library Detail | View pages/snippets per version |
| Library Search | Full-text search within library |
| Delete Version | Remove indexed library version |
| Rescrape Version | Re-run scrape with original params |
| Inline Edit | Double-click to edit title/version |
| Multi-URL Jobs | Scrape multiple URLs into one library |
| Dark Mode | Theme toggle with persistence |
| Wide Mode | Expanded layout toggle |
| MCP Status | Header indicator for MCP connection |

### Removed

| Feature | Reason |
|---------|--------|
| Fetcher Selector | Always use 'auto' (tries HTTP first, then Crawl4AI) |
| Crawl4AI Options | Screenshots, media, links extraction not needed |

### Scraper Options (Preserved)

- Max Pages
- Max Depth
- Scope (Subpages, Hostname, Domain)
- Include Patterns
- Exclude Patterns
- Custom HTTP Headers
- Follow Redirects
- Ignore Errors During Scraping

## Project Structure

```
scrapegoat/
├── src/
│   ├── web-sveltekit/           # NEW: SvelteKit app
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── components/
│   │   │   │   │   ├── ui/        # shadcn-svelte primitives
│   │   │   │   │   ├── jobs/      # JobList, JobItem, ProgressBar
│   │   │   │   │   ├── libraries/ # LibraryList, LibraryItem, VersionBadge
│   │   │   │   │   ├── search/    # SearchForm, SearchResults
│   │   │   │   │   └── layout/    # Header, ThemeToggle
│   │   │   │   ├── stores/        # jobs, libraries, theme stores
│   │   │   │   ├── api/           # tRPC client, SSE client
│   │   │   │   └── utils/         # Helpers, formatters
│   │   │   ├── routes/
│   │   │   │   ├── +layout.svelte
│   │   │   │   ├── +page.svelte
│   │   │   │   └── libraries/[name]/+page.svelte
│   │   │   └── app.html
│   │   ├── static/
│   │   ├── package.json
│   │   ├── svelte.config.js
│   │   ├── vite.config.ts
│   │   └── tailwind.config.ts
│   │
│   └── web/                       # REMOVE: Old WebUI (after migration)
│
├── public/
│   └── webui/                     # SvelteKit build output
│
└── package.json                   # Workspace root
```

## Component Architecture

### Main Layout

```
+layout.svelte
├── Header
│   ├── Logo
│   ├── MCP Status Badge
│   ├── Theme Toggle
│   └── Wide Mode Toggle
└── <slot />
```

### Home Page (+page.svelte)

```
├── ScrapeForm
│   ├── URLInput[] (dynamic, max 10)
│   ├── LibraryField
│   ├── VersionField
│   └── AdvancedOptions (collapsible)
│       ├── MaxPages, MaxDepth
│       ├── Scope dropdown
│       ├── Include/Exclude Patterns
│       └── Custom Headers
│
├── JobQueue
│   └── JobItem[] (SSE subscription)
│       ├── ProgressBar
│       ├── StatusBadge
│       ├── CancelButton
│       └── ErrorDisplay
│
└── LibraryList
    └── LibraryItem[]
        ├── Title (editable)
        ├── VersionBadge[] (editable)
        ├── Stats
        ├── RescrapeButton
        └── DeleteButton
```

### Library Detail (/libraries/[name])

```
├── LibraryHeader (title, editable)
├── VersionTabs
├── Stats: Pages | Snippets | Last Indexed
├── SearchForm
│   ├── QueryInput
│   └── SearchButton
└── SearchResults
    └── SearchResult[] (markdown rendered)
```

## Data Flow

### State Management

```typescript
// Svelte 5 runes-based stores
export const jobsStore = $state({
  jobs: [] as Job[],
  loading: false,
  error: null as string | null,
});

export const librariesStore = $state({
  libraries: [] as Library[],
  loading: false,
  lastFetch: null as Date | null,
  cacheTTL: 30_000,
});

export const themeStore = $state({
  dark: false,
  wide: false,
});
```

### API Communication

```
SvelteKit Client
├── tRPC Client → Fastify tRPC routes
│   ├── jobs.getJobs()
│   ├── jobs.cancelJob()
│   ├── data.listLibraries()
│   ├── data.search()
│   ├── data.removeVersion()
│   └── pipeline.enqueueJob()
│
└── SSE Client → /web/jobs/events
    ├── job-progress events
    ├── job-status events
    └── auto-reconnect on disconnect
```

### Real-Time Updates

1. Client connects to `/web/jobs/events` via EventSource
2. Fastify SSE endpoint subscribes to PipelineManager callbacks
3. On job progress/status change, server broadcasts SSE event
4. Client receives event, updates jobsStore
5. UI reactively updates (Svelte 5 runes)

Fallback: If SSE fails 3 times, switch to polling every 5s.

## Error Handling

| Error Type | Display | Behavior |
|------------|---------|----------|
| Form validation | Inline below field | Red text, focus first error |
| API mutation error | Toast (sonner) | Red toast, 5s auto-dismiss |
| Network offline | Top banner | Sticky, auto-hide on reconnect |
| Job failure | JobItem section | Error message + retry button |
| SSE disconnected | Header badge | "Reconnecting..." |
| Critical error | ErrorBoundary | Full page with retry |

## Testing Strategy

```
        ┌───────┐
        │  E2E  │  5%  - Playwright
        │       │      - Critical flows only
        └───┬───┘
    ┌───────┴───────┐
    │  Integration  │  25% - Vitest + MSW
    │               │      - API client tests
    └───────┬───────┘
┌───────────┴───────────┐
│         Unit          │  70% - Vitest
│                       │      - Stores, utils
└───────────────────────┘
```

### E2E Test Cases

1. Submit scrape job → watch progress → complete
2. Cancel running job
3. Search library → view results
4. Delete version with confirmation
5. Rescrape version
6. Multi-URL job submission
7. Inline edit title/version

## Build & Deploy

### Development

```bash
npm run dev              # Runs both servers
├── vite dev :5173       # SvelteKit HMR
└── Fastify :6281        # Backend API
```

### Production Build

```bash
npm run build
├── vite build (SvelteKit) → public/webui/
└── vite build (Fastify) → dist/
```

### Docker

```dockerfile
# Multi-stage build
FROM node:22-slim
COPY dist/         # Fastify backend
COPY public/webui/ # SvelteKit static
EXPOSE 6281
CMD ["node", "dist/index.js"]
```

### Fastify Static Serve

```typescript
await server.register(fastifyStatic, {
  root: path.join(__dirname, '../public/webui'),
  prefix: '/',
});

// SPA fallback for client-side routing
server.setNotFoundHandler((req, reply) => {
  if (!req.url.startsWith('/api/') && !req.url.startsWith('/web/')) {
    return reply.sendFile('index.html');
  }
  reply.code(404).send({ error: 'Not found' });
});
```

## Migration Plan

1. **Create SvelteKit workspace** at `src/web-sveltekit/`
2. **Set up infrastructure** - vite, tailwind, shadcn-svelte
3. **Build core components** - Layout, JobQueue, LibraryList
4. **Wire up tRPC client** - connect to existing backend
5. **Add SSE real-time** - job progress updates
6. **Build remaining features** - search, edit, delete, rescrape
7. **Update Fastify** - serve static from public/webui/
8. **Remove old WebUI** - delete `src/web/` directory
9. **Update Docker** - build both in single stage
10. **Test E2E** - verify all flows work

## Success Criteria

- [ ] All features from design implemented
- [ ] E2E tests pass for critical flows
- [ ] Build time < 60 seconds
- [ ] Bundle size < 500KB gzipped
- [ ] Lighthouse score > 90
- [ ] No TypeScript errors
- [ ] SSE reconnects automatically
- [ ] Works on mobile (responsive)
