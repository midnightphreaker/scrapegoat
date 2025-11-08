-- Migration 012: Add metadata column to pages table
-- Adds JSON metadata column to store page-level metadata (screenshots, media, links)
-- Date: 2025-11-09
-- Author: Claude Code Agent

-- Add metadata column to pages table for storing page-level information
-- This complements document-level metadata and stores fetcher-specific data
ALTER TABLE pages
ADD COLUMN IF NOT EXISTS metadata TEXT;

-- Create GIN index for efficient JSONB queries on metadata
CREATE INDEX IF NOT EXISTS idx_pages_metadata_gin ON pages USING gin ((metadata::jsonb));

-- Add comment explaining the metadata column usage
COMMENT ON COLUMN pages.metadata IS 'JSON metadata for page-level information (screenshots, media, links from fetchers)';
