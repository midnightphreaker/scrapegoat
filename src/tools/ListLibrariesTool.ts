import type { IDocumentManagement } from "../store/trpc/interfaces";
import type { VersionStatus, VersionSummary } from "../store/types";

// Define the structure for the tool's output, using the detailed version info
export interface LibraryInfo {
  name: string;
  versions: Array<{
    version: string;
    documentCount: number;
    uniqueUrlCount: number;
    indexedAt: string | null;
    status: VersionStatus;
    // Progress is omitted for COMPLETED versions to reduce noise
    progress?: { pages: number; maxPages: number };
    sourceUrl?: string | null;
  }>;
}

export interface ListLibrariesResult {
  libraries: LibraryInfo[];
}

/**
 * Tool for listing all available libraries and their indexed versions in the store.
 *
 * @remarks
 * This tool provides a comprehensive overview of all indexed documentation libraries,
 * including version information, document counts, and indexing status. It's useful for:
 * - Discovering available libraries before searching
 * - Checking indexing status and progress
 * - Identifying which versions of a library are available
 * - Getting document counts for storage estimation
 *
 * @example
 * ```typescript
 * const listTool = new ListLibrariesTool(documentManagementService);
 *
 * // List all libraries
 * const result = await listTool.execute();
 *
 * result.libraries.forEach(lib => {
 *   console.log(`Library: ${lib.name}`);
 *   lib.versions.forEach(ver => {
 *     console.log(`  Version: ${ver.version}`);
 *     console.log(`    Documents: ${ver.documentCount}`);
 *     console.log(`    Status: ${ver.status}`);
 *     if (ver.progress) {
 *       console.log(`    Progress: ${ver.progress.pages}/${ver.progress.maxPages}`);
 *     }
 *   });
 * });
 * ```
 */
export class ListLibrariesTool {
  private docService: IDocumentManagement;

  /**
   * Creates a new ListLibrariesTool instance.
   *
   * @param docService - The document management service for accessing library information
   */
  constructor(docService: IDocumentManagement) {
    this.docService = docService;
  }

  /**
   * Retrieves a list of all indexed libraries with version details.
   *
   * @param _options - No parameters required (kept for API consistency)
   *
   * @returns Promise resolving to a list of libraries with version information including:
   * - name: Library name
   * - versions: Array of version objects containing:
   *   - version: Version string (empty for unversioned docs)
   *   - documentCount: Number of indexed documents
   *   - uniqueUrlCount: Number of unique URLs
   *   - indexedAt: ISO timestamp of indexing completion
   *   - status: Current indexing status (INDEXING, COMPLETED, FAILED)
   *   - progress: Optional progress info for in-progress indexing
   *   - sourceUrl: Original documentation URL
   *
   * @example
   * ```typescript
   * const { libraries } = await listTool.execute();
   *
   * // Find libraries with in-progress indexing
   * const inProgress = libraries.filter(lib =>
   *   lib.versions.some(v => v.status === 'INDEXING')
   * );
   *
   * // Get total document count
   * const totalDocs = libraries.reduce((sum, lib) =>
   *   sum + lib.versions.reduce((vSum, v) => vSum + v.documentCount, 0), 0
   * );
   * ```
   */
  async execute(_options?: Record<string, never>): Promise<ListLibrariesResult> {
    // docService.listLibraries() now returns the detailed structure directly
    const rawLibraries = await this.docService.listLibraries();

    // The structure returned by listLibraries already matches LibraryInfo[]
    // No complex mapping is needed here anymore, just ensure the names match
    const libraries: LibraryInfo[] = rawLibraries.map(({ library, versions }) => ({
      name: library,
      versions: versions.map((v: VersionSummary) => ({
        version: v.ref.version,
        documentCount: v.counts.documents,
        uniqueUrlCount: v.counts.uniqueUrls,
        indexedAt: v.indexedAt,
        status: v.status,
        ...(v.progress ? { progress: v.progress } : undefined),
        sourceUrl: v.sourceUrl,
      })),
    }));

    return { libraries };
  }
}
