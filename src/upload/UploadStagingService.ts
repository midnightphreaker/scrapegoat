/**
 * UploadStagingService — manages upload sessions and temporary file storage.
 *
 * Responsibilities:
 *  - Create / track upload sessions (unique ID, library name, version)
 *  - Stage uploaded files to a temporary directory
 *  - Support two modes: memory (tmpdir-based) and filesystem (configurable path)
 *  - Session cleanup with TTL expiry
 *  - Get session state, list files, remove / rename / move files
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import mime from "mime";
import { MimeTypeUtils } from "../utils/mimeTypeUtils";
import { ImportTreeBuilder } from "./ImportTreeBuilder";
import {
  ensureWithinBase,
  formatBytes,
  isIngestibleFileType,
  sanitizeFileName,
  validateFileSize,
  validateTotalSize,
} from "./security";
import type {
  FailedFileEntry,
  ImportFolder,
  ImportTreeNode,
  StagedFile,
  UploadConfig,
  UploadSession,
  UploadSessionId,
} from "./types";
import { DEFAULT_UPLOAD_CONFIG, UploadSessionStatus } from "./types";

/** Generate a unique session ID */
function generateSessionId(): UploadSessionId {
  return `upl_${crypto.randomUUID()}`;
}

/** Generate a unique file ID */
function generateFileId(): string {
  return `file_${crypto.randomUUID()}`;
}

export class UploadStagingService {
  private sessions: Map<string, UploadSession>;
  private config: UploadConfig;
  private cleanupTimer: ReturnType<typeof setInterval> | null;
  private treeBuilder: ImportTreeBuilder;

