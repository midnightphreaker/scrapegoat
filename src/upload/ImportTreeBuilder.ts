/**
 * ImportTreeBuilder — builds and manipulates the import tree from staged files.
 *
 * Key features:
 *  - Build a hierarchical tree from a flat file list
 *  - Create virtual folders
 *  - Rename / delete / move nodes
 *  - Auto-detect and resolve duplicate paths with suffix
 *  - Generate canonical source URIs: file:///import/<library>/<version>/<path>
 */

import { stat } from "node:fs/promises";
import type { ImportFolder, ImportTreeNode, RenamedFileEntry, StagedFile } from "./types";

// ---------------------------------------------------------------------------
// ImportTreeBuilder
// ---------------------------------------------------------------------------

export class ImportTreeBuilder {
  // ---------------------------------------------------------------------------
  // Build tree
  // ---------------------------------------------------------------------------

  /**
   * Build a hierarchical ImportTreeNode[] from a flat list of staged files
   * and virtual folders.
   *
   * Folders are always sorted before files. Both groups are sorted
   * alphabetically (case-insensitive).
   */
  buildTree(files: StagedFile[], folders: ImportFolder[]): ImportTreeNode[] {
    const root: ImportTreeNode[] = [];

    // Helper: ensure directory nodes exist along a path, return the parent node array
    const ensureDirs = (
      relativePath: string,
    ): { parent: ImportTreeNode[]; childName: string } => {
      const segments = relativePath.split("/").filter(Boolean);
      if (segments.length <= 1) {
        return { parent: root, childName: segments[0] ?? "" };
      }

      let current: ImportTreeNode[] = root;
      for (let i = 0; i < segments.length - 1; i++) {
        const dirName = segments[i];
        let existing = current.find((n) => n.type === "folder" && n.name === dirName);
        if (!existing) {
          existing = {
            id: `dir_${dirName}_${i}`,
            name: dirName,
            type: "folder",
            relativePath: segments.slice(0, i + 1).join("/"),
            children: [],
          };
          current.push(existing);
        }
        // biome-ignore lint/style/noNonNullAssertion: existing is guaranteed to have children after creation above
        current = existing.children!;
      }

      // biome-ignore lint/style/noNonNullAssertion: segments is non-empty (checked above), so last element exists
      return { parent: current, childName: segments[segments.length - 1]! };
    };

    // Insert virtual folders
    for (const folder of folders) {
      const segments = folder.relativePath.split("/").filter(Boolean);
      if (segments.length === 0) continue;

      let current: ImportTreeNode[] = root;
      for (let i = 0; i < segments.length; i++) {
        // biome-ignore lint/style/noNonNullAssertion: loop index i is within bounds of segments
        const seg = segments[i]!;
        let existing = current.find((n) => n.type === "folder" && n.name === seg);
        if (!existing) {
          existing = {
            id: folder.id,
            name: seg,
            type: "folder",
            relativePath: segments.slice(0, i + 1).join("/"),
            children: [],
          };
          current.push(existing);
        }
        // biome-ignore lint/style/noNonNullAssertion: existing is guaranteed to have children after creation above
        current = existing.children!;
      }
    }

    // Insert files
    for (const file of files) {
      const { parent, childName } = ensureDirs(file.relativePath);

      parent.push({
        id: file.id,
        name: childName,
        type: "file",
        relativePath: file.relativePath,
        size: file.size,
        mimeType: file.mimeType,
        ingestible: file.ingestible,
        error: file.error,
        fromArchive: file.fromArchive,
      });
    }

    // Sort recursively: folders first, then alphabetical
    return this.sortTree(root);
  }

  // ---------------------------------------------------------------------------
  // Disk verification
  // ---------------------------------------------------------------------------

