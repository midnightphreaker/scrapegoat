import fs from "node:fs";
import path from "node:path";
import envPaths from "env-paths";
import yaml from "yaml";
import { z } from "zod";
import { normalizeEnvValue } from "./env";
import { logger } from "./logger";

/**
 * Log a deprecation warning when a legacy env var is used instead of the new one.
 * @param oldName - The deprecated environment variable name
 * @param newName - The replacement environment variable name
 */
function logDeprecation(oldName: string, newName: string): void {
  logger.warn(`⚠ Environment variable ${oldName} is deprecated. Use ${newName} instead.`);
}

/**
 * Custom zod schema for boolean values that properly handles string representations.
 * Unlike z.coerce.boolean() which treats any non-empty string as true,
 * this schema correctly parses "false", "0", "no", "off" as false.
 */
const envBoolean = z
  .union([z.boolean(), z.string()])
  .transform((val) => {
    if (typeof val === "boolean") return val;
    const lower = val.toLowerCase().trim();
    return (
      lower !== "false" &&
      lower !== "0" &&
      lower !== "no" &&
      lower !== "off" &&
      lower !== ""
    );
  })
  .pipe(z.boolean());

// --- Default Global Configuration ---

export const DEFAULT_CONFIG = {
  app: {
    storePath: "",
    telemetryEnabled: true,
    readOnly: false,
    embeddingModel: "text-embedding-3-small",
  },
  server: {
    protocol: "auto",
    host: "127.0.0.1",
    ports: {
      default: 6280,
      worker: 8080,
      mcp: 6280,
      web: 6281,
    },
    heartbeatMs: 30_000,
  },
  auth: {
    enabled: false,
    issuerUrl: "",
    audience: "",
  },
  scraper: {
    maxPages: 3800,
    maxDepth: 9,
    maxConcurrency: 14,
    pageTimeoutMs: 5000,
    browserTimeoutMs: 30_000,
    fetcher: {
      maxRetries: 9,
      baseDelayMs: 1000,
      maxCacheItems: 200,
      maxCacheItemSizeBytes: 500 * 1024,
    },
    document: {
      maxSize: 1_048_576_000, // ~1GB max size for PDF/Office documents
    },
  },
  splitter: {
    minChunkSize: 500,
    preferredChunkSize: 1500,
    maxChunkSize: 5000,
    treeSitterSizeLimit: 30_000,
    json: {
      maxNestingDepth: 5,
      maxChunks: 1000,
    },
  },
  embeddings: {
    batchSize: 100,
    batchChars: 50_000,
    requestTimeoutMs: 30_000,
    initTimeoutMs: 30_000,
    vectorDimension: 1536,
    /** Whether to strip newlines from text before generating embeddings (all providers). Env: `SCRAPEGOAT_EMBEDDINGS_STRIP_NEW_LINES` */
    stripNewLines: true,
    /** SDK-level batch size for provider API calls (currently OpenAI-only). Env: `SCRAPEGOAT_EMBEDDINGS_API_BATCH_SIZE` */
    apiBatchSize: 512,
    /** Whether to allow truncating embeddings to target dimension (currently Gemini-only). Env: `SCRAPEGOAT_EMBEDDINGS_ALLOW_TRUNCATE` */
    allowTruncate: true,
  },
  db: {
    migrationMaxRetries: 5,
    migrationRetryDelayMs: 300,
  },
  database: {
    url: "",
    vectorDimension: 1536,
    pool: {
      max: 10,
      min: 2,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
    },
  },
  search: {
    overfetchFactor: 2,
    weightVec: 1,
    weightFts: 1,
    vectorMultiplier: 10,
    /** RRF smoothing constant for hybrid search score fusion. Env: `SCRAPEGOAT_SEARCH_RRF_K` */
    rrfK: 60,
  },
  sandbox: {
    defaultTimeoutMs: 5000,
  },
  assembly: {
    maxParentChainDepth: 10,
    childLimit: 3,
    precedingSiblingsLimit: 1,
    subsequentSiblingsLimit: 2,
    maxChunkDistance: 3,
  },
  webImport: {
    stagingMode: "memory" as const,
    stagingInternalPath: "",
    maxTotalSizeBytes: 2048 * 1024 * 1024,
    maxFileSizeBytes: 128 * 1024 * 1024,
    maxFiles: 9999,
    sessionTtlSeconds: 3600,
    maxArchiveEntries: 9999,
    maxArchiveUncompressedBytes: 2048 * 1024 * 1024,
    maxArchiveCompressedBytes: 512 * 1024 * 1024,
    maxDepth: 9,
    maxFilenameLength: 99,
    maxPathLength: 255,
  },
} as const;

