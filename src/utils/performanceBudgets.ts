/**
 * Performance budget system
 * Defines and enforces limits for bundle size, API response times, and memory usage
 */

/**
 * Performance budget configuration
 */
export interface PerformanceBudget {
  /** Maximum JavaScript bundle size in bytes */
  maxJsSize: number;
  /** Maximum CSS bundle size in bytes */
  maxCssSize: number;
  /** Maximum total page weight in bytes */
  maxTotalSize: number;
  /** Maximum API response time in milliseconds */
  maxApiTime: number;
  /** Maximum memory usage in MB */
  maxMemoryMB: number;
  /** Maximum First Contentful Paint in ms */
  maxFCP: number;
  /** Maximum Largest Contentful Paint in ms */
  maxLCP: number;
  /** Maximum Cumulative Layout Shift score */
  maxCLS: number;
  /** Maximum First Input Delay in ms */
  maxFID: number;
  /** Maximum Time to Interactive in ms */
  maxTTI: number;
}

/**
 * Performance budget breach details
 */
export interface BudgetBreach {
  /** The budget that was breached */
  budget: keyof PerformanceBudget;
  /** The actual value */
  actual: number;
  /** The budget limit */
  limit: number;
  /** Severity of the breach */
  severity: "warning" | "error" | "critical";
  /** Timestamp of the breach */
  timestamp: Date;
}

/**
 * Performance measurement result
 */
export interface PerformanceMeasurement {
  /** JavaScript bundle size in bytes */
  jsSize?: number;
  /** CSS bundle size in bytes */
  cssSize?: number;
  /** Total page weight in bytes */
  totalSize?: number;
  /** API response time in ms */
  apiTime?: number;
  /** Memory usage in MB */
  memoryMB?: number;
  /** Web Vitals metrics */
  fcp?: number;
  lcp?: number;
  cls?: number;
  fid?: number;
  tti?: number;
}

/**
 * Default performance budgets
 */
export const DEFAULT_BUDGETS: PerformanceBudget = {
  maxJsSize: 250 * 1024, // 250KB - Recommended by Google
  maxCssSize: 50 * 1024, // 50KB
  maxTotalSize: 1000 * 1024, // 1MB - Reasonable for single page apps
  maxApiTime: 1000, // 1 second - Users notice delays > 1s
  maxMemoryMB: 100, // 100MB - Conservative limit for web apps
  maxFCP: 1800, // 1.8s - "Good" threshold
  maxLCP: 2500, // 2.5s - "Good" threshold
  maxCLS: 0.1, // "Good" threshold
  maxFID: 100, // 100ms - "Good" threshold
  maxTTI: 3800, // 3.8s - "Good" threshold
};

/**
 * Strict performance budgets for high-performance targets
 */
export const STRICT_BUDGETS: PerformanceBudget = {
  maxJsSize: 150 * 1024, // 150KB
  maxCssSize: 30 * 1024, // 30KB
  maxTotalSize: 500 * 1024, // 500KB
  maxApiTime: 500, // 500ms
  maxMemoryMB: 50, // 50MB
  maxFCP: 1000, // 1s
  maxLCP: 1500, // 1.5s
  maxCLS: 0.05,
  maxFID: 50, // 50ms
  maxTTI: 2000, // 2s
};

/**
 * Lenient performance budgets for development
 */
export const DEVELOPMENT_BUDGETS: PerformanceBudget = {
  maxJsSize: 500 * 1024, // 500KB
  maxCssSize: 100 * 1024, // 100KB
  maxTotalSize: 2000 * 1024, // 2MB
  maxApiTime: 2000, // 2s
  maxMemoryMB: 200, // 200MB
  maxFCP: 3000, // 3s
  maxLCP: 4000, // 4s
  maxCLS: 0.25,
  maxFID: 200, // 200ms
  maxTTI: 5000, // 5s
};

/**
 * Performance budget checker
 */
export class PerformanceBudgetChecker {
  private budgets: PerformanceBudget;
  private breaches: BudgetBreach[] = [];
  private onBreachCallback?: (breach: BudgetBreach) => void;

  constructor(budgets: PerformanceBudget = DEFAULT_BUDGETS) {
    this.budgets = budgets;
  }

