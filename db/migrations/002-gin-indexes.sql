-- Migration 002: GIN Indexes for Full-Text Search
-- Creates GIN indexes for fast full-text search and JSON queries

-- GIN index for full-text search on document content
-- Uses English text search configuration
CREATE INDEX IF NOT EXISTS idx_documents_content_fts
  ON documents
  USING GIN (to_tsvector('english', content));

-- GIN index for JSON metadata queries
-- Note: PostgreSQL TEXT can be cast to JSONB for queries
CREATE INDEX IF NOT EXISTS idx_documents_metadata_gin
  ON documents
  USING GIN (((metadata)::jsonb));

-- GIN index for version scraper_options
CREATE INDEX IF NOT EXISTS idx_versions_scraper_options_gin
  ON versions
  USING GIN (((scraper_options)::jsonb));
