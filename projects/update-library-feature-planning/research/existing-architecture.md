# Existing Architecture Analysis

**Date**: 2025-11-25
**Status**: Complete

---

## Architecture Overview

ScrapeGoat uses a three-layer architecture for document scraping and storage:

1. **Pipeline Layer** - Job queue and execution management
2. **Scraper Layer** - Document fetching and processing
3. **Store Layer** - Database persistence (PostgreSQL + pgvector)

---

## Pipeline Layer Architecture

### PipelineManager (`src/pipeline/PipelineManager.ts`)

**Purpose**: Orchestrates scraping job queue with concurrency control

**Key Methods**:
```typescript
// Line 238: Creates new scrape job
async enqueueJob(library, version, options): Promise<string>

// Line 329: RE-SCRAPES using stored settings (PERFECT FOR UPDATE FEATURE!)
async enqueueJobWithStoredOptions(library, version): Promise<string> {
  // 1. Gets version ID
  // 2. Retrieves stored scraper_options from database
  // 3. Reconstructs complete ScraperOptions
  // 4. Calls enqueueJob() with stored settings
}

// Line 134: Recovers pending jobs after restart
async recoverPendingJobs(): Promise<void>

// Line 417: Cancels running jobs
async cancelJob(jobId): Promise<void>
```

**Job Queue Mechanism**:
- In-memory job queue: `jobQueue: string[]`
- Job state map: `jobMap: Map<string, InternalPipelineJob>`
- Concurrency control via `activeWorkers: Set<string>`
- Database persistence via `versions` table

**Job Status Flow**:
```
QUEUED → RUNNING → COMPLETED
                 ↓ FAILED
                 ↓ CANCELLED
```

**Write-Through Caching Pattern**:
- Updates both in-memory job state AND database simultaneously
- `updateJobStatus()` writes to `versions` table
- `updateJobProgress()` writes progress counters
- Ensures consistency across restarts

### PipelineWorker (`src/pipeline/PipelineWorker.ts`)

**Purpose**: Executes individual scraping jobs

**Critical Code Flow**:
```typescript
// Line 28: executeJob() method
async executeJob(job, callbacks) {
  // ⚠️ CRITICAL LINE 46 - DATA LOSS VULNERABILITY!
  await this.store.removeAllDocuments(library, version);

  // Lines 60-100: Scrape documents
  await this.scraperService.scrape(options, progressCallback, signal);

  // Progress callback stores each document as it arrives
  await this.store.addDocument(library, version, document);
}
```

**Problem**: If scraping fails after line 46, all documents are deleted with NO backup!

---

## Store Layer Architecture

### DocumentStore (`src/store/DocumentStore.ts`)

**Database Schema**:

#### 1. Libraries Table
```sql
CREATE TABLE libraries (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);
```

#### 2. Versions Table
```sql
CREATE TABLE versions (
  id SERIAL PRIMARY KEY,
  library_id INTEGER REFERENCES libraries(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL,  -- QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED
  source_url TEXT,
  scraper_options JSONB,  -- ⭐ STORES ALL SCRAPE SETTINGS!
  progress_pages INTEGER DEFAULT 0,
  progress_max_pages INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(library_id, name)
);
```

**Key Fields for Update Feature**:
- `scraper_options` (JSONB): Stores complete scraper configuration
  - `fetcher`: 'auto' | 'http' | 'crawl4ai'
  - `scope`: 'subpages' | 'hostname' | 'domain'
  - `maxDepth`: number
  - `maxPages`: number
  - `followRedirects`: boolean
  - And all other ScraperOptions fields

- `source_url`: Original documentation URL
- `status`: Current job status

#### 3. Pages Table
```sql
CREATE TABLE pages (
  id SERIAL PRIMARY KEY,
  version_id INTEGER REFERENCES versions(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  etag TEXT,
  last_modified TEXT,
  content_type TEXT,
  screenshot_path TEXT,
  fetcher_type TEXT,
  metadata JSONB,
  UNIQUE(version_id, url)  -- ⭐ UPSERT capability!
);
```

