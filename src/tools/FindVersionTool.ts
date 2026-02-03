import type { IDocumentManagement } from "../store/trpc/interfaces";
import { validateRequiredString } from "../utils/validation";
import { ValidationError } from "./errors";

export interface FindVersionToolOptions {
  library: string;
  targetVersion?: string;
}

export interface FindVersionToolResult {
  bestMatch: string | null;
  hasUnversioned: boolean;
  message: string;
}

/**
 * Tool for finding the best matching version of a library in the store.
 *
 * @remarks
 * This tool helps identify which version of a library documentation is available
 * based on version patterns. It supports:
 * - Exact version matches (e.g., '18.2.0')
 * - X-Range patterns (e.g., '5.x' for latest 5.x.x, '5.2.x' for latest 5.2.x)
 * - Unversioned documentation detection
 *
 * Use cases:
 * - Determining available versions before searching
 * - Resolving version aliases to concrete versions
 * - Checking if unversioned docs exist
 * - Validating version availability before scraping
 *
 * @example
 * ```typescript
 * const findVersionTool = new FindVersionTool(documentManagementService);
 *
 * // Find latest 5.x version
 * const result = await findVersionTool.execute({
 *   library: 'typescript',
 *   targetVersion: '5.x'
 * });
 * console.log(result.message); // "Best match: 5.3.3."
 *
 * // Check for unversioned docs
 * const result = await findVersionTool.execute({
 *   library: 'some-lib'
 * });
 * console.log(`Has unversioned: ${result.hasUnversioned}`);
 *
 * // Exact version check
 * const result = await findVersionTool.execute({
 *   library: 'react',
 *   targetVersion: '18.2.0'
 * });
 * if (result.bestMatch === '18.2.0') {
 *   console.log('Exact version available');
 * }
 * ```
 */
export class FindVersionTool {
  private docService: IDocumentManagement;

  /**
   * Creates a new FindVersionTool instance.
   *
   * @param docService - The document management service for version lookup
   */
  constructor(docService: IDocumentManagement) {
    this.docService = docService;
  }

  /**
   * Executes the tool to find the best matching version and checks for unversioned docs.
   *
   * @param options - The find version options
   * @param options.library - The library name to search
   * @param options.targetVersion - Optional version or version pattern (e.g., '5.x', '5.2.x')
   *
   * @returns Promise resolving to version information:
   * - bestMatch: The best matching version string, or null if no match
   * - hasUnversioned: Whether unversioned documentation exists
   * - message: Human-readable description of the result
   *
   * @throws {ValidationError} If the library parameter is invalid
   * @throws {VersionNotFoundInStoreError} If no matching versions or unversioned docs are found
   *
   * @example
   * ```typescript
   * try {
   *   const result = await findVersionTool.execute({
   *     library: 'nextjs',
   *     targetVersion: '14.x'
   *   });
   *
   *   console.log(`Best match: ${result.bestMatch}`);
   *   if (result.hasUnversioned) {
   *     console.log('Unversioned docs also available');
   *   }
   *   console.log(result.message);
   * } catch (error) {
   *   if (error instanceof VersionNotFoundInStoreError) {
   *     console.error('No matching version found');
   *   }
   * }
   * ```
   */
  async execute(options: FindVersionToolOptions): Promise<FindVersionToolResult> {
    const { library, targetVersion } = options;

    // Validate input
    try {
      validateRequiredString(library, "Library name");
    } catch (error) {
      throw new ValidationError((error as Error).message, this.constructor.name);
    }

    const libraryAndVersion = `${library}${targetVersion ? `@${targetVersion}` : ""}`;

    // Let VersionNotFoundInStoreError bubble up instead of catching it
    const { bestMatch, hasUnversioned } = await this.docService.findBestVersion(
      library,
      targetVersion,
    );

    let message = "";
    if (bestMatch) {
      message = `Best match: ${bestMatch}.`;
      if (hasUnversioned) {
        message += " Unversioned docs also available.";
      }
    } else if (hasUnversioned) {
      message = `No matching version found for ${libraryAndVersion}, but unversioned docs exist.`;
    } else {
      // This case should ideally be caught by VersionNotFoundInStoreError,
      // but added for completeness.
      message = `No matching version or unversioned documents found for ${libraryAndVersion}.`;
    }

    return {
      bestMatch,
      hasUnversioned,
      message,
    };
  }
}
