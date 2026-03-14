import { initTRPC } from "@trpc/server";
import { beforeEach, describe, expect, it } from "vitest";
import { CacheService } from "../../services/CacheService.js";
import { cacheMiddleware, createCachedResponse } from "../cacheMiddleware.js";

describe("cacheMiddleware", () => {
  let cache: CacheService;
  let t: ReturnType<typeof initTRPC.create>;

  beforeEach(() => {
    cache = new CacheService({ maxEntries: 10, defaultTTL: 60000 });
    t = initTRPC.create();
  });

  it("should cache successful query results", async () => {
    let callCount = 0;
    const router = t.router({
      test: t.procedure
        .use(cacheMiddleware({ cache, cacheKey: "test:key" }))
        .query(() => {
          callCount++;
          return { data: "result" };
        }),
    });

    const caller = router.createCaller({});

    // First call - should hit the resolver
    const result1 = await caller.test();
    expect(callCount).toBe(1);
    expect(result1).toEqual({
      data: "result",
      _cacheMeta: { cached: false, etag: expect.any(String) },
    });

    // Second call - should return cached data
    const result2 = await caller.test();
    expect(callCount).toBe(1); // Not incremented
    expect(result2).toEqual({
      data: "result",
      _cacheMeta: { cached: true, etag: expect.any(String) },
    });
  });

  it("should include etag in response meta", async () => {
    const router = t.router({
      test: t.procedure
        .use(cacheMiddleware({ cache, cacheKey: "test:key" }))
        .query(() => ({ data: "result" })),
    });

    const caller = router.createCaller({});
    await caller.test();

    const entry = cache.get("test:key");
    expect(entry?.etag).toMatch(/^"xxh64:/);
  });

  it("should handle primitive string return values", async () => {
    const router = t.router({
      test: t.procedure
        .use(cacheMiddleware({ cache, cacheKey: "test:primitive" }))
        .query(() => "hello world"),
    });

    const caller = router.createCaller({});
    const result1 = await caller.test();
    expect(result1).toEqual({
      data: "hello world",
      _cacheMeta: { cached: false, etag: expect.any(String) },
    });

    const result2 = await caller.test();
    expect(result2).toEqual({
      data: "hello world",
      _cacheMeta: { cached: true, etag: expect.any(String) },
    });
  });

  it("should handle primitive number return values", async () => {
    const router = t.router({
      test: t.procedure
        .use(cacheMiddleware({ cache, cacheKey: "test:number" }))
        .query(() => 42),
    });

    const caller = router.createCaller({});
    const result1 = await caller.test();
    expect(result1).toEqual({
      data: 42,
      _cacheMeta: { cached: false, etag: expect.any(String) },
    });

    const result2 = await caller.test();
    expect(result2).toEqual({
      data: 42,
      _cacheMeta: { cached: true, etag: expect.any(String) },
    });
  });

  it("should propagate errors from procedure", async () => {
    const router = t.router({
      test: t.procedure
        .use(cacheMiddleware({ cache, cacheKey: "test:error" }))
        .query(() => {
          throw new Error("Procedure failed");
        }),
    });

    const caller = router.createCaller({});
    await expect(caller.test()).rejects.toThrow("Procedure failed");
  });
});

describe("createCachedResponse", () => {
  it("should identify cache hit with matching etag", () => {
    const cache = new CacheService();
    const data = { test: true };
    const entry = cache.set("key", data);

    const response = createCachedResponse(cache, "key", entry.etag);
    expect(response?.cached).toBe(true);
    expect(response?.notModified).toBe(true);
  });

  it("should return data when etag does not match", () => {
    const cache = new CacheService();
    cache.set("key", { test: true });

    const response = createCachedResponse(cache, "key", '"wrong-etag"');
    expect(response?.cached).toBe(true);
    expect(response?.notModified).toBe(false);
    expect(response?.data).toEqual({ test: true });
  });
});
