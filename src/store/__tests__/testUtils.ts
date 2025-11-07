import { Client } from "pg";
import { DocumentStore } from "../DocumentStore";
import type { EmbeddingModelConfig } from "../embeddings/EmbeddingConfig";

/**
 * Test database configuration
 * Uses environment variable or falls back to local test database
 */
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5433/postgres";

/**
 * Creates a unique test database name to avoid conflicts between parallel tests
 */
function generateTestDatabaseName(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `scrapegoat_test_${timestamp}_${random}`;
}

/**
 * Test database instance that can be used in tests
 */
export interface TestDatabase {
  store: DocumentStore;
  databaseName: string;
  connectionString: string;
  cleanup: () => Promise<void>;
}

/**
 * Creates an isolated PostgreSQL test database with all migrations applied.
 * Each test gets a unique database to avoid conflicts and ensure isolation.
 *
 * @param embeddingConfig Optional embedding configuration for the store
 * @returns TestDatabase instance with store and cleanup function
 *
 * @example
 * ```typescript
 * describe("My Test Suite", () => {
 *   let testDb: TestDatabase;
 *
 *   beforeEach(async () => {
 *     testDb = await createTestDatabase();
 *   });
 *
 *   afterEach(async () => {
 *     await testDb.cleanup();
 *   });
 *
 *   it("should do something", async () => {
 *     await testDb.store.addDocuments([...]);
 *   });
 * });
 * ```
 */
export async function createTestDatabase(
  embeddingConfig?: EmbeddingModelConfig | null,
): Promise<TestDatabase> {
  const databaseName = generateTestDatabaseName();

  // Parse the base connection string to get credentials and host
  const baseUrl = new URL(TEST_DATABASE_URL);
  const adminConnectionString = `postgresql://${baseUrl.username}:${baseUrl.password}@${baseUrl.host}/postgres`;

  // Connect to postgres database to create test database
  const adminClient = new Client({ connectionString: adminConnectionString });
  await adminClient.connect();

  try {
    // Create the test database
    await adminClient.query(`CREATE DATABASE ${databaseName}`);
  } finally {
    await adminClient.end();
  }

  // Create connection string for the new test database
  const connectionString = `postgresql://${baseUrl.username}:${baseUrl.password}@${baseUrl.host}/${databaseName}`;

  // Create DocumentStore instance with the test database
  const store = new DocumentStore(connectionString, embeddingConfig);
  await store.initialize();

  // Cleanup function to drop the test database
  const cleanup = async () => {
    try {
      // Shutdown the store to close connections
      await store.shutdown();

      // Connect to postgres database to drop test database
      const cleanupClient = new Client({ connectionString: adminConnectionString });
      await cleanupClient.connect();

      try {
        // Terminate any remaining connections to the test database
        await cleanupClient.query(`
          SELECT pg_terminate_backend(pg_stat_activity.pid)
          FROM pg_stat_activity
          WHERE pg_stat_activity.datname = '${databaseName}'
            AND pid <> pg_backend_pid()
        `);

        // Drop the test database
        await cleanupClient.query(`DROP DATABASE IF EXISTS ${databaseName}`);
      } finally {
        await cleanupClient.end();
      }
    } catch (error) {
      console.error(`Failed to cleanup test database ${databaseName}:`, error);
      // Don't throw - cleanup failures shouldn't fail tests
    }
  };

  return {
    store,
    databaseName,
    connectionString,
    cleanup,
  };
}

/**
 * Resets a test database by truncating all tables.
 * Useful when you want to clear data between tests without creating a new database.
 *
 * @param store The DocumentStore instance to reset
 *
 * @example
 * ```typescript
 * describe("My Test Suite", () => {
 *   let testDb: TestDatabase;
 *
 *   beforeAll(async () => {
 *     testDb = await createTestDatabase();
 *   });
 *
 *   afterEach(async () => {
 *     await resetTestDatabase(testDb.store);
 *   });
 *
 *   afterAll(async () => {
 *     await testDb.cleanup();
 *   });
 * });
 * ```
 */
export async function resetTestDatabase(store: DocumentStore): Promise<void> {
  // Get the internal client from the store
  const client = (store as any).client;

  if (!client) {
    throw new Error("DocumentStore client is not available");
  }

  // Truncate all tables in reverse dependency order to handle foreign keys
  await client.query("TRUNCATE TABLE documents CASCADE");
  await client.query("TRUNCATE TABLE pages CASCADE");
  await client.query("TRUNCATE TABLE versions CASCADE");
  await client.query("TRUNCATE TABLE libraries CASCADE");
}

/**
 * Generates test documents with varied content for testing search functionality.
 *
 * @param count Number of documents to generate
 * @param options Generation options
 * @returns Array of test documents
 */
export function generateTestDocuments(
  count: number,
  options: {
    library?: string;
    version?: string;
    urlPrefix?: string;
  } = {},
): Array<{
  pageContent: string;
  metadata: {
    title: string;
    url: string;
    library?: string;
    version?: string;
  };
}> {
  const {
    library = "test-lib",
    version = "1.0.0",
    urlPrefix = "https://example.com/docs",
  } = options;

  const topics = [
    "JavaScript",
    "TypeScript",
    "React",
    "Node.js",
    "Python",
    "PostgreSQL",
    "Docker",
    "API",
    "Authentication",
    "Database",
  ];

  const verbs = ["using", "implementing", "configuring", "understanding", "deploying"];

  return Array.from({ length: count }, (_, i) => {
    const topic = topics[i % topics.length];
    const verb = verbs[i % verbs.length];

    return {
      pageContent: `This is a test document about ${verb} ${topic}. Document number ${i + 1}. ${topic} is an important technology for modern development. This content includes information about ${topic} features, best practices, and common use cases.`,
      metadata: {
        title: `${topic} Guide - Part ${i + 1}`,
        url: `${urlPrefix}/${topic.toLowerCase()}/page${i + 1}`,
        library,
        version,
      },
    };
  });
}

/**
 * Waits for a condition to be true, with timeout.
 * Useful for waiting for asynchronous operations in tests.
 *
 * @param condition Function that returns true when condition is met
 * @param timeout Maximum time to wait in milliseconds
 * @param interval Check interval in milliseconds
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}
