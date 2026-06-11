import { describe, expect, it } from "vitest";
import { PipelineJobStatus } from "../../pipeline/types";
import { VersionStatus } from "../../store/types";
import type { JobInfo } from "../../tools/GetJobInfoTool";
import Alert from "./Alert";
import AnalyticsCards from "./AnalyticsCards";
import JobItem from "./JobItem";
import LibraryDetailCard from "./LibraryDetailCard";
import LibraryItem from "./LibraryItem";
import LibraryList from "./LibraryList";
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
    const rootClasses =
      html.match(/id="job-item-job-1" class="([^"]+)"/)?.[1]?.split(/\s+/) ??
      [];
    const stopButtonClasses =
      html
        .match(/<button type="button" class="([^"]+)" title="Stop this job"/)?.[1]
        ?.split(/\s+/) ?? [];

    expect(html).toContain('id="job-item-job-1"');
    expect(rootClasses).toContain("sg-row");
    expect(rootClasses).not.toContain("block");
    expect(html).toContain("x-data=");
    expect(stopButtonClasses).not.toContain("sg-button");
    expect(stopButtonClasses).not.toContain("sg-button-ghost");
    expect(stopButtonClasses).not.toContain("sg-button-danger");
    expect(html).toContain("confirming ? 'sg-button sg-button-danger");
    expect(html).toContain(": 'sg-button sg-button-ghost");
  });

  it("renders library list and detail surfaces with dark glass primitives", async () => {
    const library = {
      name: "pdf-test2",
      versions: [
        {
          version: "2",
          documentCount: 278,
          uniqueUrlCount: 1,
          indexedAt: "2026-06-12T00:00:00.000Z",
          status: VersionStatus.COMPLETED,
          sourceUrl: "file:///import/pdf-test2/2/",
        },
      ],
    };

    const listHtml = String(await LibraryList({ libraries: [library] }));
    const itemHtml = String(await LibraryItem({ library }));
    const detailHtml = String(await LibraryDetailCard({ library }));

    expect(listHtml).toContain('id="library-list"');
    expect(listHtml).toContain("sg-card");
    expect(itemHtml).toContain("sg-card");
    expect(itemHtml).toContain("pdf-test2");
    expect(detailHtml).toContain("sg-panel");
    expect(detailHtml).toContain('id="version-list"');
    expect(detailHtml).toContain('hx-trigger="library-change from:body"');
    expect(detailHtml).toContain(
      'class="sg-button sg-button-ghost min-h-0 h-6 w-6 p-1"',
    );
    expect(detailHtml).toContain(
      "confirming ? 'sg-button sg-button-danger min-h-0 min-w-6 h-6 bg-rose-500/25 px-2 py-1'",
    );
    expect(detailHtml).toContain(
      ": 'sg-button sg-button-ghost min-h-0 min-w-6 h-6 p-1 text-rose-300 border-rose-400/35 hover:bg-rose-500/10'",
    );
  });
});
