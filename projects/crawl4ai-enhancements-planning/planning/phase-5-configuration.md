# Phase 5: Configuration & Management

**Status**: Ready for Implementation (after Phases 2-4)
**Priority**: P2 (Production Readiness)
**Estimated Effort**: 12-16 hours
**Complexity**: Medium
**Risk Level**: Low

## Overview

Implement comprehensive configuration management, monitoring infrastructure, and operational tooling to make the enhanced Crawl4AI integration production-ready. Focuses on observability, maintainability, and operational excellence.

## Requirements

### Functional Requirements

1. **Centralized Configuration**
   - Single source of truth for all settings
   - Environment variable support
   - Runtime configuration updates (where safe)
   - Configuration validation

2. **Metrics Collection**
   - Track fetcher usage by type
   - Success/failure rates per fetcher
   - Response time percentiles (p50, p95, p99)
   - Error rates and types

3. **Monitoring Dashboard**
   - Real-time metrics visualization
   - Service health overview
   - Historical trends
   - Alert indicators

4. **Enhanced Error Handling**
   - Detailed error messages
   - Error categorization
   - Retry logic configuration per fetcher
   - Circuit breaker status visibility

5. **Operational Tools**
   - Configuration validator
   - Service health checker
   - Metrics exporter
   - Troubleshooting guide

### Non-Functional Requirements

1. **Performance**: Metrics collection adds <5ms overhead
2. **Reliability**: Monitoring doesn't affect core functionality
3. **Scalability**: Handles high-volume scraping
4. **Maintainability**: Clear, well-documented configuration

## Architecture Design

### Configuration Structure

**File**: `src/utils/config.ts`

```typescript
/**
 * Centralized configuration management for Scrapegoat
 */

export interface Crawl4AIConfig {
  /** Crawl4AI service base URL */
  serviceUrl: string;
  /** Whether Crawl4AI is enabled globally */
  enabled: boolean;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Feature flags */
  features: {
    screenshots: boolean;
    media: boolean;
    links: boolean;
  };
  /** Default screenshot mode */
  defaultScreenshotMode: 'viewport' | 'full';
}

export interface FetcherConfig {
  /** Default fetcher type */
  defaultFetcher: FetcherType;
  /** HTTP fetcher configuration */
  http: {
    timeout: number;
    maxRetries: number;
    followRedirects: boolean;
  };
  /** Browser fetcher configuration */
  browser: {
    timeout: number;
    maxRetries: number;
    headless: boolean;
  };
  /** Crawl4AI configuration */
  crawl4ai: Crawl4AIConfig;
}

export interface StorageConfig {
  /** Screenshot storage path */
  screenshotPath: string;
  /** Maximum screenshot size in bytes */
  maxScreenshotSize: number;
  /** Screenshot retention days (0 = keep forever) */
  screenshotRetentionDays: number;
}

export interface MonitoringConfig {
  /** Enable metrics collection */
  enabled: boolean;
  /** Metrics export interval (ms) */
  exportInterval: number;
  /** Enable detailed logging */
  detailedLogging: boolean;
}

export interface Config {
  fetcher: FetcherConfig;
  storage: StorageConfig;
  monitoring: MonitoringConfig;
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): Config {
  return {
    fetcher: {
      defaultFetcher: (process.env.DEFAULT_FETCHER as FetcherType) || 'auto',
      http: {
        timeout: parseInt(process.env.HTTP_TIMEOUT || '10000'),
        maxRetries: parseInt(process.env.HTTP_MAX_RETRIES || '3'),
        followRedirects: process.env.HTTP_FOLLOW_REDIRECTS !== 'false',
      },
      browser: {
        timeout: parseInt(process.env.BROWSER_TIMEOUT || '30000'),
        maxRetries: parseInt(process.env.BROWSER_MAX_RETRIES || '2'),
        headless: process.env.BROWSER_HEADLESS !== 'false',
      },
      crawl4ai: {
        serviceUrl: process.env.CRAWL4AI_SERVICE_URL || 'http://localhost:8001',
        enabled: process.env.CRAWL4AI_ENABLED !== 'false',
        timeout: parseInt(process.env.CRAWL4AI_TIMEOUT || '30000'),
        maxRetries: parseInt(process.env.CRAWL4AI_MAX_RETRIES || '3'),
        features: {
          screenshots: process.env.CRAWL4AI_ENABLE_SCREENSHOTS === 'true',
          media: process.env.CRAWL4AI_ENABLE_MEDIA === 'true',
          links: process.env.CRAWL4AI_ENABLE_LINKS === 'true',
        },
        defaultScreenshotMode: (process.env.CRAWL4AI_SCREENSHOT_MODE as 'viewport' | 'full') || 'viewport',
      },
    },
    storage: {
      screenshotPath: process.env.SCREENSHOT_STORAGE_PATH || './public/screenshots',
      maxScreenshotSize: parseInt(process.env.SCREENSHOT_MAX_SIZE_MB || '5') * 1024 * 1024,
      screenshotRetentionDays: parseInt(process.env.SCREENSHOT_RETENTION_DAYS || '0'),
    },
    monitoring: {
      enabled: process.env.MONITORING_ENABLED !== 'false',
      exportInterval: parseInt(process.env.METRICS_EXPORT_INTERVAL || '60000'),
      detailedLogging: process.env.DETAILED_LOGGING === 'true',
    },
  };
}

/**
 * Validate configuration
 */
export function validateConfig(config: Config): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate fetcher config
  if (!['auto', 'http', 'browser', 'crawl4ai'].includes(config.fetcher.defaultFetcher)) {
    errors.push(`Invalid default fetcher: ${config.fetcher.defaultFetcher}`);
  }

  // Validate timeouts
  if (config.fetcher.http.timeout < 1000 || config.fetcher.http.timeout > 60000) {
    errors.push('HTTP timeout must be between 1000 and 60000ms');
  }

  // Validate Crawl4AI service URL
  try {
    new URL(config.fetcher.crawl4ai.serviceUrl);
  } catch {
    errors.push(`Invalid Crawl4AI service URL: ${config.fetcher.crawl4ai.serviceUrl}`);
  }

  // Validate storage config
  if (config.storage.maxScreenshotSize < 1024 * 100) { // Min 100KB
    errors.push('Max screenshot size must be at least 100KB');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Export singleton config instance
export const config = loadConfig();
```

