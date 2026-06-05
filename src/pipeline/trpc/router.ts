/**
 * tRPC router exposing pipeline procedures for external workers.
 * Provides a minimal RPC surface to replace legacy REST endpoints.
 *
 * This module now exports a factory to build the router from a provided t instance,
 * allowing us to compose multiple routers under a single /api endpoint.
 */

import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import { ScrapeMode } from "../../scraper/types";
import { PipelineJobStatus } from "../types";
import type { IPipeline } from "./interfaces";

// Context carries the pipeline instance
export interface PipelineTrpcContext {
  pipeline: IPipeline;
}

const t = initTRPC.context<PipelineTrpcContext>().create({
  transformer: superjson,
});

// Schemas
const nonEmptyTrimmed = z
  .string()
  .transform((s) => s.trim())
  .refine((s) => s.length > 0, "must not be empty");

const optionalTrimmed = z.preprocess(
  (v) => (typeof v === "string" ? v.trim() : v),
  z.string().min(1).optional().nullable(),
);

/**
 * Schema validating serializable ScraperOptions fields at the tRPC boundary.
 * Ensures required fields are present and optional fields match expected types.
 * Runtime-only fields (signal, initialQueue) are excluded as they cannot be transported via RPC.
 */
export const scraperOptionsInputSchema = z.object({
  url: z.string().min(1),
  library: z.string().min(1),
  version: z.string(),
  maxPages: z.number().int().positive().optional(),
  maxDepth: z.number().int().nonnegative().optional(),
  scope: z.enum(["subpages", "hostname", "domain"]).optional(),
  followRedirects: z.boolean().optional(),
  maxConcurrency: z.number().int().positive().optional(),
  ignoreErrors: z.boolean().optional(),
  excludeSelectors: z.array(z.string()).optional(),
  includePatterns: z.array(z.string()).optional(),
  excludePatterns: z.array(z.string()).optional(),
  scrapeMode: z.nativeEnum(ScrapeMode).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  isRefresh: z.boolean().optional(),
  clear: z.boolean().optional(),
  preserveHashes: z.boolean().optional(),
  localImportStagingPath: z.string().min(1).optional(),
});

const enqueueScrapeInput = z.object({
  library: nonEmptyTrimmed,
  version: optionalTrimmed,
  options: scraperOptionsInputSchema,
});

const enqueueRefreshInput = z.object({
  library: nonEmptyTrimmed,
  version: optionalTrimmed,
});

const jobIdInput = z.object({ id: z.string().min(1) });

const getJobsInput = z.object({
  status: z.nativeEnum(PipelineJobStatus).optional(),
});

// Factory to create a pipeline router from any t instance whose context contains `pipeline`
export function createPipelineRouter(trpc: unknown) {
  const tt = trpc as typeof t;
  return tt.router({
    ping: tt.procedure.query(async () => ({ status: "ok", ts: Date.now() })),

    enqueueScrapeJob: tt.procedure
      .input(enqueueScrapeInput)
      .mutation(
        async ({
          ctx,
          input,
        }: {
          ctx: PipelineTrpcContext;
          input: z.infer<typeof enqueueScrapeInput>;
        }) => {
          const jobId = await ctx.pipeline.enqueueScrapeJob(
            input.library,
            input.version ?? null,
            input.options,
          );

          return { jobId };
        },
      ),

    enqueueRefreshJob: tt.procedure
      .input(enqueueRefreshInput)
      .mutation(
        async ({
          ctx,
          input,
        }: {
          ctx: PipelineTrpcContext;
          input: z.infer<typeof enqueueRefreshInput>;
        }) => {
          const jobId = await ctx.pipeline.enqueueRefreshJob(
            input.library,
            input.version ?? null,
          );

          return { jobId };
        },
      ),

    getJob: tt.procedure
      .input(jobIdInput)
      .query(
        async ({
          ctx,
          input,
        }: {
          ctx: PipelineTrpcContext;
          input: z.infer<typeof jobIdInput>;
        }) => {
          return ctx.pipeline.getJob(input.id);
        },
      ),

    getJobs: tt.procedure
      .input(getJobsInput.optional())
      .query(
        async ({
          ctx,
          input,
        }: {
          ctx: PipelineTrpcContext;
          input: z.infer<typeof getJobsInput> | undefined;
        }) => {
          const jobs = await ctx.pipeline.getJobs(input?.status);
          return { jobs };
        },
      ),

    cancelJob: tt.procedure
      .input(jobIdInput)
      .mutation(
        async ({
          ctx,
          input,
        }: {
          ctx: PipelineTrpcContext;
          input: z.infer<typeof jobIdInput>;
        }) => {
          await ctx.pipeline.cancelJob(input.id);
          return { success: true } as const;
        },
      ),

    clearCompletedJobs: tt.procedure.mutation(
      async ({ ctx }: { ctx: PipelineTrpcContext }) => {
        const count = await ctx.pipeline.clearCompletedJobs();
        return { count };
      },
    ),
  });
}

// Default router for standalone usage (keeps existing imports working)
export const pipelineRouter = createPipelineRouter(t);

export type PipelineRouter = typeof pipelineRouter;
