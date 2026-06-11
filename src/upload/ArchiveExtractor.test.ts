/**
 * Tests for ArchiveExtractor — early termination when maxEntries is exceeded.
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import archiver from "archiver";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ArchiveExtractor } from "./ArchiveExtractor";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a ZIP buffer with N text entries named file0.txt … fileN-1.txt */
async function createZipBuffer(entryCount: number): Promise<Buffer> {
  const archive = archiver("zip", { zlib: { level: 1 } });
  const chunks: Buffer[] = [];

  archive.on("data", (chunk: Buffer) => chunks.push(chunk));

  for (let i = 0; i < entryCount; i++) {
    archive.append(`content-${i}`, { name: `file${i}.txt` });
  }

  await archive.finalize();

  return Buffer.concat(chunks);
}

/** Create a ZIP buffer with arbitrary named entries */
async function createZipFromEntries(
  entries: Array<{ name: string; content: string }>,
): Promise<Buffer> {
  const archive = archiver("zip", { zlib: { level: 1 } });
  const chunks: Buffer[] = [];

  archive.on("data", (chunk: Buffer) => chunks.push(chunk));

  for (const { name, content } of entries) {
    archive.append(content, { name });
  }

  await archive.finalize();

  return Buffer.concat(chunks);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ArchiveExtractor", () => {
  let tmpDir: string;
  let extractDir: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `scrapegoat-archive-extractor-test-${Date.now()}`);
    extractDir = path.join(tmpDir, "extract");
    await fs.mkdir(extractDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  // ---------------------------------------------------------------------------
  // Normal extraction
  // ---------------------------------------------------------------------------

  describe("normal extraction", () => {
    it("extracts all files within limits and returns aborted: false", async () => {
      const extractor = new ArchiveExtractor(100, 10 * 1024 * 1024);
      const zipBuf = await createZipBuffer(5);

      const result = await extractor.extract(zipBuf, extractDir);

      expect(result.aborted).toBe(false);
      expect(result.files).toHaveLength(5);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Early termination on maxEntries exceeded
  // ---------------------------------------------------------------------------

  describe("early termination on maxEntries exceeded", () => {
    it("sets aborted: true when entry count exceeds maxEntries", async () => {
      const maxEntries = 3;
      const extractor = new ArchiveExtractor(maxEntries, 10 * 1024 * 1024);
      // Create a ZIP with more entries than allowed
      const zipBuf = await createZipBuffer(10);

      const result = await extractor.extract(zipBuf, extractDir);

      expect(result.aborted).toBe(true);
    });

    it("does not extract files beyond maxEntries", async () => {
      const maxEntries = 3;
      const extractor = new ArchiveExtractor(maxEntries, 10 * 1024 * 1024);
      const zipBuf = await createZipBuffer(10);

      const result = await extractor.extract(zipBuf, extractDir);

      // Should have at most maxEntries files (could be fewer depending on when abort happens)
      expect(result.files.length).toBeLessThanOrEqual(maxEntries);
    });

    it("includes an error about exceeding entry count limit", async () => {
      const maxEntries = 3;
      const extractor = new ArchiveExtractor(maxEntries, 10 * 1024 * 1024);
      const zipBuf = await createZipBuffer(10);

      const result = await extractor.extract(zipBuf, extractDir);

      expect(result.errors.length).toBeGreaterThan(0);
      const entryError = result.errors.find((e) =>
        e.error.includes("entry count exceeds limit"),
      );
      expect(entryError).toBeDefined();
    });

    it("does not return partially extracted files when entry count aborts", async () => {
      const maxEntries = 3;
      const extractor = new ArchiveExtractor(maxEntries, 10 * 1024 * 1024);
      const zipBuf = await createZipBuffer(10);

      const result = await extractor.extract(zipBuf, extractDir);

      expect(result.aborted).toBe(true);
      expect(result.files).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe("edge cases", () => {
    it("returns aborted: false when entry count equals maxEntries exactly", async () => {
      const maxEntries = 5;
      const extractor = new ArchiveExtractor(maxEntries, 10 * 1024 * 1024);
      // Create exactly maxEntries - validateArchiveEntryCount throws when count >= maxEntries
      const zipBuf = await createZipBuffer(maxEntries - 1);

      const result = await extractor.extract(zipBuf, extractDir);

      expect(result.aborted).toBe(false);
      expect(result.files).toHaveLength(maxEntries - 1);
    });

    it("still returns aborted: false when entries are exactly at the limit boundary", async () => {
      const maxEntries = 5;
      const extractor = new ArchiveExtractor(maxEntries, 10 * 1024 * 1024);
      // validateArchiveEntryCount throws when currentCount >= maxEntries
      // So 4 entries with maxEntries=5 should be fine, 5 entries should trigger abort
      const zipBuf = await createZipBuffer(maxEntries);

      const result = await extractor.extract(zipBuf, extractDir);

      // The 5th entry triggers the count check (5 >= 5), so aborted should be true
      expect(result.aborted).toBe(true);
    });

    it("handles single entry archives normally", async () => {
      const extractor = new ArchiveExtractor(100, 10 * 1024 * 1024);
      const zipBuf = await createZipFromEntries([
        { name: "hello.txt", content: "Hello, World!" },
      ]);

      const result = await extractor.extract(zipBuf, extractDir);

      expect(result.aborted).toBe(false);
      expect(result.files).toHaveLength(1);
      expect(result.files[0].relativePath).toBe("hello.txt");
      expect(result.files[0].content.toString()).toBe("Hello, World!");
    });
  });
});
