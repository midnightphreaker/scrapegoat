import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RerankerConfig } from "../utils/config.js";
import { RerankerService } from "./RerankerService.js";

describe("RerankerService", () => {
  let service: RerankerService;

  beforeEach(() => {
    service = new RerankerService({
      enabled: false,
      timeout: 5000,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe("isReady", () => {
    it("should return false when disabled", () => {
      expect(service.isReady()).toBe(false);
    });

    it("should return false when no baseURL configured", () => {
      const svc = new RerankerService({
        enabled: true,
        baseURL: undefined,
        model: "test-model",
        timeout: 5000,
      });

      expect(svc.isReady()).toBe(false);
    });

    it("should return true when enabled and configured", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: [] }),
      });

      const svc = new RerankerService({
        enabled: true,
        baseURL: "https://rerank.example.com/v1",
        model: "test-model",
        timeout: 5000,
      });

      await svc.initialize();
      expect(svc.isReady()).toBe(true);
    });
  });

  describe("rerank", () => {
    it("should call rerank API and return results", async () => {
      const mockResponse = {
        results: [
          { index: 0, relevance_score: 0.95, document: { text: "doc1" } },
          { index: 2, relevance_score: 0.85, document: { text: "doc3" } },
          { index: 1, relevance_score: 0.75, document: { text: "doc2" } },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const svc = new RerankerService({
        enabled: true,
        baseURL: "https://rerank.example.com/v1",
        model: "test-model",
        timeout: 5000,
      });

      await svc.initialize();

      const results = await svc.rerank("test query", ["doc1", "doc2", "doc3"], 3);

      expect(results).toHaveLength(3);
      expect(results[0].index).toBe(0);
      expect(results[0].relevanceScore).toBe(0.95);
      expect(results[0].document.text).toBe("doc1");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://rerank.example.com/v1/rerank",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining("test query"),
        }),
      );
    });

    it("should handle empty document array", async () => {
      const svc = new RerankerService({
        enabled: true,
        baseURL: "https://rerank.example.com/v1",
        model: "test-model",
        timeout: 5000,
      });

      await svc.initialize();

      const results = await svc.rerank("test query", [], 10);

      expect(results).toEqual([]);
    });

    it("should handle invalid topN parameter", async () => {
      const svc = new RerankerService({
        enabled: true,
        baseURL: "https://rerank.example.com/v1",
        model: "test-model",
        timeout: 5000,
      });

      await svc.initialize();

      const results = await svc.rerank("test query", ["doc1", "doc2"], 0);
      expect(results).toEqual([]);

      const results2 = await svc.rerank("test query", ["doc1", "doc2"], -5);
      expect(results2).toEqual([]);
    });

    it("should return original order on API error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const svc = new RerankerService({
        enabled: true,
        baseURL: "https://rerank.example.com/v1",
        model: "test-model",
        timeout: 5000,
      });

      await svc.initialize();

      const documents = ["doc1", "doc2", "doc3"];
      const results = await svc.rerank("test query", documents, 3);

      // Should return original order
      expect(results).toHaveLength(3);
      expect(results[0].index).toBe(0);
      expect(results[1].index).toBe(1);
      expect(results[2].index).toBe(2);
    });

    it("should abort request and return fallback on timeout", async () => {
      vi.useFakeTimers();

      const abortSpy = vi.fn();
      const mockFetch = vi.fn().mockImplementation((url, options) => {
        return new Promise((resolve, reject) => {
          const controller = options.signal as AbortController;
          if (controller) {
            controller.abort = abortSpy;
          }
        });
      });

      global.fetch = mockFetch;

      const svc = new RerankerService({
        enabled: true,
        baseURL: "https://rerank.example.com/v1",
        model: "test-model",
        timeout: 100,
      });

      await svc.initialize();

      const documents = ["doc1", "doc2", "doc3"];
      const rerankPromise = svc.rerank("test query", documents, 3);

      // Fast-forward time to trigger timeout
      vi.advanceTimersByTime(100);

      const results = await rerankPromise;

      // Should return fallback results
      expect(results).toHaveLength(3);
      expect(results[0].index).toBe(0);
      expect(results[0].relevanceScore).toBe(0.5);
    });
  });
});
