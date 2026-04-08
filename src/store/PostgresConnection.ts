import { Pool, type PoolConfig } from "pg";
import { logger } from "../utils/logger";
import { ConnectionError } from "./errors";

/**
 * PostgreSQL connection pool management.
 * Provides connection pooling, health checks, and pgvector extension verification.
 *
 * The pool starts as `null` and must be initialized via {@link initialize} before use.
 * Call {@link getPool} to access the underlying pool (throws if not initialized).
 */
export class PostgresConnection {
  private pool: Pool | null = null;
  private readonly connectionString: string;
  private readonly poolConfig: Partial<PoolConfig>;

  constructor(connectionString: string, poolConfig?: Partial<PoolConfig>) {
    if (!connectionString) {
      throw new ConnectionError("PostgreSQL connection string is required");
    }
    this.connectionString = connectionString;
    this.poolConfig = poolConfig ?? {};
  }

  /**
   * Initialize the connection pool and verify connectivity.
   * Installs pgvector extension if not present.
   */
  async initialize(): Promise<void> {
    const config: PoolConfig = {
      connectionString: this.connectionString,
      max: this.poolConfig.max ?? 10,
      min: this.poolConfig.min ?? 2,
      idleTimeoutMillis: this.poolConfig.idleTimeoutMillis ?? 10000,
      connectionTimeoutMillis: this.poolConfig.connectionTimeoutMillis ?? 5000,
    };

    this.pool = new Pool(config);

    this.pool.on("error", (err) => {
      logger.error(`Unexpected PostgreSQL pool error: ${err.message}`);
    });

    logger.debug(
      `PostgreSQL connection pool created (max: ${config.max}, min: ${config.min})`,
    );

    await this.testConnection();
    await this.installPgvectorExtension();

    logger.info("✅ PostgreSQL connection initialized successfully");
  }

  /**
   * Get the underlying pool instance. Throws if not initialized.
   * @throws {ConnectionError} if the pool has not been initialized
   */
  getPool(): Pool {
    if (!this.pool) {
      throw new ConnectionError(
        "Connection pool not initialized. Call initialize() first.",
      );
    }
    return this.pool;
  }

  /**
   * Test database connectivity with a simple query.
   * @throws {ConnectionError} if the connection test fails
   */
  async testConnection(): Promise<void> {
    const pool = this.getPool();
    try {
      const client = await pool.connect();
      try {
        await client.query("SELECT 1");
        logger.debug("PostgreSQL connection test successful");
      } finally {
        client.release();
      }
    } catch (error) {
      throw new ConnectionError("Failed to connect to PostgreSQL", error);
    }
  }

  /**
   * Install pgvector extension if not already present.
   * Requires superuser or extension creation privileges.
   * @throws {ConnectionError} if installation fails due to permissions or missing extension
   */
  async installPgvectorExtension(): Promise<void> {
    const pool = this.getPool();
    try {
      const client = await pool.connect();
      try {
        await client.query("CREATE EXTENSION IF NOT EXISTS vector");
        logger.info("✅ pgvector extension installed successfully");
      } finally {
        client.release();
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("permission denied")) {
          throw new ConnectionError(
            "❌ Insufficient permissions to create pgvector extension.\n" +
              "   Please ask your database administrator to run:\n" +
              "   CREATE EXTENSION IF NOT EXISTS vector;\n" +
              "   Or grant extension creation privileges to this user.",
            error,
          );
        }
        if (error.message.includes("could not open extension control file")) {
          throw new ConnectionError(
            "❌ pgvector extension is not available on this PostgreSQL server.\n" +
              "   Please install pgvector: https://github.com/pgvector/pgvector#installation\n" +
              "   For managed databases (RDS, Cloud SQL, Azure), see provider-specific instructions.",
            error,
          );
        }
      }
      throw new ConnectionError("Failed to install pgvector extension", error);
    }
  }

  /**
   * Check if the database is healthy by executing a simple query.
   * @returns `true` if the database responds, `false` otherwise
   */
  async healthCheck(): Promise<boolean> {
    try {
      const pool = this.getPool();
      const result = await pool.query("SELECT 1");
      return result.rows.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Close all connections in the pool and release resources.
   * @throws {ConnectionError} if the pool cannot be closed cleanly
   */
  async close(): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.end();
        this.pool = null;
        logger.debug("PostgreSQL connection pool closed");
      } catch (error) {
        logger.error(`Error closing PostgreSQL pool: ${error}`);
        throw new ConnectionError("Failed to close connection pool", error);
      }
    }
  }
}
