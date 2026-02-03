import type { IPipeline } from "../pipeline/trpc/interfaces";
import { PipelineJobStatus } from "../pipeline/types";
import { logger } from "../utils/logger";
import { validateRequiredString } from "../utils/validation";
import { ToolError, ValidationError } from "./errors";

/**
 * Input parameters for the CancelJobTool.
 */
export interface CancelJobInput {
  /** The ID of the job to cancel. */
  jobId: string;
}

/**
 * Output result for the CancelJobTool.
 */
export interface CancelJobResult {
  /** A message indicating the outcome of the cancellation attempt. */
  message: string;
  /** The final status of the job after cancellation attempt. */
  finalStatus: string;
}

/**
 * Tool for attempting to cancel a pipeline job.
 *
 * @remarks
 * This tool allows cancellation of active scraping jobs. It handles various scenarios:
 * - Cancels QUEUED or RUNNING jobs
 * - Returns gracefully if job is already completed/failed/cancelled
 * - Provides final status confirmation
 * - Handles non-existent job errors
 *
 * Use cases:
 * - Stopping long-running scraping operations
 * - Canceling stuck or hung jobs
 * - Cleaning up queued jobs before re-scraping
 * - Stopping jobs that were started by mistake
 *
 * @example
 * ```typescript
 * const cancelJobTool = new CancelJobTool(pipeline);
 *
 * // Cancel a running job
 * const result = await cancelJobTool.execute({
 *   jobId: 'abc-123-def'
 * });
 *
 * console.log(result.message);
 * console.log(`Final status: ${result.finalStatus}`);
 *
 * // Handle already completed jobs
 * if (result.finalStatus === PipelineJobStatus.COMPLETED) {
 *   console.log('Job was already completed');
 * }
 * ```
 */
export class CancelJobTool {
  private pipeline: IPipeline;

  /**
   * Creates an instance of CancelJobTool.
   *
   * @param pipeline - The pipeline instance for job management
   */
  constructor(pipeline: IPipeline) {
    this.pipeline = pipeline;
  }

  /**
   * Executes the tool to attempt cancellation of a specific job.
   *
   * @remarks
   * Cancellation behavior:
   * - QUEUED/RUNNING jobs: Cancellation is attempted
   * - COMPLETED/FAILED/CANCELLED jobs: Returns gracefully without action
   * - Non-existent jobs: Throws ToolError
   *
   * @param input - The input parameters
   * @param input.jobId - The unique identifier of the job to cancel
   *
   * @returns Promise resolving to cancellation result:
   * - message: Human-readable outcome description
   * - finalStatus: The job's status after cancellation attempt
   *
   * @throws {ValidationError} If the jobId is invalid or empty
   * @throws {ToolError} If the job is not found
   *
   * @example
   * ```typescript
   * try {
   *   const result = await cancelJobTool.execute({
   *     jobId: '550e8400-e29b-41d4-a716-446655440000'
   *   });
   *
   *   console.log(result.message);
   *
   *   // Check if cancellation was successful
   *   if (result.finalStatus === PipelineJobStatus.CANCELLED) {
   *     console.log('Job cancelled successfully');
   *   } else if (result.finalStatus === PipelineJobStatus.COMPLETED) {
   *     console.log('Job completed before cancellation');
   *   }
   * } catch (error) {
   *   if (error instanceof ToolError) {
   *     console.error('Failed to cancel job:', error.message);
   *   }
   * }
   *
   * // Cancel and wait for confirmation
   * const result = await cancelJobTool.execute({ jobId: 'job-id' });
   * while (result.finalStatus !== PipelineJobStatus.CANCELLED) {
   *   await new Promise(resolve => setTimeout(resolve, 1000));
   *   const job = await getJobInfoTool.execute({ jobId: 'job-id' });
   *   if (job.job.status === PipelineJobStatus.CANCELLED) break;
   * }
   * ```
   */
  async execute(input: CancelJobInput): Promise<CancelJobResult> {
    // Validate input
    try {
      validateRequiredString(input.jobId, "Job ID");
    } catch (error) {
      throw new ValidationError((error as Error).message, this.constructor.name);
    }

    try {
      // Retrieve the job first to check its status before attempting cancellation
      const job = await this.pipeline.getJob(input.jobId);

      if (!job) {
        logger.warn(`❓ [CancelJobTool] Job not found: ${input.jobId}`);
        throw new ToolError(
          `Job with ID ${input.jobId} not found.`,
          this.constructor.name,
        );
      }

      // Check if the job is already in a final state
      if (
        job.status === PipelineJobStatus.COMPLETED || // Use enum member
        job.status === PipelineJobStatus.FAILED || // Use enum member
        job.status === PipelineJobStatus.CANCELLED // Use enum member
      ) {
        logger.debug(`Job ${input.jobId} is already in a final state: ${job.status}.`);
        return {
          message: `Job ${input.jobId} is already ${job.status}. No action taken.`,
          finalStatus: job.status,
        };
      }

      // Attempt cancellation
      await this.pipeline.cancelJob(input.jobId);

      // Re-fetch the job to confirm status change (or check status directly if cancelJob returned it)
      // PipelineManager.cancelJob doesn't return status, so re-fetch is needed for confirmation.
      const updatedJob = await this.pipeline.getJob(input.jobId);
      const finalStatus = updatedJob?.status ?? "UNKNOWN (job disappeared?)";

      logger.debug(
        `Cancellation requested for job ${input.jobId}. Current status: ${finalStatus}`,
      );
      return {
        message: `Cancellation requested for job ${input.jobId}. Current status: ${finalStatus}.`,
        finalStatus,
      };
    } catch (error) {
      logger.error(`❌ Error cancelling job ${input.jobId}: ${error}`);
      throw new ToolError(
        `Failed to cancel job ${input.jobId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        this.constructor.name,
      );
    }
  }
}
