/**
 * tRPC router exposing document data store operations via the worker API.
 * Only procedures actually used externally are included to keep surface minimal.
 */
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import { ScrapeMode } from "../../scraper/types";
import type {
  DbVersionWithLibrary,
  FindVersionResult,
  StoreSearchResult,
} from "../types";
import { VersionStatus } from "../types";
import type { IDocumentManagement } from "./interfaces";

// Context carries the document management API
export interface DataTrpcContext {
  docService: IDocumentManagement;
}

const t = initTRPC.context<DataTrpcContext>().create({
  transformer: superjson,
});

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

/**
 * Schema validating VersionStatus enum values at the tRPC boundary.
 * Replaces loose `z.string()` to ensure only valid status strings are accepted.
 */
export const versionStatusSchema = z.nativeEnum(VersionStatus);

/**
 * Schema validating serializable ScraperOptions fields at the tRPC boundary.
 * Only includes fields safe for RPC transport (excludes AbortSignal, QueueItem arrays, etc.).
 */
export const scraperOptionsStoreInputSchema = z.object({
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
});

export function createDataRouter(trpc: unknown) {
  const tt = trpc as typeof t;
  return tt.router({
    ping: tt.procedure.query(async () => ({ status: "ok", ts: Date.now() })),

    listLibraries: tt.procedure.query(async ({ ctx }: { ctx: DataTrpcContext }) => {
      return await ctx.docService.listLibraries(); // LibrarySummary[]
    }),

    findBestVersion: tt.procedure
      .input(z.object({ library: nonEmpty, targetVersion: z.string().optional() }))
      .query(
        async ({
          ctx,
          input,
        }: {
          ctx: DataTrpcContext;
          input: { library: string; targetVersion?: string };
        }) => {
          const result = await ctx.docService.findBestVersion(
            input.library,
            input.targetVersion,
          );
          return result as FindVersionResult;
        },
      ),

    validateLibraryExists: tt.procedure
      .input(z.object({ library: nonEmpty }))
      .mutation(
        async ({ ctx, input }: { ctx: DataTrpcContext; input: { library: string } }) => {
          await ctx.docService.validateLibraryExists(input.library);
          return { ok: true } as const;
        },
      ),

    versionExists: tt.procedure
      .input(z.object({ library: nonEmpty, version: nonEmpty }))
      .query(
        async ({
          ctx,
          input,
        }: {
          ctx: DataTrpcContext;
          input: { library: string; version: string };
        }) => {
          return await ctx.docService.versionExists(input.library, input.version);
        },
      ),

    search: tt.procedure
      .input(
        z.object({
          library: nonEmpty,
          version: optionalVersion,
          query: nonEmpty,
          limit: z.number().int().positive().max(50).optional(),
        }),
      )
      .query(
        async ({
          ctx,
          input,
        }: {
          ctx: DataTrpcContext;
          input: {
            library: string;
            version: string | null | undefined;
            query: string;
            limit?: number;
          };
        }) => {
          const results = await ctx.docService.searchStore(
            input.library,
            input.version ?? null,
            input.query,
            input.limit ?? 5,
          );

          return results as StoreSearchResult[];
        },
      ),

    removeVersion: tt.procedure
      .input(z.object({ library: nonEmpty, version: optionalVersion }))
      .mutation(
        async ({
          ctx,
          input,
        }: {
          ctx: DataTrpcContext;
          input: { library: string; version: string | null | undefined };
        }) => {
          await ctx.docService.removeVersion(input.library, input.version ?? null);
          return { ok: true } as const;
        },
      ),

    removeAllDocuments: tt.procedure
      .input(z.object({ library: nonEmpty, version: optionalVersion }))
      .mutation(
        async ({
          ctx,
          input,
        }: {
          ctx: DataTrpcContext;
          input: { library: string; version: string | null | undefined };
        }) => {
          await ctx.docService.removeAllDocuments(input.library, input.version ?? null);
          return { ok: true } as const;
        },
      ),

    // Status and version helpers

    getVersionsByStatus: tt.procedure
      .input(z.object({ statuses: z.array(versionStatusSchema) }))
      .query(
        async ({
          ctx,
          input,
        }: {
          ctx: DataTrpcContext;
          input: { statuses: VersionStatus[] };
        }) => {
          return (await ctx.docService.getVersionsByStatus(
            input.statuses,
          )) as DbVersionWithLibrary[];
        },
      ),

    findVersionsBySourceUrl: tt.procedure
      .input(z.object({ url: nonEmpty }))
      .query(async ({ ctx, input }: { ctx: DataTrpcContext; input: { url: string } }) => {
        return (await ctx.docService.findVersionsBySourceUrl(
          input.url,
        )) as DbVersionWithLibrary[];
      }),

    getScraperOptions: tt.procedure
      .input(z.object({ versionId: z.number().int().positive() }))
      .query(
        async ({
          ctx,
          input,
        }: {
          ctx: DataTrpcContext;
          input: { versionId: number };
        }) => {
          return await ctx.docService.getScraperOptions(input.versionId);
        },
      ),

    updateVersionStatus: tt.procedure
      .input(
        z.object({
          versionId: z.number().int().positive(),
          status: versionStatusSchema,
          errorMessage: z.string().optional().nullable(),
        }),
      )
      .mutation(
        async ({
          ctx,
          input,
        }: {
          ctx: DataTrpcContext;
          input: {
            versionId: number;
            status: VersionStatus;
            errorMessage?: string | null;
          };
        }) => {
          await ctx.docService.updateVersionStatus(
            input.versionId,
            input.status,
            input.errorMessage ?? undefined,
          );
          return { ok: true } as const;
        },
      ),

    updateVersionProgress: tt.procedure
      .input(
        z.object({
          versionId: z.number().int().positive(),
          pages: z.number().int().nonnegative(),
          maxPages: z.number().int().positive(),
        }),
      )
      .mutation(
        async ({
          ctx,
          input,
        }: {
          ctx: DataTrpcContext;
          input: { versionId: number; pages: number; maxPages: number };
        }) => {
          await ctx.docService.updateVersionProgress(
            input.versionId,
            input.pages,
            input.maxPages,
          );
          return { ok: true } as const;
        },
      ),

    storeScraperOptions: tt.procedure
      .input(
        z.object({
          versionId: z.number().int().positive(),
          options: scraperOptionsStoreInputSchema,
        }),
      )
      .mutation(
        async ({
          ctx,
          input,
        }: {
          ctx: DataTrpcContext;
          input: {
            versionId: number;
            options: z.infer<typeof scraperOptionsStoreInputSchema>;
          };
        }) => {
          await ctx.docService.storeScraperOptions(
            input.versionId,
            input.options as Parameters<IDocumentManagement["storeScraperOptions"]>[1],
          );
          return { ok: true } as const;
        },
      ),
  });
}

// Default router for standalone usage
export const dataRouter = createDataRouter(t);
export type DataRouter = typeof dataRouter;
