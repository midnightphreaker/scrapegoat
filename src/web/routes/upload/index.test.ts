import archiver from "archiver";
import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { IPipeline } from "../../../pipeline/trpc/interfaces";
import type { IDocumentManagement } from "../../../store/trpc/interfaces";
import { registerUploadRoutes } from "./index";

/** Minimal stub satisfying the IPipeline interface for route registration. */
function createPipelineStub(): IPipeline {
  return {
    enqueueScrapeJob: async () => `job-${Date.now()}`,
    getJob: () => undefined,
    waitForJobCompletion: () => new Promise(() => {}),
    cancelJob: async () => {},
    listJobs: () => [],
    getJobStatus: () => "unknown",
    getJobResult: () => undefined,
    stop: async () => {},
  } as unknown as IPipeline;
}

/** Minimal stub satisfying the IDocumentManagement interface for route registration. */
function createDocManagementStub(): IDocumentManagement {
  return {
    versionExists: async () => false,
  } as unknown as IDocumentManagement;
}

async function createZipBuffer(entries: Record<string, string>): Promise<Buffer> {
  const archive = archiver("zip", { zlib: { level: 9 } });
  const chunks: Buffer[] = [];

  archive.on("data", (chunk: Buffer) => chunks.push(chunk));

  for (const [name, content] of Object.entries(entries)) {
    archive.append(content, { name });
  }

  await archive.finalize();

  return Buffer.concat(chunks);
}

function createMultipartFilePayload(
  fieldName: string,
  filename: string,
  contentType: string,
  content: Buffer,
): { boundary: string; payload: Buffer } {
  const boundary = `----scrapegoat-test-${Date.now()}`;
  const header = Buffer.from(
    [
      `--${boundary}`,
      `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"`,
      `Content-Type: ${contentType}`,
      "",
      "",
    ].join("\r\n"),
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);

  return {
    boundary,
    payload: Buffer.concat([header, content, footer]),
  };
}

describe("Upload routes", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = Fastify({ logger: false });
    await registerUploadRoutes(server, createPipelineStub(), createDocManagementStub());
  });

  afterAll(async () => {
    await server.close();
  });

  it("requires a version when starting an upload session", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/web/upload/start",
      payload: { library: "missing-version" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: string }>().error).toBe("version is required");
  });

  it("accepts repeated upload session starts", async () => {
    const totalRequests = 11;
    let lastStatus = 0;

    for (let i = 0; i < totalRequests; i++) {
      const response = await server.inject({
        method: "POST",
        url: "/web/upload/start",
        payload: { library: `upload-session-${i}`, version: `${i}.0.0` },
      });
      lastStatus = response.statusCode;
    }

    expect(lastStatus).toBe(200);
  });

  it("extracts uploaded archives into the import tree", async () => {
    const startResponse = await server.inject({
      method: "POST",
      url: "/web/upload/start",
      payload: { library: "archive-upload-route-test", version: "1.0" },
    });
    const { sessionId } = startResponse.json<{ sessionId: string }>();
    const archiveBuffer = await createZipBuffer({
      "guide/intro.md": "# Intro",
      "guide/reference/api.md": "# API",
    });
    const { boundary, payload } = createMultipartFilePayload(
      "files",
      "docs.zip",
      "application/zip",
      archiveBuffer,
    );

    const uploadResponse = await server.inject({
      method: "POST",
      url: `/web/upload/files?sessionId=${encodeURIComponent(sessionId)}`,
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });

    expect(uploadResponse.statusCode).toBe(200);
    const uploadBody = uploadResponse.json<{
      stagedFiles: Array<{ path: string; fromArchive: boolean }>;
      errors: Array<{ path: string; error: string }>;
    }>();
    expect(uploadBody.errors).toEqual([]);
    expect(uploadBody.stagedFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "guide/intro.md",
          fromArchive: true,
        }),
        expect.objectContaining({
          path: "guide/reference/api.md",
          fromArchive: true,
        }),
      ]),
    );

    const treeResponse = await server.inject({
      method: "GET",
      url: `/web/upload/tree?sessionId=${encodeURIComponent(sessionId)}`,
    });
    const treeBody = treeResponse.json<{
      tree: Array<{ name: string; children?: Array<{ name: string }> }>;
    }>();

    expect(JSON.stringify(treeBody.tree)).toContain("guide");
    expect(JSON.stringify(treeBody.tree)).toContain("intro.md");
    expect(JSON.stringify(treeBody.tree)).toContain("api.md");
  });
});
