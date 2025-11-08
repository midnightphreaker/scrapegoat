# Phase 4: WebUI Integration

**Status**: Ready for Implementation (after Phase 2, parallel with Phase 3)
**Priority**: P1 (High Value - User Facing)
**Estimated Effort**: 16-24 hours
**Complexity**: Medium-High
**Risk Level**: Low

## Overview

Enhance the web user interface to expose Crawl4AI features, provide fetcher selection controls, display rich media content, and monitor service health. Makes the enhanced backend capabilities accessible and user-friendly.

## Requirements

### Functional Requirements

1. **Service Health Monitoring**
   - Display Crawl4AI service status (OK, degraded, down)
   - Show service version and uptime
   - Alert when service unavailable
   - Real-time status updates

2. **Fetcher Selection UI**
   - Dropdown/radio for fetcher selection in job creation
   - Options: Auto, HTTP, Browser, Crawl4AI
   - Show which fetcher was used for completed jobs
   - Visual indicators for each fetcher type

3. **Enhanced Content Display**
   - Screenshot viewer for pages with screenshots
   - Media gallery for extracted images/videos/audio
   - Links table showing extracted links
   - Metadata panel showing fetcher details

4. **Crawl4AI Options Controls**
   - Toggle for screenshot capture
   - Toggle for media extraction
   - Toggle for link extraction
   - Screenshot mode selector (viewport/full)

5. **Configuration Page**
   - View/edit Crawl4AI service settings
   - Enable/disable features globally
   - Set default fetcher preference
   - Service health dashboard

### Non-Functional Requirements

1. **Responsive Design**: Works on desktop and tablet
2. **Performance**: No UI lag when displaying media
3. **Accessibility**: WCAG AA compliance
4. **Usability**: Intuitive, self-explanatory interface

## Architecture Design

### Component Structure

```
src/web/components/
├── ServiceStatus/
│   ├── ServiceStatusCard.tsx        # Health status display
│   ├── ServiceHealthIndicator.tsx   # Status badge (green/yellow/red)
│   └── ServiceMetrics.tsx           # Uptime, version info
├── Jobs/
│   ├── JobForm.tsx                  # Enhanced with fetcher selection
│   ├── JobDetails.tsx               # Enhanced with rich content
│   ├── FetcherSelector.tsx          # Fetcher dropdown/radio
│   └── Crawl4AIOptions.tsx          # Options toggles
├── Pages/
│   ├── PageView.tsx                 # Enhanced page viewer
│   ├── ScreenshotViewer.tsx         # Screenshot display
│   ├── MediaGallery.tsx             # Media carousel
│   └── LinksTable.tsx               # Extracted links table
└── Settings/
    ├── SettingsPage.tsx             # Main settings page
    ├── Crawl4AISettings.tsx         # Crawl4AI configuration
    └── FetcherSettings.tsx          # Default fetcher selection
```

### API Routes

**New Routes**:

```typescript
// Service health check
GET /api/health/crawl4ai
Response: { status: 'ok' | 'degraded' | 'down', version: string, uptime: number }

// Get screenshot for page
GET /api/pages/:pageId/screenshot
Response: PNG image (binary)

// Get page metadata (media, links)
GET /api/pages/:pageId/metadata
Response: { media?: MediaItem[], links?: LinkItem[] }

// Get all service health statuses
GET /api/health/all
Response: { http: HealthStatus, browser: HealthStatus, crawl4ai: HealthStatus }
```

**Updated Routes**:

```typescript
// Create job with fetcher selection
POST /api/jobs
Body: {
  library: string,
  version: string,
  url: string,
  fetcher?: 'auto' | 'http' | 'browser' | 'crawl4ai',
  options?: {
    enableScreenshots?: boolean,
    enableMedia?: boolean,
    enableLinks?: boolean,
    screenshotMode?: 'viewport' | 'full'
  }
}
```

## Implementation Tasks

### Task 1: Service Health Components (4 hours)

**Files**: `src/web/components/ServiceStatus/`

