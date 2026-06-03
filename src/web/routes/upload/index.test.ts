/**
 * Tests for upload route rate limiting.
 *
 * Validates that the upload endpoints enforce per-IP rate limiting
 * using @fastify/rate-limit, returning HTTP 429 when the threshold is exceeded.
 */

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

describe("Upload route rate limiting", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = Fastify({ logger: false });
    await registerUploadRoutes(server, createPipelineStub(), createDocManagementStub());
  });

  afterAll(async () => {
    await server.close();
  });

  it("should return 429 after exceeding the rate limit", async () => {
    // The rate limit is 10 requests per minute per IP.
    // We send 11 rapid requests and expect the last one to be rejected with 429.
    const totalRequests = 11;
    let lastStatus = 0;

    for (let i = 0; i < totalRequests; i++) {
      const response = await server.inject({
        method: "POST",
        url: "/web/upload/start",
        payload: { library: "rate-limit-test" },
      });
      lastStatus = response.statusCode;
    }

    expect(lastStatus).toBe(429);
  });
});
