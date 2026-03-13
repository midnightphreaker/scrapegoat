import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import Header from "$lib/components/layout/Header.svelte";

describe("Header", () => {
  it("renders logo and navigation", () => {
    render(Header);
    const logo = screen.getByText("Scrapegoat");
    expect(logo).toBeTruthy();
  });
});
