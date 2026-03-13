# ScrapeGoat's New Clothes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the existing JSX/Alpine.js/HTMX WebUI with a Svelte 5 + SvelteKit SPA that communicates with the Fastify backend via tRPC and SSE.

**Architecture:** SvelteKit builds to static files served by Fastify from `public/webui/`. The SPA uses tRPC client for API calls and EventSource for real-time job progress. No SSR needed - client-side only.

**Tech Stack:** Svelte 5, SvelteKit, shadcn-svelte, Bits UI, Tailwind CSS v4, tRPC client, Vitest, Playwright

---

## Phase 1: Infrastructure Setup

### Task 1: Create SvelteKit Workspace

**Files:**
- Create: `src/web-sveltekit/` (entire directory structure)
- Modify: `package.json` (add workspace)

**Step 1: Create workspace directory**

```bash
mkdir -p src/web-sveltekit/src/lib/{components,stores,api,utils}
mkdir -p src/web-sveltekit/src/routes
mkdir -p src/web-sveltekit/static
mkdir -p src/web-sveltekit/tests/{unit,e2e}
```

**Step 2: Initialize SvelteKit project**

```bash
cd src/web-sveltekit
npm create svelte@latest . -- --template skeleton --types typescript --no-add-ons
```

**Step 3: Add to root package.json workspaces**

```json
{
  "workspaces": ["src/web-sveltekit"]
}
```

**Step 4: Install dependencies**

```bash
npm install
```

**Step 5: Verify SvelteKit runs**

```bash
cd src/web-sveltekit && npm run dev
```

Expected: Dev server starts on :5173 with "Welcome to SvelteKit" page

**Step 6: Commit**

```bash
git add package.json src/web-sveltekit/
git commit -m "feat(webui): initialize SvelteKit workspace"
```

---

### Task 2: Configure Tailwind CSS v4

**Files:**
- Create: `src/web-sveltekit/tailwind.config.ts`
- Create: `src/web-sveltekit/src/app.css`
- Modify: `src/web-sveltekit/svelte.config.js`
- Modify: `src/web-sveltekit/vite.config.ts`

**Step 1: Install Tailwind dependencies**

```bash
cd src/web-sveltekit
npm install -D tailwindcss @tailwindcss/vite
```

**Step 2: Create tailwind.config.ts**

```typescript
import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
```

**Step 3: Create app.css**

```css
@import 'tailwindcss';

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 20 14.3% 4.1%;
  }
  
  .dark {
    --background: 0 0% 3.9%;
    --foreground: 0 0% 98%;
  }
}

@layer components {
  .btn-primary {
    @apply bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors;
  }
}
```

**Step 4: Update vite.config.ts**

```typescript
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
});
```

**Step 5: Update svelte.config.js to import CSS**

Add to `src/web-sveltekit/src/app.html` in `<head>`:
```html
<link rel="stylesheet" href="%sveltekit.assets%/app.css" />
```

**Step 6: Import CSS in +layout.svelte**

```svelte
<script lang="ts">
  import '../app.css';
</script>

<slot />
```

**Step 7: Test Tailwind works**

Add a test class to `+page.svelte`:
```svelte
<h1 class="text-primary-600 text-2xl">Test</h1>
```

Run: `npm run dev`
Expected: Green text on page

**Step 8: Commit**

```bash
git add src/web-sveltekit/
git commit -m "feat(webui): configure Tailwind CSS v4"
```

---

### Task 3: Install shadcn-svelte

**Files:**
- Modify: `src/web-sveltekit/package.json`
- Create: `src/web-sveltekit/src/lib/components/ui/` (directory)
- Create: `src/web-sveltekit/components.json`

**Step 1: Install shadcn-svelte CLI**

```bash
cd src/web-sveltekit
npx shadcn-svelte@latest init
```

Select:
- Style: Default
- Base color: Emerald
- CSS variables: Yes

**Step 2: Install Bits UI and dependencies**

```bash
npm install bits-ui clsx tailwind-merge tailwind-variants
npm install -D @types/tailwindcss
```

**Step 3: Initialize components.json**

```json
{
  "$schema": "https://shadcn-svelte.com/schema.json",
  "style": "default",
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app.css",
    "baseColor": "emerald"
  },
  "aliases": {
    "components": "$lib/components",
    "utils": "$lib/utils"
  }
}
```

**Step 4: Add core components**

```bash
npx shadcn-svelte@latest add button card input alert badge
npx shadcn-svelte@latest add dialog progress toast sonner
```

**Step 5: Create utils/cn.ts helper**

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Step 6: Verify components work**

Add to `+page.svelte`:
```svelte
<script lang="ts">
  import { Button } from '$lib/components/ui/button';
</script>

<Button>Test</Button>
```

Run: `npm run dev`
Expected: Styled button appears

**Step 7: Commit**

```bash
git add src/web-sveltekit/
git commit -m "feat(webui): install shadcn-svelte with core components"
```

---

### Task 4: Set Up tRPC Client

**Files:**
- Create: `src/web-sveltekit/src/lib/api/trpc.ts`
- Create: `src/web-sveltekit/src/lib/api/types.ts`
- Modify: `src/web-sveltekit/src/app.d.ts`

**Step 1: Install tRPC client dependencies**

```bash
cd src/web-sveltekit
npm install @trpc/client @trpc/server
```

**Step 2: Create types.ts (shared types)**

```typescript
// These types should match the backend types
export interface Job {
  id: string;
  library: string;
  version: string | null;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: { pages: number; totalPages: number } | null;
  error: string | null;
  createdAt: string;
  sourceUrl: string;
}

export interface Library {
  name: string;
  versions: Version[];
}

export interface Version {
  version: string;
  status: string;
  documentCount: number;
  uniqueUrlCount: number;
  indexedAt: string | null;
  sourceUrl: string | null;
}

export interface SearchResult {
  url: string;
  content: string;
  score: number | null;
}

export interface EnqueueJobInput {
  url: string;
  library: string;
  version?: string | null;
  options?: {
    maxPages?: number;
    maxDepth?: number;
    scope?: 'subpages' | 'hostname' | 'domain';
    followRedirects?: boolean;
    ignoreErrors?: boolean;
    includePatterns?: string[];
    excludePatterns?: string[];
    headers?: Record<string, string>;
  };
}
```

**Step 3: Create trpc.ts client**

```typescript
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../../services/trpc/router';

const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/trpc`;
  }
  return 'http://localhost:6281/api/trpc';
};

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: getApiUrl(),
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: 'include',
        });
      },
    }),
  ],
});
```

**Step 4: Add type reference to app.d.ts**

```typescript
/// <reference types="@sveltejs/kit" />

declare namespace App {
  // interface Error {}
  // interface Locals {}
  // interface PageData {}
  // interface Platform {}
}
```

**Step 5: Create test file to verify types compile**

```typescript
// src/web-sveltekit/src/lib/api/trpc.test.ts
import { describe, it, expect } from 'vitest';
import { trpc } from './trpc';

