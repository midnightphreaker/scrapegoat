import type { IPipeline } from "../pipeline/trpc/interfaces";
import type { PipelineJobStatus } from "../pipeline/types";
import type { VersionStatus } from "../store/types";
import { validateRequiredString } from "../utils/validation";
import { ToolError, ValidationError } from "./errors";

/**
 * Input parameters for the GetJobInfoTool.
 */
export interface GetJobInfoInput {
  /** The ID of the job to retrieve info for. */
  jobId: string;
}

/**
 * Simplified information about a pipeline job for external use.
 */
export interface JobInfo {
  id: string;
  library: string;
  version: string | null;
  status: PipelineJobStatus; // Pipeline status (for compatibility)
  dbStatus?: VersionStatus; // Database status (enhanced)
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  // Progress information from database
  progress?: {
    pages: number;
    totalPages: number;
    totalDiscovered: number;
  };
  // Additional database fields
  updatedAt?: string;
  errorMessage?: string; // Database error message
}

/**
 * Response structure for the GetJobInfoTool.
 */
export interface GetJobInfoToolResponse {
  job: JobInfo;
}

/**
 * Tool for retrieving simplified information about a specific pipeline job.
 *
 * @remarks
 * This tool provides detailed information about a single job, including:
 * - Current status and timestamps
 * - Progress information for active jobs
 * - Error details for failed jobs
 * - Database synchronization status
 *
 * Use cases:
 * - Checking job status after scraping
 * - Debugging failed indexing attempts
 * - Monitoring long-running job progress
 * - Verifying job completion
 *
 * @example
 * ```typescript
 * const getJobInfoTool = new GetJobInfoTool(pipeline);
 *
 * // Get info for a specific job
 * const { job } = await getJobInfoTool.execute({
 *   jobId: 'abc-123-def'
 * });
 *
 * console.log(`Job: ${job.library}@${job.version}`);
 * console.log(`Status: ${job.status}`);
 * console.log(`DB Status: ${job.dbStatus}`);
 *
 * if (job.progress) {
 *   console.log(`Progress: ${job.progress.pages}/${job.progress.totalPages} pages`);
 *   console.log(`Discovered: ${job.progress.totalDiscovered} URLs`);
 * }
 *
 * if (job.error) {
 *   console.log(`Error: ${job.error}`);
 *   console.log(`Details: ${job.errorMessage}`);
 * }
 * ```
 */
export class GetJobInfoTool {
  private pipeline: IPipeline;

  /**
   * Creates an instance of GetJobInfoTool.
   *
   * @param pipeline - The pipeline instance for job management
   */
  constructor(pipeline: IPipeline) {
    this.pipeline = pipeline;
  }

  /**
   * Executes the tool to retrieve simplified info for a specific job.
   *
   * @param input - The input parameters
   * @param input.jobId - The unique identifier of the job to retrieve
   *
   * @returns Promise resolving to detailed job information:
   * - id: Unique job identifier
   * - library: Library name being scraped
   * - version: Library version (null for unversioned)
   * - status: Pipeline job status (QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED)
   * - dbStatus: Database version status (INDEXING, COMPLETED, FAILED)
   * - createdAt: ISO timestamp when job was created
   * - startedAt: ISO timestamp when job started (null if not started)
   * - finishedAt: ISO timestamp when job finished (null if not finished)
   * - error: Simplified error message (null if no error)
   * - progress: Progress object with pages, totalPages, and totalDiscovered
   * - updatedAt: ISO timestamp of last update
   * - errorMessage: Detailed error message from database
   *
   * @throws {ValidationError} If the jobId is invalid or empty
   * @throws {ToolError} If the job is not found
   *
   * @example
   * ```typescript
   * try {
   *   const { job } = await getJobInfoTool.execute({
   *     jobId: '550e8400-e29b-41d4-a716-446655440000'
   *   });
   *
   *   // Check if job completed successfully
   *   if (job.status === PipelineJobStatus.COMPLETED) {
   *     console.log('Job completed successfully');
   *   }
   *
   *   // Check for errors
   *   if (job.error) {
   *     console.error('Job failed:', job.errorMessage);
   *   }
   *
   *   // Display progress
   *   if (job.progress) {
   *     const percent = (job.progress.pages / job.progress.totalPages) * 100;
   *     console.log(`Progress: ${percent.toFixed(1)}%`);
   *   }
   * } catch (error) {
   *   if (error instanceof ToolError) {
   *     console.error('Job not found');
   *   }
   * }
   * ```
   */
  async execute(input: GetJobInfoInput): Promise<GetJobInfoToolResponse> {
    // Validate input
    try {
      validateRequiredString(input.jobId, "Job ID");
    } catch (error) {
      throw new ValidationError((error as Error).message, this.constructor.name);
    }

    const job = await this.pipeline.getJob(input.jobId);

    if (!job) {
      throw new ToolError(`Job with ID ${input.jobId} not found.`, this.constructor.name);
    }

    // Transform the job into a simplified object using enhanced PipelineJob interface
    const jobInfo: JobInfo = {
      id: job.id,
      library: job.library,
      version: job.version,
      status: job.status,
      dbStatus: job.versionStatus,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString() ?? null,
      finishedAt: job.finishedAt?.toISOString() ?? null,
      error: job.error?.message ?? null,
      progress:
        job.progressMaxPages && job.progressMaxPages > 0
          ? {
              pages: job.progressPages || 0,
              totalPages: job.progressMaxPages,
              totalDiscovered: job.progress?.totalDiscovered || job.progressMaxPages,
            }
          : undefined,
      updatedAt: job.updatedAt?.toISOString(),
      errorMessage: job.errorMessage ?? undefined,
    };

    return { job: jobInfo };
  }
}
