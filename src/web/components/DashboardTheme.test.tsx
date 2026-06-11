import { describe, expect, it } from "vitest";
import { PipelineJobStatus } from "../../pipeline/types";
import { VersionStatus } from "../../store/types";
import type { JobInfo } from "../../tools/GetJobInfoTool";
import Alert from "./Alert";
import AnalyticsCards from "./AnalyticsCards";
import JobItem from "./JobItem";
import PrimaryButton from "./PrimaryButton";
import ProgressBar from "./ProgressBar";
import StatusBadge from "./StatusBadge";
import VersionBadge from "./VersionBadge";

const runningJob: JobInfo = {
  id: "job-1",
  library: "example-docs",
  version: "1.0.0",
  status: PipelineJobStatus.RUNNING,
  dbStatus: VersionStatus.RUNNING,
  createdAt: "2026-06-12T00:00:00.000Z",
  startedAt: "2026-06-12T00:00:10.000Z",
  finishedAt: null,
  error: null,
  progress: {
    pages: 2,
    totalPages: 4,
    totalDiscovered: 4,
  },
};

describe("dashboard themed components", () => {
  it("renders PrimaryButton with shared button primitives", async () => {
    const html = String(await PrimaryButton({ children: "Save" }));

    expect(html).toContain('class="sg-button sg-button-primary w-full"');
  });

  it("renders success Alert with panel and success badge primitives", async () => {
    const html = String(await Alert({ type: "success", message: "Saved" }));

    expect(html).toContain('role="alert"');
    expect(html).toContain("sg-panel");
    expect(html).toContain("sg-badge-success");
  });

  it("renders AnalyticsCards with dark cards and formatted chunk count", async () => {
    const html = String(
      await AnalyticsCards({
        totalChunks: 6100,
        activeLibraries: 4,
        activeVersions: 7,
        indexedPages: 42,
      }),
    );

    expect(html).toContain("sg-card");
    expect(html).toContain("Total Knowledge Base");
    expect(html).toContain("6.1K Chunks");
  });

  it("renders running StatusBadge with cyan badge primitives", async () => {
    const html = String(await StatusBadge({ status: VersionStatus.RUNNING }));

    expect(html).toContain('class="sg-badge sg-badge-cyan"');
  });

  it("renders VersionBadge with cyan badge primitives", async () => {
    const html = String(await VersionBadge({ version: "1.0.0" }));

    expect(html).toContain('class="sg-badge sg-badge-cyan me-2"');
  });

  it("renders ProgressBar with progress primitives", async () => {
    const html = String(
      await ProgressBar({
        progress: {
          pages: 2,
          totalPages: 4,
          totalDiscovered: 4,
        },
      }),
    );

    expect(html).toContain("sg-progress-track");
    expect(html).toContain("sg-progress-fill");
  });

  it("renders JobItem with row primitive and Alpine state", async () => {
    const html = String(await JobItem({ job: runningJob }));

    expect(html).toContain('id="job-item-job-1"');
    expect(html).toContain("sg-row");
    expect(html).toContain("x-data=");
  });
});
