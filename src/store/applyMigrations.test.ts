// Integration test for database migrations using a real PostgreSQL database

import { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolvePgBaseUrl } from "../../test/test-helpers";
import { applyMigrations } from "./applyMigrations";
import { PostgresConnection } from "./PostgresConnection";

const PG_BASE_URL = resolvePgBaseUrl();

/** Creates a unique test database and returns connection + cleanup. */
async function createTestDatabase(): Promise<{
  connection: PostgresConnection;
  cleanup: () => Promise<void>;
}> {
  const adminPool = new Pool({ connectionString: PG_BASE_URL, max: 5 });
  const dbName = `test_migrations_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await adminPool.query(`CREATE DATABASE "${dbName}"`);
  await adminPool.end();

  const url = PG_BASE_URL.replace(/\/[^/]*$/, `/${dbName}`);
  const connection = new PostgresConnection(url, { max: 5, min: 1 });
  await connection.initialize();

  return {
    connection,
    cleanup: async () => {
      await connection.close();
      const dropPool = new Pool({ connectionString: PG_BASE_URL, max: 5 });
      await dropPool.query(`DROP DATABASE IF EXISTS "${dbName}"`);
      await dropPool.end();
    },
  };
}

/** Helper: get table names in the public schema. */
async function getTableNames(pool: Pool): Promise<string[]> {
  const result = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
  );
  return result.rows.map((r: { table_name: string }) => r.table_name);
}

/** Helper: get column names for a table. */
async function getColumnNames(pool: Pool, tableName: string): Promise<string[]> {
  const result = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position",
    [tableName],
  );
  return result.rows.map((r: { column_name: string }) => r.column_name);
}

/** Helper: get index names for a table. */
async function getIndexNames(pool: Pool, tableName: string): Promise<string[]> {
  const result = await pool.query(
    "SELECT indexname FROM pg_indexes WHERE tablename = $1 ORDER BY indexname",
    [tableName],
  );
  return result.rows.map((r: { indexname: string }) => r.indexname);
}

describe("Database Migrations", () => {
  let connection: PostgresConnection;
  let pool: Pool;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    connection = testDb.connection;
    cleanup = testDb.cleanup;
    pool = connection.getPool();
  });

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
    }
  });

  it("should apply all migrations and create expected tables and columns", async () => {
    await expect(applyMigrations(connection)).resolves.not.toThrow();

    // Check tables
    const tableNames = await getTableNames(pool);
    expect(tableNames).toContain("documents");
    expect(tableNames).toContain("libraries");
    expect(tableNames).toContain("metadata");
    expect(tableNames).toContain("pages");
    expect(tableNames).toContain("versions");
    expect(tableNames).toContain("_schema_migrations");

    // Check columns for 'documents'
    const documentsColumnNames = await getColumnNames(pool, "documents");
    expect(documentsColumnNames).toEqual(
      expect.arrayContaining([
        "id",
        "page_id",
        "content",
        "metadata",
        "sort_order",
        "embedding",
        "created_at",
      ]),
    );

    // Check columns for 'pages'
    const pagesColumnNames = await getColumnNames(pool, "pages");
    expect(pagesColumnNames).toEqual(
      expect.arrayContaining([
        "id",
        "version_id",
        "url",
        "title",
        "etag",
        "last_modified",
        "source_content_type",
        "content_type",
        "depth",
        "created_at",
        "updated_at",
      ]),
    );

    // Check columns for 'libraries'
    const librariesColumnNames = await getColumnNames(pool, "libraries");
    expect(librariesColumnNames).toEqual(
      expect.arrayContaining(["id", "name", "created_at"]),
    );

    // Check columns for 'versions'
    const versionsColumnNames = await getColumnNames(pool, "versions");
    expect(versionsColumnNames).toEqual(
      expect.arrayContaining([
        "id",
        "library_id",
        "name",
        "status",
        "source_url",
        "created_at",
        "updated_at",
      ]),
    );

    // Check columns for 'metadata'
    const metadataColumnNames = await getColumnNames(pool, "metadata");
    expect(metadataColumnNames).toEqual(expect.arrayContaining(["key", "value"]));

    // Check that the embedding column uses VECTOR(1536)
    const embeddingResult = await pool.query(
      "SELECT udt_name, character_maximum_length FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'embedding'",
    );
    expect(embeddingResult.rows).toHaveLength(1);
    // pgvector stores type info differently - verify via pg_attribute
    const vectorCheck = await pool.query(
      `SELECT t.typname FROM pg_attribute a JOIN pg_type t ON a.atttypid = t.oid JOIN pg_class c ON a.attrelid = c.oid JOIN pg_namespace n ON c.relnamespace = n.oid WHERE n.nspname = 'public' AND c.relname = 'documents' AND a.attname = 'embedding'`,
    );
    expect(vectorCheck.rows[0]?.typname).toBe("vector");
  });

  it("should create expected indexes", async () => {
    await applyMigrations(connection);

    // Check key indexes exist
    const docIndexes = await getIndexNames(pool, "documents");
    expect(docIndexes).toEqual(
      expect.arrayContaining([
        "documents_pkey",
        "idx_documents_page_id",
        "idx_documents_sort_order",
        "idx_documents_fts",
        "idx_documents_embedding_hnsw",
      ]),
    );

    const versionIndexes = await getIndexNames(pool, "versions");
    expect(versionIndexes).toEqual(
      expect.arrayContaining([
        "versions_pkey",
        "idx_versions_library_id",
        "idx_versions_status",
      ]),
    );

    const pageIndexes = await getIndexNames(pool, "pages");
    expect(pageIndexes).toEqual(
      expect.arrayContaining([
        "pages_pkey",
        "idx_pages_version_id",
        "idx_pages_url",
        "idx_pages_etag",
      ]),
    );

    const libraryIndexes = await getIndexNames(pool, "libraries");
    expect(libraryIndexes).toEqual(
      expect.arrayContaining(["libraries_pkey", "idx_libraries_name_lower"]),
    );
  });

  it("should track applied migrations in _schema_migrations table", async () => {
    await applyMigrations(connection);

    const result = await pool.query("SELECT id FROM _schema_migrations ORDER BY id");
    const appliedIds = result.rows.map((r: { id: string }) => r.id);

    expect(appliedIds).toEqual(
      expect.arrayContaining([
        "000-initial-schema.sql",
        "001-gin-fts-indexes.sql",
        "002-hnsw-vector-index.sql",
        "003-metadata-table.sql",
        "004-fix-schema-mismatch.sql",
      ]),
    );
    expect(appliedIds).toHaveLength(5);
  });

  it("should be idempotent — re-running migrations does not fail", async () => {
    await applyMigrations(connection);
    await expect(applyMigrations(connection)).resolves.not.toThrow();

    // Verify migrations table still has exactly 5 entries (000-004)
    const result = await pool.query("SELECT COUNT(*) as count FROM _schema_migrations");
    expect(Number(result.rows[0].count)).toBe(5);
  });

  it("should support basic CRUD operations on the schema", async () => {
    await applyMigrations(connection);

    // Insert a library
    await pool.query("INSERT INTO libraries (name) VALUES ($1) RETURNING id", [
      "test-lib",
    ]);
    const libraryResult = await pool.query(
      "SELECT id, name FROM libraries WHERE name = $1",
      ["test-lib"],
    );
    expect(libraryResult.rows).toHaveLength(1);
    const libraryId = libraryResult.rows[0].id;

    // Insert a version
    await pool.query(
      "INSERT INTO versions (library_id, name, status) VALUES ($1, $2, $3) RETURNING id",
      [libraryId, "1.0.0", "not_indexed"],
    );
    const versionResult = await pool.query(
      "SELECT id FROM versions WHERE library_id = $1 AND name = $2",
      [libraryId, "1.0.0"],
    );
    expect(versionResult.rows).toHaveLength(1);
    const versionId = versionResult.rows[0].id;

    // Insert a page
    await pool.query(
      "INSERT INTO pages (version_id, url, title, source_content_type, content_type) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [versionId, "https://example.com/doc1", "Test Page", "text/html", "text/html"],
    );
    const pageResult = await pool.query("SELECT id FROM pages WHERE version_id = $1", [
      versionId,
    ]);
    expect(pageResult.rows).toHaveLength(1);
    const pageId = pageResult.rows[0].id;

    // Insert a document with embedding
    const embedding = new Array(1536).fill(0);
    await pool.query(
      "INSERT INTO documents (page_id, content, metadata, sort_order, embedding) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [
        pageId,
        "Test content",
        JSON.stringify({ title: "Test" }),
        1,
        `[${embedding.join(",")}]`,
      ],
    );
    const docResult = await pool.query(
      "SELECT id, content FROM documents WHERE page_id = $1",
      [pageId],
    );
    expect(docResult.rows).toHaveLength(1);
    expect(docResult.rows[0].content).toBe("Test content");
  });

  it("should support vector similarity search via pgvector", async () => {
    await applyMigrations(connection);

    // Insert test data
    await pool.query("INSERT INTO libraries (name) VALUES ($1) RETURNING id", [
      "vec-lib",
    ]);
    const libResult = await pool.query("SELECT id FROM libraries WHERE name = $1", [
      "vec-lib",
    ]);
    const libraryId = libResult.rows[0].id;

    await pool.query(
      "INSERT INTO versions (library_id, name, status) VALUES ($1, $2, $3) RETURNING id",
      [libraryId, "1.0.0", "indexed"],
    );
    const verResult = await pool.query(
      "SELECT id FROM versions WHERE library_id = $1 AND name = $2",
      [libraryId, "1.0.0"],
    );
    const versionId = verResult.rows[0].id;

    await pool.query(
      "INSERT INTO pages (version_id, url, title, source_content_type, content_type) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [versionId, "https://example.com/doc1", "AI Doc", "text/html", "text/html"],
    );
    const pageResult = await pool.query("SELECT id FROM pages WHERE version_id = $1", [
      versionId,
    ]);
    const pageId = pageResult.rows[0].id;

    // Insert document with embedding (all 0.9s)
    const vector = new Array(1536).fill(0.9);
    await pool.query(
      "INSERT INTO documents (page_id, content, metadata, sort_order, embedding) VALUES ($1, $2, $3, $4, $5)",
      [
        pageId,
        "AI content",
        JSON.stringify({ title: "AI Doc" }),
        1,
        `[${vector.join(",")}]`,
      ],
    );

    // Search with similar vector
    const searchVector = new Array(1536).fill(0.85);
    const searchResult = await pool.query(
      `SELECT d.id, d.content, d.embedding <=> $1::vector AS distance
       FROM documents d
       JOIN pages p ON d.page_id = p.id
       JOIN versions v ON p.version_id = v.id
       WHERE v.library_id = $2
       ORDER BY distance ASC
       LIMIT 5`,
      [`[${searchVector.join(",")}]`, libraryId],
    );

    expect(searchResult.rows).toHaveLength(1);
    expect(searchResult.rows[0].content).toBe("AI content");
    expect(Number(searchResult.rows[0].distance)).toBeGreaterThanOrEqual(0);
  });

  it("should support full-text search via PostgreSQL tsvector", async () => {
    await applyMigrations(connection);

    // Insert test data
    await pool.query("INSERT INTO libraries (name) VALUES ($1)", ["fts-lib"]);
    const libResult = await pool.query("SELECT id FROM libraries WHERE name = $1", [
      "fts-lib",
    ]);
    const libraryId = libResult.rows[0].id;

    await pool.query(
      "INSERT INTO versions (library_id, name, status) VALUES ($1, $2, $3)",
      [libraryId, "1.0.0", "indexed"],
    );
    const verResult = await pool.query(
      "SELECT id FROM versions WHERE library_id = $1 AND name = $2",
      [libraryId, "1.0.0"],
    );
    const versionId = verResult.rows[0].id;

    await pool.query(
      "INSERT INTO pages (version_id, url, title, source_content_type, content_type) VALUES ($1, $2, $3, $4, $5)",
      [versionId, "https://example.com/react", "React Hooks", "text/html", "text/html"],
    );
    const pageResult = await pool.query("SELECT id FROM pages WHERE version_id = $1", [
      versionId,
    ]);
    const pageId = pageResult.rows[0].id;

    await pool.query(
      "INSERT INTO documents (page_id, content, metadata, sort_order) VALUES ($1, $2, $3, $4)",
      [
        pageId,
        "React hooks are a powerful feature for state management in functional components",
        JSON.stringify({ title: "React Hooks", path: "/react/hooks" }),
        1,
      ],
    );

    // FTS search using to_tsvector and to_tsquery
    const ftsResult = await pool.query(
      `SELECT d.id, d.content, ts_rank(to_tsvector('english', d.content), to_tsquery('english', $1)) AS rank
       FROM documents d
       JOIN pages p ON d.page_id = p.id
       JOIN versions v ON p.version_id = v.id
       WHERE v.library_id = $2
       AND to_tsvector('english', d.content) @@ to_tsquery('english', $1)
       ORDER BY rank DESC`,
      ["react & hooks", libraryId],
    );

    expect(ftsResult.rows).toHaveLength(1);
    expect(ftsResult.rows[0].content).toContain("React hooks");
    expect(Number(ftsResult.rows[0].rank)).toBeGreaterThan(0);
  });

  it("should enforce foreign key cascades", async () => {
    await applyMigrations(connection);

    // Insert library → version → page → document chain
    await pool.query("INSERT INTO libraries (name) VALUES ($1) RETURNING id", [
      "cascade-lib",
    ]);
    const libResult = await pool.query("SELECT id FROM libraries WHERE name = $1", [
      "cascade-lib",
    ]);
    const libraryId = libResult.rows[0].id;

    await pool.query(
      "INSERT INTO versions (library_id, name, status) VALUES ($1, $2, $3) RETURNING id",
      [libraryId, "1.0.0", "indexed"],
    );
    const verResult = await pool.query("SELECT id FROM versions WHERE library_id = $1", [
      libraryId,
    ]);
    const versionId = verResult.rows[0].id;

    await pool.query(
      "INSERT INTO pages (version_id, url, title, source_content_type, content_type) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [versionId, "https://example.com/page", "Page", "text/html", "text/html"],
    );
    const pageResult = await pool.query("SELECT id FROM pages WHERE version_id = $1", [
      versionId,
    ]);
    const pageId = pageResult.rows[0].id;

    await pool.query(
      "INSERT INTO documents (page_id, content, metadata, sort_order) VALUES ($1, $2, $3, $4)",
      [pageId, "Content", "{}", 1],
    );

    // Verify document exists
    let docCount = await pool.query("SELECT COUNT(*) as count FROM documents");
    expect(Number(docCount.rows[0].count)).toBe(1);

    // Delete library — should cascade through versions → pages → documents
    await pool.query("DELETE FROM libraries WHERE id = $1", [libraryId]);

    docCount = await pool.query("SELECT COUNT(*) as count FROM documents");
    expect(Number(docCount.rows[0].count)).toBe(0);

    const verCount = await pool.query("SELECT COUNT(*) as count FROM versions");
    expect(Number(verCount.rows[0].count)).toBe(0);

    const pageCount = await pool.query("SELECT COUNT(*) as count FROM pages");
    expect(Number(pageCount.rows[0].count)).toBe(0);
  });
});
