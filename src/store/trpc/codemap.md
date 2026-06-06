# src/store/trpc/

## Responsibility
tRPC-based remote API layer for document management operations, enabling CLI/MCP clients to interact with a remote ScrapeGoat server over HTTP.

## Design
- **Interface-driven**: `IDocumentManagement` defines the contract implemented by both `DocumentManagementService` (local) and `DocumentManagementClient` (remote tRPC client)
- **Typed router**: `DataRouter` exposes procedures for library listing, version resolution, search, document removal, status tracking, and scraper option management
- **Zod validation**: Input schemas (`nonEmpty`, `optionalVersion`, `versionStatusSchema`, `scraperOptionsStoreInputSchema`) validate all tRPC boundary inputs
- **Batch transport**: HTTP batch link with superjson serialization

**Components:**
- `interfaces.ts` — `IDocumentManagement` interface: lifecycle (initialize/shutdown), library/version introspection, search, mutations, status tracking, embedding config
- `router.ts` — tRPC router with procedures: `ping`, `listLibraries`, `findBestVersion`, `validateLibraryExists`, `versionExists`, `search`, `removeVersion`, `removeAllDocuments`, `getVersionsByStatus`, `findVersionsBySourceUrl`, `getScraperOptions`, `updateVersionStatus`, `updateVersionProgress`, `storeScraperOptions`

## Flow
1. Server: `createDataRouter(t)` creates router with `DataTrpcContext` containing `IDocumentManagement`
2. Client: `DocumentManagementClient` creates tRPC proxy client → calls remote procedures
3. Each procedure delegates to `ctx.docService.*()` on the server side

## Integration
- Consumed by: `src/server/` (mounts router as HTTP endpoint), `src/store/DocumentManagementClient.ts` (remote client)
- Depends on: `@trpc/server`, `@trpc/client`, `superjson`, `zod`, `src/store/types.ts`, `src/scraper/types.ts`
