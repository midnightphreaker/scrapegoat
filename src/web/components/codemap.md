# src/web/components/

## Responsibility
TSX (Kita JSX) component library for server-rendered HTML fragments used in the ScrapeGoat Web UI.

## Design
All components are pure functions returning JSX, rendered server-side via Kita's HTML factory. They combine static HTML with inline Alpine.js directives (`x-data`, `x-show`, `x-bind`, `x-on`) for client-side interactivity, and HTMX attributes (`hx-get`, `hx-post`, `hx-swap`, `hx-trigger`) for partial page updates without a full SPA framework.

### Component Catalog

**Layout & Shell**
- `Layout` — Full HTML document shell: head (meta, favicons, CSS, inline styles for HTMX indicators), header with branding/version/update badge, body with toast container, modal container, and script tags. Accepts children for page content.
- `Toast` — Fixed-position notification rendered via Alpine `$store.toast` state (success/error/warning/info icons, auto-dismiss).

**Buttons & Inputs**
- `PrimaryButton` — Reusable styled button with optional HTMX attributes spread via `...rest`.
- `AddJobButton` — Opens source selection modal via HTMX.
- `AddVersionButton` — Opens add-version form for a specific library.
- `UploadVersionButton` — Opens local upload panel for a specific library.

**Forms**
- `ScrapeForm` — Wrapper providing container div for HTMX OOB swaps.
- `ScrapeFormContent` — Full scrape job form: URL, library, version, collapsible advanced options (max pages/depth, scope, include/exclude patterns, scrape mode, custom HTTP headers, follow redirects, ignore errors). Supports `new` and `add-version` modes with pre-filled initial values. Uses Alpine.js for dynamic header rows and URL path detection.
- `SourceSelectionModal` — Fixed overlay modal offering "Remote URL" vs "Local Documentation" source type selection. Closes on Escape/backdrop click.

**Libraries**
- `LibraryList` — Renders `LibraryItem[]` or welcome `Alert` when empty.
- `LibraryItem` — Card for a single library: name link, source URL (with scroll animation), version rows.
- `LibraryDetailCard` — Expanded library card for detail view: versions list with HTMX auto-refresh on `library-change`, add/upload version buttons.
- `LibrarySearchCard` — Search form with version dropdown and query input targeting the search results container.

**Versions**
- `VersionBadge` — Inline colored badge for version string.
- `VersionDetailsRow` — Row showing version label, stats (pages, chunks, last update), and action buttons (refresh spinner, delete with confirm pattern). Uses Alpine for state machine (confirming/deleting/isRefreshing) and listens to `job-status-change` DOM events.
- `StatusBadge` — Colored badge mapped from `VersionStatus` enum.

**Jobs**
- `JobList` — Renders `JobItem[]` plus out-of-band "Clear Completed Jobs" button swap.
- `JobItem` — Job card with library, version, timestamps, progress bar, error display, and cancel button with confirm pattern.

**Search**
- `SearchResultList` — Renders `SearchResultItem[]` or "no results" message.
- `SearchResultItem` — Async component: converts markdown content to sanitized HTML via `unified`/`remark`/`DOMPurify` pipeline, renders non-markdown as preformatted text. Shows source URL and MIME type.
- `SearchResultSkeletonItem` — Pulse-animated loading placeholder for search results.

**Upload**
- `upload/LocalUploadPanel` — Full upload workflow panel: library/version inputs, drag-and-drop zone, file/folder upload via Alpine `localUpload()` component, import tree viewer with rename/move/remove actions, stats display, commit/cancel buttons.

**Utilities**
- `Alert` — Flowbite-styled alert with type-based icon/color (success/error/warning/info).
- `LoadingSpinner` — SVG spinner icon with configurable classes.
- `Tooltip` — Alpine-powered hover/focus tooltip with positional placement.
- `ProgressBar` — Determinate/indeterminate progress bar with pages/discovered counts.
- `AnalyticsCards` — Three summary cards: total chunks, libraries/versions, indexed pages.

## Flow
1. Route handlers (in `routes/`) invoke components with data from tool/service calls.
2. Components render to HTML strings → sent as HTTP responses or HTMX fragment swaps.
3. Alpine.js hydrates interactive state on the client; HTMX handles subsequent partial updates.
4. SSE events from `EventClient` trigger DOM events → HTMX `hx-trigger` attributes → re-render specific components.

## Integration
- Consumed by: `src/web/routes/` handlers (page, jobs, libraries, upload)
- Depends on: `@kitajs/html` (JSX runtime), `alpinejs` (client), `dompurify` + `unified`/`remark` (SearchResultItem), `../../store/types`, `../../tools/*` types, `../../scraper/types`, `../../utils/mimeTypeUtils`, `../../utils/dom`
