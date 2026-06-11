# Dark Glass Web UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the main ScrapeGoat dashboard, library, and search surfaces as a dark-only professional glass UI with cyan-lit edges.

**Architecture:** Keep the existing Fastify + `@kitajs/html` + HTMX + AlpineJS architecture. Add shared dark-glass CSS primitives in `src/web/styles/main.css`, then update the shell, dashboard, library, and search TSX components to consume those primitives while preserving route IDs, HTMX attributes, and SSE triggers.

**Tech Stack:** Node.js 22, TypeScript, TSX with `@kitajs/html`, Fastify, HTMX, AlpineJS, Tailwind CSS v4, Flowbite, Vitest, Biome, Vite, Stealth Browser MCP Server.

---

## Scope Controls

- Work only on the first-pass surfaces from `docs/superpowers/specs/2026-06-12-dark-glass-webui-design.md`.
- Do not migrate to React or shadcn/ui.
- Do not redesign upload panels or job modals beyond inherited global tokens/classes.
- Preserve all existing HTMX targets, IDs, SSE triggers, and Alpine state behavior unless a focused test proves the change.
- Commit after each task.

## File Structure

- Modify `src/web/styles/main.css`: add dark-only tokens and reusable `sg-*` primitives.
- Modify `src/web/styles/main.test.ts`: lock the theme tokens and primitive class names.
- Modify `src/web/components/Layout.tsx`: dark-only shell, header, page width, theme color.
- Modify `src/web/components/Layout.test.tsx`: verify dark shell and branding remain.
- Modify `src/web/routes/index.tsx`: dashboard section layout and loading skeleton classes.
- Modify `src/web/components/PrimaryButton.tsx`: shared button base and primary variant.
- Modify `src/web/components/Alert.tsx`: dark glass alert variants.
- Modify `src/web/components/AnalyticsCards.tsx`: glass stat cards.
- Modify `src/web/components/JobList.tsx`: queue empty state and clear button styling.
- Modify `src/web/components/JobItem.tsx`: job row styling while preserving Alpine cancel behavior.
- Modify `src/web/components/ProgressBar.tsx`: cyan progress track/fill.
- Modify `src/web/components/StatusBadge.tsx`: status-specific dark badges.
- Modify `src/web/components/VersionBadge.tsx`: cyan version badge.
- Modify `src/web/components/LibraryList.tsx`: empty/list wrappers.
- Modify `src/web/components/LibraryItem.tsx`: compact library card/rows.
- Modify `src/web/components/LibraryDetailCard.tsx`: library detail panel.
- Modify `src/web/components/LibrarySearchCard.tsx`: dark glass search form.
- Modify `src/web/components/VersionDetailsRow.tsx`: compact version rows and action buttons.
- Modify `src/web/components/SearchResultList.tsx`: empty/results wrapper.
- Modify `src/web/components/SearchResultItem.tsx`: dark search result row.
- Modify `src/web/components/SearchResultSkeletonItem.tsx`: dark skeleton.
- Create `src/web/components/DashboardTheme.test.tsx`: component-level class contract tests for dashboard/library/search surfaces.
- Create `tmp/screenshots/` during verification only. Do not commit screenshots unless the user asks.

---

### Task 1: Theme Tokens And Shared CSS Primitives

**Files:**
- Modify: `src/web/styles/main.css`
- Modify: `src/web/styles/main.test.ts`

- [ ] **Step 1: Write the failing theme contract test**

