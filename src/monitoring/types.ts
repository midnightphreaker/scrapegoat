/**
 * Performance monitoring types
 *
 * Defines interfaces for tracking performance metrics across different
 * operation categories including database queries, embedding generation,
 * search operations, and document processing.
 */

/**
 * Operation categories for performance tracking
 */
export type OperationCategory =
  | "database"
  | "embedding"
  | "search"
  | "processing"
  | "fetcher";

/**
 * Performance metrics for a specific operation
 */
export interface OperationMetrics {
  /** Total number of operations */
  total: number;
  /** Number of successful operations */
  success: number;
  /** Number of failed operations */
  failure: number;
  /** Average response time in milliseconds */
  avgTime: number;
  /** 95th percentile response time in milliseconds */
  p95Time: number;
  /** 99th percentile response time in milliseconds */
  p99Time: number;
  /** Min response time in milliseconds */
  minTime: number;
  /** Max response time in milliseconds */
  maxTime: number;
  /** Errors categorized by type */
  errorsByType: Map<string, number>;
  /** Last execution timestamp */
  lastExecuted?: Date;
}

/**
 * Summary metrics for a category
 */
export interface CategorySummary {
  category: OperationCategory;
  totalOperations: number;
  totalSuccess: number;
  totalFailure: number;
  overallSuccessRate: number;
  avgTime: number;
  operations: Record<string, OperationMetrics>;
}

/**
 * Performance thresholds for logging slow operations
 */
export interface PerformanceThresholds {
  /** Threshold in milliseconds for database operations */
  database: number;
  /** Threshold in milliseconds for embedding operations */
  embedding: number;
  /** Threshold in milliseconds for search operations */
  search: number;
  /** Threshold in milliseconds for document processing */
  processing: number;
  /** Threshold in milliseconds for fetcher operations */
  fetcher: number;
}

/**
 * Context information for performance tracking
 */
export interface OperationContext {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Performance record with context
 */
export interface PerformanceRecord {
  category: OperationCategory;
  operation: string;
  success: boolean;
  durationMs: number;
  timestamp: Date;
  error?: Error;
  context?: OperationContext;
}
