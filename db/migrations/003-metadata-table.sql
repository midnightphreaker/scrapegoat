-- Migration 003: Metadata Table
-- Migration tracking and global configuration storage

CREATE TABLE IF NOT EXISTS _schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
