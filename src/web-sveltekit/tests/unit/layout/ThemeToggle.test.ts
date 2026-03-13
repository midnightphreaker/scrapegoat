import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ThemeToggle from "$lib/components/layout/ThemeToggle.svelte";

describe("ThemeToggle", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a button with aria-label", () => {
    render(ThemeToggle);
    const button = screen.getByRole("button", { name: /toggle theme/i });
    expect(button).toBeTruthy();
  });

  it("toggles dark mode on click", async () => {
    render(ThemeToggle);
    const button = screen.getByRole("button", { name: /toggle theme/i });

    await fireEvent.click(button);

    expect(localStorage.setItem).toHaveBeenCalledWith("theme", "dark");
  });
});
