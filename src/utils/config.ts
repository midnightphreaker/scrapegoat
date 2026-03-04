/**
 * Default configuration values for the scraping pipeline and server
 */

import { logger } from "./logger.js";

/** Default PostgreSQL connection string (can be overridden via DATABASE_URL env var) */
export const DEFAULT_DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://localhost:5432/scrapegoat";

/** Maximum number of pages to scrape in a single job */
export const DEFAULT_MAX_PAGES = 1000;

/** Maximum navigation depth when crawling links */
export const DEFAULT_MAX_DEPTH = 3;

/** Maximum number of concurrent page requests */
export const DEFAULT_MAX_CONCURRENCY = 3;

/** Default protocol for the MCP server */
export const DEFAULT_PROTOCOL = "auto";

/** Default port for the HTTP protocol */
export const DEFAULT_HTTP_PORT = 8080;

/** Default port for the Web UI */
export const DEFAULT_WEB_PORT = 8080;

/** Default host for server binding */
export const DEFAULT_HOST = "127.0.0.1";

/**
 * Default timeout in milliseconds for page operations (e.g., Playwright waitForSelector).
 */
export const DEFAULT_PAGE_TIMEOUT = 5000;

/**
 * Maximum number of retries for HTTP fetcher requests.
 */
export const FETCHER_MAX_RETRIES = 6;

/**
 * Base delay in milliseconds for HTTP fetcher retry backoff.
 */
export const FETCHER_BASE_DELAY = 1000;

/**
 * Default chunk size settings for splitters
 */
export const SPLITTER_MIN_CHUNK_SIZE = 500;
export const SPLITTER_PREFERRED_CHUNK_SIZE = 1500;
export const SPLITTER_MAX_CHUNK_SIZE = 5000;

/**
 * Maximum number of documents to process in a single batch for embeddings.
 */
export const EMBEDDING_BATCH_SIZE = 100;

/**
 * Maximum total character size for a single embedding batch request.
 * This prevents "413 Request entity too large" errors from embedding APIs.
 * Default is 50000 (~50KB).
 */
export const EMBEDDING_BATCH_CHARS = 50000;

/**
 * Maximum number of retries for database migrations if busy.
 */
export const MIGRATION_MAX_RETRIES = 5;

/**
 * Delay in milliseconds between migration retry attempts.
 */
export const MIGRATION_RETRY_DELAY_MS = 300;

/**
 * Factor to overfetch vector and FTS candidates before applying Reciprocal Rank Fusion.
 * A factor of 2 means we fetch 2x the requested limit from each source before ranking.
 */
export const SEARCH_OVERFETCH_FACTOR = 2;

/**
 * Weight applied to vector search scores in hybrid search ranking.
 */
export const SEARCH_WEIGHT_VEC = 1.0;

/**
 * Weight applied to full-text search scores in hybrid search ranking.
 */
export const SEARCH_WEIGHT_FTS = 1.0;

/**
 * Multiplier to cast a wider net in vector search before final ranking.
 * Used to increase the number of vector search candidates retrieved.
 */
export const VECTOR_SEARCH_MULTIPLIER = 10;

/**
 * Vector dimension for embeddings storage in the database.
 * This must match the output dimension of your embedding model.
 * Set via VECTOR_DIMENSION environment variable.
 * Default: 1024 (matches common models like text-embedding-3-small with 1024 dimensions)
 */
export const VECTOR_DIMENSION = Number.parseInt(
  process.env.VECTOR_DIMENSION || "1024",
  10,
);

/**
 * Crawl4AI service base URL.
 * Set via CRAWL4AI_SERVICE_URL environment variable.
 */
export const CRAWL4AI_SERVICE_URL =
  process.env.CRAWL4AI_SERVICE_URL || "http://localhost:8001";

/**
 * Crawl4AI request timeout in milliseconds.
 * Set via CRAWL4AI_TIMEOUT environment variable.
 */
export const CRAWL4AI_TIMEOUT = Number.parseInt(
  process.env.CRAWL4AI_TIMEOUT || "30000",
  10,
);