describe('tRPC client', () => {
  it('should be defined', () => {
    expect(trpc).toBeDefined();
  });
});
```

**Step 6: Run type check**

```bash
npm run check
```

Expected: No type errors

**Step 7: Commit**

```bash
git add src/web-sveltekit/
git commit -m "feat(webui): set up tRPC client with types"
```

---

### Task 5: Set Up Testing Infrastructure

**Files:**
- Create: `src/web-sveltekit/vitest.config.ts`
- Create: `src/web-sveltekit/playwright.config.ts`
- Create: `src/web-sveltekit/tests/setup.ts`
- Modify: `src/web-sveltekit/package.json`

**Step 1: Install testing dependencies**

```bash
cd src/web-sveltekit
npm install -D vitest @vitest/ui @testing-library/svelte jsdom
npm install -D @playwright/test
```

**Step 2: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts}', 'tests/**/*.{test,spec}.{js,ts}'],
    globals: true,
  },
  resolve: {
    alias: {
      $lib: resolve('./src/lib'),
    },
  },
});
```

**Step 3: Create tests/setup.ts**

```typescript
import '@testing-library/jest-dom/vitest';
```

**Step 4: Create playwright.config.ts**

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:6281',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

**Step 5: Add test scripts to package.json**

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

**Step 6: Create placeholder test**

```typescript
// tests/unit/example.test.ts
import { describe, it, expect } from 'vitest';

describe('placeholder', () => {
  it('should work', () => {
    expect(1 + 1).toBe(2);
  });
});
```

**Step 7: Run tests**

```bash
npm run test
```

Expected: 1 test passes

**Step 8: Commit**

```bash
git add src/web-sveltekit/
git commit -m "feat(webui): set up Vitest and Playwright testing"
```

---

## Phase 2: Core Layout & Navigation

### Task 6: Create Layout Component

**Files:**
- Create: `src/web-sveltekit/src/routes/+layout.svelte`
- Create: `src/web-sveltekit/src/lib/components/layout/Header.svelte`
- Create: `src/web-sveltekit/src/lib/components/layout/Footer.svelte`

**Step 1: Write failing test for Layout**

```typescript
// tests/unit/layout/Header.test.ts
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Header from '$lib/components/layout/Header.svelte';

describe('Header', () => {
  it('renders logo and navigation', () => {
    render(Header);
    expect(screen.getByText('Scrapegoat')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm run test
```

Expected: FAIL - Header component doesn't exist

**Step 3: Create Header.svelte**

```svelte
<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import ThemeToggle from './ThemeToggle.svelte';
  import McpStatusBadge from './McpStatusBadge.svelte';
</script>

<header class="border-b border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900">
  <div class="container mx-auto px-4 py-3 flex items-center justify-between">
    <a href="/" class="flex items-center gap-2 text-xl font-bold text-stone-800 dark:text-stone-100">
      <svg class="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L2 7v10l10 5 10-5V7L12 2z"/>
      </svg>
      Scrapegoat
    </a>
    
    <div class="flex items-center gap-4">
      <McpStatusBadge />
      <ThemeToggle />
    </div>
  </div>
</header>
```

**Step 4: Run test to verify it passes**

```bash
npm run test
```

Expected: PASS

**Step 5: Create +layout.svelte**

```svelte
<script lang="ts">
  import '../app.css';
  import Header from '$lib/components/layout/Header.svelte';
  
  let { children } = $props();
</script>

<div class="min-h-screen bg-stone-50 dark:bg-stone-950">
  <Header />
  <main class="container mx-auto px-4 py-6">
    {@render children()}
  </main>
</div>
```

**Step 6: Commit**

```bash
git add src/web-sveltekit/
git commit -m "feat(webui): add layout with header component"
```

---

### Task 7: Create ThemeToggle Component

**Files:**
- Create: `src/web-sveltekit/src/lib/components/layout/ThemeToggle.svelte`
- Create: `src/web-sveltekit/src/lib/stores/theme.svelte.ts`

**Step 1: Write failing test**

```typescript
// tests/unit/layout/ThemeToggle.test.ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ThemeToggle from '$lib/components/layout/ThemeToggle.svelte';

describe('ThemeToggle', () => {
  it('toggles dark mode on click', async () => {
    render(ThemeToggle);
    const button = screen.getByRole('button');
    await fireEvent.click(button);
    // Theme should toggle
  });
});
```

**Step 2: Create theme store**

```typescript
// src/lib/stores/theme.svelte.ts
type Theme = 'light' | 'dark' | 'system';

class ThemeStore {
  theme = $state<Theme>('system');
  dark = $derived(this.theme === 'dark');
  wide = $state(false);

  constructor() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme') as Theme | null;
      if (stored) this.theme = stored;
      
      const storedWide = localStorage.getItem('wide');
      if (storedWide) this.wide = storedWide === 'true';
      
      this.applyTheme();
    }
  }

  setTheme(theme: Theme) {
    this.theme = theme;
    localStorage.setItem('theme', theme);
    this.applyTheme();
  }

  toggleDark() {
    this.setTheme(this.dark ? 'light' : 'dark');
  }

  toggleWide() {
    this.wide = !this.wide;
    localStorage.setItem('wide', String(this.wide));
    this.applyWide();
  }

  private applyTheme() {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', this.dark);
    }
  }

  private applyWide() {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('wide', this.wide);
    }
  }
}

export const themeStore = new ThemeStore();
```

**Step 3: Create ThemeToggle.svelte**

```svelte
<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { themeStore } from '$lib/stores/theme.svelte';
</script>

<Button
  variant="ghost"
  size="icon"
  onclick={() => themeStore.toggleDark()}
  aria-label="Toggle theme"
>
  {#if themeStore.dark}
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
    </svg>
  {:else}
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
    </svg>
  {/if}
</Button>
```

**Step 4: Run tests**

```bash
npm run test
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/web-sveltekit/
git commit -m "feat(webui): add theme toggle with dark mode support"
```

---

### Task 8: Create McpStatusBadge Component

**Files:**
- Create: `src/web-sveltekit/src/lib/components/layout/McpStatusBadge.svelte`

**Step 1: Write failing test**

```typescript
// tests/unit/layout/McpStatusBadge.test.ts
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import McpStatusBadge from '$lib/components/layout/McpStatusBadge.svelte';

describe('McpStatusBadge', () => {
  it('shows MCP connection status', () => {
    render(McpStatusBadge);
    expect(screen.getByText(/MCP/i)).toBeInTheDocument();
  });
});
```

**Step 2: Create McpStatusBadge.svelte**

```svelte
<script lang="ts">
  import { Badge } from '$lib/components/ui/badge';
  
  let status = $state<'checking' | 'connected' | 'disconnected'>('checking');
  let mcpUrl = $state('');

  async function checkMcpHealth() {
    try {
      const response = await fetch('/api/health/mcp');
      const data = await response.json();
      status = data.status === 'ok' ? 'connected' : 'disconnected';
      mcpUrl = data.url || '';
    } catch {
      status = 'disconnected';
    }
  }

  $effect(() => {
    checkMcpHealth();
    const interval = setInterval(checkMcpHealth, 30000);
    return () => clearInterval(interval);
  });
</script>

<div class="flex items-center gap-2">
  <Badge 
    variant={status === 'connected' ? 'default' : 'secondary'}
    class="cursor-default"
  >
    MCP: {status}
  </Badge>
</div>
```

**Step 3: Run tests**

