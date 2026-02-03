import type { ScraperOptions } from "../../scraper/types";
import type { PipelineJob, PipelineJobStatus, PipelineManagerCallbacks } from "../types";

/**
 * tRPC interfaces for pipeline management.
 *
 * @module pipeline/trpc/interfaces
 *
 * @remarks
 * This module defines the public interfaces for documentation scraping pipeline
 * management. It provides a unified API that works with both local pipeline
 * managers and remote pipeline servers via tRPC.
 *
 * Main Interfaces:
 * - {@link IPipeline} - Common pipeline operations interface
 * - {@link PipelineOptions} - Pipeline configuration options
 *
 * Related Modules:
 * - {@link ../types} - Pipeline job types and status enums
 * - {@link ../PipelineManager} - Local pipeline implementation
 * - {@link ../PipelineClient} - Remote tRPC client implementation
 *
 * @packageDocumentation
 *
 * @example
 * ```typescript
 * import type { IPipeline, PipelineOptions } from './pipeline/trpc/interfaces';
 *
 * // Use the interface for abstraction
 * class ScraperService {
 *   constructor(private pipeline: IPipeline) {}
 *
 *   async scrapeLibrary(lib: string, url: string) {
 *     const jobId = await this.pipeline.enqueueJob(lib, null, { url });
 *     await this.pipeline.waitForJobCompletion(jobId);
 *   }
 * }
 * ```
 */

/**
 * Options for configuring pipeline behavior.
 */
export interface PipelineOptions {
  /**
   * Whether this pipeline should recover interrupted jobs on startup.
   * @default false
   */
  recoverJobs?: boolean;
  /**
   * URL of external pipeline server (if using remote pipeline).
   * If not provided, uses local pipeline manager.
   */
  serverUrl?: string;
  /**
   * Maximum number of concurrent scraping jobs.
   * @default 1
   */
  concurrency?: number;
}

/**
 * Common interface that both PipelineManager and PipelineClient implement.
 *
 * @remarks
 * This interface provides a unified API for managing documentation scraping jobs,
 * whether using a local pipeline manager or remote pipeline server via tRPC.
 * It supports job lifecycle management, progress tracking, and callback registration.
 *
 * @example
 * ```typescript
 * // Using local pipeline
 * const pipeline: IPipeline = new PipelineManager(options);
 * await pipeline.start();
 *
 * // Enqueue a scraping job
 * const jobId = await pipeline.enqueueJob('react', '18.2.0', {
 *   url: 'https://react.dev/learn',
 *   maxPages: 100
 * });
 *
 * // Wait for completion
 * await pipeline.waitForJobCompletion(jobId);
 *
 * // Get job details
 * const job = await pipeline.getJob(jobId);
 * console.log(`Status: ${job?.status}`);
 *
 * await pipeline.stop();
 *
 * // Using remote pipeline
 * const remotePipeline: IPipeline = new PipelineClient({
 *   serverUrl: 'http://localhost:3000'
 * });
 * ```
 */
export interface IPipeline {
  /**
   * Starts the pipeline service.
   *
   * @remarks
   * Initializes resources and begins processing queued jobs.
   * If recoverJobs is enabled, will restore interrupted jobs.
   *
   * @throws {Error} If pipeline fails to start
   */
  start(): Promise<void>;

  /**
   * Stops the pipeline service.
   *
   * @remarks
   * Gracefully stops processing, allowing current jobs to complete
   * or be cancelled. Releases resources and connections.
   */
  stop(): Promise<void>;

  /**
   * Enqueues a new scraping job.
   *
   * @remarks
   * Creates a new scraping job and adds it to the queue.
   * Returns immediately with a job ID for tracking.
   *
   * @param library - The library name for documentation
   * @param version - The library version (null for unversioned)
   * @param options - Scraper configuration options
   * @returns The unique job ID for tracking
   *
   * @throws {Error} If job creation fails
   */
  enqueueJob(
    library: string,
    version: string | undefined | null,
    options: ScraperOptions,
  ): Promise<string>;

  /**
   * Retrieves details for a specific job.
   *
   * @param jobId - The unique job identifier
   * @returns The job details or undefined if not found
   */
  getJob(jobId: string): Promise<PipelineJob | undefined>;

  /**
   * Retrieves all jobs, optionally filtered by status.
   *
   * @param status - Optional status filter
   * @returns Array of jobs matching the criteria
   */
  getJobs(status?: PipelineJobStatus): Promise<PipelineJob[]>;

  /**
   * Cancels a running or queued job.
   *
   * @remarks
   * Attempts to gracefully cancel the job. Already completed jobs
   * will be ignored.
   *
   * @param jobId - The unique job identifier
   * @throws {Error} If cancellation fails
   */
  cancelJob(jobId: string): Promise<void>;

  /**
   * Removes completed jobs from the job queue.
   *
   * @remarks
   * Cleans up jobs that have reached a terminal state
   * (COMPLETED, FAILED, CANCELLED).
   *
   * @returns The number of jobs removed
   */
  clearCompletedJobs(): Promise<number>;

  /**
   * Waits for a job to complete.
   *
   * @remarks
   * Blocks until the job reaches a terminal state (COMPLETED, FAILED, CANCELLED).
   * Useful for synchronous-style workflows.
   *
   * @param jobId - The unique job identifier
   * @throws {Error} If the job fails
   *
   * @example
   * ```typescript
   * try {
   *   await pipeline.waitForJobCompletion(jobId);
   *   console.log('Job completed successfully');
   * } catch (error) {
   *   console.error('Job failed:', error);
   * }
   * ```
   */
  waitForJobCompletion(jobId: string): Promise<void>;

  /**
   * Registers callbacks for job lifecycle events.
   *
   * @remarks
   * Allows monitoring job progress and responding to events.
   * Callbacks are invoked asynchronously by the pipeline.
   *
   * @param callbacks - Object containing callback functions
   *
   * @example
   * ```typescript
   * pipeline.setCallbacks({
   *   onJobProgress: (jobId, progress) => {
   *     console.log(`Job ${jobId}: ${progress.pages}/${progress.maxPages}`);
   *   },
   *   onJobComplete: (jobId) => {
   *     console.log(`Job ${jobId} completed`);
   *   },
   *   onJobError: (jobId, error) => {
   *     console.error(`Job ${jobId} failed:`, error);
   *   }
   * });
   * ```
   */
  setCallbacks(callbacks: PipelineManagerCallbacks): void;
}