/**
 * Crawl4AI maximum retry attempts.
 * Set via CRAWL4AI_MAX_RETRIES environment variable.
 */
export const CRAWL4AI_MAX_RETRIES = Number.parseInt(
  process.env.CRAWL4AI_MAX_RETRIES || "3",
  10,
);

// ============================================================================
// Reranker Configuration Constants
// ============================================================================

/** Minimum reranker timeout in milliseconds */
export const MIN_RERANK_TIMEOUT = 1000;

/** Maximum reranker timeout in milliseconds */
export const MAX_RERANK_TIMEOUT = 30000;

// ============================================================================
// Advanced Configuration System for Phases 4 & 5
// ============================================================================

import type { FetcherType } from "../scraper/fetcher/types";

/**
 * Crawl4AI service configuration
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
  defaultScreenshotMode: "viewport" | "full";
}

/**
 * HTTP fetcher configuration
 */
export interface HttpFetcherConfig {
  timeout: number;
  maxRetries: number;
  followRedirects: boolean;
}

/**
 * Browser fetcher configuration
 */
/**
 * Fetcher configuration
 */
export interface FetcherConfig {
  /** Default fetcher type */
  defaultFetcher: FetcherType;
  /** HTTP fetcher configuration */
  http: HttpFetcherConfig;
  /** Crawl4AI configuration */
  crawl4ai: Crawl4AIConfig;
}

/**
 * Storage configuration
 */
export interface StorageConfig {
  /** Screenshot storage path */
  screenshotPath: string;
  /** Maximum screenshot size in bytes */
  maxScreenshotSize: number;
  /** Screenshot retention days (0 = keep forever) */
  screenshotRetentionDays: number;
}

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  /** Enable metrics collection */
  enabled: boolean;
  /** Metrics export interval (ms) */
  exportInterval: number;
  /** Enable detailed logging */
  detailedLogging: boolean;
  /** Performance tracking thresholds (ms) */
  performance: {
    /** Database operation slow threshold */
    database: number;
    /** Embedding generation slow threshold */
    embedding: number;
    /** Search operation slow threshold */
    search: number;
    /** Document processing slow threshold */
    processing: number;
    /** Fetcher operation slow threshold */
    fetcher: number;
  };
  /** Maximum timing samples to keep per operation */
  maxSamples: number;
}

/**
 * Complete application configuration
 */
/**
 * Reranker service configuration
 */
export interface RerankerConfig {
  /** Whether reranking is enabled */
  enabled: boolean;
  /** Reranker API base URL */
  baseURL?: string;
  /** Reranker model name */
  model?: string;
  /** Request timeout in milliseconds */
  timeout: number;
}

export interface Config {
  fetcher: FetcherConfig;
  storage: StorageConfig;
  monitoring: MonitoringConfig;
  reranker: RerankerConfig;
}

/**
 * Configuration validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Load configuration from environment variables
 *
 * @returns Configuration object with values from environment or defaults
 */
/**
 * Validate reranker configuration
 *
 * @param config Reranker configuration to validate
 * @returns Array of error messages (empty if valid)
 */
function validateRerankerConfig(config: RerankerConfig): string[] {
  const errors: string[] = [];

  if (config.enabled) {
    if (!config.baseURL) {
      errors.push("RERANK_API_BASE is required when RERANK_ENABLED=true");
    } else {
      // Basic URL format validation
      try {
        const url = new URL(config.baseURL);
        if (!url.protocol.startsWith("http")) {
          errors.push("RERANK_API_BASE must be a valid HTTP or HTTPS URL");
        }
      } catch {
        errors.push("RERANK_API_BASE must be a valid URL");
      }
    }

    if (!config.model) {
      errors.push("RERANK_MODEL is required when RERANK_ENABLED=true");
    }

    if (config.timeout < MIN_RERANK_TIMEOUT || config.timeout > MAX_RERANK_TIMEOUT) {
      errors.push(
        `RERANK_TIMEOUT must be between ${MIN_RERANK_TIMEOUT} and ${MAX_RERANK_TIMEOUT}ms`,
      );
    }
  }

  return errors;
}