// --- Configuration Schema (Nested) ---

export const AppConfigSchema = z.object({
  app: z
    .object({
      storePath: z.string().default(DEFAULT_CONFIG.app.storePath),
      telemetryEnabled: envBoolean.default(DEFAULT_CONFIG.app.telemetryEnabled),
      readOnly: envBoolean.default(DEFAULT_CONFIG.app.readOnly),
      embeddingModel: z.string().default(DEFAULT_CONFIG.app.embeddingModel),
    })
    .default(DEFAULT_CONFIG.app),
  server: z
    .object({
      protocol: z.string().default(DEFAULT_CONFIG.server.protocol),
      host: z.string().default(DEFAULT_CONFIG.server.host),
      ports: z
        .object({
          default: z.coerce.number().int().default(DEFAULT_CONFIG.server.ports.default),
          worker: z.coerce.number().int().default(DEFAULT_CONFIG.server.ports.worker),
          mcp: z.coerce.number().int().default(DEFAULT_CONFIG.server.ports.mcp),
          web: z.coerce.number().int().default(DEFAULT_CONFIG.server.ports.web),
        })
        .default(DEFAULT_CONFIG.server.ports),
      heartbeatMs: z.coerce.number().int().default(DEFAULT_CONFIG.server.heartbeatMs),
    })
    .default(DEFAULT_CONFIG.server),
  auth: z
    .object({
      enabled: envBoolean.default(DEFAULT_CONFIG.auth.enabled),
      issuerUrl: z.string().default(DEFAULT_CONFIG.auth.issuerUrl),
      audience: z.string().default(DEFAULT_CONFIG.auth.audience),
    })
    .default(DEFAULT_CONFIG.auth),
  scraper: z
    .object({
      maxPages: z.coerce.number().int().default(DEFAULT_CONFIG.scraper.maxPages),
      maxDepth: z.coerce.number().int().default(DEFAULT_CONFIG.scraper.maxDepth),
      maxConcurrency: z.coerce
        .number()
        .int()
        .default(DEFAULT_CONFIG.scraper.maxConcurrency),
      pageTimeoutMs: z.coerce
        .number()
        .int()
        .default(DEFAULT_CONFIG.scraper.pageTimeoutMs),
      browserTimeoutMs: z.coerce
        .number()
        .int()
        .default(DEFAULT_CONFIG.scraper.browserTimeoutMs),
      fetcher: z
        .object({
          maxRetries: z.coerce
            .number()
            .int()
            .default(DEFAULT_CONFIG.scraper.fetcher.maxRetries),
          baseDelayMs: z.coerce
            .number()
            .int()
            .default(DEFAULT_CONFIG.scraper.fetcher.baseDelayMs),
          maxCacheItems: z.coerce
            .number()
            .int()
            .default(DEFAULT_CONFIG.scraper.fetcher.maxCacheItems),
          maxCacheItemSizeBytes: z.coerce
            .number()
            .int()
            .default(DEFAULT_CONFIG.scraper.fetcher.maxCacheItemSizeBytes),
        })
        .default(DEFAULT_CONFIG.scraper.fetcher),
      document: z
        .object({
          maxSize: z.coerce
            .number()
            .int()
            .default(DEFAULT_CONFIG.scraper.document.maxSize),
        })
        .default(DEFAULT_CONFIG.scraper.document),
    })
    .default(DEFAULT_CONFIG.scraper),
  splitter: z
    .object({
      minChunkSize: z.coerce.number().int().default(DEFAULT_CONFIG.splitter.minChunkSize),
      preferredChunkSize: z.coerce
        .number()
        .int()
        .default(DEFAULT_CONFIG.splitter.preferredChunkSize),
      maxChunkSize: z.coerce.number().int().default(DEFAULT_CONFIG.splitter.maxChunkSize),
      treeSitterSizeLimit: z.coerce
        .number()
        .int()
        .default(DEFAULT_CONFIG.splitter.treeSitterSizeLimit),
      json: z
        .object({
          maxNestingDepth: z.coerce
            .number()
            .int()
            .default(DEFAULT_CONFIG.splitter.json.maxNestingDepth),
          maxChunks: z.coerce
            .number()
            .int()
            .default(DEFAULT_CONFIG.splitter.json.maxChunks),
        })
        .default(DEFAULT_CONFIG.splitter.json),
    })
    .default(DEFAULT_CONFIG.splitter),
  embeddings: z
    .object({
      batchSize: z.coerce.number().int().default(DEFAULT_CONFIG.embeddings.batchSize),
      batchChars: z.coerce.number().int().default(DEFAULT_CONFIG.embeddings.batchChars),
      requestTimeoutMs: z.coerce
        .number()
        .int()
        .default(DEFAULT_CONFIG.embeddings.requestTimeoutMs),
      initTimeoutMs: z.coerce
        .number()
        .int()
        .default(DEFAULT_CONFIG.embeddings.initTimeoutMs),
      vectorDimension: z.coerce
        .number()
        .int()
        .min(1, "embedding dimension must be at least 1")
        .default(DEFAULT_CONFIG.embeddings.vectorDimension),
      stripNewLines: envBoolean.default(DEFAULT_CONFIG.embeddings.stripNewLines),
      apiBatchSize: z.coerce
        .number()
        .int()
        .positive()
        .default(DEFAULT_CONFIG.embeddings.apiBatchSize),
      allowTruncate: envBoolean.default(DEFAULT_CONFIG.embeddings.allowTruncate),
    })
    .default(DEFAULT_CONFIG.embeddings),
  db: z
    .object({
      migrationMaxRetries: z.coerce
        .number()
        .int()
        .default(DEFAULT_CONFIG.db.migrationMaxRetries),
      migrationRetryDelayMs: z.coerce
        .number()
        .int()
        .default(DEFAULT_CONFIG.db.migrationRetryDelayMs),
    })
    .default(DEFAULT_CONFIG.db),
  database: z
    .object({
      url: z.string().default(DEFAULT_CONFIG.database.url),
      vectorDimension: z.coerce
        .number()
        .int()
        .min(1)
        .default(DEFAULT_CONFIG.database.vectorDimension),
      pool: z
        .object({
          max: z.coerce.number().int().default(DEFAULT_CONFIG.database.pool.max),
          min: z.coerce.number().int().default(DEFAULT_CONFIG.database.pool.min),
          idleTimeoutMillis: z.coerce
            .number()
            .int()
            .default(DEFAULT_CONFIG.database.pool.idleTimeoutMillis),
          connectionTimeoutMillis: z.coerce
            .number()
            .int()
            .default(DEFAULT_CONFIG.database.pool.connectionTimeoutMillis),
        })
        .default(DEFAULT_CONFIG.database.pool),
    })
    .default(DEFAULT_CONFIG.database),
  search: z
    .object({
      overfetchFactor: z.coerce.number().default(DEFAULT_CONFIG.search.overfetchFactor),
      weightVec: z.coerce.number().default(DEFAULT_CONFIG.search.weightVec),
      weightFts: z.coerce.number().default(DEFAULT_CONFIG.search.weightFts),
      vectorMultiplier: z.coerce
        .number()
        .int()
        .default(DEFAULT_CONFIG.search.vectorMultiplier),
      rrfK: z.coerce.number().int().min(1).default(DEFAULT_CONFIG.search.rrfK),
    })
    .default(DEFAULT_CONFIG.search),
  sandbox: z
    .object({
      defaultTimeoutMs: z.coerce
        .number()
        .int()
        .default(DEFAULT_CONFIG.sandbox.defaultTimeoutMs),
    })
    .default(DEFAULT_CONFIG.sandbox),
  assembly: z
    .object({
      maxParentChainDepth: z.coerce
        .number()
        .int()
        .default(DEFAULT_CONFIG.assembly.maxParentChainDepth),
      childLimit: z.coerce.number().int().default(DEFAULT_CONFIG.assembly.childLimit),
      precedingSiblingsLimit: z.coerce
        .number()
        .int()
        .default(DEFAULT_CONFIG.assembly.precedingSiblingsLimit),
      subsequentSiblingsLimit: z.coerce
        .number()
        .int()
        .default(DEFAULT_CONFIG.assembly.subsequentSiblingsLimit),
      maxChunkDistance: z.coerce
        .number()
        .int()
        .min(0)
        .default(DEFAULT_CONFIG.assembly.maxChunkDistance),
    })
    .default(DEFAULT_CONFIG.assembly),
  webImport: z
    .object({
      stagingMode: z
        .enum(["memory", "filesystem"])
        .default(DEFAULT_CONFIG.webImport.stagingMode),
      stagingInternalPath: z
        .string()
        .default(DEFAULT_CONFIG.webImport.stagingInternalPath),
      maxTotalSizeBytes: z.coerce
        .number()
        .int()
        .default(DEFAULT_CONFIG.webImport.maxTotalSizeBytes),
      maxFileSizeBytes: z.coerce
        .number()
        .int()
        .default(DEFAULT_CONFIG.webImport.maxFileSizeBytes),
      maxFiles: z.coerce.number().int().default(DEFAULT_CONFIG.webImport.maxFiles),
      sessionTtlSeconds: z.coerce
        .number()
        .int()
        .default(DEFAULT_CONFIG.webImport.sessionTtlSeconds),
      maxArchiveEntries: z.coerce
        .number()
        .int()
        .default(DEFAULT_CONFIG.webImport.maxArchiveEntries),
      maxArchiveUncompressedBytes: z.coerce
        .number()
        .int()
        .default(DEFAULT_CONFIG.webImport.maxArchiveUncompressedBytes),
      maxArchiveCompressedBytes: z.coerce
        .number()
        .int()
        .default(DEFAULT_CONFIG.webImport.maxArchiveCompressedBytes),
      maxDepth: z.coerce.number().int().default(DEFAULT_CONFIG.webImport.maxDepth),
      maxFilenameLength: z.coerce
        .number()
        .int()
        .default(DEFAULT_CONFIG.webImport.maxFilenameLength),
      maxPathLength: z.coerce
        .number()
        .int()
        .default(DEFAULT_CONFIG.webImport.maxPathLength),
    })
    .default(DEFAULT_CONFIG.webImport),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

// Get defaults from the schema
export const defaults = AppConfigSchema.parse({});

// --- Mapping Configuration ---
// Maps flat env vars and CLI args to the nested config structure

interface ConfigMapping {
  path: string[]; // Path in AppConfig
  env?: string[]; // Environment variables
  cli?: string; // CLI argument name (yargs)
}

const configMappings: ConfigMapping[] = [
  {
    path: ["server", "protocol"],
    env: ["SCRAPEGOAT_PROTOCOL", "DOCS_MCP_PROTOCOL"],
    cli: "protocol",
  },
  {
    path: ["app", "storePath"],
    env: ["SCRAPEGOAT_STORE_PATH", "DOCS_MCP_STORE_PATH"],
    cli: "storePath",
  },
  {
    path: ["app", "telemetryEnabled"],
    env: ["SCRAPEGOAT_TELEMETRY", "DOCS_MCP_TELEMETRY"],
  }, // Handled via --no-telemetry in CLI usually
  {
    path: ["app", "readOnly"],
    env: ["SCRAPEGOAT_READ_ONLY", "DOCS_MCP_READ_ONLY"],
    cli: "readOnly",
  },
  // Ports - Special handling for shared env vars is done in mapping logic
  {
    path: ["server", "ports", "default"],
    env: ["SCRAPEGOAT_PORT", "DOCS_MCP_PORT", "PORT"],
    cli: "port",
  },
  {
    path: ["server", "ports", "worker"],
    env: ["SCRAPEGOAT_PORT", "DOCS_MCP_PORT", "PORT"],
    cli: "port",
  },
  {
    path: ["server", "ports", "mcp"],
    env: ["SCRAPEGOAT_PORT", "DOCS_MCP_PORT", "PORT"],
    cli: "port",
  },
  {
    path: ["server", "ports", "web"],
    env: ["SCRAPEGOAT_WEB_PORT", "DOCS_MCP_WEB_PORT", "DOCS_MCP_PORT", "PORT"],
    cli: "port",
  },
  {
    path: ["server", "host"],
    env: ["SCRAPEGOAT_HOST", "DOCS_MCP_HOST", "HOST"],
    cli: "host",
  },
  {
    path: ["app", "embeddingModel"],
    env: ["SCRAPEGOAT_EMBEDDING_MODEL", "DOCS_MCP_EMBEDDING_MODEL"],
    cli: "embeddingModel",
  },
  {
    path: ["scraper", "document", "maxSize"],
    env: ["SCRAPEGOAT_WEB_IMPORT_MAX_DOCUMENT_SIZE_BYTES"],
  },
  {
    path: ["auth", "enabled"],
    env: ["SCRAPEGOAT_AUTH_ENABLED", "DOCS_MCP_AUTH_ENABLED"],
    cli: "authEnabled",
  },
  {
    path: ["auth", "issuerUrl"],
    env: ["SCRAPEGOAT_AUTH_ISSUER_URL", "DOCS_MCP_AUTH_ISSUER_URL"],
    cli: "authIssuerUrl",
  },
  {
    path: ["auth", "audience"],
    env: ["SCRAPEGOAT_AUTH_AUDIENCE", "DOCS_MCP_AUTH_AUDIENCE"],
    cli: "authAudience",
  },
  {
    path: ["database", "url"],
    env: ["SCRAPEGOAT_DB_URL", "DATABASE_URL", "SCRAPEGOAT_DATABASE_URL"],
    cli: "databaseUrl",
  },
  {
    path: ["database", "vectorDimension"],
    env: [
      "SCRAPEGOAT_DB_VECTOR_SIZE",
      "VECTOR_DIMENSION",
      "SCRAPEGOAT_DATABASE_VECTOR_DIMENSION",
    ],
    cli: "vectorDimension",
  },
  // webImport — legacy SCRAPEGOAT_WEBUI_IMPORT_* env vars for backward compatibility
  {
    path: ["webImport", "stagingMode"],
    env: ["SCRAPEGOAT_WEBUI_IMPORT_STAGING_MODE"],
  },
  {
    path: ["webImport", "stagingInternalPath"],
    env: ["SCRAPEGOAT_WEBUI_IMPORT_STAGING_INTERNAL_PATH"],
  },
  {
    path: ["webImport", "maxTotalSizeBytes"],
    env: ["SCRAPEGOAT_WEBUI_IMPORT_MAX_TOTAL_SIZE_BYTES"],
  },
  {
    path: ["webImport", "maxFileSizeBytes"],
    env: ["SCRAPEGOAT_WEBUI_IMPORT_MAX_FILE_SIZE_BYTES"],
  },
  {
    path: ["webImport", "maxFiles"],
    env: [
      "SCRAPEGOAT_WEB_IMPORT_MAX_VIRTUAL_FOLDER_FILES",
      "SCRAPEGOAT_WEBUI_IMPORT_MAX_FILES",
    ],
  },
  {
    path: ["webImport", "sessionTtlSeconds"],
    env: ["SCRAPEGOAT_WEBUI_IMPORT_SESSION_TTL_SECONDS"],
  },
  {
    path: ["webImport", "maxArchiveEntries"],
    env: [
      "SCRAPEGOAT_WEB_IMPORT_MAX_ARCHIVE_FILES",
      "SCRAPEGOAT_WEBUI_IMPORT_MAX_ARCHIVE_FILES",
    ],
  },
  {
    path: ["webImport", "maxArchiveUncompressedBytes"],
    env: [
      "SCRAPEGOAT_WEB_IMPORT_MAX_ARCHIVE_UNCOMPRESSED_SIZE_BYTES",
      "SCRAPEGOAT_WEBUI_IMPORT_MAX_ARCHIVE_UNCOMPRESSED_SIZE_BYTES",
    ],
  },
  {
    path: ["webImport", "maxArchiveCompressedBytes"],
    env: ["SCRAPEGOAT_WEBUI_IMPORT_MAX_ARCHIVE_SIZE_BYTES"],
  },
  {
    path: ["webImport", "maxDepth"],
    env: ["SCRAPEGOAT_WEBUI_IMPORT_MAX_DEPTH"],
  },
  {
    path: ["webImport", "maxFilenameLength"],
    env: ["SCRAPEGOAT_WEBUI_IMPORT_MAX_FILENAME_LENGTH"],
  },
  {
    path: ["webImport", "maxPathLength"],
    env: ["SCRAPEGOAT_WEBUI_IMPORT_MAX_PATH_LENGTH"],
  },
  // Add other mappings as needed for CLI/Env overrides
];

// --- Loader Logic ---

export interface LoadConfigOptions {
  configPath?: string; // Explicit config path
  searchDir?: string; // Search directory (store path)
}

/**
 * Configuration Auto-Update Behavior
 *
 * ScrapeGoat loads configuration **once at startup** via `loadConfig()`. There is no
 * file watcher, SIGHUP handler, or hot-reload mechanism — changes to the config file
 * on disk are **not** picked up by a running process.
 *
 * **Default config path** (system directory, e.g. `~/.config/scrapegoat/config.yaml`):
 *   - On every startup, the merged result of defaults + file values is written back
 *     to disk. This ensures new default keys introduced by upgrades are materialised
 *     in the YAML file so users can discover and customise them.
 *   - The file is also updated by the CLI `config set` command, which validates the
 *     change against the schema before persisting.
 *
 * **Explicit config path** (`--config` flag or `SCRAPEGOAT_CONFIG` env var):
 *   - Treated as **read-only**. The server will never overwrite an explicit config
 *     file. Users manage these files themselves (e.g. checked into version control).
 *
 * **Runtime changes**:
 *   - `setConfigValue()` writes to the default config file, but the in-memory config
 *     held by the running process is not refreshed. A restart is required for changes
 *     to take effect.
 *   - In-flight operations (scrapes, searches, etc.) are unaffected by file changes
 *     since the config object is immutable after loading.
 *
 * **Precedence** (highest wins): CLI args → Environment variables → Config file → Defaults
 */

// System-specific paths
const systemPaths = envPaths("scrapegoat", { suffix: "" });

export function loadConfig(
  cliArgs: Record<string, unknown> = {},
  options: LoadConfigOptions = {},
): AppConfig {
  // 1. Determine Config File Path & Mode
  // Priority: CLI > Options > Env (SCRAPEGOAT_CONFIG > DOCS_MCP_CONFIG) > Default System Path
  const explicitPath =
    (cliArgs.config as string) ||
    options.configPath ||
    process.env.SCRAPEGOAT_CONFIG ||
    process.env.DOCS_MCP_CONFIG;

  if (!process.env.SCRAPEGOAT_CONFIG && process.env.DOCS_MCP_CONFIG) {
    logDeprecation("DOCS_MCP_CONFIG", "SCRAPEGOAT_CONFIG");
  }

  let configPath: string;
  let isReadOnlyConfig = false;

  if (explicitPath) {
    configPath = explicitPath;
    isReadOnlyConfig = true; // User provided specific config, do not overwrite
  } else {
    // Default: strict system config path
    configPath = path.join(systemPaths.config, "config.yaml");
    isReadOnlyConfig = false; // Auto-update default config
  }

  logger.debug(`Using config file: ${configPath}`);

  // 2. Load Config File (if exists) or use empty object
  const fileConfig = loadConfigFile(configPath) || {};

  // 3. Merge Defaults < File
  const baseConfig = deepMerge(defaults, fileConfig) as ConfigObject;

  // 4. Write back to file (Auto-Update) - ONLY if using default path
  if (!isReadOnlyConfig) {
    try {
      saveConfigFile(configPath, baseConfig);
    } catch (error) {
      logger.warn(`Failed to save config file to ${configPath}: ${error}`);
    }
  }

  // 5. Map Env Vars and CLI Args
  const envConfig = mapEnvToConfig();
  const cliConfig = mapCliToConfig(cliArgs);

  // 6. Merge: Base < Env < CLI
  const mergedInput = deepMerge(
    baseConfig,
    deepMerge(envConfig, cliConfig),
  ) as ConfigObject;

  // Special handling for embedding model fallback
  if (!getAtPath(mergedInput, ["app", "embeddingModel"]) && process.env.OPENAI_API_KEY) {
    setAtPath(mergedInput, ["app", "embeddingModel"], "text-embedding-3-small");
  }

  return AppConfigSchema.parse(mergedInput);
}

function loadConfigFile(filePath: string): Record<string, unknown> | null {
  if (!fs.existsSync(filePath)) return null;

  try {
    const content = fs.readFileSync(filePath, "utf8");
    if (filePath.endsWith(".json")) {
      return JSON.parse(content);
    }
    return yaml.parse(content) || {};
  } catch (error) {
    logger.warn(`Failed to parse config file ${filePath}: ${error}`);
    return null;
  }
}

function saveConfigFile(filePath: string, config: Record<string, unknown>): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let content: string;
  if (filePath.endsWith(".json")) {
    content = JSON.stringify(config, null, 2);
  } else {
    // Default to YAML
    content = yaml.stringify(config);
  }

  logger.debug(`Updating config file at ${filePath}`);
  fs.writeFileSync(filePath, content, "utf8");
}

function mapEnvToConfig(): Record<string, unknown> {
  const config: Record<string, unknown> = {};

  // 1. Apply explicit mappings first (for aliases like PORT, HOST)
  //    SCRAPEGOAT_* entries take precedence; DOCS_MCP_* entries act as fallback
  for (const mapping of configMappings) {
    if (mapping.env) {
      for (const envVar of mapping.env) {
        if (process.env[envVar] !== undefined) {
          setAtPath(
            config,
            mapping.path,
            normalizeEnvValue(process.env[envVar] as string),
          );
          // Log deprecation if a legacy DOCS_MCP_* var was matched and no SCRAPEGOAT_* equivalent was set
          if (envVar.startsWith("DOCS_MCP_")) {
            const primary = mapping.env.find((e) => e.startsWith("SCRAPEGOAT_"));
            if (primary && !process.env[primary]) {
              logDeprecation(envVar, primary);
            }
          }
          break; // First match wins
        }
      }
    }
  }

  // 2. Apply auto-generated env vars (takes precedence over explicit mappings)
  //    SCRAPEGOAT_* vars are checked first, then legacy DOCS_MCP_* as fallback
  for (const pathArr of ALL_CONFIG_LEAF_PATHS) {
    const newEnvVar = pathToEnvVar(pathArr);
    const oldEnvVar = `DOCS_MCP_${pathArr.map(camelToUpperSnake).join("_")}`;

    if (process.env[newEnvVar] !== undefined) {
      setAtPath(config, pathArr, normalizeEnvValue(process.env[newEnvVar] as string));
    } else if (process.env[oldEnvVar] !== undefined) {
      setAtPath(config, pathArr, normalizeEnvValue(process.env[oldEnvVar] as string));
      logDeprecation(oldEnvVar, newEnvVar);
    }
  }

  return config;
}

function mapCliToConfig(args: Record<string, unknown>): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  for (const mapping of configMappings) {
    if (mapping.cli && args[mapping.cli] !== undefined) {
      setAtPath(config, mapping.path, args[mapping.cli]);
    }
  }
  return config;
}

