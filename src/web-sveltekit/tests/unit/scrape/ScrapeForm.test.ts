import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ScrapeForm from "$lib/components/scrape/ScrapeForm.svelte";

describe("ScrapeForm", () => {
  it("renders URL input and library name field", () => {
    render(ScrapeForm);
    expect(screen.getByPlaceholderText(/url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/library/i)).toBeInTheDocument();
  });

  it("has add URL button", () => {
    render(ScrapeForm);
    expect(screen.getByRole("button", { name: /\+/ })).toBeInTheDocument();
  });
});
