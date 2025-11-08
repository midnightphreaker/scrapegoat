# Data Flow: Crawl4AI to PostgreSQL/pgvector

**Last Updated:** 2025-11-08

This document describes the complete data flow from Crawl4AI web scraping through to PostgreSQL storage with pgvector embeddings.

---

## Table of Contents

1. [Overview](#overview)
2. [Current Pipeline Architecture](#current-pipeline-architecture)
3. [Crawl4AI Integration Points](#crawl4ai-integration-points)
4. [Complete Data Flow](#complete-data-flow)
5. [Database Storage Schema](#database-storage-schema)
6. [Content Processing Pipeline](#content-processing-pipeline)
7. [Embedding Generation](#embedding-generation)

---

## Overview

### Current State vs Target State

**Current State (Phase 1.1 & 1.2):**
- Crawl4AI service running and accessible
- Crawl4AIFetcher returns markdown content
- NOT integrated into storage pipeline

**Target State (Phase 1.3):**
- Crawl4AI content flows through entire pipeline
- Markdown processed and chunked semantically
- Chunks stored in PostgreSQL with vector embeddings
- Content searchable via hybrid search

---

## Current Pipeline Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Pipeline Manager                         │
│  (Orchestrates scraping jobs, manages queue)                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                     Pipeline Worker                          │
│  (Executes single scraping job)                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Scraper Service                           │
│  (Selects appropriate scraping strategy)                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Scraper Strategy                            │
│  (WebScraperStrategy, GitHubStrategy, etc.)                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Content Fetcher                            │
│  (Fetches raw content from URL)                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Content Pipeline                            │
│  (Processes and chunks content)                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            DocumentManagementService                         │
│  (Manages document storage)                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  DocumentStore                               │
│  (PostgreSQL + pgvector storage)                            │
└─────────────────────────────────────────────────────────────┘
```

### Key Files

| Component | File Path | Responsibility |
|-----------|-----------|----------------|
| Pipeline Worker | `src/pipeline/PipelineWorker.ts` | Executes scraping job, stores documents |
| Scraper Service | `src/scraper/ScraperService.ts` | Routes to appropriate strategy |
| Web Strategy | `src/scraper/strategies/WebScraperStrategy.ts` | Web scraping orchestration |
| AutoDetect Fetcher | `src/scraper/fetcher/AutoDetectFetcher.ts` | Selects appropriate fetcher |
| Crawl4AI Fetcher | `src/scraper/fetcher/crawl4ai/Crawl4AIFetcher.ts` | Crawl4AI integration |
| Markdown Pipeline | `src/scraper/pipelines/MarkdownPipeline.ts` | Markdown processing |
| Document Mgmt | `src/store/DocumentManagementService.ts` | Document orchestration |
| Document Store | `src/store/DocumentStore.ts` | PostgreSQL operations |

---

## Crawl4AI Integration Points

### Fetcher Selection Logic

**Current AutoDetectFetcher Behavior:**

```typescript
// src/scraper/fetcher/AutoDetectFetcher.ts (CURRENT)
async fetch(source: string, options?: FetchOptions): Promise<RawContent> {
  // For file:// URLs, use FileFetcher
  if (this.fileFetcher.canFetch(source)) {
    return this.fileFetcher.fetch(source, options);
  }

  // For HTTP(S) URLs, try HttpFetcher first
  if (this.httpFetcher.canFetch(source)) {
    try {
      return await this.httpFetcher.fetch(source, options);
    } catch (error) {
      // Fallback to BrowserFetcher on challenge detection
      if (error instanceof ChallengeError) {
        return this.browserFetcher.fetch(source, options);
      }
      throw error;
    }
  }

  throw new Error(`No suitable fetcher found for URL: ${source}`);
}
```

**After Integration (PROPOSED):**

```typescript
// src/scraper/fetcher/AutoDetectFetcher.ts (PROPOSED)
async fetch(source: string, options?: FetchOptions): Promise<RawContent> {
  // For file:// URLs, use FileFetcher
  if (this.fileFetcher.canFetch(source)) {
    return this.fileFetcher.fetch(source, options);
  }

  // For HTTP(S) URLs, check if Crawl4AI is requested
  if (this.httpFetcher.canFetch(source)) {
    // NEW: Check for useCrawl4AI flag
    if (options?.useCrawl4AI) {
      logger.debug(`Using Crawl4AIFetcher for: ${source}`);
      return this.crawl4aiFetcher.fetch(source, options);
    }

    // Existing logic: try HttpFetcher first, fallback to BrowserFetcher
    try {
      return await this.httpFetcher.fetch(source, options);
    } catch (error) {
      if (error instanceof ChallengeError) {
        return this.browserFetcher.fetch(source, options);
      }
      throw error;
    }
  }

  throw new Error(`No suitable fetcher found for URL: ${source}`);
}
```

### Flag Propagation Chain

**How `useCrawl4AI` flows through the system:**

```
User API Request
  { library, version, sourceUrl, useCrawl4AI: true }
        ↓
ScraperOptions
  { url, library, version, useCrawl4AI: true, ... }
        ↓
WebScraperStrategy.processItem()
  Passes useCrawl4AI to fetch options
        ↓
FetchOptions
  { useCrawl4AI: true, timeout, signal, ... }
        ↓
AutoDetectFetcher.fetch()
  Checks options.useCrawl4AI
        ↓
Crawl4AIFetcher.fetch()
  Executes if flag is true
```

---

## Complete Data Flow

### Step-by-Step Flow (After Integration)

#### 1. Job Initialization

```typescript
// User creates scraping job via API
const job = {
  library: "react",
  version: "18.0.0",
  sourceUrl: "https://react.dev/reference/react",
  useCrawl4AI: true,  // NEW FLAG
  maxPages: 100,
  maxDepth: 3
};
```

#### 2. Pipeline Worker Execution

```typescript
// PipelineWorker.executeJob()
// File: src/pipeline/PipelineWorker.ts

await this.scraperService.scrape(
  runtimeOptions,
  async (progress: ScraperProgress) => {
    if (progress.document) {
      // Store each document as it's scraped
      await this.store.addDocument(library, version, {
        pageContent: progress.document.content,
        metadata: {
          ...progress.document.metadata,
          mimeType: progress.document.contentType,
        },
      });
    }
  },
  signal
);
```

#### 3. Strategy Selection & Fetch

```typescript
// ScraperService → WebScraperStrategy
// File: src/scraper/strategies/WebScraperStrategy.ts

const fetchOptions = {
  signal,
  followRedirects: options.followRedirects,
  headers: options.headers,
  useCrawl4AI: options.useCrawl4AI,  // NEW: Pass flag
};

const rawContent = await this.fetcher.fetch(url, fetchOptions);
```

#### 4. Crawl4AI Fetching

```typescript
// Crawl4AIFetcher.fetch()
// File: src/scraper/fetcher/crawl4ai/Crawl4AIFetcher.ts

// Request to Python service
const response = await this.client.crawl({
  url: source,
  config: {
    cacheMode: "enabled",
    useFitMarkdown: true,  // BM25-filtered markdown
    removeOverlays: true,
  }
});

// Return as RawContent
return {
  content: Buffer.from(markdown, "utf-8"),
  mimeType: "text/markdown",  // Pipeline selector uses this
  charset: "utf-8",
  source: finalUrl,
};
```

#### 5. Pipeline Processing

```typescript
// WebScraperStrategy.processItem()
// File: src/scraper/strategies/WebScraperStrategy.ts

// Find appropriate pipeline for content type
for (const pipeline of this.pipelines) {
  if (pipeline.canProcess(rawContent)) {
    // MarkdownPipeline selected for "text/markdown"
    processed = await pipeline.process(rawContent, options, this.fetcher);
    break;
  }
}

// Returns ProcessedContent with chunks
return {
  document: {
    content: processed.textContent,
    metadata: {
      url,
      title: processed.metadata.title,
      library: options.library,
      version: options.version,
      ...processed.metadata,
    },
    contentType: rawContent.mimeType,  // "text/markdown"
  },
  links: filteredLinks,
};
```

#### 6. Document Storage

```typescript
// DocumentManagementService.addDocument()
// File: src/store/DocumentManagementService.ts

// Find pipeline for content type
const pipeline = this.pipelines.find(p =>
  p.canProcess({ mimeType: document.metadata.mimeType })
);

// Process through pipeline (creates chunks)
const processed = await pipeline.process(rawContent, scraperOptions);
const chunks = processed.chunks;

// Convert chunks to documents
const splitDocs = chunks.map((chunk: ContentChunk) => ({
  pageContent: chunk.content,
  metadata: {
    ...document.metadata,
    level: chunk.section.level,
    path: chunk.section.path,
  },
}));

// Store in PostgreSQL
await this.store.addDocuments(library, version, splitDocs);
```

#### 7. Database Storage

```typescript
// DocumentStore.addDocuments()
// File: src/store/DocumentStore.ts

// 1. Resolve library and version IDs
const versionId = await this.resolveVersionId(library, version);

// 2. Create or get page record
const pageId = await this.getOrCreatePage(versionId, {
  url: document.metadata.url,
  title: document.metadata.title,
  contentType: document.metadata.mimeType,  // "text/markdown"
});

// 3. Generate embeddings for chunks
const embeddings = await this.embeddings.embedDocuments(
  documents.map(doc => doc.pageContent)
);

// 4. Insert chunks with embeddings
for (let i = 0; i < documents.length; i++) {
  await this.db.run(`
    INSERT INTO documents (page_id, content, embedding, metadata, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `, [
    pageId,
    documents[i].pageContent,
    embeddings[i],  // vector(1536)
    JSON.stringify(documents[i].metadata),
    i
  ]);
}
```

---

## Database Storage Schema

### Table Structure

```sql
-- Libraries table
CREATE TABLE libraries (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Versions table (stores scraper_options JSON)
CREATE TABLE versions (
  id SERIAL PRIMARY KEY,
  library_id INTEGER REFERENCES libraries(id),
  name TEXT,  -- NULL for unversioned
  status TEXT NOT NULL DEFAULT 'not_indexed',
  source_url TEXT,
  scraper_options TEXT,  -- JSON: { useCrawl4AI: true, ... }
  progress_pages INTEGER DEFAULT 0,
  progress_max_pages INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(library_id, name)
);

-- Pages table (normalized page metadata)
CREATE TABLE pages (
  id SERIAL PRIMARY KEY,
  version_id INTEGER REFERENCES versions(id),
  url TEXT NOT NULL,
  title TEXT,
  content_type TEXT,  -- "text/markdown" for Crawl4AI
  etag TEXT,
  last_modified TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(version_id, url)
);

-- Documents table (chunks with embeddings)
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  page_id INTEGER REFERENCES pages(id),
  content TEXT NOT NULL,
  embedding VECTOR(1536),  -- pgvector type
  metadata TEXT,  -- JSON: { level, path, ... }
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Example Data Flow

**Input:** Crawl4AI scrapes React documentation page

**Database Records Created:**

```sql
-- 1. Library record
INSERT INTO libraries (name) VALUES ('react');
-- Result: id = 1

-- 2. Version record with scraper options
INSERT INTO versions (library_id, name, source_url, scraper_options)
VALUES (
  1,
  '18.0.0',
  'https://react.dev/reference/react',
  '{"useCrawl4AI":true,"maxPages":100,"maxDepth":3}'
);
-- Result: id = 101

-- 3. Page record
INSERT INTO pages (version_id, url, title, content_type)
VALUES (
  101,
  'https://react.dev/reference/react/useState',
  'useState - React',
  'text/markdown'
);
-- Result: id = 5001

-- 4. Document chunks (multiple)
INSERT INTO documents (page_id, content, embedding, metadata, sort_order)
VALUES
  (5001, 'useState is a React Hook...', '[0.123, -0.456, ...]', '{"level":1,"path":"useState"}', 0),
  (5001, 'Parameters: initialState...', '[0.789, 0.234, ...]', '{"level":2,"path":"useState > Parameters"}', 1),
  (5001, 'Returns an array with...', '[-0.345, 0.678, ...]', '{"level":2,"path":"useState > Returns"}', 2);
```

---

## Content Processing Pipeline

### Markdown Pipeline Workflow

**File:** `src/scraper/pipelines/MarkdownPipeline.ts`

```typescript
// 1. Accept RawContent
interface RawContent {
  content: Buffer,           // Markdown from Crawl4AI
  mimeType: "text/markdown",
  source: "https://..."
}

// 2. Extract metadata (title, headings)
metadata = extractMarkdownMetadata(markdown);

// 3. Split into semantic chunks
chunks = await semanticSplitter.split({
  content: markdown,
  mimeType: "text/markdown"
});

// 4. Return ProcessedContent
return {
  textContent: markdown,
  chunks: chunks,  // Array of ContentChunk
  metadata: metadata,
  errors: []
};
```

### Chunk Structure

```typescript
interface ContentChunk {
  content: string,           // Chunk text content
  section: {
    level: number,           // Heading level (1-6)
    path: string,            // "useState > Parameters"
    title: string            // "Parameters"
  },
  metadata: {
    url: string,
    title: string,
    mimeType: string,
    // ... other metadata
  }
}
```

---

## Embedding Generation

### Embedding Service Integration

**File:** `src/store/DocumentStore.ts`

```typescript
// Embeddings service configured in DocumentManagementService
const embeddingConfig = {
  provider: "openai",  // or "ollama", "infinity"
  model: "text-embedding-ada-002",
  dimensions: 1536
};

// Generate embeddings for batch of chunks
const embeddings = await this.embeddings.embedDocuments([
  "useState is a React Hook...",
  "Parameters: initialState...",
  "Returns an array with..."
]);

// Result: Array of Float32Arrays
// embeddings[0] = [0.123, -0.456, 0.789, ..., 0.234]  // 1536 dimensions
```

### Vector Storage

```sql
-- pgvector storage in PostgreSQL
CREATE TABLE documents (
  embedding VECTOR(1536)  -- Native pgvector type
);

-- Vector similarity search (hybrid with FTS)
SELECT
  d.content,
  d.embedding <=> $1 AS distance  -- Cosine distance
FROM documents d
WHERE d.page_id IN (SELECT id FROM pages WHERE version_id = $2)
ORDER BY d.embedding <=> $1
LIMIT 10;
```

---

## Search Flow

### Hybrid Search (Vector + FTS)

**After content is stored, users can search:**

```typescript
// User searches for "useState hook"
const results = await documentRetriever.search(
  "react",          // library
  "18.0.0",         // version
  "useState hook",  // query
  5                 // limit
);

// Hybrid search combines:
// 1. Vector similarity (pgvector)
// 2. Full-text search (PostgreSQL FTS)
// 3. Reciprocal Rank Fusion (RRF) for ranking

// Returns StoreSearchResult[]
[
  {
    url: "https://react.dev/reference/react/useState",
    content: "useState is a React Hook that lets you add state...",
    score: 0.89,
    mimeType: "text/markdown"
  },
  // ... more results
]
```

---

## Summary

### Key Takeaways

1. **No Schema Changes Needed** - Existing tables support Crawl4AI content
2. **Flag-Based Selection** - `useCrawl4AI` stored in `scraper_options` JSON
3. **Markdown Pipeline** - Existing pipeline handles Crawl4AI markdown output
4. **Full Integration** - Content flows from Crawl4AI → PostgreSQL → Vector Search
5. **Backward Compatible** - Existing workflows unaffected (flag defaults to false)

### Data Flow Diagram

```
┌──────────────┐
│ User Request │ useCrawl4AI: true
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ PipelineWorker   │ Orchestrates job
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ WebScraperStrategy│ Passes flag to fetcher
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ AutoDetectFetcher │ Checks useCrawl4AI flag
└──────┬───────────┘
       │ [if useCrawl4AI=true]
       ▼
┌──────────────────┐
│ Crawl4AIFetcher  │ Returns markdown RawContent
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ MarkdownPipeline │ Processes & chunks content
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ DocumentStore    │ Generates embeddings
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ PostgreSQL       │ Stores chunks + vectors
└──────────────────┘
```

---

**Next:** See `integration-strategy.md` for Architecture Decision Records (ADRs).