  /**
   * Verify that every file node in the tree actually exists on disk.
   * Removes entries whose files cannot be stat'd (e.g. ENOENT).
   * Prunes empty folders left behind after file removal.
   * Logs a warning for each removed entry.
   */
  async verifyTree(
    tree: ImportTreeNode[],
    files: StagedFile[],
  ): Promise<ImportTreeNode[]> {
    // Build a set of relative paths that exist on disk
    const results = await Promise.allSettled(
      files.map(async (f) => {
        await stat(f.absolutePath);
        return f.relativePath;
      }),
    );

    const existingPaths = new Set<string>();
    const removedPaths = new Set<string>();

    for (const result of results) {
      if (result.status === "fulfilled") {
        existingPaths.add(result.value);
      } else {
        // stat failed — file does not exist
        const failedFile = files[results.indexOf(result)];
        removedPaths.add(failedFile.relativePath);
        console.warn(
          `Import tree entry removed: file not found in staging. path=${failedFile.relativePath}`,
        );
      }
    }

    // Filter the tree recursively
    return this.pruneTree(tree, existingPaths);
  }

  /**
   * Recursively remove file nodes whose relativePath is not in `existingPaths`.
   * Remove folders that become empty after pruning.
   */
  private pruneTree(
    nodes: ImportTreeNode[],
    existingPaths: Set<string>,
  ): ImportTreeNode[] {
    const result: ImportTreeNode[] = [];

    for (const node of nodes) {
      if (node.type === "folder") {
        // Recurse into children first
        const prunedChildren = node.children
          ? this.pruneTree(node.children, existingPaths)
          : [];
        // Keep folder only if it still has children
        if (prunedChildren.length > 0) {
          result.push({ ...node, children: prunedChildren });
        }
      } else {
        // File node — keep only if it exists on disk
        if (existingPaths.has(node.relativePath)) {
          result.push(node);
        }
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Virtual folders
  // ---------------------------------------------------------------------------

  /**
   * Create a virtual folder at `parentPath` with the given `name`.
   * `parentPath` is a `/`-separated relative path; use `""` for root.
   * Returns a new tree array (immutable — does not mutate input).
   */
  createVirtualFolder(
    tree: ImportTreeNode[],
    parentPath: string,
    name: string,
  ): ImportTreeNode[] {
    const newTree = this.deepClone(tree);

    if (parentPath === "" || parentPath === "/") {
      // Insert at root
      newTree.push({
        id: `vf_${Date.now()}_${name}`,
        name,
        type: "folder",
        relativePath: name,
        children: [],
      });
      return this.sortTree(newTree);
    }

    // Find the parent node
    const parent = this.findNode(newTree, parentPath);
    if (!parent || parent.type !== "folder") {
      throw new Error(`Parent folder not found: ${parentPath}`);
    }

    parent.children = parent.children ?? [];
    parent.children.push({
      id: `vf_${Date.now()}_${name}`,
      name,
      type: "folder",
      relativePath: `${parentPath}/${name}`,
      children: [],
    });
    parent.children = this.sortTree(parent.children);

    return newTree;
  }

  // ---------------------------------------------------------------------------
  // Rename
  // ---------------------------------------------------------------------------

  /**
   * Rename a node at `nodePath` to `newName`.
   * Returns `{ tree, renames }` with the updated tree and any rename records.
   */
  renameNode(
    tree: ImportTreeNode[],
    nodePath: string,
    newName: string,
  ): { tree: ImportTreeNode[]; renames: RenamedFileEntry[] } {
    const newTree = this.deepClone(tree);
    const renames: RenamedFileEntry[] = [];
    const now = new Date();

    const node = this.findNode(newTree, nodePath);
    if (!node) {
      throw new Error(`Node not found: ${nodePath}`);
    }

    const oldName = node.name;
    node.name = newName;

    // Update relativePath for the node and all descendants
    this.updateRelativePaths(node, nodePath, newName);

    renames.push({
      originalName: oldName,
      newName,
      relativePath: node.relativePath,
      reason: "user",
      timestamp: now,
    });

    // Collect renames for descendants
    this.collectDescendantRenames(node, renames, now);

    return { tree: newTree, renames };
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  /**
   * Delete a node at `nodePath`.
   * Returns a new tree with the node removed.
   */
  deleteNode(tree: ImportTreeNode[], nodePath: string): ImportTreeNode[] {
    return tree
      .map((node) => {
        if (node.relativePath === nodePath) {
          return null; // remove this node
        }

        // Recurse into children
        if (node.children && node.children.length > 0) {
          const updatedChildren = this.deleteNode(node.children, nodePath);
          return { ...node, children: updatedChildren };
        }

        return node;
      })
      .filter((n): n is ImportTreeNode => n !== null);
  }

  // ---------------------------------------------------------------------------
  // Move
  // ---------------------------------------------------------------------------

  /**
   * Move a node from `fromPath` to `toPath`.
   * `toPath` is the new parent directory path (must be a folder).
   * Returns `{ tree, renames }`.
   */
  moveNode(
    tree: ImportTreeNode[],
    fromPath: string,
    toPath: string,
  ): { tree: ImportTreeNode[]; renames: RenamedFileEntry[] } {
    const newTree = this.deepClone(tree);
    const renames: RenamedFileEntry[] = [];
    const now = new Date();

    // Find the source node
    const sourceNode = this.findNode(newTree, fromPath);
    if (!sourceNode) {
      throw new Error(`Source node not found: ${fromPath}`);
    }

    // Clone the source node (deep)
    // biome-ignore lint/style/noNonNullAssertion: deepClone returns a cloned array with the same element we passed in
    const movedNode = this.deepClone([sourceNode])[0]!;

    // Remove from original location
    const cleanedTree = this.deleteNode(newTree, fromPath);

    // Update paths
    const nodeName = movedNode.name;
    const newRelativePath =
      toPath === "" || toPath === "/" ? nodeName : `${toPath}/${nodeName}`;

    movedNode.relativePath = newRelativePath;
    this.rebuildChildPaths(movedNode);

    // Collect rename records
    renames.push({
      originalName: nodeName,
      newName: nodeName,
      relativePath: newRelativePath,
      reason: "user",
      timestamp: now,
    });
    this.collectDescendantRenames(movedNode, renames, now);

    // Insert into destination
    if (toPath === "" || toPath === "/") {
      cleanedTree.push(movedNode);
      return { tree: this.sortTree(cleanedTree), renames };
    }

    const destFolder = this.findNode(cleanedTree, toPath);
    if (!destFolder || destFolder.type !== "folder") {
      throw new Error(`Destination folder not found: ${toPath}`);
    }

    destFolder.children = destFolder.children ?? [];
    destFolder.children.push(movedNode);
    destFolder.children = this.sortTree(destFolder.children);

    return { tree: cleanedTree, renames };
  }

  // ---------------------------------------------------------------------------
  // Duplicate handling
  // ---------------------------------------------------------------------------

  /**
   * Resolve duplicate relative paths in a list of staged files.
   * Appends a numeric suffix to duplicates (e.g. `file_1.txt`, `file_2.txt`).
   * Returns `{ resolved, renames }`.
   */
  resolveDuplicatePaths(files: StagedFile[]): {
    resolved: StagedFile[];
    renames: RenamedFileEntry[];
  } {
    const seenPaths = new Map<string, number>();
    const resolved: StagedFile[] = [];
    const renames: RenamedFileEntry[] = [];
    const now = new Date();

    for (const file of files) {
      let currentPath = file.relativePath;
      const count = seenPaths.get(currentPath) ?? 0;

      if (count > 0) {
        // Generate a unique path by inserting a suffix before the extension
        const ext = this.getExtension(currentPath);
        const base = ext ? currentPath.slice(0, -ext.length - 1) : currentPath;
        currentPath = ext ? `${base}_${count}.${ext}` : `${currentPath}_${count}`;
      }

      seenPaths.set(file.relativePath, count + 1);

      if (currentPath !== file.relativePath) {
        renames.push({
          originalName: file.originalName,
          newName: this.getFileName(currentPath),
          relativePath: currentPath,
          reason: "conflict",
          timestamp: now,
        });
      }

      resolved.push({
        ...file,
        relativePath: currentPath,
        displayName: this.getFileName(currentPath),
      });
    }

    return { resolved, renames };
  }

  // ---------------------------------------------------------------------------
  // Source URI generation
  // ---------------------------------------------------------------------------

  /** Generate canonical source URI for a file. */
  generateSourceUri(library: string, version: string, relativePath: string): string {
    const encodedLib = encodeURIComponent(library);
    const encodedVer = encodeURIComponent(version);
    const encodedPath = relativePath.split("/").map(encodeURIComponent).join("/");
    return `file:///import/${encodedLib}/${encodedVer}/${encodedPath}`;
  }

  /** Generate a human-readable display string for the source. */
  generateSourceDisplay(library: string, version: string, relativePath: string): string {
    return `${library}/${version}/${relativePath}`;
  }

  // ---------------------------------------------------------------------------
  // Flatten
  // ---------------------------------------------------------------------------

  /**
   * Flatten the tree into a flat list of `{ relativePath, fileId }`.
   * Only includes file nodes (not folders).
   */
  flattenTree(tree: ImportTreeNode[]): Array<{ relativePath: string; fileId: string }> {
    const result: Array<{ relativePath: string; fileId: string }> = [];

    const walk = (nodes: ImportTreeNode[]) => {
      for (const node of nodes) {
        if (node.type === "file") {
          result.push({ relativePath: node.relativePath, fileId: node.id });
        }
        if (node.children) {
          walk(node.children);
        }
      }
    };

    walk(tree);
    return result;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /** Deep-clone a tree array. */
  private deepClone(tree: ImportTreeNode[]): ImportTreeNode[] {
    return tree.map((node) => ({
      ...node,
      children: node.children ? this.deepClone(node.children) : undefined,
    }));
  }

  /** Sort: folders first, then alphabetical by name (case-insensitive). */
  private sortTree(nodes: ImportTreeNode[]): ImportTreeNode[] {
    return [...nodes].sort((a, b) => {
      // Folders before files
      if (a.type === "folder" && b.type === "file") return -1;
      if (a.type === "file" && b.type === "folder") return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }

  /** Find a node by relative path. */
  private findNode(
    nodes: ImportTreeNode[],
    targetPath: string,
  ): ImportTreeNode | undefined {
    for (const node of nodes) {
      if (node.relativePath === targetPath) return node;
      if (node.children) {
        const found = this.findNode(node.children, targetPath);
        if (found) return found;
      }
    }
    return undefined;
  }

  /**
   * Update relative paths after a rename.
   * `oldPath` is the old path of the renamed node, `newName` is the new name.
   */
  private updateRelativePaths(
    node: ImportTreeNode,
    oldPath: string,
    newName: string,
  ): void {
    // Compute new path for this node
    const segments = oldPath.split("/");
    const parentSegments = segments.slice(0, -1);
    node.relativePath =
      parentSegments.length > 0 ? `${parentSegments.join("/")}/${newName}` : newName;

    // Rebuild children paths
    this.rebuildChildPaths(node);
  }

  /** Rebuild all children's relativePaths based on the parent's path. */
  private rebuildChildPaths(parent: ImportTreeNode): void {
    if (!parent.children) return;
    for (const child of parent.children) {
      child.relativePath = `${parent.relativePath}/${child.name}`;
      if (child.type === "folder") {
        this.rebuildChildPaths(child);
      }
    }
  }

  /** Collect rename records for all descendants of a node. */
  private collectDescendantRenames(
    node: ImportTreeNode,
    renames: RenamedFileEntry[],
    timestamp: Date,
  ): void {
    if (!node.children) return;
    for (const child of node.children) {
      renames.push({
        originalName: child.name,
        newName: child.name,
        relativePath: child.relativePath,
        reason: "user",
        timestamp,
      });
      if (child.type === "folder") {
        this.collectDescendantRenames(child, renames, timestamp);
      }
    }
  }

  /** Extract file extension from a path (without the dot). */
  private getExtension(filePath: string): string {
    const lastDot = filePath.lastIndexOf(".");
    const lastSlash = filePath.lastIndexOf("/");
    if (lastDot <= lastSlash) return "";
    return filePath.slice(lastDot + 1);
  }

  /** Extract just the filename from a relative path. */
  private getFileName(filePath: string): string {
    const lastSlash = filePath.lastIndexOf("/");
    return lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
  }
}
