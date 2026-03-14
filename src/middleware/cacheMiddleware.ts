import type { CacheEntry, CacheService } from "../services/CacheService.js";

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

export function createCachedResponse<T>(
  cache: CacheService,
  key: string,
  clientEtag?: string,
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

const middlewareMarker = Symbol("middlewareMarker");

// biome-ignore lint/suspicious/noExplicitAny: tRPC middleware types are complex and require any for interop
export function cacheMiddleware(
  options: CacheMiddlewareOptions,
): (opts: any) => Promise<any> {
  return async (opts: { next: () => Promise<{ ok: boolean; data: unknown }> }) => {
    const { cache, cacheKey, ttl } = options;

    const entry = cache.get(cacheKey) as CacheEntry<unknown> | null;
    if (entry) {
      const data = entry.data as Record<string, unknown>;
      return {
        ok: true,
        data: {
          ...data,
          _cacheMeta: {
            cached: true,
            etag: entry.etag,
          },
        },
        marker: middlewareMarker,
      };
    }

    const result = await opts.next();
    if (!result.ok) return result;

    const data = result.data as Record<string, unknown>;
    const newEntry = cache.set(cacheKey, result.data, ttl);

    return {
      ok: true,
      data: {
        ...data,
        _cacheMeta: {
          cached: false,
          etag: newEntry.etag,
        },
      },
      marker: middlewareMarker,
    };
  };
}
