import type { IPipeline } from "../pipeline/trpc/interfaces";
import type { PipelineJob, PipelineJobStatus } from "../pipeline/types";
import type { JobInfo } from "./GetJobInfoTool"; // Import JobInfo

/**
 * Input parameters for the ListJobsTool.
 */
export interface ListJobsInput {
  /** Optional status to filter jobs by. */
  status?: PipelineJobStatus;
}

/**
 * Response structure for the ListJobsTool.
 */
export interface ListJobsToolResponse {
  jobs: JobInfo[];
}

/**
 * Tool for listing pipeline jobs managed by the pipeline.
 *
 * @remarks
 * This tool provides visibility into all scraping jobs managed by the pipeline,
 * including their status, progress, and error information. It's useful for:
 * - Monitoring active scraping operations
 * - Checking job completion status
 * - Debugging failed jobs
 * - Tracking progress of long-running indexing tasks
 * - Filtering jobs by status (e.g., only failed jobs)
 *
 * @example
 * ```typescript
 * const listJobsTool = new ListJobsTool(pipeline);
 *
 * // List all jobs
 * const { jobs } = await listJobsTool.execute({});
 *
 * // List only running jobs
 * const { jobs } = await listJobsTool.execute({
 *   status: PipelineJobStatus.RUNNING
 * });
 *
 * // List failed jobs
 * const { jobs } = await listJobsTool.execute({
 *   status: PipelineJobStatus.FAILED
 * });
 *
 * jobs.forEach(job => {
 *   console.log(`Job ${job.id}: ${job.library}@${job.version}`);
 *   console.log(`  Status: ${job.status}`);
 *   console.log(`  Progress: ${job.progress?.pages}/${job.progress?.totalPages}`);
 *   if (job.error) {
 *     console.log(`  Error: ${job.error}`);
 *   }
 * });
 * ```
 */
export class ListJobsTool {
  private pipeline: IPipeline;

  /**
   * Creates an instance of ListJobsTool.
   *
   * @param pipeline - The pipeline instance for job management
   */
  constructor(pipeline: IPipeline) {
    this.pipeline = pipeline;
  }

  /**
   * Executes the tool to retrieve a list of pipeline jobs.
   *
   * @param input - The input parameters
   * @param input.status - Optional status filter to only return jobs with specific status
   *
   * @returns Promise resolving to a list of simplified job objects containing:
   * - id: Unique job identifier
   * - library: Library name being scraped
   * - version: Library version (null for unversioned)
   * - status: Current job status (QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED)
   * - dbStatus: Database version status (INDEXING, COMPLETED, FAILED)
   * - createdAt: ISO timestamp when job was created
   * - startedAt: ISO timestamp when job started (null if not started)
   * - finishedAt: ISO timestamp when job finished (null if not finished)
   * - error: Error message if job failed (null otherwise)
   * - progress: Optional progress information with pages scraped
   * - updatedAt: ISO timestamp of last update
   * - errorMessage: Detailed error message from database
   *
   * @example
   * ```typescript
   * // Get all jobs
   * const { jobs } = await listJobsTool.execute({});
   *
   * // Filter for running jobs with progress
   * const running = jobs.filter(j =>
   *   j.status === PipelineJobStatus.RUNNING && j.progress
   * );
   *
   * running.forEach(job => {
   *   const percent = (job.progress!.pages / job.progress!.totalPages) * 100;
   *   console.log(`${job.library}: ${percent.toFixed(1)}% complete`);
   * });
   * ```
   */
  async execute(input: ListJobsInput): Promise<ListJobsToolResponse> {
    const jobs = await this.pipeline.getJobs(input.status);

    // Transform jobs into simplified objects using enhanced PipelineJob interface
    const simplifiedJobs: JobInfo[] = jobs.map((job: PipelineJob): JobInfo => {
      return {
        id: job.id,
        library: job.library,
        version: job.version,
        status: job.status,
        dbStatus: job.versionStatus,
        createdAt: job.createdAt.toISOString(),
        startedAt: job.startedAt?.toISOString() ?? null,
        finishedAt: job.finishedAt?.toISOString() ?? null,
        error: job.error ?? null,
        progress:
          job.progressMaxPages && job.progressMaxPages > 0
            ? {
                pages: job.progressPages || 0,
                totalPages: job.progressMaxPages,
                totalDiscovered: job.progress?.totalPages || job.progressMaxPages,
              }
            : undefined,
        updatedAt: job.updatedAt?.toISOString(),
        errorMessage: job.errorMessage ?? undefined,
      };
    });

    return { jobs: simplifiedJobs };
  }
}
