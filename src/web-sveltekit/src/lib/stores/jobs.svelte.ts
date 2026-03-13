import { trpc } from "$lib/api/trpc";
import type { Job } from "$lib/api/types";

class JobsStore {
  jobs = $state<Job[]>([]);
  loading = $state(false);
  error = $state<string | null>(null);

  async fetch() {
    this.loading = true;
    this.error = null;
    try {
      const result = await trpc.jobs.getJobs.query();
      this.jobs = result.jobs;
    } catch (e) {
      this.error = e instanceof Error ? e.message : "Failed to fetch jobs";
    } finally {
      this.loading = false;
    }
  }

  async cancel(jobId: string) {
    try {
      await trpc.jobs.cancelJob.mutate({ id: jobId });
      this.jobs = this.jobs.filter((j) => j.id !== jobId);
    } catch (e) {
      this.error = e instanceof Error ? e.message : "Failed to cancel job";
    }
  }

  async clearCompleted() {
    try {
      await trpc.jobs.clearCompletedJobs.mutate();
      this.jobs = this.jobs.filter(
        (j) =>
          j.status !== "completed" && j.status !== "failed" && j.status !== "cancelled",
      );
    } catch (e) {
      this.error = e instanceof Error ? e.message : "Failed to clear jobs";
    }
  }

  updateJob(updatedJob: Job) {
    const index = this.jobs.findIndex((j) => j.id === updatedJob.id);
    if (index >= 0) {
      this.jobs[index] = updatedJob;
    } else {
      this.jobs.unshift(updatedJob);
    }
  }
}

export const jobsStore = new JobsStore();
