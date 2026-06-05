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
    expect(html).not.toContain("phrk</span>");
    expect(html).not.toContain("v2.4.0");
  });
});
