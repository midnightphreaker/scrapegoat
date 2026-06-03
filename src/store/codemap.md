## Responsibility

The `store` module manages persistent storage, retrieval, and semantic search of scraped library documentation. It owns the PostgreSQL database layer (connection pooling, schema migrations, pgvector extension), provides hybrid search combining vector similarity with full-text search (FTS), and exposes all document management operations through a local service or a remote tRPC client. Submodules handle content-type-aware search result assembly (`assembly/`), multi-provider embedding model creation (`embeddings/`), and the tRPC API boundary (`trpc/`).

## Design

### Core Files

- **`index.ts`** — Public barrel export and factory functions. `createDocumentManagement()` returns either a `DocumentManagementClient` (remote) or `DocumentManagementService` (local) behind the `IDocumentManagement` interface. `createLocalDocumentManagement()` constructs an in-process service for the worker/pipeline path.
- **`DocumentManagementService`** — High-level orchestrator that composes `DocumentStore`, `DocumentRetrieverService`, and content pipelines. Implements `IDocumentManagement`. Handles library/version lifecycle (create, resolve, remove), version status tracking, semver-aware `findBestVersion()` with Fuse.js fuzzy suggestions, and delegates search to `DocumentRetrieverService`. Emits `LIBRARY_CHANGE` events via `EventBusService`.
- **`DocumentManagementClient`** — tRPC proxy client implementing `IDocumentManagement`. Delegates every call to a remote server over HTTP batch transport using `@trpc/client` with SuperJSON serialization. Performs a `ping` connectivity check during `initialize()`.
- **`DocumentStore`** — Core data access layer (~1700 lines). Manages PostgreSQL queries for libraries, versions, pages, and document chunks. Key methods:
  - `addDocuments()` — Atomic upsert of pages and chunks with embedding generation (batched by character count/size, auto-retry on input size errors, zero-padding to fixed DB dimension).
  - `findByContent()` — Hybrid search: vector similarity via pgvector `<=>` operator combined with FTS via `ts_rank`/`plainto_tsquery`, merged with Reciprocal Rank Fusion (RRF). Falls back to FTS-only when embeddings are disabled.
  - `findChildChunks()`, `findPrecedingSiblingChunks()`, `findSubsequentSiblingChunks()`, `findParentChunk()` — Hierarchical chunk navigation using JSONB `path` metadata.
  - `findChunksByIds()`, `findChunksByUrl()` — Batch retrieval for assembly strategies.
  - `resolveVersionId()` — Idempotent library+version resolution via `INSERT ... ON CONFLICT`.
  - `checkEmbeddingModelChange()` / `invalidateAllVectors()` — Detects and handles embedding model/dimension changes stored in a `metadata` table.
- **`DocumentRetrieverService`** — Search orchestration layer. Takes raw chunk results from `DocumentStore.findByContent()`, groups by URL, clusters adjacent chunks by configurable `maxChunkDistance`, and delegates chunk selection and content assembly to content-type-aware strategies via `ContentAssemblyStrategyFactory`.
- **`PostgresConnection`** — Wraps `pg.Pool` with lifecycle management: connection test, pgvector extension installation, health checks, and graceful shutdown. Validates connection string at construction time.
- **`applyMigrations`** — Sequential SQL migration runner. Reads `.sql` files from `db/migrations/`, tracks applied migrations in `_schema_migrations` table, runs within a single transaction with retry on deadlock/serialization errors, and executes `ANALYZE` after successful migrations.
- **`types.ts`** — Shared type definitions: `DbPage`, `DbChunk`, `DbChunkMetadata`, `DbPageChunk`, `DbChunkRank`, `DbVersion`, `DbVersionWithLibrary`, `VersionRef`, `VersionSummary`, `LibrarySummary`, `VersionStatus` enum, `StoreSearchResult`, `ScraperConfig`, and helper functions (`normalizeVersionRef`, `normalizeVersionName`, `denormalizeVersionName`, `getStatusDescription`, `isFinalStatus`, `isActiveStatus`).
- **`errors.ts`** — Error hierarchy rooted at `StoreError`: `LibraryNotFoundInStoreError` (with fuzzy suggestions), `VersionNotFoundInStoreError` (with available versions), `DimensionError`, `ConnectionError`, `DocumentNotFoundError`, `EmbeddingModelChangedError`, `MissingCredentialsError`.

### Submodule: `trpc/`

- **`interfaces.ts`** — `IDocumentManagement` interface defining the contract for all document management operations (lifecycle, library/version introspection, search, mutations, status tracking, scraper options). Implemented by both `DocumentManagementService` and `DocumentManagementClient`.
- **`router.ts`** — tRPC router (`DataRouter`) exposing `IDocumentManagement` operations as validated procedures with Zod schemas. Includes `ping` health-check, `listLibraries`, `findBestVersion`, `search`, `removeVersion`, `removeAllDocuments`, `getVersionsByStatus`, `findVersionsBySourceUrl`, `getScraperOptions`, `updateVersionStatus`, `updateVersionProgress`, `storeScraperOptions`.