#### ServiceHealthIndicator.tsx
```tsx
interface ServiceHealthIndicatorProps {
  status: 'ok' | 'degraded' | 'down';
  serviceName: string;
}

export function ServiceHealthIndicator({ status, serviceName }: ServiceHealthIndicatorProps) {
  const colors = {
    ok: 'bg-green-500',
    degraded: 'bg-yellow-500',
    down: 'bg-red-500',
  };

  const icons = {
    ok: '✓',
    degraded: '⚠',
    down: '✗',
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${colors[status]}`} />
      <span className="font-medium">{serviceName}</span>
      <span className="text-sm text-gray-500">{icons[status]}</span>
    </div>
  );
}
```

#### ServiceStatusCard.tsx
```tsx
export function ServiceStatusCard() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('/api/health/all');
        const data = await response.json();
        setHealth(data);
      } catch (error) {
        console.error('Health check failed:', error);
      } finally {
        setLoading(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Poll every 30s

    return () => clearInterval(interval);
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="card">
      <h3 className="text-lg font-bold mb-4">Service Health</h3>
      <div className="space-y-2">
        <ServiceHealthIndicator status="ok" serviceName="HTTP Fetcher" />
        <ServiceHealthIndicator status="ok" serviceName="Browser Fetcher" />
        <ServiceHealthIndicator
          status={health?.crawl4ai?.status || 'down'}
          serviceName="Crawl4AI Service"
        />
      </div>
      {health?.crawl4ai && (
        <div className="mt-4 text-sm text-gray-600">
          <p>Version: {health.crawl4ai.version}</p>
          <p>Uptime: {Math.floor(health.crawl4ai.uptime / 60)}m</p>
        </div>
      )}
    </div>
  );
}
```

**Subtasks**:
- [ ] Create ServiceHealthIndicator component
- [ ] Create ServiceStatusCard component
- [ ] Create ServiceMetrics component
- [ ] Add auto-refresh (polling)
- [ ] Add error states
- [ ] Style with existing theme

### Task 2: Fetcher Selection Components (4 hours)

**Files**: `src/web/components/Jobs/`

#### FetcherSelector.tsx
```tsx
interface FetcherSelectorProps {
  value: FetcherType;
  onChange: (fetcher: FetcherType) => void;
}

export function FetcherSelector({ value, onChange }: FetcherSelectorProps) {
  return (
    <div className="form-group">
      <label className="form-label">Content Fetcher</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as FetcherType)}
        className="form-select"
      >
        <option value="auto">Auto-detect (recommended)</option>
        <option value="http">HTTP Fetch (fast)</option>
        <option value="browser">Browser (JavaScript support)</option>
        <option value="crawl4ai">Crawl4AI (AI-optimized)</option>
      </select>
      <p className="form-help">
        {value === 'auto' && 'Automatically selects the best fetcher for the URL'}
        {value === 'http' && 'Fast HTTP-only fetching, no JavaScript execution'}
        {value === 'browser' && 'Full browser with JavaScript support, slower'}
        {value === 'crawl4ai' && 'AI-optimized markdown with optional screenshots and media'}
      </p>
    </div>
  );
}
```

#### Crawl4AIOptions.tsx
```tsx
interface Crawl4AIOptionsProps {
  enabled: boolean;
  options: Crawl4AIOptions;
  onChange: (options: Crawl4AIOptions) => void;
}

export function Crawl4AIOptions({ enabled, options, onChange }: Crawl4AIOptionsProps) {
  if (!enabled) return null;

  return (
    <div className="border-l-4 border-pink-500 pl-4 space-y-3">
      <h4 className="font-medium">Crawl4AI Options</h4>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={options.enableScreenshot || false}
          onChange={(e) => onChange({ ...options, enableScreenshot: e.target.checked })}
        />
        <span>Capture screenshots</span>
      </label>

      {options.enableScreenshot && (
        <div className="ml-6">
          <label className="form-label">Screenshot mode</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="screenshotMode"
                value="viewport"
                checked={options.screenshotMode === 'viewport'}
                onChange={() => onChange({ ...options, screenshotMode: 'viewport' })}
              />
              <span>Viewport</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="screenshotMode"
                value="full"
                checked={options.screenshotMode === 'full'}
                onChange={() => onChange({ ...options, screenshotMode: 'full' })}
              />
              <span>Full page</span>
            </label>
          </div>
        </div>
      )}

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={options.enableMedia || false}
          onChange={(e) => onChange({ ...options, enableMedia: e.target.checked })}
        />
        <span>Extract media (images, videos, audio)</span>
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={options.enableLinks || false}
          onChange={(e) => onChange({ ...options, enableLinks: e.target.checked })}
        />
        <span>Extract links</span>
      </label>
    </div>
  );
}
```

**Subtasks**:
- [ ] Create FetcherSelector component
- [ ] Create Crawl4AIOptions component
- [ ] Add to JobForm component
- [ ] Wire up state management
- [ ] Add form validation
- [ ] Style consistently

### Task 3: Enhanced Content Display (6 hours)

**Files**: `src/web/components/Pages/`

#### ScreenshotViewer.tsx
```tsx
interface ScreenshotViewerProps {
  pageId: number;
  screenshotPath?: string;
}

