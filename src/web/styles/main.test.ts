import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("web theme", () => {
  it("uses neutral primary and accent palettes", () => {
    const css = readFileSync("src/web/styles/main.css", "utf8");

    expect(css).toContain("--color-primary-600: #525252;");
    expect(css).toContain("--color-accent-500: #737373;");
    expect(css).toContain("--color-gray-900: #171717;");
    expect(css).toContain("--color-gray-950: #0a0a0a;");
    expect(css).not.toContain("#2563eb");
    expect(css).not.toContain("#f59e0b");
  });
});
