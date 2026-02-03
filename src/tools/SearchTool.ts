import { VersionNotFoundInStoreError } from "../store";
import type { IDocumentManagement } from "../store/trpc/interfaces";
import type { StoreSearchResult } from "../store/types";
import { logger } from "../utils/logger";
import { validateNumberRange, validateRequiredString } from "../utils/validation";
import { ValidationError } from "./errors";

export interface SearchToolOptions {
  library: string;
  version?: string;
  query: string;
  limit?: number;
  exactMatch?: boolean;
}

export interface SearchToolResultError {
  message: string;
  availableVersions?: Array<{
    version: string;
    documentCount: number;
    uniqueUrlCount: number;
    indexedAt: string | null;
  }>;
  suggestions?: string[]; // Specific to LibraryNotFoundInStoreError
}

export interface SearchToolResult {
  results: StoreSearchResult[];
}

/**
 * Tool for searching indexed documentation.
 *
 * @remarks
 * This tool provides semantic search capabilities over indexed documentation.
 * It supports both exact version matches and flexible version range patterns (e.g., '5.x', '5.2.x').
 * When a requested version is not found, the tool returns available versions to help users discover alternatives.
 *
 * @example
 * ```typescript
 * const searchTool = new SearchTool(documentManagementService);
 *
 * // Basic search
 * const results = await searchTool.execute({
 *   library: 'react',
 *   query: 'useEffect hook lifecycle'
 * });
 *
 * // Search with version constraint
 * const results = await searchTool.execute({
 *   library: 'typescript',
 *   version: '5.x',
 *   query: 'utility types',
 *   limit: 10
 * });
 *
 * // Exact version match
 * const results = await searchTool.execute({
 *   library: 'next.js',
 *   version: '14.0.0',
 *   query: 'app router',
 *   exactMatch: true
 * });
 * ```
 */
export class SearchTool {
  private docService: IDocumentManagement;

  /**
   * Creates a new SearchTool instance.
   *
   * @param docService - The document management service for accessing indexed documentation
   */
  constructor(docService: IDocumentManagement) {
    this.docService = docService;
  }

  /**
   * Executes a search query against indexed documentation.
   *
   * @param options - The search options
   * @param options.library - The library name to search (e.g., 'react', 'typescript')
   * @param options.query - The search query string
   * @param options.version - Optional version or version range (e.g., '18.0.0', '5.x'). Defaults to 'latest'
   * @param options.limit - Maximum number of results to return (1-100). Default: 5
   * @param options.exactMatch - If true, requires exact version match. Default: false
   *
   * @returns Promise resolving to search results with relevant documentation snippets
   *
   * @throws {ValidationError} If required parameters are missing or invalid
   * @throws {VersionNotFoundInStoreError} If the specified version doesn't exist and exactMatch is true
   * @throws {LibraryNotFoundInStoreError} If the library is not indexed
   *
   * @example
   * ```typescript
   * const results = await searchTool.execute({
   *   library: 'react',
   *   version: '18.x',
   *   query: 'component lifecycle methods',
   *   limit: 10
   * });
   *
   * console.log(`Found ${results.results.length} matches`);
   * results.results.forEach(result => {
   *   console.log(`- ${result.title}: ${result.snippet}`);
   * });
   * ```
   */
  async execute(options: SearchToolOptions): Promise<SearchToolResult> {
    const { library, version, query, limit = 5, exactMatch = false } = options;

    // Validate required inputs
    try {
      validateRequiredString(library, "Library name");
      validateRequiredString(query, "Query");
      if (limit !== undefined) {
        validateNumberRange(limit, 1, 100, "Limit");
      }
    } catch (error) {
      throw new ValidationError((error as Error).message, this.constructor.name);
    }

    // When exactMatch is true, version must be specified and not 'latest'
    if (exactMatch && (!version || version === "latest")) {
      // Get available *detailed* versions for error message
      await this.docService.validateLibraryExists(library);
      // Fetch detailed versions using listLibraries and find the specific library
      const allLibraries = await this.docService.listLibraries();
      const libraryInfo = allLibraries.find((lib) => lib.library === library);
      const availableVersions = libraryInfo
        ? libraryInfo.versions.map((v) => v.ref.version)
        : [];
      throw new VersionNotFoundInStoreError(
        library,
        version ?? "latest",
        availableVersions,
      );
    }

    // Default to 'latest' only when exactMatch is false
    const resolvedVersion = version || "latest";

    logger.info(
      `🔍 Searching ${library}@${resolvedVersion} for: ${query}${exactMatch ? " (exact match)" : ""}`,
    );

    try {
      // 1. Validate library exists first
      await this.docService.validateLibraryExists(library);

      // 2. Proceed with version finding and searching
      let versionToSearch: string | null | undefined = resolvedVersion;

      if (!exactMatch) {
        // If not exact match, find the best version (which might be null)
        const versionResult = await this.docService.findBestVersion(library, version);
        // Use the bestMatch from the result, which could be null
        versionToSearch = versionResult.bestMatch;

        // If findBestVersion returned null (no matching semver) AND unversioned docs exist,
        // should we search unversioned? The current logic passes null to searchStore,
        // which gets normalized to "" (unversioned). This seems reasonable.
        // If findBestVersion threw VersionNotFoundInStoreError, it's caught below.
      }
      // If exactMatch is true, versionToSearch remains the originally provided version.

      // Note: versionToSearch can be string | null | undefined here.
      // searchStore handles null/undefined by normalizing to "".
      const results = await this.docService.searchStore(
        library,
        versionToSearch,
        query,
        limit,
      );
      logger.info(`✅ Found ${results.length} matching results`);

      return { results };
    } catch (error) {
      logger.error(
        `❌ Search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      throw error;
    }
  }
}
