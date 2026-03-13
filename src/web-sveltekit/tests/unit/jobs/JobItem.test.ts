import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import type { Job } from "$lib/api/types";
import JobItem from "$lib/components/jobs/JobItem.svelte";

describe("JobItem", () => {
  const mockJob: Job = {
    id: "test-123",
    library: "react",
    version: "18.0.0",
    status: "running",
    progress: { pages: 5, totalPages: 10 },
    error: null,
    createdAt: new Date().toISOString(),
    sourceUrl: "https://react.dev",
  };

  it("displays library name", () => {
    render(JobItem, { props: { job: mockJob } });
    expect(screen.getByText("react")).toBeTruthy();
  });

  it("displays version badge", () => {
    render(JobItem, { props: { job: mockJob } });
    expect(screen.getByText("18.0.0")).toBeTruthy();
  });

  it("displays status badge", () => {
    render(JobItem, { props: { job: mockJob } });
    expect(screen.getByText("running")).toBeTruthy();
  });

  it("displays progress when available", () => {
    render(JobItem, { props: { job: mockJob } });
    expect(screen.getByText(/5\s*\/\s*10/)).toBeTruthy();
  });

  it("displays completed status with success styling", () => {
    const completedJob: Job = {
      ...mockJob,
      status: "completed",
      progress: { pages: 10, totalPages: 10 },
    };
    render(JobItem, { props: { job: completedJob } });
    expect(screen.getByText("completed")).toBeTruthy();
  });

  it("displays error message when job failed", () => {
    const failedJob: Job = {
      ...mockJob,
      status: "failed",
      error: "Connection timeout",
      progress: null,
    };
    render(JobItem, { props: { job: failedJob } });
    expect(screen.getByText(/Connection timeout/)).toBeTruthy();
  });

  it("shows cancel button for running jobs", () => {
    render(JobItem, { props: { job: mockJob } });
    expect(screen.getByRole("button", { name: /cancel/i })).toBeTruthy();
  });

  it("shows cancel button for queued jobs", () => {
    const queuedJob: Job = { ...mockJob, status: "queued", progress: null };
    render(JobItem, { props: { job: queuedJob } });
    expect(screen.getByRole("button", { name: /cancel/i })).toBeTruthy();
  });

  it("hides cancel button for completed jobs", () => {
    const completedJob: Job = {
      ...mockJob,
      status: "completed",
      progress: { pages: 10, totalPages: 10 },
    };
    render(JobItem, { props: { job: completedJob } });
    expect(screen.queryByRole("button", { name: /cancel/i })).toBeNull();
  });
});
