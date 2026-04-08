-- Migration 000: Initial Schema
-- Consolidates the final state of all upstream SQLite migrations into PostgreSQL.
-- Tables: libraries → versions → pages → documents (FK CASCADE chain)

CREATE TABLE IF NOT EXISTS libraries (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS versions (
  id SERIAL PRIMARY KEY,
  library_id INTEGER NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'not_indexed',
  source_url TEXT,
  scraper_options TEXT,
  progress_pages INTEGER DEFAULT 0,
  progress_max_pages INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(library_id, name)
);

CREATE TABLE IF NOT EXISTS pages (
  id SERIAL PRIMARY KEY,
  version_id INTEGER NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  etag TEXT,
  last_modified TEXT,
  source_content_type TEXT,
  content_type TEXT,
  depth INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(version_id, url)
);

CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  page_id INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  sort_order INTEGER NOT NULL,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FK indexes for join performance
CREATE INDEX IF NOT EXISTS idx_versions_library_id ON versions(library_id);
CREATE INDEX IF NOT EXISTS idx_pages_version_id ON pages(version_id);
CREATE INDEX IF NOT EXISTS idx_documents_page_id ON documents(page_id);
CREATE INDEX IF NOT EXISTS idx_documents_sort_order ON documents(page_id, sort_order);

-- Status and lookup indexes
CREATE INDEX IF NOT EXISTS idx_versions_status ON versions(status);
CREATE INDEX IF NOT EXISTS idx_pages_url ON pages(url);
CREATE INDEX IF NOT EXISTS idx_pages_etag ON pages(etag);