### Submodule: `assembly/`

- **`ContentAssemblyStrategyFactory`** — Returns the appropriate `ContentAssemblyStrategy` based on MIME type: `HierarchicalAssemblyStrategy` for source code/JSON, `MarkdownAssemblyStrategy` for markdown/HTML/text and as default fallback.
- **`types.ts`** — `ContentAssemblyStrategy` interface with `canHandle()`, `selectChunks()`, `assembleContent()`. Also defines `ContentAssemblyContext` and `ChunkSelectionResult`.
- **`MarkdownAssemblyStrategy`** — For prose content. Selects chunks by expanding context (parent, preceding/subsequent siblings, children) around each match, then joins with `"\n\n"`.
- **`HierarchicalAssemblyStrategy`** — For structured content (source code, JSON). Single matches: walks up to the nearest structural ancestor (class/function/interface), then includes the full subtree via BFS. Multiple matches: finds the common ancestor path and reconstructs minimal subtrees. Handles hierarchical gaps with progressive path-shortening lookups. Falls back to conservative parent+children selection on errors.

### Submodule: `embeddings/`

- **`EmbeddingConfig`** — Singleton that parses model specs (`"provider:model"`) into `EmbeddingModelConfig` objects. Maintains a large case-insensitive lookup table of known model dimensions (~200 models) to avoid runtime dimension probing. Provides static convenience methods (`parseEmbeddingConfig`, `getKnownModelDimensions`, `setKnownModelDimensions`).
- **`EmbeddingFactory`** — Creates LangChain `Embeddings` instances from a `"provider:model"` spec. Supports OpenAI (including Ollama/LMStudio via `OPENAI_API_BASE`), Google Vertex AI, Google Gemini (wrapped in `FixedDimensionEmbeddings` for MRL truncation), AWS Bedrock, Azure OpenAI. Validates credentials before instantiation, throwing `MissingCredentialsError` or `UnsupportedProviderError`.
- **`FixedDimensionEmbeddings`** — Wrapper that normalizes output vectors to a fixed dimension: truncates for MRL-capable models (Gemini), zero-pads for smaller vectors, throws `DimensionError` for oversized non-truncatable vectors.

## Flow

1. **Initialization**: `createDocumentManagement()` or `createLocalDocumentManagement()` constructs either a `DocumentManagementClient` (remote tRPC) or a `DocumentManagementService` (local). The local path creates `PostgresConnection` → `DocumentStore` → `DocumentRetrieverService`.
2. **Store startup**: `DocumentStore.initialize()` calls `PostgresConnection.initialize()` (pool creation, connectivity test, pgvector install), then `applyMigrations()` (sequential SQL migrations in a transaction), then `checkEmbeddingModelChange()` (detect config drift), then `initializeEmbeddings()` (resolve provider, probe dimensions, wrap in `FixedDimensionEmbeddings` if needed).
3. **Document ingestion**: `DocumentManagementService.addScrapeResult()` receives a `ScrapeResult` with pre-split chunks, delegates to `DocumentStore.addDocuments()` which resolves the library/version ID, generates embeddings in batches (with auto-split retry on size errors), zero-pads vectors, and atomically upserts the page and chunks in a transaction.
4. **Search**: `DocumentManagementService.searchStore()` delegates to `DocumentRetrieverService.search()`, which calls `DocumentStore.findByContent()` (hybrid vector+FTS with RRF, or FTS-only fallback). Results are grouped by URL, clustered by sort-order distance, and each cluster is assembled using the content-type-appropriate strategy. Final results are sorted by score.
5. **Version management**: `findBestVersion()` lists semver versions, applies semver range matching (exact, x-range, latest), and falls back to unversioned content. `validateLibraryExists()` uses Fuse.js for fuzzy suggestions. Status tracking (`updateVersionStatus`, `updateVersionProgress`) persists indexing state in the `versions` table.
6. **Remote access**: `DocumentManagementClient` proxies all operations through the tRPC `DataRouter`, which validates inputs with Zod and delegates to the server-side `DocumentManagementService`.

## Integration

- **Consumed by**: `src/scraper/pipelines/` (stores scraped content via `addScrapeResult`), `src/server/` (exposes search and management via HTTP/tRPC API), `src/worker/` (pipeline worker for indexing jobs), `src/tools/` (MCP tools for search and library management), `src/cli/` (CLI commands for library CRUD and status).
- **Depends on**: `pg` (PostgreSQL client), `pgvector` (PostgreSQL extension for vector similarity), `@langchain/core` and provider-specific LangChain packages (OpenAI, Google, AWS, Azure) for embedding generation, `@trpc/server` and `@trpc/client` (RPC transport), `superjson` (serialization), `zod` (input validation), `fuse.js` (fuzzy library name matching), `semver` (version matching), `src/events/` (`EventBusService` for `LIBRARY_CHANGE` events), `src/utils/config` (`AppConfig`), `src/utils/logger`, `src/scraper/types` (`ScrapeResult`, `ScraperOptions`), `src/splitter/types` (`Chunk`), `src/utils/version` (version sorting/comparison).
