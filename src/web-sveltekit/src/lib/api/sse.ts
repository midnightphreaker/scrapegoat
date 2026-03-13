import type { Job } from "./types";

type JobEventType = "job-progress" | "job-status" | "job-error";
type JobEventCallback = (event: { type: JobEventType; payload: Job }) => void;

export class JobEventSource {
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private callback: JobEventCallback;
  private polling = false;

  constructor(callback: JobEventCallback) {
    this.callback = callback;
  }

  connect() {
    if (this.eventSource) {
      this.eventSource.close();
    }

    try {
      this.eventSource = new EventSource("/web/jobs/events");

      this.eventSource.addEventListener("job-progress", (e) => {
        this.handleEvent("job-progress", e);
      });

      this.eventSource.addEventListener("job-status", (e) => {
        this.handleEvent("job-status", e);
      });

      this.eventSource.addEventListener("job-error", (e) => {
        this.handleEvent("job-error", e);
      });

      this.eventSource.onerror = () => {
        this.handleDisconnect();
      };

      this.eventSource.onopen = () => {
        this.reconnectAttempts = 0;
      };
    } catch {
      this.handleDisconnect();
    }
  }

  private handleEvent(type: JobEventType, event: MessageEvent) {
    try {
      const payload = JSON.parse(event.data) as Job;
      this.callback({ type, payload });
    } catch (e) {
      console.error("Failed to parse SSE event:", e);
    }
  }

  private handleDisconnect() {
    this.reconnectAttempts++;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn("SSE failed 3 times, falling back to polling");
      this.startPolling();
    } else {
      const delay = 1000 * 2 ** this.reconnectAttempts;
      setTimeout(() => this.connect(), delay);
    }
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
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
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
