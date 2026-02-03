/**
 * Performance monitoring decorator utilities
 *
 * Provides convenient wrapper functions for tracking performance
 * of async operations with minimal code changes.
 */

import { performanceMetrics } from "./PerformanceMetrics";
import type { OperationCategory, OperationContext } from "./types";

/**
 * Configuration for measurePerformance decorator
 */
export interface MeasurePerformanceConfig {
  /** Enable detailed logging for this operation */
  detailedLogging?: boolean;
  /** Custom context to include with metrics */
  context?: OperationContext;
  /** Success callback */
  onSuccess?: (durationMs: number) => void;
  /** Error callback */
  onError?: (error: Error, durationMs: number) => void;
}

/**
 * Measure performance of an async operation
 *
 * Automatically tracks timing, success/failure, and logs slow operations.
 * Wraps any async function to collect performance metrics.
 *
 * @param category - Operation category (database, embedding, search, processing, fetcher)
 * @param operation - Specific operation name (e.g., 'query', 'insert', 'text_embedding')
 * @param fn - Async function to measure
 * @param config - Optional configuration
 * @returns Result of the function
 *
 * @example
 * ```typescript
 * const results = await measurePerformance('database', 'query', async () => {
 *   return await pool.query('SELECT * FROM documents');
 * }, { context: { library: 'react' } });
 * ```
 */
export async function measurePerformance<T>(
  category: OperationCategory,
  operation: string,
  fn: () => Promise<T>,
  config?: MeasurePerformanceConfig,
): Promise<T> {
  const startTime = performance.now();
  const context = config?.context;

  try {
    const result = await fn();
    const durationMs = performance.now() - startTime;

    // Record successful operation
    performanceMetrics.record(category, operation, true, durationMs, undefined, context);

    // Call success callback if provided
    if (config?.onSuccess) {
      config.onSuccess(durationMs);
    }

    return result;
  } catch (error) {
    const durationMs = performance.now() - startTime;
    const errorObj = error instanceof Error ? error : new Error(String(error));

    // Record failed operation
    performanceMetrics.record(category, operation, false, durationMs, errorObj, context);

    // Call error callback if provided
    if (config?.onError) {
      config.onError(errorObj, durationMs);
    }

    // Re-throw the error
    throw error;
  }
}

/**
 * Create a performance-measured version of a function
 *
 * Returns a new function that automatically tracks performance.
 * Useful for creating measured versions of existing methods.
 *
 * @param category - Operation category
 * @param operation - Specific operation name
 * @param fn - Function to wrap
 * @param config - Optional configuration
 * @returns Wrapped function with performance tracking
 *
 * @example
 * ```typescript
 * const measuredQuery = createMeasured('database', 'query', pool.query.bind(pool));
 * const result = await measuredQuery('SELECT * FROM documents');
 * ```
 */
export function createMeasured<T extends (...args: any[]) => any>(
  category: OperationCategory,
  operation: string,
  fn: T,
  config?: MeasurePerformanceConfig,
): T {
  return (async (...args: any[]) => {
    return measurePerformance(category, operation, () => fn(...args), config);
  }) as T;
}

/**
 * Batch performance measurement for multiple operations
 *
 * Measures performance of an array of operations and returns
 * results with timing information.
 *
 * @param category - Operation category
 * @param operationPrefix - Prefix for operation names (will append index)
 * @param operations - Array of async functions to execute
 * @param config - Optional configuration
 * @returns Array of results with timing information
 *
 * @example
 * ```typescript
 * const operations = [
 *   async () => await query1(),
 *   async () => await query2(),
 *   async () => await query3(),
 * ];
 *
 * const results = await measureBatch('database', 'query_batch', operations);
 * console.log(`Query 1 took ${results[0].durationMs}ms`);
 * ```
 */
export async function measureBatch<T>(
  category: OperationCategory,
  operationPrefix: string,
  operations: Array<() => Promise<T>>,
  config?: MeasurePerformanceConfig,
): Promise<Array<{ result: T; durationMs: number; success: boolean }>> {
  const results = await Promise.allSettled(
    operations.map(async (op, index) => {
      const startTime = performance.now();
      try {
        const result = await op();
        const durationMs = performance.now() - startTime;
        performanceMetrics.record(
          category,
          `${operationPrefix}_${index}`,
          true,
          durationMs,
          undefined,
          config?.context,
        );
        return { result, durationMs, success: true };
      } catch (error) {
        const durationMs = performance.now() - startTime;
        const errorObj = error instanceof Error ? error : new Error(String(error));
        performanceMetrics.record(
          category,
          `${operationPrefix}_${index}`,
          false,
          durationMs,
          errorObj,
          config?.context,
        );
        throw { result: null as T, durationMs, success: false, error: errorObj };
      }
    }),
  );

  return results.map((r, _i) => {
    if (r.status === "fulfilled") {
      return r.value;
    } else {
      // Handle thrown error objects
      const errorResult = r.reason as {
        result: T;
        durationMs: number;
        success: boolean;
        error: Error;
      };
      if (errorResult && typeof errorResult === "object" && "durationMs" in errorResult) {
        return errorResult as { result: T; durationMs: number; success: boolean };
      }
      // Fallback for unexpected errors
      return { result: null as T, durationMs: 0, success: false };
    }
  });
}

/**
 * Performance context for database operations
 */
export interface DatabaseContext extends OperationContext {
  /** Library name if applicable */
  library?: string;
  /** Version if applicable */
  version?: string;
  /** Query type */
  queryType?: "SELECT" | "INSERT" | "UPDATE" | "DELETE";
  /** Number of rows affected */
  rowsAffected?: number;
}

/**
 * Performance context for embedding operations
 */
export interface EmbeddingContext extends OperationContext {
  /** Embedding model used */
  model?: string;
  /** Number of items in batch */
  batchSize?: number;
  /** Total characters processed */
  totalChars?: number;
  /** Embedding dimension */
  dimension?: number;
}

/**
 * Performance context for search operations
 */
export interface SearchContext extends OperationContext {
  /** Library being searched */
  library?: string;
  /** Version being searched */
  version?: string;
  /** Search query length */
  queryLength?: number;
  /** Number of results returned */
  resultCount?: number;
  /** Search type (vector, fulltext, hybrid) */
  searchType?: "vector" | "fulltext" | "hybrid";
}

/**
 * Performance context for document processing
 */
export interface ProcessingContext extends OperationContext {
  /** Content type */
  mimeType?: string;
  /** Document size in bytes */
  documentSize?: number;
  /** Number of chunks created */
  chunksCreated?: number;
  /** Pipeline used */
  pipeline?: string;
}
