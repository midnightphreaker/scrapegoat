/**
 * Core types for the WebUI local file/folder/archive upload system.
 */

/** Unique identifier for upload sessions */
export type UploadSessionId = string;

/** Represents the status of an upload session */
export enum UploadSessionStatus {
  ACTIVE = "active",
  COMMITTED = "committed",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
}

/** A file that has been staged for import */
export interface StagedFile {
  /** Unique ID within the session */
  id: string;
  /** Original filename from the upload */
  originalName: string;
  /** Normalized display name (may be renamed by user) */
  displayName: string;
  /** Relative path within the import tree */
  relativePath: string;
  /** Absolute path to the staged file on disk */
  absolutePath: string;
  /** File size in bytes */
  size: number;
  /** Detected or inferred MIME type */
  mimeType: string;
  /** Whether this file came from an archive extraction */
  fromArchive: boolean;
  /** Original archive path if from archive */
  archiveSource?: string;
  /** Whether this file is ingestible by the parser */
  ingestible: boolean;
  /** Error message if processing failed */
  error?: string;
}

/** A virtual folder in the import tree */
export interface ImportFolder {
  /** Unique ID */
  id: string;
  /** Display name */
  name: string;
  /** Relative path */
  relativePath: string;
  /** Whether this is a virtual folder created by user */
  virtual: boolean;
}

/** A node in the import tree (file or folder) */
export type ImportTreeNode = {
  id: string;
  name: string;
  type: "file" | "folder";
  relativePath: string;
  children?: ImportTreeNode[];
  size?: number;
  mimeType?: string;
  ingestible?: boolean;
  error?: string;
  fromArchive?: boolean;
};

/** An upload session */
export interface UploadSession {
  id: UploadSessionId;
  status: UploadSessionStatus;
  library: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  /** Map of staged file ID to StagedFile */
  files: Map<string, StagedFile>;
  /** Root path for staged files */
  stagingPath: string;
  /** Files that failed to upload */
  failedFiles: FailedFileEntry[];
  /** Files that were renamed during import */
  renamedFiles: RenamedFileEntry[];
}

/** Record of a file that failed to upload */
export interface FailedFileEntry {
  originalName: string;
  relativePath: string;
  error: string;
  timestamp: Date;
}

/** Record of a file that was renamed during import */
export interface RenamedFileEntry {
  originalName: string;
  newName: string;
  relativePath: string;
  reason: "conflict" | "normalization" | "user";
  timestamp: Date;
}

/** Configuration for the upload system */
export interface UploadConfig {
  /** Staging mode: 'memory' stores in temp dir, 'filesystem' uses configurable path */
  stagingMode: "memory" | "filesystem";
  /** Base directory for filesystem staging (defaults to os.tmpdir()) */
  stagingPath?: string;
  /** Maximum total upload size in bytes per session (default: 500MB) */
  maxTotalSizeBytes: number;
  /** Maximum single file size in bytes (default: 100MB) */
  maxFileSizeBytes: number;
  /** Maximum number of files per session */
  maxFiles: number;
  /** Session TTL in seconds before auto-cleanup (default: 3600) */
  sessionTtlSeconds: number;
  /** Maximum archive entry count (decompression bomb protection) */
  maxArchiveEntries: number;
  /** Maximum uncompressed archive size in bytes */
  maxArchiveUncompressedBytes: number;
}

/** Default upload configuration */
export const DEFAULT_UPLOAD_CONFIG: UploadConfig = {
  stagingMode: "memory",
  maxTotalSizeBytes: 500 * 1024 * 1024,
  maxFileSizeBytes: 100 * 1024 * 1024,
  maxFiles: 10_000,
  sessionTtlSeconds: 3600,
  maxArchiveEntries: 50_000,
  maxArchiveUncompressedBytes: 2 * 1024 * 1024 * 1024, // 2GB
};
