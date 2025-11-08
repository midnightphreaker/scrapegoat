/**
 * Screenshot storage utilities for managing screenshot files.
 * Implements file-based storage with database path references.
 */

import { createHash } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { logger } from "./logger";

const DEFAULT_SCREENSHOT_DIR = "./public/screenshots";
const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024; // 5MB

export interface SaveScreenshotOptions {
  library: string;
  version: string;
  url: string;
  data: string | Buffer; // base64 string or buffer
}

/**
 * Save screenshot to file system and return relative path for database storage
 * @param options Screenshot save options
 * @returns Relative path to screenshot (e.g., /screenshots/react/18.0.0/abc123.png)
 * @throws Error if screenshot exceeds size limit or save fails
 */
export async function saveScreenshot(options: SaveScreenshotOptions): Promise<string> {
  const { library, version, url, data } = options;

  // Convert base64 to buffer if needed
  const buffer = typeof data === "string" ? Buffer.from(data, "base64") : data;

  // Validate size
  const maxSize = parseInt(process.env.SCREENSHOT_MAX_SIZE_MB || "5") * 1024 * 1024;
  if (buffer.length > maxSize) {
    throw new Error(
      `Screenshot too large: ${(buffer.length / 1024 / 1024).toFixed(2)}MB (max: ${maxSize / 1024 / 1024}MB)`,
    );
  }

  // Generate filename from URL hash to avoid duplicates and path issues
  const urlHash = createHash("sha256").update(url).digest("hex").slice(0, 16);
  const filename = `${urlHash}.png`;

  // Build directory path
  const screenshotDir = process.env.SCREENSHOT_STORAGE_PATH || DEFAULT_SCREENSHOT_DIR;
  const versionDir = version || "unversioned";
  const dir = join(screenshotDir, library, versionDir);

  // Ensure directory exists
  await mkdir(dir, { recursive: true });

  // Write file
  const filepath = join(dir, filename);
  await writeFile(filepath, buffer);

  logger.debug(`Saved screenshot: ${filepath} (${(buffer.length / 1024).toFixed(1)}KB)`);

  // Return relative path (relative to public directory)
  // Remove leading './public' from path for web serving
  const relativePath = filepath.replace(/^\.\/public/, "");
  return relativePath;
}

/**
 * Load screenshot from file system
 * @param path Relative path to screenshot (e.g., /screenshots/react/18.0.0/abc123.png)
 * @returns Screenshot buffer
 * @throws Error if file not found or read fails
 */
export async function loadScreenshot(path: string): Promise<Buffer> {
  // Convert relative path to full path
  const fullPath = path.startsWith("/") ? join("./public", path) : path;

  try {
    return await readFile(fullPath);
  } catch (error) {
    logger.warn(`Failed to load screenshot ${fullPath}:`, error);
    throw new Error(`Screenshot not found: ${path}`);
  }
}

/**
 * Delete screenshot from file system
 * @param path Relative path to screenshot
 */
export async function deleteScreenshot(path: string): Promise<void> {
  // Convert relative path to full path
  const fullPath = path.startsWith("/") ? join("./public", path) : path;

  try {
    await unlink(fullPath);
    logger.debug(`Deleted screenshot: ${fullPath}`);
  } catch (error) {
    logger.warn(`Failed to delete screenshot ${fullPath}:`, error);
    // Don't throw - deletion failure is not critical
  }
}

/**
 * Get screenshot size without loading entire file
 * @param path Relative path to screenshot
 * @returns Size in bytes, or null if file not found
 */
export async function getScreenshotSize(path: string): Promise<number | null> {
  const fullPath = path.startsWith("/") ? join("./public", path) : path;

  try {
    const { stat } = await import("fs/promises");
    const stats = await stat(fullPath);
    return stats.size;
  } catch {
    return null;
  }
}