### Metrics Collection

**File**: `src/monitoring/metrics.ts` (new)

```typescript
/**
 * Metrics collection for monitoring fetcher performance
 */

interface FetcherMetrics {
  total: number;
  success: number;
  failure: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorsByType: Map<string, number>;
}

class MetricsCollector {
  private metrics: Map<FetcherType, FetcherMetrics> = new Map();
  private responseTimes: Map<FetcherType, number[]> = new Map();

  /**
   * Record a fetch operation
   */
  recordFetch(
    fetcher: FetcherType,
    success: boolean,
    responseTimeMs: number,
    error?: Error
  ): void {
    const current = this.getMetrics(fetcher);

    current.total++;
    if (success) {
      current.success++;
    } else {
      current.failure++;
      if (error) {
        const errorType = error.constructor.name;
        current.errorsByType.set(
          errorType,
          (current.errorsByType.get(errorType) || 0) + 1
        );
      }
    }

    // Track response times
    const times = this.responseTimes.get(fetcher) || [];
    times.push(responseTimeMs);
    if (times.length > 1000) {
      times.shift(); // Keep last 1000 measurements
    }
    this.responseTimes.set(fetcher, times);

    // Update percentiles
    const sorted = [...times].sort((a, b) => a - b);
    current.avgResponseTime = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    current.p95ResponseTime = sorted[Math.floor(sorted.length * 0.95)];
    current.p99ResponseTime = sorted[Math.floor(sorted.length * 0.99)];

    this.metrics.set(fetcher, current);
  }

  /**
   * Get metrics for a specific fetcher
   */
  getMetrics(fetcher: FetcherType): FetcherMetrics {
    if (!this.metrics.has(fetcher)) {
      this.metrics.set(fetcher, {
        total: 0,
        success: 0,
        failure: 0,
        avgResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        errorsByType: new Map(),
      });
    }
    return this.metrics.get(fetcher)!;
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Record<FetcherType, FetcherMetrics> {
    const result: Partial<Record<FetcherType, FetcherMetrics>> = {};
    for (const [fetcher, metrics] of this.metrics.entries()) {
      result[fetcher] = {
        ...metrics,
        errorsByType: new Map(metrics.errorsByType), // Clone map
      };
    }
    return result as Record<FetcherType, FetcherMetrics>;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
    this.responseTimes.clear();
  }

  /**
   * Export metrics for external systems (Prometheus, etc.)
   */
  export(): string {
    let output = '';

    for (const [fetcher, metrics] of this.metrics.entries()) {
      output += `# Fetcher: ${fetcher}\n`;
      output += `fetcher_total{fetcher="${fetcher}"} ${metrics.total}\n`;
      output += `fetcher_success{fetcher="${fetcher}"} ${metrics.success}\n`;
      output += `fetcher_failure{fetcher="${fetcher}"} ${metrics.failure}\n`;
      output += `fetcher_response_time_avg{fetcher="${fetcher}"} ${metrics.avgResponseTime}\n`;
      output += `fetcher_response_time_p95{fetcher="${fetcher}"} ${metrics.p95ResponseTime}\n`;
      output += `fetcher_response_time_p99{fetcher="${fetcher}"} ${metrics.p99ResponseTime}\n`;

      for (const [errorType, count] of metrics.errorsByType.entries()) {
        output += `fetcher_errors{fetcher="${fetcher}",type="${errorType}"} ${count}\n`;
      }
    }

    return output;
  }
}

