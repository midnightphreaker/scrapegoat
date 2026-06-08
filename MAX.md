# ScrapeGoat Limits and Maximum Values

This document lists all limits, maximum values, caps, and thresholds defined in the ScrapeGoat codebase.

## Format
Each entry: `Name ; File:line ; Value ; Context/Variable`

---

## Infrastructure & Docker

### Memory Limits (docker-compose.yml, docker-compose.postgres.yml)

| Service | Limit Variable | Default Value |
|---------|---------------|---------------|
| Worker | `SCRAPEGOAT_WORKER_MEMORY_LIMIT` | 2G |
| Worker reservation | `SCRAPEGOAT_WORKER_MEMORY_RESERVATION` | 1G |
| MCP | `SCRAPEGOAT_MCP_MEMORY_LIMIT` | 512M |
| MCP reservation | `SCRAPEGOAT_MCP_MEMORY_RESERVATION` | 256M |
| Web | `SCRAPEGOAT_WEB_MEMORY_LIMIT` | 512M |
| Web reservation | `SCRAPEGOAT_WEB_MEMORY_RESERVATION` | 256M |

**Locations:**
- docker-compose.yml:45 - `memory: ${SCRAPEGOAT_WORKER_MEMORY_LIMIT:-2G}`
- docker-compose.yml:47 - `memory: ${SCRAPEGOAT_WORKER_MEMORY_RESERVATION:-1G}`
- docker-compose.yml:86 - `memory: ${SCRAPEGOAT_MCP_MEMORY_LIMIT:-512M}`
- docker-compose.yml:88 - `memory: ${SCRAPEGOAT_MCP_MEMORY_RESERVATION:-256M}`
- docker-compose.yml:129 - `memory: ${SCRAPEGOAT_WEB_MEMORY_LIMIT:-512M}`
- docker-compose.yml:131 - `memory: ${SCRAPEGOAT_WEB_MEMORY_RESERVATION:-256M}`
- docker-compose.postgres.yml:68 - `memory: ${SCRAPEGOAT_WORKER_MEMORY_LIMIT:-2G}`
- docker-compose.postgres.yml:70 - `memory: ${SCRAPEGOAT_WORKER_MEMORY_RESERVATION:-1G}`
- docker-compose.postgres.yml:108 - `memory: ${SCRAPEGOAT_MCP_MEMORY_LIMIT:-512M}`
- docker-compose.postgres.yml:110 - `memory: ${SCRAPEGOAT_MCP_MEMORY_RESERVATION:-256M}`
- docker-compose.postgres.yml:152 - `memory: ${SCRAPEGOAT_WEB_MEMORY_LIMIT:-512M}`
- docker-compose.postgres.yml:154 - `memory: ${SCRAPEGOAT_WEB_MEMORY_RESERVATION:-256M}`

### Healthcheck Timeouts

- **interval**: 5s (all services)
- **timeout**: 3s (worker/mcp/web), 5s (postgres)
- **retries**: 10 (worker/mcp/web), 5 (postgres)
- **start_period**: 10s (all services)

**Locations:**
- docker-compose.yml:38-41 (worker healthcheck)
- docker-compose.yml:60-63 (worker in postgres compose)
- docker-compose.postgres.yml:27-31 (postgres healthcheck)

### Port Bindings

| Service | Default Port | Env Variable |
|---------|--------------|--------------|
| Worker | 8080 | `SCRAPEGOAT_WORKER_HOST_PORT` |
| MCP | 6280 | `SCRAPEGOAT_MCP_HOST_PORT` |
| Web | 6281 | `SCRAPEGOAT_WEB_HOST_PORT` |
| Database | 5432 | `SCRAPEGOAT_DB_HOST_PORT` |

**Locations:**
- docker-compose.yml:22 - worker port mapping
- docker-compose.yml:71 - mcp port mapping
- docker-compose.yml:110 - web port mapping
- docker-compose.postgres.yml:19 - postgres port mapping

---

## Application Configuration (src/utils/config.ts)

### Server Limits

| Limit | Value | Variable |
|-------|-------|----------|
| Default port | 6280 | `server.ports.default` |
| Worker port | 8080 | `server.ports.worker` |
| MCP port | 6280 | `server.ports.mcp` |
| Web port | 6281 | `server.ports.web` |
| Heartbeat interval | 30,000ms | `server.heartbeatMs` |

