/**
 * Tests for ImportTreeBuilder — disk verification of import tree entries.
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImportTreeBuilder } from "./ImportTreeBuilder";
import type { ImportFolder, StagedFile } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStagedFile(
  overrides: Partial<StagedFile> & { relativePath: string; absolutePath: string },
): StagedFile {
  return {
    id: `file_${Math.random().toString(36).slice(2, 8)}`,
    originalName: overrides.relativePath.split("/").pop() ?? "file.txt",
    displayName: overrides.relativePath.split("/").pop() ?? "file.txt",
    size: 100,
    mimeType: "text/plain",
    fromArchive: false,
    ingestible: true,
    ...overrides,
  };
}

function makeFolder(relativePath: string, name?: string): ImportFolder {
  return {
    id: `folder_${Math.random().toString(36).slice(2, 8)}`,
    name: name ?? relativePath.split("/").pop() ?? "folder",
    relativePath,
    virtual: true,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ImportTreeBuilder", () => {
  let tmpDir: string;
  let builder: ImportTreeBuilder;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `scrapegoat-tree-builder-test-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });
    builder = new ImportTreeBuilder();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  // ---------------------------------------------------------------------------
  // buildTree (existing behaviour)
  // ---------------------------------------------------------------------------

  describe("buildTree", () => {
    it("builds a flat tree from files", async () => {
      const _file = await fs.writeFile(path.join(tmpDir, "a.txt"), "hello");
      const files: StagedFile[] = [
        makeStagedFile({
          relativePath: "a.txt",
          absolutePath: path.join(tmpDir, "a.txt"),
        }),
      ];

      const tree = builder.buildTree(files, []);

      expect(tree).toHaveLength(1);
      expect(tree[0].type).toBe("file");
      expect(tree[0].name).toBe("a.txt");
    });

    it("builds a nested tree with folders", async () => {
      await fs.mkdir(path.join(tmpDir, "sub"), { recursive: true });
      await fs.writeFile(path.join(tmpDir, "sub", "b.txt"), "world");

      const files: StagedFile[] = [
        makeStagedFile({
          relativePath: "sub/b.txt",
          absolutePath: path.join(tmpDir, "sub", "b.txt"),
        }),
      ];
      const folders: ImportFolder[] = [makeFolder("sub")];

      const tree = builder.buildTree(files, folders);

      expect(tree).toHaveLength(1);
      expect(tree[0].type).toBe("folder");
      expect(tree[0].name).toBe("sub");
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children![0].name).toBe("b.txt");
    });
  });

  // ---------------------------------------------------------------------------
  // verifyTree — disk verification
  // ---------------------------------------------------------------------------

  describe("verifyTree", () => {
    it("removes entries for files that do not exist on disk", async () => {
      // Create one real file and reference one phantom file
      await fs.writeFile(path.join(tmpDir, "exists.txt"), "hello");

      const realFile = makeStagedFile({
        relativePath: "exists.txt",
        absolutePath: path.join(tmpDir, "exists.txt"),
      });
      const phantomFile = makeStagedFile({
        relativePath: "phantom.txt",
        absolutePath: path.join(tmpDir, "phantom.txt"), // does NOT exist
      });

      const tree = builder.buildTree([realFile, phantomFile], []);

      // Before verification, both are present
      expect(tree).toHaveLength(2);

      const verified = await builder.verifyTree(tree, [realFile, phantomFile]);

      // After verification, only the real file remains
      expect(verified).toHaveLength(1);
      expect(verified[0].name).toBe("exists.txt");
    });

    it("removes non-existent entries in nested folders", async () => {
      await fs.mkdir(path.join(tmpDir, "docs"), { recursive: true });
      await fs.writeFile(path.join(tmpDir, "docs", "real.md"), "content");

      const realFile = makeStagedFile({
        relativePath: "docs/real.md",
        absolutePath: path.join(tmpDir, "docs", "real.md"),
      });
      const phantomFile = makeStagedFile({
        relativePath: "docs/ghost.md",
        absolutePath: path.join(tmpDir, "docs", "ghost.md"),
      });

      const tree = builder.buildTree([realFile, phantomFile], [makeFolder("docs")]);
      const verified = await builder.verifyTree(tree, [realFile, phantomFile]);

      // Root should have the "docs" folder
      expect(verified).toHaveLength(1);
      expect(verified[0].type).toBe("folder");
      expect(verified[0].name).toBe("docs");
      // Only the real file inside
      expect(verified[0].children).toHaveLength(1);
      expect(verified[0].children![0].name).toBe("real.md");
    });

    it("removes empty folders left after pruning files", async () => {
      // Only phantom files in a folder — folder should be pruned too
      const phantomFile = makeStagedFile({
        relativePath: "empty-dir/file.txt",
        absolutePath: path.join(tmpDir, "empty-dir", "file.txt"),
      });

      const tree = builder.buildTree([phantomFile], [makeFolder("empty-dir")]);
      const verified = await builder.verifyTree(tree, [phantomFile]);

      // Folder had all files removed, so folder itself should be gone
      expect(verified).toHaveLength(0);
    });

    it("keeps all entries when all files exist on disk", async () => {
      await fs.writeFile(path.join(tmpDir, "a.txt"), "a");
      await fs.writeFile(path.join(tmpDir, "b.txt"), "b");

      const fileA = makeStagedFile({
        relativePath: "a.txt",
        absolutePath: path.join(tmpDir, "a.txt"),
      });
      const fileB = makeStagedFile({
        relativePath: "b.txt",
        absolutePath: path.join(tmpDir, "b.txt"),
      });

      const tree = builder.buildTree([fileA, fileB], []);
      const verified = await builder.verifyTree(tree, [fileA, fileB]);

      expect(verified).toHaveLength(2);
    });

    it("logs a warning for each removed entry", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const phantomFile = makeStagedFile({
        relativePath: "missing.txt",
        absolutePath: path.join(tmpDir, "missing.txt"),
      });

      const tree = builder.buildTree([phantomFile], []);
      await builder.verifyTree(tree, [phantomFile]);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Import tree entry removed: file not found in staging."),
      );
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("missing.txt"));

      warnSpy.mockRestore();
    });

    it("handles nested empty folder cleanup recursively", async () => {
      // Structure: outer/inner/phantom.txt — all should be removed
      const phantomFile = makeStagedFile({
        relativePath: "outer/inner/phantom.txt",
        absolutePath: path.join(tmpDir, "outer", "inner", "phantom.txt"),
      });

      const tree = builder.buildTree(
        [phantomFile],
        [makeFolder("outer"), makeFolder("outer/inner")],
      );
      const verified = await builder.verifyTree(tree, [phantomFile]);

      expect(verified).toHaveLength(0);
    });
  });
});
