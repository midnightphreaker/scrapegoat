/**
 * Performance Metrics Collector
 *
 * Tracks performance metrics across all operation categories including
 * database queries, embedding generation, search operations, and document processing.
 * Provides Prometheus-compatible export format and configurable slow operation logging.
 */

import { appConfig } from "../utils/config";
import { logger } from "../utils/logger";
import type {
  OperationCategory,
  OperationContext,
  OperationMetrics,
  PerformanceThresholds,
} from "./types";

/**
 * Default thresholds for slow operation logging (in milliseconds)
 */
const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  database: 1000, // 1 second
  embedding: 5000, // 5 seconds
  search: 2000, // 2 seconds
  processing: 10000, // 10 seconds
  fetcher: 30000, // 30 seconds
};

/**
 * Configuration for performance metrics collector
 */
export interface PerformanceMetricsConfig {
  /** Maximum number of timing samples to keep per operation */
  maxSamples?: number;
  /** Thresholds for logging slow operations */
  thresholds?: Partial<PerformanceThresholds>;
  /** Enable detailed logging of all operations */
  detailedLogging?: boolean;
  /** Enable logging of slow operations only */
  slowOpLogging?: boolean;
}

/**
 * Performance metrics collector for tracking all operation types
 *
 * Maintains separate metrics for each category:operation combination
 * and provides aggregation, percentile calculation, and export capabilities.
 */
export class PerformanceMetrics {
  private metrics: Map<string, OperationMetrics> = new Map();
  private responseTimes: Map<string, number[]> = new Map();
  private readonly maxSamples: number;
  private readonly thresholds: PerformanceThresholds;
  private readonly detailedLogging: boolean;
  private readonly slowOpLogging: boolean;

  constructor(config: PerformanceMetricsConfig = {}) {
    // Use thresholds from app config if available, otherwise use defaults
    const configuredThresholds = appConfig?.monitoring?.performance
      ? {
          database: appConfig.monitoring.performance.database,
          embedding: appConfig.monitoring.performance.embedding,
          search: appConfig.monitoring.performance.search,
          processing: appConfig.monitoring.performance.processing,
          fetcher: appConfig.monitoring.performance.fetcher,
        }
      : undefined;

    this.maxSamples = config.maxSamples ?? appConfig?.monitoring?.maxSamples ?? 1000;
    this.thresholds = {
      ...DEFAULT_THRESHOLDS,
      ...configuredThresholds,
      ...config.thresholds,
    };
    this.detailedLogging =
      config.detailedLogging ?? appConfig?.monitoring?.detailedLogging ?? false;
    this.slowOpLogging = config.slowOpLogging !== false; // default true
  }

  /**
   * Record an operation execution
   *
   * @param category Operation category
   * @param operation Specific operation name
   * @param success Whether the operation succeeded
   * @param durationMs Execution time in milliseconds
   * @param error Error object if operation failed
   * @param context Additional context information
   */
  record(
    category: OperationCategory,
    operation: string,
    success: boolean,
    durationMs: number,
    error?: Error,
    context?: OperationContext,
  ): void {
    const key = this.makeKey(category, operation);
    const metrics = this.getMetrics(key);

    // Update counts
    metrics.total++;
    if (success) {
      metrics.success++;
    } else {
      metrics.failure++;
      if (error) {
        const errorType = error.constructor.name;
        metrics.errorsByType.set(
          errorType,
          (metrics.errorsByType.get(errorType) || 0) + 1,
        );
      }
    }

    // Track response times
    const times = this.responseTimes.get(key) || [];
    times.push(durationMs);

    // Limit stored samples
    if (times.length > this.maxSamples) {
      times.shift();
    }
    this.responseTimes.set(key, times);

    // Update statistics
    this.updateStatistics(key, times);
    metrics.lastExecuted = new Date();

    // Check thresholds and log if slow
    this.checkSlowOperation(category, operation, durationMs, context);

    // Detailed logging if enabled
    if (this.detailedLogging) {
      const contextStr = context ? ` ${JSON.stringify(context)}` : "";
      logger.debug(
        `Performance: ${category}:${operation} ${success ? "success" : "failure"} ${durationMs}ms${contextStr}`,
      );
    }
  }