  constructor(config?: Partial<UploadConfig>) {
    this.config = { ...DEFAULT_UPLOAD_CONFIG, ...config };
    this.sessions = new Map();
    this.cleanupTimer = null;
    this.treeBuilder = new ImportTreeBuilder();

    // Start periodic cleanup if TTL is configured
    if (this.config.sessionTtlSeconds > 0) {
      const intervalMs = Math.max(
        30_000,
        Math.min(this.config.sessionTtlSeconds * 500, 600_000),
      );
      this.cleanupTimer = setInterval(() => {
        this.cleanupExpiredSessions().catch(() => {
          /* swallow — timer callback */
        });
      }, intervalMs);

      // Allow the process to exit even if the timer is still running
      if (this.cleanupTimer && typeof this.cleanupTimer === "object") {
        if ("unref" in this.cleanupTimer) {
          this.cleanupTimer.unref();
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Session lifecycle
  // ---------------------------------------------------------------------------

  /** Create a new upload session for a library + version. */
  async createSession(library: string, version: string): Promise<UploadSession> {
    const id = generateSessionId();
    const stagingPath =
      this.config.stagingMode === "filesystem" && this.config.stagingPath
        ? path.resolve(this.config.stagingPath, id)
        : path.join(os.tmpdir(), "scrapegoat-upload", id);

    // Ensure staging directory exists
    await fs.mkdir(stagingPath, { recursive: true });

    const now = new Date();
    const session: UploadSession = {
      id,
      status: UploadSessionStatus.ACTIVE,
      library,
      version,
      createdAt: now,
      updatedAt: now,
      files: new Map(),
      folders: new Map(),
      stagingPath,
      failedFiles: [],
      renamedFiles: [],
    };

    this.sessions.set(id, session);
    return session;
  }

  /** Retrieve an existing session by ID. */
  getSession(sessionId: UploadSessionId): UploadSession | undefined {
    return this.sessions.get(sessionId);
  }

  // ---------------------------------------------------------------------------
  // File operations
  // ---------------------------------------------------------------------------

  /**
   * Stage a single file into the session.
   * The file content is written to the session's staging directory.
   */
  async stageFile(
    sessionId: UploadSessionId,
    fileName: string,
    content: Buffer,
    fromArchive = false,
    archiveSource?: string,
    detectedMimeType?: string,
  ): Promise<StagedFile> {
    const session = this.requireActiveSession(sessionId);

    // Validate sizes
    validateFileSize(content.length, this.config.maxFileSizeBytes, fileName);
    const mimeType =
      detectedMimeType ?? mime.getType(fileName) ?? "application/octet-stream";
    if (
      this.config.maxDocumentSizeBytes !== undefined &&
      MimeTypeUtils.isSupportedDocument(mimeType) &&
      content.length > this.config.maxDocumentSizeBytes
    ) {
      throw new Error(
        `File "${fileName}" exceeds maximum document size limit (${formatBytes(this.config.maxDocumentSizeBytes)}): ${formatBytes(content.length)}`,
      );
    }
    const currentTotal = this.totalSessionSize(session);
    validateTotalSize(currentTotal, content.length, this.config.maxTotalSizeBytes);

    // Enforce max files
    if (session.files.size >= this.config.maxFiles) {
      throw new Error(
        `Maximum file count reached (${this.config.maxFiles}) for session ${sessionId}`,
      );
    }

    const safeName = sanitizeFileName(fileName);
    const fileId = generateFileId();
    const relativePath = safeName;

    // Validate path depth
    const depth = relativePath.split("/").length - 1;
    if (depth > this.config.maxDepth) {
      throw new Error(
        `Path depth (${depth}) exceeds maximum (${this.config.maxDepth}): ${relativePath}`,
      );
    }

    // Validate filename length
    const basename = path.basename(relativePath);
    if (basename.length > this.config.maxFilenameLength) {
      throw new Error(
        `Filename "${basename}" exceeds maximum length (${this.config.maxFilenameLength})`,
      );
    }

    // Validate full path length
    if (relativePath.length > this.config.maxPathLength) {
      throw new Error(
        `Path "${relativePath}" exceeds maximum length (${this.config.maxPathLength})`,
      );
    }

    const absolutePath = path.resolve(session.stagingPath, relativePath);

    // Security: ensure we stay inside the staging directory
    ensureWithinBase(absolutePath, session.stagingPath);

    // Ensure parent dir exists
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });

    // Write the file
    await fs.writeFile(absolutePath, content);

    const staged: StagedFile = {
      id: fileId,
      originalName: fileName,
      displayName: safeName,
      relativePath,
      absolutePath,
      size: content.length,
      mimeType,
      fromArchive,
      archiveSource,
      ingestible:
        isIngestibleFileType(safeName) || MimeTypeUtils.isSupportedDocument(mimeType),
    };

    // Check for rename
    if (safeName !== fileName) {
      session.renamedFiles.push({
        originalName: fileName,
        newName: safeName,
        relativePath,
        reason: "normalization",
        timestamp: new Date(),
      });
    }

    session.files.set(fileId, staged);
    session.updatedAt = new Date();

    return staged;
  }

  /** Remove a staged file from the session. */
  async removeFile(sessionId: UploadSessionId, fileId: string): Promise<void> {
    const session = this.requireActiveSession(sessionId);
    const file = session.files.get(fileId);
    if (!file) {
      throw new Error(`File ${fileId} not found in session ${sessionId}`);
    }

    // Remove from disk
    try {
      await fs.unlink(file.absolutePath);
    } catch (err: unknown) {
      // File may already have been removed; ignore ENOENT
      if (
        err instanceof Error &&
        "code" in err &&
        (err as NodeJS.ErrnoException).code !== "ENOENT"
      ) {
        throw err;
      }
    }

    session.files.delete(fileId);
    session.updatedAt = new Date();
  }

  /** Record a file that failed during upload processing. */
  recordFailedFile(
    sessionId: UploadSessionId,
    entry: { originalName: string; relativePath: string; error: string },
  ): void {
    const session = this.requireSession(sessionId);
    const failedEntry: FailedFileEntry = {
      originalName: entry.originalName,
      relativePath: entry.relativePath,
      error: entry.error,
      timestamp: new Date(),
    };
    session.failedFiles.push(failedEntry);
    session.updatedAt = new Date();
  }

  /** Rename a staged file (updates display name and relative path). */
  async renameFile(
    sessionId: UploadSessionId,
    fileId: string,
    newName: string,
  ): Promise<void> {
    const session = this.requireActiveSession(sessionId);
    const file = session.files.get(fileId);
    if (!file) {
      throw new Error(`File ${fileId} not found in session ${sessionId}`);
    }

    const safeName = sanitizeFileName(newName);
    const newAbsolutePath = path.resolve(path.dirname(file.absolutePath), safeName);
    ensureWithinBase(newAbsolutePath, session.stagingPath);

    await fs.rename(file.absolutePath, newAbsolutePath);

    const oldName = file.displayName;
    file.displayName = safeName;
    file.relativePath = path.relative(session.stagingPath, newAbsolutePath);
    file.absolutePath = newAbsolutePath;

    if (oldName !== safeName) {
      session.renamedFiles.push({
        originalName: oldName,
        newName: safeName,
        relativePath: file.relativePath,
        reason: "user",
        timestamp: new Date(),
      });
    }

    session.updatedAt = new Date();
  }

  /** Move a file to a new relative path within the session. */
  async moveFile(
    sessionId: UploadSessionId,
    fileId: string,
    newRelativePath: string,
  ): Promise<void> {
    const session = this.requireActiveSession(sessionId);
    const file = session.files.get(fileId);
    if (!file) {
      throw new Error(`File ${fileId} not found in session ${sessionId}`);
    }

    const sanitizedSegments = newRelativePath
      .split("/")
      .map((s) => sanitizeFileName(s))
      .join("/");
    const newAbsolutePath = path.resolve(session.stagingPath, sanitizedSegments);
    ensureWithinBase(newAbsolutePath, session.stagingPath);

    // Ensure target directory exists
    await fs.mkdir(path.dirname(newAbsolutePath), { recursive: true });
    await fs.rename(file.absolutePath, newAbsolutePath);

    file.relativePath = sanitizedSegments;
    file.absolutePath = newAbsolutePath;
    session.updatedAt = new Date();
  }

  /**
   * Create a virtual (empty) folder in the staging directory.
   * The folder is tracked in session.folders for tree building.
   */
  async createVirtualFolder(
    sessionId: UploadSessionId,
    folderPath: string,
  ): Promise<void> {
    const session = this.requireActiveSession(sessionId);

    const sanitized = folderPath
      .split("/")
      .map((s) => sanitizeFileName(s))
      .join("/");
    const absolutePath = path.resolve(session.stagingPath, sanitized);
    ensureWithinBase(absolutePath, session.stagingPath);

    await fs.mkdir(absolutePath, { recursive: true });

    // Track the virtual folder in the session
    const folderName = path.basename(sanitized);
    const folderId = `vf_${crypto.randomUUID()}`;
    const importFolder: ImportFolder = {
      id: folderId,
      name: folderName,
      relativePath: sanitized,
      virtual: true,
    };
    session.folders.set(sanitized, importFolder);

    session.updatedAt = new Date();
  }

  /** Remove a virtual folder from the session and disk. */
  async removeVirtualFolder(
    sessionId: UploadSessionId,
    folderPath: string,
  ): Promise<void> {
    const session = this.requireActiveSession(sessionId);
    const sanitized = folderPath
      .split("/")
      .map((s) => sanitizeFileName(s))
      .join("/");
    const absolutePath = path.resolve(session.stagingPath, sanitized);
    ensureWithinBase(absolutePath, session.stagingPath);

    // Remove from disk
    try {
      await fs.rm(absolutePath, { recursive: true, force: true });
    } catch {
      // Best-effort — folder may already be gone
    }

    // Remove from session tracking
    session.folders.delete(sanitized);
    session.updatedAt = new Date();
  }

  /** Rename a virtual folder, updating session.folders tracking. */
  async renameVirtualFolder(
    sessionId: UploadSessionId,
    oldFolderPath: string,
    newName: string,
  ): Promise<void> {
    const session = this.requireActiveSession(sessionId);

    const oldSanitized = oldFolderPath
      .split("/")
      .map((s) => sanitizeFileName(s))
      .join("/");
    const safeName = sanitizeFileName(newName);
    const parentDir = path.dirname(oldSanitized);
    const newRelativePath = parentDir === "." ? safeName : `${parentDir}/${safeName}`;

    const oldAbsolutePath = path.resolve(session.stagingPath, oldSanitized);
    const newAbsolutePath = path.resolve(session.stagingPath, newRelativePath);
    ensureWithinBase(newAbsolutePath, session.stagingPath);

    // Rename on disk
    await fs.rename(oldAbsolutePath, newAbsolutePath);

    // Update folder tracking
    const folder = session.folders.get(oldSanitized);
    if (folder) {
      session.folders.delete(oldSanitized);
      folder.name = safeName;
      folder.relativePath = newRelativePath;
      session.folders.set(newRelativePath, folder);
    }

    session.updatedAt = new Date();
  }

  /** Move a virtual folder to a new parent path, updating session.folders tracking. */
  async moveVirtualFolder(
    sessionId: UploadSessionId,
    folderPath: string,
    newParentPath: string,
  ): Promise<void> {
    const session = this.requireActiveSession(sessionId);

    const oldSanitized = folderPath
      .split("/")
      .map((s) => sanitizeFileName(s))
      .join("/");
    const folderName = path.basename(oldSanitized);

    const sanitizedParent = newParentPath
      .split("/")
      .map((s) => sanitizeFileName(s))
      .join("/");
    const newRelativePath =
      sanitizedParent === "" || sanitizedParent === "."
        ? folderName
        : `${sanitizedParent}/${folderName}`;

    const oldAbsolutePath = path.resolve(session.stagingPath, oldSanitized);
    const newAbsolutePath = path.resolve(session.stagingPath, newRelativePath);
    ensureWithinBase(newAbsolutePath, session.stagingPath);

    // Ensure target parent dir exists
    await fs.mkdir(path.dirname(newAbsolutePath), { recursive: true });
    await fs.rename(oldAbsolutePath, newAbsolutePath);

    // Update folder tracking
    const folder = session.folders.get(oldSanitized);
    if (folder) {
      session.folders.delete(oldSanitized);
      folder.relativePath = newRelativePath;
      session.folders.set(newRelativePath, folder);
    }

    session.updatedAt = new Date();
  }

  // ---------------------------------------------------------------------------
  // Session commit / cancel / destroy
  // ---------------------------------------------------------------------------

  /**
   * Commit the session — marks it as committed.
   * At this point files are ready for the ingestion pipeline.
   */
  async commitSession(sessionId: UploadSessionId): Promise<void> {
    const session = this.requireActiveSession(sessionId);
    session.status = UploadSessionStatus.COMMITTED;
    session.updatedAt = new Date();
  }

  /** Cancel a session and remove all staged files from disk. */
  async cancelSession(sessionId: UploadSessionId): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = UploadSessionStatus.CANCELLED;
    session.updatedAt = new Date();

    await this.removeStagingDir(session);
  }

  /**
   * Destroy a session — cancels if active, removes all state.
   * Unlike cancel, this also removes the session from the map.
   */
  async destroySession(sessionId: UploadSessionId): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (
      session.status === UploadSessionStatus.ACTIVE ||
      session.status === UploadSessionStatus.COMMITTED
    ) {
      await this.removeStagingDir(session);
    }

    this.sessions.delete(sessionId);
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /** Remove all sessions whose TTL has expired. Returns the number cleaned. */
  async cleanupExpiredSessions(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, session] of this.sessions) {
      if (session.status !== UploadSessionStatus.ACTIVE) continue;

      const ageMs = now - session.updatedAt.getTime();
      if (ageMs > this.config.sessionTtlSeconds * 1000) {
        session.status = UploadSessionStatus.EXPIRED;
        await this.removeStagingDir(session);
        this.sessions.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }

  // ---------------------------------------------------------------------------
  // Tree / stats
  // ---------------------------------------------------------------------------

  /** Build the import tree for a session. */
  async getImportTree(sessionId: UploadSessionId): Promise<{
    tree: ImportTreeNode[];
    failedFiles: FailedFileEntry[];
  }> {
    const session = this.requireSession(sessionId);
    const files = Array.from(session.files.values());
    const folders = Array.from(session.folders.values());
    const rawTree = this.treeBuilder.buildTree(files, folders);

    // Verify tree against actual disk contents to prune phantom entries
    const verifiedTree = await this.treeBuilder.verifyTree(rawTree, files);

    return {
      tree: verifiedTree,
      failedFiles: session.failedFiles,
    };
  }

  /** Get aggregate stats for a session. */
  getSessionStats(sessionId: UploadSessionId): {
    fileCount: number;
    totalSize: number;
    failedFiles: number;
    renamedFiles: number;
    folderCount: number;
    extractionAborted: boolean;
  } {
    const session = this.requireSession(sessionId);
    const files = Array.from(session.files.values());
    return {
      fileCount: files.length,
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      failedFiles: session.failedFiles.length,
      renamedFiles: session.renamedFiles.length,
      folderCount: session.folders.size,
      extractionAborted: !!session.extractionAborted,
    };
  }

  /** Mark the session's extraction as aborted (e.g. archive exceeded entry limit). */
  setExtractionAborted(sessionId: UploadSessionId, truncatedAt?: string): void {
    const session = this.requireSession(sessionId);
    session.extractionAborted = true;
    if (truncatedAt) {
      session.extractionTruncatedAt = truncatedAt;
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /** Stop the cleanup timer. Call when shutting down. */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private requireSession(sessionId: UploadSessionId): UploadSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Upload session not found: ${sessionId}`);
    }
    return session;
  }

  private requireActiveSession(sessionId: UploadSessionId): UploadSession {
    const session = this.requireSession(sessionId);
    if (session.status !== UploadSessionStatus.ACTIVE) {
      throw new Error(
        `Upload session ${sessionId} is not active (status: ${session.status})`,
      );
    }
    return session;
  }

  private totalSessionSize(session: UploadSession): number {
    let total = 0;
    for (const file of session.files.values()) {
      total += file.size;
    }
    return total;
  }

  private async removeStagingDir(session: UploadSession): Promise<void> {
    try {
      await fs.rm(session.stagingPath, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup — don't throw on failure
    }
  }
}
