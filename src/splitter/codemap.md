# src/splitter/

## Responsibility
Splits documents (markdown, JSON, text, source code) into semantically meaningful chunks with hierarchical section metadata for embedding and storage.

## Design
- **Strategy pattern**: `DocumentSplitter` interface with multiple implementations selected by content type
- **Decorator pattern**: `GreedySplitter` wraps a base splitter to merge small chunks into optimally-sized units
- **Pipeline**: Content-type detection → specialized splitting → greedy merging → final `Chunk[]` output
- **Key types**: `Chunk` (content + section path/level + types), `SplitterConfig` (size constraints), `SectionContentType` enum

**Splitters:**
- `SemanticMarkdownSplitter` — markdown/HTML via remark → DOM → sections by heading/code/table/list/blockquote → per-type sub-splitters
- `JsonDocumentSplitter` — recursive JSON decomposition into concatenable chunks (property/object/array boundaries), falls back to `TextDocumentSplitter` for oversized or deeply nested values
- `TextDocumentSplitter` — plain text fallback: hierarchical paragraph → line → word splitting via `TextContentSplitter`
- `GreedySplitter` — post-processor that merges tiny chunks respecting `min/preferred/maxChunkSize` and H1/H2 section boundaries

**Error hierarchy**: `SplitterError` → `MinimumChunkSizeError`, `ContentSplitterError`

## Flow
1. Raw content enters a pipeline-specific splitter based on MIME type
2. Splitter decomposes content into `Chunk[]` with section metadata (level, path, types)
3. `GreedySplitter` merges small chunks while preserving major section breaks
4. Resulting chunks are stored via `DocumentStore.addDocuments()`

## Integration
- Consumed by: `src/scraper/pipelines/` (all content pipelines)
- Depends on: `src/splitter/splitters/` (content-type sub-splitters), `src/splitter/treesitter/` (source code AST splitting), `src/utils/` (logger, config, DOM utilities), `remark-*` + `turndown` (markdown↔HTML), `gray-matter` (frontmatter), `@langchain/textsplitters` (fallback text splitting)
