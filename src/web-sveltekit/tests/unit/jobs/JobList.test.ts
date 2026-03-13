import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import type { Job } from "$lib/api/types";
import JobList from "$lib/components/jobs/JobList.svelte";

describe("JobList", () => {
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

  it("shows empty state when no jobs", () => {
    render(JobList, { props: { jobs: [] } });
    expect(screen.getByText(/No active jobs/i)).toBeTruthy();
  });

  it("shows hint text in empty state", () => {
    render(JobList, { props: { jobs: [] } });
    expect(screen.getByText(/Submit a scrape job/i)).toBeTruthy();
  });

  it("renders JobItem for each active job", () => {
    const jobs: Job[] = [
      mockJob,
      { ...mockJob, id: "test-456", library: "vue", status: "queued", progress: null },
    ];
    render(JobList, { props: { jobs } });
    expect(screen.getByText("react")).toBeTruthy();
    expect(screen.getByText("vue")).toBeTruthy();
  });

  it("filters out completed jobs", () => {
    const jobs: Job[] = [
      mockJob,
      {
        ...mockJob,
        id: "test-456",
        status: "completed",
        progress: { pages: 10, totalPages: 10 },
      },
    ];
    render(JobList, { props: { jobs } });
    expect(screen.getByText("react")).toBeTruthy();
  });

  it("filters out failed jobs", () => {
    const jobs: Job[] = [
      mockJob,
      { ...mockJob, id: "test-456", status: "failed", error: "Failed" },
    ];
    render(JobList, { props: { jobs } });
    expect(screen.getByText("react")).toBeTruthy();
  });
});
