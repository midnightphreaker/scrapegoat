import { describe, expect, it, vi } from "vitest";
import type { ScraperOptions } from "../types";
import { MarkdownLinkExtractorMiddleware } from "./MarkdownLinkExtractorMiddleware";
import type { MiddlewareContext } from "./types";

// Suppress logger output during tests
vi.mock("../../utils/logger");

// Helper to create a minimal valid ScraperOptions object
const createMockScraperOptions = (url = "http://example.com"): ScraperOptions => ({
  url,
  library: "test-lib",
  version: "1.0.0",
  maxDepth: 0,
  maxPages: 1,
  maxConcurrency: 1,
  scope: "subpages",
  followRedirects: true,
  excludeSelectors: [],
  ignoreErrors: false,
});

const createMockContext = (
  markdownContent: string,
  source = "http://example.com",
  initialLinks: string[] = [],
  options?: Partial<ScraperOptions>,
): MiddlewareContext => {
  return {
    content: markdownContent,
    source,
    metadata: {},
    links: initialLinks,
    errors: [],
    options: { ...createMockScraperOptions(source), ...options },
  };
};

describe("MarkdownLinkExtractorMiddleware", () => {
  it("should initialize context.links to an empty array if it is undefined", async () => {
    const middleware = new MarkdownLinkExtractorMiddleware();
    // Create context with undefined links
    const context = createMockContext(
      "Some markdown content",
      "http://example.com",
      undefined,
    );
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware.process(context, next);

    expect(next).toHaveBeenCalledOnce();
    expect(context.links).toBeDefined();
    expect(Array.isArray(context.links)).toBe(true);
    expect(context.links).toHaveLength(0);
  });

  it("should extract inline markdown links from content", async () => {
    const middleware = new MarkdownLinkExtractorMiddleware();
    const markdownContent = `
# Example

Here is a [link to example](https://example.com/page1) and another [link](https://example.com/page2).
Some text with a relative link [relative](./path/to/page).
`;
    const context = createMockContext(markdownContent, "https://example.com/");
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware.process(context, next);

    expect(next).toHaveBeenCalledOnce();
    expect(context.links).toContain("https://example.com/page1");
    expect(context.links).toContain("https://example.com/page2");
    expect(context.links).toContain("https://example.com/path/to/page");
    expect(context.links.length).toBeGreaterThan(0);
  });

  it("should always call the next middleware", async () => {
    const middleware = new MarkdownLinkExtractorMiddleware();
    // Test with null links to ensure it's handled properly
    const context = createMockContext("Some markdown content") as MiddlewareContext;
    // @ts-expect-error
    context.links = null; // Deliberately set to null to test robustness
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware.process(context, next);

    expect(next).toHaveBeenCalledOnce();
    expect(context.links).toBeDefined();
    expect(Array.isArray(context.links)).toBe(true);
  });

  it("should extract reference-style markdown links", async () => {
    const middleware = new MarkdownLinkExtractorMiddleware();
    const markdownContent = `
# Example with references

Check out [this site][ref1] and [another one][ref2].

[ref1]: https://example.com/reference1
[ref2]: https://example.com/reference2
`;
    const context = createMockContext(markdownContent, "https://example.com/");
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware.process(context, next);

    expect(next).toHaveBeenCalledOnce();
    expect(context.links).toContain("https://example.com/reference1");
    expect(context.links).toContain("https://example.com/reference2");
  });

  it("should extract autolinks from markdown", async () => {
    const middleware = new MarkdownLinkExtractorMiddleware();
    const markdownContent = `
Visit <https://example.com/autolink> for more info.
`;
    const context = createMockContext(markdownContent, "https://example.com/");
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware.process(context, next);

    expect(next).toHaveBeenCalledOnce();
    expect(context.links).toContain("https://example.com/autolink");
  });

  it("should deduplicate extracted links", async () => {
    const middleware = new MarkdownLinkExtractorMiddleware();
    const markdownContent = `
[link1](https://example.com/page) and [link2](https://example.com/page)
`;
    const context = createMockContext(markdownContent, "https://example.com/");
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware.process(context, next);

    expect(next).toHaveBeenCalledOnce();
    expect(context.links).toEqual(["https://example.com/page"]);
    expect(context.links.length).toBe(1);
  });
});
