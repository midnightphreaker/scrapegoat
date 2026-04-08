-- Migration 004: Fix schema mismatch after rebase
-- The new migrations (000-003) ran as no-ops because CREATE TABLE IF NOT EXISTS
-- doesn't add columns to existing tables. This migration adds the missing columns.

-- Add missing pages columns
ALTER TABLE pages ADD COLUMN IF NOT EXISTS source_content_type TEXT;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS depth INTEGER DEFAULT 0;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Drop screenshot_path (ScrapeGoat-specific, no longer needed, 0 rows have data)
ALTER TABLE pages DROP COLUMN IF EXISTS screenshot_path;

-- Drop duplicate FTS index (identical to idx_documents_fts)
DROP INDEX IF EXISTS idx_documents_content_fts;
