import axios, { type AxiosError, type AxiosInstance } from "axios";
import { rateLimitConfig } from "../../../utils/config";
import { ScraperError } from "../../../utils/errors";
import { logger } from "../../../utils/logger";
import type {
  Crawl4AIClientOptions,
  Crawl4AIHealthResponse,
  Crawl4AIRequest,
  Crawl4AIResponse,
} from "./types";

/**
 * Circuit breaker states
 */
export enum CircuitState {
  Closed = "closed", // Normal operation
  Open = "open", // Circuit open, rejecting requests
  HalfOpen = "half-open", // Testing if service recovered
}

/**
 * Client for communicating with the Crawl4AI Python service.
 * Implements circuit breaker pattern for reliability and graceful degradation.
 */
export class Crawl4AIClient {
  private readonly client: AxiosInstance;
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly baseUrl: string;

  // Circuit breaker state
  private circuitState: CircuitState = CircuitState.Closed;
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;

  constructor(options: Crawl4AIClientOptions = {}) {
    this.baseUrl =
      options.baseUrl || process.env.CRAWL4AI_SERVICE_URL || "http://localhost:8001";
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelay = options.retryDelay ?? 1000;
    this.failureThreshold =
      options.circuitBreakerThreshold ??
      rateLimitConfig.network.crawl4ai.circuitBreakerThreshold;
    this.resetTimeout =
      options.circuitBreakerResetTimeout ??
      rateLimitConfig.network.crawl4ai.circuitBreakerResetTimeoutMs;

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: options.timeout || 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    logger.debug(
      `Crawl4AIClient initialized with baseUrl: ${this.baseUrl}, circuitBreakerThreshold: ${this.failureThreshold}, resetTimeout: ${this.resetTimeout}ms`,
    );
  }

  /**
   * Check if the Crawl4AI service is healthy and available
   */
  async health(signal?: AbortSignal): Promise<Crawl4AIHealthResponse | null> {
    try {
      const response = await this.client.get<Crawl4AIHealthResponse>("/health", {
        signal,
      });

      // Reset circuit breaker on successful health check
      this.recordSuccess();

      return response.data;
    } catch (error) {
      this.recordFailure();

      if (signal?.aborted) {
        logger.debug("Crawl4AI health check cancelled");
        return null;
      }

      logger.warn(`Crawl4AI health check failed: ${this.formatError(error)}`);
      return null;
    }
  }

  /**
   * Crawl a URL using the Crawl4AI service
   */
  async crawl(
    request: Crawl4AIRequest,
    options?: Crawl4AIClientOptions,
  ): Promise<Crawl4AIResponse> {
    // Check circuit breaker
    if (this.circuitState === CircuitState.Open) {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure < this.resetTimeout) {
        throw new ScraperError(
          `Crawl4AI service circuit breaker is open. Service appears to be unavailable. Try again in ${Math.ceil((this.resetTimeout - timeSinceLastFailure) / 1000)}s`,
          false,
        );
      } else {
        // Try to recover
        logger.debug("Circuit breaker transitioning to half-open state");
        this.circuitState = CircuitState.HalfOpen;
      }
    }

    const maxRetries = options?.maxRetries ?? this.maxRetries;
    const baseDelay = options?.retryDelay ?? this.retryDelay;
    const signal = options?.signal;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.post<Crawl4AIResponse>("/crawl", request, {
          signal,
        });

        // Success - reset circuit breaker
        this.recordSuccess();

        // Check if the response indicates an error from the service
        if (!response.data.success && response.data.error) {
          logger.warn(
            `Crawl4AI service returned error: ${response.data.error.code} - ${response.data.error.message}`,
          );
        }

        return response.data;
      } catch (error) {
        const axiosError = error as AxiosError;

        // Handle cancellation
        if (signal?.aborted || axiosError.code === "ERR_CANCELED") {
          logger.debug("Crawl4AI crawl request cancelled");
          throw new ScraperError("Crawl4AI crawl request cancelled", false);
        }

        // Record failure for circuit breaker
        this.recordFailure();

        // Retry logic
        if (attempt < maxRetries && this.isRetryable(axiosError)) {
          const delay = baseDelay * 2 ** attempt;
          logger.warn(
            `Crawl4AI attempt ${attempt + 1}/${maxRetries + 1} failed: ${this.formatError(error)}. Retrying in ${delay}ms...`,
          );
          await this.delay(delay);
          continue;
        }

        // Max retries reached or non-retryable error
        const errorMsg = this.formatError(error);
        logger.error(`Crawl4AI crawl failed after ${attempt + 1} attempts: ${errorMsg}`);

        throw new ScraperError(
          `Crawl4AI service request failed: ${errorMsg}`,
          false,
          error instanceof Error ? error : undefined,
        );
      }
    }

    // Should never reach here
    throw new ScraperError(
      `Crawl4AI crawl failed after ${maxRetries + 1} attempts`,
      false,
    );
  }

  /**
   * Check if the service is available
   */
  async isAvailable(): Promise<boolean> {
    const health = await this.health();
    return health !== null && health.status === "ok";
  }

  /**
   * Get current circuit breaker state (for monitoring/debugging)
   */
  getCircuitState(): {
    state: CircuitState;
    failureCount: number;
    lastFailureTime: number;
  } {
    return {
      state: this.circuitState,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  /**
   * Record a successful request - reset circuit breaker
   */
  private recordSuccess(): void {
    if (this.circuitState !== CircuitState.Closed) {
      logger.debug("Circuit breaker closing after successful request");
    }
    this.circuitState = CircuitState.Closed;
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }

  /**
   * Record a failed request - update circuit breaker state
   */
  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (
      this.failureCount >= this.failureThreshold &&
      this.circuitState === CircuitState.Closed
    ) {
      logger.warn(
        `Circuit breaker opening after ${this.failureCount} consecutive failures`,
      );
      this.circuitState = CircuitState.Open;
    } else if (this.circuitState === CircuitState.HalfOpen) {
      logger.warn("Circuit breaker reopening after failed recovery attempt");
      this.circuitState = CircuitState.Open;
    }
  }

  /**
   * Check if an error is retryable
   */
  private isRetryable(error: AxiosError): boolean {
    const status = error.response?.status;
    const code = error.code;

    // Retry on network errors
    if (!status && code) {
      const nonRetryableCodes = ["ENOTFOUND", "ECONNREFUSED"];
      return !nonRetryableCodes.includes(code);
    }

    // Retry on 5xx errors and 429 (rate limit)
    if (status) {
      return status >= 500 || status === 429;
    }

    return false;
  }

  /**
   * Format error for logging
   */
  private formatError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const code = error.code;
      const message = error.message;

      if (status) {
        return `HTTP ${status}: ${message}`;
      }
      if (code) {
        return `${code}: ${message}`;
      }
      return message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  /**
   * Delay helper for retries
   */
  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
