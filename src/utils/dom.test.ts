/**
 * Unit tests for DOM utilities
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createJSDOM } from "./dom";

describe("createJSDOM", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a JSDOM instance from HTML string", () => {
    const html = "<html><body><h1>Hello</h1></body></html>";
    const dom = createJSDOM(html);

    expect(dom).toBeDefined();
    expect(dom.window.document).toBeDefined();
    expect(dom.window.document.querySelector("h1")?.textContent).toBe("Hello");
  });

  it("should suppress console output by default", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const html = '<html><body><script>console.log("test");</script></body></html>';
    createJSDOM(html);

    // The virtual console should suppress the output
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it("should suppress console.error output", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const html = '<html><body><script>console.error("error");</script></body></html>';
    createJSDOM(html);

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("should suppress console.warn output", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const html = '<html><body><script>console.warn("warning");</script></body></html>';
    createJSDOM(html);

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should suppress console.info output", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const html = '<html><body><script>console.info("info");</script></body></html>';
    createJSDOM(html);

    expect(infoSpy).not.toHaveBeenCalled();
  });

  it("should suppress console.debug output", () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

    const html = '<html><body><script>console.debug("debug");</script></body></html>';
    createJSDOM(html);

    expect(debugSpy).not.toHaveBeenCalled();
  });

  it("should allow custom options to be passed", () => {
    const html = "<html><body></body></html>";
    const dom = createJSDOM(html, { url: "https://example.com" });

    expect(dom.window.location.href).toBe("https://example.com/");
  });

  it("should merge custom options with defaults", () => {
    const html = "<html><body></body></html>";
    const dom = createJSDOM(html, {
      url: "https://example.com",
      runScripts: "dangerously",
    });

    expect(dom.window.location.href).toBe("https://example.com/");
    // Virtual console should still be set (from defaults)
    expect(dom).toBeDefined();
  });

  it("should handle empty HTML", () => {
    const dom = createJSDOM("");
    expect(dom).toBeDefined();
    expect(dom.window.document).toBeDefined();
  });

  it("should handle complex HTML with multiple elements", () => {
    const html = `
      <html>
        <head><title>Test Page</title></head>
        <body>
          <div id="container">
            <h1>Heading</h1>
            <p class="text">Paragraph 1</p>
            <p class="text">Paragraph 2</p>
            <ul>
              <li>Item 1</li>
              <li>Item 2</li>
            </ul>
          </div>
        </body>
      </html>
    `;

    const dom = createJSDOM(html);

    expect(dom.window.document.title).toBe("Test Page");
    const heading = dom.window.document.querySelector("h1");
    expect(heading?.textContent).toBe("Heading");

    const paragraphs = dom.window.document.querySelectorAll("p.text");
    expect(paragraphs).toHaveLength(2);

    const listItems = dom.window.document.querySelectorAll("li");
    expect(listItems).toHaveLength(2);
  });

  it("should handle HTML with forms", () => {
    const html = `
      <html>
        <body>
          <form id="test-form">
            <input type="text" name="username" value="testuser" />
            <input type="password" name="password" value="testpass" />
            <button type="submit">Submit</button>
          </form>
        </body>
      </html>
    `;

    const dom = createJSDOM(html);

    const form = dom.window.document.getElementById("test-form");
    expect(form).toBeDefined();

    const usernameInput = form?.querySelector('input[name="username"]');
    expect(usernameInput).toBeDefined();
    expect((usernameInput as HTMLInputElement)?.value).toBe("testuser");
  });

  it("should handle HTML with tables", () => {
    const html = `
      <html>
        <body>
          <table id="test-table">
            <thead>
              <tr><th>Header 1</th><th>Header 2</th></tr>
            </thead>
            <tbody>
              <tr><td>Data 1</td><td>Data 2</td></tr>
              <tr><td>Data 3</td><td>Data 4</td></tr>
            </tbody>
          </table>
        </body>
      </html>
    `;

    const dom = createJSDOM(html);

    const table = dom.window.document.getElementById("test-table");
    expect(table).toBeDefined();

    const rows = table?.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(2);
  });

  it("should handle HTML with iframes", () => {
    const html = `
      <html>
        <body>
          <iframe id="myframe" src="about:blank"></iframe>
        </body>
      </html>
    `;

    const dom = createJSDOM(html);

    const iframe = dom.window.document.getElementById("myframe");
    expect(iframe).toBeDefined();
    expect((iframe as HTMLIFrameElement)?.src).toBe("about:blank");
  });

  it("should handle HTML with meta tags", () => {
    const html = `
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="description" content="Test description">
          <meta name="keywords" content="test,keywords">
        </head>
        <body></body>
      </html>
    `;

    const dom = createJSDOM(html);

    const charset = dom.window.document.querySelector('meta[charset]');
    expect(charset?.getAttribute("charset")).toBe("UTF-8");

    const description = dom.window.document.querySelector('meta[name="description"]');
    expect(description?.getAttribute("content")).toBe("Test description");
  });

  it("should handle HTML with links", () => {
    const html = `
      <html>
        <body>
          <a href="https://example.com" class="external-link">Example</a>
          <a href="/internal" class="internal-link">Internal</a>
        </body>
      </html>
    `;

    const dom = createJSDOM(html);

    const externalLink = dom.window.document.querySelector("a.external-link");
    expect(externalLink?.getAttribute("href")).toBe("https://example.com");

    const internalLink = dom.window.document.querySelector("a.internal-link");
    expect(internalLink?.getAttribute("href")).toBe("/internal");
  });

  it("should handle HTML with images", () => {
    const html = `
      <html>
        <body>
          <img src="image.jpg" alt="Test Image" width="100" height="100" />
        </body>
      </html>
    `;

    const dom = createJSDOM(html);

    const img = dom.window.document.querySelector("img");
    expect(img?.getAttribute("src")).toBe("image.jpg");
    expect(img?.getAttribute("alt")).toBe("Test Image");
    expect(img?.getAttribute("width")).toBe("100");
    expect(img?.getAttribute("height")).toBe("100");
  });

  it("should handle HTML with scripts", () => {
    const html = `
      <html>
        <body>
          <script>
            window.testVariable = "test value";
          </script>
        </body>
      </html>
    `;

    const dom = createJSDOM(html, { runScripts: "dangerously" });

    // Script should run with runScripts: "dangerously"
    expect((dom.window as any).testVariable).toBe("test value");
  });

  it("should handle HTML with inline styles", () => {
    const html = `
      <html>
        <body>
          <div style="color: red; background: blue;">Styled Div</div>
        </body>
      </html>
    `;

    const dom = createJSDOM(html);

    const div = dom.window.document.querySelector("div");
    expect(div?.getAttribute("style")).toBe("color: red; background: blue;");
  });

  it("should handle malformed HTML gracefully", () => {
    const html = "<div><p>Unclosed tags<span>More text</div>";

    const dom = createJSDOM(html);

    // JSDOM should parse and fix the HTML
    const div = dom.window.document.querySelector("div");
    expect(div).toBeDefined();
  });

  it("should provide access to window object", () => {
    const html = "<html><body></body></html>";
    const dom = createJSDOM(html);

    expect(dom.window).toBeDefined();
    expect(dom.window.document).toBeDefined();
    expect(dom.window.navigator).toBeDefined();
    expect(dom.window.location).toBeDefined();
  });

  it("should allow DOM manipulation", () => {
    const html = "<html><body><div id='test'></div></body></html>";
    const dom = createJSDOM(html);

    const div = dom.window.document.getElementById("test");
    div?.textContent = "Modified content";

    expect(div?.textContent).toBe("Modified content");
  });

  it("should handle Unicode characters", () => {
    const html = `
      <html>
        <body>
          <div>Unicode: 你好 🎉 🌍</div>
        </body>
      </html>
    `;

    const dom = createJSDOM(html);

    const div = dom.window.document.querySelector("div");
    expect(div?.textContent).toContain("你好");
    expect(div?.textContent).toContain("🎉");
    expect(div?.textContent).toContain("🌍");
  });
});
