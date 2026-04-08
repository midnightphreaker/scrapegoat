-- Migration 002: HNSW Vector Index
-- Cosine similarity search on document embeddings

CREATE INDEX IF NOT EXISTS idx_documents_embedding_hnsw ON documents USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