**Location:** src/utils/config.ts:50-56

### Scraper Limits

| Limit | Value | Variable |
|-------|-------|----------|
| Max pages per job | 3,800 | `scraper.maxPages` |
| Max crawl depth | 9 | `scraper.maxDepth` |
| Max concurrency | 14 | `scraper.maxConcurrency` |
| Page timeout | 5,000ms | `scraper.pageTimeoutMs` |
| Browser timeout | 30,000ms | `scraper.browserTimeoutMs` |
| Max retries | 9 | `scraper.fetcher.maxRetries` |
| Base retry delay | 1,000ms | `scraper.fetcher.baseDelayMs` |
| Max cache items | 200 | `scraper.fetcher.maxCacheItems` |
| Max cache item size | 500KB (512,000 bytes) | `scraper.fetcher.maxCacheItemSizeBytes` |
| Max document size | ~1GB (1,048,576,000 bytes) | `scraper.document.maxSize` |

**Location:** src/utils/config.ts:63-77

### Splitter Limits

| Limit | Value | Variable |
|-------|-------|----------|
| Min chunk size | 500 chars | `splitter.minChunkSize` |
| Preferred chunk size | 1,500 chars | `splitter.preferredChunkSize` |
| Max chunk size | 5,000 chars | `splitter.maxChunkSize` |
| TreeSitter size limit | 30,000 chars | `splitter.treeSitterSizeLimit` |
| JSON max nesting depth | 5 | `splitter.json.maxNestingDepth` |
| JSON max chunks | 1,000 | `splitter.json.maxChunks` |

**Location:** src/utils/config.ts:79-87

### Embedding Limits

| Limit | Value | Variable |
|-------|-------|----------|
| Batch size | 100 chunks | `embeddings.batchSize` |
| Batch chars | 50,000 chars | `embeddings.batchChars` |
| Request timeout | 30,000ms | `embeddings.requestTimeoutMs` |
| Init timeout | 30,000ms | `embeddings.initTimeoutMs` |
| Vector dimension | 1,536 | `embeddings.vectorDimension` |
| API batch size | 512 | `embeddings.apiBatchSize` |

**Location:** src/utils/config.ts:89-101

### Database Pool Limits

| Limit | Value | Variable |
|-------|-------|----------|
| Max pool size | 10 connections | `database.pool.max` |
| Min pool size | 2 connections | `database.pool.min` |
| Idle timeout | 10,000ms | `database.pool.idleTimeoutMillis` |
| Connection timeout | 5,000ms | `database.pool.connectionTimeoutMillis` |
| Migration max retries | 5 | `db.migrationMaxRetries` |
| Migration retry delay | 300ms | `db.migrationRetryDelayMs` |

**Location:** src/utils/config.ts:102-114

### Search Limits

| Limit | Value | Variable |
|-------|-------|----------|
| Overfetch factor | 2 | `search.overfetchFactor` |
| Vector weight | 1 | `search.weightVec` |
| FTS weight | 1 | `search.weightFts` |
| Vector multiplier | 10 | `search.vectorMultiplier` |
| RRF K constant | 60 | `search.rrfK` |

**Location:** src/utils/config.ts:116-122

### Sandbox Limits

| Limit | Value | Variable |
|-------|-------|----------|
| Default timeout | 5,000ms | `sandbox.defaultTimeoutMs` |

**Location:** src/utils/config.ts:124-125

### Assembly Limits

| Limit | Value | Variable |
|-------|-------|----------|
| Max parent chain depth | 10 | `assembly.maxParentChainDepth` |
| Child limit | 3 | `assembly.childLimit` |
| Preceding siblings limit | 1 | `assembly.precedingSiblingsLimit` |
| Subsequent siblings limit | 2 | `assembly.subsequentSiblingsLimit` |
| Max chunk distance | 3 | `assembly.maxChunkDistance` |

**Location:** src/utils/config.ts:127-132

### Web Import Limits