  /**
   * Set the budgets to use
   */
  setBudgets(budgets: PerformanceBudget): void {
    this.budgets = budgets;
  }

  /**
   * Set callback for budget breaches
   */
  onBreach(callback: (breach: BudgetBreach) => void): void {
    this.onBreachCallback = callback;
  }

  /**
   * Check a measurement against budgets
   */
  check(measurement: PerformanceMeasurement): BudgetBreach[] {
    const newBreaches: BudgetBreach[] = [];

    const checkValue = (key: keyof PerformanceBudget, actual: number | undefined) => {
      if (actual === undefined) return;

      const limit = this.budgets[key];
      if (actual > limit) {
        const breach: BudgetBreach = {
          budget: key,
          actual,
          limit,
          severity: this.getSeverity(actual, limit),
          timestamp: new Date(),
        };
        newBreaches.push(breach);
        this.breaches.push(breach);

        if (this.onBreachCallback) {
          this.onBreachCallback(breach);
        }
      }
    };

    checkValue("maxJsSize", measurement.jsSize);
    checkValue("maxCssSize", measurement.cssSize);
    checkValue("maxTotalSize", measurement.totalSize);
    checkValue("maxApiTime", measurement.apiTime);
    checkValue("maxMemoryMB", measurement.memoryMB);
    checkValue("maxFCP", measurement.fcp);
    checkValue("maxLCP", measurement.lcp);
    checkValue("maxCLS", measurement.cls);
    checkValue("maxFID", measurement.fid);
    checkValue("maxTTI", measurement.tti);

    return newBreaches;
  }

  /**
   * Get all breaches
   */
  getBreaches(): BudgetBreach[] {
    return [...this.breaches];
  }

  /**
   * Clear all breaches
   */
  clearBreaches(): void {
    this.breaches = [];
  }

  /**
   * Get severity level for a breach
   */
  private getSeverity(actual: number, limit: number): BudgetBreach["severity"] {
    const ratio = actual / limit;

    if (ratio > 2) return "critical";
    if (ratio > 1.5) return "error";
    return "warning";
  }

  /**
   * Get a summary report of breaches
   */
  getReport(): string {
    if (this.breaches.length === 0) {
      return "✅ All performance budgets within limits";
    }

    const lines = ["⚠️ Performance Budget Breaches:\n"];

    for (const breach of this.breaches) {
      const icon =
        breach.severity === "critical" ? "🔴" : breach.severity === "error" ? "🟠" : "🟡";
      lines.push(
        `${icon} ${breach.budget}: ${this.formatValue(breach.actual, breach.budget)} > ${this.formatValue(breach.limit, breach.budget)}`,
      );
    }

    return lines.join("\n");
  }

  /**
   * Format a value for display
   */
  private formatValue(value: number, budget: keyof PerformanceBudget): string {
    if (budget.includes("Size")) {
      return `${(value / 1024).toFixed(1)} KB`;
    }
    if (budget === "maxMemoryMB") {
      return `${value.toFixed(1)} MB`;
    }
    if (budget === "maxCLS") {
      return value.toFixed(3);
    }
    return `${value.toFixed(0)} ms`;
  }
}

/**
 * Measure current page performance
 */
export function measurePagePerformance(): PerformanceMeasurement {
  const measurement: PerformanceMeasurement = {};

  // Get navigation timing
  if (performance.getEntriesByType) {
    const navEntries = performance.getEntriesByType(
      "navigation",
    ) as PerformanceNavigationTiming[];
    if (navEntries.length > 0) {
      const nav = navEntries[0]!;
      measurement.fcp = nav.responseStart - nav.fetchStart;
      measurement.tti = nav.domInteractive - nav.fetchStart;
    }
  }

  // Get memory usage if available
  if ("memory" in performance && (performance as any).memory) {
    measurement.memoryMB = (performance as any).memory.usedJSHeapSize / (1024 * 1024);
  }

  // Get resource timing for bundle sizes
  if (performance.getEntriesByType) {
    const resources = performance.getEntriesByType(
      "resource",
    ) as PerformanceResourceTiming[];

    for (const resource of resources) {
      const url = resource.name.toLowerCase();

      if (url.endsWith(".js")) {
        measurement.jsSize = (measurement.jsSize || 0) + resource.transferSize;
      } else if (url.endsWith(".css")) {
        measurement.cssSize = (measurement.cssSize || 0) + resource.transferSize;
      }

      measurement.totalSize = (measurement.totalSize || 0) + resource.transferSize;
    }
  }

  return measurement;
}

