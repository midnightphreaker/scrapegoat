## Responsibility

The splitter module breaks documents (markdown, HTML, JSON, plain text, and source code) into semantically meaningful chunks sized for embedding. It distinguishes content types (text, code, tables, lists, headings, frontmatter) and preserves structural boundaries so that related content stays together. The module provides a `DocumentSplitter` interface with multiple implementations that can be composed: `SemanticMarkdownSplitter` for markdown/HTML, `JsonDocumentSplitter` for JSON, `TreesitterSourceCodeSplitter` for source code, and `TextDocumentSplitter` as a plain-text fallback. A `GreedySplitter` decorator concatenates small chunks from any base splitter into optimally sized units.

## Design

**Core types** (`types.ts`):
- `Chunk` — final output: `content` string, `types` (e.g. `["code", "structural"]`), and `section` (heading `level` + `path[]`)
- `SectionContentType` — union: `"text" | "code" | "table" | "heading" | "structural" | "frontmatter" | "list" | "blockquote" | "media"`
- `SplitterConfig` — size thresholds (`minChunkSize`, `preferredChunkSize`, `maxChunkSize`) plus optional JSON and tree-sitter settings
- `DocumentSplitter` — interface with `splitText(markdown: string, contentType?: string): Promise<Chunk[]>`

**Errors** (`errors.ts`):
- `SplitterError` — base class
- `MinimumChunkSizeError` — content cannot be split further within the size limit
- `ContentSplitterError` — generic splitting failure

**Document splitters** (top-level):
- `SemanticMarkdownSplitter` — converts markdown → HTML via unified/remark, parses DOM into `DocumentSection`s by heading level and element type, then delegates to content-type-specific splitters. Handles frontmatter via `gray-matter`.
- `JsonDocumentSplitter` — recursively walks parsed JSON structures (objects, arrays, primitives) emitting one chunk per structural element. Falls back to `TextDocumentSplitter` when `maxChunks` or `maxDepth` is exceeded.
- `TextDocumentSplitter` — thin wrapper around `TextContentSplitter`; emits `["text"]` chunks at root level. Falls back to character-based splitting on `MinimumChunkSizeError`.
- `GreedySplitter` — decorator that wraps any `DocumentSplitter`. Greedily concatenates adjacent small chunks while respecting `maxChunkSize` hard limit and major section boundaries (H1/H2). Merges section metadata (path, level, types) across combined chunks.
- `TreesitterSourceCodeSplitter` — tree-sitter based source code splitter. Looks up a `LanguageParser` by content type, extracts `CodeBoundary`s, builds a hierarchy, and converts boundaries to chunks via line-segmentation. Falls back to `TextContentSplitter` for unsupported languages or parse errors.

**Content-type splitters** (`splitters/`):
- `ContentSplitter` interface — `split(content: string): Promise<string[]>`
- `ContentSplitterOptions` — `{ chunkSize: number }`
- `TextContentSplitter` — hierarchical: paragraphs → lines → word boundaries (LangChain `RecursiveCharacterTextSplitter`). Preserves fenced code block balance (`fenceState.ts`).
- `CodeContentSplitter` — splits fenced code blocks by lines, re-wrapping each chunk with the original info string (e.g. language + metadata).
- `TableContentSplitter` — parses markdown tables into headers + rows; splits row groups while repeating the header/separator in each chunk.
- `ListContentSplitter` — splits by list item boundaries (`-`, `*`, `1.`); falls back to `TextContentSplitter` for oversized items.
- `fenceState.ts` — tracks fenced code block regions (backtick/tilde) using CommonMark semantics. Exports `hasOpenFenceAtEnd()`, `isOpenAt()`, `nextSafeOffset()`.

**Tree-sitter subsystem** (`treesitter/`):
- `LanguageParserRegistry` — maps file extensions and MIME types to `LanguageParser` instances. Currently registers `TypeScriptParser` (handles .ts/.tsx/.js/.jsx) with a `javascript` alias, and `PythonParser` (.py/.pyi/.pyw).
- `LanguageParser` interface (`parsers/types.ts`) — `parse()`, `extractBoundaries()`, `extractStructuralNodes()`, `getNodeText()`, `getNodeLines()`.
- `CodeBoundary` — structural or content boundary with `startLine`/`endLine`, `startByte`/`endByte`, optional `parent`/`path`/`level` for hierarchy.
- `TypeScriptParser` — unified parser for TS/JS family. Detects TSX heuristically. Extracts boundaries for classes, interfaces, enums, functions, methods, arrow functions, imports/exports. Suppresses local helpers (nested functions inside function bodies). Includes preceding JSDoc/comments in boundary start.
- `PythonParser` — handles functions, async functions, classes, imports. Suppresses local helpers nested inside functions. Handles Python `#` comments as preceding documentation.
- `languageTypes.ts` — shared `TreeSitterLanguage` interface for grammar package type safety.

**Barrel export** (`index.ts`) re-exports all public classes and errors.

## Flow

1. Caller constructs a `DocumentSplitter` appropriate for the content type (markdown, JSON, source code, or plain text), optionally wrapped in `GreedySplitter` for size optimization.
2. `splitText()` receives raw content and an optional content type hint.
3. **Markdown path**: `SemanticMarkdownSplitter` strips frontmatter, converts markdown to HTML via remark, parses the DOM, splits into `DocumentSection`s by headings and block-level elements, then delegates each section's content to the appropriate `ContentSplitter` (text, code, table, list).
4. **JSON path**: `JsonDocumentSplitter` parses JSON, recursively walks the structure creating chunks for opening/closing braces, individual properties, and nested values. Falls back to `TextDocumentSplitter` if chunk count or depth limits are exceeded.
5. **Source code path**: `TreesitterSourceCodeSplitter` looks up a `LanguageParser` via `LanguageParserRegistry`, parses the source into a tree-sitter AST, extracts `CodeBoundary`s, builds a parent-child hierarchy, segments the source into line ranges between boundaries, and converts segments to chunks.
6. **Plain text path**: `TextDocumentSplitter` delegates to `TextContentSplitter` which tries paragraph → line → word splitting with fence-balance preservation.
7. `GreedySplitter` (when used) concatenates small chunks from any base splitter, respecting hard size limits and major section boundaries (H1/H2).
8. Final `Chunk[]` is returned with content, type tags, and section metadata (level + path).

## Integration

- **Consumed by**: Pipeline modules that prepare documents for embedding (e.g. `src/pipeline/`), CLI/web routes that handle document ingestion
- **Depends on**:
  - `@langchain/textsplitters` — `RecursiveCharacterTextSplitter` for word-level text splitting
  - `tree-sitter`, `tree-sitter-typescript`, `tree-sitter-python` — AST-based source code parsing
  - `gray-matter` — frontmatter extraction
  - `remark-parse`, `remark-gfm`, `remark-html`, `unified` — markdown to HTML conversion
  - `turndown` — HTML to markdown conversion (for DOM element extraction)
  - `src/utils/` — `logger`, `fullTrim` (string util), `createJSDOM` (DOM polyfill), `config` defaults
