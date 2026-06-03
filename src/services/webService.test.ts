import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerWebService } from "./webService";

const registerUploadRoutesMock = vi.hoisted(() => vi.fn());

vi.mock("../tools", () => ({
  SearchTool: vi.fn(),
}));

vi.mock("../tools/CancelJobTool", () => ({
  CancelJobTool: vi.fn(),
}));

vi.mock("../tools/ClearCompletedJobsTool", () => ({
  ClearCompletedJobsTool: vi.fn(),
}));

vi.mock("../tools/ListJobsTool", () => ({
  ListJobsTool: vi.fn(),
}));

vi.mock("../tools/ListLibrariesTool", () => ({
  ListLibrariesTool: vi.fn(),
}));

vi.mock("../tools/RefreshVersionTool", () => ({
  RefreshVersionTool: vi.fn(),
}));

vi.mock("../tools/RemoveTool", () => ({
  RemoveTool: vi.fn(),
}));

vi.mock("../tools/ScrapeTool", () => ({
  ScrapeTool: vi.fn(),
}));

vi.mock("../web/routes/events", () => ({
  registerEventsRoute: vi.fn(),
}));

vi.mock("../web/routes/index", () => ({
  registerIndexRoute: vi.fn(),
}));

vi.mock("../web/routes/jobs/cancel", () => ({
  registerCancelJobRoute: vi.fn(),
}));

vi.mock("../web/routes/jobs/clear-completed", () => ({
  registerClearCompletedJobsRoute: vi.fn(),
}));

vi.mock("../web/routes/jobs/list", () => ({
  registerJobListRoutes: vi.fn(),
}));

vi.mock("../web/routes/jobs/new", () => ({
  registerNewJobRoutes: vi.fn(),
}));

vi.mock("../web/routes/jobs/source-selection", () => ({
  registerSourceSelectionRoute: vi.fn(),
}));

vi.mock("../web/routes/libraries/detail", () => ({
  registerLibraryDetailRoutes: vi.fn(),
}));

vi.mock("../web/routes/libraries/list", () => ({
  registerLibrariesRoutes: vi.fn(),
}));

vi.mock("../web/routes/stats", () => ({
  registerStatsRoute: vi.fn(),
}));

vi.mock("../web/routes/upload", () => ({
  registerUploadRoutes: registerUploadRoutesMock,
}));

describe("registerWebService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("waits for upload route plugins before reporting web service registration complete", async () => {
    let resolveUploadRoutes!: () => void;
    let uploadRoutesResolved = false;
    registerUploadRoutesMock.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveUploadRoutes = () => {
          uploadRoutesResolved = true;
          resolve();
        };
      }),
    );

    let serviceResolved = false;
    const servicePromise = registerWebService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { scraper: {} } as never,
    ).then(() => {
      serviceResolved = true;
    });

    await Promise.resolve();

    expect(registerUploadRoutesMock).toHaveBeenCalled();
    expect(uploadRoutesResolved).toBe(false);
    expect(serviceResolved).toBe(false);

    resolveUploadRoutes();
    await servicePromise;

    expect(serviceResolved).toBe(true);
  });
});
