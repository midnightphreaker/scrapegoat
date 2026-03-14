import { generateETag } from "../utils/etag.js";

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
    this.defaultTTL = options.defaultTTL ?? 300000;
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
    if (pattern.endsWith("*")) {
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

let instance: CacheService | null = null;

export function getCacheService(options?: CacheOptions): CacheService {
  if (!instance) {
    instance = new CacheService(options);
  }
  return instance;
}