// --- Helpers ---

// Helper type for nested objects
type ConfigObject = Record<string, unknown>;

/**
 * Convert camelCase to UPPER_SNAKE_CASE
 * Example: "maxSize" → "MAX_SIZE", "maxNestingDepth" → "MAX_NESTING_DEPTH"
 */
export function camelToUpperSnake(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
}

/**
 * Convert config path to environment variable name
 * Example: ["scraper", "document", "maxSize"] → "SCRAPEGOAT_SCRAPER_DOCUMENT_MAX_SIZE"
 */
export function pathToEnvVar(pathArr: string[]): string {
  return `SCRAPEGOAT_${pathArr.map(camelToUpperSnake).join("_")}`;
}

/**
 * Recursively collect all leaf paths from a config object
 */
export function collectLeafPaths(obj: object, prefix: string[] = []): string[][] {
  const paths: string[][] = [];
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = [...prefix, key];
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      paths.push(...collectLeafPaths(value, currentPath));
    } else {
      paths.push(currentPath);
    }
  }
  return paths;
}

// Cache leaf paths at module init since DEFAULT_CONFIG is constant
const ALL_CONFIG_LEAF_PATHS = collectLeafPaths(DEFAULT_CONFIG);

function setAtPath(obj: ConfigObject, pathArr: string[], value: unknown) {
  let current = obj;
  for (let i = 0; i < pathArr.length - 1; i++) {
    const key = pathArr[i];
    if (
      current[key] === undefined ||
      typeof current[key] !== "object" ||
      current[key] === null
    ) {
      current[key] = {};
    }
    current = current[key] as ConfigObject;
  }
  current[pathArr[pathArr.length - 1]] = value;
}