/**
 * Configuration cache (for singleton pattern)
 *
 * @internal
 */
let _configCache: Config | null = null;

/**
 * Reset the configuration cache (for testing)
 *
 * This function clears the cached configuration singleton,
 * forcing the next call to loadConfig() to read fresh values
 * from environment variables.
 *
 * @internal This is intended for testing purposes only
 */
export function resetConfigCache(): void {
  _configCache = null;
}

export function loadConfig(): Config {
  if (_configCache) {
    return _configCache;
  }

  const config: Config = {
    fetcher: {
      defaultFetcher: (process.env.DEFAULT_FETCHER as FetcherType) || "auto",
      http: {
        timeout: Number.parseInt(process.env.HTTP_TIMEOUT || "10000", 10),
        maxRetries: Number.parseInt(process.env.HTTP_MAX_RETRIES || "3", 10),
        followRedirects: process.env.HTTP_FOLLOW_REDIRECTS !== "false",
      },
      crawl4ai: {
        serviceUrl: process.env.CRAWL4AI_SERVICE_URL || "http://localhost:8001",
        enabled: process.env.CRAWL4AI_ENABLED !== "false",
        timeout: Number.parseInt(process.env.CRAWL4AI_TIMEOUT || "30000", 10),
        maxRetries: Number.parseInt(process.env.CRAWL4AI_MAX_RETRIES || "3", 10),
        features: {
          screenshots: process.env.CRAWL4AI_ENABLE_SCREENSHOTS === "true",
          media: process.env.CRAWL4AI_ENABLE_MEDIA === "true",
          links: process.env.CRAWL4AI_ENABLE_LINKS === "true",
        },
        defaultScreenshotMode:
          (process.env.CRAWL4AI_SCREENSHOT_MODE as "viewport" | "full") || "viewport",
      },
    },
    storage: {
      screenshotPath: process.env.SCREENSHOT_STORAGE_PATH || "./public/screenshots",
      maxScreenshotSize:
        Number.parseInt(process.env.SCREENSHOT_MAX_SIZE_MB || "5", 10) * 1024 * 1024,
      screenshotRetentionDays: Number.parseInt(
        process.env.SCREENSHOT_RETENTION_DAYS || "0",
        10,
      ),
    },
    monitoring: {
      enabled: process.env.MONITORING_ENABLED !== "false",
      exportInterval: Number.parseInt(process.env.METRICS_EXPORT_INTERVAL || "60000", 10),
      detailedLogging: process.env.DETAILED_LOGGING === "true",
      performance: {
        database: Number.parseInt(process.env.PERF_THRESHOLD_DATABASE || "1000", 10),
        embedding: Number.parseInt(process.env.PERF_THRESHOLD_EMBEDDING || "5000", 10),
        search: Number.parseInt(process.env.PERF_THRESHOLD_SEARCH || "2000", 10),
        processing: Number.parseInt(process.env.PERF_THRESHOLD_PROCESSING || "10000", 10),
        fetcher: Number.parseInt(process.env.PERF_THRESHOLD_FETCHER || "30000", 10),
      },
      maxSamples: Number.parseInt(process.env.PERF_MAX_SAMPLES || "1000", 10),
    },
    reranker: {
      enabled: process.env.RERANK_ENABLED === "true",
      baseURL: process.env.RERANK_API_BASE,
      model: process.env.RERANK_MODEL,
      timeout: Number.parseInt(process.env.RERANK_TIMEOUT || "5000", 10),
    },
  };

  // Validate reranker configuration at load time
  const rerankerErrors = validateRerankerConfig(config.reranker);
  if (rerankerErrors.length > 0) {
    throw new Error(`Configuration errors:\n${rerankerErrors.join("\n")}`);
  }

  _configCache = config;
  return config;
}
/** Validate configuration
 *
 * Checks for invalid values and returns validation errors.
 * Should be called after loadConfig() to ensure configuration is valid.
 *
 * @param config Configuration object to validate
 * @returns Validation result with errors if any
 */