| Limit | Value | Variable |
|-------|-------|----------|
| Max total size | 2GB (2,147,483,648 bytes) | `webImport.maxTotalSizeBytes` |
| Max file size | 128MB (134,217,728 bytes) | `webImport.maxFileSizeBytes` |
| Max files | 9,999 | `webImport.maxFiles` |
| Session TTL | 3,600 seconds | `webImport.sessionTtlSeconds` |
| Max archive compressed | 512MB (536,870,912 bytes) | `webImport.maxArchiveCompressedBytes` |
| Max depth | 9 | `webImport.maxDepth` |
| Max filename length | 99 chars | `webImport.maxFilenameLength` |
| Max path length | 255 chars | `webImport.maxPathLength` |

**Location:** src/utils/config.ts:134-145

### Pipeline Cancel Timeout

| Limit | Value | Variable |
|-------|-------|----------|
| Cancel timeout (default) | 60,000ms | `cancelTimeoutMs` |

**Location:** src/pipeline/PipelineManager.ts:86

---

## Environment Variables (.env.example)

### Embedding Tuning

| Variable | Default | Description |
|----------|---------|-------------|
| `SCRAPEGOAT_EMBEDDINGS_BATCH_SIZE` | 100 | Max chunks per embedding cycle |
| `SCRAPEGOAT_EMBEDDINGS_BATCH_CHARS` | 50,000 | Max chars per embedding request |
| `SCRAPEGOAT_EMBEDDINGS_API_BATCH_SIZE` | 512 | SDK-level batch size (OpenAI) |
| `SCRAPEGOAT_EMBEDDINGS_REQUEST_TIMEOUT_MS` | 30,000 | Per-request timeout |
| `SCRAPEGOAT_EMBEDDINGS_INIT_TIMEOUT_MS` | 30,000 | Initial test timeout |

**Location:** .env.example:129-141

### Search Tuning

| Variable | Default | Description |
|----------|---------|-------------|
| `SCRAPEGOAT_SEARCH_WEIGHT_VEC` | 1 | Vector weight in hybrid scoring |
| `SCRAPEGOAT_SEARCH_WEIGHT_FTS` | 1 | FTS weight in hybrid scoring |
| `SCRAPEGOAT_SEARCH_VECTOR_MULTIPLIER` | 10 | Vector overfetch multiplier |
| `SCRAPEGOAT_SEARCH_OVERFETCH_FACTOR` | 2 | FTS overfetch multiplier |
| `SCRAPEGOAT_SEARCH_RRF_K` | 60 | RRF smoothing constant (min 1) |

**Location:** .env.example:147-155

### Splitter Tuning

| Variable | Default | Description |
|----------|---------|-------------|
| `SCRAPEGOAT_SPLITTER_MIN_CHUNK_SIZE` | 500 | Min chunk body size |
| `SCRAPEGOAT_SPLITTER_PREFERRED_CHUNK_SIZE` | 1,500 | Soft chunk target |
| `SCRAPEGOAT_SPLITTER_MAX_CHUNK_SIZE` | 5,000 | Hard chunk limit |

**Location:** .env.example:161-165

### Scraper Throughput

| Variable | Default | Description |
|----------|---------|-------------|
| `SCRAPEGOAT_SCRAPER_MAX_CONCURRENCY` | 3 | Concurrent page fetches |

**Location:** .env.example:171

### Database

| Variable | Default | Description |
|----------|---------|-------------|
| `SCRAPEGOAT_DB_HOST_PORT` | 5432 | PostgreSQL port |
| `SCRAPEGOAT_DB_VECTOR_SIZE` | 1536 | Vector embedding dimension |

**Location:** .env.example:28,36

### Service Ports

| Variable | Default | Description |
|----------|---------|-------------|
| `SCRAPEGOAT_PORT` | 6280 | Main port |
| `SCRAPEGOAT_WEB_PORT` | 6281 | Web interface port |
| `SCRAPEGOAT_WORKER_HOST_PORT` | 8080 | Worker port |
| `SCRAPEGOAT_MCP_HOST_PORT` | 6280 | MCP port |

**Location:** .env.example:48-56

---

## Testing Configuration (vite.config.ts)

| Limit | Value | Description |
|-------|-------|-------------|
| Test timeout | 30,000ms (30s) | Network operations timeout |

