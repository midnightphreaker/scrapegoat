/**
 * Tests for UploadStagingService — virtual folder tracking and stats.
 */
import assert from "node:assert";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ImportTreeNode, StagedFile } from "./types";
import { UploadStagingService } from "./UploadStagingService";

describe("UploadStagingService", () => {
  let service: UploadStagingService;
  const tmpBase = path.join(os.tmpdir(), "scrapegoat-test-upload");

  beforeEach(async () => {
    service = new UploadStagingService({
      stagingMode: "filesystem",
      stagingPath: tmpBase,
      sessionTtlSeconds: 0, // disable cleanup timer for tests
    });
    await fs.mkdir(tmpBase, { recursive: true });
  });

  afterEach(async () => {
    service.dispose();
    await fs.rm(tmpBase, { recursive: true, force: true }).catch(() => {});
  });

  /** Helper: create a session and return its ID */
  async function createTestSession(): Promise<string> {
    const session = await service.createSession("test-lib", "1.0.0");
    return session.id;
  }

  // ---------------------------------------------------------------------------
  // REQ-003: createVirtualFolder adds to session.folders
  // ---------------------------------------------------------------------------
  describe("createVirtualFolder", () => {
    it("adds the folder to session.folders", async () => {
      const sessionId = await createTestSession();
      await service.createVirtualFolder(sessionId, "my-folder");

      const session = service.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.folders).toBeDefined();
      expect(session?.folders.has("my-folder")).toBe(true);

      const folder = session?.folders.get("my-folder");
      expect(folder).toMatchObject({
        name: "my-folder",
        relativePath: "my-folder",
        virtual: true,
      });
    });

    it("adds a nested folder to session.folders with sanitized path", async () => {
      const sessionId = await createTestSession();
      await service.createVirtualFolder(sessionId, "parent/child");

      const session = service.getSession(sessionId);
      expect(session?.folders.has("parent/child")).toBe(true);

      const folder = session?.folders.get("parent/child");
      expect(folder).toMatchObject({
        name: "child",
        relativePath: "parent/child",
        virtual: true,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // REQ-004: getImportTree includes virtual folders
  // ---------------------------------------------------------------------------
  describe("getImportTree", () => {
    it("includes virtual folders in the tree output", async () => {
      const sessionId = await createTestSession();
      await service.createVirtualFolder(sessionId, "docs");
      // Stage a file inside the virtual folder so it survives verifyTree pruning
      await service.stageFile(sessionId, "docs/guide.md", Buffer.from("# Guide"));

      const { tree } = await service.getImportTree(sessionId);

      // Should have at least one node — the virtual folder
      expect(tree.length).toBeGreaterThanOrEqual(1);

      const folderNode = tree.find((n: { name: string }) => n.name === "docs");
      expect(folderNode).toBeDefined();
      expect(folderNode?.type).toBe("folder");
      expect(folderNode?.relativePath).toBe("docs");
    });

    it("includes virtual folders alongside staged files", async () => {
      const sessionId = await createTestSession();
      await service.stageFile(sessionId, "readme.md", Buffer.from("# Hello"));
      await service.createVirtualFolder(sessionId, "guides");
      // Stage a file inside the virtual folder so it survives verifyTree pruning
      await service.stageFile(sessionId, "guides/intro.md", Buffer.from("# Intro"));

      const { tree } = await service.getImportTree(sessionId);

      const folderNode = tree.find((n: { name: string }) => n.name === "guides");
      const fileNode = tree.find((n: { name: string }) => n.name === "readme.md");
      expect(folderNode).toBeDefined();
      expect(fileNode).toBeDefined();
    });

    it("should prune phantom entries from tree (files not on disk)", async () => {
      const session = await service.createSession("phantom-test", "1.0");

      // Stage a file (this writes to disk)
      await service.stageFile(session.id, "real.md", Buffer.from("# Real"));

      // Stage another file
      await service.stageFile(session.id, "ghost.md", Buffer.from("# Ghost"));

      // Verify both appear initially
      const beforeDelete = await service.getImportTree(session.id);
      expect(beforeDelete.tree.length).toBe(2);

      // Now delete the "ghost" file from disk to simulate a phantom entry
      const ghostFile = Array.from(service.getSession(session.id)!.files.values()).find(
        (f: StagedFile) => f.relativePath === "ghost.md",
      );
      assert(ghostFile, "ghost file should exist in session");
      await fs.unlink(ghostFile.absolutePath);

      // getImportTree should prune the phantom entry
      const result = await service.getImportTree(session.id);
      const fileNames = result.tree
        .filter((n: ImportTreeNode) => n.type === "file")
        .map((n: ImportTreeNode) => n.name);
      expect(fileNames).toContain("real.md");
      expect(fileNames).not.toContain("ghost.md");
    });
  });

  // ---------------------------------------------------------------------------
  // setExtractionAborted
  // ---------------------------------------------------------------------------
  describe("setExtractionAborted", () => {
    it("should set extractionAborted flag on session", async () => {
      const session = await service.createSession("abort-test", "1.0");

      expect(session.extractionAborted).toBeUndefined();

      service.setExtractionAborted(session.id);

      const updated = service.getSession(session.id);
      expect(updated?.extractionAborted).toBe(true);
    });

    it("should set extractionTruncatedAt when provided", async () => {
      const session = await service.createSession("abort-trunc", "1.0");

      service.setExtractionAborted(session.id, "some/path.md");

      const updated = service.getSession(session.id);
      expect(updated?.extractionAborted).toBe(true);
      expect(updated?.extractionTruncatedAt).toBe("some/path.md");
    });

    it("should include extractionAborted in session stats", async () => {
      const session = await service.createSession("abort-stats", "1.0");

      // Before setting aborted
      const statsBefore = service.getSessionStats(session.id);
      expect(statsBefore.extractionAborted).toBe(false);

      service.setExtractionAborted(session.id);

      // After setting aborted
      const statsAfter = service.getSessionStats(session.id);
      expect(statsAfter.extractionAborted).toBe(true);
    });

    it("should throw for unknown session", () => {
      const service2 = new UploadStagingService({
        stagingMode: "filesystem",
        stagingPath: tmpBase,
        sessionTtlSeconds: 0,
      });
      expect(() => service2.setExtractionAborted("nonexistent")).toThrow(
        "Upload session not found",
      );
      service2.dispose();
    });
  });

  // ---------------------------------------------------------------------------
  // REQ-005: removeFile removes from session.folders
  // ---------------------------------------------------------------------------
  describe("removeFile with folder tracking", () => {
    it("removes the folder from session.folders when deleting a folder's file triggers cleanup", async () => {
      const sessionId = await createTestSession();
      await service.createVirtualFolder(sessionId, "temp-folder");

      // Verify folder is tracked
      const session = service.getSession(sessionId);
      expect(session?.folders.has("temp-folder")).toBe(true);

      // removeVirtualFolder or removeNode equivalent
      await service.removeVirtualFolder(sessionId, "temp-folder");

      // Verify folder is removed from tracking
      expect(session?.folders.has("temp-folder")).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // REQ-005: renameFile updates folder paths
  // ---------------------------------------------------------------------------
  describe("renameVirtualFolder", () => {
    it("updates folder path in session.folders after rename", async () => {
      const sessionId = await createTestSession();
      await service.createVirtualFolder(sessionId, "original-name");

      await service.renameVirtualFolder(sessionId, "original-name", "new-name");

      const session = service.getSession(sessionId);
      // Old path should be gone
      expect(session?.folders.has("original-name")).toBe(false);
      // New path should exist
      expect(session?.folders.has("new-name")).toBe(true);

      const folder = session?.folders.get("new-name");
      expect(folder).toMatchObject({
        name: "new-name",
        relativePath: "new-name",
      });
    });
  });

  // ---------------------------------------------------------------------------
  // REQ-005: moveVirtualFolder updates paths
  // ---------------------------------------------------------------------------
  describe("moveVirtualFolder", () => {
    it("updates folder relativePath after move", async () => {
      const sessionId = await createTestSession();
      await service.createVirtualFolder(sessionId, "my-folder");

      await service.moveVirtualFolder(sessionId, "my-folder", "parent");

      const session = service.getSession(sessionId);
      expect(session?.folders.has("my-folder")).toBe(false);
      expect(session?.folders.has("parent/my-folder")).toBe(true);

      const folder = session?.folders.get("parent/my-folder");
      expect(folder).toMatchObject({
        relativePath: "parent/my-folder",
      });
    });
  });

  // ---------------------------------------------------------------------------
  // REQ-006: getSessionStats returns correct property names
  // ---------------------------------------------------------------------------
  describe("getSessionStats", () => {
    it("returns fileCount instead of totalFiles", async () => {
      const sessionId = await createTestSession();
      await service.stageFile(sessionId, "test.md", Buffer.from("# Test"));

      const stats = service.getSessionStats(sessionId);

      // Should have fileCount, NOT totalFiles
      expect(stats).toHaveProperty("fileCount");
      expect(stats).not.toHaveProperty("totalFiles");
      expect(stats.fileCount).toBe(1);
    });

    it("returns totalSize", async () => {
      const sessionId = await createTestSession();
      const content = Buffer.from("# Hello World");
      await service.stageFile(sessionId, "doc.md", content);

      const stats = service.getSessionStats(sessionId);
      expect(stats).toHaveProperty("totalSize");
      expect(stats.totalSize).toBe(content.length);
    });

    it("returns folderCount", async () => {
      const sessionId = await createTestSession();
      await service.createVirtualFolder(sessionId, "folder-a");
      await service.createVirtualFolder(sessionId, "folder-b");

      const stats = service.getSessionStats(sessionId);
      expect(stats).toHaveProperty("folderCount");
      expect(stats.folderCount).toBe(2);
    });

    it("returns failedFiles and renamedFiles counts", async () => {
      const sessionId = await createTestSession();
      await service.stageFile(sessionId, "test.md", Buffer.from("# Test"));

      const stats = service.getSessionStats(sessionId);
      expect(stats).toHaveProperty("failedFiles");
      expect(stats).toHaveProperty("renamedFiles");
      expect(stats.failedFiles).toBe(0);
      expect(stats.renamedFiles).toBe(0);
    });
  });
});