export function validateConfig(config: Config): ValidationResult {
  const errors: string[] = [];

  // Validate fetcher config
  const validFetcherTypes: FetcherType[] = ["auto", "http", "crawl4ai", "file"];
  if (!validFetcherTypes.includes(config.fetcher.defaultFetcher)) {
    errors.push(`Invalid default fetcher: ${config.fetcher.defaultFetcher}`);
  }

  // Validate timeouts (must be positive and reasonable)
  if (config.fetcher.http.timeout < 1000 || config.fetcher.http.timeout > 120000) {
    errors.push("HTTP timeout must be between 1000 and 120000ms");
  }

  if (
    config.fetcher.crawl4ai.timeout < 1000 ||
    config.fetcher.crawl4ai.timeout > 300000
  ) {
    errors.push("Crawl4AI timeout must be between 1000 and 300000ms");
  }

  // Validate retry counts
  if (config.fetcher.http.maxRetries < 0 || config.fetcher.http.maxRetries > 10) {
    errors.push("HTTP max retries must be between 0 and 10");
  }

  if (config.fetcher.crawl4ai.maxRetries < 0 || config.fetcher.crawl4ai.maxRetries > 10) {
    errors.push("Crawl4AI max retries must be between 0 and 10");
  }

  // Validate Crawl4AI service URL
  try {
    new URL(config.fetcher.crawl4ai.serviceUrl);
  } catch {
    errors.push(`Invalid Crawl4AI service URL: ${config.fetcher.crawl4ai.serviceUrl}`);
  }

  // Validate screenshot mode
  if (!["viewport", "full"].includes(config.fetcher.crawl4ai.defaultScreenshotMode)) {
    errors.push(
      `Invalid screenshot mode: ${config.fetcher.crawl4ai.defaultScreenshotMode}. Must be 'viewport' or 'full'`,
    );
  }

  // Validate storage config
  if (config.storage.maxScreenshotSize < 1024 * 100) {
    // Min 100KB
    errors.push("Max screenshot size must be at least 100KB");
  }

  if (config.storage.maxScreenshotSize > 50 * 1024 * 1024) {
    // Max 50MB
    errors.push("Max screenshot size must not exceed 50MB");
  }

  if (config.storage.screenshotRetentionDays < 0) {
    errors.push("Screenshot retention days must be non-negative (0 = keep forever)");
  }

  // Validate monitoring config
  if (
    config.monitoring.exportInterval < 1000 ||
    config.monitoring.exportInterval > 600000
  ) {
    errors.push("Metrics export interval must be between 1000 and 600000ms");
  }

  // Validate reranker configuration
  errors.push(...validateRerankerConfig(config.reranker));

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Export singleton config instance
 * Loaded once at startup and validated
 */
export const appConfig = loadConfig();

// ============================================================================
// Rate Limiting Configuration (Issue #80)
// ============================================================================

/**
 * Pipeline rate limit configuration
 * Controls how many scraping jobs run concurrently
 */
export interface PipelineRateLimitConfig {
  /** Maximum concurrent scraping jobs in the pipeline queue */
  maxConcurrency: number;
  /** Maximum concurrent page requests within a single scraping job */
  pageConcurrency: number;
}

/**
 * Embedding rate limit configuration
 * Controls parallel embedding operations
 */
export interface EmbeddingRateLimitConfig {
  /** Maximum concurrent image embedding operations */
  maxConcurrency: number;
  /** Maximum documents per embedding batch */
  maxBatchSize: number;
}

/**
 * Network rate limit configuration
 * Controls HTTP/Crawl4AI request rate limiting
 */
export interface NetworkRateLimitConfig {
  /** HTTP fetcher retry settings */
  http: {
    /** Maximum number of retry attempts for failed HTTP requests */
    maxRetries: number;
    /** Base delay in milliseconds for exponential backoff */
    retryDelayMs: number;
  };
  /** Crawl4AI circuit breaker settings */
  crawl4ai: {
    /** Number of consecutive failures before opening circuit */
    circuitBreakerThreshold: number;
    /** Time in milliseconds before attempting to reset circuit */
    circuitBreakerResetTimeoutMs: number;
  };
}

/**
 * Database rate limit configuration
 * Controls connection pool behavior
 */
export interface DatabaseRateLimitConfig {
  /** Minimum number of connections in the pool */
  poolMin: number;
  /** Maximum number of connections in the pool */
  poolMax: number;
  /** Connection timeout in milliseconds */
  connectionTimeoutMs: number;
  /** Idle timeout in milliseconds before closing unused connections */
  idleTimeoutMs: number;
}

/**
 * Complete rate limiting configuration
 */
export interface RateLimitConfig {
  pipeline: PipelineRateLimitConfig;
  embedding: EmbeddingRateLimitConfig;
  network: NetworkRateLimitConfig;
  database: DatabaseRateLimitConfig;
}

/**
 * Load rate limiting configuration from environment variables
 *
 * @returns Rate limit configuration with values from environment or defaults
 */
export function loadRateLimitConfig(): RateLimitConfig {
  return {
    pipeline: {
      maxConcurrency: Number.parseInt(process.env.PIPELINE_MAX_CONCURRENCY || "3", 10),
      pageConcurrency: Number.parseInt(process.env.SCRAPER_PAGE_CONCURRENCY || "3", 10),
    },
    embedding: {
      maxConcurrency: Number.parseInt(
        process.env.IMAGE_EMBEDDING_MAX_CONCURRENCY || "5",
        10,
      ),
      maxBatchSize: Number.parseInt(process.env.EMBEDDING_BATCH_SIZE || "100", 10),
    },
    network: {
      http: {
        maxRetries: Number.parseInt(process.env.HTTP_FETCHER_MAX_RETRIES || "6", 10),
        retryDelayMs: Number.parseInt(
          process.env.HTTP_FETCHER_RETRY_DELAY_MS || "1000",
          10,
        ),
      },
      crawl4ai: {
        circuitBreakerThreshold: Number.parseInt(
          process.env.CRAWL4AI_CIRCUIT_BREAKER_THRESHOLD || "5",
          10,
        ),
        circuitBreakerResetTimeoutMs: Number.parseInt(
          process.env.CRAWL4AI_CIRCUIT_BREAKER_RESET_TIMEOUT_MS || "60000",
          10,
        ),
      },
    },
    database: {
      poolMin: Number.parseInt(process.env.DB_POOL_MIN || "2", 10),
      poolMax: Number.parseInt(process.env.DB_POOL_MAX || "10", 10),
      connectionTimeoutMs: Number.parseInt(
        process.env.DB_CONNECTION_TIMEOUT_MS || "10000",
        10,
      ),
      idleTimeoutMs: Number.parseInt(process.env.DB_IDLE_TIMEOUT_MS || "30000", 10),
    },
  };
}

/**
 * Validate rate limiting configuration
 *
 * Checks for invalid values and returns validation errors.
 * Should be called after loadRateLimitConfig() to ensure configuration is valid.
 *
 * @param config Rate limit configuration to validate
 * @returns Validation result with errors if any
 */
export function validateRateLimitConfig(config: RateLimitConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate pipeline concurrency
  if (config.pipeline.maxConcurrency < 1 || config.pipeline.maxConcurrency > 20) {
    errors.push(
      `PIPELINE_MAX_CONCURRENCY must be between 1 and 20 (got: ${config.pipeline.maxConcurrency})`,
    );
  } else if (config.pipeline.maxConcurrency > 10) {
    warnings.push(
      `PIPELINE_MAX_CONCURRENCY is set to ${config.pipeline.maxConcurrency}. High values may cause memory issues or rate limiting from target servers.`,
    );
  }

  if (config.pipeline.pageConcurrency < 1 || config.pipeline.pageConcurrency > 20) {
    errors.push(
      `SCRAPER_PAGE_CONCURRENCY must be between 1 and 20 (got: ${config.pipeline.pageConcurrency})`,
    );
  } else if (config.pipeline.pageConcurrency > 10) {
    warnings.push(
      `SCRAPER_PAGE_CONCURRENCY is set to ${config.pipeline.pageConcurrency}. High values may trigger anti-bot measures.`,
    );
  }

  // Validate embedding concurrency
  if (config.embedding.maxConcurrency < 1 || config.embedding.maxConcurrency > 20) {
    errors.push(
      `IMAGE_EMBEDDING_MAX_CONCURRENCY must be between 1 and 20 (got: ${config.embedding.maxConcurrency})`,
    );
  } else if (config.embedding.maxConcurrency > 10) {
    warnings.push(
      `IMAGE_EMBEDDING_MAX_CONCURRENCY is set to ${config.embedding.maxConcurrency}. High values may overload embedding APIs.`,
    );
  }

  if (config.embedding.maxBatchSize < 1 || config.embedding.maxBatchSize > 500) {
    errors.push(
      `EMBEDDING_BATCH_SIZE must be between 1 and 500 (got: ${config.embedding.maxBatchSize})`,
    );
  }

  // Validate network settings
  if (config.network.http.maxRetries < 0 || config.network.http.maxRetries > 20) {
    errors.push(
      `HTTP_FETCHER_MAX_RETRIES must be between 0 and 20 (got: ${config.network.http.maxRetries})`,
    );
  }

  if (
    config.network.http.retryDelayMs < 100 ||
    config.network.http.retryDelayMs > 60000
  ) {
    errors.push(
      `HTTP_FETCHER_RETRY_DELAY_MS must be between 100 and 60000 (got: ${config.network.http.retryDelayMs})`,
    );
  }

  if (
    config.network.crawl4ai.circuitBreakerThreshold < 1 ||
    config.network.crawl4ai.circuitBreakerThreshold > 100
  ) {
    errors.push(
      `CRAWL4AI_CIRCUIT_BREAKER_THRESHOLD must be between 1 and 100 (got: ${config.network.crawl4ai.circuitBreakerThreshold})`,
    );
  }

  if (
    config.network.crawl4ai.circuitBreakerResetTimeoutMs < 1000 ||
    config.network.crawl4ai.circuitBreakerResetTimeoutMs > 600000
  ) {
    errors.push(
      `CRAWL4AI_CIRCUIT_BREAKER_RESET_TIMEOUT_MS must be between 1000 and 600000 (got: ${config.network.crawl4ai.circuitBreakerResetTimeoutMs})`,
    );
  }

  // Validate database pool settings
  if (config.database.poolMin < 0 || config.database.poolMin > 100) {
    errors.push(
      `DB_POOL_MIN must be between 0 and 100 (got: ${config.database.poolMin})`,
    );
  }

  if (config.database.poolMax < 1 || config.database.poolMax > 200) {
    errors.push(
      `DB_POOL_MAX must be between 1 and 200 (got: ${config.database.poolMax})`,
    );
  }

  if (config.database.poolMin >= config.database.poolMax) {
    errors.push(
      `DB_POOL_MIN (${config.database.poolMin}) must be less than DB_POOL_MAX (${config.database.poolMax})`,
    );
  }

  if (
    config.database.connectionTimeoutMs < 1000 ||
    config.database.connectionTimeoutMs > 120000
  ) {
    errors.push(
      `DB_CONNECTION_TIMEOUT_MS must be between 1000 and 120000 (got: ${config.database.connectionTimeoutMs})`,
    );
  }

  if (config.database.idleTimeoutMs < 1000 || config.database.idleTimeoutMs > 600000) {
    errors.push(
      `DB_IDLE_TIMEOUT_MS must be between 1000 and 600000 (got: ${config.database.idleTimeoutMs})`,
    );
  }

  // Log warnings if any
  if (warnings.length > 0) {
    for (const warning of warnings) {
      logger.warn(`Rate limit configuration warning: ${warning}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Export singleton rate limit config instance
 * Loaded once at startup and validated
 */
export const rateLimitConfig = loadRateLimitConfig();

// Validate at module load time
const rateLimitValidation = validateRateLimitConfig(rateLimitConfig);
if (!rateLimitValidation.valid) {
  throw new Error(
    `Invalid rate limiting configuration:\n${rateLimitValidation.errors.map((e) => `  - ${e}`).join("\n")}`,
  );
}
