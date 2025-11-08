-- Rollback Migration 011: Remove Enhanced Crawl4AI Features
-- This script rolls back the schema changes from migration 011
-- Date: 2025-11-09
-- Author: Claude Code Agent

-- Remove index for fetcher type
DROP INDEX IF EXISTS idx_pages_fetcher_type;

-- Remove fetcher type column
ALTER TABLE pages DROP COLUMN IF EXISTS fetcher_type;

-- Remove screenshot path column
ALTER TABLE pages DROP COLUMN IF EXISTS screenshot_path;

-- Reset metadata column comment to original (if needed)
COMMENT ON COLUMN pages.metadata IS
  'JSON metadata for the page';

-- Note: This rollback is safe and does not delete any page data
-- Only the new columns are removed
