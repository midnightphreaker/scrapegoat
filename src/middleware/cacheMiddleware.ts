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

    try {
      const entry = cache.get(cacheKey);
      if (entry) {
        // Return cached data AS-IS - do not modify response shape
        return {
          ok: true,
          data: entry.data,
          marker: middlewareMarker,
        };
      }
    } catch (error) {
      console.warn("Cache read failed, executing uncached:", error);
    }

    const result = await opts.next();
    if (!result.ok) return result;

    try {
      cache.set(cacheKey, result.data, ttl);
      // Return result AS-IS - do not modify response shape
      return {
        ok: true,
        data: result.data,
        marker: middlewareMarker,
      };
    } catch (error) {
      console.warn("Cache write failed, returning uncached:", error);
      return result;
    }
  };
}
