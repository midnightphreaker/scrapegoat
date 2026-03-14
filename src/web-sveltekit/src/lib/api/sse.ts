import type { Job } from "./types";

type JobEventType = "job-progress" | "job-status" | "job-error";
type JobEventCallback = (event: { type: JobEventType; payload: Job }) => void;

export class JobEventSource {
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private callback: JobEventCallback;
  private isPolling = false;
  private abortController: AbortController | null = null;

  constructor(callback: JobEventCallback) {
    this.callback = callback;
  }

  connect() {
    this.startPolling();
  }

  private startPolling() {
    if (this.pollInterval) return;

    const poll = async () => {
      if (this.isPolling) return;
      this.isPolling = true;
      this.abortController = new AbortController();

      try {
        const response = await fetch("/api/trpc/jobs.getJobs", {
          signal: this.abortController.signal,
        });
        const data = await response.json();
        for (const job of data.result?.data?.jobs || []) {
          this.callback({ type: "job-status", payload: job });
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          return;
        }
        console.error("Polling failed:", e);
      } finally {
        this.isPolling = false;
      }
    };

    poll();
    this.pollInterval = setInterval(poll, 2000);
  }

  disconnect() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.abortController?.abort();
    this.abortController = null;
    this.isPolling = false;
  }
}

export function subscribeToJobUpdates(callback: JobEventCallback): () => void {
  const client = new JobEventSource(callback);
  client.connect();
  return () => client.disconnect();
}