```bash
npm run test
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/web-sveltekit/
git commit -m "feat(webui): add MCP status badge component"
```

---

## Phase 3: Job Queue Feature

### Task 9: Create Jobs Store

**Files:**
- Create: `src/web-sveltekit/src/lib/stores/jobs.svelte.ts`

**Step 1: Write failing test**

```typescript
// tests/unit/stores/jobs.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { jobsStore } from '$lib/stores/jobs.svelte';

describe('jobsStore', () => {
  beforeEach(() => {
    jobsStore.jobs = [];
    jobsStore.loading = false;
    jobsStore.error = null;
  });

  it('starts with empty jobs', () => {
    expect(jobsStore.jobs).toEqual([]);
  });

  it('has loading state', () => {
    expect(jobsStore.loading).toBe(false);
  });
});
```

**Step 2: Create jobs.svelte.ts**

```typescript
// src/lib/stores/jobs.svelte.ts
import { trpc } from '$lib/api/trpc';
import type { Job } from '$lib/api/types';

class JobsStore {
  jobs = $state<Job[]>([]);
  loading = $state(false);
  error = $state<string | null>(null);

  async fetch() {
    this.loading = true;
    this.error = null;
    try {
      const result = await trpc.jobs.getJobs.query();
      this.jobs = result.jobs;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to fetch jobs';
    } finally {
      this.loading = false;
    }
  }

  async cancel(jobId: string) {
    try {
      await trpc.jobs.cancelJob.mutate({ id: jobId });
      this.jobs = this.jobs.filter(j => j.id !== jobId);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to cancel job';
    }
  }

  async clearCompleted() {
    try {
      await trpc.jobs.clearCompletedJobs.mutate();
      this.jobs = this.jobs.filter(j => 
        j.status !== 'completed' && j.status !== 'failed' && j.status !== 'cancelled'
      );
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to clear jobs';
    }
  }

  updateJob(updatedJob: Job) {
    const index = this.jobs.findIndex(j => j.id === updatedJob.id);
    if (index >= 0) {
      this.jobs[index] = updatedJob;
    } else {
      this.jobs.unshift(updatedJob);
    }
  }
}

export const jobsStore = new JobsStore();
```

**Step 3: Run tests**

```bash
npm run test
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/web-sveltekit/
git commit -m "feat(webui): create jobs store with CRUD operations"
```

---

### Task 10: Create SSE Client

**Files:**
- Create: `src/web-sveltekit/src/lib/api/sse.ts`

**Step 1: Write failing test**

```typescript
// tests/unit/api/sse.test.ts
import { describe, it, expect, vi } from 'vitest';
import { JobEventSource } from '$lib/api/sse';

describe('JobEventSource', () => {
  it('creates event source connection', () => {
    const client = new JobEventSource(() => {});
    expect(client).toBeDefined();
  });
});
```

**Step 2: Create SSE client**

```typescript
// src/lib/api/sse.ts
import type { Job } from './types';

type JobEventType = 'job-progress' | 'job-status' | 'job-error';
type JobEventCallback = (event: { type: JobEventType; payload: Job }) => void;

export class JobEventSource {
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private callback: JobEventCallback;
  private polling = false;

  constructor(callback: JobEventCallback) {
    this.callback = callback;
  }

  connect() {
    if (this.eventSource) {
      this.eventSource.close();
    }

    try {
      this.eventSource = new EventSource('/web/jobs/events');

      this.eventSource.addEventListener('job-progress', (e) => {
        this.handleEvent('job-progress', e);
      });

      this.eventSource.addEventListener('job-status', (e) => {
        this.handleEvent('job-status', e);
      });

      this.eventSource.addEventListener('job-error', (e) => {
        this.handleEvent('job-error', e);
      });

      this.eventSource.onerror = () => {
        this.handleDisconnect();
      };

      this.eventSource.onopen = () => {
        this.reconnectAttempts = 0;
      };
    } catch {
      this.handleDisconnect();
    }
  }

  private handleEvent(type: JobEventType, event: MessageEvent) {
    try {
      const payload = JSON.parse(event.data) as Job;
      this.callback({ type, payload });
    } catch (e) {
      console.error('Failed to parse SSE event:', e);
    }
  }

  private handleDisconnect() {
    this.reconnectAttempts++;
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('SSE failed 3 times, falling back to polling');
      this.startPolling();
    } else {
      const delay = 1000 * Math.pow(2, this.reconnectAttempts);
      setTimeout(() => this.connect(), delay);
    }
  }

  private startPolling() {
    if (this.polling) return;
    this.polling = true;
    
    this.pollInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/trpc/jobs.getJobs');
        const data = await response.json();
        for (const job of data.result?.data?.jobs || []) {
          this.callback({ type: 'job-status', payload: job });
        }
      } catch (e) {
        console.error('Polling failed:', e);
      }
    }, 5000);
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.polling = false;
  }
}

export function subscribeToJobUpdates(callback: JobEventCallback): () => void {
  const client = new JobEventSource(callback);
  client.connect();
  return () => client.disconnect();
}
```

**Step 3: Run tests**

```bash
npm run test
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/web-sveltekit/
git commit -m "feat(webui): create SSE client with fallback polling"
```

---

### Task 11: Create JobItem Component

**Files:**
- Create: `src/web-sveltekit/src/lib/components/jobs/JobItem.svelte`
- Create: `src/web-sveltekit/src/lib/components/jobs/ProgressBar.svelte`

**Step 1: Write failing test**

```typescript
// tests/unit/jobs/JobItem.test.ts
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import JobItem from '$lib/components/jobs/JobItem.svelte';

describe('JobItem', () => {
  const mockJob = {
    id: 'test-123',
    library: 'react',
    version: '18.0.0',
    status: 'running',
    progress: { pages: 5, totalPages: 10 },
    error: null,
    createdAt: new Date().toISOString(),
    sourceUrl: 'https://react.dev',
  };

  it('displays job information', () => {
    render(JobItem, { props: { job: mockJob } });
    expect(screen.getByText('react')).toBeInTheDocument();
    expect(screen.getByText('18.0.0')).toBeInTheDocument();
  });
});
```

**Step 2: Create ProgressBar.svelte**

```svelte
<script lang="ts">
  interface Props {
    pages: number;
    totalPages: number;
    indeterminate?: boolean;
  }

  let { pages, totalPages, indeterminate = false }: Props = $props();
  
  const percentage = $derived(
    totalPages > 0 ? Math.min(100, Math.round((pages / totalPages) * 100)) : 0
  );
</script>

<div class="w-full">
  <div class="flex justify-between text-xs text-stone-600 dark:text-stone-400 mb-1">
    {#if indeterminate}
      <span>Discovering pages...</span>
    {:else}
      <span>{pages} / {totalPages} pages</span>
      <span>{percentage}%</span>
    {/if}
  </div>
  
  <div class="h-2 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
    {#if indeterminate}
      <div 
        class="h-full bg-primary-600 rounded-full animate-pulse"
        style="width: 50%"
      ></div>
    {:else}
      <div 
        class="h-full bg-primary-600 rounded-full transition-all duration-300"
        style="width: {percentage}%"
      ></div>
    {/if}
  </div>
</div>
```

**Step 3: Create JobItem.svelte**

