/**
 * tRPC router exposing document data store operations via the worker API.
 * Only procedures actually used externally are included to keep surface minimal.
 */
import { initTRPC } from "@trpc/server";
import { z } from "zod";
import { cacheMiddleware } from "../../middleware/cacheMiddleware.js";
import { getCacheService } from "../../services/CacheService.js";
import { analytics, TelemetryEvent } from "../../telemetry";
import type {
  DbVersionWithLibrary,
  FindVersionResult,
  StoreSearchResult,
  VersionStatus,
} from "../types";
import type { IDocumentManagement } from "./interfaces";

export function invalidateLibrariesCache(): void {
  getCacheService().invalidate("libraries:*");
}

// Context carries the document management API
export interface DataTrpcContext {
  docService: IDocumentManagement;
}

const t = initTRPC.context<DataTrpcContext>().create();

// Common schemas
const nonEmpty = z
  .string()
  .min(1)
  .transform((s) => s.trim());
const optionalVersion = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (typeof v === "string" ? v.trim() : v));

export function createDataRouter(trpc: unknown) {
  const tt = trpc as typeof t;
  const cache = getCacheService();
  const cachedProcedure = tt.procedure.use(
    cacheMiddleware({
      cache,
      cacheKey: "libraries:list",
      ttl: 300000,
    }),
  );

  return tt.router({
    listLibraries: cachedProcedure.query(async (opts) => {
      return await opts.ctx.docService.listLibraries();
    }),

    findBestVersion: tt.procedure
      .input(z.object({ library: nonEmpty, targetVersion: z.string().optional() }))
      .query(async (opts) => {
        const result = await opts.ctx.docService.findBestVersion(
          opts.input.library,
          opts.input.targetVersion,
        );
        return result as FindVersionResult;
      }),

    validateLibraryExists: tt.procedure
      .input(z.object({ library: nonEmpty }))
      .mutation(async (opts) => {
        await opts.ctx.docService.validateLibraryExists(opts.input.library);
        return { ok: true } as const;
      }),

    search: tt.procedure
      .input(
        z.object({
          library: nonEmpty,
          version: optionalVersion,
          query: nonEmpty,
          limit: z.number().int().positive().max(50).optional(),
        }),
      )
      .query(async (opts) => {
        const results = await opts.ctx.docService.searchStore(
          opts.input.library,
          opts.input.version ?? null,
          opts.input.query,
          opts.input.limit ?? 5,
        );

        // Track Web UI search
        analytics.track(TelemetryEvent.WEB_SEARCH_PERFORMED, {
          library: opts.input.library,
          version: opts.input.version || undefined,
          queryLength: opts.input.query.length,
          resultCount: results.length,
          limit: opts.input.limit ?? 5,
        });

        return results as StoreSearchResult[];
      }),

    removeVersion: tt.procedure
      .input(z.object({ library: nonEmpty, version: optionalVersion }))
      .mutation(async (opts) => {
        await opts.ctx.docService.removeVersion(
          opts.input.library,
          opts.input.version ?? null,
        );
        invalidateLibrariesCache();
        return { ok: true } as const;
      }),

    removeAllDocuments: tt.procedure
      .input(z.object({ library: nonEmpty, version: optionalVersion }))
      .mutation(async (opts) => {
        await opts.ctx.docService.removeAllDocuments(
          opts.input.library,
          opts.input.version ?? null,
        );
        invalidateLibrariesCache();
        return { ok: true } as const;
      }),

    // Status and version helpers

    getVersionsByStatus: tt.procedure
      .input(z.object({ statuses: z.array(z.string()) }))
      .query(async (opts) => {
        // Cast trusting caller to pass valid VersionStatus strings
        const statuses = opts.input.statuses as VersionStatus[];
        return (await opts.ctx.docService.getVersionsByStatus(
          statuses,
        )) as DbVersionWithLibrary[];
      }),

    findVersionsBySourceUrl: tt.procedure
      .input(z.object({ url: nonEmpty }))
      .query(async (opts) => {
        return (await opts.ctx.docService.findVersionsBySourceUrl(
          opts.input.url,
        )) as DbVersionWithLibrary[];
      }),

    getScraperOptions: tt.procedure
      .input(z.object({ versionId: z.number().int().positive() }))
      .query(async (opts) => {
        return await opts.ctx.docService.getScraperOptions(opts.input.versionId);
      }),

    updateVersionStatus: tt.procedure
      .input(
        z.object({
          versionId: z.number().int().positive(),
          status: z.string(),
          errorMessage: z.string().optional().nullable(),
        }),
      )
      .mutation(async (opts) => {
        await opts.ctx.docService.updateVersionStatus(
          opts.input.versionId,
          opts.input.status as VersionStatus,
          opts.input.errorMessage ?? undefined,
        );
        invalidateLibrariesCache();
        return { ok: true } as const;
      }),

    updateVersionProgress: tt.procedure
      .input(
        z.object({
          versionId: z.number().int().positive(),
          pages: z.number().int().nonnegative(),
          maxPages: z.number().int().positive(),
        }),
      )
      .mutation(async (opts) => {
        await opts.ctx.docService.updateVersionProgress(
          opts.input.versionId,
          opts.input.pages,
          opts.input.maxPages,
        );
        invalidateLibrariesCache();
        return { ok: true } as const;
      }),

    storeScraperOptions: tt.procedure
      .input(
        z.object({
          versionId: z.number().int().positive(),
          options: z.unknown(),
        }),
      )
      .mutation(async (opts) => {
        // options conforms to ScraperOptions at the caller; keep as unknown here
        await opts.ctx.docService.storeScraperOptions(
          opts.input.versionId,
          opts.input.options as unknown as Parameters<
            IDocumentManagement["storeScraperOptions"]
          >[1],
        );
        return { ok: true } as const;
      }),
  });
}

// Default router for standalone usage
export const dataRouter = createDataRouter(t);
export type DataRouter = typeof dataRouter;
