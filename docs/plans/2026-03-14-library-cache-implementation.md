# Library List Caching Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add in-memory caching with ETag validation to eliminate 20-second reload times on the library list.

**Architecture:** Server-side LRU cache stores query results with ETag hashes. tRPC middleware checks cache before DB queries and returns 304-style responses for matching ETags. Explicit invalidation on all library mutations.

**Tech Stack:** TypeScript, Fastify, tRPC, xxhash-napi for ETag generation

---

## Task 1: Install xxhash Dependency

**Files:**
- Modify: `package.json`

**Step 1: Install xxhash-napi**

Run: `npm install xxhash-napi`
Expected: Package added to dependencies

**Step 2: Verify installation**

Run: `npm ls xxhash-napi`
Expected: `xxhash-napi@<version>`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add xxhash-napi for ETag generation"
```

---

## Task 2: Create ETag Utility

**Files:**
- Create: `src/utils/etag.ts`
- Test: `tests/utils/etag.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/utils/etag.test.ts
import { describe, it, expect } from 'vitest';
import { generateETag } from '../../src/utils/etag.js';

describe('generateETag', () => {
  it('should generate consistent hash for same data', () => {
    const data = { id: 1, name: 'test' };
    const hash1 = generateETag(data);
    const hash2 = generateETag(data);
    expect(hash1).toBe(hash2);
  });

  it('should generate different hash for different data', () => {
    const data1 = { id: 1, name: 'test' };
    const data2 = { id: 2, name: 'test' };
    expect(generateETag(data1)).not.toBe(generateETag(data2));
  });

  it('should ignore key order', () => {
    const data1 = { a: 1, b: 2 };
    const data2 = { b: 2, a: 1 };
    expect(generateETag(data1)).toBe(generateETag(data2));
  });

  it('should return quoted string per HTTP spec', () => {
    const hash = generateETag({ test: true });
    expect(hash.startsWith('"')).toBe(true);
    expect(hash.endsWith('"')).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/utils/etag.test.ts`
Expected: FAIL - module not found

**Step 3: Write minimal implementation**

```typescript
// src/utils/etag.ts
import { xxhash64 } from 'xxhash-napi';

/**
 * Generate a stable ETag hash from any JSON-serializable data.
 * Uses sorted keys to ensure consistent hashing regardless of property order.
 * Returns quoted string per HTTP ETag specification.
 */
export function generateETag(data: unknown): string {
  const serialized = JSON.stringify(data, Object.keys(data as object).sort());
  const hash = xxhash64(Buffer.from(serialized), 0);
  return `"xxh64:${hash}"`;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/utils/etag.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/utils/etag.ts tests/utils/etag.test.ts
git commit -m "feat: add ETag generation utility"
```

---

## Task 3: Create CacheService

**Files:**
- Create: `src/services/CacheService.ts`
- Test: `tests/services/CacheService.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/CacheService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CacheService } from '../../src/services/CacheService.js';

describe('CacheService', () => {
  let cache: CacheService;

  beforeEach(() => {
    cache = new CacheService({ maxEntries: 10, defaultTTL: 1000 });
  });

  describe('get/set', () => {
    it('should return null for missing key', () => {
      expect(cache.get('missing')).toBeNull();
    });

    it('should store and retrieve data', () => {
      const data = { test: true };
      cache.set('key', data);
      const entry = cache.get('key');
      expect(entry).not.toBeNull();
      expect(entry?.data).toEqual(data);
      expect(entry?.etag).toMatch(/^"xxh64:/);
    });

    it('should respect TTL', async () => {
      cache.set('key', { data: true }, 50); // 50ms TTL
      expect(cache.get('key')).not.toBeNull();
      await new Promise(r => setTimeout(r, 60));
      expect(cache.get('key')).toBeNull();
    });
  });

  describe('invalidate', () => {
    it('should clear exact key', () => {
      cache.set('libraries:list', { data: 1 });
      cache.invalidate('libraries:list');
      expect(cache.get('libraries:list')).toBeNull();
    });

    it('should clear by wildcard pattern', () => {
      cache.set('libraries:list', { data: 1 });
      cache.set('libraries:detail:123', { data: 2 });
      cache.set('other:key', { data: 3 });
      cache.invalidate('libraries:*');
      expect(cache.get('libraries:list')).toBeNull();
      expect(cache.get('libraries:detail:123')).toBeNull();
      expect(cache.get('other:key')).not.toBeNull();
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest when max entries reached', () => {
      const smallCache = new CacheService({ maxEntries: 2, defaultTTL: 60000 });
      smallCache.set('a', 1);
      smallCache.set('b', 2);
      smallCache.set('c', 3);
      expect(smallCache.get('a')).toBeNull();
      expect(smallCache.get('b')).not.toBeNull();
      expect(smallCache.get('c')).not.toBeNull();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/services/CacheService.test.ts`
Expected: FAIL - module not found

**Step 3: Write minimal implementation**

```typescript
// src/services/CacheService.ts
import { generateETag } from '../utils/etag.js';

export interface CacheEntry<T> {
  etag: string;
  data: T;
  timestamp: number;
  ttl: number;
}

export interface CacheOptions {
  maxEntries?: number;
  defaultTTL?: number;
}

export class CacheService {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private maxEntries: number;
  private defaultTTL: number;

  constructor(options: CacheOptions = {}) {
    this.maxEntries = options.maxEntries ?? 100;
    this.defaultTTL = options.defaultTTL ?? 300000; // 5 minutes
  }

  get<T>(key: string): CacheEntry<T> | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  set<T>(key: string, data: T, ttl?: number): CacheEntry<T> {
    // LRU eviction
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const entry: CacheEntry<T> = {
      etag: generateETag(data),
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTTL,
    };

    this.cache.set(key, entry);
    return entry;
  }

  invalidate(pattern: string): void {
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.delete(pattern);
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

// Singleton instance for app-wide use
let instance: CacheService | null = null;

export function getCacheService(options?: CacheOptions): CacheService {
  if (!instance) {
    instance = new CacheService(options);
  }
  return instance;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/services/CacheService.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/services/CacheService.ts tests/services/CacheService.test.ts
git commit -m "feat: add CacheService with LRU eviction and wildcard invalidation"
```

---

## Task 4: Create tRPC Cache Middleware

**Files:**
- Create: `src/middleware/cacheMiddleware.ts`
- Test: `tests/middleware/cacheMiddleware.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/middleware/cacheMiddleware.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { initTRPC } from '@trpc/server';
import { cacheMiddleware, createCachedResponse } from '../../src/middleware/cacheMiddleware.js';
import { CacheService } from '../../src/services/CacheService.js';

describe('cacheMiddleware', () => {
  let cache: CacheService;
  let t: ReturnType<typeof initTRPC.create>;

  beforeEach(() => {
    cache = new CacheService({ maxEntries: 10, defaultTTL: 60000 });
    t = initTRPC.create();
  });

  it('should cache successful query results', async () => {
    let callCount = 0;
    const procedure = t.procedure
      .use(cacheMiddleware({ cache, cacheKey: 'test:key' }))
      .query(() => {
        callCount++;
        return { data: 'result' };
      });

    const caller = t.createCallerFactory({} as never)(t.router({ test: procedure }));

    // First call - should hit the resolver
    const result1 = await caller.test();
    expect(callCount).toBe(1);
    expect(result1).toEqual({ data: 'result' });

    // Second call - should return cached data
    const result2 = await caller.test();
    expect(callCount).toBe(1); // Not incremented
    expect(result2).toEqual({ data: 'result' });
  });

  it('should include etag in response meta', async () => {
    const procedure = t.procedure
      .use(cacheMiddleware({ cache, cacheKey: 'test:key' }))
      .query(() => ({ data: 'result' }));

    const caller = t.createCallerFactory({} as never)(t.router({ test: procedure }));
    await caller.test();

    const entry = cache.get('test:key');
    expect(entry?.etag).toMatch(/^"xxh64:/);
  });
});

describe('createCachedResponse', () => {
  it('should identify cache hit with matching etag', () => {
    const cache = new CacheService();
    const data = { test: true };
    const entry = cache.set('key', data);

    const response = createCachedResponse(cache, 'key', entry.etag);
    expect(response?.cached).toBe(true);
    expect(response?.notModified).toBe(true);
  });

  it('should return data when etag does not match', () => {
    const cache = new CacheService();
    cache.set('key', { test: true });

    const response = createCachedResponse(cache, 'key', '"wrong-etag"');
    expect(response?.cached).toBe(true);
    expect(response?.notModified).toBe(false);
    expect(response?.data).toEqual({ test: true });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/middleware/cacheMiddleware.test.ts`
Expected: FAIL - module not found

**Step 3: Write minimal implementation**

```typescript
// src/middleware/cacheMiddleware.ts
import type { MiddlewareFunction } from '@trpc/server/unstable-core-do-not-import';
import type { CacheService } from '../services/CacheService.js';

export interface CacheMiddlewareOptions {
  cache: CacheService;
  cacheKey: string;
  ttl?: number;
}

export interface CachedResponse<T> {
  cached: boolean;
  notModified: boolean;
  data?: T;
  etag?: string;
}

/**
 * Check cache for a response and determine if client's ETag matches.
 */
export function createCachedResponse<T>(
  cache: CacheService,
  key: string,
  clientEtag?: string
): CachedResponse<T> | null {
  const entry = cache.get<T>(key);
  if (!entry) return null;

  if (clientEtag && entry.etag === clientEtag) {
    return { cached: true, notModified: true };
  }

  return {
    cached: true,
    notModified: false,
    data: entry.data,
    etag: entry.etag,
  };
}

/**
 * tRPC middleware that caches query results.
 * Does NOT handle 304 responses - that's handled at the HTTP layer.
 */
export function cacheMiddleware<TContext>(options: CacheMiddlewareOptions): MiddlewareFunction<TContext, TContext, object> {
  return async ({ next, ctx }) => {
    const { cache, cacheKey, ttl } = options;

    // Check cache first
    const entry = cache.get(cacheKey);
    if (entry) {
      return {
        ...entry.data,
        _cacheMeta: {
          cached: true,
          etag: entry.etag,
        },
      };
    }

    // Execute the procedure
    const result = await next();

    // Cache the result
    const newEntry = cache.set(cacheKey, result, ttl);

    return {
      ...result,
      _cacheMeta: {
        cached: false,
        etag: newEntry.etag,
      },
    };
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/middleware/cacheMiddleware.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/middleware/cacheMiddleware.ts tests/middleware/cacheMiddleware.test.ts
git commit -m "feat: add tRPC cache middleware"
```

---

## Task 5: Integrate Cache with listLibraries Procedure

**Files:**
- Modify: `src/store/trpc/router.ts`
- Reference: `src/services/trpcService.ts`

**Step 1: Read the current router implementation**

Run: Read `src/store/trpc/router.ts` to understand the current `listLibraries` implementation.

**Step 2: Update router to use cached procedure**

Add the cache middleware to the `listLibraries` procedure:

```typescript
// At the top of router.ts, add imports:
import { getCacheService } from '../../services/CacheService.js';
import { cacheMiddleware } from '../../middleware/cacheMiddleware.js';

// Create cached procedure factory:
const cache = getCacheService();
const cachedProcedure = publicProcedure.use(cacheMiddleware({
  cache,
  cacheKey: 'libraries:list',
  ttl: 300000, // 5 minutes
}));

// Change listLibraries from publicProcedure to cachedProcedure:
listLibraries: cachedProcedure.query(async () => {
  return docService.listLibraries();
}),
```

**Step 3: Test the integration**

Run: `npm test -- tests/store/trpc/`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add src/store/trpc/router.ts
git commit -m "feat: integrate cache middleware with listLibraries"
```

---

## Task 6: Add Invalidation Hook to Mutations

**Files:**
- Modify: `src/store/trpc/router.ts` (or relevant mutation handlers)
- Reference: `src/store/DocumentManagementService.ts`

**Step 1: Create the invalidation helper**

```typescript
// Add to router.ts or a shared location:
export function invalidateLibrariesCache(): void {
  getCacheService().invalidate('libraries:*');
}
```

**Step 2: Add invalidation to mutations**

For each mutation that affects libraries, call `invalidateLibrariesCache()`:

```typescript
// Example mutations to update:
addLibrary: publicProcedure.mutation(async () => {
  // ... existing logic
  invalidateLibrariesCache();
  return result;
}),

removeLibrary: publicProcedure.mutation(async () => {
  // ... existing logic
  invalidateLibrariesCache();
  return result;
}),

scrapeLibrary: publicProcedure.mutation(async () => {
  // ... existing logic
  invalidateLibrariesCache(); // Called after scrape completes
  return result;
}),

removeVersion: publicProcedure.mutation(async () => {
  // ... existing logic
  invalidateLibrariesCache();
  return result;
}),
```

**Step 3: Commit**

```bash
git add src/store/trpc/router.ts
git commit -m "feat: add cache invalidation to library mutations"
```

---

## Task 7: Add HTTP ETag/304 Support to Fastify

**Files:**
- Modify: `src/services/trpcService.ts`
- Reference: `src/app/AppServer.ts`

**Step 1: Read the tRPC service to understand request handling**

Run: Read `src/services/trpcService.ts`

**Step 2: Add ETag handling middleware**

Add a pre-handler to the tRPC route that:
1. Checks for `If-None-Match` header
2. Compares against cache ETag
3. Returns 304 if match

```typescript
// In trpcService.ts, before the tRPC handler:

fastify.addHook('preHandler', async (request, reply) => {
  if (request.url.includes('listLibraries')) {
    const clientEtag = request.headers['if-none-match'];
    const entry = getCacheService().get('libraries:list');

    if (entry && clientEtag === entry.etag) {
      reply.code(304).send('');
      return reply;
    }
  }
});

// Add ETag to responses:
fastify.addHook('onSend', async (request, reply, payload) => {
  if (request.url.includes('listLibraries')) {
    const entry = getCacheService().get('libraries:list');
    if (entry) {
      reply.header('ETag', entry.etag);
      reply.header('Cache-Control', 'public, max-age=300');
      reply.header('Vary', 'Accept-Encoding');
    }
  }
  return payload;
});
```

**Step 3: Test with curl**

```bash
# First request - should get data
curl -i http://localhost:6281/api/trpc/listLibraries

# Second request with ETag - should get 304
curl -i -H 'If-None-Match: "<etag-from-first-request>"' http://localhost:6281/api/trpc/listLibraries
```

**Step 4: Commit**

```bash
git add src/services/trpcService.ts
git commit -m "feat: add HTTP ETag/304 support for library list"
```

---

## Task 8: Manual Integration Test

**Step 1: Start the server**

Run: `npm run dev`

**Step 2: Test cold cache**

1. Clear any existing browser cache
2. Open `http://localhost:6281/`
3. Note the load time (should be 3-5 seconds)
4. Check response headers include `ETag` and `Cache-Control`

**Step 3: Test warm cache (refresh)**

1. Refresh the page
2. Load time should be <100ms
3. Check response is either:
   - 304 Not Modified (instant)
   - 200 with cached data (fast)

**Step 4: Test invalidation**

1. Add a new library or trigger a scrape
2. Refresh the library list
3. Verify new data is shown (cache was invalidated)

**Step 5: Document results**

Update this plan with actual measured times.

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Install xxhash-napi | `package.json` |
| 2 | Create ETag utility | `src/utils/etag.ts` |
| 3 | Create CacheService | `src/services/CacheService.ts` |
| 4 | Create tRPC cache middleware | `src/middleware/cacheMiddleware.ts` |
| 5 | Integrate with listLibraries | `src/store/trpc/router.ts` |
| 6 | Add invalidation hooks | `src/store/trpc/router.ts` |
| 7 | Add HTTP ETag/304 support | `src/services/trpcService.ts` |
| 8 | Manual integration test | - |

**Expected outcome:** Page refresh goes from ~20 seconds to <100ms (or instant with 304).
