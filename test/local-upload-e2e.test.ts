/**
 * E2E tests for the local upload feature.
 *
 * These tests exercise the full upload lifecycle via HTTP requests
 * against a running ScrapeGoat server. They are automatically skipped
 * when no server is available (SCRAPEGOAT_E2E_BASE_URL is not set).
 *
 * Run with a live server:
 *   SCRAPEGOAT_E2E_BASE_URL=http://localhost:6281 npx vitest run test/local-upload-e2e.test.ts
 */

import { afterAll, describe, expect, it } from "vitest";

const baseUrl = process.env.SCRAPEGOAT_E2E_BASE_URL ?? "";

/**
 * Helper to build a URL against the target server.
 */
function url(path: string): string {
  return `${baseUrl}${path}`;
}

/**
 * Generate a unique library name to avoid collisions across test runs.
 */
function uniqueLibrary(): string {
  return `test-lib-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Tree node shape returned by the import tree API.
 */
type TreeNode = { id?: string; name?: string; children?: TreeNode[] };

/**
 * Find the first file node in a tree (has id and name but no children that are files).
 */
function findFileNode(node: TreeNode): TreeNode | null {
  if (node.id && node.name) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findFileNode(child);
      if (found) return found;
    }
  }
  return null;
}

describe("Local Upload E2E", () => {
  const library = uniqueLibrary();
  const version = "1.0.0";
  let sessionId = "";

  afterAll(async () => {
    // Best-effort cleanup: cancel the session if it was created
    if (sessionId && baseUrl) {
      try {
        await fetch(url("/web/upload/cancel"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe("Upload Session Lifecycle", () => {
    it.skipIf(!baseUrl)(
      "should create an upload session",
      async () => {
        const response = await fetch(url("/web/upload/start"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ library, version }),
        });

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toHaveProperty("sessionId");
        expect(body).toHaveProperty("library", library);
        expect(body).toHaveProperty("version", version);
        sessionId = body.sessionId;
      },
      10_000,
    );

    it.skipIf(!baseUrl)(
      "should upload files to a session",
      async () => {
        const formData = new FormData();
        const fileContent = new Blob(
          ["# Test Document\n\nHello from E2E test."],
          { type: "text/markdown" },
        );
        formData.append("file", fileContent, "test-doc.md");

        const response = await fetch(
          url(`/web/upload/files?sessionId=${sessionId}`),
          {
            method: "POST",
            body: formData,
          },
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toHaveProperty("stagedFiles");
        expect(body.stagedFiles).toHaveLength(1);
        expect(body.stagedFiles[0]).toHaveProperty("name", "test-doc.md");
      },
      10_000,
    );

    it.skipIf(!baseUrl)(
      "should get the import tree",
      async () => {
        const response = await fetch(
          url(`/web/upload/tree?sessionId=${sessionId}`),
        );

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toHaveProperty("tree");
        expect(body).toHaveProperty("stats");
        expect(body).toHaveProperty("sessionId", sessionId);
      },
      10_000,
    );

    it.skipIf(!baseUrl)(
      "should rename a file in the tree",
      async () => {
        const treeResponse = await fetch(
          url(`/web/upload/tree?sessionId=${sessionId}`),
        );
        const treeBody = await treeResponse.json();
        const fileNode = findFileNode(treeBody.tree);
        if (!fileNode?.id) return;

        const response = await fetch(url("/web/upload/tree/rename"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            fileId: fileNode.id,
            newName: "renamed-doc.md",
          }),
        });

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toHaveProperty("success", true);
      },
      10_000,
    );

    it.skipIf(!baseUrl)(
      "should move a file in the tree",
      async () => {
        const treeResponse = await fetch(
          url(`/web/upload/tree?sessionId=${sessionId}`),
        );
        const treeBody = await treeResponse.json();
        const fileNode = findFileNode(treeBody.tree);
        if (!fileNode?.id) return;

        const response = await fetch(url("/web/upload/tree/move"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            fileId: fileNode.id,
            newRelativePath: "subfolder/renamed-doc.md",
          }),
        });

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toHaveProperty("success", true);
      },
      10_000,
    );

    it.skipIf(!baseUrl)(
      "should delete a file from the tree",
      async () => {
        // Upload an extra file so we can delete it
        const formData = new FormData();
        const fileContent = new Blob(["to be deleted"], { type: "text/plain" });
        formData.append("file", fileContent, "delete-me.txt");

        const uploadResponse = await fetch(
          url(`/web/upload/files?sessionId=${sessionId}`),
          { method: "POST", body: formData },
        );
        const uploadBody = await uploadResponse.json();
        const targetFile = uploadBody.stagedFiles?.find(
          (f: { name: string }) => f.name === "delete-me.txt",
        );
        if (!targetFile?.id) return;

        const response = await fetch(url("/web/upload/tree/delete"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, fileId: targetFile.id }),
        });

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toHaveProperty("success", true);
      },
      10_000,
    );

    it.skipIf(!baseUrl)(
      "should create a virtual folder",
      async () => {
        const response = await fetch(url("/web/upload/tree/virtual-folder"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, folderPath: "virtual-folder" }),
        });

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toHaveProperty("success", true);
      },
      10_000,
    );

    it.skipIf(!baseUrl)(
      "should commit the session and create a pipeline job",
      async () => {
        const response = await fetch(url("/web/upload/commit"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toHaveProperty("success", true);
        expect(body).toHaveProperty("jobId");
        expect(body).toHaveProperty("library", library);
        expect(body).toHaveProperty("version", version);
      },
      15_000,
    );

    it.skipIf(!baseUrl)(
      "should reject duplicate library/version",
      async () => {
        // Create a second session with the same library/version
        const startResponse = await fetch(url("/web/upload/start"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ library, version }),
        });
        const startBody = await startResponse.json();
        const duplicateSessionId: string = startBody.sessionId;

        // Upload a file so the session has content
        const formData = new FormData();
        const fileContent = new Blob(["duplicate test"], { type: "text/plain" });
        formData.append("file", fileContent, "dup.txt");
        await fetch(url(`/web/upload/files?sessionId=${duplicateSessionId}`), {
          method: "POST",
          body: formData,
        });

        const response = await fetch(url("/web/upload/commit"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: duplicateSessionId }),
        });

        expect(response.status).toBe(409);
        const body = await response.json();
        expect(body).toHaveProperty("error");
        expect(body.error).toContain("already exists");

        // Clean up the duplicate session
        await fetch(url("/web/upload/cancel"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: duplicateSessionId }),
        });
      },
      10_000,
    );

    it.skipIf(!baseUrl)(
      "should cancel a session",
      async () => {
        const startResponse = await fetch(url("/web/upload/start"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            library: uniqueLibrary(),
            version: "1.0.0",
          }),
        });
        const startBody = await startResponse.json();
        const cancelSessionId: string = startBody.sessionId;

        const response = await fetch(url("/web/upload/cancel"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: cancelSessionId }),
        });

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toHaveProperty("success", true);
      },
      10_000,
    );
  });

  describe("Report Generation", () => {
    it.skipIf(!baseUrl)(
      "should generate failed files report",
      async () => {
        const startResponse = await fetch(url("/web/upload/start"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            library: uniqueLibrary(),
            version: "1.0.0",
          }),
        });
        const startBody = await startResponse.json();
        const reportSessionId: string = startBody.sessionId;

        const response = await fetch(
          url(`/web/upload/report/failed?sessionId=${reportSessionId}`),
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Type")).toContain("text/plain");
        const text = await response.text();
        expect(text).toContain("Files that failed to upload");

        // Clean up
        await fetch(url("/web/upload/cancel"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: reportSessionId }),
        });
      },
      10_000,
    );

    it.skipIf(!baseUrl)(
      "should generate renamed files report",
      async () => {
        const startResponse = await fetch(url("/web/upload/start"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            library: uniqueLibrary(),
            version: "1.0.0",
          }),
        });
        const startBody = await startResponse.json();
        const renamedSessionId: string = startBody.sessionId;

        const response = await fetch(
          url(`/web/upload/report/renamed?sessionId=${renamedSessionId}`),
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Type")).toContain("text/plain");
        const text = await response.text();
        expect(text).toContain("Files that were renamed");

        // Clean up
        await fetch(url("/web/upload/cancel"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: renamedSessionId }),
        });
      },
      10_000,
    );
  });
});
