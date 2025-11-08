-- Migration 011: Enhanced Crawl4AI Features
-- Adds support for screenshots, media tracking, and fetcher type tracking
-- Date: 2025-11-09
-- Author: Claude Code Agent

-- Add screenshot path column to pages table
-- This stores the relative path to the screenshot file (not the binary data)
-- Example: /screenshots/react/18.0.0/abc123.png
ALTER TABLE pages
ADD COLUMN IF NOT EXISTS screenshot_path TEXT;

-- Add fetcher type column to track which fetcher was used
-- Valid values: 'auto', 'http', 'browser', 'crawl4ai', 'file'
-- Default to 'http' for existing records
ALTER TABLE pages
ADD COLUMN IF NOT EXISTS fetcher_type TEXT DEFAULT 'http';

-- Create index for fetcher type queries
-- This allows efficient filtering by fetcher type for analytics and debugging
CREATE INDEX IF NOT EXISTS idx_pages_fetcher_type ON pages(fetcher_type);

-- Note: No changes needed to existing data
-- - screenshot_path will be NULL for existing pages (expected)
-- - fetcher_type will default to 'http' (reasonable assumption for old data)
-- - metadata column already exists and can accommodate new fields