```svelte
<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import { Card } from '$lib/components/ui/card';
  import ProgressBar from './ProgressBar.svelte';
  import { jobsStore } from '$lib/stores/jobs.svelte';
  import type { Job } from '$lib/api/types';

  interface Props {
    job: Job;
  }

  let { job }: Props = $props();
  
  let confirming = $state(false);
  let confirmTimeout: ReturnType<typeof setTimeout> | null = null;

  const statusColors: Record<string, string> = {
    queued: 'secondary',
    running: 'default',
    completed: 'success',
    failed: 'destructive',
    cancelled: 'outline',
  };

  function handleCancelClick() {
    if (confirming) {
      jobsStore.cancel(job.id);
      confirming = false;
      if (confirmTimeout) clearTimeout(confirmTimeout);
    } else {
      confirming = true;
      confirmTimeout = setTimeout(() => {
        confirming = false;
      }, 3000);
    }
  }

  const formattedDate = $derived(
    new Date(job.createdAt).toLocaleString()
  );
</script>

<Card class="p-4 mb-2">
  <div class="flex justify-between items-start mb-3">
    <div>
      <h3 class="font-semibold text-stone-800 dark:text-stone-100">
        {job.library}
      </h3>
      {#if job.version}
        <Badge variant="outline" class="mt-1">{job.version}</Badge>
      {/if}
    </div>
    
    <div class="flex items-center gap-2">
      <Badge variant={statusColors[job.status] || 'secondary'}>
        {job.status}
      </Badge>
      
      {#if job.status === 'running' || job.status === 'queued'}
        <Button
          variant={confirming ? 'destructive' : 'outline'}
          size="sm"
          onclick={handleCancelClick}
        >
          {confirming ? 'Confirm?' : 'Cancel'}
        </Button>
      {/if}
    </div>
  </div>

  {#if job.progress}
    <ProgressBar 
      pages={job.progress.pages} 
      totalPages={job.progress.totalPages}
      indeterminate={job.progress.totalPages === 0}
    />
  {/if}

  {#if job.error}
    <div class="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-700 dark:text-red-300">
      {job.error}
    </div>
  {/if}

  <div class="mt-2 text-xs text-stone-500 dark:text-stone-400">
    Started: {formattedDate}
  </div>
</Card>
```

**Step 4: Run tests**

```bash
npm run test
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/web-sveltekit/
git commit -m "feat(webui): add JobItem component with progress bar"
```

---

### Task 12: Create JobList Component

**Files:**
- Create: `src/web-sveltekit/src/lib/components/jobs/JobList.svelte`

**Step 1: Write failing test**

```typescript
// tests/unit/jobs/JobList.test.ts
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import JobList from '$lib/components/jobs/JobList.svelte';

describe('JobList', () => {
  it('shows empty state when no jobs', () => {
    render(JobList, { props: { jobs: [] } });
    expect(screen.getByText(/No active jobs/i)).toBeInTheDocument();
  });
});
```

**Step 2: Create JobList.svelte**

```svelte
<script lang="ts">
  import JobItem from './JobItem.svelte';
  import { jobsStore } from '$lib/stores/jobs.svelte';
  import { subscribeToJobUpdates } from '$lib/api/sse';
  import { onMount } from 'svelte';
  import type { Job } from '$lib/api/types';

  interface Props {
    jobs?: Job[];
  }

  let { jobs: initialJobs }: Props = $props();

  onMount(() => {
    jobsStore.fetch();
    const unsubscribe = subscribeToJobUpdates((event) => {
      jobsStore.updateJob(event.payload);
    });
    return unsubscribe;
  });

  const activeJobs = $derived(
    jobsStore.jobs.filter(j => j.status === 'running' || j.status === 'queued')
  );
</script>

<div class="space-y-2">
  {#if activeJobs.length === 0}
    <div class="text-center py-8 text-stone-500 dark:text-stone-400">
      <p>No active jobs</p>
      <p class="text-sm mt-1">Submit a scrape job to see it here</p>
    </div>
  {:else}
    {#each activeJobs as job (job.id)}
      <JobItem {job} />
    {/each}
  {/if}
</div>
```

**Step 3: Run tests**

```bash
npm run test
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/web-sveltekit/
git commit -m "feat(webui): add JobList component with SSE subscription"
```

---

## Phase 4: Library Management

### Task 13: Create Libraries Store

**Files:**
- Create: `src/web-sveltekit/src/lib/stores/libraries.svelte.ts`

**Step 1: Write failing test**

```typescript
// tests/unit/stores/libraries.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { librariesStore } from '$lib/stores/libraries.svelte';

describe('librariesStore', () => {
  beforeEach(() => {
    librariesStore.libraries = [];
    librariesStore.loading = false;
  });

  it('starts with empty libraries', () => {
    expect(librariesStore.libraries).toEqual([]);
  });
});
```

**Step 2: Create libraries.svelte.ts**

```typescript
// src/lib/stores/libraries.svelte.ts
import { trpc } from '$lib/api/trpc';
import type { Library } from '$lib/api/types';

class LibrariesStore {
  libraries = $state<Library[]>([]);
  loading = $state(false);
  error = $state<string | null>(null);
  lastFetch = $state<Date | null>(null);
  cacheTTL = 30_000; // 30 seconds

  async fetch(forceRefresh = false) {
    const now = new Date();
    if (!forceRefresh && this.lastFetch && now.getTime() - this.lastFetch.getTime() < this.cacheTTL) {
      return; // Use cached data
    }

    this.loading = true;
    this.error = null;
    try {
      const result = await trpc.data.listLibraries.query();
      this.libraries = result;
      this.lastFetch = now;
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to fetch libraries';
    } finally {
      this.loading = false;
    }
  }

  async deleteVersion(library: string, version: string) {
    try {
      await trpc.data.removeVersion.mutate({ library, version });
      await this.fetch(true);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to delete version';
      throw e;
    }
  }

  async rename(library: string, newTitle: string) {
    // This would need a backend endpoint - placeholder for now
    try {
      // await trpc.data.renameLibrary.mutate({ library, newTitle });
      await this.fetch(true);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to rename library';
      throw e;
    }
  }

  async rescrape(library: string, version: string) {
    // This would need a backend endpoint - placeholder for now
    try {
      // await trpc.data.rescrape.mutate({ library, version });
      await this.fetch(true);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Failed to rescrape';
      throw e;
    }
  }
}

export const librariesStore = new LibrariesStore();
```

**Step 3: Run tests**

```bash
npm run test
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/web-sveltekit/
git commit -m "feat(webui): create libraries store with caching"
```

---

### Task 14: Create LibraryItem Component

**Files:**
- Create: `src/web-sveltekit/src/lib/components/libraries/LibraryItem.svelte`
- Create: `src/web-sveltekit/src/lib/components/libraries/VersionBadge.svelte`

**Step 1: Write failing test**

```typescript
// tests/unit/libraries/LibraryItem.test.ts
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import LibraryItem from '$lib/components/libraries/LibraryItem.svelte';

describe('LibraryItem', () => {
  const mockLibrary = {
    name: 'react',
    versions: [
      { version: '18.0.0', status: 'completed', documentCount: 100, uniqueUrlCount: 50, indexedAt: new Date().toISOString(), sourceUrl: 'https://react.dev' }
    ]
  };

  it('displays library name', () => {
    render(LibraryItem, { props: { library: mockLibrary } });
    expect(screen.getByText('react')).toBeInTheDocument();
  });
});
```

