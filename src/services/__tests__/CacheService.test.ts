import { beforeEach, describe, expect, it, vi } from "vitest";
import { CacheService } from "../CacheService.js";

describe("CacheService", () => {
  let cache: CacheService;

  beforeEach(() => {
    cache = new CacheService({ maxEntries: 10, defaultTTL: 1000 });
  });

  describe("get/set", () => {
    it("should return null for missing key", () => {
      expect(cache.get("missing")).toBeNull();
    });

    it("should store and retrieve data", () => {
      const data = { test: true };
      cache.set("key", data);
      const entry = cache.get("key");
      expect(entry).not.toBeNull();
      expect(entry?.data).toEqual(data);
      expect(entry?.etag).toMatch(/^"xxh64:/);
    });

    it("should respect TTL", async () => {
      cache.set("key", { data: true }, 50);
      expect(cache.get("key")).not.toBeNull();
      await new Promise((r) => setTimeout(r, 60));
      expect(cache.get("key")).toBeNull();
    });
  });

  describe("invalidate", () => {
    it("should clear exact key", () => {
      cache.set("libraries:list", { data: 1 });
      cache.invalidate("libraries:list");
      expect(cache.get("libraries:list")).toBeNull();
    });

    it("should clear by wildcard pattern", () => {
      cache.set("libraries:list", { data: 1 });
      cache.set("libraries:detail:123", { data: 2 });
      cache.set("other:key", { data: 3 });
      cache.invalidate("libraries:*");
      expect(cache.get("libraries:list")).toBeNull();
      expect(cache.get("libraries:detail:123")).toBeNull();
      expect(cache.get("other:key")).not.toBeNull();
    });
  });

  describe("LRU eviction", () => {
    it("should evict oldest when max entries reached", () => {
      const smallCache = new CacheService({ maxEntries: 2, defaultTTL: 60000 });
      smallCache.set("a", 1);
      smallCache.set("b", 2);
      smallCache.set("c", 3);
      expect(smallCache.get("a")).toBeNull();
      expect(smallCache.get("b")).not.toBeNull();
      expect(smallCache.get("c")).not.toBeNull();
    });
  });
});