function getAtPath(obj: ConfigObject, pathArr: string[]): unknown {
  let current: unknown = obj;
  for (const key of pathArr) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as ConfigObject)[key];
  }
  return current;
}

function deepMerge(target: unknown, source: unknown): unknown {
  if (typeof target !== "object" || target === null) return source;
  if (typeof source !== "object" || source === null) return target;

  const t = target as ConfigObject;
  const s = source as ConfigObject;
  const output = { ...t };

  for (const key of Object.keys(s)) {
    const sValue = s[key];
    const tValue = t[key];

    if (
      typeof sValue === "object" &&
      sValue !== null &&
      typeof tValue === "object" &&
      tValue !== null &&
      key in t
    ) {
      output[key] = deepMerge(tValue, sValue);
    } else {
      output[key] = sValue;
    }
  }
  return output;
}

// --- CLI Helper Functions ---

/**
 * Check if a config path is valid by verifying it exists in DEFAULT_CONFIG
 */
export function isValidConfigPath(path: string): boolean {
  const pathArr = path.split(".");
  return getAtPath(DEFAULT_CONFIG as ConfigObject, pathArr) !== undefined;
}

/**
 * Get a config value by dot-separated path
 */
export function getConfigValue(config: AppConfig, path: string): unknown {
  const pathArr = path.split(".");
  return getAtPath(config as unknown as ConfigObject, pathArr);
}

