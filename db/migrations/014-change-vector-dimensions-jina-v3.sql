-- Migration 014: Change Vector Dimensions for Jina-Embedding-v3
-- Date: 2025-12-09
-- Purpose: Update vector dimensions from 1536 (OpenAI ada-002) to 1024 (Jina-Embedding-v3)
--
-- Context: Switching from bundled embeddings to embed.den.lan with Jina-Embedding-v3
-- which produces 1024-dimension vectors instead of 1536-dimension vectors.
--
-- IMPORTANT: This migration assumes a clean database with no existing embeddings.
-- If you have existing embeddings, they will become invalid and need re-indexing.

-- Change vector dimensions from 1536 to 1024
ALTER TABLE documents ALTER COLUMN embedding TYPE VECTOR(1024);

-- Update column comment to reflect new dimensions
COMMENT ON COLUMN documents.embedding IS
  'Document embedding vector (1024 dimensions for Jina-Embedding-v3)';

-- Migration verification queries:
-- 1. Check vector dimension: SELECT atttypmod FROM pg_attribute WHERE attrelid = 'documents'::regclass AND attname = 'embedding';
--    Expected result: 1028 (1024 dimensions + 4 byte header)
-- 2. Count documents: SELECT COUNT(*) FROM documents;
--    Expected result: 0 (clean database)
