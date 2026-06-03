/**
 * Centralized event type definitions for the event bus system.
 * This serves as the single source of truth for all events in the application.
 */

import type { PipelineJob } from "../pipeline/types";
import type { ScraperProgressEvent } from "../scraper/types";

/**
 * Event type enum used by the EventBusService.
 * These are the internal event identifiers.
 */
export enum EventType {
  JOB_STATUS_CHANGE = "JOB_STATUS_CHANGE",
  JOB_PROGRESS = "JOB_PROGRESS",
  LIBRARY_CHANGE = "LIBRARY_CHANGE",
  JOB_LIST_CHANGE = "JOB_LIST_CHANGE",
  DB_UPDATE_FAILED = "DB_UPDATE_FAILED",
  JOB_CANCEL_TIMEOUT = "JOB_CANCEL_TIMEOUT",
}

/**
 * Server-side event names used in SSE messages.
 * These match the event names expected by the frontend EventClient.
 */
export const ServerEventName = {
  [EventType.JOB_STATUS_CHANGE]: "job-status-change",
  [EventType.JOB_PROGRESS]: "job-progress",
  [EventType.LIBRARY_CHANGE]: "library-change",
  [EventType.JOB_LIST_CHANGE]: "job-list-change",
  [EventType.DB_UPDATE_FAILED]: "db-update-failed",
  [EventType.JOB_CANCEL_TIMEOUT]: "job-cancel-timeout",
} as const;

/**
 * Type-safe mapping of event types to their payload structures.
 */
export interface DbUpdateFailedPayload {
  jobId: string;
  error: Error;
}

export interface JobCancelTimeoutPayload {
  jobId: string;
}

export interface EventPayloads {
  [EventType.JOB_STATUS_CHANGE]: PipelineJob;
  [EventType.JOB_PROGRESS]: {
    job: PipelineJob;
    progress: ScraperProgressEvent;
  };
  [EventType.LIBRARY_CHANGE]: undefined;
  [EventType.JOB_LIST_CHANGE]: undefined;
  [EventType.DB_UPDATE_FAILED]: DbUpdateFailedPayload;
  [EventType.JOB_CANCEL_TIMEOUT]: JobCancelTimeoutPayload;
}

/**
 * Type-safe event listener callback.
 */
export type EventListener<T extends EventType> = (payload: EventPayloads[T]) => void;

/**
 * SSE message payload types that are sent to the frontend.
 * These define the exact structure of data transmitted over the wire.
 */
export interface SseEventPayloads {
  "job-status-change": {
    id: string;
    library: string;
    version: string | null;
    status: string;
    error: { message: string } | null;
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    sourceUrl: string | null;
  };
  "job-progress": {
    id: string;
    library: string;
    version: string | null;
    progress: {
      pagesScraped: number;
      totalPages: number;
      totalDiscovered: number;
      currentUrl: string;
      depth: number;
      maxDepth: number;
    };
  };
  "library-change": Record<string, never>;
  "job-list-change": Record<string, never>;
  "db-update-failed": {
    jobId: string;
    error: string;
  };
  "job-cancel-timeout": {
    jobId: string;
  };
}

/**
 * Union type of all SSE event names.
 */
export type SseEventName = keyof SseEventPayloads;