**Location:** vite.config.ts:78

---

## Upload Configuration (src/upload/types.ts)

| Limit | Value | Variable |
|-------|-------|----------|
| Max total size | 2GB (2,048MB) | `maxTotalSizeBytes` |
| Max file size | 128MB | `maxFileSizeBytes` |
| Max files per session | 9,999 | `maxFiles` |
| Session TTL | 3,600s (1h) | `sessionTtlSeconds` |
| Max archive entries | 9,999 | `maxArchiveEntries` |
| Max archive uncompressed | 2GB | `maxArchiveUncompressedBytes` |
| Max archive compressed | 512MB | `maxArchiveCompressedBytes` |
| Max directory depth | 9 | `maxDepth` |
| Max filename length | 99 chars | `maxFilenameLength` |
| Max path length | 255 chars | `maxPathLength` |

**Location:** src/upload/types.ts:134-146

---

## Event Proxy Limits (src/events/RemoteEventProxy.ts)

| Limit | Value | Variable |
|-------|-------|----------|
| Max reconnect attempts | 10 | `maxReconnectAttempts` |
| Base reconnect delay | 1,000ms | `baseReconnectDelay` |
| Max reconnect delay | 30,000ms | `maxReconnectDelay` |

**Location:** src/events/RemoteEventProxy.ts:33-39

---

## Pipeline Client Limits (src/pipeline/PipelineClient.ts)

| Limit | Value | Variable |
|-------|-------|----------|
| Job completion timeout | 300,000ms (5min) | `timeoutMs` |

**Location:** src/pipeline/PipelineClient.ts:193

---

## Web Route Limits

### Upload Route (src/web/routes/upload/index.ts)

| Limit | Value | Variable |
|-------|-------|----------|
| Max concurrent file uploads | 50 | `files` |

**Location:** src/web/routes/upload/index.ts:69

### Library Detail Search (src/web/routes/libraries/detail.tsx)

| Limit | Value | Variable |
|-------|-------|----------|
| Search results limit | 10 | `limit` |

**Location:** src/web/routes/libraries/detail.tsx:126

---

## HTTP Fetcher Limits (src/scraper/fetcher/HttpFetcher.ts)

| Limit | Value | Variable |
|-------|-------|----------|
| Max redirects | 5 | `maxRedirects` |

**Location:** src/scraper/fetcher/HttpFetcher.ts:137

---

## Tool Limits

### SearchTool (src/tools/SearchTool.ts)

| Limit | Value | Variable |
|-------|-------|----------|
| Default search limit | 5 | `limit` |
| Max search limit | 100 | `limit` |

**Location:** src/tools/SearchTool.ts:43, src/tools/SearchTool.ts:60

### FetchUrlTool (src/tools/FetchUrlTool.ts)

| Limit | Value | Variable |
|-------|-------|----------|
| Max retries | 3 | `maxRetries` |

**Location:** src/tools/FetchUrlTool.ts:86

### Search Provider (src/tools/search-provider.ts)

| Limit | Value | Variable |
|-------|-------|----------|
| Default search limit | 5 | `limit` |

**Location:** src/tools/search-provider.ts:96

---

## Node.js & Package Configuration (package.json)

| Limit | Value | Description |
|-------|-------|-------------|
| Node version | >=22 | Minimum Node.js version |
| NPM override | 10.9.3 | Pinned npm version |

**Location:** package.json:157-162

---

## Summary Table

| Category | Count |
|----------|-------|
| Memory limits | 12 |
| Port bindings | 4 |
| Healthcheck settings | 4 |
| Scraper limits | 10 |
| Splitter limits | 6 |
| Embedding limits | 6 |
| Database pool limits | 6 |
| Search config | 5 |
| Sandbox limits | 1 |
| Assembly limits | 5 |
| Web import limits | 8 |
| Pipeline timeout | 1 |
| Upload config | 10 |
| Event proxy limits | 3 |
| Pipeline client timeout | 1 |
| Upload route limits | 1 |
| Library search limit | 1 |
| HTTP fetcher limits | 1 |
| Tool limits | 4 |
| Test timeout | 1 |
| Node/NPM version | 2 |

**Total: 93 limits/max values**