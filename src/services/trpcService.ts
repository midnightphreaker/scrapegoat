/**
 * Fastify service to register unified tRPC API at /api.
 * Merges pipeline and data store routers under a single endpoint.
 */

import { initTRPC } from "@trpc/server";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import type { FastifyInstance } from "fastify";
import type { IPipeline } from "../pipeline/trpc/interfaces";
import { createPipelineRouter, type PipelineTrpcContext } from "../pipeline/trpc/router";
import type { IDocumentManagement } from "../store/trpc/interfaces";
import { createDataRouter, type DataTrpcContext } from "../store/trpc/router";
import { type CacheEntry, getCacheService } from "./CacheService.js";

type UnifiedContext = PipelineTrpcContext & DataTrpcContext;

const t = initTRPC.context<UnifiedContext>().create();

const healthRouter = t.router({
  ping: t.procedure.query(async () => ({ status: "ok", ts: Date.now() })),
});

export const appRouter = t.mergeRouters(
  healthRouter,
  createPipelineRouter(t),
  createDataRouter(t),
);

export type AppRouter = typeof appRouter;

function isLibrariesListRequest(url: string): boolean {
  return url.includes("/api/trpc/listLibraries") || url.includes("trpc/listLibraries?");
}

export async function registerTrpcService(
  server: FastifyInstance,
  pipeline: IPipeline,
  docService: IDocumentManagement,
): Promise<void> {
  server.addHook("preHandler", async (request, reply) => {
    if (isLibrariesListRequest(request.url)) {
      const clientEtag = request.headers["if-none-match"];
      let entry: CacheEntry<unknown> | null | undefined;
      try {
        entry = getCacheService().get("libraries:list");
      } catch {
        // Cache error - proceed without ETag, don't fail the request
      }

      if (entry && clientEtag === entry.etag) {
        reply.code(304).send("");
        return reply;
      }
    }
  });

  server.addHook("onSend", async (request, reply, payload) => {
    if (isLibrariesListRequest(request.url)) {
      let entry: CacheEntry<unknown> | null | undefined;
      try {
        entry = getCacheService().get("libraries:list");
      } catch {
        // Cache error - proceed without ETag headers
        return payload;
      }
      if (entry) {
        reply.header("ETag", entry.etag);
        reply.header("Cache-Control", "public, max-age=300");
        reply.header("Vary", "Accept-Encoding");
      }
    }
    return payload;
  });

  await server.register(fastifyTRPCPlugin, {
    prefix: "/api/trpc",
    trpcOptions: {
      router: appRouter,
      createContext: async (): Promise<UnifiedContext> => ({ pipeline, docService }),
    },
  });
}
