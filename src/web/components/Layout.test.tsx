import { describe, expect, it } from "vitest";
import Layout from "./Layout";

describe("Layout", () => {
  it("uses the local ScrapeGoat banner as the header brand", async () => {
    const html = String(
      await Layout({
        title: "ScrapeGoat",
        version: "2.4.0",
        children: <div>content</div>,
      }),
    );

    expect(html).toContain('src="/ScrapeGoat-Banner.svg"');
    expect(html).toContain('alt="ScrapeGoat"');
    expect(html).toContain('content="#020406"');
    expect(html).toContain('class="sg-shell"');
    expect(html).toContain('class="sg-header sticky top-0 z-30"');
    expect(html).toContain('class="sg-page"');
    expect(html).toContain('class="sg-panel flex w-full max-w-xs items-center p-4"');
    expect(html).toContain("sg-button sg-button-ghost ml-auto");
    expect(html).not.toContain("bg-white");
    expect(html).not.toContain("dark:bg-gray");
    expect(html).not.toContain("phrk</span>");
    expect(html).not.toContain("v2.4.0");
  });
});