Replace `src/web/styles/main.test.ts` with:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("web dark glass theme", () => {
  it("defines dark-only ScrapeGoat tokens and reusable primitives", () => {
    const css = readFileSync("src/web/styles/main.css", "utf8");

    expect(css).toContain("--sg-bg: #020406;");
    expect(css).toContain("--sg-surface-glass:");
    expect(css).toContain("--sg-cyan: #22d3ee;");
    expect(css).toContain("--sg-border-cyan:");
    expect(css).toContain("body.sg-shell");
    expect(css).toContain(".sg-page");
    expect(css).toContain(".sg-header");
    expect(css).toContain(".sg-panel");
    expect(css).toContain(".sg-card");
    expect(css).toContain(".sg-button-primary");
    expect(css).toContain(".sg-button-secondary");
    expect(css).toContain(".sg-button-ghost");
    expect(css).toContain(".sg-button-danger");
    expect(css).toContain(".sg-input");
    expect(css).toContain(".sg-badge");
    expect(css).toContain(".sg-progress-fill");
    expect(css).toContain(".sg-search-result");
    expect(css).toContain("backdrop-filter: blur(18px)");
    expect(css).toContain("box-shadow:");
    expect(css).not.toContain("#2563eb");
    expect(css).not.toContain("#f59e0b");
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npx vitest run src/web/styles/main.test.ts
```

Expected: FAIL because `--sg-bg`, `body.sg-shell`, and the `sg-*` primitives do not exist yet.

- [ ] **Step 3: Add dark-glass tokens and primitives**

In `src/web/styles/main.css`, keep the existing Tailwind/Flowbite imports and existing `@theme` block. Add this after the `@theme` block and replace the current `@layer components` block with the block below so the existing `a`, `button`, and `[x-cloak]` rules remain:

```css
@layer base {
  :root {
    color-scheme: dark;
    --sg-bg: #020406;
    --sg-bg-elevated: #060a0e;
    --sg-surface: #080d12;
    --sg-surface-soft: rgb(10 16 22 / 0.82);
    --sg-surface-glass: rgb(9 14 20 / 0.68);
    --sg-surface-strong: rgb(11 18 24 / 0.92);
    --sg-border: rgb(255 255 255 / 0.12);
    --sg-border-strong: rgb(255 255 255 / 0.2);
    --sg-border-cyan: rgb(34 211 238 / 0.45);
    --sg-edge: rgb(255 255 255 / 0.28);
    --sg-text: #f8fafc;
    --sg-text-muted: #9ca3af;
    --sg-text-soft: #cbd5e1;
    --sg-cyan: #22d3ee;
    --sg-cyan-soft: rgb(34 211 238 / 0.16);
    --sg-cyan-glow: rgb(34 211 238 / 0.2);
    --sg-success: #34d399;
    --sg-warning: #fbbf24;
    --sg-danger: #fb7185;
    --sg-radius: 10px;
  }

  html {
    background: var(--sg-bg);
  }

  body.sg-shell {
    min-height: 100vh;
    background:
      radial-gradient(circle at 78% -10%, rgb(34 211 238 / 0.18), transparent 26rem),
      radial-gradient(circle at 8% 18%, rgb(34 211 238 / 0.08), transparent 24rem),
      linear-gradient(180deg, #05080b 0%, var(--sg-bg) 58%, #010203 100%);
    color: var(--sg-text);
  }
}

@layer components {
  a {
    @apply underline-offset-4;
  }

  button {
    @apply cursor-pointer;
  }

  [x-cloak] {
    display: none !important;
  }

  .sg-page {
    @apply mx-auto w-full px-4 py-6 sm:px-6 lg:px-8;
    max-width: 72rem;
  }

  .sg-header {
    background: rgb(2 4 6 / 0.76);
    border-bottom: 1px solid var(--sg-border);
    box-shadow:
      inset 0 -1px 0 rgb(34 211 238 / 0.12),
      0 14px 50px rgb(0 0 0 / 0.34);
    backdrop-filter: blur(18px);
  }

  .sg-panel,
  .sg-card {
    border: 1px solid var(--sg-border);
    background:
      linear-gradient(180deg, rgb(255 255 255 / 0.075), rgb(255 255 255 / 0.025)),
      var(--sg-surface-glass);
    box-shadow:
      inset 0 1px 0 var(--sg-edge),
      0 24px 70px rgb(0 0 0 / 0.38),
      0 0 42px rgb(34 211 238 / 0.055);
    backdrop-filter: blur(18px);
  }

  .sg-panel {
    @apply rounded-xl p-4;
  }

  .sg-card {
    @apply rounded-lg p-4;
  }

  .sg-row {
    @apply rounded-lg border px-3 py-2;
    border-color: var(--sg-border);
    background: rgb(255 255 255 / 0.035);
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.08);
  }

  .sg-section-title {
    @apply text-base font-semibold;
    color: var(--sg-text);
    letter-spacing: 0;
  }

  .sg-label {
    @apply text-xs font-medium uppercase;
    color: var(--sg-text-muted);
    letter-spacing: 0.08em;
  }

  .sg-muted {
    color: var(--sg-text-muted);
  }

  .sg-button {
    @apply inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors duration-150 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-55;
    border-color: var(--sg-border-strong);
  }

  .sg-button-primary {
    color: #001014;
    background: var(--sg-cyan);
    border-color: rgb(103 232 249 / 0.72);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 0.38),
      0 0 24px rgb(34 211 238 / 0.22);
  }

  .sg-button-primary:hover {
    background: #67e8f9;
  }

  .sg-button-secondary {
    color: var(--sg-text-soft);
    background: rgb(255 255 255 / 0.055);
  }

  .sg-button-secondary:hover,
  .sg-button-ghost:hover {
    border-color: var(--sg-border-cyan);
    color: var(--sg-text);
    background: rgb(34 211 238 / 0.1);
  }

  .sg-button-ghost {
    color: var(--sg-text-muted);
    background: transparent;
  }

  .sg-button-danger {
    color: var(--sg-danger);
    border-color: rgb(251 113 133 / 0.42);
    background: rgb(251 113 133 / 0.075);
  }

  .sg-button-danger:hover {
    color: #ffe4e6;
    background: rgb(251 113 133 / 0.2);
  }

  .sg-input {
    @apply block rounded-lg border px-3 py-2 text-sm outline-none transition-colors duration-150;
    color: var(--sg-text);
    border-color: var(--sg-border-strong);
    background: rgb(0 0 0 / 0.28);
  }

  .sg-input::placeholder {
    color: #64748b;
  }

  .sg-input:focus {
    border-color: var(--sg-border-cyan);
    box-shadow: 0 0 0 3px rgb(34 211 238 / 0.12);
  }

  .sg-badge {
    @apply inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium;
    color: var(--sg-text-soft);
    border-color: var(--sg-border);
    background: rgb(255 255 255 / 0.055);
  }

  .sg-badge-cyan {
    color: #a5f3fc;
    border-color: var(--sg-border-cyan);
    background: var(--sg-cyan-soft);
  }

  .sg-badge-danger {
    color: #fecdd3;
    border-color: rgb(251 113 133 / 0.42);
    background: rgb(251 113 133 / 0.1);
  }

  .sg-badge-success {
    color: #bbf7d0;
    border-color: rgb(52 211 153 / 0.34);
    background: rgb(52 211 153 / 0.1);
  }

  .sg-badge-warning {
    color: #fde68a;
    border-color: rgb(251 191 36 / 0.34);
    background: rgb(251 191 36 / 0.1);
  }

  .sg-progress-track {
    @apply h-2 w-full overflow-hidden rounded-full;
    background: rgb(255 255 255 / 0.08);
  }

  .sg-progress-fill {
    @apply h-2 rounded-full transition-all duration-300;
    background: linear-gradient(90deg, #0891b2, var(--sg-cyan));
    box-shadow: 0 0 18px rgb(34 211 238 / 0.38);
  }

  .sg-search-result {
    @apply rounded-lg border p-4;
    border-color: var(--sg-border);
    background: rgb(5 10 14 / 0.74);
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.08);
  }
}
```

- [ ] **Step 4: Run the focused CSS test**

Run:

```bash
npx vitest run src/web/styles/main.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/web/styles/main.css src/web/styles/main.test.ts
git commit -m "style(web): add dark glass theme primitives"
```

---

### Task 2: Global Shell And Dashboard Layout

**Files:**
- Modify: `src/web/components/Layout.tsx`
- Modify: `src/web/components/Layout.test.tsx`
- Modify: `src/web/routes/index.tsx`

- [ ] **Step 1: Extend the layout test**

Modify `src/web/components/Layout.test.tsx` to include these assertions in the existing test:

```ts
expect(html).toContain('content="#020406"');
expect(html).toContain('class="sg-shell"');
expect(html).toContain('class="sg-header"');
expect(html).toContain('class="sg-page"');
```

- [ ] **Step 2: Run the failing layout test**

Run:

```bash
npx vitest run src/web/components/Layout.test.tsx
```

Expected: FAIL because the shell still uses `bg-gray-50 dark:bg-gray-900`, the header still uses gray Tailwind classes, and theme color is still white.

- [ ] **Step 3: Update the layout shell**

In `src/web/components/Layout.tsx`, change the theme color meta and shell markup:

```tsx
<meta name="theme-color" content="#020406" />
```

Use these classes for `body`, `header`, and the main page wrapper:

```tsx
<body class="sg-shell" hx-ext="morph">
```

```tsx
<header class="sg-header sticky top-0 z-30" x-data={versionInitializer} x-init="queueCheck()">
  <div class="sg-page py-3">
    <div class="flex items-center justify-between gap-4">
      <a href="/" class="block shrink-0" aria-label="ScrapeGoat home">
        <img src="/ScrapeGoat-Banner.svg" alt="ScrapeGoat" class="h-10 sm:h-12 w-auto" />
      </a>
      <span
        x-show="hasUpdate"
        x-cloak
        class="sg-badge sg-badge-cyan gap-2"
        role="status"
        aria-live="polite"
      >
        <span class="flex h-4 w-4 items-center justify-center rounded-full bg-cyan-300 text-[10px] font-bold text-slate-950">
          !
        </span>
        <a
          x-bind:href="latestReleaseUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="hover:text-white transition-colors"
        >
          <span class="mr-1">Update available</span>
        </a>
      </span>
    </div>
  </div>
</header>
```

```tsx
<div class="sg-page">
  <main>{children}</main>
</div>
```

Keep the existing toast, modal container, event-client script, local upload script, and bundled JS script unchanged.

- [ ] **Step 4: Update the dashboard route layout**

In `src/web/routes/index.tsx`, preserve all existing IDs and HTMX attributes. Replace only presentation classes with this structure:

```tsx
<div class="space-y-5">
  <div
    id="analytics-stats"
    hx-get="/web/stats"
    hx-trigger="load, library-change from:body"
    hx-swap="morph:innerHTML"
  >
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3 animate-pulse">
      <div class="sg-card h-20" />
      <div class="sg-card h-20" />
      <div class="sg-card h-20" />
    </div>
  </div>

  <section class="sg-panel">
    <div class="mb-3 flex items-center justify-between gap-3">
      <h2 class="sg-section-title">Job Queue</h2>
      <button
        id="clear-completed-btn"
        type="button"
        class="sg-button sg-button-secondary px-3 py-1.5 text-xs"
        title="Clear all completed, cancelled, and failed jobs"
        hx-post="/web/jobs/clear-completed"
        hx-trigger="click"
        hx-on="htmx:afterRequest: document.dispatchEvent(new Event('job-list-refresh'))"
        hx-swap="none"
        disabled
      >
        Clear Completed Jobs
      </button>
    </div>
    <div
      id="job-queue"
      hx-get="/web/jobs"
      hx-trigger="load, job-status-change from:body, job-progress from:body, job-list-change from:body, job-list-refresh from:body"
      hx-swap="morph:innerHTML"
    >
      <div class="animate-pulse space-y-2">
        <div class="h-3 w-48 rounded-full bg-white/10" />
        <div class="h-3 w-full rounded-full bg-white/10" />
        <div class="h-3 w-5/6 rounded-full bg-white/10" />
      </div>
    </div>
  </section>

  <section>
    <div id="addJobForm">
      <AddJobButton />
    </div>
  </section>

  <section class="space-y-3">
    <h2 class="sg-section-title">Indexed Documentation</h2>
    <div
      id="indexed-docs"
      hx-get="/web/libraries"
      hx-trigger="load, library-change from:body"
      hx-swap="morph:innerHTML"
    >
      <div class="animate-pulse space-y-2">
        <div class="h-3 w-48 rounded-full bg-white/10" />
        <div class="h-3 w-full rounded-full bg-white/10" />
        <div class="h-3 w-5/6 rounded-full bg-white/10" />
      </div>
    </div>
  </section>
</div>
```

- [ ] **Step 5: Run layout checks**

Run:

```bash
npx vitest run src/web/components/Layout.test.tsx
npm run typecheck
```

Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add src/web/components/Layout.tsx src/web/components/Layout.test.tsx src/web/routes/index.tsx
git commit -m "style(web): update dark dashboard shell"
```

---

### Task 3: Dashboard Components And Status Surfaces

**Files:**
- Create: `src/web/components/DashboardTheme.test.tsx`
- Modify: `src/web/components/PrimaryButton.tsx`
- Modify: `src/web/components/Alert.tsx`
- Modify: `src/web/components/AnalyticsCards.tsx`
- Modify: `src/web/components/JobList.tsx`
- Modify: `src/web/components/JobItem.tsx`
- Modify: `src/web/components/ProgressBar.tsx`
- Modify: `src/web/components/StatusBadge.tsx`
- Modify: `src/web/components/VersionBadge.tsx`

- [ ] **Step 1: Add failing dashboard component tests**

Create `src/web/components/DashboardTheme.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { VersionStatus } from "../../store/types";
import type { JobInfo } from "../../tools/GetJobInfoTool";
import Alert from "./Alert";
import AnalyticsCards from "./AnalyticsCards";
import JobItem from "./JobItem";
import PrimaryButton from "./PrimaryButton";
import ProgressBar from "./ProgressBar";
import StatusBadge from "./StatusBadge";
import VersionBadge from "./VersionBadge";

describe("dashboard dark glass components", () => {
  it("renders shared button and alert primitives", async () => {
    const buttonHtml = String(await PrimaryButton({ children: "Run" }));
    const alertHtml = String(
      await Alert({ type: "success", message: "Indexed" }),
    );

    expect(buttonHtml).toContain("sg-button");
    expect(buttonHtml).toContain("sg-button-primary");
    expect(alertHtml).toContain("sg-panel");
    expect(alertHtml).toContain("sg-badge-success");
  });

  it("renders analytics cards with sg-card surfaces", async () => {
    const html = String(
      await AnalyticsCards({
        totalChunks: 6100,
        activeLibraries: 24,
        activeVersions: 31,
        indexedPages: 900,
      }),
    );

    expect(html).toContain("sg-card");
    expect(html).toContain("Total Knowledge Base");
    expect(html).toContain("6.1K Chunks");
  });

  it("renders status, version, progress, and job surfaces with dark primitives", async () => {
    const job: JobInfo = {
      id: "job-1",
      library: "docs",
      version: "2",
      status: "running",
      createdAt: "2026-06-12T00:00:00.000Z",
      startedAt: "2026-06-12T00:00:00.000Z",
      finishedAt: null,
      error: null,
      progress: { pages: 3, totalPages: 10, totalDiscovered: 12 },
      dbStatus: VersionStatus.RUNNING,
    } as JobInfo;

    const statusHtml = String(
      await StatusBadge({ status: VersionStatus.RUNNING }),
    );
    const versionHtml = String(await VersionBadge({ version: "2" }));
    const progressHtml = String(
      await ProgressBar({
        progress: { pages: 3, totalPages: 10, totalDiscovered: 12 },
      }),
    );
    const jobHtml = String(await JobItem({ job }));

    expect(statusHtml).toContain("sg-badge");
    expect(statusHtml).toContain("sg-badge-cyan");
    expect(versionHtml).toContain("sg-badge-cyan");
    expect(progressHtml).toContain("sg-progress-track");
    expect(progressHtml).toContain("sg-progress-fill");
    expect(jobHtml).toContain("sg-row");
    expect(jobHtml).toContain('id="job-item-job-1"');
    expect(jobHtml).toContain("x-data=");
  });
});
```

- [ ] **Step 2: Run the failing dashboard component tests**

Run:

```bash
npx vitest run src/web/components/DashboardTheme.test.tsx
```

Expected: FAIL because the components still use the old Tailwind/Flowbite surface classes.

- [ ] **Step 3: Update button, alert, badge, and progress primitives**

Use these target class patterns:

`src/web/components/PrimaryButton.tsx`:

```tsx
const baseClasses = "sg-button sg-button-primary w-full";
```

`src/web/components/StatusBadge.tsx`:

```ts
const baseClasses = "sg-badge";

switch (status) {
  case VersionStatus.COMPLETED:
    return `${baseClasses} sg-badge-success`;
  case VersionStatus.RUNNING:
  case VersionStatus.UPDATING:
    return `${baseClasses} sg-badge-cyan`;
  case VersionStatus.QUEUED:
    return `${baseClasses} sg-badge-warning`;
  case VersionStatus.FAILED:
    return `${baseClasses} sg-badge-danger`;
  case VersionStatus.CANCELLED:
    return `${baseClasses}`;
  case VersionStatus.NOT_INDEXED:
  default:
    return `${baseClasses}`;
}
```

`src/web/components/VersionBadge.tsx` span class:

```tsx
<span class="sg-badge sg-badge-cyan me-2">
```

`src/web/components/ProgressBar.tsx` track/fill classes:

```tsx
<div class="sg-progress-track">
  {isIndeterminate ? (
    <div class="sg-progress-fill animate-pulse" style="width: 30%"></div>
  ) : (
    <div class="sg-progress-fill" style={`width: ${percentage}%`}></div>
  )}
</div>
```

Keep the existing progress text logic unchanged.

- [ ] **Step 4: Update dashboard card and job surfaces**

Use these class replacements:

`src/web/components/AnalyticsCards.tsx` outer grid:

```tsx
<div class="grid grid-cols-1 gap-3 sm:grid-cols-3 animate-[fadeSlideIn_0.2s_ease-out]">
```

Each analytics card:

```tsx
<div class="sg-card">
  <p class="sg-label">Total Knowledge Base</p>
  <p class="mt-1 text-2xl font-semibold text-white" safe>
    {formatNumber(totalChunks)} Chunks
  </p>
</div>
```

Use the same `sg-card`, `sg-label`, and `text-white` structure for Libraries / Versions and Indexed Pages.

`src/web/components/JobList.tsx` empty state:

```tsx
<p class="rounded-lg border border-dashed border-white/15 px-3 py-4 text-center text-sm sg-muted">
  No pending jobs.
</p>
```

`src/web/components/JobList.tsx` clear button class:

```tsx
class={`sg-button px-3 py-1.5 text-xs ${
  hasJobs ? "sg-button-secondary" : "sg-button-ghost"
}`}
```

`src/web/components/JobItem.tsx` row class:

```tsx
class="sg-row block"
```

`src/web/components/JobItem.tsx` title class:

```tsx
class="text-sm font-medium text-white"
```

`src/web/components/JobItem.tsx` metadata class:

```tsx
class="mt-1 text-xs sg-muted"
```

`src/web/components/JobItem.tsx` error box class:

```tsx
class="mt-2 rounded-lg border border-rose-400/30 bg-rose-500/10 p-2 text-xs"
```

Use `sg-button sg-button-danger p-1` for stop/cancel icon buttons while preserving the existing Alpine `x-bind:class` behavior by setting:

```ts
const defaultStateClasses = "sg-button sg-button-danger p-1";
const confirmingStateClasses = "sg-button sg-button-danger bg-rose-500/25 p-1";
```

- [ ] **Step 5: Update alert classes**

In `src/web/components/Alert.tsx`, keep the existing props and icon switch. Replace the `colorClasses` values:

```ts
case "success":
  colorClasses = "sg-panel border-emerald-400/30 text-emerald-100";
  iconSvg = (
    <span class="sg-badge sg-badge-success me-3 shrink-0">OK</span>
  );
  break;
case "error":
  colorClasses = "sg-panel border-rose-400/30 text-rose-100";
  iconSvg = (
    <span class="sg-badge sg-badge-danger me-3 shrink-0">ERR</span>
  );
  break;
case "warning":
  colorClasses = "sg-panel border-amber-400/30 text-amber-100";
  iconSvg = (
    <span class="sg-badge sg-badge-warning me-3 shrink-0">WARN</span>
  );
  break;
case "info":
default:
  colorClasses = "sg-panel text-slate-100";
  iconSvg = (
    <span class="sg-badge sg-badge-cyan me-3 shrink-0">INFO</span>
  );
  break;
```

Change the wrapper class to:

```tsx
class={`mb-4 flex items-start rounded-xl p-4 text-sm ${colorClasses}`}
```

- [ ] **Step 6: Run component tests**

Run:

```bash
npx vitest run src/web/components/DashboardTheme.test.tsx src/web/styles/main.test.ts src/web/components/Layout.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/web/components/DashboardTheme.test.tsx src/web/components/PrimaryButton.tsx src/web/components/Alert.tsx src/web/components/AnalyticsCards.tsx src/web/components/JobList.tsx src/web/components/JobItem.tsx src/web/components/ProgressBar.tsx src/web/components/StatusBadge.tsx src/web/components/VersionBadge.tsx
git commit -m "style(web): restyle dashboard primitives"
```

---

### Task 4: Library List And Detail Surfaces

**Files:**
- Modify: `src/web/components/DashboardTheme.test.tsx`
- Modify: `src/web/components/LibraryList.tsx`
- Modify: `src/web/components/LibraryItem.tsx`
- Modify: `src/web/components/LibraryDetailCard.tsx`
- Modify: `src/web/components/VersionDetailsRow.tsx`

- [ ] **Step 1: Extend component tests for library surfaces**

Append these component imports to `src/web/components/DashboardTheme.test.tsx`:

```tsx
import LibraryDetailCard from "./LibraryDetailCard";
import LibraryItem from "./LibraryItem";
import LibraryList from "./LibraryList";
```

Add this test inside the existing `describe` block:

```tsx
it("renders library list and detail surfaces with dark glass classes", async () => {
  const library = {
    name: "pdf-test2",
    versions: [
      {
        version: "2",
        documentCount: 278,
        uniqueUrlCount: 1,
        indexedAt: "2026-06-12T00:00:00.000Z",
        status: VersionStatus.COMPLETED,
        sourceUrl: "file:///import/pdf-test2/2/",
      },
    ],
  };

  const listHtml = String(await LibraryList({ libraries: [library] }));
  const itemHtml = String(await LibraryItem({ library }));
  const detailHtml = String(await LibraryDetailCard({ library }));

  expect(listHtml).toContain('id="library-list"');
  expect(listHtml).toContain("sg-card");
  expect(itemHtml).toContain("sg-card");
  expect(itemHtml).toContain("pdf-test2");
  expect(detailHtml).toContain("sg-panel");
  expect(detailHtml).toContain('id="version-list"');
  expect(detailHtml).toContain("hx-trigger=\"library-change from:body\"");
});
```

- [ ] **Step 2: Run the failing library test**

Run:

```bash
npx vitest run src/web/components/DashboardTheme.test.tsx
```

Expected: FAIL because library components still render old `bg-white dark:bg-gray-800` classes.

- [ ] **Step 3: Update library list and item surfaces**

In `src/web/components/LibraryList.tsx`, change the non-empty wrapper:

```tsx
<div id="library-list" class="grid gap-3 animate-[fadeSlideIn_0.2s_ease-out]">
```

In `src/web/components/LibraryItem.tsx`, change the card class:

```tsx
class="sg-card"
```

Use this title/source structure:

```tsx
<div class="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
  <h3 class="min-w-0 text-lg font-semibold text-white">
    <a href={`/libraries/${encodeURIComponent(library.name)}`} class="hover:text-cyan-200">
      <span safe>{library.name}</span>
    </a>
  </h3>
  {latestVersion ? (
    <span class="sg-badge shrink-0">
      {versions.length} {versions.length === 1 ? "version" : "versions"}
    </span>
  ) : null}
</div>
```

Keep the existing source URL anchor and scrolling behavior, but change the wrapper class:

```tsx
class="mt-1 h-5 overflow-hidden text-sm sg-muted @container"
```

Keep version row mapping behavior unchanged.

- [ ] **Step 4: Update library detail surface**

In `src/web/components/LibraryDetailCard.tsx`, change the outer wrapper:

```tsx
<div class="sg-panel mb-4">
```

Use this header block:

```tsx
<div class="mb-3 flex items-start justify-between gap-3">
  <div class="min-w-0">
    <p class="sg-label">Library</p>
    <h1 class="mt-1 text-2xl font-semibold text-white">
      <span safe>{library.name}</span>
    </h1>
    {latestVersion?.sourceUrl ? (
      <div class="mt-1 truncate text-sm sg-muted">
        <a
          href={latestVersion.sourceUrl}
          target="_blank"
          class="hover:text-cyan-200"
          title={latestVersion.sourceUrl}
          safe
        >
          {latestVersion.sourceUrl}
        </a>
      </div>
    ) : null}
  </div>
</div>
```

Keep `id="version-list"`, `hx-get`, `hx-trigger`, and `hx-swap` unchanged.

- [ ] **Step 5: Update version rows**

In `src/web/components/VersionDetailsRow.tsx`, change the row class:

```tsx
class="flex flex-col gap-2 border-b border-white/10 py-2 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
```

Change the version label container:

```tsx
class="min-w-0 text-sm text-white sm:w-1/4"
```

Change the stats group:

```tsx
class="flex flex-wrap gap-x-3 gap-y-1 text-sm sg-muted sm:w-3/4 sm:justify-end"
```

Set action button state classes:

```ts
const defaultStateClasses = "sg-button sg-button-danger min-w-6 h-6 p-1";
const confirmingStateClasses = "sg-button sg-button-danger min-w-6 h-6 bg-rose-500/25 px-2 py-1";
```

Use this refresh icon button class for the not-refreshing button:

```tsx
class="sg-button sg-button-ghost h-6 w-6 p-1"
```

Use this disabled refreshing button class:

```tsx
class="sg-button sg-button-ghost h-6 w-6 p-1"
```

Keep all Alpine `x-data`, event listeners, HTMX URLs, and delete/refresh trigger names unchanged.

- [ ] **Step 6: Run focused library checks**

Run:

```bash
npx vitest run src/web/components/DashboardTheme.test.tsx src/web/routes/libraries/list.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/web/components/DashboardTheme.test.tsx src/web/components/LibraryList.tsx src/web/components/LibraryItem.tsx src/web/components/LibraryDetailCard.tsx src/web/components/VersionDetailsRow.tsx
git commit -m "style(web): restyle library surfaces"
```

---

### Task 5: Search Form And Search Result Surfaces

**Files:**
- Modify: `src/web/components/DashboardTheme.test.tsx`
- Modify: `src/web/components/LibrarySearchCard.tsx`
- Modify: `src/web/components/SearchResultList.tsx`
- Modify: `src/web/components/SearchResultItem.tsx`
- Modify: `src/web/components/SearchResultSkeletonItem.tsx`
- Modify: `src/web/components/SearchResultItem.test.ts`

- [ ] **Step 1: Extend tests for search surfaces**

Append imports to `src/web/components/DashboardTheme.test.tsx`:

```tsx
import LibrarySearchCard from "./LibrarySearchCard";
import SearchResultList from "./SearchResultList";
import SearchResultSkeletonItem from "./SearchResultSkeletonItem";
```

Add this test inside the existing `describe` block:

```tsx
it("renders search form, result list, and skeletons with dark glass classes", async () => {
  const library = {
    name: "pdf-test2",
    versions: [
      {
        version: "2",
        documentCount: 278,
        uniqueUrlCount: 1,
        indexedAt: "2026-06-12T00:00:00.000Z",
        status: VersionStatus.COMPLETED,
        sourceUrl: "file:///import/pdf-test2/2/",
      },
    ],
  };

  const formHtml = String(await LibrarySearchCard({ library }));
  const listHtml = String(
    await SearchResultList({
      results: [
        {
          url: "file:///import/pdf-test2/2/manual.pdf",
          content: "# Memory\nInstall memory modules in matched pairs.",
          score: 0.82,
          mimeType: "text/markdown",
          sourceMimeType: "application/pdf",
        },
      ],
    }),
  );
  const skeletonHtml = String(await SearchResultSkeletonItem());

  expect(formHtml).toContain("sg-panel");
  expect(formHtml).toContain("sg-input");
  expect(formHtml).toContain("sg-button-primary");
  expect(formHtml).toContain('hx-target="#searchResultsContainer .search-results"');
  expect(listHtml).toContain("sg-search-result");
  expect(listHtml).toContain("application/pdf");
  expect(skeletonHtml).toContain("sg-card");
  expect(skeletonHtml).toContain("animate-pulse");
});
```

In `src/web/components/SearchResultItem.test.ts`, add one assertion to each existing test:

```ts
expect(html).toContain("sg-search-result");
```

- [ ] **Step 2: Run the failing search tests**

Run:

```bash
npx vitest run src/web/components/DashboardTheme.test.tsx src/web/components/SearchResultItem.test.ts
```

Expected: FAIL because search form/results still use the old surface classes.

- [ ] **Step 3: Update the library search card**

In `src/web/components/LibrarySearchCard.tsx`, change outer wrapper:

```tsx
<div class="sg-panel mb-4">
```

Change heading:

```tsx
<h2 class="sg-section-title mb-3" safe>
  Search {library.name} Documentation
</h2>
```

Change form class:

```tsx
class="grid gap-2 sm:grid-cols-[10rem_1fr_auto]"
```

Change select and input classes:

```tsx
class="sg-input w-full"
```

Change submit button class:

```tsx
class="sg-button sg-button-primary relative"
```

Keep `hx-get`, `hx-target`, `hx-swap`, `hx-indicator`, field names, and required input behavior unchanged.

- [ ] **Step 4: Update search result list and item**

In `src/web/components/SearchResultList.tsx`, change empty state:

```tsx
<p class="rounded-lg border border-dashed border-white/15 px-3 py-4 text-sm italic sg-muted">
  No results found.
</p>
```

Change non-empty wrapper:

```tsx
<div class="space-y-3">
```

In `src/web/components/SearchResultItem.tsx`, change markdown wrapper:

```tsx
<div class="format format-invert max-w-none text-slate-100">{safeHtml}</div>
```

Change preformatted wrapper:

```tsx
<div class="format format-invert max-w-none text-slate-100">
```

Change result item outer wrapper:

```tsx
<div class="sg-search-result mb-3">
```

Change metadata row:

```tsx
<div class="mb-2 flex min-w-0 items-center gap-2 text-sm sg-muted">
```

Change local file span class:

```tsx
class="flex-1 truncate underline decoration-white/30 underline-offset-4 cursor-default"
```

Change URL anchor class:

```tsx
class="flex-1 truncate underline decoration-cyan-300/40 underline-offset-4 hover:text-cyan-200"
```

Change MIME badge:

```tsx
<span class="sg-badge font-mono" safe>
```

- [ ] **Step 5: Update search skeleton**

In `src/web/components/SearchResultSkeletonItem.tsx`, replace the component body with:

```tsx
const SearchResultSkeletonItem = () => (
  <div class="sg-card mb-3 animate-pulse">
    <div class="mb-2 h-3 w-3/4 rounded bg-white/10"></div>
    <div class="mb-2 h-3 w-full rounded bg-white/10"></div>
    <div class="h-3 w-5/6 rounded bg-white/10"></div>
  </div>
);
```

- [ ] **Step 6: Run focused search checks**

Run:

```bash
npx vitest run src/web/components/DashboardTheme.test.tsx src/web/components/SearchResultItem.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/web/components/DashboardTheme.test.tsx src/web/components/LibrarySearchCard.tsx src/web/components/SearchResultList.tsx src/web/components/SearchResultItem.tsx src/web/components/SearchResultSkeletonItem.tsx src/web/components/SearchResultItem.test.ts
git commit -m "style(web): restyle search surfaces"
```

---

### Task 6: Build, Full Static Verification, And Browser Screenshots

**Files:**
- Modify only files required by failures found in this task.
- Do not commit `tmp/screenshots/` unless the user explicitly asks for screenshot artifacts in git.

- [ ] **Step 1: Run focused Web UI tests**

Run:

```bash
npx vitest run src/web/styles/main.test.ts src/web/components/Layout.test.tsx src/web/components/DashboardTheme.test.tsx src/web/components/SearchResultItem.test.ts src/web/routes/libraries/list.test.tsx src/web/web.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run project static checks**

Run:

```bash
npm run typecheck
npm run lint
npm run build
```

Expected: all PASS. `npm run build` must produce updated `dist/` and `public/assets/` build outputs locally, but only source files should be committed unless the repository normally commits generated assets for this change.

- [ ] **Step 3: Start a local Web UI for screenshots**

Run the built web command on a known local port:

```bash
npm start -- web --port 6291 --host 127.0.0.1
```

Expected log contains a Web UI URL for `127.0.0.1:6291`.

If the command exits because the local database or embedding configuration is missing, start the project with the developer's existing configured Docker Compose or local config and use the reachable Web UI URL for the screenshot steps. Record the exact URL used in the final implementation summary.

- [ ] **Step 4: Capture desktop screenshots with the Stealth Browser MCP Server**

Use the Stealth Browser MCP Server:

- Spawn a headless browser at viewport width `1440` and height `1000`.
- Navigate to `http://127.0.0.1:6291/` with `networkidle`.
- Take a full-page PNG screenshot to `tmp/screenshots/dark-glass-dashboard-desktop.png`.
- If a library exists, navigate to its detail route and take `tmp/screenshots/dark-glass-library-desktop.png`.
- If no library exists, use the dashboard screenshot to verify the empty library state and record that no seeded library was available.

Expected: screenshots show the dark-only background, cyan-lit glass panels, readable text, and no overlapping dashboard content.

- [ ] **Step 5: Capture mobile screenshots with the Stealth Browser MCP Server**

Use the Stealth Browser MCP Server:

- Spawn a headless browser at viewport width `390` and height `844`.
- Navigate to `http://127.0.0.1:6291/` with `networkidle`.
- Take a full-page PNG screenshot to `tmp/screenshots/dark-glass-dashboard-mobile.png`.
- If a library exists, navigate to its detail route and take `tmp/screenshots/dark-glass-library-mobile.png`.
- If no library exists, use the mobile dashboard screenshot to verify the empty library state and record that no seeded library was available.

Expected: screenshots show a single-column mobile layout, no button/badge text overflow, no row overlap, readable search/library/job surfaces, and restrained cyan glow.

- [ ] **Step 6: Inspect screenshots**

Open each screenshot with a real image viewer or local image inspection tool and verify:

- Header branding is visible.
- Main dashboard width is expanded on desktop.
- Mobile content is single-column and readable.
- Cyan glow is visible on edges/focus/status surfaces.
- Search/library/job cards do not overlap.
- Buttons and badges do not clip text.
- Upload/job modal flows are not visually redesigned in this pass, but inherited global styling does not make them unreadable.

- [ ] **Step 7: Stop the local Web UI**

Stop the `npm start -- web --port 6291 --host 127.0.0.1` process with `Ctrl-C` or terminate the tracked shell session.

- [ ] **Step 8: Commit verification-driven fixes**

If screenshot or build verification required source fixes, commit them:

```bash
git add src/web
git commit -m "fix(web): polish dark glass responsive states"
```

If no source fixes were required, do not create an empty commit.

- [ ] **Step 9: Final status check**

Run:

```bash
git status --short
```

Expected: clean working tree, except untracked local screenshot files under `tmp/screenshots/` if those were created and are not ignored.

---

## Plan Self-Review

- Spec coverage: Tasks cover theme tokens, shell layout, dashboard/job surfaces, library list/detail surfaces, search form/results, automated checks, build, and Stealth Browser MCP Server screenshots at `1440x1000` and `390x844`.
- Scope control: Upload panels and job modals are not redesigned; they are only checked for inherited readability.
- Type consistency: New tests import existing TSX components and use existing `VersionStatus`, `LibraryInfo` shape, and `JobInfo` fields.
- Behavior preservation: All tasks explicitly preserve HTMX IDs/targets/triggers and Alpine behavior.
- Verification: Focused tests, typecheck, lint, build, and real browser screenshots are required before completion.
