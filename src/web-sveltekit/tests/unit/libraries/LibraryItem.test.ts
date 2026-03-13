import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import type { Library } from "$lib/api/types";
import LibraryItem from "$lib/components/libraries/LibraryItem.svelte";

describe("LibraryItem", () => {
  const mockLibrary: Library = {
    name: "react",
    versions: [
      {
        version: "18.0.0",
        status: "completed",
        documentCount: 100,
        uniqueUrlCount: 50,
        indexedAt: new Date().toISOString(),
        sourceUrl: "https://react.dev",
      },
    ],
  };

  it("displays library name", () => {
    render(LibraryItem, { props: { library: mockLibrary } });
    expect(screen.getByText("react")).toBeTruthy();
  });

  it("displays version badge", () => {
    render(LibraryItem, { props: { library: mockLibrary } });
    expect(screen.getByText("18.0.0")).toBeTruthy();
  });

  it("displays document count", () => {
    render(LibraryItem, { props: { library: mockLibrary } });
    expect(screen.getByText(/100/)).toBeTruthy();
  });

  it("displays URL count", () => {
    render(LibraryItem, { props: { library: mockLibrary } });
    expect(screen.getByText(/50/)).toBeTruthy();
  });

  it("has clickable link to library detail page", () => {
    render(LibraryItem, { props: { library: mockLibrary } });
    const link = screen.getByRole("link", { name: /react/i });
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("/libraries/react");
  });

  it("shows delete button", () => {
    render(LibraryItem, { props: { library: mockLibrary } });
    const buttons = screen.getAllByRole("button");
    const deleteButton = buttons.find((b) =>
      b.textContent?.toLowerCase().includes("delete"),
    );
    expect(deleteButton).toBeTruthy();
  });

  it("shows rescrape button", () => {
    render(LibraryItem, { props: { library: mockLibrary } });
    const buttons = screen.getAllByRole("button");
    const rescrapeButton = buttons.find((b) =>
      b.textContent?.toLowerCase().includes("rescrape"),
    );
    expect(rescrapeButton).toBeTruthy();
  });

  it("enters edit mode on double click", async () => {
    render(LibraryItem, { props: { library: mockLibrary } });
    const nameElement = screen.getByText("react");
    await fireEvent.dblClick(nameElement);
    const input = screen.getByRole("textbox");
    expect(input).toBeTruthy();
  });

  it("calls onDeleteVersion when delete confirmed", async () => {
    const onDeleteVersion = vi.fn();
    render(LibraryItem, {
      props: { library: mockLibrary, onDeleteVersion },
    });
    const buttons = screen.getAllByRole("button");
    const deleteButton = buttons.find((b) =>
      b.textContent?.toLowerCase().includes("delete"),
    );
    if (deleteButton) {
      await fireEvent.click(deleteButton);
      await fireEvent.click(deleteButton);
    }
    expect(onDeleteVersion).toHaveBeenCalled();
  });

  it("calls onRescrape when rescrape confirmed", async () => {
    const onRescrape = vi.fn();
    render(LibraryItem, {
      props: { library: mockLibrary, onRescrape },
    });
    const buttons = screen.getAllByRole("button");
    const rescrapeButton = buttons.find((b) =>
      b.textContent?.toLowerCase().includes("rescrape"),
    );
    if (rescrapeButton) {
      await fireEvent.click(rescrapeButton);
      await fireEvent.click(rescrapeButton);
    }
    expect(onRescrape).toHaveBeenCalled();
  });

  it("calls onRename when editing name", async () => {
    const onRename = vi.fn();
    render(LibraryItem, { props: { library: mockLibrary, onRename } });
    const nameElement = screen.getByText("react");
    await fireEvent.dblClick(nameElement);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    await fireEvent.input(input, { target: { value: "react-updated" } });
    await fireEvent.keyDown(input, { key: "Enter" });
    expect(onRename).toHaveBeenCalledWith("react-updated");
  });
});
