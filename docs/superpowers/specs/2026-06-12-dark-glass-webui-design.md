# Dark Glass Web UI Design

## Goal

Redesign the first-pass ScrapeGoat Web UI surfaces as a dark-only, professional dashboard with black/white structure and cyan edge-lit glass accents.

## Approved Direction

Use the selected visual direction: **C: Cyan Edge Glow**.

The UI should feel polished and atmospheric, but still read as an operational documentation/search dashboard. Cyan is an accent for edges, focus, active states, and important runtime status. It should not dominate content areas or make repeated use difficult.

## Scope

This design covers the first implementation pass:

- Main dashboard route.
- Library list and library detail surfaces.
- Search form and search result surfaces.
- Shared visual primitives needed by those screens.
- Existing job queue/dashboard sections that appear on the main page.

Upload panels and job modals are intentionally deferred. They may inherit global tokens and shared primitive classes, but they should not receive a dedicated redesign in this pass.

## Non-Goals

- No React, shadcn/ui, or frontend framework migration.
- No MCP, scraper, database, upload, or search behavior changes.
- No route contract changes unless required by an existing test update.
- No broad cleanup of unrelated `dark:` class usage outside the touched surfaces.
- No upload/job modal redesign until the visual system is proven.

## Current Web UI Context

ScrapeGoat's Web UI is server-rendered TSX using Fastify routes, `@kitajs/html`, HTMX, AlpineJS, Tailwind CSS, and Flowbite. The current layout is a narrow centered column using repeated Tailwind utility strings, light/dark variants, and local component styles.

The redesign should preserve the existing server-rendered architecture and route behavior while introducing a reusable visual system in the existing CSS and TSX component boundaries.

## Visual System

The theme is dark-only. Use a near-black page background with subtle cyan atmosphere, glass panels, and lit borders:

- Background: near-black, not pure black.
- Foreground: white and high-contrast neutral text.
- Muted text: gray, readable against glass surfaces.
- Panels: translucent dark surfaces with a subtle blur.
- Borders: low-opacity white edge plus brighter top/inner edge.
- Accent: cyan for focus, active, status, and selected states.
- Glow: restrained cyan shadow on focused or important surfaces.
- Radius: 8-12px for panels and repeated items.

Implement the visual system with shared CSS tokens and classes in `src/web/styles/main.css`. Prefer classes such as:

- `sg-shell`
- `sg-page`
- `sg-header`
- `sg-panel`
- `sg-card`
- `sg-button`
- `sg-button-primary`
- `sg-button-secondary`
- `sg-button-ghost`
- `sg-button-danger`
- `sg-input`
- `sg-badge`
- `sg-table`
- `sg-row`

The exact class list can be adjusted during implementation, but the result should avoid repeating long Tailwind class strings for every card/button/input.

## Layout

Move the main experience from a narrow `max-w-2xl` column toward a dashboard layout with more horizontal room.

Expected structure:

- Full dark page background with subtle cyan edge-lighting.
- Header anchored visually at the top with ScrapeGoat branding and update state.
- Main content constrained around a dashboard width, likely `max-w-6xl`.
- Analytics, job queue, library list, and search surfaces arranged as compact dashboard panels.
- Search and library result rows optimized for scanning, not large disconnected blocks.
- Mobile layout remains single-column and readable.

The layout should feel dense enough for repeated use, but not cramped. Use dashboard-scale headings only for real page-level sections; repeated cards and rows should use compact typography.

## Components

Refactor only as much as needed to support the first-pass redesign.

Primary targets:

- `src/web/components/Layout.tsx`
- `src/web/routes/index.tsx`
- Library list/detail components.
- Search form and search result components.
- Shared button, badge, alert, loading, progress, and skeleton components used by those surfaces.

Component behavior must remain unchanged. HTMX attributes, IDs used by swaps, SSE event triggers, and Alpine hooks should be preserved unless a test explicitly proves the replacement is safe.

Buttons should have consistent variants:

- Primary: cyan accent, used for main actions.
- Secondary: dark glass surface with lit border.
- Ghost: minimal background for low-emphasis actions.
- Destructive: restrained red border/text, not a large bright fill unless necessary.

Badges should distinguish status without relying only on color. Use readable labels and subtle borders.

Search result rows should emphasize:

- Title/library/version.
- Source path or URL.
- Snippet/readable content.
- Score and status metadata.
- Available row actions.

## Behavior

This is a visual/system refactor. Existing behavior should remain unchanged:

- Dashboard loads stats, jobs, and libraries through the same HTMX triggers.
- SSE-driven refreshes continue to update the same containers.
- Search forms submit to existing endpoints.
- Library detail/list routes keep their current semantics.
- Upload and job modal workflows continue working even though they are not the visual focus.

## Verification

Automated checks:

- Run focused route/component tests for modified Web UI files.
- Run `npm run typecheck`.
- Run `npm run lint`.
- Run `npm run build` when CSS or asset bundling changes.

Visual checks:

- Use the Stealth Browser MCP Server for real browser screenshots.
- Verify `/` at desktop width `1440x1000` and mobile width `390x844`.
- Verify library detail/list views at desktop width `1440x1000` and mobile width `390x844`.
- Verify search results, empty states, loading/skeleton states, and status/error badges.
- Confirm text does not overflow buttons, badges, rows, cards, or modals.
- Confirm cyan glow and glass borders remain readable and professional rather than visually noisy.

Screenshot evidence should be reviewed before claiming the implementation is complete. If the Stealth Browser MCP Server is unavailable, use another real browser automation path and state the fallback.

## Rollout

Implement incrementally:

1. Add theme tokens and shared utility classes.
2. Update the global shell/layout.
3. Update dashboard panels and job queue surface.
4. Update library list/detail surfaces.
5. Update search form/results surfaces.
6. Check inherited upload/job modal appearance without dedicated modal redesign.
7. Run automated and browser screenshot verification.

## Acceptance Criteria

- Main dashboard, library, and search screens use a cohesive dark-only cyan edge-glass theme.
- No React/shadcn/ui migration or new frontend framework is introduced.
- Existing route behavior and HTMX/SSE update behavior still work.
- Desktop and mobile screenshots show readable, non-overlapping UI.
- Focus, active, loading, empty, success, warning, and error states are visually distinguishable.
- Automated checks pass.
