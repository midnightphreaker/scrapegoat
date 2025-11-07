-- Migration 003: HNSW Indexes for Vector Search
-- Creates HNSW indexes for fast approximate nearest neighbor search using pgvector

-- HNSW index for vector similarity search
-- Parameters:
--   m = 16: Maximum number of connections per layer (higher = better recall, more memory)
--   ef_construction = 64: Size of dynamic candidate list during construction (higher = better quality, slower build)
--
-- Performance characteristics:
--   - Excellent query performance for approximate nearest neighbor search
--   - Scales well to millions of vectors
--   - Good recall/performance tradeoff with these parameters
--   - Supports cosine distance (1 - cosine similarity)

CREATE INDEX IF NOT EXISTS idx_documents_embedding_hnsw
  ON documents
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Note: Alternative index strategy (IVFFlat) for lower memory usage:
-- CREATE INDEX idx_documents_embedding_ivfflat
--   ON documents
--   USING ivfflat (embedding vector_cosine_ops)
--   WITH (lists = 100);
--
-- IVFFlat uses less memory but requires VACUUM ANALYZE after bulk inserts
-- and may have lower recall than HNSW