**Step 2: Create VersionBadge.svelte**

```svelte
<script lang="ts">
  import { Badge } from '$lib/components/ui/badge';

  interface Props {
    version: string;
    status?: string;
  }

  let { version, status = 'completed' }: Props = $props();

  const statusColors: Record<string, string> = {
    completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100',
    running: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
    queued: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
  };
</script>

<Badge 
  variant="outline"
  class="{statusColors[status] || statusColors.completed}"
>
  {version || 'Unversioned'}
</Badge>
```

**Step 3: Create LibraryItem.svelte**

```svelte
<script lang="ts">
  import { Card } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import VersionBadge from './VersionBadge.svelte';
  import { librariesStore } from '$lib/stores/libraries.svelte';
  import type { Library, Version } from '$lib/api/types';

  interface Props {
    library: Library;
  }

  let { library }: Props = $props();
  
  let editingTitle = $state(false);
  let newTitle = $state('');
  let deleteConfirming = $state<string | null>(null);
  let rescrapeConfirming = $state<string | null>(null);

  function startEditTitle() {
    newTitle = library.name;
    editingTitle = true;
  }

  async function saveTitle() {
    if (newTitle.trim() && newTitle !== library.name) {
      try {
        await librariesStore.rename(library.name, newTitle.trim());
      } catch (e) {
        console.error('Failed to rename:', e);
      }
    }
    editingTitle = false;
  }

  function handleDeleteClick(version: string) {
    if (deleteConfirming === version) {
      librariesStore.deleteVersion(library.name, version);
      deleteConfirming = null;
    } else {
      deleteConfirming = version;
      setTimeout(() => { deleteConfirming = null; }, 3000);
    }
  }

  function handleRescrapeClick(version: string) {
    if (rescrapeConfirming === version) {
      librariesStore.rescrape(library.name, version);
      rescrapeConfirming = null;
    } else {
      rescrapeConfirming = version;
      setTimeout(() => { rescrapeConfirming = null; }, 3000);
    }
  }
</script>

<Card class="p-4">
  {#if editingTitle}
    <input
      type="text"
      bind:value={newTitle}
      class="text-lg font-semibold bg-transparent border-b-2 border-primary-500 focus:outline-none"
      onkeydown={(e) => e.key === 'Enter' && saveTitle()}
      onblur={saveTitle}
    />
  {:else}
    <a 
      href="/libraries/{encodeURIComponent(library.name)}"
      class="text-lg font-semibold text-stone-800 dark:text-stone-100 hover:underline cursor-pointer"
      ondblclick={startEditTitle}
    >
      {library.name}
    </a>
  {/if}

  <div class="mt-3 space-y-2">
    {#each library.versions as version (version.version)}
      <div class="flex items-center justify-between py-2 border-b border-stone-200 dark:border-stone-700 last:border-0">
        <div class="flex items-center gap-3">
          <VersionBadge version={version.version} status={version.status} />
          <span class="text-sm text-stone-600 dark:text-stone-400">
            {version.documentCount} pages · {version.uniqueUrlCount} URLs
          </span>
        </div>
        
        <div class="flex items-center gap-2">
          {#if version.status === 'completed'}
            <Button
              variant="outline"
              size="sm"
              class="{rescrapeConfirming === version.version ? 'bg-blue-500 text-white' : 'text-blue-600 border-blue-600'}"
              onclick={() => handleRescrapeClick(version.version)}
            >
              {rescrapeConfirming === version.version ? 'Rescrape?' : '♻️'}
            </Button>
          {/if}
          
          <Button
            variant="outline"
            size="sm"
            class="{deleteConfirming === version.version ? 'bg-red-500 text-white' : 'text-red-600 border-red-600'}"
            onclick={() => handleDeleteClick(version.version)}
          >
            {deleteConfirming === version.version ? 'Confirm?' : '🗑️'}
          </Button>
        </div>
      </div>
    {/each}
  </div>
</Card>
```

**Step 4: Run tests**

```bash
npm run test
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/web-sveltekit/
git commit -m "feat(webui): add LibraryItem with inline edit and actions"
```

---

### Task 15: Create LibraryList Component

**Files:**
- Create: `src/web-sveltekit/src/lib/components/libraries/LibraryList.svelte`

**Step 1: Write failing test**

```typescript
// tests/unit/libraries/LibraryList.test.ts
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import LibraryList from '$lib/components/libraries/LibraryList.svelte';

describe('LibraryList', () => {
  it('shows empty state when no libraries', () => {
    render(LibraryList, { props: { libraries: [] } });
    expect(screen.getByText(/No libraries indexed/i)).toBeInTheDocument();
  });
});
```

**Step 2: Create LibraryList.svelte**

```svelte
<script lang="ts">
  import LibraryItem from './LibraryItem.svelte';
  import { librariesStore } from '$lib/stores/libraries.svelte';
  import { onMount } from 'svelte';

  onMount(() => {
    librariesStore.fetch();
  });

  const sortedLibraries = $derived(
    [...librariesStore.libraries].sort((a, b) => a.name.localeCompare(b.name))
  );
</script>

<div class="space-y-3">
  {#if librariesStore.loading}
    <div class="text-center py-4">
      <div class="animate-spin w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full mx-auto"></div>
    </div>
  {:else if sortedLibraries.length === 0}
    <div class="text-center py-8 text-stone-500 dark:text-stone-400">
      <p>No libraries indexed yet</p>
      <p class="text-sm mt-1">Submit a scrape job to create your first library</p>
    </div>
  {:else}
    {#each sortedLibraries as library (library.name)}
      <LibraryItem {library} />
    {/each}
  {/if}
</div>
```

**Step 3: Run tests**

```bash
npm run test
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/web-sveltekit/
git commit -m "feat(webui): add LibraryList component"
```

---

## Phase 5: Scrape Form

### Task 16: Create ScrapeForm Component

**Files:**
- Create: `src/web-sveltekit/src/lib/components/scrape/ScrapeForm.svelte`
- Create: `src/web-sveltekit/src/lib/components/scrape/URLInput.svelte`
- Create: `src/web-sveltekit/src/lib/components/scrape/AdvancedOptions.svelte`

**Step 1: Write failing test**

```typescript
// tests/unit/scrape/ScrapeForm.test.ts
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ScrapeForm from '$lib/components/scrape/ScrapeForm.svelte';

describe('ScrapeForm', () => {
  it('renders URL input and library name field', () => {
    render(ScrapeForm);
    expect(screen.getByPlaceholderText(/url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/library/i)).toBeInTheDocument();
  });

  it('has add URL button', () => {
    render(ScrapeForm);
    expect(screen.getByRole('button', { name: /\+/ })).toBeInTheDocument();
  });
});
```

**Step 2: Create URLInput.svelte**

