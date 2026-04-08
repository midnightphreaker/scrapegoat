/**
 * Ensures embeddings are persisted into the documents table with vector column.
 *
 * This test is self-contained:
 * - Uses a real PostgreSQL database
 * - Uses MSW to mock OpenAI embeddings so it does not require network access
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { Pool } from "pg";
import { config } from "dotenv";
import { ScrapeTool } from "../src/tools/ScrapeTool";
import { createLocalDocumentManagement } from "../src/store";
import { PipelineFactory } from "../src/pipeline/PipelineFactory";
import {
  EmbeddingConfig,
  type EmbeddingModelConfig,
} from "../src/store/embeddings/EmbeddingConfig";
import { EventBusService } from "../src/events";
import { loadConfig } from "../src/utils/config";

config();

const PG_BASE_URL =
  process.env.DATABASE_URL || "postgresql://docs:docs@localhost:5432/docs";

async function createTestDatabase(): Promise<{
  url: string;
  cleanup: () => Promise<void>;
}> {
  const adminPool = new Pool({ connectionString: PG_BASE_URL, max: 5 });
  const dbName = `test_vec_persist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await adminPool.query(`CREATE DATABASE "${dbName}"`);
  await adminPool.end();
  return {
    url: `postgresql://docs:docs@localhost:5432/${dbName}`,
    cleanup: async () => {
      const dropPool = new Pool({ connectionString: PG_BASE_URL, max: 5 });
      await dropPool.query(`DROP DATABASE IF EXISTS "${dbName}"`);
      await dropPool.end();
    },
  };
}

describe("Vector persistence", () => {
  let pipeline: any;
  let docService: any;
  let scrapeTool: ScrapeTool;
  let testDbUrl: string;
  let testDbCleanup: () => Promise<void>;
  const appConfig = loadConfig();

  let prevOpenAiApiKey: string | undefined;
  let prevOpenAiApiBase: string | undefined;
  let prevDatabaseUrl: string | undefined;

  beforeAll(async () => {
    prevOpenAiApiKey = process.env.OPENAI_API_KEY;
    prevOpenAiApiBase = process.env.OPENAI_API_BASE;
    prevDatabaseUrl = process.env.DATABASE_URL;

    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "test-key";
    delete process.env.OPENAI_API_BASE;

    const testDb = await createTestDatabase();
    testDbUrl = testDb.url;
    testDbCleanup = testDb.cleanup;
    process.env.DATABASE_URL = testDbUrl;

    const embeddingConfig: EmbeddingModelConfig = EmbeddingConfig.parseEmbeddingConfig(
      "openai:text-embedding-3-small",
    );

    appConfig.app.embeddingModel = embeddingConfig.modelSpec;
    appConfig.database.url = testDbUrl;

    const eventBus = new EventBusService();
    docService = await createLocalDocumentManagement(eventBus, appConfig);

    pipeline = await PipelineFactory.createPipeline(docService, eventBus, {
      appConfig,
    });
    await pipeline.start();

    scrapeTool = new ScrapeTool(pipeline, appConfig.scraper);
  }, 30000);

  afterAll(async () => {
    if (pipeline) {
      await pipeline.stop();
    }
    if (docService) {
      await docService.shutdown();
    }
    if (testDbCleanup) {
      await testDbCleanup();
    }

    if (prevOpenAiApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = prevOpenAiApiKey;
    }

    if (prevOpenAiApiBase === undefined) {
      delete process.env.OPENAI_API_BASE;
    } else {
      process.env.OPENAI_API_BASE = prevOpenAiApiBase;
    }

    if (prevDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = prevDatabaseUrl;
    }
  });

  it(
    "persists embeddings into documents table",
    async () => {
      const readmePath = path.resolve(process.cwd(), "README.md");
      const fileUrl = `file://${readmePath}`;

      await scrapeTool.execute({
        library: "vector-persist-lib",
        version: "1.0.0",
        url: fileUrl,
        waitForCompletion: true,
      });

      const exists = await docService.exists("vector-persist-lib", "1.0.0");
      expect(exists).toBe(true);

      const pool = new Pool({ connectionString: testDbUrl, max: 5 });

      try {
        const chunkResult = await pool.query(
          "SELECT COUNT(*) as chunk_count FROM documents WHERE embedding IS NOT NULL",
        );
        const chunkCount = Number(chunkResult.rows[0].chunk_count);
        expect(chunkCount).toBeGreaterThan(0);
      } finally {
        await pool.end();
      }
    },
    60000,
  );
});
