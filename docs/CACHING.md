# Caching Strategy

This document describes the caching implementation for the scrapegoat API, specifically designed to eliminate slow page refreshes on the library list.

## Problem

The `listLibraries` endpoint performs a heavy database query (4-table JOIN with aggregations) that takes 3-5 seconds. Every page refresh re-executed this query, causing 20+ second load times.

## Solution

A multi-layer caching strategy:
1. **Server-side in-memory cache** - Stores query results with TTL
2. **HTTP ETag validation** - Enables 304 Not Modified responses
3. **Explicit cache invalidation** - Cache cleared when data changes

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER                                   │
│  HTTP Cache stores response + ETag                              │
│  On refresh: sends If-None-Match header                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FASTIFY SERVER                                │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ HTTP Hooks (trpcService.ts)                               │   │
│  │ - preHandler: Check If-None-Match, return 304 if match   │   │
│  │ - onSend: Add ETag, Cache-Control headers                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ tRPC Cache Middleware (cacheMiddleware.ts)                │   │
│  │ - Check cache before executing procedure                  │   │
│  │ - Cache results after successful execution               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ CacheService (CacheService.ts)                            │   │
│  │ - LRU cache with configurable max entries                │   │
│  │ - TTL-based expiration                                    │   │
│  │ - Wildcard pattern invalidation                           │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. CacheService (`src/services/CacheService.ts`)

The core caching engine with:

- **LRU eviction** - When max entries reached, least-recently-used items are evicted
- **TTL expiration** - Entries expire after configured time (default: 5 minutes)
- **Wildcard invalidation** - `invalidate('libraries:*')` clears all library-related cache
- **ETag generation** - Each cached entry includes an ETag hash

```typescript
const cache = getCacheService();
cache.set('libraries:list', data, 300000); // 5 minute TTL
const entry = cache.get('libraries:list');
cache.invalidate('libraries:*');
```

### 2. ETag Utility (`src/utils/etag.ts`)

Generates HTTP-compliant ETag hashes using xxhash:

- Fast hashing with `@node-rs/xxhash`
- Stable output (same data = same hash)
- Handles all types: objects, arrays, primitives, null, undefined
- Returns quoted string per HTTP spec: `"xxh64:<hash>"`

### 3. Cache Middleware (`src/middleware/cacheMiddleware.ts`)

tRPC middleware that wraps procedures:

```typescript
const cachedProcedure = publicProcedure.use(
  cacheMiddleware({
    cache: getCacheService(),
    cacheKey: 'libraries:list',
    ttl: 300000,
  })
);
```

### 4. HTTP Hooks (`src/services/trpcService.ts`)

Fastify hooks for HTTP-level caching:

- **preHandler**: Checks `If-None-Match` header, returns 304 if ETag matches
- **onSend**: Adds `ETag`, `Cache-Control: public, max-age=300`, `Vary: Accept-Encoding` headers

## Data Flow

### Cold Cache (First Request)

```
Browser ──GET /api/trpc/listLibraries──▶ Server
                                              │
                                         Cache MISS
                                              │
                                              ▼
                                    Execute DB query (~3-5s)
                                              │
                                              ▼
                                    Cache result + generate ETag
                                              │
                                              ▼
                                    Return 200 + ETag + Cache-Control
```

### Warm Cache (Subsequent Request)

```
Browser ──GET + If-None-Match──▶ Server
                                      │
                                 Cache HIT
                                      │
                                 ETag matches?
                                      │
                                   YES │
                                      ▼
                                 Return 304 (no body, instant)
```

### Cache Invalidated (After Mutation)

```
User action (scrape, delete, etc.)
        │
        ▼
invalidateLibrariesCache() called
        │
        ▼
Cache entry deleted
        │
        ▼
Next request = Cache MISS = Fresh DB query
```

## Cache Invalidation

The cache is invalidated when library data changes:

```typescript
// Called after mutations
invalidateLibrariesCache();
```

**Invalidation triggers:**
- `removeVersion` - Version deleted
- `removeAllDocuments` - Documents cleared
- `updateVersionStatus` - Status changed
- `updateVersionProgress` - Progress updated

**Why not use time-based invalidation only?**
- Time-based TTL can serve stale data for up to 5 minutes
- Explicit invalidation ensures fresh data immediately after changes

## Configuration

Default settings (in `CacheService`):

| Setting | Default | Description |
|---------|---------|-------------|
| `maxEntries` | 100 | Maximum cached items before LRU eviction |
| `defaultTTL` | 300000 (5 min) | Time-to-live for cache entries |
| `cacheKey` | `libraries:list` | Cache key for library list |

HTTP headers:

| Header | Value | Purpose |
|--------|-------|---------|
| `ETag` | `"xxh64:<hash>"` | Cache validation |
| `Cache-Control` | `public, max-age=300` | Browser caching (5 min) |
| `Vary` | `Accept-Encoding` | Proper cache key for compression |

## Performance Impact

| Scenario | Before | After |
|----------|--------|-------|
| First load | ~3-5s | ~3-5s (unchanged) |
| Refresh (server cache) | ~3-5s | <50ms |
| Refresh (304 response) | ~3-5s | Instant (no body) |

## Files

| File | Purpose |
|------|---------|
| `src/services/CacheService.ts` | Core cache implementation |
| `src/utils/etag.ts` | ETag hash generation |
| `src/middleware/cacheMiddleware.ts` | tRPC caching middleware |
| `src/store/trpc/router.ts` | Cache integration + invalidation |
| `src/services/trpcService.ts` | HTTP ETag/304 hooks |

## Extending to Other Endpoints

To add caching to another tRPC procedure:

1. Create a cached procedure factory:
```typescript
const cachedProcedure = publicProcedure.use(
  cacheMiddleware({
    cache: getCacheService(),
    cacheKey: 'your:endpoint:key',
    ttl: 300000,
  })
);
```

2. Use it instead of `publicProcedure`:
```typescript
yourEndpoint: cachedProcedure.query(async () => {
  return yourService.getData();
}),
```

3. Add invalidation when data changes:
```typescript
getCacheService().invalidate('your:endpoint:*');
```

## Troubleshooting

### Cache not working

1. Check the ETag header is present in responses
2. Check `Cache-Control` header is present
3. Verify browser is sending `If-None-Match` on refresh

### Stale data after mutations

1. Ensure `invalidateLibrariesCache()` is called after mutations
2. Check the cache key matches between middleware and invalidation

### Memory usage

1. Reduce `maxEntries` if memory is constrained
2. Reduce `defaultTTL` for faster cache turnover
3. Monitor with `getCacheService().clear()` to reset if needed
