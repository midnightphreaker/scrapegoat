# PostgreSQL Full-Text Search Research

## Overview

PostgreSQL provides robust full-text search capabilities that differ significantly from SQLite's FTS5. This document covers the key concepts and implementation strategies for migrating from SQLite FTS5 to PostgreSQL FTS.

## SQLite FTS5 vs PostgreSQL FTS

### SQLite FTS5 Approach
```sql
-- Virtual table with FTS5
CREATE VIRTUAL TABLE documents_fts USING fts5(content, title);

-- Insert
INSERT INTO documents_fts VALUES ('document content', 'title');

-- Search with MATCH operator
SELECT * FROM documents_fts WHERE documents_fts MATCH 'search query';
```

### PostgreSQL FTS Approach
```sql
-- Regular table with tsvector column
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    content TEXT,
    title TEXT,
    search_vector tsvector
);

-- Create GIN index
CREATE INDEX idx_search_vector ON documents USING GIN(search_vector);

-- Update search_vector (typically via trigger)
UPDATE documents SET search_vector =
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''));

-- Search with @@ operator
SELECT * FROM documents
WHERE search_vector @@ to_tsquery('english', 'search & query');
```

## Key PostgreSQL FTS Concepts

### 1. tsvector (Document)
A tsvector is a sorted list of distinct lexemes (normalized words) with position information.

```sql
-- Create tsvector from text
SELECT to_tsvector('english', 'The quick brown fox jumps over the lazy dog');
-- Result: 'brown':3 'dog':9 'fox':4 'jump':5 'lazi':8 'quick':2
```

**Key Features**:
- Normalized (lowercased, stemmed)
- Stop words removed ('the', 'over', etc.)
- Position information retained
- Can combine multiple tsvectors

### 2. tsquery (Query)
A tsquery represents the search query with operators for combining terms.

```sql
-- Various query construction methods
SELECT to_tsquery('english', 'fox & dog');        -- AND
SELECT to_tsquery('english', 'fox | dog');        -- OR
SELECT to_tsquery('english', 'fox & !dog');       -- NOT
SELECT to_tsquery('english', 'quick <-> fox');    -- Phrase (adjacent)
```

**Query Construction Functions**:

| Function | Use Case | Handles Special Chars | Operators Allowed |
|----------|----------|----------------------|-------------------|
| `to_tsquery()` | Advanced queries | ❌ No | ✅ Yes (&, \|, !, <->) |
| `plainto_tsquery()` | Plain text search | ✅ Yes | ❌ No (converts to &) |
| `phraseto_tsquery()` | Phrase search | ✅ Yes | ❌ No (phrase only) |
| `websearch_to_tsquery()` | Web-style search | ✅ Yes | ✅ Partial ("", OR, -) |

### 3. Match Operator (@@)
The @@ operator tests whether a tsvector matches a tsquery.

```sql
-- Basic matching
SELECT 'quick brown fox'::tsvector @@ 'fox'::tsquery;  -- true
SELECT 'quick brown fox'::tsvector @@ 'cat'::tsquery;  -- false

-- With proper parsing
SELECT to_tsvector('english', 'The quick brown fox') @@
       to_tsquery('english', 'quick & fox');  -- true
```

### 4. Ranking
PostgreSQL provides ranking functions to order results by relevance.

```sql
-- ts_rank: Basic ranking based on term frequency
SELECT ts_rank(search_vector, query) AS rank
FROM documents, to_tsquery('english', 'search terms') query
WHERE search_vector @@ query
ORDER BY rank DESC;

-- ts_rank_cd: Cover density ranking (considers term proximity)
SELECT ts_rank_cd(search_vector, query) AS rank
FROM documents, to_tsquery('english', 'search terms') query
WHERE search_vector @@ query
ORDER BY rank DESC;

-- Weighted ranking (prioritize title over content)
SELECT ts_rank(
    setweight(to_tsvector('english', title), 'A') ||
    setweight(to_tsvector('english', content), 'B'),
    query
) AS rank
FROM documents, to_tsquery('english', 'search terms') query
WHERE search_vector @@ query
ORDER BY rank DESC;
```

## Text Search Configurations

PostgreSQL supports multiple text search configurations for different languages.

```sql
-- Available configurations
SELECT cfgname FROM pg_ts_config;
-- Common: english, simple, french, german, spanish, etc.

-- Using different configurations
SELECT to_tsvector('french', 'Les chats noirs');
SELECT to_tsvector('simple', 'Do not stem or remove stop words');
```

**Recommended**: Use `'english'` for English content, or `'simple'` for mixed languages.

## Implementation Strategy for Scrapegoat

### Current Migration Setup
The migrations already create:
```sql
-- Add tsvector column
ALTER TABLE documents ADD COLUMN search_vector tsvector;

-- Create GIN index
CREATE INDEX idx_documents_search_vector ON documents USING GIN(search_vector);

-- Create trigger to auto-update search_vector
CREATE TRIGGER documents_search_vector_update
BEFORE INSERT OR UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION tsvector_update_trigger(
    search_vector, 'pg_catalog.english',
    title, content, url
);
```

### Required Code Changes in DocumentStore.ts

#### 1. Simple Text Search
**Current SQLite Code**:
```typescript
const query = `
    SELECT * FROM documents
    WHERE content MATCH ?
    ORDER BY rank
`;
```

