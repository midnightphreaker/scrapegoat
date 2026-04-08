import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type AppConfig, loadConfig } from "../../../utils/config";
import { DocumentStore } from "../../DocumentStore";
import { PostgresConnection } from "../../PostgresConnection";
import type { DbChunkMetadata, DbPageChunk } from "../../types";
import { HierarchicalAssemblyStrategy } from "./HierarchicalAssemblyStrategy";

// ─── PostgreSQL Test Database Fixture ──────────────────────────────────────

const PG_BASE_URL = "postgresql://docs:docs@localhost:5432/docs";
const TEST_DB_PREFIX = "test_assembly";

function generateDbName(): string {
  return `${TEST_DB_PREFIX}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function createTestDatabase(): Promise<{
  url: string;
  cleanup: () => Promise<void>;
}> {
  const dbName = generateDbName();
  const basePool = new Pool({ connectionString: PG_BASE_URL, max: 5 });
  await basePool.query(`CREATE DATABASE "${dbName}"`);
  await basePool.end();

  const testUrl = `postgresql://docs:docs@localhost:5432/${dbName}`;
  const cleanup = async () => {
    const pool = new Pool({ connectionString: PG_BASE_URL });
    await pool.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await pool.end();
  };
  return { url: testUrl, cleanup };
}

// ─── Helper: truncate all data tables for test isolation ───────────────────

async function truncateAll(pool: Pool): Promise<void> {
  await pool.query("TRUNCATE documents, pages, versions, libraries, metadata CASCADE");
}

