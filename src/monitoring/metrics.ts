/**
 * Metrics collection for monitoring fetcher performance
 *
 * @deprecated Use PerformanceMetrics for new code. This class is maintained for backward compatibility.
 * Tracks usage, success rates, response times, and errors for all fetcher types.
 * Provides Prometheus-compatible export format for integration with monitoring systems.
 *
 * @see PerformanceMetrics for more comprehensive performance tracking across all operation types.
 */

import type { FetcherType } from "../scraper/fetcher/types";
import { logger } from "../utils/logger";

/**
 * Metrics for a specific fetcher type
 */
export interface FetcherMetrics {
  /** Total number of fetch operations */
  total: number;
  /** Number of successful fetches */
  success: number;
  /** Number of failed fetches */
  failure: number;
  /** Average response time in milliseconds */
  avgResponseTime: number;
  /** 95th percentile response time in milliseconds */
  p95ResponseTime: number;
  /** 99th percentile response time in milliseconds */
  p99ResponseTime: number;
  /** Errors categorized by type */
  errorsByType: Map<string, number>;
}

/**
 * Metrics collector for tracking fetcher performance
 *
 * Maintains separate metrics for each fetcher type and provides
 * aggregation, percentile calculation, and export capabilities.
 */
class MetricsCollector {
  private metrics: Map<FetcherType, FetcherMetrics> = new Map();
  private responseTimes: Map<FetcherType, number[]> = new Map();
  private readonly maxSamples = 1000; // Keep last 1000 measurements per fetcher

