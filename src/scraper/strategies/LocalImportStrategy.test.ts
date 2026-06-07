import { vol } from "memfs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../../utils/config";
import { ScraperError } from "../../utils/errors";
import type { ScraperOptions } from "../types";
import { LocalImportStrategy } from "./LocalImportStrategy";

vi.mock("node:fs/promises", () => ({ default: vol.promises }));
vi.mock("node:fs");

describe("LocalImportStrategy", () => {
  const appConfig = loadConfig();

  beforeEach(() => {
    vol.reset();
  });

  it("should handle file:///import/ URLs", () => {
    const strategy = new LocalImportStrategy(appConfig);
    expect(strategy.canHandle("file:///import/mylib/1.0/docs/api.md")).toBe(true);
    expect(strategy.canHandle("https://example.com")).toBe(false);
    expect(strategy.canHandle("file:///home/user/doc.md")).toBe(false);
  });

  describe("missing file handling", () => {
    it("should throw ScraperError when a file is not found in the staging directory", async () => {
      const strategy = new LocalImportStrategy(appConfig);
      const stagingPath = "/tmp/staging/mylib/1.0";

      // Create the staging directory but NOT the file we're going to request
      vol.fromJSON(
        {
          "/tmp/staging/mylib/1.0/exists.md": "# I exist",
        },
        "/",
      );

      const options: ScraperOptions = {
        url: "file:///import/mylib/1.0/missing.md",
        library: "mylib",
        version: "1.0",
        maxPages: 10,
        maxDepth: 0,
        localImportStagingPath: stagingPath,
      };

      // The scrape method calls processItem internally.
      // When processItem throws, scrape will re-throw for depth-0 items.
      await expect(strategy.scrape(options, vi.fn())).rejects.toThrow(ScraperError);
    });

    it("should include the resolved file path in the ScraperError message", async () => {
      const strategy = new LocalImportStrategy(appConfig);
      const stagingPath = "/tmp/staging/mylib/1.0";

      vol.fromJSON({}, "/");

      const options: ScraperOptions = {
        url: "file:///import/mylib/1.0/missing.md",
        library: "mylib",
        version: "1.0",
        maxPages: 10,
        maxDepth: 0,
        localImportStagingPath: stagingPath,
      };

      try {
        await strategy.scrape(options, vi.fn());
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ScraperError);
        expect((error as ScraperError).message).toContain("missing.md");
      }
    });

    it("should mark the ScraperError as non-retryable (isRetryable === false)", async () => {
      const strategy = new LocalImportStrategy(appConfig);
      const stagingPath = "/tmp/staging/mylib/1.0";

      vol.fromJSON({}, "/");

      const options: ScraperOptions = {
        url: "file:///import/mylib/1.0/missing.md",
        library: "mylib",
        version: "1.0",
        maxPages: 10,
        maxDepth: 0,
        localImportStagingPath: stagingPath,
      };

      try {
        await strategy.scrape(options, vi.fn());
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ScraperError);
        expect((error as ScraperError).isRetryable).toBe(false);
      }
    });
  });
});
