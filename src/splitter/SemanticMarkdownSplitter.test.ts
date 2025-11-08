import { describe, expect, it, vi } from "vitest";
import { SemanticMarkdownSplitter } from "./SemanticMarkdownSplitter";

vi.mock("../utils/logger");

describe("SemanticMarkdownSplitter", () => {
  it("should handle empty markdown", async () => {
    const splitter = new SemanticMarkdownSplitter(100, 5000);
    const result = await splitter.splitText("");
    expect(result).toEqual([]);
  });

  it("should handle markdown with no headings", async () => {
    const splitter = new SemanticMarkdownSplitter(100, 5000);
    const markdown = "This is some text without any headings.";
    const result = await splitter.splitText(markdown);

    expect(result).toEqual([
      {
        types: ["text"],
        content: "This is some text without any headings.",
        section: {
          level: 0,
          path: [],
        },
      },
    ]);
  });

  it("should correctly split on H1-H6 headings", async () => {
    const splitter = new SemanticMarkdownSplitter(100, 5000);
    const markdown = `
# Chapter 1
Some text in chapter 1.

## Section 1.1
More text in section 1.1.

### Subsection 1.1.1
Text in subsection.
This should stay with previous section.

#### H4 Heading
Some text after h4

##### H5 Heading
Some text after h5

###### H6 Heading
Some text after h6

## Section 1.2
Final text.

# Chapter 2
Text in chapter 2.
`;
    const result = await splitter.splitText(markdown);

    expect(result).toEqual([
      {
        types: ["heading"],
        content: "# Chapter 1",
        section: {
          level: 1,
          path: ["Chapter 1"],
        },
      },
      {
        types: ["text"],
        content: "Some text in chapter 1.",
        section: {
          level: 1,
          path: ["Chapter 1"],
        },
      },
      {
        types: ["heading"],
        content: "## Section 1.1",
        section: {
          level: 2,
          path: ["Chapter 1", "Section 1.1"],
        },
      },
      {
        types: ["text"],
        content: "More text in section 1.1.",
        section: {
          level: 2,
          path: ["Chapter 1", "Section 1.1"],
        },
      },
      {
        types: ["heading"],
        content: "### Subsection 1.1.1",
        section: {
          level: 3,
          path: ["Chapter 1", "Section 1.1", "Subsection 1.1.1"],
        },
      },
      {
        types: ["text"],
        content: "Text in subsection. This should stay with previous section.",
        section: {
          level: 3,
          path: ["Chapter 1", "Section 1.1", "Subsection 1.1.1"],
        },
      },
      {
        types: ["heading"],
        content: "#### H4 Heading",
        section: {
          level: 4,
          path: ["Chapter 1", "Section 1.1", "Subsection 1.1.1", "H4 Heading"],
        },
      },
      {
        types: ["text"],
        content: "Some text after h4",
        section: {
          level: 4,
          path: ["Chapter 1", "Section 1.1", "Subsection 1.1.1", "H4 Heading"],
        },
      },
      {
        types: ["heading"],
        content: "##### H5 Heading",
        section: {
          level: 5,
          path: [
            "Chapter 1",
            "Section 1.1",
            "Subsection 1.1.1",
            "H4 Heading",
            "H5 Heading",
          ],
        },
      },
      {
        types: ["text"],
        content: "Some text after h5",
        section: {
          level: 5,
          path: [
            "Chapter 1",
            "Section 1.1",
            "Subsection 1.1.1",
            "H4 Heading",
            "H5 Heading",
          ],
        },
      },
      {
        types: ["heading"],
        content: "###### H6 Heading",
        section: {
          level: 6,
          path: [
            "Chapter 1",
            "Section 1.1",
            "Subsection 1.1.1",
            "H4 Heading",
            "H5 Heading",
            "H6 Heading",
          ],
        },
      },
      {
        types: ["text"],
        content: "Some text after h6",
        section: {
          level: 6,
          path: [
            "Chapter 1",
            "Section 1.1",
            "Subsection 1.1.1",
            "H4 Heading",
            "H5 Heading",
            "H6 Heading",
          ],
        },
      },
      {
        types: ["heading"],
        content: "## Section 1.2",
        section: {
          level: 2,
          path: ["Chapter 1", "Section 1.2"],
        },
      },
      {
        types: ["text"],
        content: "Final text.",
        section: {
          level: 2,
          path: ["Chapter 1", "Section 1.2"],
        },
      },
      {
        types: ["heading"],
        content: "# Chapter 2",
        section: {
          level: 1,
          path: ["Chapter 2"],
        },
      },
      {
        types: ["text"],
        content: "Text in chapter 2.",
        section: {
          level: 1,
          path: ["Chapter 2"],
        },
      },
    ]);
  });

  it("should separate headings, text, code, and tables", async () => {
    const splitter = new SemanticMarkdownSplitter(100, 5000);
    const markdown = `
# Mixed Content Section

This is some text.
More text here.

\`\`\`javascript
// Some code in JavaScript
console.log('Hello');
\`\`\`

| Header 1 | Header 2 |
| -------- | -------- |
| Cell 1   | Cell 2   |
`;
    const result = await splitter.splitText(markdown);

    expect(result).toEqual([
      {
        types: ["heading"],
        content: "# Mixed Content Section",
        section: {
          level: 1,
          path: ["Mixed Content Section"],
        },
      },
      {
        types: ["text"],
        content: "This is some text. More text here.",
        section: {
          level: 1,
          path: ["Mixed Content Section"],
        },
      },
      {
        types: ["code"],
        content: "```javascript\n// Some code in JavaScript\nconsole.log('Hello');\n```",
        section: {
          level: 1,
          path: ["Mixed Content Section"],
        },
      },
      {
        types: ["table"],
        content: "| Header 1 | Header 2 |\n|---|---|\n| Cell 1 | Cell 2 |",
        section: {
          level: 1,
          path: ["Mixed Content Section"],
        },
      },
    ]);
  });

  it("should correctly split long tables while preserving headers", async () => {
    const splitter = new SemanticMarkdownSplitter(10, 100);

    // Create a table with many rows that will exceed chunkSize
    const tableRows = Array.from(
      { length: 20 },
      (_, i) => `| ${i + 1} | This is row ${i + 1} | ${(i + 1) * 100} |`,
    ).join("\n");

    const markdown = `
| ID | Description | Value |
|----|------------|-------|
${tableRows}
`;

    const result = await splitter.splitText(markdown);

    // Verify that we got multiple chunks
    expect(result.length).toBeGreaterThan(1);

    // Verify each chunk
    for (const chunk of result) {
      expect(chunk.types).toEqual(["table"]);
      // Each chunk should start with the header
      expect(chunk.content).toMatch(/^\| ID \| Description \| Value \|/);
      // Each chunk should have the header separator
      expect(chunk.content).toMatch(/\|---|---|---\|/);
      // Each chunk should have at least one data row
      expect(chunk.content.split("\n").length).toBeGreaterThan(2);
      // Each chunk should be valid markdown table format
      expect(chunk.content).toMatch(/^\|.*\|$/gm);
      // Each chunk should be within size limit
      expect(chunk.content.length).toBeLessThanOrEqual(100);
    }
  });

  it("should correctly split long code blocks while preserving language", async () => {
    const splitter = new SemanticMarkdownSplitter(10, 100);

    // Create a long code block that will exceed chunkSize
    const codeLines = Array.from(
      { length: 20 },
      (_, i) =>
        `console.log("This is line ${i + 1} with some extra text to make it longer");`,
    ).join("\n");

    const markdown = `
\`\`\`javascript
${codeLines}
\`\`\`
`;

    const result = await splitter.splitText(markdown);

    // Verify that we got multiple chunks
    expect(result.length).toBeGreaterThan(1);

    // Verify each chunk
    for (const chunk of result) {
      expect(chunk.types).toEqual(["code"]);
      // Each chunk should start with the language identifier
      expect(chunk.content).toMatch(/^```javascript\n/);
      // Each chunk should end with closing backticks
      expect(chunk.content).toMatch(/\n```$/);
      // Each chunk should contain actual code
      expect(chunk.content).toMatch(/console\.log/);
      // Each chunk should be within size limit
      expect(chunk.content.length).toBeLessThanOrEqual(100);
    }
  });

  it("should handle tables that cannot be split semantically by using character-based splitting", async () => {
    const splitter = new SemanticMarkdownSplitter(20, 20);
    const markdown = `
| Header1 | Header2 |
|---------|---------|
| Cell1   | Cell2   |`;

    // Should not throw an error anymore
    const result = await splitter.splitText(markdown);

    // Verify we got chunks back
    expect(result.length).toBeGreaterThan(0);

    // Each chunk should be under the max size
    expect(result.every((chunk) => chunk.content.length <= 20)).toBe(true);
  });

  it("should handle code blocks that cannot be split semantically by using character-based splitting", async () => {
    const splitter = new SemanticMarkdownSplitter(20, 20);
    const markdown = "```javascript\nconst x = 1;\n```";

    // Should not throw an error anymore
    const result = await splitter.splitText(markdown);

    // Verify we got chunks back
    expect(result.length).toBeGreaterThan(0);

    // Each chunk should be under the max size
    expect(result.every((chunk) => chunk.content.length <= 20)).toBe(true);
  });

  it("should handle JSON code blocks in markdown properly", async () => {
    const markdown = `
# API Documentation

Here's an example API response:

\`\`\`json
{
  "name": "test-library",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.0.0",
    "lodash": "^4.17.21"
  }
}
\`\`\`

This JSON shows the package structure.
`;

    const splitter = new SemanticMarkdownSplitter(1000, 2000);
    const chunks = await splitter.splitText(markdown);

    expect(chunks).toHaveLength(4);

    // Should have heading chunk
    expect(chunks[0]).toEqual({
      types: ["heading"],
      content: "# API Documentation",
      section: {
        level: 1,
        path: ["API Documentation"],
      },
    });

    // Should have text chunk
    expect(chunks[1]).toEqual({
      types: ["text"],
      content: "Here's an example API response:",
      section: {
        level: 1,
        path: ["API Documentation"],
      },
    });

    // Should have JSON code block chunk with preserved formatting
    expect(chunks[2].types).toEqual(["code"]);
    expect(chunks[2].content).toMatch(/^```json\n/);
    expect(chunks[2].content).toMatch(/\n```$/);
    expect(chunks[2].content).toContain("test-library");
    expect(chunks[2].content).toContain("react");
    expect(chunks[2].section).toEqual({
      level: 1,
      path: ["API Documentation"],
    });

    // Should have final text chunk
    expect(chunks[3]).toEqual({
      types: ["text"],
      content: "This JSON shows the package structure.",
      section: {
        level: 1,
        path: ["API Documentation"],
      },
    });
  });

  it("should handle raw JSON as plain text in edge cases", async () => {
    // This simulates the edge case where JSON content somehow gets processed as markdown
    // In practice, this should be rare because JSON should be routed to JsonPipeline
    const rawJson = `{"name": "test", "version": "1.0.0"}`;

    const splitter = new SemanticMarkdownSplitter(1000, 2000);
    const chunks = await splitter.splitText(rawJson);

    // Should treat as plain text content
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain("test");
    expect(chunks[0].content).toContain("1.0.0");
    expect(chunks[0].section.path).toEqual([]);
    expect(chunks[0].types).toEqual(["text"]);
  });

  it("should handle invalid JSON as plain text", async () => {
    const invalidJson = `{
      "name": "test-library",
      "version": "1.0.0"
      // This comment makes it invalid JSON
      "invalid": true
    }`;

    const splitter = new SemanticMarkdownSplitter(1000, 2000);
    const chunks = await splitter.splitText(invalidJson);

    // Should treat as plain text content without structural splitting
    expect(chunks).toHaveLength(1);
    expect(chunks[0].section.path).toEqual([]);
  });

  it("should preserve content for non-JSON text", async () => {
    const textContent = `This is not JSON at all, just plain text content that should be preserved.`;

    const splitter = new SemanticMarkdownSplitter(1000, 2000);
    const chunks = await splitter.splitText(textContent);

    // Should preserve the content as-is in a single chunk
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain(textContent);
    expect(chunks[0].section.path).toEqual([]);
  });
});