  /**
   * Record a fetch operation
   *
   * @param fetcher Fetcher type used
   * @param success Whether the fetch succeeded
   * @param responseTimeMs Response time in milliseconds
   * @param error Error object if fetch failed
   */
  recordFetch(
    fetcher: FetcherType,
    success: boolean,
    responseTimeMs: number,
    error?: Error,
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
          (current.errorsByType.get(errorType) || 0) + 1,
        );
      }
    }

    // Track response times for percentile calculation
    const times = this.responseTimes.get(fetcher) || [];
    times.push(responseTimeMs);

    // Limit stored samples to prevent memory growth
    if (times.length > this.maxSamples) {
      times.shift();
    }
    this.responseTimes.set(fetcher, times);

    // Update percentiles
    this.updatePercentiles(fetcher, times);

    this.metrics.set(fetcher, current);

    // Log detailed metrics if enabled
    if (process.env.DETAILED_LOGGING === "true") {
      logger.debug(
        `Metrics recorded for ${fetcher}: ${success ? "success" : "failure"}, ${responseTimeMs}ms`,
      );
    }
  }

  /**
   * Update percentile calculations for a fetcher
   *
   * @param fetcher Fetcher type
   * @param times Array of response times
   */
  private updatePercentiles(fetcher: FetcherType, times: number[]): void {
    if (times.length === 0) return;

    const current = this.metrics.get(fetcher);
    if (!current) return;

    const sorted = [...times].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    current.avgResponseTime = sum / sorted.length;
    current.p95ResponseTime = this.calculatePercentile(sorted, 0.95);
    current.p99ResponseTime = this.calculatePercentile(sorted, 0.99);
  }

  /**
   * Calculate a specific percentile from sorted values
   *
   * @param sortedValues Sorted array of values
   * @param percentile Percentile to calculate (0.0 to 1.0)
   * @returns Calculated percentile value
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.floor(sortedValues.length * percentile);
    const value = sortedValues[Math.min(index, sortedValues.length - 1)];
    return value ?? 0;
  }

  /**
   * Get metrics for a specific fetcher
   *
   * Initializes empty metrics if none exist for the fetcher.
   *
   * @param fetcher Fetcher type
   * @returns Metrics object for the fetcher
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
    const metrics = this.metrics.get(fetcher);
    if (!metrics) {
      throw new Error(`Metrics not found for fetcher: ${fetcher}`);
    }
    return metrics;
  }

  /**
   * Get all metrics for all fetchers
   *
   * Returns a snapshot of current metrics with cloned maps
   * to prevent external modification.
   *
   * @returns Record of metrics by fetcher type
   */
  getAllMetrics(): Record<string, FetcherMetrics> {
    const result: Record<string, FetcherMetrics> = {};
    for (const [fetcher, metrics] of this.metrics.entries()) {
      result[fetcher] = {
        ...metrics,
        errorsByType: new Map(metrics.errorsByType), // Clone map
      };
    }
    return result;
  }

  /**
   * Reset all metrics
   *
   * Clears all collected metrics and response times.
   * Useful for testing or periodic resets.
   */
  reset(): void {
    this.metrics.clear();
    this.responseTimes.clear();
    logger.debug("Metrics reset");
  }

  /**
   * Export metrics in Prometheus format
   *
   * Generates text output compatible with Prometheus scraping.
   * Can be served at /metrics endpoint for monitoring integration.
   *
   * @returns Prometheus-formatted metrics text
   */
  export(): string {
    let output = "# HELP fetcher_total Total number of fetch operations\n";
    output += "# TYPE fetcher_total counter\n";

    for (const [fetcher, metrics] of this.metrics.entries()) {
      output += `fetcher_total{fetcher="${fetcher}"} ${metrics.total}\n`;
    }

    output += "\n# HELP fetcher_success Number of successful fetch operations\n";
    output += "# TYPE fetcher_success counter\n";
    for (const [fetcher, metrics] of this.metrics.entries()) {
      output += `fetcher_success{fetcher="${fetcher}"} ${metrics.success}\n`;
    }

    output += "\n# HELP fetcher_failure Number of failed fetch operations\n";
    output += "# TYPE fetcher_failure counter\n";
    for (const [fetcher, metrics] of this.metrics.entries()) {
      output += `fetcher_failure{fetcher="${fetcher}"} ${metrics.failure}\n`;
    }

    output +=
      "\n# HELP fetcher_response_time_avg Average response time in milliseconds\n";
    output += "# TYPE fetcher_response_time_avg gauge\n";
    for (const [fetcher, metrics] of this.metrics.entries()) {
      output += `fetcher_response_time_avg{fetcher="${fetcher}"} ${metrics.avgResponseTime.toFixed(2)}\n`;
    }

    output +=
      "\n# HELP fetcher_response_time_p95 95th percentile response time in milliseconds\n";
    output += "# TYPE fetcher_response_time_p95 gauge\n";
    for (const [fetcher, metrics] of this.metrics.entries()) {
      output += `fetcher_response_time_p95{fetcher="${fetcher}"} ${metrics.p95ResponseTime.toFixed(2)}\n`;
    }

    output +=
      "\n# HELP fetcher_response_time_p99 99th percentile response time in milliseconds\n";
    output += "# TYPE fetcher_response_time_p99 gauge\n";
    for (const [fetcher, metrics] of this.metrics.entries()) {
      output += `fetcher_response_time_p99{fetcher="${fetcher}"} ${metrics.p99ResponseTime.toFixed(2)}\n`;
    }

    output += "\n# HELP fetcher_errors Errors by type and fetcher\n";
    output += "# TYPE fetcher_errors counter\n";
    for (const [fetcher, metrics] of this.metrics.entries()) {
      for (const [errorType, count] of metrics.errorsByType.entries()) {
        output += `fetcher_errors{fetcher="${fetcher}",type="${errorType}"} ${count}\n`;
      }
    }

    return output;
  }

  /**
   * Get summary statistics across all fetchers
   *
   * @returns Summary object with aggregated metrics
   */
  getSummary(): {
    totalOperations: number;
    totalSuccess: number;
    totalFailure: number;
    overallSuccessRate: number;
  } {
    let totalOperations = 0;
    let totalSuccess = 0;
    let totalFailure = 0;

    for (const metrics of this.metrics.values()) {
      totalOperations += metrics.total;
      totalSuccess += metrics.success;
      totalFailure += metrics.failure;
    }

    const overallSuccessRate =
      totalOperations > 0 ? (totalSuccess / totalOperations) * 100 : 0;

    return {
      totalOperations,
      totalSuccess,
      totalFailure,
      overallSuccessRate,
    };
  }
}

/**
 * Singleton metrics collector instance
 *
 * Import and use this instance throughout the application
 * to record and retrieve metrics.
 */
export const metricsCollector = new MetricsCollector();
