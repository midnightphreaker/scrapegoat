import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("web dark glass theme", () => {
  it("defines shared dark glass tokens and primitives", () => {
    const css = readFileSync("src/web/styles/main.css", "utf8");

    for (const token of [
      "--sg-bg: #020406;",
      "--sg-surface-header:",
      "--sg-surface-glass:",
      "--sg-cyan: #22d3ee;",
      "--sg-border-cyan:",
    ]) {
      expect(css).toContain(token);
    }

    for (const selector of [
      "body.sg-shell",
      ".sg-page",
      ".sg-header",
      ".sg-panel",
      ".sg-card",
      ".sg-button-primary",
      ".sg-button-secondary",
      ".sg-button-ghost",
      ".sg-button-danger",
      ".sg-input",
      ".sg-badge",
      ".sg-progress-fill",
      ".sg-search-result",
    ]) {
      expect(css).toContain(selector);
    }

    expect(css).toContain("backdrop-filter: blur(18px)");
    expect(css).toContain("box-shadow:");
    expect(css).not.toContain("#2563eb");
    expect(css).not.toContain("#f59e0b");
  });
});