**PostgreSQL Code**:
```typescript
const query = `
    SELECT *, ts_rank(search_vector, plainto_tsquery('english', $1)) as rank
    FROM documents
    WHERE search_vector @@ plainto_tsquery('english', $1)
    ORDER BY rank DESC
`;
```

**Why plainto_tsquery()**:
- Handles special characters automatically
- User doesn't need to know query syntax
- Safe from injection (no operators to exploit)
- Converts to AND query (all terms must match)

#### 2. Advanced Search with Operators
If users need OR, phrase search, etc.:

```typescript
const query = `
    SELECT *, ts_rank(search_vector, websearch_to_tsquery('english', $1)) as rank
    FROM documents
    WHERE search_vector @@ websearch_to_tsquery('english', $1)
    ORDER BY rank DESC
`;
```

**websearch_to_tsquery() syntax**:
- `"exact phrase"` - phrase search
- `word1 OR word2` - either term
- `-excluded` - exclude term
- Default: AND search

#### 3. Search with Filtering
```typescript
const query = `
    SELECT *, ts_rank(search_vector, plainto_tsquery('english', $1)) as rank
    FROM documents
    WHERE search_vector @@ plainto_tsquery('english', $1)
      AND library = $2
      AND version = $3
    ORDER BY rank DESC
    LIMIT $4
`;
```

#### 4. Hybrid Search (Vector + FTS)
```typescript
const query = `
    SELECT
        d.*,
        (1 - (d.embedding <-> $1::vector)) * 0.5 +
        ts_rank(d.search_vector, plainto_tsquery('english', $2)) * 0.5 as combined_score
    FROM documents d
    WHERE
        d.search_vector @@ plainto_tsquery('english', $2)
        OR (d.embedding <-> $1::vector) < 0.5
    ORDER BY combined_score DESC
    LIMIT $3
`;
```

### Handling Edge Cases

#### Empty or Invalid Queries
```typescript
// Before executing query
if (!searchTerm || searchTerm.trim() === '') {
    throw new Error('Search term cannot be empty');
}

// plainto_tsquery handles invalid syntax gracefully
// Returns empty tsquery if no valid terms found
```

#### Special Characters
```typescript
// These are all handled by plainto_tsquery:
- "test@example.com"  → 'test':1 'example.com':2
- "node.js"           → 'node.js':1
- "C++ programming"   → 'c':1 'program':2
- "hello & goodbye"   → 'hello':1 'goodby':3  (& becomes AND)
```

#### Case Sensitivity
```typescript
// FTS is case-insensitive by default (good!)
SELECT to_tsvector('english', 'PostgreSQL');
-- Result: 'postgresql':1

// For exact case-sensitive matching (library names, etc.)
// Use regular comparison operators:
WHERE LOWER(library) = LOWER($1)
```

## Performance Considerations

### Index Selection
```sql
-- GIN index (recommended for most cases)
CREATE INDEX idx_gin ON documents USING GIN(search_vector);
-- Pros: Faster search, smaller index
-- Cons: Slower updates

-- GiST index (alternative)
CREATE INDEX idx_gist ON documents USING GIST(search_vector);
-- Pros: Faster updates
-- Cons: Slower search, larger index
```

**Recommendation**: Use GIN (already in migrations).

### Query Optimization
```sql
-- Use parameterized queries (prevents re-parsing)
PREPARE search_docs (text) AS
    SELECT * FROM documents
    WHERE search_vector @@ plainto_tsquery('english', $1);

-- Use covering indexes if possible
CREATE INDEX idx_search_cover ON documents USING GIN(search_vector)
    INCLUDE (id, title, library, version);
```

### Ranking Optimization
```sql
-- ts_rank is faster but simpler
-- ts_rank_cd is slower but considers proximity

-- For best performance, only rank returned results
SELECT * FROM (
    SELECT * FROM documents
    WHERE search_vector @@ plainto_tsquery('english', $1)
    LIMIT 100
) subq
ORDER BY ts_rank(search_vector, plainto_tsquery('english', $1)) DESC
LIMIT 10;
```

## Testing Strategy

### Test Cases to Cover

1. **Basic Search**
   - Single term: "postgresql"
   - Multiple terms: "postgresql database"
   - Stemming: "running" matches "run"

2. **Special Characters**
   - Email: "test@example.com"
   - URLs: "https://example.com"
   - Programming: "node.js", "C++"
   - Punctuation: "hello, world!"

3. **Case Sensitivity**
   - "PostgreSQL" matches "postgresql"
   - "React" matches "react"

4. **Empty/Invalid**
   - Empty string: ""
   - Only punctuation: "!!!"
   - Only stop words: "the and or"

5. **Ranking**
   - Multiple matches ordered by relevance
   - Title matches ranked higher than content

6. **Filtering**
   - Search within specific library
   - Search within specific version

7. **Performance**
   - Search with 10,000+ documents
   - Complex queries
   - Concurrent searches

## References

- [PostgreSQL Full-Text Search Documentation](https://www.postgresql.org/docs/current/textsearch.html)
- [Text Search Functions](https://www.postgresql.org/docs/current/functions-textsearch.html)
- [Text Search Data Types](https://www.postgresql.org/docs/current/datatype-textsearch.html)
- [GIN Index Documentation](https://www.postgresql.org/docs/current/gin.html)

---

*Last Updated: 2025-11-08*
