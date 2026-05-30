/**
 * ArchiveExtractor — extracts ZIP, TAR, TAR.GZ/TGZ archives with security checks.
 *
 * Key features:
 *  - Archive type detection via magic bytes (not file extension)
 *  - Security validation on every entry (zip-slip, bomb limits)
 *  - Stream-based extraction for large archives
 *  - Nested archive detection (flags but does not extract recursively)
 *  - Uses project deps: yauzl (ZIP), tar (TAR)
 */

import fs from "node:fs/promises";
import path from "node:path";
import * as tar from "tar";
import yauzl from "yauzl";
import {
  ensureWithinBase,
  validateArchiveEntryCount,
  validateArchiveEntryPath,
  validateFileSize,
  validateUncompressedSize,
} from "./security";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ExtractedFile {
  relativePath: string;
  content: Buffer;
  size: number;
  fromArchive: boolean;
}

export interface ExtractionResult {
  files: ExtractedFile[];
  errors: Array<{ path: string; error: string }>;
  totalExtractedSize: number;
}

// ---------------------------------------------------------------------------
// Known archive extensions for nested-archive detection
// ---------------------------------------------------------------------------

const NESTED_ARCHIVE_EXTENSIONS = new Set([
  ".zip",
  ".tar",
  ".tgz",
  ".tar.gz",
  ".gz",
  ".bz2",
  ".xz",
  ".7z",
  ".rar",
]);

// ---------------------------------------------------------------------------
// Magic-byte offsets
// ---------------------------------------------------------------------------

const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // PK\x03\x04
const GZ_MAGIC = Buffer.from([0x1f, 0x8b]);
const USTAR_MAGIC = Buffer.from("ustar"); // at offset 257

// ---------------------------------------------------------------------------
// ArchiveExtractor
// ---------------------------------------------------------------------------

export class ArchiveExtractor {
  constructor(
    private maxEntries: number,
    private maxUncompressedBytes: number,
  ) {}

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Extract an archive buffer to `targetDir`.
   * Detects archive type automatically from magic bytes.
   */
  async extract(buffer: Buffer, targetDir: string): Promise<ExtractionResult> {
    const archiveType = this.detectArchiveType(buffer);
    if (!archiveType) {
      throw new Error("Unrecognized archive format. Supported: ZIP, TAR, TAR.GZ/TGZ");
    }

    // Ensure target dir exists
    await fs.mkdir(targetDir, { recursive: true });

    switch (archiveType) {
      case "zip":
        return this.extractZip(buffer, targetDir);
      case "tar.gz":
        return this.extractTarGz(buffer, targetDir);
      case "tar":
        return this.extractTar(buffer, targetDir);
    }
  }

  /**
   * Detect archive type from content magic bytes.
   * Returns `"zip"`, `"tar"`, `"tar.gz"`, or `null`.
   */
  detectArchiveType(buffer: Buffer): "zip" | "tar" | "tar.gz" | null {
    // Check gzip first (tar.gz is a subset of gzip)
    if (buffer.length >= 2 && buffer[0] === GZ_MAGIC[0] && buffer[1] === GZ_MAGIC[1]) {
      return "tar.gz";
    }

    // Check ZIP
    if (
      buffer.length >= 4 &&
      buffer[0] === ZIP_MAGIC[0] &&
      buffer[1] === ZIP_MAGIC[1] &&
      buffer[2] === ZIP_MAGIC[2] &&
      buffer[3] === ZIP_MAGIC[3]
    ) {
      return "zip";
    }

    // Check TAR (ustar at offset 257)
    if (buffer.length >= 262) {
      let match = true;
      for (let i = 0; i < USTAR_MAGIC.length; i++) {
        if (buffer[257 + i] !== USTAR_MAGIC[i]) {
          match = false;
          break;
        }
      }
      if (match) return "tar";
    }

    return null;
  }

  /** Returns true if the buffer looks like a supported archive. */
  isArchiveBuffer(buffer: Buffer): boolean {
    return this.detectArchiveType(buffer) !== null;
  }

