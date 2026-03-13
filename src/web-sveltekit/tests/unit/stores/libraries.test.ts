import { beforeEach, describe, expect, it, vi } from "vitest";
import { trpc } from "$lib/api/trpc";
import type { Library } from "$lib/api/types";
import { librariesStore } from "$lib/stores/libraries.svelte";

vi.mock("$lib/api/trpc", () => ({
  trpc: {
    listLibraries: {
      query: vi.fn(),
    },
    removeVersion: {
      mutate: vi.fn(),
    },
  },
}));

describe("librariesStore", () => {
  beforeEach(() => {
    librariesStore.libraries = [];
    librariesStore.loading = false;
    librariesStore.error = null;
    librariesStore.lastFetch = null;
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("starts with empty libraries array", () => {
      expect(librariesStore.libraries).toEqual([]);
    });

    it("has loading state", () => {
      expect(librariesStore.loading).toBe(false);
    });

    it("has error state", () => {
      expect(librariesStore.error).toBeNull();
    });

    it("has lastFetch timestamp", () => {
      expect(librariesStore.lastFetch).toBeNull();
    });
  });

  describe("fetch", () => {
    const mockLibraries: Library[] = [
      {
        name: "react",
        versions: [
          {
            version: "18.0.0",
            status: "completed",
            documentCount: 100,
            uniqueUrlCount: 50,
            indexedAt: "2024-01-01T00:00:00Z",
            sourceUrl: "https://react.dev",
          },
        ],
      },
    ];

    it("sets loading to true while fetching", async () => {
      vi.mocked(trpc.listLibraries.query).mockResolvedValue(mockLibraries);

      const promise = librariesStore.fetch();
      expect(librariesStore.loading).toBe(true);

      await promise;
    });

    it("fetches libraries from tRPC", async () => {
      vi.mocked(trpc.listLibraries.query).mockResolvedValue(mockLibraries);

      await librariesStore.fetch();

      expect(trpc.listLibraries.query).toHaveBeenCalled();
      expect(librariesStore.libraries).toEqual(mockLibraries);
    });

    it("sets lastFetch timestamp after successful fetch", async () => {
      vi.mocked(trpc.listLibraries.query).mockResolvedValue(mockLibraries);

      await librariesStore.fetch();

      expect(librariesStore.lastFetch).toBeGreaterThan(0);
    });

    it("sets loading to false after fetch", async () => {
      vi.mocked(trpc.listLibraries.query).mockResolvedValue(mockLibraries);

      await librariesStore.fetch();

      expect(librariesStore.loading).toBe(false);
    });

    it("sets error on failure", async () => {
      const error = new Error("Network error");
      vi.mocked(trpc.listLibraries.query).mockRejectedValue(error);

      await librariesStore.fetch();

      expect(librariesStore.error).toBe("Network error");
      expect(librariesStore.loading).toBe(false);
    });

    it("uses cache within 30s TTL", async () => {
      vi.mocked(trpc.listLibraries.query).mockResolvedValue(mockLibraries);
      librariesStore.lastFetch = Date.now() - 29000;

      await librariesStore.fetch();

      expect(trpc.listLibraries.query).not.toHaveBeenCalled();
    });

    it("forces refresh when forceRefresh is true", async () => {
      vi.mocked(trpc.listLibraries.query).mockResolvedValue(mockLibraries);
      librariesStore.lastFetch = Date.now();

      await librariesStore.fetch(true);

      expect(trpc.listLibraries.query).toHaveBeenCalled();
    });

    it("bypasses cache when cache is stale (older than 30s)", async () => {
      vi.mocked(trpc.listLibraries.query).mockResolvedValue(mockLibraries);
      librariesStore.lastFetch = Date.now() - 31000;

      await librariesStore.fetch();

      expect(trpc.listLibraries.query).toHaveBeenCalled();
    });
  });

  describe("deleteVersion", () => {
    const mockLibraries: Library[] = [
      {
        name: "react",
        versions: [
          {
            version: "18.0.0",
            status: "completed",
            documentCount: 100,
            uniqueUrlCount: 50,
            indexedAt: "2024-01-01T00:00:00Z",
            sourceUrl: "https://react.dev",
          },
          {
            version: "17.0.0",
            status: "completed",
            documentCount: 80,
            uniqueUrlCount: 40,
            indexedAt: "2024-01-01T00:00:00Z",
            sourceUrl: "https://react.dev",
          },
        ],
      },
    ];

    beforeEach(() => {
      librariesStore.libraries = [...mockLibraries];
    });

    it("calls removeVersion tRPC mutation", async () => {
      vi.mocked(trpc.removeVersion.mutate).mockResolvedValue({ ok: true });

      await librariesStore.deleteVersion("react", "17.0.0");

      expect(trpc.removeVersion.mutate).toHaveBeenCalledWith({
        library: "react",
        version: "17.0.0",
      });
    });

    it("removes version from local state", async () => {
      vi.mocked(trpc.removeVersion.mutate).mockResolvedValue({ ok: true });

      await librariesStore.deleteVersion("react", "17.0.0");

      expect(librariesStore.libraries[0].versions).toHaveLength(1);
      expect(librariesStore.libraries[0].versions[0].version).toBe("18.0.0");
    });

    it("sets error on failure", async () => {
      const error = new Error("Delete failed");
      vi.mocked(trpc.removeVersion.mutate).mockRejectedValue(error);

      await librariesStore.deleteVersion("react", "17.0.0");

      expect(librariesStore.error).toBe("Delete failed");
    });

    it("removes library from state if no versions remain", async () => {
      vi.mocked(trpc.removeVersion.mutate).mockResolvedValue({ ok: true });
      librariesStore.libraries = [
        {
          name: "vue",
          versions: [
            {
              version: "3.0.0",
              status: "completed",
              documentCount: 50,
              uniqueUrlCount: 25,
              indexedAt: "2024-01-01T00:00:00Z",
              sourceUrl: "https://vuejs.org",
            },
          ],
        },
      ];

      await librariesStore.deleteVersion("vue", "3.0.0");

      expect(librariesStore.libraries).toHaveLength(0);
    });
  });

  describe("rename (placeholder)", () => {
    it("is a placeholder that throws not implemented", async () => {
      await expect(librariesStore.rename("react", "new-name")).rejects.toThrow(
        "Not implemented",
      );
    });
  });

  describe("rescrape (placeholder)", () => {
    it("is a placeholder that throws not implemented", async () => {
      await expect(librariesStore.rescrape("react", "18.0.0")).rejects.toThrow(
        "Not implemented",
      );
    });
  });
});