describe("SemanticMarkdownSplitter - Wrapped Content Handling", () => {
  it("should handle content wrapped in single div", async () => {
    const splitter = new SemanticMarkdownSplitter(100, 5000);
    const markdown = `<div class="content">

# Heading 1

Text content under heading 1.

## Heading 2

More text under heading 2.

</div>`;

    const result = await splitter.splitText(markdown);

    // Should properly extract and chunk the content
    expect(result.length).toBeGreaterThan(3);

    // Verify headings are detected
    expect(result.some((chunk) => chunk.content.includes("# Heading 1"))).toBe(true);
    expect(result.some((chunk) => chunk.content.includes("## Heading 2"))).toBe(true);

    // Verify section paths are correct
    const heading1Chunks = result.filter((chunk) =>
      chunk.section.path.includes("Heading 1"),
    );
    expect(heading1Chunks.length).toBeGreaterThan(0);

    const heading2Chunks = result.filter((chunk) =>
      chunk.section.path.includes("Heading 2"),
    );
    expect(heading2Chunks.length).toBeGreaterThan(0);
  });

  it("should handle content wrapped in article", async () => {
    const splitter = new SemanticMarkdownSplitter(100, 5000);
    const markdown = `<article>

# Article Title

Introduction text for the article.

## Section 1

Details about section 1.

</article>`;

    const result = await splitter.splitText(markdown);

    expect(result.length).toBeGreaterThan(3);
    expect(result.some((chunk) => chunk.content.includes("# Article Title"))).toBe(true);
    expect(result.some((chunk) => chunk.content.includes("## Section 1"))).toBe(true);
  });

  it("should handle content wrapped in section", async () => {
    const splitter = new SemanticMarkdownSplitter(100, 5000);
    const markdown = `<section>

# Section Title

Content in section.

## Subsection

More content.

</section>`;

    const result = await splitter.splitText(markdown);

    expect(result.length).toBeGreaterThan(3);
    expect(result.some((chunk) => chunk.content.includes("# Section Title"))).toBe(true);
    expect(result.some((chunk) => chunk.content.includes("## Subsection"))).toBe(true);
  });

  it("should handle deeply nested wrappers", async () => {
    const splitter = new SemanticMarkdownSplitter(100, 5000);
    const markdown = `<div class="outer">
<article class="middle">
<section class="inner">

# Deep Heading

Text in deeply nested structure.

## Sub Heading

More nested text.

</section>
</article>
</div>`;

    const result = await splitter.splitText(markdown);

    // Should successfully extract content from deep nesting
    expect(result.length).toBeGreaterThan(3);
    expect(result.some((chunk) => chunk.content.includes("# Deep Heading"))).toBe(true);
    expect(result.some((chunk) => chunk.content.includes("## Sub Heading"))).toBe(true);

    // Verify section hierarchy is maintained
    const deepHeadingChunk = result.find((chunk) =>
      chunk.content.includes("# Deep Heading"),
    );
    expect(deepHeadingChunk?.section.path).toContain("Deep Heading");

    const subHeadingChunk = result.find((chunk) =>
      chunk.content.includes("## Sub Heading"),
    );
    expect(subHeadingChunk?.section.path).toContain("Sub Heading");
    expect(subHeadingChunk?.section.path).toContain("Deep Heading");
  });

  it("should handle mixed wrapped and unwrapped content", async () => {
    const splitter = new SemanticMarkdownSplitter(100, 5000);
    const markdown = `
# Top Level

Some unwrapped text.

<div class="wrapper">

## Wrapped Section

Text inside wrapper.

</div>

## Another Top Level

More unwrapped text.
`;

    const result = await splitter.splitText(markdown);

    expect(result.length).toBeGreaterThan(5);
    expect(result.some((chunk) => chunk.content.includes("# Top Level"))).toBe(true);
    expect(result.some((chunk) => chunk.content.includes("## Wrapped Section"))).toBe(
      true,
    );
    expect(result.some((chunk) => chunk.content.includes("## Another Top Level"))).toBe(
      true,
    );
  });

  it("should maintain backward compatibility with flat structure", async () => {
    const splitter = new SemanticMarkdownSplitter(100, 5000);
    const markdown = `
# Heading 1

Text content.

## Heading 2

More text.

### Heading 3

Even more text.
`;

    const result = await splitter.splitText(markdown);

    // Should work exactly as before for non-wrapped content
    expect(result.length).toBeGreaterThan(5);

    // Verify section paths
    const h1Chunks = result.filter((chunk) => chunk.section.path.includes("Heading 1"));
    expect(h1Chunks.length).toBeGreaterThan(0);

    const h2Chunks = result.filter((chunk) => chunk.section.path.includes("Heading 2"));
    expect(h2Chunks.length).toBeGreaterThan(0);

    const h3Chunks = result.filter((chunk) => chunk.section.path.includes("Heading 3"));
    expect(h3Chunks.length).toBeGreaterThan(0);

    // Verify hierarchical paths
    expect(h2Chunks[0].section.path).toEqual(["Heading 1", "Heading 2"]);
    expect(h3Chunks[0].section.path).toEqual(["Heading 1", "Heading 2", "Heading 3"]);
  });

  it("should handle wrapped code blocks", async () => {
    const splitter = new SemanticMarkdownSplitter(100, 5000);
    const markdown = `<div>

# Code Example

Here's some code:

\`\`\`javascript
function hello() {
  console.log("Hello, world!");
}
\`\`\`

</div>`;

    const result = await splitter.splitText(markdown);

    expect(result.length).toBeGreaterThan(2);
    expect(result.some((chunk) => chunk.types.includes("code"))).toBe(true);
    expect(result.some((chunk) => chunk.content.includes("function hello()"))).toBe(true);
  });

  it("should handle wrapped tables", async () => {
    const splitter = new SemanticMarkdownSplitter(100, 5000);
    const markdown = `<div>

# Table Example

Here's a table:

| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Data 2   |

</div>`;

    const result = await splitter.splitText(markdown);

    expect(result.length).toBeGreaterThan(2);
    expect(result.some((chunk) => chunk.types.includes("table"))).toBe(true);
    expect(result.some((chunk) => chunk.content.includes("Column 1"))).toBe(true);
  });

  it("should handle empty wrappers gracefully", async () => {
    const splitter = new SemanticMarkdownSplitter(100, 5000);
    const markdown = `
<div></div>

# Heading After Empty Wrapper

Content here.
`;

    const result = await splitter.splitText(markdown);

    expect(result.length).toBeGreaterThan(1);
    expect(
      result.some((chunk) => chunk.content.includes("# Heading After Empty Wrapper")),
    ).toBe(true);
  });

  it("should handle wrapper with only whitespace", async () => {
    const splitter = new SemanticMarkdownSplitter(100, 5000);
    const markdown = `
<div>


</div>

# Heading After Whitespace Wrapper

Content here.
`;

    const result = await splitter.splitText(markdown);

    expect(
      result.some((chunk) =>
        chunk.content.includes("# Heading After Whitespace Wrapper"),
      ),
    ).toBe(true);
  });

  it("should handle Ansible-style documentation structure", async () => {
    // This simulates the actual structure that was causing the Ansible docs issue
    const splitter = new SemanticMarkdownSplitter(500, 5000);
    const markdown = `<div class="content">

# Ansible Automation Platform Installation Guide

This guide covers the installation process for Ansible Automation Platform.

## Chapter 1: Prerequisites

Before installing Ansible Automation Platform, ensure you have the following.

### 1.1 System Requirements

The following requirements must be met:

- Red Hat Enterprise Linux 8 or later
- 4 GB RAM minimum
- 20 GB disk space

### 1.2 Network Requirements

Ensure proper network configuration.

## Chapter 2: Installation

Follow these steps to install Ansible Automation Platform.

### 2.1 Download

Download the installer from Red Hat Customer Portal.

### 2.2 Installation Steps

Run the installation script with the following command:

\`\`\`bash
./install.sh --inventory inventory.yml
\`\`\`

## Chapter 3: Verification

Verify the installation was successful.

</div>`;

    const result = await splitter.splitText(markdown);

    // Should produce many chunks, not just 1
    expect(result.length).toBeGreaterThan(10);

    // Verify all heading levels are detected
    expect(
      result.some((chunk) => chunk.content.includes("# Ansible Automation Platform")),
    ).toBe(true);
    expect(result.some((chunk) => chunk.content.includes("## Chapter 1"))).toBe(true);
    expect(
      result.some((chunk) => chunk.content.includes("### 1.1 System Requirements")),
    ).toBe(true);
    expect(result.some((chunk) => chunk.content.includes("## Chapter 2"))).toBe(true);
    expect(result.some((chunk) => chunk.content.includes("## Chapter 3"))).toBe(true);

    // Verify code block is detected
    expect(result.some((chunk) => chunk.types.includes("code"))).toBe(true);

    // Verify hierarchical section paths
    const systemReqChunk = result.find((chunk) =>
      chunk.content.includes("### 1.1 System Requirements"),
    );
    expect(systemReqChunk?.section.path).toContain("Chapter 1: Prerequisites");
    expect(systemReqChunk?.section.path).toContain("1.1 System Requirements");
  });

  it("should handle multiple wrapper types in same document", async () => {
    const splitter = new SemanticMarkdownSplitter(100, 5000);
    const markdown = `
<main>

# Main Content

<article>

## Article Section

<div>

### Div Section

Content in div.

</div>

</article>

<aside>

## Sidebar Content

Sidebar text.

</aside>

</main>
`;

    const result = await splitter.splitText(markdown);

    expect(result.length).toBeGreaterThan(5);
    expect(result.some((chunk) => chunk.content.includes("# Main Content"))).toBe(true);
    expect(result.some((chunk) => chunk.content.includes("## Article Section"))).toBe(
      true,
    );
    expect(result.some((chunk) => chunk.content.includes("### Div Section"))).toBe(true);
    expect(result.some((chunk) => chunk.content.includes("## Sidebar Content"))).toBe(
      true,
    );
  });
});
