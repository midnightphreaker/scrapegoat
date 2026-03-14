import type { Job } from "./types";

type JobEventType = "job-progress" | "job-status" | "job-error";
type JobEventCallback = (event: { type: JobEventType; payload: Job }) => void;

export class JobEventSource {
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private callback: JobEventCallback;
  private polling = false;

  constructor(callback: JobEventCallback) {
    this.callback = callback;
  }

  connect() {
    this.startPolling();
  }

  private startPolling() {
    if (this.polling) return;
    this.polling = true;

    this.pollInterval = setInterval(async () => {
      try {
        const response = await fetch("/api/trpc/jobs.getJobs");
        const data = await response.json();
        for (const job of data.result?.data?.jobs || []) {
          this.callback({ type: "job-status", payload: job });
        }
      } catch (e) {
        console.error("Polling failed:", e);
      }
    }, 5000);
  }

  disconnect() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.polling = false;
  }
}

export function subscribeToJobUpdates(callback: JobEventCallback): () => void {
  const client = new JobEventSource(callback);
  client.connect();
  return () => client.disconnect();
}
