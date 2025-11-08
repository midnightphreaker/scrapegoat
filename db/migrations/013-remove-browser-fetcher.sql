-- Migration 013: Remove Browser Fetcher Type
-- Date: 2025-11-09
-- Purpose: Update database after Playwright removal - migrate 'browser' fetcher to 'crawl4ai'

-- Update pages table: Change 'browser' fetcher_type to 'crawl4ai'
UPDATE pages
SET fetcher_type = 'crawl4ai'
WHERE fetcher_type = 'browser';

-- Update column comment to reflect valid fetcher types
COMMENT ON COLUMN pages.fetcher_type IS
  'Fetcher type used. Valid values: auto, http, crawl4ai, file';

-- Migration verification query (should return 0 after migration):
-- SELECT COUNT(*) FROM pages WHERE fetcher_type = 'browser';
