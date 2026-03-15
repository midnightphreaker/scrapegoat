import { toast } from "svelte-sonner";
import { trpc } from "$lib/api/trpc";
import type { Library } from "$lib/api/types";

const CACHE_TTL_MS = 30000;

class LibrariesStore {
  libraries = $state<Library[]>([]);
  loading = $state(false);
  error = $state<string | null>(null);
  lastFetch = $state<number | null>(null);

  async fetch(forceRefresh = false) {
    const now = Date.now();
    const cacheValid = this.lastFetch && now - this.lastFetch < CACHE_TTL_MS;

    if (!forceRefresh && cacheValid) {
      return;
    }

    this.loading = true;
    this.error = null;

    try {
      const result = await trpc.listLibraries.query();
      this.libraries = result;
      this.lastFetch = now;
    } catch (e) {
      this.error = e instanceof Error ? e.message : "Failed to fetch libraries";
    } finally {
      this.loading = false;
    }
  }

  async deleteVersion(library: string, version: string) {
    try {
      await trpc.removeVersion.mutate({ library, version });

      const libIndex = this.libraries.findIndex((l) => l.library === library);
      if (libIndex >= 0) {
        const lib = this.libraries[libIndex];
        lib.versions = lib.versions.filter((v) => v.ref.version !== version);

        if (lib.versions.length === 0) {
          this.libraries.splice(libIndex, 1);
        }
      }
      toast.success(`Version "${version || "default"}" deleted`);
      window.location.reload();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to delete version";
      this.error = message;
      toast.error(message);
    }
  }

  async rename(_library: string, _newTitle: string): Promise<void> {
    throw new Error("Not implemented");
  }

  async renameVersion(
    library: string,
    oldVersion: string,
    newVersion: string,
  ): Promise<void> {
    try {
      await trpc.renameVersion.mutate({
        library,
        oldVersion,
        newVersion,
      });

      await this.fetch(true);

      toast.success(`Version renamed to "${newVersion}"`);
      window.location.reload();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to rename version";
      this.error = message;
      toast.error(message);
      throw e;
    }
  }

  async rescrapeLibrary(versionId: number): Promise<void> {
    try {
      const versionInfo = this.findVersionById(versionId);
      if (!versionInfo) {
        throw new Error("Version not found");
      }

      const { library, version } = versionInfo;

      const storedOptions = await trpc.getScraperOptions.query({ versionId });
      if (!storedOptions) {
        throw new Error("Could not retrieve scraper options");
      }

      await trpc.enqueueJob.mutate({
        library,
        version,
        options: {
          url: storedOptions.sourceUrl,
          library,
          version: version ?? "",
          ...storedOptions.options,
        },
      });

      toast.success("Rescrape job enqueued");

      await this.fetch(true);
      window.location.reload();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to enqueue rescrape job";
      this.error = message;
      toast.error(message);
    }
  }

  private findVersionById(
    versionId: number,
  ): { library: string; version: string | null } | null {
    for (const lib of this.libraries) {
      const version = lib.versions.find((v) => v.id === versionId);
      if (version) {
        return {
          library: lib.library,
          version: version.ref.version,
        };
      }
    }
    return null;
  }
}

export const librariesStore = new LibrariesStore();
