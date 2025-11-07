import { Pool, type PoolClient, type PoolConfig } from "pg";
import { logger } from "../utils/logger";
import { ConnectionError } from "./errors";

/**
 * PostgreSQL connection pool configuration and management.
 * Provides connection pooling, health checks, and extension verification.
 */
export class PostgresConnection {
  private pool: Pool;
  private readonly connectionString: string;

  constructor(connectionString: string, config?: Partial<PoolConfig>) {
    if (!connectionString) {
      throw new ConnectionError("PostgreSQL connection string is required");
    }

    this.connectionString = connectionString;

    // Create connection pool with optimal defaults
    const poolConfig: PoolConfig = {
      connectionString,
      // Connection pool sizing
      max: config?.max ?? 20, // Maximum pool size
      min: config?.min ?? 5, // Minimum idle connections
      // Timeout configuration
      idleTimeoutMillis: config?.idleTimeoutMillis ?? 30000, // 30s idle timeout
      connectionTimeoutMillis: config?.connectionTimeoutMillis ?? 5000, // 5s connection timeout
      // Keepalive for long-running connections
      keepAlive: config?.keepAlive ?? true,
      keepAliveInitialDelayMillis: config?.keepAliveInitialDelayMillis ?? 10000,
      ...config,
    };

    this.pool = new Pool(poolConfig);

    // Handle pool errors
    this.pool.on("error", (err) => {
      logger.error(`Unexpected PostgreSQL pool error: ${err.message}`);
    });

    logger.debug(
      `PostgreSQL connection pool created (max: ${poolConfig.max}, min: ${poolConfig.min})`,
    );
  }

  /**
   * Get the underlying pool instance
   */
  getPool(): Pool {
    return this.pool;
  }

  /**
   * Test database connectivity
   */
  async testConnection(): Promise<void> {
    try {
      const client = await this.pool.connect();
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
   * Check if pgvector extension is available and enabled
   */
  async checkPgvectorExtension(): Promise<{
    installed: boolean;
    version: string | null;
  }> {
    try {
      const client = await this.pool.connect();
      try {
        // Check if extension exists
        const result = await client.query(
          "SELECT extversion FROM pg_extension WHERE extname = 'vector'",
        );

        if (result.rows.length === 0) {
          return { installed: false, version: null };
        }

        const version = result.rows[0].extversion;
        logger.debug(`pgvector extension installed (version: ${version})`);
        return { installed: true, version };
      } finally {
        client.release();
      }
    } catch (error) {
      throw new ConnectionError("Failed to check pgvector extension", error);
    }
  }

  /**
   * Install pgvector extension
   * Requires superuser or extension creation privileges
   */
  async installPgvectorExtension(): Promise<void> {
    try {
      const client = await this.pool.connect();
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
   * Verify database has required permissions
   */
  async checkPermissions(): Promise<{
    canCreateTables: boolean;
    canCreateIndexes: boolean;
    canCreateExtensions: boolean;
  }> {
    const client = await this.pool.connect();
    try {
      const permissions = {
        canCreateTables: false,
        canCreateIndexes: false,
        canCreateExtensions: false,
      };

      // Check if we can create tables
      try {
        await client.query("BEGIN");
        await client.query("CREATE TEMP TABLE _scrapegoat_permission_test (id INTEGER)");
        await client.query("DROP TABLE _scrapegoat_permission_test");
        await client.query("COMMIT");
        permissions.canCreateTables = true;
        permissions.canCreateIndexes = true; // If we can create tables, we can create indexes
      } catch (error) {
        await client.query("ROLLBACK");
        logger.warn("⚠️ Insufficient permissions to create tables");
      }

      // Check if we can create extensions (optional - not required if extension already exists)
      try {
        await client.query("BEGIN");
        await client.query("CREATE EXTENSION IF NOT EXISTS vector");
        await client.query("ROLLBACK"); // Don't actually create it in the test
        permissions.canCreateExtensions = true;
      } catch (error) {
        await client.query("ROLLBACK");
        // This is OK if extension already exists
      }

      return permissions;
    } finally {
      client.release();
    }
  }

  /**
   * Get connection pool statistics
   */
  getPoolStats(): {
    total: number;
    idle: number;
    waiting: number;
  } {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }

  /**
   * Close all connections in the pool
   */
  async close(): Promise<void> {
    try {
      await this.pool.end();
      logger.debug("PostgreSQL connection pool closed");
    } catch (error) {
      logger.error(`Error closing PostgreSQL pool: ${error}`);
      throw new ConnectionError("Failed to close connection pool", error);
    }
  }
}