/**
 * Parse a string value to the appropriate type (number, boolean, or string)
 */
export function parseConfigValue(value: string): unknown {
  // Try number first
  const num = Number(value);
  if (!Number.isNaN(num) && value.trim() !== "") {
    return num;
  }

  // Try boolean
  const lower = value.toLowerCase();
  if (lower === "true") return true;
  if (lower === "false") return false;

  // Default to string
  return value;
}

/**
 * Set a config value and persist to file.
 * Returns the path to the config file that was updated.
 * Validates the updated config against the schema before saving.
 */
export function setConfigValue(path: string, value: string): string {
  const configPath = getDefaultConfigPath();
  const fileConfig = loadConfigFile(configPath) || {};
  const pathArr = path.split(".");
  const parsedValue = parseConfigValue(value);

  // Apply change to a copy so we can validate before persisting
  const updatedConfig = JSON.parse(JSON.stringify(fileConfig));
  setAtPath(updatedConfig, pathArr, parsedValue);

  // Validate against schema before saving
  try {
    AppConfigSchema.parse(updatedConfig);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid config value for "${path}": ${errorMsg}`);
  }

  saveConfigFile(configPath, updatedConfig);

  return configPath;
}

/**
 * Get the default system config path
 */
export function getDefaultConfigPath(): string {
  return path.join(systemPaths.config, "config.yaml");
}
