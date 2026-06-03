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

describe("Upload routes", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = Fastify({ logger: false });
    await registerUploadRoutes(server, createPipelineStub(), createDocManagementStub());
  });

  afterAll(async () => {
    await server.close();
  });

  it("accepts repeated upload session starts", async () => {
    const totalRequests = 11;
    let lastStatus = 0;

    for (let i = 0; i < totalRequests; i++) {
      const response = await server.inject({
        method: "POST",
        url: "/web/upload/start",
        payload: { library: `upload-session-${i}` },
      });
      lastStatus = response.statusCode;
    }

    expect(lastStatus).toBe(200);
  });
});
