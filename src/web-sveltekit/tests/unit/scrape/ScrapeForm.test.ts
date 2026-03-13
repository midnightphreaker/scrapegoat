import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ScrapeForm from "$lib/components/scrape/ScrapeForm.svelte";

describe("ScrapeForm", () => {
  it("renders URL input and library name field", () => {
    render(ScrapeForm);
    expect(screen.getByPlaceholderText(/url/i)).toBeTruthy();
    expect(screen.getByLabelText(/library/i)).toBeTruthy();
  });

  it("has add URL button", () => {
    render(ScrapeForm);
    const buttons = screen.getAllByRole("button");
    const addButton = buttons.find((b) => b.textContent?.includes("+"));
    expect(addButton).toBeTruthy();
  });
});
