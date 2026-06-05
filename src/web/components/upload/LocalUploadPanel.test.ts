import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import LocalUploadPanel from "./LocalUploadPanel";

describe("LocalUploadPanel", () => {
  it("uses explicit add controls instead of a large drop zone", async () => {
    const html = String(await LocalUploadPanel({ library: "docs", version: "1.0" }));

    expect(html).toContain("Add File");
    expect(html).toContain("Add Folder");
    expect(html).toContain("Add Virtual Folder");
    expect(html).toContain('x-ref="fileInput"');
    expect(html).toContain('x-ref="folderInput"');
    expect(html).not.toContain('x-ref="dropzone"');
    expect(html).not.toContain("Click to upload");
    expect(html).not.toContain("drag and drop");
  });

  it("shows the import tree whenever a tree is available", async () => {
    const html = String(await LocalUploadPanel({ library: "docs", version: "1.0" }));

    expect(html).toContain("Import Tree");
    expect(html).toContain('x-if="tree"');
    expect(html).not.toContain("Review import tree");
    expect(html).not.toContain("Hide import tree");
    expect(html).not.toContain("showTree = !showTree");
    expect(html).not.toContain('x-if="showTree && tree"');
  });

  it("keeps the upload component tree-visible by default", () => {
    const script = readFileSync("public/js/localUpload.js", "utf8");

    expect(script).toContain("showTree: true");
    expect(script).not.toContain("showTree: false");
  });
});
