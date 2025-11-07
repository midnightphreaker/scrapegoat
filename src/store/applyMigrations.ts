import fs from "node:fs";
import path from "node:path";
import type { Pool, PoolClient } from "pg";
import { MIGRATION_MAX_RETRIES, MIGRATION_RETRY_DELAY_MS } from "../utils/config";
import { logger } from "../utils/logger";
import { getProjectRoot } from "../utils/paths";
import { StoreError } from "./errors";

// Construct the absolute path to the migrations directory using the project root
const MIGRATIONS_DIR = path.join(getProjectRoot(), "db", "migrations");
const MIGRATIONS_TABLE = "_schema_migrations";

/**
 * Ensures the migration tracking table exists in the database.
 */
async function ensureMigrationsTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

/**
 * Retrieves the set of already applied migration IDs (filenames) from the tracking table.
 */
async function getAppliedMigrations(client: PoolClient): Promise<Set<string>> {
  const result = await client.query(`SELECT id FROM ${MIGRATIONS_TABLE}`);
  return new Set(result.rows.map((row) => row.id));
}

/**
 * Applies pending database migrations found in the migrations directory.
 * Migrations are expected to be .sql files with sequential prefixes (e.g., 001-, 002-).
 * It tracks applied migrations in the _schema_migrations table.
 *
 * @param pool The PostgreSQL connection pool
 * @throws {StoreError} If any migration fails.
 */
export async function applyMigrations(pool: Pool): Promise<void> {
  let retries = 0;

  while (true) {
    try {
      await applyMigrationsTransaction(pool);
      logger.debug("Database migrations completed successfully");
      break; // Success
    } catch (error) {
      // Handle deadlock/serialization errors with retry
      if (error instanceof Error) {
        const isRetryable =
          error.message.includes("deadlock") ||
          error.message.includes("could not serialize");

        if (isRetryable && retries < MIGRATION_MAX_RETRIES) {
          retries++;
          logger.warn(
            `⚠️  Migrations encountered ${error.message}, retrying attempt ${retries}/${MIGRATION_MAX_RETRIES} in ${MIGRATION_RETRY_DELAY_MS}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, MIGRATION_RETRY_DELAY_MS));
          continue;
        }
      }

      // Re-throw non-retryable errors or exceeded retries
      if (error instanceof StoreError) {
        throw error;
      }
      throw new StoreError("Failed during migration process", error);
    }
  }
}

/**
 * Internal function that performs the migration in a transaction
 */
async function applyMigrationsTransaction(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    // Start transaction
    await client.query("BEGIN");

    logger.debug("Checking database migrations...");
    await ensureMigrationsTable(client);
    const appliedMigrations = await getAppliedMigrations(client);

    if (!fs.existsSync(MIGRATIONS_DIR)) {
      throw new StoreError("Migrations directory not found");
    }

    const migrationFiles = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith(".sql"))
      .sort(); // Sort alphabetically, relying on naming convention (001-, 002-)

    const pendingMigrations = migrationFiles.filter(
      (filename) => !appliedMigrations.has(filename),
    );

    if (pendingMigrations.length > 0) {
      logger.info(`🔄 Applying ${pendingMigrations.length} database migration(s)...`);
    }

    let appliedCount = 0;
    for (const filename of pendingMigrations) {
      logger.debug(`Applying migration: ${filename}`);
      const filePath = path.join(MIGRATIONS_DIR, filename);
      const sql = fs.readFileSync(filePath, "utf8");

      try {
        // Execute migration SQL
        await client.query(sql);

        // Record the migration
        await client.query(`INSERT INTO ${MIGRATIONS_TABLE} (id) VALUES ($1)`, [
          filename,
        ]);

        logger.debug(`Applied migration: ${filename}`);
        appliedCount++;
      } catch (error) {
        logger.error(`❌ Failed to apply migration: ${filename} - ${error}`);
        // Re-throw to trigger transaction rollback
        throw new StoreError(`Migration failed: ${filename}`, error);
      }
    }

    // Commit transaction
    await client.query("COMMIT");

    if (appliedCount > 0) {
      logger.info(`✅ Successfully applied ${appliedCount} migration(s)`);
    } else {
      logger.debug("Database schema is up to date");
    }

    // Analyze tables after migrations for query planner
    if (appliedCount > 0) {
      try {
        logger.debug("Running ANALYZE to update query planner statistics...");
        await client.query("ANALYZE");
        logger.debug("ANALYZE completed successfully");
      } catch (error) {
        logger.warn(`⚠️ Could not run ANALYZE after migrations: ${error}`);
        // Don't fail the migration process if ANALYZE fails
      }
    }
  } catch (error) {
    // Rollback on error
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      logger.error(`Failed to rollback transaction: ${rollbackError}`);
    }
    throw error;
  } finally {
    client.release();
  }
}