describe("HierarchicalAssemblyStrategy", () => {
  let strategy: HierarchicalAssemblyStrategy;
  let documentStore: DocumentStore;
  let appConfig: AppConfig;
  let connection: PostgresConnection;
  let pool: Pool;
  let testDbUrl: string;
  let testDbCleanup: () => Promise<void>;

  beforeAll(async () => {
    const { url, cleanup } = await createTestDatabase();
    testDbUrl = url;
    testDbCleanup = cleanup;
  });

  beforeEach(async () => {
    appConfig = loadConfig();

    // Disable embeddings for this strategy test
    appConfig.app.embeddingModel = "";
    appConfig.database.url = testDbUrl;

    connection = new PostgresConnection(testDbUrl, { max: 5, min: 1 });
    documentStore = new DocumentStore(connection, appConfig);
    await documentStore.initialize();
    pool = connection.getPool();
    strategy = new HierarchicalAssemblyStrategy(appConfig);
  });

  afterEach(async () => {
    if (pool) {
      await truncateAll(pool);
    }
    if (documentStore) {
      await documentStore.shutdown();
    }
  });

  afterAll(async () => {
    if (testDbCleanup) {
      await testDbCleanup();
    }
  });

  describe("canHandle", () => {
    it("should handle source code MIME types", () => {
      expect(strategy.canHandle("text/javascript")).toBe(true);
      expect(strategy.canHandle("text/typescript")).toBe(true);
      expect(strategy.canHandle("text/x-typescript")).toBe(true);
      expect(strategy.canHandle("text/x-python")).toBe(true);
    });

    it("should handle JSON MIME types", () => {
      expect(strategy.canHandle("application/json")).toBe(true);
      expect(strategy.canHandle("text/json")).toBe(true);
      expect(strategy.canHandle("text/x-json")).toBe(true);
    });

    it("should not handle other MIME types", () => {
      expect(strategy.canHandle("text/html")).toBe(false);
      expect(strategy.canHandle("text/markdown")).toBe(false);
      expect(strategy.canHandle("text/plain")).toBe(false);
    });
  });

  describe("selectChunks", () => {
    it("should return empty array for empty input", async () => {
      const result = await strategy.selectChunks("test", "1.0", [], documentStore);
      expect(result).toEqual([]);
    });

    it("should reconstruct complete hierarchy for single match", async () => {
      // Use the public API to add documents
      await documentStore.addDocuments("test-hierarchy", "1.0", 0, {
        url: "Deep.ts",
        title: "Deep TypeScript File",
        sourceContentType: "text/typescript",
        contentType: "text/typescript",
        textContent: "",
        chunks: [
          {
            content: "namespace UserManagement {",
            section: {
              path: ["UserManagement"],
              level: 0,
            },
            types: ["structural"],
          },
          {
            content: "  export class UserService {",
            section: {
              path: ["UserManagement", "UserService"],
              level: 1,
            },
            types: ["structural"],
          },
          {
            content: "    getUserById(id: string) { return db.find(id); }",
            section: {
              path: ["UserManagement", "UserService", "getUserById"],
              level: 2,
            },
            types: ["text"],
          },
        ],
        links: [],
        errors: [],
      });

      // Query the database to get the actual document IDs
      const allChunks = await documentStore.findChunksByUrl(
        "test-hierarchy",
        "1.0",
        "Deep.ts",
      );
      expect(allChunks.length).toBe(3);

      const namespaceId = allChunks[0].id;
      const classId = allChunks[1].id;
      const methodId = allChunks[2].id;

      // Input: just the deeply nested method
      const inputDoc = allChunks[2];

      const result = await strategy.selectChunks(
        "test-hierarchy",
        "1.0",
        [inputDoc],
        documentStore,
      );

      const resultContent = result.map((doc) => doc.content);
      const resultIds = result.map((doc) => doc.id);

      // Should include the complete hierarchy: method + class + namespace
      expect(resultContent).toContain(
        "    getUserById(id: string) { return db.find(id); }",
      );
      expect(resultContent).toContain("  export class UserService {");
      expect(resultContent).toContain("namespace UserManagement {");

      expect(resultIds).toContain(methodId);
      expect(resultIds).toContain(classId);
      expect(resultIds).toContain(namespaceId);

      expect(result.length).toBeGreaterThanOrEqual(3);
    });

    it("should handle hierarchical gaps in parent chain", async () => {
      // Use the public API to add documents with a gap in the hierarchy
      await documentStore.addDocuments("test-gaps", "1.0", 0, {
        url: "GapTest.ts",
        title: "Gap Test TypeScript File",
        sourceContentType: "text/typescript",
        contentType: "text/typescript",
        textContent: "",
        chunks: [
          {
            content: "namespace UserManagement {",
            section: {
              path: ["UserManagement"],
              level: 0,
            },
            types: ["structural"],
          },
          // Intermediate class is missing (gap in hierarchy)
          // No chunk with path: ["UserManagement", "UserService"]
          {
            content: "    getUserById(id: string) { return db.find(id); }",
            section: {
              path: ["UserManagement", "UserService", "getUserById"],
              level: 2,
            },
            types: ["text"],
          },
        ],
        links: [],
        errors: [],
      });

      // Query the database to get the actual document IDs
      const allChunks = await documentStore.findChunksByUrl(
        "test-gaps",
        "1.0",
        "GapTest.ts",
      );
      expect(allChunks.length).toBe(2);

      const namespaceId = allChunks[0].id;
      const methodId = allChunks[1].id;

      // Input: just the deeply nested method (with missing intermediate parent)
      const inputDoc = allChunks[1];

      const result = await strategy.selectChunks(
        "test-gaps",
        "1.0",
        [inputDoc],
        documentStore,
      );

      const resultContent = result.map((doc) => doc.content);
      const resultIds = result.map((doc) => doc.id);

      // Should include the matched method and find the root namespace despite the gap
      expect(resultContent).toContain(
        "    getUserById(id: string) { return db.find(id); }",
      );
      expect(resultContent).toContain("namespace UserManagement {");
      expect(resultIds).toContain(methodId);
      expect(resultIds).toContain(namespaceId);
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it("should promote deeply nested anonymous functions to their top-level container", async () => {
      // Use the public API to add documents with nested anonymous function
      await documentStore.addDocuments("test-promotion", "1.0", 0, {
        url: "applyMigrations.ts",
        title: "Apply Migrations TypeScript File",
        sourceContentType: "text/typescript",
        contentType: "text/typescript",
        textContent: "",
        chunks: [
          {
            content:
              "export async function applyMigrations(db: Database): Promise<void> {\n  const overallTransaction = db.transaction(() => {\n    console.log('migrating');\n  });\n}",
            section: {
              path: ["applyMigrations"],
              level: 1,
            },
            types: ["code"],
          },
          {
            content: "    console.log('migrating');",
            section: {
              path: ["applyMigrations", "<anonymous_arrow>"],
              level: 2,
            },
            types: ["code"],
          },
        ],
        links: [],
        errors: [],
      });

      // Query the database to get the actual document IDs
      const allChunks = await documentStore.findChunksByUrl(
        "test-promotion",
        "1.0",
        "applyMigrations.ts",
      );
      expect(allChunks.length).toBe(2);

      const topFunctionId = allChunks[0].id;
      const nestedArrowId = allChunks[1].id;

      // Input: search hit on the nested anonymous arrow function
      const inputDoc = allChunks[1];

      const result = await strategy.selectChunks(
        "test-promotion",
        "1.0",
        [inputDoc],
        documentStore,
      );

      const _resultContent = result.map((doc) => doc.content);
      const resultIds = result.map((doc) => doc.id);

      // Should promote to include the entire top-level function that contains the anonymous function
      expect(resultIds).toContain(topFunctionId);
      expect(resultIds).toContain(nestedArrowId);

      const assembled = strategy.assembleContent(result);
      expect(assembled).toMatch(/applyMigrations/);
      expect(assembled).toMatch(/migrating/);
    });

    it("should handle multiple matches with selective subtree reassembly", async () => {
      const versionId = await documentStore.resolveVersionId("test-multi", "1.0");

      expect(versionId).toBeGreaterThan(0);

      // Create a page first via pool query
      const pageResult = await pool.query(
        `INSERT INTO pages (version_id, url, title, source_content_type, content_type, depth)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          versionId,
          "UserService.ts",
          "User Service TypeScript File",
          "text/typescript",
          "text/typescript",
          0,
        ],
      );
      const pageId = pageResult.rows[0].id as number;

      // Class with multiple methods - only some will be matched
      await pool.query(
        `INSERT INTO documents (page_id, content, metadata, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [
          pageId,
          "class UserService {",
          JSON.stringify({
            path: ["UserService", "opening"],
            level: 1,
          } satisfies DbChunkMetadata),
          0,
        ],
      );

      // Method 1: getUser (will be matched)
      const getUserResult = await pool.query(
        `INSERT INTO documents (page_id, content, metadata, sort_order)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [
          pageId,
          "  getUser(id) { return db.find(id); }",
          JSON.stringify({
            path: ["UserService", "opening", "getUser"],
            level: 2,
          } satisfies DbChunkMetadata),
          1,
        ],
      );
      const getUserId = getUserResult.rows[0].id.toString();

      // Method 2: createUser (will NOT be matched)
      await pool.query(
        `INSERT INTO documents (page_id, content, metadata, sort_order)
         VALUES ($1, $2, $3, $4)`,
        [
          pageId,
          "  createUser(data) { return db.create(data); }",
          JSON.stringify({
            path: ["UserService", "opening", "createUser"],
            level: 2,
          } satisfies DbChunkMetadata),
          2,
        ],
      );

      // Method 3: deleteUser (will be matched)
      const deleteUserResult = await pool.query(
        `INSERT INTO documents (page_id, content, metadata, sort_order)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [
          pageId,
          "  deleteUser(id) { return db.delete(id); }",
          JSON.stringify({
            path: ["UserService", "opening", "deleteUser"],
            level: 2,
          } satisfies DbChunkMetadata),
          3,
        ],
      );
      const deleteUserId = deleteUserResult.rows[0].id.toString();

      const inputDocs: DbPageChunk[] = [
        {
          id: getUserId,
          page_id: pageId,
          url: "UserService.ts",
          title: "User Service TypeScript File",
          content_type: "text/typescript",
          content: "  getUser(id) { return db.find(id); }",
          metadata: {
            path: ["UserService", "getUser"],
            level: 2,
          },
          sort_order: 1,
          embedding: null,
          created_at: new Date().toISOString(),
          score: null,
        },
        {
          id: deleteUserId,
          page_id: pageId,
          url: "UserService.ts",
          title: "User Service TypeScript File",
          content_type: "text/typescript",
          content: "  deleteUser(id) { return db.delete(id); }",
          metadata: {
            path: ["UserService", "deleteUser"],
            level: 2,
          },
          sort_order: 3,
          embedding: null,
          created_at: new Date().toISOString(),
          score: null,
        },
      ];

      const result = await strategy.selectChunks(
        "test-multi",
        "1.0",
        inputDocs as DbPageChunk[],
        documentStore,
      );

      const content = result.map((doc) => doc.content);

      // Should include both matched methods
      expect(content).toContain("  getUser(id) { return db.find(id); }");
      expect(content).toContain("  deleteUser(id) { return db.delete(id); }");

      // Should NOT include the unmatched createUser method
      expect(content.some((c) => c.includes("createUser"))).toBe(false);
    });

    it("should handle multiple matches across different documents", async () => {
      const versionId = await documentStore.resolveVersionId("test-cross-doc", "1.0");

      expect(versionId).toBeGreaterThan(0);

      // Create pages first via pool query
      const pageAResult = await pool.query(
        `INSERT INTO pages (version_id, url, title, source_content_type, content_type, depth)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          versionId,
          "FileA.ts",
          "File A TypeScript File",
          "text/typescript",
          "text/typescript",
          0,
        ],
      );
      const pageAId = pageAResult.rows[0].id as number;

      const pageBResult = await pool.query(
        `INSERT INTO pages (version_id, url, title, source_content_type, content_type, depth)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          versionId,
          "FileB.ts",
          "File B TypeScript File",
          "text/typescript",
          "text/typescript",
          0,
        ],
      );
      const pageBId = pageBResult.rows[0].id as number;

      // File A
      const methodAResult = await pool.query(
        `INSERT INTO documents (page_id, content, metadata, sort_order)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [
          pageAId,
          "  methodAlpha() { return 'Alpha'; }",
          JSON.stringify({
            path: ["FileA", "methodAlpha"],
            level: 2,
          } satisfies DbChunkMetadata),
          0,
        ],
      );
      const methodAId = methodAResult.rows[0].id.toString();

      // File B
      const methodBResult = await pool.query(
        `INSERT INTO documents (page_id, content, metadata, sort_order)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [
          pageBId,
          "  methodBeta() { return 'Beta'; }",
          JSON.stringify({
            path: ["FileB", "methodBeta"],
            level: 2,
          } satisfies DbChunkMetadata),
          0,
        ],
      );
      const methodBId = methodBResult.rows[0].id.toString();

      const inputDocs: DbPageChunk[] = [
        {
          id: methodAId,
          page_id: pageAId,
          url: "FileA.ts",
          title: "File A TypeScript File",
          content_type: "text/typescript",
          content: "  methodAlpha() { return 'Alpha'; }",
          metadata: {
            path: ["FileA", "methodAlpha"],
            level: 2,
          },
          sort_order: 0,
          embedding: null,
          created_at: new Date().toISOString(),
          score: null,
        },
        {
          id: methodBId,
          page_id: pageBId,
          url: "FileB.ts",
          title: "File B TypeScript File",
          content_type: "text/typescript",
          content: "  methodBeta() { return 'Beta'; }",
          metadata: {
            path: ["FileB", "methodBeta"],
            level: 2,
          },
          sort_order: 0,
          embedding: null,
          created_at: new Date().toISOString(),
          score: null,
        },
      ];

      const result = await strategy.selectChunks(
        "test-cross-doc",
        "1.0",
        inputDocs,
        documentStore,
      );

      const content = result.map((d) => d.content);
      expect(content).toContain("  methodAlpha() { return 'Alpha'; }");
      expect(content).toContain("  methodBeta() { return 'Beta'; }");
    });
  });

  describe("assembleContent", () => {
    it("should concatenate chunks in document order", () => {
      const chunks: DbPageChunk[] = [
        {
          id: "1",
          content: "class UserService {",
          metadata: {},
        } as DbPageChunk,
        {
          id: "2",
          content: "  getUser() { return 'user'; }",
          metadata: {},
        } as DbPageChunk,
        {
          id: "3",
          content: "}",
          metadata: {},
        } as DbPageChunk,
      ];

      const result = strategy.assembleContent(chunks);
      expect(result).toBe("class UserService {  getUser() { return 'user'; }}");
    });

    it("should handle empty array gracefully", () => {
      const result = strategy.assembleContent([]);
      expect(result).toBe("");
    });

    it("should provide debug output when requested", () => {
      const chunks: DbPageChunk[] = [
        {
          id: "1",
          content: "function test() {",
          metadata: { path: ["test"], level: 0 },
        } as DbPageChunk,
        {
          id: "2",
          content: "  return 42;",
          metadata: { path: ["test", "return"], level: 1 },
        } as DbPageChunk,
      ];

      const result = strategy.assembleContent(chunks, true);
      expect(result).toContain("=== #1");
      expect(result).toContain("=== #2");
      expect(result).toContain("function test() {");
      expect(result).toContain("  return 42;");
    });
  });
});
