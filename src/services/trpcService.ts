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
import { getCacheService } from "./CacheService.js";

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

export async function registerTrpcService(
  server: FastifyInstance,
  pipeline: IPipeline,
  docService: IDocumentManagement,
): Promise<void> {
  server.addHook("preHandler", async (request, reply) => {
    if (request.url.includes("listLibraries")) {
      const clientEtag = request.headers["if-none-match"];
      const entry = getCacheService().get("libraries:list");

      if (entry && clientEtag === entry.etag) {
        reply.code(304).send("");
        return reply;
      }
    }
  });

  server.addHook("onSend", async (request, reply, payload) => {
    if (request.url.includes("listLibraries")) {
      const entry = getCacheService().get("libraries:list");
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