/**
 * Measure API response time
 */
export function measureApiCall<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const start = performance.now();

  return fn().then((result) => {
    const duration = performance.now() - start;
    return [result, duration];
  });
}

/**
 * Check performance budgets in the browser
 */
export function checkPerformanceBudgets(
  budgets: PerformanceBudget = DEFAULT_BUDGETS,
): BudgetBreach[] {
  const checker = new PerformanceBudgetChecker(budgets);
  const measurement = measurePagePerformance();
  return checker.check(measurement);
}

/**
 * Get Web Vitals metrics
 * Requires web-vitals library or manual implementation
 */
export async function getWebVitals(): Promise<{
  fcp?: number;
  lcp?: number;
  cls?: number;
  fid?: number;
  ttfb?: number;
}> {
  const vitals: ReturnType<typeof getWebVitals> extends Promise<infer T> ? T : never = {};

  // Try to get values from PerformanceObserver
  if ("PerformanceObserver" in window) {
    try {
      // FCP
      const fcpEntries = performance.getEntriesByName("first-contentful-paint");
      if (fcpEntries.length > 0) {
        vitals.fcp = fcpEntries[0]!.startTime;
      }

      // LCP would need web-vitals library for accurate measurement
      // This is a simplified approximation
      const lcpEntries = performance.getEntriesByType("largest-contentful-paint");
      if (lcpEntries.length > 0) {
        vitals.lcp = lcpEntries[lcpEntries.length - 1]!.startTime;
      }

      // CLS would need web-vitals library
      // FID would need web-vitals library

      // TTFB
      const navEntries = performance.getEntriesByType("navigation");
      if (navEntries.length > 0) {
        const nav = navEntries[0] as PerformanceNavigationTiming;
        vitals.ttfb = nav.responseStart - nav.fetchStart;
      }
    } catch (e) {
      console.warn("Error getting web vitals:", e);
    }
  }

  return vitals;
}

/**
 * Create a performance budget assertion for testing
 */
export function assertBudget(
  measurement: PerformanceMeasurement,
  budgets: PerformanceBudget = DEFAULT_BUDGETS,
): void {
  const checker = new PerformanceBudgetChecker(budgets);
  const breaches = checker.check(measurement);

  if (breaches.length > 0) {
    throw new Error(checker.getReport());
  }
}

/**
 * Log performance budgets to console in development
 */
export function logPerformanceBudgets(
  budgets: PerformanceBudget = DEFAULT_BUDGETS,
): void {
  if (import.meta.env?.DEV !== true) return;

  const measurement = measurePagePerformance();
  const _checker = new PerformanceBudgetChecker(budgets);

  console.group("📊 Performance Budgets");

  const logMetric = (key: keyof PerformanceBudget, value: number | undefined) => {
    if (value === undefined) return;

    const limit = budgets[key];
    const status = value > limit ? "❌" : "✅";
    const percentage = ((value / limit) * 100).toFixed(0);

    console.log(`${status} ${key}: ${value.toFixed(0)} / ${limit} (${percentage}%)`);
  };

  logMetric("maxJsSize", measurement.jsSize);
  logMetric("maxCssSize", measurement.cssSize);
  logMetric("maxTotalSize", measurement.totalSize);
  logMetric("maxApiTime", measurement.apiTime);
  logMetric("maxMemoryMB", measurement.memoryMB);
  logMetric("maxFCP", measurement.fcp);
  logMetric("maxLCP", measurement.lcp);
  logMetric("maxCLS", measurement.cls);
  logMetric("maxFID", measurement.fid);
  logMetric("maxTTI", measurement.tti);

  console.groupEnd();
}

/**
 * Budget breach handler that sends metrics to monitoring
 */
export function createBreachHandler(
  handler: (breach: BudgetBreach) => void,
): (breach: BudgetBreach) => void {
  return (breach) => {
    console.warn(`⚠️ Performance budget breached:`, breach);

    // Send to monitoring service
    handler(breach);
  };
}
