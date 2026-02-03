import type { IPipeline } from "../pipeline/trpc/interfaces";
import { PipelineJobStatus } from "../pipeline/types";
import type { IDocumentManagement } from "../store/trpc/interfaces";
import { logger } from "../utils/logger";
import { validateRequiredString } from "../utils/validation";
import { ToolError, ValidationError } from "./errors";

/**
 * Represents the arguments for the remove_docs tool.
 * The MCP server should validate the input against RemoveToolInputSchema before calling execute.
 */
export interface RemoveToolArgs {
  library: string;
  version?: string;
}

/**
 * Tool to remove indexed documentation for a specific library version.
 *
 * @remarks
 * This tool provides complete removal of indexed documentation, including:
 * - Aborting any active scraping jobs for the specified library/version
 * - Removing all indexed documents
 * - Deleting the version record
 * - Removing the library entry if no other versions exist
 *
 * This is useful for:
 * - Cleaning up failed indexing attempts
 * - Re-indexing documentation from scratch
 * - Removing outdated documentation versions
 * - Freeing storage space
 *
 * @example
 * ```typescript
 * const removeTool = new RemoveTool(documentManagementService, pipeline);
 *
 * // Remove a specific version
 * await removeTool.execute({
 *   library: 'react',
 *   version: '18.0.0'
 * });
 *
 * // Remove all versions (entire library)
 * await removeTool.execute({
 *   library: 'typescript',
 *   version: undefined
 * });
 *
 * // Remove unversioned documentation
 * await removeTool.execute({
 *   library: 'vue',
 *   version: ''
 * });
 * ```
 */
export class RemoveTool {
  /**
   * Creates a new RemoveTool instance.
   *
   * @param documentManagementService - Service for managing document storage
   * @param pipeline - Pipeline instance for managing active jobs
   */
  constructor(
    private readonly documentManagementService: IDocumentManagement,
    private readonly pipeline: IPipeline,
  ) {}

  /**
   * Executes the tool to remove the specified library version completely.
   *
   * @remarks
   * The removal process:
   * 1. Validates the library and version exist
   * 2. Aborts any QUEUED or RUNNING jobs for the same library+version
   * 3. Removes all documents from the vector store
   * 4. Deletes the version record
   * 5. Removes the library entry if it was the last version
   *
   * @param args - The removal arguments
   * @param args.library - The library name to remove
   * @param args.version - Optional version to remove. If undefined, removes all versions
   *
   * @returns Promise resolving to a success message
   *
   * @throws {ValidationError} If library name is invalid
   * @throws {ToolError} If the library or version doesn't exist
   * @throws {Error} If removal fails
   *
   * @example
   * ```typescript
   * // Remove specific version
   * const result = await removeTool.execute({
   *   library: 'nextjs',
   *   version: '14.0.0'
   * });
   * console.log(result.message);
   *
   * // Remove entire library
   * const result = await removeTool.execute({
   *   library: 'old-library',
   *   version: undefined
   * });
   * ```
   */
  async execute(args: RemoveToolArgs): Promise<{ message: string }> {
    const { library, version } = args;

    // Validate input
    try {
      validateRequiredString(library, "Library name");
    } catch (error) {
      throw new ValidationError((error as Error).message, this.constructor.name);
    }

    logger.info(`🗑️ Removing library: ${library}${version ? `@${version}` : ""}`);

    try {
      // This will throw if no matching library or version is found
      const result = await this.documentManagementService.findBestVersion(
        library,
        version,
      );

      // For removal, we need an exact match of the requested version
      // Handle the case where version is undefined/empty (unversioned) and bestMatch is null
      const normalizedVersion = version && version.trim() !== "" ? version : null;
      const versionExists =
        result.bestMatch === normalizedVersion ||
        (result.hasUnversioned && normalizedVersion === null);
      if (!versionExists) {
        const versionText = normalizedVersion
          ? `Version ${normalizedVersion}`
          : "Version";
        throw new ToolError(
          `${versionText} not found for library ${library}. Cannot remove non-existent version.`,
          this.constructor.name,
        );
      }

      // Abort any QUEUED or RUNNING job for this library+version
      const allJobs = await this.pipeline.getJobs();
      const jobs = allJobs.filter(
        (job) =>
          job.library === library &&
          job.version === (version ?? "") &&
          (job.status === PipelineJobStatus.QUEUED ||
            job.status === PipelineJobStatus.RUNNING),
      );

      for (const job of jobs) {
        logger.info(
          `🚫 Aborting job for ${library}@${version ?? ""} before deletion: ${job.id}`,
        );
        await this.pipeline.cancelJob(job.id);
        // Wait for job to finish cancelling if running
        await this.pipeline.waitForJobCompletion(job.id);
      }

      // Core logic: Call the document management service to remove the version completely
      await this.documentManagementService.removeVersion(library, version);

      const message = `Successfully removed ${library}${version ? `@${version}` : ""}.`;
      logger.info(`✅ ${message}`);
      // Return a simple success object, the McpServer will format the final response
      return { message };
    } catch (error) {
      // If it's already a ToolError or other known error types, re-throw as is
      if (error instanceof ToolError) {
        throw error;
      }

      const errorMessage = `Failed to remove ${library}${version ? `@${version}` : ""}: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(`❌ Error removing library: ${errorMessage}`);
      // Re-throw the error for the McpServer to handle and format
      throw new ToolError(errorMessage, this.constructor.name);
    }
  }
}
