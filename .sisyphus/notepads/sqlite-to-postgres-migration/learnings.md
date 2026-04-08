# Wave 3 Learnings: DocumentStore.ts Rewrite (SQLite → PostgreSQL)

## Key SQL Translation Patterns Used
- `?` → `$1, $2, $3...` (positional params)
- `stmt.get()` → `pool.query(...)` then `rows[0]` or `undefined`
- `stmt.all()` → `pool.query(...)` then `rows`
- `stmt.run()` → `pool.query(...)` (use `RETURNING` for IDs)
- `lastInsertRowid` → `RETURNING id` in INSERT
- `json_extract(col, '$.key')` → `(col)::jsonb->>'key'`
- `json_array_length(json_extract(...))` → `jsonb_array_length((col)::jsonb->'key')`
- `json(d.metadata)` → `d.metadata` (already JSONB, no conversion needed)
- `json_each(col)` → `jsonb_array_elements_text((col)::jsonb->'key')`
- FTS5 `MATCH bm25()` → `to_tsvector('english', col) @@ plainto_tsquery('english', $1)` + `ts_rank()`
- sqlite-vec `vec0 MATCH` → `embedding <=> $1::vector` (cosine distance)
- `db.transaction(() => {...})` → `PoolClient + BEGIN/COMMIT/ROLLBACK`
- `BigInt(id)` → `Number(id)` (PostgreSQL SERIAL returns number)
- SQLite `COALESCE(v.name, '')` → Same in PostgreSQL
- `INSERT ... ON CONFLICT DO NOTHING` → `INSERT ... ON CONFLICT DO UPDATE SET col = EXCLUDED.col RETURNING id`

## Schema Observations
- PostgreSQL schema: `libraries → versions → pages → documents` (all FK CASCADE)
- `metadata` table: `key TEXT PK, value TEXT NOT NULL` (no `updated_at`)
- `_schema_migrations`: `id TEXT PK, applied_at TIMESTAMPTZ` (column is `id`, not `version`)
- `documents.embedding`: `VECTOR(1536)` — stored inline, no separate vec table needed
- `documents.metadata`: `JSONB DEFAULT '{}'` — native JSON, no need for `json()` function

## Async Conversion
- `getEmbeddingMetadata()`: was sync (`this.db.prepare().get()`) → now async (`await pool.query()`)
- `setEmbeddingMetadata()`: was sync (`this.db.prepare().run()`) → now async (`await pool.query()`)
- `checkEmbeddingModelChange()`: was sync → now async
- `invalidateAllVectors()`: was sync (`this.db.exec()`) → now async (`await pool.query()`)
- All callers (initialize, resolveModelChange) already async — low risk

## Structural Changes
- Constructor: `(dbPath: string, appConfig)` → `(connection: PostgresConnection, appConfig)`
- Removed: `this.db`, `this.statements`, `prepareStatements()`, `ensureVectorTable()`, all SQLite pragmas
- Added: `this.connection`, lazy pool access via `this.connection.getPool()`
- Config: `this.config.embeddings.vectorDimension` → `this.config.database.vectorDimension`
- `addDocuments()`: Uses `PoolClient` + `BEGIN/COMMIT/ROLLBACK` for atomic batch
- `addDocuments()`: Embedding format `[0.1,0.2,...]` cast via `$5::vector`

## Hybrid Search (findByContent)
- Split into two separate queries (vector + FTS) instead of CTE
- Vector: `1 - (d.embedding <=> $1::vector) as vec_score`
- FTS: `ts_rank(to_tsvector('english', d.content), plainto_tsquery('english', $1)) as fts_score`
- Structural chunk filter: `NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text((d.metadata)::jsonb->'types') t WHERE t = 'structural')`
- Merge via Map<number, RawSearchResult>, then assignRanks + RRF fusion
- `plainto_tsquery` replaces the custom `escapeFtsQuery` FTS5 escape logic entirely

## Remaining Errors (Expected - Wave 5)
- `DocumentManagementService.ts`: constructor still passes `dbPath` string → needs PostgresConnection creation
- `*.test.ts` files: still use old SQLite constructor, `getEmbeddingMetadata()` sync calls
- `HierarchicalAssemblyStrategy.test.ts`: same constructor signature issue
