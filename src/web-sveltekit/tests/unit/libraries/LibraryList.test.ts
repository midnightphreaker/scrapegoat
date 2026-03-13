import { render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Library } from "$lib/api/types";
import LibraryList from "$lib/components/libraries/LibraryList.svelte";
import { librariesStore } from "$lib/stores/libraries.svelte";

vi.mock("$lib/stores/libraries.svelte", () => ({
  librariesStore: {
    libraries: [] as Library[],
    loading: false,
    error: null,
    lastFetch: null,
    fetch: vi.fn(),
  },
}));

describe("LibraryList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (librariesStore as any).libraries = [];
    (librariesStore as any).loading = false;
    (librariesStore as any).error = null;
  });

  it("shows empty state when no libraries", async () => {
    (librariesStore as any).loading = false;
    (librariesStore as any).libraries = [];

    render(LibraryList);

    expect(screen.getByText(/No libraries indexed/i)).toBeTruthy();
  });

  it("shows loading spinner while fetching", async () => {
    (librariesStore as any).loading = true;
    (librariesStore as any).libraries = [];

    render(LibraryList);

    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();
  });

  it("fetches libraries on mount", async () => {
    render(LibraryList);

    expect(librariesStore.fetch).toHaveBeenCalled();
  });

  it("renders LibraryItem for each library", async () => {
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

    (librariesStore as any).libraries = mockLibraries;
    (librariesStore as any).loading = false;

    render(LibraryList);

    expect(screen.getByText("react")).toBeTruthy();
  });

  it("sorts libraries alphabetically", async () => {
    const mockLibraries: Library[] = [
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
      {
        name: "angular",
        versions: [
          {
            version: "16.0.0",
            status: "completed",
            documentCount: 80,
            uniqueUrlCount: 40,
            indexedAt: "2024-01-01T00:00:00Z",
            sourceUrl: "https://angular.dev",
          },
        ],
      },
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

    (librariesStore as any).libraries = mockLibraries;
    (librariesStore as any).loading = false;

    render(LibraryList);

    const libraryElements = screen.getAllByText(/^(angular|react|vue)$/);
    const names = libraryElements.map((el) => el.textContent);

    expect(names).toEqual(["angular", "react", "vue"]);
  });

  it("shows helper text in empty state", async () => {
    (librariesStore as any).loading = false;
    (librariesStore as any).libraries = [];

    render(LibraryList);

    expect(
      screen.getByText(/Submit a scrape job to create your first library/i),
    ).toBeTruthy();
  });
});