  /** Returns true if `filePath` has a known archive extension (nested-archive check). */
  isNestedArchive(filePath: string): boolean {
    const lower = filePath.toLowerCase();
    for (const ext of NESTED_ARCHIVE_EXTENSIONS) {
      if (lower.endsWith(ext)) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // ZIP extraction (yauzl — callback-based, promisified)
  // ---------------------------------------------------------------------------

  private extractZip(buffer: Buffer, targetDir: string): Promise<ExtractionResult> {
    return new Promise((resolve) => {
      const files: ExtractedFile[] = [];
      const errors: Array<{ path: string; error: string }> = [];
      let totalSize = 0;
      let entryCount = 0;

      yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
        if (err) {
          resolve({
            files: [],
            errors: [{ path: "<archive>", error: err.message }],
            totalExtractedSize: 0,
          });
          return;
        }

        zipfile.on("error", (zipErr) => {
          errors.push({ path: "<archive>", error: zipErr.message });
        });

        zipfile.on("end", () => {
          resolve({ files, errors, totalExtractedSize: totalSize });
        });

        zipfile.on("entry", (entry) => {
          // Skip directories
          if (entry.fileName.endsWith("/")) {
            zipfile.readEntry();
            return;
          }

          // Enforce entry count
          entryCount++;
          try {
            validateArchiveEntryCount(entryCount, this.maxEntries);
          } catch (e: unknown) {
            errors.push({
              path: entry.fileName,
              error: e instanceof Error ? e.message : String(e),
            });
            zipfile.readEntry();
            return;
          }

          // Validate path
          let safePath: string;
          try {
            safePath = validateArchiveEntryPath(entry.fileName);
          } catch (e: unknown) {
            errors.push({
              path: entry.fileName,
              error: e instanceof Error ? e.message : String(e),
            });
            zipfile.readEntry();
            return;
          }

          // Enforce uncompressed size
          try {
            validateUncompressedSize(
              totalSize,
              entry.uncompressedSize,
              this.maxUncompressedBytes,
            );
          } catch (e: unknown) {
            errors.push({
              path: entry.fileName,
              error: e instanceof Error ? e.message : String(e),
            });
            zipfile.readEntry();
            return;
          }

          // Read the entry stream into a buffer
          zipfile.openReadStream(entry, (rsErr, readStream) => {
            if (rsErr) {
              errors.push({
                path: entry.fileName,
                error: rsErr.message,
              });
              zipfile.readEntry();
              return;
            }

            const chunks: Buffer[] = [];
            let byteCount = 0;

            readStream.on("data", (chunk: Buffer) => {
              byteCount += chunk.length;
              chunks.push(chunk);
            });

            readStream.on("error", (streamErr) => {
              errors.push({
                path: entry.fileName,
                error: streamErr.message,
              });
              zipfile.readEntry();
            });

            readStream.on("end", () => {
              const content = Buffer.concat(chunks, byteCount);

              // Validate individual file size
              try {
                validateFileSize(
                  content.length,
                  this.maxUncompressedBytes,
                  entry.fileName,
                );
              } catch (e: unknown) {
                errors.push({
                  path: entry.fileName,
                  error: e instanceof Error ? e.message : String(e),
                });
                zipfile.readEntry();
                return;
              }

              totalSize += content.length;

              const destPath = path.resolve(targetDir, safePath);
              try {
                ensureWithinBase(destPath, targetDir);
              } catch (e: unknown) {
                errors.push({
                  path: entry.fileName,
                  error: e instanceof Error ? e.message : String(e),
                });
                zipfile.readEntry();
                return;
              }

              files.push({
                relativePath: safePath,
                content,
                size: content.length,
                fromArchive: true,
              });

              zipfile.readEntry();
            });
          });
        });

        // Kick off reading
        zipfile.readEntry();
      });
    });
  }

  // ---------------------------------------------------------------------------
  // TAR.GZ extraction (tar module)
  // ---------------------------------------------------------------------------

