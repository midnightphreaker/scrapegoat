/**
 * Default configuration values for the scraping pipeline and server
 */

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
export const DEFAULT_HTTP_PORT = 6280;

/** Default port for the Web UI */
export const DEFAULT_WEB_PORT = 6281;

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
}

/**
 * Complete application configuration
 */
export interface Config {
  fetcher: FetcherConfig;
  storage: StorageConfig;
  monitoring: MonitoringConfig;
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
export function loadConfig(): Config {
  return {
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
    },
  };
}

/**
 * Validate configuration
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
