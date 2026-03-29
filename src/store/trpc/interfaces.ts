/**
 * tRPC interfaces for document management services.
 *
 * @module store/trpc/interfaces
 *
 * @remarks
 * This module defines the public interfaces for document management operations,
 * used by both local services and remote tRPC clients. It provides a unified
 * API for interacting with the document storage and retrieval system.
 *
 * Main Interfaces:
 * - {@link IDocumentManagement} - Core document management operations
 *
 * Related Modules:
 * - {@link ../types} - Type definitions for documents, versions, and libraries
 * - {@link ../DocumentStore} - PostgreSQL-backed document storage implementation
 * - {@link ../DocumentManagementService} - High-level document management service
 *
 * @packageDocumentation
 *
 * @example
 * ```typescript
 * import type { IDocumentManagement } from './store/trpc/interfaces';
 *
 * // Use the interface for dependency injection
 * class MyService {
 *   constructor(private docService: IDocumentManagement) {}
 *
 *   async searchDocs(query: string) {
 *     return this.docService.searchStore('mylib', null, query, 10);
 *   }
 * }
 * ```
 */

/**
 * Interface for document management operations exposed externally.
 *
 * @remarks
 * This interface defines the contract for document management operations,
 * implemented by both the local DocumentManagementService and remote tRPC client.
 * It provides a unified API for:
 * - Managing libraries and versions
 * - Searching indexed documentation
 * - Tracking indexing progress and status
 * - Handling document lifecycle operations
 *
 * @example
 * ```typescript
 * class MyService implements IDocumentManagement {
 *   async initialize() {
 *     // Connect to database, initialize resources
 *   }
 *
 *   async searchStore(library, version, query, limit) {
 *     // Perform vector similarity search
 *     return results;
 *   }
 *
 *   // ... implement other methods
 * }
 * ```
 */
import type { ScraperOptions } from "../../scraper/types";
import type {
  DbVersionWithLibrary,
  FindVersionResult,
  LibrarySummary,
  StoredScraperOptions,
  StoreSearchResult,
  VersionStatus,
} from "../types";

export interface IDocumentManagement {
  /**
   * Initializes the document management service.
   *
   * @remarks
   * Should be called before any other operations. Establishes database
   * connections, initializes embeddings, and prepares resources.
   *
   * @throws {Error} If initialization fails
   */
  initialize(): Promise<void>;

  /**
   * Shuts down the document management service.
   *
   * @remarks
   * Releases resources, closes connections, and performs cleanup.
   * Should be called when the service is no longer needed.
   */
  shutdown(): Promise<void>;

  /**
   * Lists all libraries with their version information.
   *
   * @returns Array of library summaries with version details, document counts, and status
   */
  listLibraries(): Promise<LibrarySummary[]>;

  /**
   * Validates that a library exists in the store.
   *
   * @param library - The library name to validate
   * @throws {LibraryNotFoundInStoreError} If the library doesn't exist
   */
  validateLibraryExists(library: string): Promise<void>;

  /**
   * Finds the best matching version for a library.
   *
   * @remarks
   * Supports exact version matches and X-Range patterns (e.g., '5.x').
   * Also checks for unversioned documentation.
   *
   * @param library - The library name
   * @param targetVersion - Optional version or version pattern
   * @returns Object with best match, unversioned status, and available versions
   * @throws {VersionNotFoundInStoreError} If no matching version or unversioned docs found
   */
  findBestVersion(library: string, targetVersion?: string): Promise<FindVersionResult>;

  /**
   * Searches indexed documentation using vector similarity.
   *
   * @param library - The library name to search
   * @param version - Version to search (null for unversioned, undefined for latest)
   * @param query - The search query
   * @param limit - Maximum number of results to return
   * @returns Array of search results with relevance scores and content snippets
   */
  searchStore(
    library: string,
    version: string | null | undefined,
    query: string,
    limit?: number,
  ): Promise<StoreSearchResult[]>;

  /**
   * Removes all documents for a library version.
   *
   * @remarks
   * This is a lower-level operation. Consider using removeVersion for complete cleanup.
   *
   * @param library - The library name
   * @param version - Optional version (null for unversioned, undefined for all versions)
   */
  removeAllDocuments(library: string, version?: string | null): Promise<void>;

  /**
   * Removes a library version completely.
   *
   * @remarks
   * Removes all documents, version record, and library entry if it was the last version.
   *
   * @param library - The library name
   * @param version - Optional version (null for unversioned, undefined for all versions)
   */
  removeVersion(library: string, version?: string | null): Promise<void>;

  /**
   * Renames a version within a library.
   *
   * @param library - The library name
   * @param oldVersion - Current version name
   * @param newVersion - New version name
   * @returns true if renamed, false if not found
   * @throws Error if new version name already exists
   */
  renameVersion(
    library: string,
    oldVersion: string | null,
    newVersion: string,
  ): Promise<boolean>;

  /**
   * Renames a library.
   *
   * @param library - Current library name
   * @param newName - New library name
   * @returns true if renamed, false if not found
   * @throws Error if new name already exists
   */
  renameLibrary(library: string, newName: string): Promise<boolean>;

  /**
   * Gets versions filtered by status.
   *
   * @remarks
   * Used for monitoring and job recovery.
   *
   * @param statuses - Array of statuses to filter by
   * @returns Array of version records with library information
   */
  getVersionsByStatus(statuses: VersionStatus[]): Promise<DbVersionWithLibrary[]>;

  /**
   * Finds versions by their source URL.
   *
   * @remarks
   * Useful for detecting duplicate indexing attempts.
   *
   * @param url - The source URL to search for
   * @returns Array of versions indexed from the given URL
   */
  findVersionsBySourceUrl(url: string): Promise<DbVersionWithLibrary[]>;

  /**
   * Retrieves scraper options for a version.
   *
   * @param versionId - The version database ID
   * @returns Stored scraper options or null if not found
   */
  getScraperOptions(versionId: number): Promise<StoredScraperOptions | null>;

  /**
   * Updates the status of a version.
   *
   * @remarks
   * Used by the pipeline to track indexing progress.
   *
   * @param versionId - The version database ID
   * @param status - The new status
   * @param errorMessage - Optional error message for failed status
   */
  updateVersionStatus(
    versionId: number,
    status: VersionStatus,
    errorMessage?: string,
  ): Promise<void>;

  /**
   * Updates the progress of an indexing job.
   *
   * @remarks
   * Called periodically during scraping to report progress.
   *
   * @param versionId - The version database ID
   * @param pages - Number of pages scraped so far
   * @param maxPages - Maximum expected pages (may be updated during scraping)
   */
  updateVersionProgress(
    versionId: number,
    pages: number,
    maxPages: number,
  ): Promise<void>;

  /**
   * Stores scraper options for a version.
   *
   * @remarks
   * Persists scraping configuration for later reference or re-scraping.
   *
   * @param versionId - The version database ID
   * @param options - The scraper options to store
   */
  storeScraperOptions(versionId: number, options: ScraperOptions): Promise<void>;
}