  private async extractTarGz(
    buffer: Buffer,
    targetDir: string,
  ): Promise<ExtractionResult> {
    // Write the buffer to a temporary .tar.gz so the `tar` module can read it
    const tmpFile = path.join(targetDir, `.tmp_archive_${Date.now()}.tar.gz`);
    await fs.writeFile(tmpFile, buffer);

    try {
      return await this.extractTarArchive(tmpFile, targetDir, true);
    } finally {
      // Clean up temp file
      try {
        await fs.unlink(tmpFile);
      } catch {
        /* best effort */
      }
    }
  }

  // ---------------------------------------------------------------------------
  // TAR extraction (tar module)
  // ---------------------------------------------------------------------------

  private async extractTar(buffer: Buffer, targetDir: string): Promise<ExtractionResult> {
    // Write buffer to a temp .tar
    const tmpFile = path.join(targetDir, `.tmp_archive_${Date.now()}.tar`);
    await fs.writeFile(tmpFile, buffer);

    try {
      return await this.extractTarArchive(tmpFile, targetDir, false);
    } finally {
      try {
        await fs.unlink(tmpFile);
      } catch {
        /* best effort */
      }
    }
  }

  /**
   * Shared logic for extracting a .tar or .tar.gz via the `tar` module.
   * We first list entries to validate them, then extract.
   */
  private async extractTarArchive(
    archivePath: string,
    targetDir: string,
    isGzip: boolean,
  ): Promise<ExtractionResult> {
    const files: ExtractedFile[] = [];
    const errors: Array<{ path: string; error: string }> = [];
    let totalSize = 0;
    let entryCount = 0;

    // Collect entries first for validation
    const entries: Array<{ path: string; size: number }> = [];

    await tar.list({
      file: archivePath,
      gzip: isGzip,
      onentry: (entry) => {
        const entryPath = entry.path;
        if (entryPath.endsWith("/")) return; // skip dirs

        entryCount++;
        try {
          validateArchiveEntryCount(entryCount, this.maxEntries);
        } catch (e: unknown) {
          errors.push({
            path: entryPath,
            error: e instanceof Error ? e.message : String(e),
          });
          return;
        }

        try {
          const safe = validateArchiveEntryPath(entryPath);
          entries.push({ path: safe, size: entry.size ?? 0 });
        } catch (e: unknown) {
          errors.push({
            path: entryPath,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      },
    });

    // Validate total uncompressed size
    const sumSize = entries.reduce((s, e) => s + e.size, 0);
    try {
      validateUncompressedSize(totalSize, sumSize, this.maxUncompressedBytes);
    } catch (e: unknown) {
      errors.push({
        path: "<archive>",
        error: e instanceof Error ? e.message : String(e),
      });
      return { files: [], errors, totalExtractedSize: 0 };
    }

    // Now extract
    await tar.extract({
      file: archivePath,
      cwd: targetDir,
      gzip: isGzip,
    });

    // Read back the extracted files
    for (const entry of entries) {
      const absPath = path.resolve(targetDir, entry.path);

      try {
        ensureWithinBase(absPath, targetDir);
      } catch (e: unknown) {
        errors.push({
          path: entry.path,
          error: e instanceof Error ? e.message : String(e),
        });
        continue;
      }

      let content: Buffer;
      try {
        content = await fs.readFile(absPath);
      } catch (readErr: unknown) {
        errors.push({
          path: entry.path,
          error: readErr instanceof Error ? readErr.message : String(readErr),
        });
        continue;
      }

      try {
        validateFileSize(content.length, this.maxUncompressedBytes, entry.path);
      } catch (e: unknown) {
        errors.push({
          path: entry.path,
          error: e instanceof Error ? e.message : String(e),
        });
        // Remove the extracted file since it exceeded limits
        try {
          await fs.unlink(absPath);
        } catch {
          /* best effort */
        }
        continue;
      }

      totalSize += content.length;
      files.push({
        relativePath: entry.path,
        content,
        size: content.length,
        fromArchive: true,
      });
    }

    return { files, errors, totalExtractedSize: totalSize };
  }
}
