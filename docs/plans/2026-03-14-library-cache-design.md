# Library List Caching Strategy

## Problem

The webui's library list takes 20+ seconds to load on every page refresh because:
1. Heavy database query (4-table JOIN with aggregations)
2. No server-side caching
3. Client-side store cache resets on page refresh

## Solution

In-memory server cache with HTTP ETag validation and explicit invalidation on mutations.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER                                   │
│  HTTP Cache stores response + ETag                              │
│  On refresh: sends If-None-Match header                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FASTIFY SERVER                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ In-Memory LRU Cache                                       │   │
│  │ - Key: 'libraries:list'                                   │   │
│  │ - Value: { etag, data, timestamp }                        │   │
│  │ - TTL: 5 minutes                                          │   │
│  │ - Max entries: 100                                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Cache Middleware (tRPC)                                   │   │
│  │ - Check cache → return 304 if ETag matches                │   │
│  │ - Generate ETag from data hash                            │   │
│  │ - Set Cache-Control: max-age=300                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Invalidation Hook                                         │   │
│  │ - Called on: scrape, webhook, MCP mutations               │   │
│  │ - Clears cache entries by pattern                         │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. CacheService (`src/services/CacheService.ts`)

LRU cache wrapper with TTL support.

```typescript
interface CacheEntry<T> {
  etag: string;
  data: T;
  timestamp: number;
}

class CacheService {
  get<T>(key: string): CacheEntry<T> | null;
  set<T>(key: string, data: T, ttl?: number): CacheEntry<T>;
  invalidate(pattern: string): void;  // Wildcard: 'libraries:*'
  clear(): void;
}
```

### 2. ETag Utility (`src/utils/etag.ts`)

Generate stable hash from JSON data.

- Algorithm: xxhash (fast, collision-resistant)
- Input: `JSON.stringify(data)` with sorted keys
- Format: `"xxh64:<hash>"`

### 3. Cache Middleware (tRPC)

Wraps read-only procedures:

```typescript
const cachedProcedure = publicProcedure.use(cacheMiddleware({
  cacheKey: 'libraries:list',
  ttl: 300
}));
```

### 4. Invalidation Hook

Called after mutations:

```typescript
function invalidateLibrariesCache() {
  cacheService.invalidate('libraries:*');
}
```

## HTTP Headers

| Header | Value | Purpose |
|--------|-------|---------|
| `ETag` | `"xxh64:abc123..."` | Browser cache validation |
| `Cache-Control` | `public, max-age=300` | 5-minute browser cache |
| `Vary` | `Accept-Encoding` | Proper cache key |

## Data Flow

### Cold Cache (First Load)
1. Browser → GET request
2. Cache MISS → Query DB (~3-5s)
3. Cache result + generate ETag
4. Return 200 with data + ETag + Cache-Control

### Warm Cache (Refresh with Matching ETag)
1. Browser → GET + If-None-Match header
2. Cache HIT + ETag matches
3. Return 304 (no body, instant)

### Cache Invalidated (After Mutation)
1. Mutation occurs (scrape, webhook, etc.)
2. `invalidateLibrariesCache()` called
3. Next request → Cache MISS → Fresh DB query

## Invalidation Points

- `addLibrary` / `removeLibrary`
- `scrapeLibrary` completes
- `removeVersion`
- Webhook receives library update
- MCP server mutations

## Testing

| Test | Description |
|------|-------------|
| Unit: CacheService | get/set/invalidate/clear |
| Unit: ETag | Same data = same hash |
| Integration: Cache flow | First call = DB, second = cache |
| Integration: 304 | Matching ETag returns empty |
| Integration: Invalidation | Mutation clears cache |

## Expected Results

| Scenario | Before | After |
|----------|--------|-------|
| First load | ~20s | ~3-5s (unchanged) |
| Refresh (cached) | ~20s | <50ms (from server cache) |
| Refresh (304) | ~20s | Instant (browser validates) |

## Trade-offs

| Aspect | Choice | Rationale |
|--------|--------|-----------|
| In-memory vs Redis | In-memory | Single server deployment, simpler |
| TTL | 5 minutes | Balance freshness vs performance |
| Invalidated on | All mutations | Always fresh data |
