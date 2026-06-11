import { describe, expect, it } from "vitest";
import { PipelineJobStatus } from "../../pipeline/types";
import type { JobInfo } from "../../tools/GetJobInfoTool";
import JobList from "./JobList";

const completedJob: JobInfo = {
  id: "job-1",
  library: "example-docs",
  version: "1.0.0",
  status: PipelineJobStatus.COMPLETED,
  createdAt: "2026-06-12T00:00:00.000Z",
  startedAt: null,
  finishedAt: "2026-06-12T00:01:00.000Z",
  error: null,
};

describe("JobList", () => {
  it("renders an active clear button when jobs exist", async () => {
    const html = String(await JobList({ jobs: [completedJob] }));

    expect(html).toContain(
      'class="sg-button sg-button-secondary px-3 py-1.5 text-xs"',
    );
    expect(html).not.toContain("sg-button-ghost");
  });

  it("renders a disabled clear button when no jobs exist", async () => {
    const html = String(await JobList({ jobs: [] }));

    expect(html).toContain('class="sg-button sg-button-ghost px-3 py-1.5 text-xs"');
    expect(html).toContain("disabled");
    expect(html).not.toContain("sg-button-secondary");
  });
});