  /**
   * Update statistics (avg, p95, p99, min, max) for an operation
   */
  private updateStatistics(key: string, times: number[]): void {
    if (times.length === 0) return;

    const metrics = this.metrics.get(key);
    if (!metrics) return;

    const sorted = [...times].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    metrics.avgTime = sum / sorted.length;
    metrics.p95Time = this.calculatePercentile(sorted, 0.95);
    metrics.p99Time = this.calculatePercentile(sorted, 0.99);
    if (sorted.length === 0) return;
    metrics.minTime = sorted[0] ?? 0;
    metrics.maxTime = sorted[sorted.length - 1] ?? 0;
  }

  /**
   * Calculate a specific percentile from sorted values
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.floor(sortedValues.length * percentile);
    const value = sortedValues[Math.min(index, sortedValues.length - 1)];
    return value ?? 0;
  }

  /**
   * Check if operation exceeded threshold and log if slow
   */
  private checkSlowOperation(
    category: OperationCategory,
    operation: string,
    durationMs: number,
    context?: OperationContext,
  ): void {
    if (!this.slowOpLogging) return;

    const threshold = this.thresholds[category];
    if (durationMs > threshold) {
      const contextStr = context ? ` ${JSON.stringify(context)}` : "";
      logger.warn(
        `Slow operation: ${category}:${operation} took ${durationMs}ms (threshold: ${threshold}ms)${contextStr}`,
      );
    }
  }

