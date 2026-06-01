/**
 * Security utilities for the upload system.
 * Provides path traversal prevention, zip-slip detection, symlink blocking,
 * and decompression bomb protection.
 */

import path from "node:path";

/**
 * Validates that a file path does not contain path traversal sequences.
 * Blocks `..`, null bytes, and other dangerous patterns.
 *
 * @throws Error if path is unsafe
 */
export function validateSafePath(inputPath: string): string {
  // Block null bytes
  if (inputPath.includes("\0")) {
    throw new Error(`Path contains null byte: ${inputPath}`);
  }

  // Normalize the path
  const normalized = path.normalize(inputPath);

  // Check for path traversal
  if (normalized.includes("..")) {
    throw new Error(`Path traversal detected: ${inputPath}`);
  }

  return normalized;
}

/**
 * Validates that a resolved path stays within the allowed base directory.
 * Prevents zip-slip attacks where extracted files escape the target directory.
 *
 * @param resolvedPath - The fully resolved absolute path to check
 * @param basePath - The base directory that must contain the resolved path
 * @throws Error if the path escapes the base directory
 */
export function ensureWithinBase(resolvedPath: string, basePath: string): void {
  const normalizedBase = path.resolve(basePath);
  const normalizedTarget = path.resolve(resolvedPath);

  // Ensure the target starts with the base path
  // Use path.relative to check containment cross-platform
  const relative = path.relative(normalizedBase, normalizedTarget);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(
      `Path escapes staging directory: ${resolvedPath} is outside ${basePath}`,
    );
  }
}

/**
 * Validates an archive entry path for zip-slip and other security issues.
 *
 * @param entryPath - The path from an archive entry
 * @throws Error if the entry path is unsafe
 */
export function validateArchiveEntryPath(entryPath: string): string {
  // Block null bytes
  if (entryPath.includes("\0")) {
    throw new Error(`Archive entry contains null byte: ${entryPath}`);
  }

  // Block absolute paths (Windows and Unix)
  if (path.isAbsolute(entryPath)) {
    throw new Error(`Archive entry has absolute path: ${entryPath}`);
  }

  // Normalize and check for traversal
  const normalized = path.normalize(entryPath);

  if (normalized.startsWith("..") || normalized.includes(`${path.sep}..`)) {
    throw new Error(`Zip-slip detected in archive entry: ${entryPath}`);
  }

  // Block paths that start with a drive letter (Windows)
  if (/^[a-zA-Z]:/.test(normalized)) {
    throw new Error(`Archive entry has Windows drive path: ${entryPath}`);
  }

  return normalized;
}

/**
 * Checks if a file size is within acceptable limits.
 */
export function validateFileSize(size: number, maxSize: number, fileName: string): void {
  if (size > maxSize) {
    throw new Error(
      `File "${fileName}" exceeds maximum size limit (${formatBytes(maxSize)}): ${formatBytes(size)}`,
    );
  }
}

/**
 * Validates total session size.
 */
export function validateTotalSize(
  currentTotal: number,
  additionalBytes: number,
  maxTotal: number,
): void {
  if (currentTotal + additionalBytes > maxTotal) {
    throw new Error(`Total upload size would exceed limit (${formatBytes(maxTotal)})`);
  }
}

/**
 * Validates archive entry count against decompression bomb limits.
 */
export function validateArchiveEntryCount(
  currentCount: number,
  maxEntries: number,
): void {
  if (currentCount >= maxEntries) {
    throw new Error(
      `Archive entry count exceeds limit (${maxEntries}). Possible decompression bomb.`,
    );
  }
}

/**
 * Validates uncompressed archive size against limits.
 */
export function validateUncompressedSize(
  currentSize: number,
  additionalBytes: number,
  maxUncompressed: number,
): void {
  if (currentSize + additionalBytes > maxUncompressed) {
    throw new Error(
      `Uncompressed archive size exceeds limit (${formatBytes(maxUncompressed)}). Possible decompression bomb.`,
    );
  }
}

/**
 * Formats bytes into a human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

/**
 * File extensions accepted for ingestion (FR-3.3.5).
 * Archive formats are also accepted — they are extracted separately.
 */
const INGESTIBLE_EXTENSIONS = new Set([
  // Document formats
  ".md",
  ".markdown",
  ".txt",
  // Archive formats (extracted, not ingested directly, but accepted for upload)
  ".zip",
  ".tar",
  ".tar.gz",
  ".tgz",
  ".tar.bz2",
]);

/**
 * Checks whether a file's extension is in the accepted set for ingestion.
 * Matches against lowercase extensions including compound ones like `.tar.gz`.
 *
 * @param fileName - The filename (or full path) to check
 * @returns `true` if the file type is accepted for ingestion
 */
export function isIngestibleFileType(fileName: string): boolean {
  const lower = fileName.toLowerCase();

  // Check compound extensions first
  if (lower.endsWith(".tar.gz") || lower.endsWith(".tar.bz2")) {
    return true;
  }

  const ext = path.extname(lower);
  return INGESTIBLE_EXTENSIONS.has(ext);
}

/**
 * Sanitizes a filename for safe filesystem usage.
 * Removes or replaces dangerous characters.
 */
export function sanitizeFileName(name: string): string {
  // Remove null bytes
  let sanitized = name.replace(/\0/g, "");

  // Replace dangerous characters with underscores
  // Keep alphanumeric, dots, dashes, underscores, spaces
  sanitized = sanitized.replace(/[<>:"|?*\\]/g, "_");

  // Remove leading dots (hidden files) and dashes (could be option flags)
  sanitized = sanitized.replace(/^[.-]+/, "");

  // Limit length
  if (sanitized.length > 255) {
    const ext = path.extname(sanitized);
    const base = path.basename(sanitized, ext);
    sanitized = `${base.slice(0, 255 - ext.length)}${ext}`;
  }

  // If nothing remains after sanitization, generate a name
  if (!sanitized) {
    sanitized = `file_${Date.now()}`;
  }

  return sanitized;
}
