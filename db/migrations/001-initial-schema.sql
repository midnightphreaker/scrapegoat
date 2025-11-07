-- Migration 001: Initial PostgreSQL Schema
-- Creates base tables for libraries, versions, pages, and documents with pgvector support

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Libraries table: stores unique library names
CREATE TABLE IF NOT EXISTS libraries (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Versions table: stores library versions with status tracking
CREATE TABLE IF NOT EXISTS versions (
  id SERIAL PRIMARY KEY,
  library_id INTEGER NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  name TEXT, -- NULL represents unversioned/default
  status TEXT NOT NULL DEFAULT 'not_indexed',
  source_url TEXT,
  scraper_options TEXT, -- JSON stored as TEXT
  progress_pages INTEGER DEFAULT 0,
  progress_max_pages INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(library_id, name)
);

-- Pages table: normalized page-level metadata
CREATE TABLE IF NOT EXISTS pages (
  id SERIAL PRIMARY KEY,
  version_id INTEGER NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  etag TEXT,
  last_modified TEXT,
  content_type TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(version_id, url)
);

-- Documents table: document chunks with vector embeddings
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR(1536), -- pgvector type, 1536 dimensions (OpenAI ada-002)
  metadata TEXT, -- JSON stored as TEXT
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for foreign keys (improves JOIN performance)
CREATE INDEX IF NOT EXISTS idx_versions_library_id ON versions(library_id);
CREATE INDEX IF NOT EXISTS idx_pages_version_id ON pages(version_id);
CREATE INDEX IF NOT EXISTS idx_documents_page_id ON documents(page_id);

-- Create index for document sorting
CREATE INDEX IF NOT EXISTS idx_documents_sort_order ON documents(page_id, sort_order);

-- Create index for version status queries
CREATE INDEX IF NOT EXISTS idx_versions_status ON versions(status);