export function ScreenshotViewer({ pageId, screenshotPath }: ScreenshotViewerProps) {
  if (!screenshotPath) return null;

  return (
    <div className="screenshot-viewer">
      <h3 className="text-lg font-bold mb-2">Page Screenshot</h3>
      <img
        src={screenshotPath}
        alt="Page screenshot"
        className="border rounded shadow-lg max-w-full"
        loading="lazy"
      />
      <a
        href={screenshotPath}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-pink-500 hover:underline mt-2 inline-block"
      >
        Open in new tab →
      </a>
    </div>
  );
}
```

#### MediaGallery.tsx
```tsx
interface MediaGalleryProps {
  media: MediaItem[];
}

export function MediaGallery({ media }: MediaGalleryProps) {
  if (!media || media.length === 0) return null;

  const images = media.filter(m => m.type === 'image');
  const videos = media.filter(m => m.type === 'video');
  const audio = media.filter(m => m.type === 'audio');

  return (
    <div className="media-gallery">
      <h3 className="text-lg font-bold mb-2">Extracted Media</h3>

      {images.length > 0 && (
        <div className="mb-4">
          <h4 className="font-medium mb-2">Images ({images.length})</h4>
          <div className="grid grid-cols-3 gap-4">
            {images.map((img, idx) => (
              <div key={idx} className="border rounded overflow-hidden">
                <img
                  src={img.url}
                  alt={img.alt || 'Image'}
                  className="w-full h-32 object-cover"
                  loading="lazy"
                />
                {img.alt && (
                  <p className="text-xs p-2 text-gray-600 truncate">{img.alt}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {videos.length > 0 && (
        <div className="mb-4">
          <h4 className="font-medium mb-2">Videos ({videos.length})</h4>
          <ul className="space-y-2">
            {videos.map((video, idx) => (
              <li key={idx}>
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-pink-500 hover:underline"
                >
                  {video.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {audio.length > 0 && (
        <div>
          <h4 className="font-medium mb-2">Audio ({audio.length})</h4>
          <ul className="space-y-2">
            {audio.map((aud, idx) => (
              <li key={idx}>
                <a
                  href={aud.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-pink-500 hover:underline"
                >
                  {aud.url}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

#### LinksTable.tsx
```tsx
interface LinksTableProps {
  links: LinkItem[];
  baseUrl: string;
}

export function LinksTable({ links, baseUrl }: LinksTableProps) {
  if (!links || links.length === 0) return null;

  const categorized = links.reduce((acc, link) => {
    const isInternal = link.url.startsWith(baseUrl) || link.url.startsWith('/');
    const category = isInternal ? 'internal' : 'external';
    acc[category].push(link);
    return acc;
  }, { internal: [] as LinkItem[], external: [] as LinkItem[] });

  return (
    <div className="links-table">
      <h3 className="text-lg font-bold mb-2">Extracted Links</h3>

      <div className="mb-4">
        <h4 className="font-medium mb-2">
          Internal Links ({categorized.internal.length})
        </h4>
        <table className="table-auto w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Text</th>
              <th className="text-left p-2">URL</th>
            </tr>
          </thead>
          <tbody>
            {categorized.internal.map((link, idx) => (
              <tr key={idx} className="border-b">
                <td className="p-2">{link.text}</td>
                <td className="p-2 font-mono text-xs">{link.url}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h4 className="font-medium mb-2">
          External Links ({categorized.external.length})
        </h4>
        <table className="table-auto w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Text</th>
              <th className="text-left p-2">URL</th>
            </tr>
          </thead>
          <tbody>
            {categorized.external.map((link, idx) => (
              <tr key={idx} className="border-b">
                <td className="p-2">{link.text}</td>
                <td className="p-2 font-mono text-xs truncate max-w-xs">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-pink-500 hover:underline"
                  >
                    {link.url}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Subtasks**:
- [ ] Create ScreenshotViewer component
- [ ] Create MediaGallery component
- [ ] Create LinksTable component
- [ ] Add to PageView component
- [ ] Add loading states
- [ ] Handle errors gracefully

### Task 4: Backend API Routes (4 hours)

**Files**: `src/web/routes/`, `src/web/web.ts`

```typescript
// Health check endpoint
app.get('/api/health/crawl4ai', async (request, reply) => {
  try {
    const client = new Crawl4AIClient();
    const health = await client.health();
    reply.send(health);
  } catch (error) {
    reply.status(503).send({
      status: 'down',
      version: 'unknown',
      uptime: 0,
    });
  }
});

// All services health
app.get('/api/health/all', async (request, reply) => {
  const [crawl4aiHealth] = await Promise.allSettled([
    new Crawl4AIClient().health(),
  ]);

  reply.send({
    http: { status: 'ok' }, // Always available
    browser: { status: 'ok' }, // Always available (lazy init)
    crawl4ai: crawl4aiHealth.status === 'fulfilled'
      ? crawl4aiHealth.value
      : { status: 'down', version: 'unknown', uptime: 0 },
  });
});

// Get screenshot
app.get('/api/pages/:pageId/screenshot', async (request, reply) => {
  const { pageId } = request.params as { pageId: string };

  const page = await storage.getPage(parseInt(pageId));
  if (!page || !page.screenshotPath) {
    reply.status(404).send({ error: 'Screenshot not found' });
    return;
  }

  const screenshot = await loadScreenshot(page.screenshotPath);
  reply.type('image/png').send(screenshot);
});

// Get page metadata
app.get('/api/pages/:pageId/metadata', async (request, reply) => {
  const { pageId } = request.params as { pageId: string };

  const page = await storage.getPage(parseInt(pageId));
  if (!page) {
    reply.status(404).send({ error: 'Page not found' });
    return;
  }

  const metadata = page.metadata ? JSON.parse(page.metadata) : {};
  reply.send(metadata);
});
```

**Subtasks**:
- [ ] Create health check endpoints
- [ ] Create screenshot endpoint
- [ ] Create metadata endpoint
- [ ] Update job creation endpoint
- [ ] Add error handling
- [ ] Add request validation

### Task 5: Integration & Testing (6 hours)

**Testing Checklist**:
- [ ] Unit tests for all new components
- [ ] Integration tests for API routes
- [ ] E2E tests for user workflows:
  - Create job with fetcher selection
  - View job with screenshot
  - View media gallery
  - View links table
  - Check service health
- [ ] Visual regression tests
- [ ] Accessibility tests
- [ ] Mobile responsive tests

## User Flows

### Flow 1: Create Job with Crawl4AI

1. User navigates to "New Job" page
2. User fills in library, version, URL
3. User selects "Crawl4AI" from fetcher dropdown
4. Crawl4AI options panel expands
5. User enables "Capture screenshots"
6. User enables "Extract media"
7. User clicks "Start Scraping"
8. Job starts, redirects to job details
9. User sees real-time progress
10. On completion, user sees screenshot and media

### Flow 2: Monitor Service Health

1. User navigates to dashboard
2. ServiceStatusCard shows all services
3. Green indicator for HTTP and Browser
4. Yellow indicator for Crawl4AI (degraded)
5. User clicks on Crawl4AI status
6. Tooltip shows "Service responding slowly"
7. User decides to use Browser fetcher instead

### Flow 3: View Enhanced Page Data

1. User navigates to specific page
2. Page view shows markdown content
3. Below content, screenshot is displayed
4. Scrolls down to see media gallery
5. Clicks on image to view full size
6. Scrolls to links table
7. Filters to see only internal links
8. Exports link list as CSV

## Deployment Considerations

### Static Assets
- Screenshots served from `/screenshots/` path
- Configure Fastify static plugin to serve this directory
- Ensure proper caching headers

### Performance
- Lazy load images in media gallery
- Paginate links table if > 100 links
- Debounce health check polls
- Cache screenshot thumbnails

### Security
- Validate screenshot paths (prevent directory traversal)
- Sanitize URLs in media/links
- Rate limit API endpoints
- CORS configuration

## Success Metrics

- [ ] All components rendering correctly
- [ ] Health monitoring functional
- [ ] Fetcher selection working
- [ ] Screenshots displaying
- [ ] Media gallery interactive
- [ ] Links table sortable/filterable
- [ ] Responsive on all screen sizes
- [ ] Accessibility score >90
- [ ] No console errors
- [ ] All tests passing

## Dependencies

**Depends On**:
- Phase 2 (Fetcher Selection) - Complete
- Phase 3 (Enhanced Features) - Partial (can start in parallel)

**Blocks**: None

## Timeline

- **Task 1** (Service Health): Days 1-2 (4 hours)
- **Task 2** (Fetcher Selection): Day 2 (4 hours)
- **Task 3** (Content Display): Days 3-4 (6 hours)
- **Task 4** (API Routes): Day 4 (4 hours)
- **Task 5** (Testing): Days 4-5 (6 hours)
- **Total**: 4-5 days (16-24 hours)

*Last Updated: 2025-11-08*