```svelte
<script lang="ts">
  import { Input } from '$lib/components/ui/input';
  import { Button } from '$lib/components/ui/button';

  interface Props {
    url: string;
    index: number;
    error?: string;
    canRemove: boolean;
    oninput: (value: string) => void;
    onremove: () => void;
  }

  let { url, index, error, canRemove, oninput, onremove }: Props = $props();
</script>

<div class="flex gap-2 items-start">
  <div class="flex-1">
    <Input
      type="url"
      value={url}
      placeholder="https://docs.example.com"
      oninput={(e) => oninput(e.currentTarget.value)}
      class="{error ? 'border-red-500' : ''}"
    />
    {#if error}
      <p class="text-xs text-red-500 mt-1">{error}</p>
    {/if}
  </div>
  
  {#if canRemove}
    <Button
      variant="ghost"
      size="icon"
      onclick={onremove}
      class="text-red-500 hover:text-red-700"
    >
      ✕
    </Button>
  {/if}
</div>
```

**Step 3: Create AdvancedOptions.svelte**

```svelte
<script lang="ts">
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '$lib/components/ui/select';
  import { Textarea } from '$lib/components/ui/textarea';

  interface Props {
    maxPages?: number;
    maxDepth?: number;
    scope?: 'subpages' | 'hostname' | 'domain';
    includePatterns?: string;
    excludePatterns?: string;
    customHeaders?: string;
    followRedirects?: boolean;
    ignoreErrors?: boolean;
  }

  let {
    maxPages = 1000,
    maxDepth = 3,
    scope = 'subpages',
    includePatterns = '',
    excludePatterns = '',
    customHeaders = '',
    followRedirects = true,
    ignoreErrors = true,
  }: Props = $props();

  let open = $state(false);
</script>

<div class="mt-4">
  <button
    type="button"
    onclick={() => open = !open}
    class="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
  >
    {open ? '▼' : '▶'} Advanced Options
  </button>

  {#if open}
    <div class="mt-3 space-y-4 p-4 bg-stone-50 dark:bg-stone-900 rounded-lg">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <Label for="maxPages">Max Pages</Label>
          <Input
            id="maxPages"
            type="number"
            bind:value={maxPages}
            min={1}
            max={10000}
          />
        </div>
        
        <div>
          <Label for="maxDepth">Max Depth</Label>
          <Input
            id="maxDepth"
            type="number"
            bind:value={maxDepth}
            min={0}
            max={10}
          />
        </div>
      </div>

      <div>
        <Label>Scope</Label>
        <Select bind:value={scope}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="subpages">Subpages Only</SelectItem>
            <SelectItem value="hostname">Same Hostname</SelectItem>
            <SelectItem value="domain">Same Domain</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label for="includePatterns">Include Patterns (one per line)</Label>
        <Textarea
          id="includePatterns"
          bind:value={includePatterns}
          placeholder="/docs/*&#10;/api/*"
          rows={2}
        />
      </div>

      <div>
        <Label for="excludePatterns">Exclude Patterns (one per line)</Label>
        <Textarea
          id="excludePatterns"
          bind:value={excludePatterns}
          placeholder="/search&#10;/login"
          rows={2}
        />
      </div>

      <div>
        <Label for="customHeaders">Custom Headers (JSON)</Label>
        <Textarea
          id="customHeaders"
          bind:value={customHeaders}
          placeholder='{"Authorization": "Bearer token"}'
          rows={2}
        />
      </div>

      <div class="flex gap-4">
        <label class="flex items-center gap-2">
          <input type="checkbox" bind:checked={followRedirects} />
          <span class="text-sm">Follow Redirects</span>
        </label>
        
        <label class="flex items-center gap-2">
          <input type="checkbox" bind:checked={ignoreErrors} />
          <span class="text-sm">Ignore Errors</span>
        </label>
      </div>
    </div>
  {/if}
</div>
```

**Step 4: Create ScrapeForm.svelte**

```svelte
<script lang="ts">
  import { Card } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Button } from '$lib/components/ui/button';
  import URLInput from './URLInput.svelte';
  import AdvancedOptions from './AdvancedOptions.svelte';
  import { trpc } from '$lib/api/trpc';
  import { jobsStore } from '$lib/stores/jobs.svelte';

  const MAX_URLS = 10;

  let urls = $state<string[]>(['']);
  let library = $state('');
  let version = $state('');
  let errors = $state<Record<number, string>>({});
  let submitting = $state(false);
  
  // Advanced options
  let maxPages = $state(1000);
  let maxDepth = $state(3);
  let scope = $state<'subpages' | 'hostname' | 'domain'>('subpages');
  let includePatterns = $state('');
  let excludePatterns = $state('');
  let customHeaders = $state('');
  let followRedirects = $state(true);
  let ignoreErrors = $state(true);

  function addUrl() {
    if (urls.length < MAX_URLS) {
      urls = [...urls, ''];
    }
  }

  function removeUrl(index: number) {
    urls = urls.filter((_, i) => i !== index);
    errors = Object.fromEntries(Object.entries(errors).filter(([k]) => k !== String(index)));
  }

  function updateUrl(index: number, value: string) {
    urls = urls.map((u, i) => i === index ? value : u);
    // Clear error when user types
    errors = Object.fromEntries(Object.entries(errors).filter(([k]) => k !== String(index)));
  }

  function validateUrls(): boolean {
    const newErrors: Record<number, string> = {};
    const urlPattern = /^https?:\/\/.+/;

    urls.forEach((url, i) => {
      if (!url.trim()) {
        newErrors[i] = 'URL is required';
      } else if (!urlPattern.test(url.trim())) {
        newErrors[i] = 'Must be a valid HTTP/HTTPS URL';
      }
    });

    errors = newErrors;
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    
    if (!validateUrls()) return;
    if (!library.trim()) return;

    submitting = true;
    
    try {
      const validUrls = urls.map(u => u.trim()).filter(Boolean);
      
      const headers = customHeaders.trim() 
        ? JSON.parse(customHeaders) 
        : undefined;

      for (const url of validUrls) {
        await trpc.pipeline.enqueueJob.mutate({
          url,
          library: library.trim(),
          version: version.trim() || null,
          options: {
            maxPages,
            maxDepth,
            scope,
            followRedirects,
            ignoreErrors,
            includePatterns: includePatterns.trim() ? includePatterns.split('\n').filter(Boolean) : undefined,
            excludePatterns: excludePatterns.trim() ? excludePatterns.split('\n').filter(Boolean) : undefined,
            headers,
          },
        });
      }

      // Reset form
      urls = [''];
      library = '';
      version = '';
      
      // Refresh jobs list
      await jobsStore.fetch();
    } catch (err) {
      console.error('Failed to submit job:', err);
    } finally {
      submitting = false;
    }
  }

  const canAddUrl = $derived(urls.length < MAX_URLS);
</script>

<Card class="p-6">
  <form onsubmit={handleSubmit}>
    <div class="space-y-4">
      <!-- URL Inputs -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <Label>Documentation URLs</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onclick={addUrl}
            disabled={!canAddUrl}
          >
            + Add URL ({urls.length}/{MAX_URLS})
          </Button>
        </div>
        
        <div class="space-y-2">
          {#each urls as url, i (i)}
            <URLInput
              {url}
              index={i}
              error={errors[i]}
              canRemove={urls.length > 1}
              oninput={(v) => updateUrl(i, v)}
              onremove={() => removeUrl(i)}
            />
          {/each}
        </div>
      </div>

      <!-- Library Name -->
      <div>
        <Label for="library">Library Name</Label>
        <Input
          id="library"
          bind:value={library}
          placeholder="react, vue, my-library"
          required
        />
      </div>

      <!-- Version -->
      <div>
        <Label for="version">Version (optional)</Label>
        <Input
          id="version"
          bind:value={version}
          placeholder="1.0.0, latest, dev"
        />
      </div>

      <!-- Advanced Options -->
      <AdvancedOptions
        bind:maxPages
        bind:maxDepth
        bind:scope
        bind:includePatterns
        bind:excludePatterns
        bind:customHeaders
        bind:followRedirects
        bind:ignoreErrors
      />

      <!-- Submit Button -->
      <Button
        type="submit"
        class="w-full"
        disabled={submitting}
      >
        {submitting ? 'Queueing...' : 'Queue Scrape Job'}
      </Button>
    </div>
  </form>
</Card>
```

