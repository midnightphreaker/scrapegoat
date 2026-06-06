# src/store/

## Responsibility
Persistent storage layer for versioned library documentation: PostgreSQL-backed document storage with pgvector embeddings, full-text search, hybrid ranking (RRF), schema migrations, and tRPC-based remote access.

## Design
- **Layered architecture**: `PostgresConnection` → `DocumentStore` (raw SQL) → `DocumentManagementService` (business logic) → `DocumentRetrieverService` (search + assembly) → tRPC router/client
- **Hybrid search**: Vector similarity + PostgreSQL full-text search combined via Reciprocal Rank Fusion (RRF) with configurable weights
- **Versioning model**: `libraries` → `versions` → `pages` → `documents` (chunks). Versions track indexing status (`VersionStatus` enum) and scraper options for reproducibility
- **Graceful degradation**: Embeddings optional — falls back to FTS-only search when no credentials or no model configured. `EmbeddingModelChangedError` detected at startup with interactive resolution

**Key classes:**
- `PostgresConnection` — connection pool lifecycle, health checks, pgvector extension installation
- `DocumentStore` — core data access: CRUD for libraries/versions/pages/documents, embedding generation with batch/retry logic, hybrid search queries, vector padding, parent/sibling/child chunk queries
- `DocumentManagementService` — business logic: version resolution (semver matching), library validation with fuzzy suggestions (Fuse.js), pipeline orchestration, event emission on mutations
- `DocumentRetrieverService` — search with content-type-aware result assembly: clusters nearby chunks, expands context via strategy pattern
- `applyMigrations` — transactional SQL migration runner from `db/migrations/` with deadlock retry

**Error hierarchy**: `StoreError` → `LibraryNotFoundInStoreError`, `VersionNotFoundInStoreError`, `DimensionError`, `ConnectionError`, `DocumentNotFoundError`, `EmbeddingModelChangedError`, `MissingCredentialsError`

## Flow
1. `DocumentManagementService.initialize()` → connection pool → migrations → embedding model check → embedding init
2. Scraping: `addScrapeResult()` → chunk storage with batch embedding generation → upsert pages + insert documents in transaction
3. Search: `searchStore()` → hybrid vector+FTS query → RRF ranking → chunk clustering → content-type-aware assembly → `StoreSearchResult[]`
4. Remote access: `DocumentManagementClient` (tRPC HTTP client) ↔ `DataRouter` (tRPC server)

## Integration
- Consumed by: `src/scraper/` (pipelines store results), `src/tools/` (MCP tools for search/list), `src/server/` (API endpoints), `src/index.ts` (CLI commands)
- Depends on: `src/store/assembly/` (search result assembly strategies), `src/store/embeddings/` (embedding model factory), `src/store/trpc/` (remote API), `pg` (PostgreSQL driver), `@langchain/core/embeddings`, `fuse.js`, `semver`