**UPSERT Pattern** (Line 684-694):
```typescript
INSERT INTO pages (...) VALUES (...)
ON CONFLICT (version_id, url) DO UPDATE SET
  title = EXCLUDED.title,
  etag = EXCLUDED.etag,
  ... // Updates existing pages
RETURNING id
```

**Implication**: Pages get updated automatically on re-scrape!

#### 4. Documents Table
```sql
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  page_id INTEGER REFERENCES pages(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR(3072),  -- pgvector for semantic search
  metadata JSONB,
  sort_order INTEGER DEFAULT 0
);
```

**DELETE-then-INSERT Pattern** (Lines 722-734):
```typescript
// Line 722: Delete existing documents for this page
await this.pool.query("DELETE FROM documents WHERE page_id = $1", [pageId]);

// Line 725: Insert new documents
for (let i = 0; i < urlDocs.length; i++) {
  await this.pool.query(
    `INSERT INTO documents (page_id, content, embedding, metadata, sort_order)
     VALUES ($1, $2, $3::vector, $4, $5)`,
    [pageId, doc.pageContent, embeddingStr, JSON.stringify(doc.metadata), i]
  );
}
```

**Implication**: Documents replaced atomically per-page, but NO rollback if job fails!

### Key Methods

#### Scraper Options Persistence

```typescript
// Line 480: Store scraper configuration
async storeScraperOptions(versionId: number, options: ScraperOptions): Promise<void> {
  await this.pool.query(
    `UPDATE versions SET scraper_options = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [JSON.stringify(options), versionId]
  );
}

// Line 499: Retrieve stored configuration
async getScraperOptions(versionId: number): Promise<StoredScraperOptions | null> {
  const result = await this.pool.query(
    `SELECT source_url, scraper_options FROM versions WHERE id = $1`,
    [versionId]
  );
  return {
    sourceUrl: row.source_url,
    options: row.scraper_options ? JSON.parse(row.scraper_options) : null
  };
}
```

**Perfect for Update Feature**: All settings already persisted!

#### Document Management

```typescript
// Line 747: Delete all documents for a version (DANGEROUS!)
async deleteDocuments(library: string, version: string): Promise<number>

// Line 643: Add documents with UPSERT on pages
async addDocuments(library: string, version: string, documents: Document[]): Promise<void>

// Line 802: Remove entire version (CASCADE deletes pages & documents)
async removeVersion(library, version, removeLibraryIfEmpty): Promise<RemoveResult>
```

---

## Web UI Architecture

### Frontend Stack
- **htmx**: Server-driven interactivity
- **AlpineJS**: Client-side state management
- **TailwindCSS + Flowbite**: Styling
- **JSX (FastifyDX)**: Component rendering

### Component Hierarchy

```
routes/libraries/list.tsx
  └─> LibraryList.tsx
        └─> LibraryItem.tsx
              └─> VersionDetailsRow.tsx ⭐ (Add update button here!)
```

### VersionDetailsRow Component (`src/web/components/VersionDetailsRow.tsx`)

**Current Delete Button** (Lines 92-160):
```tsx
<button
  type="button"
  x-data="{}"
  x-bind:class="..." // Alpine state binding
  x-on:click="..."   // Confirmation logic
  hx-delete={`/web/libraries/${library}/versions/${version}`}
  hx-target={`#${rowId}`}
  hx-swap="outerHTML"
  hx-trigger="confirmed-delete"
>
  {/* Three states: Icon → Confirm → Spinner */}
</button>
```

**Pattern for Update Button**:
- Use same AlpineJS state management
- Different icon (circular arrows)
- Different color (blue instead of red)
- POST instead of DELETE
- Different confirmation message

### Backend Routes (`src/web/routes/libraries/list.tsx`)

**Current DELETE Endpoint** (Lines 32-51):
```typescript
server.delete<{ Params: { libraryName: string; versionParam: string } }>(
  "/web/libraries/:libraryName/versions/:versionParam",
  async (request, reply) => {
    const { libraryName, versionParam } = request.params;
    const version = versionParam === "unversioned" ? undefined : versionParam;
    await removeTool.execute({ library: libraryName, version });
    reply.status(204).send();
  }
);
```

**Need to Add**: POST/PUT endpoint for update
```typescript
server.post<{ Params: { libraryName: string; versionParam: string } }>(
  "/web/libraries/:libraryName/versions/:versionParam/update",
  async (request, reply) => {
    // Call pipelineManager.enqueueJobWithStoredOptions()
    // Return job ID or success status
  }
);
```

---

## Data Flow: Current Scraping Process

```
1. User triggers scrape (UI or CLI)
   ↓