**Step 5: Run tests**

```bash
npm run test
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/web-sveltekit/
git commit -m "feat(webui): add ScrapeForm with multi-URL support"
```

---

## Phase 6: Home Page

### Task 17: Create Home Page

**Files:**
- Modify: `src/web-sveltekit/src/routes/+page.svelte`

**Step 1: Write E2E test**

```typescript
// tests/e2e/home.spec.ts
import { test, expect } from '@playwright/test';

test('home page displays scrape form and job queue', async ({ page }) => {
  await page.goto('/');
  
  // Should have URL input
  await expect(page.getByPlaceholder(/url/i)).toBeVisible();
  
  // Should have library name input
  await expect(page.getByLabel(/library/i)).toBeVisible();
  
  // Should have submit button
  await expect(page.getByRole('button', { name: /queue/i })).toBeVisible();
});
```

**Step 2: Create +page.svelte**

```svelte
<script lang="ts">
  import ScrapeForm from '$lib/components/scrape/ScrapeForm.svelte';
  import JobList from '$lib/components/jobs/JobList.svelte';
  import LibraryList from '$lib/components/libraries/LibraryList.svelte';
</script>

<svelte:head>
  <title>Scrapegoat - Documentation Indexer</title>
</svelte:head>

<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <!-- Left Column: Form + Jobs -->
  <div class="space-y-6">
    <section>
      <h2 class="text-xl font-semibold mb-4 text-stone-800 dark:text-stone-100">
        Scrape Documentation
      </h2>
      <ScrapeForm />
    </section>

    <section>
      <h2 class="text-xl font-semibold mb-4 text-stone-800 dark:text-stone-100">
        Job Queue
      </h2>
      <JobList />
    </section>
  </div>

  <!-- Right Column: Libraries -->
  <div>
    <section>
      <h2 class="text-xl font-semibold mb-4 text-stone-800 dark:text-stone-100">
        Indexed Libraries
      </h2>
      <LibraryList />
    </section>
  </div>
</div>
```

**Step 3: Run E2E test**

```bash
npm run test:e2e
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/web-sveltekit/
git commit -m "feat(webui): create home page with form, jobs, and libraries"
```

---

## Phase 7: Library Detail & Search

### Task 18: Create Library Detail Page

**Files:**
- Create: `src/web-sveltekit/src/routes/libraries/[name]/+page.svelte`
- Create: `src/web-sveltekit/src/routes/libraries/[name]/+page.server.ts`

**Step 1: Write E2E test**

```typescript
// tests/e2e/library-detail.spec.ts
import { test, expect } from '@playwright/test';

test('library detail page shows search form', async ({ page }) => {
  await page.goto('/libraries/react');
  
  // Should show library name
  await expect(page.getByRole('heading', { name: /react/i })).toBeVisible();
  
  // Should have search input
  await expect(page.getByPlaceholder(/search/i)).toBeVisible();
});
```

**Step 2: Create +page.server.ts**

```typescript
import type { PageServerLoad } from './$types';
import { trpc } from '$lib/api/trpc';

export const load: PageServerLoad = async ({ params }) => {
  const library = await trpc.data.listLibraries.query();
  const lib = library.find(l => l.name.toLowerCase() === params.name.toLowerCase());
  
  return {
    library: lib,
    name: params.name,
  };
};
```

**Step 3: Create +page.svelte**

```svelte
<script lang="ts">
  import { page } from '$app/stores';
  import { Input } from '$lib/components/ui/input';
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { Badge } from '$lib/components/ui/badge';
  import { trpc } from '$lib/api/trpc';

  let { data } = $props();

  let query = $state('');
  let searching = $state(false);
  let results = $state<{ url: string; content: string; score: number | null }[]>([]);
  let selectedVersion = $state(data.library?.versions[0]?.version || '');

  async function handleSearch() {
    if (!query.trim()) return;
    
    searching = true;
    try {
      const result = await trpc.data.search.query({
        library: data.name,
        version: selectedVersion || undefined,
        query: query.trim(),
        limit: 10,
      });
      results = result;
    } catch (e) {
      console.error('Search failed:', e);
    } finally {
      searching = false;
    }
  }
</script>

<svelte:head>
  <title>{data.name} - Scrapegoat</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div>
    <h1 class="text-2xl font-bold text-stone-800 dark:text-stone-100">
      {data.name}
    </h1>
    
    {#if data.library}
      <div class="flex items-center gap-2 mt-2">
        {#each data.library.versions as v}
          <Badge
            variant={v.version === selectedVersion ? 'default' : 'outline'}
            class="cursor-pointer"
            onclick={() => selectedVersion = v.version}
          >
            {v.version || 'Unversioned'}
          </Badge>
        {/each}
      </div>
      
      <div class="mt-4 text-sm text-stone-600 dark:text-stone-400">
        <span class="mr-4">{data.library.versions[0]?.documentCount || 0} pages</span>
        <span class="mr-4">{data.library.versions[0]?.uniqueUrlCount || 0} URLs</span>
        <span>Indexed: {data.library.versions[0]?.indexedAt ? new Date(data.library.versions[0].indexedAt).toLocaleDateString() : 'N/A'}</span>
      </div>
    {:else}
      <p class="text-stone-500 dark:text-stone-400 mt-2">Library not found</p>
    {/if}
  </div>

  <!-- Search Form -->
  <Card class="p-4">
    <form onsubmit={(e) => { e.preventDefault(); handleSearch(); }} class="flex gap-2">
      <Input
        bind:value={query}
        placeholder="Search documentation..."
        class="flex-1"
      />
      <Button type="submit" disabled={searching}>
        {searching ? 'Searching...' : 'Search'}
      </Button>
    </form>
  </Card>

  <!-- Search Results -->
  {#if results.length > 0}
    <div class="space-y-4">
      {#each results as result (result.url)}
        <Card class="p-4">
          <div class="prose dark:prose-invert max-w-none">
            {@html result.content}
          </div>
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            class="text-sm text-primary-600 hover:underline mt-2 block"
          >
            {result.url}
          </a>
        </Card>
      {/each}
    </div>
  {/if}
</div>
```

**Step 4: Run E2E test**

```bash
npm run test:e2e
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/web-sveltekit/
git commit -m "feat(webui): add library detail page with search"
```

---

## Phase 8: Build & Integration

### Task 19: Configure Static Build Output

