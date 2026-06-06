import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { afterEach, describe, expect, it } from "vitest";
import SourceSelectionModal from "./SourceSelectionModal";

describe("SourceSelectionModal", () => {
  const browsers: Awaited<ReturnType<typeof chromium.launch>>[] = [];

  afterEach(async () => {
    await Promise.all(browsers.splice(0).map((browser) => browser.close()));
  });

  it("separates source selection from panel activation", async () => {
    const html = String(await SourceSelectionModal());

    expect(html).toContain("selectedSource: null");
    expect(html).toContain("x-on:click=\"selectedSource = 'remote'\"");
    expect(html).toContain("x-on:click=\"selectedSource = 'local'\"");
    expect(html).toContain('x-bind:disabled="selectedSource === null"');
    expect(html).toContain("Proceed");

    const remoteCard = html.slice(
      html.indexOf("x-on:click=\"selectedSource = 'remote'\""),
      html.indexOf("Remote URL"),
    );
    const localCard = html.slice(
      html.indexOf("x-on:click=\"selectedSource = 'local'\""),
      html.indexOf("Local Documentation"),
    );

    expect(remoteCard).not.toContain('hx-get="/web/jobs/new"');
    expect(localCard).not.toContain('hx-get="/web/upload"');
  });

  it("loads the selected source panel when Proceed is clicked", async () => {
    const modalHtml = String(await SourceSelectionModal());
    const alpineSource = readFileSync("node_modules/alpinejs/dist/cdn.min.js", "utf8");
    const browser = await chromium.launch();
    browsers.push(browser);
    const page = await browser.newPage();

    await page.setContent(`
      <div id="addJobForm"></div>
      <div id="modal-container">${modalHtml}</div>
      <script>
        window.htmxCalls = [];
        window.htmx = {
          ajax(method, url, options) {
            window.htmxCalls.push({ method, url, options });
          }
        };
      </script>
      <script>${alpineSource}</script>
    `);

    await page.getByRole("button", { name: "Local Documentation" }).click();
    await page.getByRole("button", { name: "Proceed" }).click();

    await expect
      .poll(() =>
        page.evaluate(() => (window as unknown as { htmxCalls: unknown[] }).htmxCalls),
      )
      .toEqual([
        {
          method: "GET",
          url: "/web/upload",
          options: { target: "#addJobForm", swap: "innerHTML" },
        },
      ]);
  });
});