2. PipelineManager.enqueueJob(library, version, options)
   ↓
3. Store options in database: versions.scraper_options
   ↓
4. Job added to queue (in-memory + database)
   ↓
5. PipelineWorker picks up job
   ↓
6. ⚠️ removeAllDocuments(library, version) -- DELETES EVERYTHING!
   ↓
7. ScraperService.scrape() fetches pages
   ↓
8. For each document:
   - store.addDocument() → UPSERT page, INSERT documents
   ↓
9. Job completes → status = COMPLETED
```

**Problem**: If step 7-8 fail, data from step 6 is permanently lost!

---

## Data Flow: Proposed Update Process

```
1. User clicks Update button
   ↓
2. Frontend: POST /web/libraries/{lib}/versions/{ver}/update
   ↓
3. Backend: pipelineManager.enqueueJobWithStoredOptions(lib, ver)
   ↓
4. Retrieve scraper_options from database
   ↓
5. Create snapshot/backup of existing documents ⭐ NEW!
   ↓
6. Job added to queue
   ↓
7. PipelineWorker executes with backup protection ⭐ MODIFIED!
   ↓
8. Quality validation on scraped content ⭐ NEW!
   ↓
9. On success: Commit new documents, delete backup
   On error: User chooses:
     a) Keep cleaned data (discard bad pages only)
     b) Rollback to backup (restore all old data)
```

---

## Integration Points for Update Feature

### ✅ Already Available (No Changes Needed)
1. `PipelineManager.enqueueJobWithStoredOptions()` - Core re-scrape logic
2. `DocumentStore.getScraperOptions()` - Retrieve settings
3. `DocumentStore.storeScraperOptions()` - Persist settings
4. UPSERT on pages table - Automatic page updates

### ⚠️ Needs Implementation (New Code Required)
1. Document snapshot/backup system
2. Quality validation (detect blank, corrupt, error pages)
3. Rollback mechanism
4. Two-phase commit pattern
5. Update button UI component
6. Update API endpoint
7. Error handling with user choice

### 🔧 Needs Modification (Existing Code Changes)
1. `PipelineWorker.executeJob()` - Add backup/rollback logic
2. `DocumentStore` - Add snapshot methods

---

## Technology Constraints

### Database
- PostgreSQL 12+ (for pgvector)
- JSONB for flexible metadata storage
- ON CONFLICT for UPSERT operations
- CASCADE DELETE for referential integrity

### Runtime
- Node.js + TypeScript
- Fastify web framework
- LangChain for document processing
- Job queue in-memory (not Redis/BullMQ)

### Frontend
- Server-side rendering (no React/Vue)
- Progressive enhancement (htmx)
- Minimal JavaScript (AlpineJS for state)

---

## Performance Considerations

### Current Behavior
- Documents deleted synchronously (blocking)
- New documents inserted one-by-one (slow for large libraries)
- No transaction boundaries across pages

### Implications for Update Feature
- Snapshot creation could be slow for large libraries (100K+ docs)
- Need to balance between:
  - Full snapshot (safe but slow)
  - Incremental snapshot (faster but complex)
  - Log-based rollback (minimal overhead)

---

## Conclusion

**Good News**:
- 80% of infrastructure already exists!
- `enqueueJobWithStoredOptions()` is exactly what we need
- Database schema already supports everything

**Bad News**:
- Critical data loss vulnerability must be fixed FIRST
- No versioning/backup system exists
- Requires careful transaction management

**Recommendation**:
Implement in phases:
1. Fix data loss vulnerability (benefits all scrapes, not just updates)
2. Add quality validation
3. Add UI button (trivial once backend is ready)

---

*Last Updated: 2025-11-25*