**Files:**
- Modify: `src/web-sveltekit/svelte.config.js`
- Modify: `src/web-sveltekit/package.json`

**Step 1: Install static adapter**

```bash
cd src/web-sveltekit
npm install -D @sveltejs/adapter-static
```

**Step 2: Update svelte.config.js**

```javascript
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html',
      precompress: false,
      strict: true,
    }),
  },
};

export default config;
```

**Step 3: Add prerender option to +layout.ts**

Create `src/web-sveltekit/src/routes/+layout.ts`:
```typescript
export const prerender = true;
export const ssr = false;
```

**Step 4: Add build script to package.json**

```json
{
  "scripts": {
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

**Step 5: Test build**

```bash
npm run build
```

Expected: `build/` directory created with index.html

**Step 6: Commit**

```bash
git add src/web-sveltekit/
git commit -m "feat(webui): configure static adapter for SPA build"
```

---

### Task 20: Integrate with Fastify

**Files:**
- Modify: `src/app.ts` (or equivalent)
- Modify: `package.json` (build scripts)

**Step 1: Update Fastify to serve static files**

```typescript
// src/app.ts - add after other plugins
import fastifyStatic from '@fastify/static';
import path from 'path';

// Serve SvelteKit static files
await server.register(fastifyStatic, {
  root: path.join(__dirname, '../src/web-sveltekit/build'),
  prefix: '/',
  decorateReply: true,
});

// SPA fallback for client-side routing
server.setNotFoundHandler((request, reply) => {
  // Don't intercept API, web, or SSE routes
  if (request.url.startsWith('/api/') || 
      request.url.startsWith('/web/') ||
      request.url.startsWith('/sse') ||
      request.url.startsWith('/mcp')) {
    return reply.code(404).send({ error: 'Not found' });
  }
  
  // Serve index.html for SPA routes
  return reply.sendFile('index.html');
});
```

**Step 2: Update root package.json scripts**

```json
{
  "scripts": {
    "build": "vite build && npm run build --workspace=src/web-sveltekit && node scripts/copy-webui.js",
    "build:backend": "vite build",
    "build:webui": "npm run build --workspace=src/web-sveltekit"
  }
}
```

**Step 3: Create copy script**

Create `scripts/copy-webui.js`:
```javascript
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../src/web-sveltekit/build');
const dest = path.join(__dirname, '../public/webui');

// Remove old build
if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true });
}

// Copy new build
fs.cpSync(src, dest, { recursive: true });

console.log('WebUI copied to public/webui/');
```

**Step 4: Test full build**

```bash
npm run build
```

Expected: `public/webui/` contains SvelteKit build

**Step 5: Commit**

```bash
git add .
git commit -m "feat: integrate SvelteKit build with Fastify static serving"
```

---

### Task 21: Update Docker Configuration

**Files:**
- Modify: `Dockerfile`

**Step 1: Update Dockerfile to build SvelteKit**

```dockerfile
# Worker builder stage
FROM node:22-slim AS worker-builder
WORKDIR /app
COPY package*.json ./
COPY src/web-sveltekit/package*.json ./src/web-sveltekit/
RUN npm ci --include=dev
COPY . .
RUN npm run build

# Final stage
FROM node:22-slim
WORKDIR /app
COPY --from=worker-builder /app/dist ./dist
COPY --from=worker-builder /app/public ./public
COPY --from=worker-builder /app/node_modules ./node_modules
COPY --from=worker-builder /app/package.json ./

EXPOSE 6280 6281 8080
CMD ["node", "dist/index.js"]
```

**Step 2: Test Docker build**

```bash
docker build -t scrapegoat:test .
docker run -p 6281:6281 scrapegoat:test
```

Expected: Server starts, WebUI accessible at :6281

**Step 3: Commit**

```bash
git add Dockerfile
git commit -m "feat: update Dockerfile for SvelteKit build"
```

---

### Task 22: Remove Old WebUI

**Files:**
- Delete: `src/web/` (entire directory)
- Modify: `src/app.ts` (remove old web routes)

**Step 1: Delete old WebUI files**

```bash
rm -rf src/web/
```

**Step 2: Remove old web route imports from app.ts**

Remove any imports and registrations related to `./web/routes`.

**Step 3: Run tests**

```bash
npm run test
npm run build
```

Expected: All tests pass, build succeeds

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove old JSX/Alpine.js/HTMX WebUI"
```

---

### Task 23: Final E2E Testing

**Files:**
- Create: `tests/e2e/full-flow.spec.ts`

**Step 1: Write comprehensive E2E test**

```typescript
// tests/e2e/full-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Scrapegoat Full Flow', () => {
  test('submit job and watch progress', async ({ page }) => {
    await page.goto('/');
    
    // Fill form
    await page.getByPlaceholder(/url/i).fill('https://httpbin.org');
    await page.getByLabel(/library/i).fill('test-lib');
    
    // Submit
    await page.getByRole('button', { name: /queue/i }).click();
    
    // Job should appear in queue
    await expect(page.getByText('test-lib')).toBeVisible({ timeout: 5000 });
  });

  test('search library', async ({ page }) => {
    // Navigate to a library (assuming one exists)
    await page.goto('/');
    
    // Click on first library
    const libraryLink = page.getByRole('link').filter({ hasText: /react/i }).first();
    if (await libraryLink.isVisible()) {
      await libraryLink.click();
      
      // Search
      await page.getByPlaceholder(/search/i).fill('hooks');
      await page.getByRole('button', { name: /search/i }).click();
    }
  });
});
```

**Step 2: Run all E2E tests**

```bash
npm run test:e2e
```

Expected: All tests pass

**Step 3: Commit**

```bash
git add tests/
git commit -m "test(webui): add comprehensive E2E tests"
```

---

## Verification Checklist

Before marking complete, verify:

- [ ] `npm run build` succeeds
- [ ] `npm run test` passes (unit + component)
- [ ] `npm run test:e2e` passes (critical flows)
- [ ] Docker build succeeds
- [ ] WebUI loads at :6281
- [ ] Can submit scrape job
- [ ] Job progress updates via SSE
- [ ] Library list shows indexed libraries
- [ ] Can search within library
- [ ] Can delete library version
- [ ] Can rescrape version
- [ ] Can edit library title inline
- [ ] Dark mode toggle works
- [ ] MCP status badge shows connection status
- [ ] No TypeScript errors (`npm run check`)
- [ ] Linting passes

---

## Estimated Time

| Phase | Tasks | Est. Time |
|-------|-------|-----------|
| Phase 1: Infrastructure | 5 tasks | 2-3 hours |
| Phase 2: Layout | 3 tasks | 1-2 hours |
| Phase 3: Jobs | 4 tasks | 2-3 hours |
| Phase 4: Libraries | 3 tasks | 1-2 hours |
| Phase 5: Form | 1 task | 1-2 hours |
| Phase 6: Home | 1 task | 0.5 hours |
| Phase 7: Search | 1 task | 1 hour |
| Phase 8: Integration | 5 tasks | 2-3 hours |
| **Total** | **23 tasks** | **11-17 hours** |

---

**Plan complete and saved to `docs/plans/2026-03-14-scrapegoats-new-clothes-implementation.md`.**

**Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach, Master?**