export const metricsCollector = new MetricsCollector();
```

### Enhanced AutoDetectFetcher with Metrics

**File**: `src/scraper/fetcher/AutoDetectFetcher.ts` (update)

```typescript
import { metricsCollector } from '../../monitoring/metrics';

export class AutoDetectFetcher implements ContentFetcher {
  async fetch(source: string, options?: FetchOptions): Promise<RawContent> {
    const fetcherType = this.determineFetcherType(source, options);
    const startTime = Date.now();

    try {
      const result = await this.fetchWithType(fetcherType, source, options);
      const responseTime = Date.now() - startTime;

      // Record successful fetch
      metricsCollector.recordFetch(fetcherType, true, responseTime);

      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;

      // Record failed fetch
      metricsCollector.recordFetch(
        fetcherType,
        false,
        responseTime,
        error as Error
      );

      throw error;
    }
  }

  // ... rest of implementation
}
```

### Monitoring Dashboard Component

**File**: `src/web/components/Monitoring/MonitoringDashboard.tsx` (new)

```tsx
export function MonitoringDashboard() {
  const [metrics, setMetrics] = useState<Record<string, FetcherMetrics>>({});

  useEffect(() => {
    const fetchMetrics = async () => {
      const response = await fetch('/api/metrics');
      const data = await response.json();
      setMetrics(data);
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000); // Update every 10s

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="monitoring-dashboard">
      <h2 className="text-2xl font-bold mb-6">Monitoring Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Object.entries(metrics).map(([fetcher, data]) => (
          <MetricsCard key={fetcher} fetcher={fetcher} metrics={data} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SuccessRateChart metrics={metrics} />
        <ResponseTimeChart metrics={metrics} />
        <ErrorBreakdownChart metrics={metrics} />
        <UsageDistributionChart metrics={metrics} />
      </div>
    </div>
  );
}

function MetricsCard({ fetcher, metrics }: { fetcher: string; metrics: FetcherMetrics }) {
  const successRate = metrics.total > 0
    ? ((metrics.success / metrics.total) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="card">
      <h3 className="font-bold text-lg mb-2 capitalize">{fetcher} Fetcher</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Total:</span>
          <span className="font-bold">{metrics.total}</span>
        </div>
        <div className="flex justify-between">
          <span>Success Rate:</span>
          <span className={`font-bold ${parseFloat(successRate) > 90 ? 'text-green-500' : 'text-yellow-500'}`}>
            {successRate}%
          </span>
        </div>
        <div className="flex justify-between">
          <span>Avg Time:</span>
          <span className="font-bold">{metrics.avgResponseTime.toFixed(0)}ms</span>
        </div>
        <div className="flex justify-between">
          <span>P95 Time:</span>
          <span className="font-bold">{metrics.p95ResponseTime.toFixed(0)}ms</span>
        </div>
      </div>
    </div>
  );
}
```

## Implementation Tasks

### Task 1: Centralized Configuration (3 hours)
**File**: `src/utils/config.ts`

- [ ] Define all configuration interfaces
- [ ] Implement `loadConfig()` function
- [ ] Implement `validateConfig()` function
- [ ] Add environment variable documentation
- [ ] Write configuration tests

### Task 2: Metrics Collection (4 hours)
**Files**: `src/monitoring/metrics.ts`, `src/scraper/fetcher/AutoDetectFetcher.ts`

- [ ] Implement MetricsCollector class
- [ ] Add percentile calculations
- [ ] Add error categorization
- [ ] Integrate into AutoDetectFetcher
- [ ] Add metrics export endpoint
- [ ] Write metrics tests

### Task 3: Monitoring Dashboard (5 hours)
**Files**: `src/web/components/Monitoring/`

- [ ] Create MonitoringDashboard component
- [ ] Create MetricsCard component
- [ ] Create SuccessRateChart component
- [ ] Create ResponseTimeChart component
- [ ] Create ErrorBreakdownChart component
- [ ] Add real-time updates
- [ ] Style dashboard

### Task 4: API Endpoints (2 hours)
**File**: `src/web/web.ts`

```typescript
// Metrics endpoint
app.get('/api/metrics', async (request, reply) => {
  const metrics = metricsCollector.getAllMetrics();

  // Convert Maps to objects for JSON serialization
  const serialized: Record<string, any> = {};
  for (const [fetcher, data] of Object.entries(metrics)) {
    serialized[fetcher] = {
      ...data,
      errorsByType: Object.fromEntries(data.errorsByType),
    };
  }

  reply.send(serialized);
});

// Prometheus metrics export
app.get('/metrics', async (request, reply) => {
  const prometheusMetrics = metricsCollector.export();
  reply.type('text/plain').send(prometheusMetrics);
});

// Configuration endpoint (read-only)
app.get('/api/config', async (request, reply) => {
  const { valid, errors } = validateConfig(config);
  reply.send({
    config: {
      ...config,
      // Redact sensitive values
      fetcher: {
        ...config.fetcher,
        crawl4ai: {
          ...config.fetcher.crawl4ai,
          serviceUrl: config.fetcher.crawl4ai.serviceUrl, // Keep URL visible
        },
      },
    },
    valid,
    errors,
  });
});
```

- [ ] Add `/api/metrics` endpoint
- [ ] Add `/metrics` Prometheus endpoint
- [ ] Add `/api/config` endpoint
- [ ] Add request validation
- [ ] Add error handling

### Task 5: Documentation (4 hours)

- [ ] Document all environment variables
- [ ] Create configuration guide
- [ ] Create monitoring guide
- [ ] Create troubleshooting guide
- [ ] Add operational runbook
- [ ] Update main README

## Environment Variables Reference

```bash
# ============================================
# Fetcher Configuration
# ============================================

# Default fetcher type (auto, http, browser, crawl4ai)
DEFAULT_FETCHER=auto

# HTTP Fetcher
HTTP_TIMEOUT=10000
HTTP_MAX_RETRIES=3
HTTP_FOLLOW_REDIRECTS=true

# Browser Fetcher
BROWSER_TIMEOUT=30000
BROWSER_MAX_RETRIES=2
BROWSER_HEADLESS=true

# ============================================
# Crawl4AI Configuration
# ============================================

# Service connection
CRAWL4AI_SERVICE_URL=http://localhost:8001
CRAWL4AI_ENABLED=true
CRAWL4AI_TIMEOUT=30000
CRAWL4AI_MAX_RETRIES=3

# Enhanced features
CRAWL4AI_ENABLE_SCREENSHOTS=false
CRAWL4AI_ENABLE_MEDIA=false
CRAWL4AI_ENABLE_LINKS=false
CRAWL4AI_SCREENSHOT_MODE=viewport

# ============================================
# Storage Configuration
# ============================================

SCREENSHOT_STORAGE_PATH=./public/screenshots
SCREENSHOT_MAX_SIZE_MB=5
SCREENSHOT_RETENTION_DAYS=0  # 0 = keep forever

# ============================================
# Monitoring Configuration
# ============================================

MONITORING_ENABLED=true
METRICS_EXPORT_INTERVAL=60000  # Export metrics every 60s
DETAILED_LOGGING=false
```

## Testing Strategy

### Configuration Tests
```typescript
describe('Configuration', () => {
  it('should load config from environment', () => {
    process.env.DEFAULT_FETCHER = 'crawl4ai';
    const config = loadConfig();
    expect(config.fetcher.defaultFetcher).toBe('crawl4ai');
  });

  it('should validate valid config', () => {
    const { valid, errors } = validateConfig(config);
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
  });

  it('should reject invalid fetcher type', () => {
    const invalidConfig = { ...config, fetcher: { ...config.fetcher, defaultFetcher: 'invalid' as FetcherType } };
    const { valid, errors } = validateConfig(invalidConfig);
    expect(valid).toBe(false);
    expect(errors).toContain('Invalid default fetcher: invalid');
  });
});
```

### Metrics Tests
```typescript
describe('MetricsCollector', () => {
  it('should record successful fetch', () => {
    metricsCollector.reset();
    metricsCollector.recordFetch('http', true, 150);

    const metrics = metricsCollector.getMetrics('http');
    expect(metrics.total).toBe(1);
    expect(metrics.success).toBe(1);
    expect(metrics.avgResponseTime).toBe(150);
  });

  it('should calculate percentiles', () => {
    metricsCollector.reset();
    for (let i = 0; i < 100; i++) {
      metricsCollector.recordFetch('http', true, i * 10);
    }

    const metrics = metricsCollector.getMetrics('http');
    expect(metrics.p95ResponseTime).toBeGreaterThan(900);
    expect(metrics.p99ResponseTime).toBeGreaterThan(980);
  });
});
```

## Deployment Considerations

### Production Checklist
- [ ] All environment variables documented
- [ ] Configuration validated on startup
- [ ] Metrics collection enabled
- [ ] Monitoring dashboard accessible
- [ ] Error handling comprehensive
- [ ] Logs structured and searchable
- [ ] Alerts configured (if external monitoring)

### Security
- Don't expose sensitive configuration in public endpoints
- Validate all input
- Rate limit metrics endpoints
- Secure Prometheus metrics endpoint

### Performance
- Metrics collection adds <5ms overhead
- Aggregate metrics in background
- Don't block on metrics recording
- Limit stored time series data (keep last 1000)

## Success Metrics

- [ ] Configuration loading correctly
- [ ] All env vars documented
- [ ] Metrics collecting accurately
- [ ] Monitoring dashboard rendering
- [ ] Charts updating in real-time
- [ ] API endpoints responding <100ms
- [ ] Documentation complete
- [ ] All tests passing

## Dependencies

**Depends On**:
- Phase 2 (Fetcher Selection) - Complete
- Phase 3 (Enhanced Features) - Complete
- Phase 4 (WebUI) - Complete

**Blocks**: None (final phase)

## Timeline

- **Task 1** (Configuration): Day 1 (3 hours)
- **Task 2** (Metrics): Days 1-2 (4 hours)
- **Task 3** (Dashboard): Days 2-3 (5 hours)
- **Task 4** (API): Day 3 (2 hours)
- **Task 5** (Documentation): Day 3-4 (4 hours)
- **Total**: 3-4 days (12-16 hours)

*Last Updated: 2025-11-08*
