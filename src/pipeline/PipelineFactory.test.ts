import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventBusService } from "../events/EventBusService";
import type { DocumentManagementService } from "../store";
import { loadConfig } from "../utils/config";
import { PipelineClient } from "./PipelineClient";
import { PipelineFactory } from "./PipelineFactory";
import { PipelineManager } from "./PipelineManager";

// Mock dependencies
vi.mock("./PipelineManager");
vi.mock("./PipelineClient");
vi.mock("../events/EventBusService");

describe("PipelineFactory", () => {
  let mockDocService: Partial<DocumentManagementService>;
  let mockEventBus: EventBusService;
  let appConfig: ReturnType<typeof loadConfig>;

  beforeEach(() => {
    vi.resetAllMocks();
    mockDocService = {};
    mockEventBus = new EventBusService();
    appConfig = loadConfig();
  });

  describe("createPipeline", () => {
    it("should create PipelineManager when no serverUrl provided", async () => {
      appConfig.scraper.maxConcurrency = 5;
      const options = { recoverJobs: true, appConfig: appConfig };

      const pipeline = await PipelineFactory.createPipeline(
        mockDocService as DocumentManagementService,
        mockEventBus,
        options,
      );

      // Should have called PipelineManager with store, eventBus, concurrency, and options
      expect(PipelineManager).toHaveBeenCalledWith(
        mockDocService,
        mockEventBus,
        expect.objectContaining({ recoverJobs: true, appConfig: appConfig }),
      );
      expect(PipelineClient).not.toHaveBeenCalled();
      // Behavior: returned instance is the one constructed by PipelineManager
      const ManagerMock = PipelineManager as unknown as { mock: { instances: any[] } };
      expect(pipeline).toBe(ManagerMock.mock.instances[0]);
    });

    it("should create PipelineClient and call start() when serverUrl provided", async () => {
      const options = {
        serverUrl: "http://localhost:8080",
        appConfig: appConfig,
      };

      const pipeline = await PipelineFactory.createPipeline(
        undefined,
        mockEventBus,
        options,
      );

      expect(PipelineClient).toHaveBeenCalledWith("http://localhost:8080", mockEventBus);
      expect(PipelineManager).not.toHaveBeenCalled();
      // Behavior: returned instance is the one constructed by PipelineClient
      const ClientMock = PipelineClient as unknown as { mock: { instances: any[] } };
      expect(pipeline).toBe(ClientMock.mock.instances[0]);
      // Verify start() was called on the created instance to validate connectivity
      const instance = ClientMock.mock.instances[0] as {
        start: ReturnType<typeof vi.fn>;
      };
      expect(instance.start).toHaveBeenCalled();
    });

    it("should use default options when none provided", async () => {
      await PipelineFactory.createPipeline(
        mockDocService as DocumentManagementService,
        mockEventBus,
        { appConfig: appConfig },
      );

      // Should have called PipelineManager with store, eventBus, default concurrency, and default options
      expect(PipelineManager).toHaveBeenCalledWith(
        mockDocService,
        mockEventBus,
        expect.objectContaining({ recoverJobs: false, appConfig: appConfig }),
      );
    });

    it("should prioritize serverUrl over other options", async () => {
      const options = {
        serverUrl: "http://external:9000",
        recoverJobs: true,
        appConfig: appConfig,
      };

      const _pipeline = await PipelineFactory.createPipeline(
        undefined,
        mockEventBus,
        options,
      );

      // Should create client, ignoring local pipeline options
      expect(PipelineClient).toHaveBeenCalledWith("http://external:9000", mockEventBus);
      expect(PipelineManager).not.toHaveBeenCalled();
    });

    it("should throw error when serverUrl provided without eventBus", async () => {
      const options = { serverUrl: "http://localhost:8080", appConfig: appConfig };

      await expect(
        // @ts-expect-error - Testing error case where eventBus is missing
        PipelineFactory.createPipeline(undefined, undefined, options),
      ).rejects.toThrow("Remote pipeline requires EventBusService");
    });

    it("should propagate start() failure when external worker is unreachable", async () => {
      // Make the auto-mocked start() reject
      vi.mocked(PipelineClient).mockImplementation(
        () =>
          ({
            start: vi
              .fn()
              .mockRejectedValue(new Error("Failed to connect to external worker")),
          }) as unknown as PipelineClient,
      );

      const options = { serverUrl: "http://unreachable:9999", appConfig: appConfig };

      await expect(
        PipelineFactory.createPipeline(undefined, mockEventBus, options),
      ).rejects.toThrow("Failed to connect to external worker");
    });
  });
});
