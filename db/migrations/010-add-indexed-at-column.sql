-- Add indexed_at column to track when documents were last indexed
-- PostgreSQL allows adding columns with default values directly
ALTER TABLE documents ADD COLUMN indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
