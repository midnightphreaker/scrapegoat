import { describe, expect, it } from "vitest";
import SourceSelectionModal from "./SourceSelectionModal";

describe("SourceSelectionModal", () => {
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
});
