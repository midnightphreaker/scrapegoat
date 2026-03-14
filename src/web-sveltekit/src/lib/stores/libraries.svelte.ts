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
    } catch (e) {
      this.error = e instanceof Error ? e.message : "Failed to delete version";
    }
  }

  async rename(_library: string, _newTitle: string): Promise<void> {
    throw new Error("Not implemented");
  }

  async rescrape(_library: string, _version: string): Promise<void> {
    throw new Error("Not implemented");
  }
}

export const librariesStore = new LibrariesStore();
