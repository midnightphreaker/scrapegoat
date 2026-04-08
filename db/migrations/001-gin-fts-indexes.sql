-- Migration 001: GIN FTS Indexes
-- Full-text search on documents, case-insensitive library/version lookups

CREATE INDEX IF NOT EXISTS idx_documents_fts ON documents USING gin(to_tsvector('english', content));

CREATE INDEX IF NOT EXISTS idx_libraries_name_lower ON libraries(LOWER(name));
