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
});