  /**
   * Get metrics for a specific operation
   */
  private getMetrics(key: string): OperationMetrics {
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        total: 0,
        success: 0,
        failure: 0,
        avgTime: 0,
        p95Time: 0,
        p99Time: 0,
        minTime: 0,
        maxTime: 0,
        errorsByType: new Map(),
      });
    }
    return this.metrics.get(key)!;
  }

  /**
   * Get metrics for a specific category and operation
   */
  getOperationMetrics(
    category: OperationCategory,
    operation: string,
  ): OperationMetrics | undefined {
    const key = this.makeKey(category, operation);
    const metrics = this.metrics.get(key);
    if (!metrics) return undefined;

    // Return a copy with cloned map
    return {
      ...metrics,
      errorsByType: new Map(metrics.errorsByType),
    };
  }

  /**
   * Get all metrics for a category
   */
  getCategoryMetrics(category: OperationCategory): Record<string, OperationMetrics> {
    const result: Record<string, OperationMetrics> = {};
    const prefix = `${category}:`;

    for (const [key, metrics] of this.metrics.entries()) {
      if (key.startsWith(prefix)) {
        const operation = key.substring(prefix.length);
        result[operation] = {
          ...metrics,
          errorsByType: new Map(metrics.errorsByType),
        };
      }
    }

    return result;
  }

  /**
   * Get summary for all operations in a category
   */
  getCategorySummary(category: OperationCategory): {
    totalOperations: number;
    totalSuccess: number;
    totalFailure: number;
    overallSuccessRate: number;
    avgTime: number;
  } {
    const categoryMetrics = this.getCategoryMetrics(category);
    let totalOps = 0;
    let totalSuccess = 0;
    let totalFailure = 0;
    let totalTime = 0;
    let count = 0;

    for (const metrics of Object.values(categoryMetrics)) {
      totalOps += metrics.total;
      totalSuccess += metrics.success;
      totalFailure += metrics.failure;
      if (metrics.total > 0) {
        totalTime += metrics.avgTime * metrics.total;
        count += metrics.total;
      }
    }

    return {
      totalOperations: totalOps,
      totalSuccess,
      totalFailure,
      overallSuccessRate: totalOps > 0 ? (totalSuccess / totalOps) * 100 : 0,
      avgTime: count > 0 ? totalTime / count : 0,
    };
  }

  /**
   * Get all metrics across all categories
   */
  getAllMetrics(): Record<string, Record<string, OperationMetrics>> {
    const result: Record<string, Record<string, OperationMetrics>> = {};

    for (const [key, metrics] of this.metrics.entries()) {
      const parts = key.split(":");
      const category = parts[0] ?? "unknown";
      const operation = parts[1] ?? "unknown";
      if (!result[category]) {
        result[category] = {};
      }
      result[category][operation] = {
        ...metrics,
        errorsByType: new Map(metrics.errorsByType),
      };
    }

    return result;
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheus(): string {
    let output = "# Scrapegoat Performance Metrics\n";
    output += "# HELP scrapegoat_operation_total Total number of operations\n";
    output += "# TYPE scrapegoat_operation_total counter\n";

    for (const [key, metrics] of this.metrics.entries()) {
      const [category, operation] = key.split(":");
      output += `scrapegoat_operation_total{category="${category}",operation="${operation}"} ${metrics.total}\n`;
    }

    output += "\n# HELP scrapegoat_operation_success Number of successful operations\n";
    output += "# TYPE scrapegoat_operation_success counter\n";
    for (const [key, metrics] of this.metrics.entries()) {
      const [category, operation] = key.split(":");
      output += `scrapegoat_operation_success{category="${category}",operation="${operation}"} ${metrics.success}\n`;
    }

    output += "\n# HELP scrapegoat_operation_failure Number of failed operations\n";
    output += "# TYPE scrapegoat_operation_failure counter\n";
    for (const [key, metrics] of this.metrics.entries()) {
      const [category, operation] = key.split(":");
      output += `scrapegoat_operation_failure{category="${category}",operation="${operation}"} ${metrics.failure}\n`;
    }

    output +=
      "\n# HELP scrapegoat_operation_duration_ms Average operation duration in milliseconds\n";
    output += "# TYPE scrapegoat_operation_duration_ms gauge\n";
    for (const [key, metrics] of this.metrics.entries()) {
      const [category, operation] = key.split(":");
      output += `scrapegoat_operation_duration_ms{category="${category}",operation="${operation}",quantile="avg"} ${metrics.avgTime.toFixed(2)}\n`;
    }

    output +=
      "\n# HELP scrapegoat_operation_duration_p95 95th percentile operation duration in milliseconds\n";
    output += "# TYPE scrapegoat_operation_duration_p95 gauge\n";
    for (const [key, metrics] of this.metrics.entries()) {
      const [category, operation] = key.split(":");
      output += `scrapegoat_operation_duration_p95{category="${category}",operation="${operation}"} ${metrics.p95Time.toFixed(2)}\n`;
    }

    output +=
      "\n# HELP scrapegoat_operation_duration_p99 99th percentile operation duration in milliseconds\n";
    output += "# TYPE scrapegoat_operation_duration_p99 gauge\n";
    for (const [key, metrics] of this.metrics.entries()) {
      const [category, operation] = key.split(":");
      output += `scrapegoat_operation_duration_p99{category="${category}",operation="${operation}"} ${metrics.p99Time.toFixed(2)}\n`;
    }

    output += "\n# HELP scrapegoat_operation_errors Errors by type\n";
    output += "# TYPE scrapegoat_operation_errors counter\n";
    for (const [key, metrics] of this.metrics.entries()) {
      const [category, operation] = key.split(":");
      for (const [errorType, count] of metrics.errorsByType.entries()) {
        output += `scrapegoat_operation_errors{category="${category}",operation="${operation}",type="${errorType}"} ${count}\n`;
      }
    }

    return output;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
    this.responseTimes.clear();
    logger.debug("Performance metrics reset");
  }

  /**
   * Create a unique key for category:operation
   */
  private makeKey(category: OperationCategory, operation: string): string {
    return `${category}:${operation}`;
  }
}

/**
 * Singleton performance metrics instance
 */
export const performanceMetrics = new PerformanceMetrics();
