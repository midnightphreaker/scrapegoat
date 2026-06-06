# src/splitter/splitters/

## Responsibility
Content-type-aware chunk splitting for text, code, tables, and lists within markdown documents.

## Design
- **Strategy pattern**: `ContentSplitter` interface (`split(content) → string[]`) with specialized implementations
- Each splitter respects a `chunkSize` limit and throws `MinimumChunkSizeError` when content can't be split further
- `TextContentSplitter` is the base/fallback; other splitters handle structural content types

**Splitters:**
- `TextContentSplitter` — hierarchical: paragraphs → lines → words (via LangChain). Preserves fenced code block balance using `fenceState` utilities
- `CodeContentSplitter` — splits fenced code blocks by lines, re-wrapping each chunk with language info string (supports VitePress/Shiki metadata)
- `TableContentSplitter` — parses markdown tables, splits by rows while repeating header+separator in each chunk
- `ListContentSplitter` — splits by list items (`-`, `*`, `1.`), merges small items, falls back to `TextContentSplitter` for oversized items

**Utilities:**
- `fenceState.ts` — CommonMark-aware fence tracking: `hasOpenFenceAtEnd()`, `isOpenAt()`, `nextSafeOffset()`. Prevents splitting inside fenced code blocks

## Flow
1. `SemanticMarkdownSplitter` dispatches each section to the appropriate `ContentSplitter` by content type
2. Splitter produces `string[]` chunks within size limits
3. Chunks are wrapped in `Chunk` objects with section metadata by the caller

## Integration
- Consumed by: `src/splitter/SemanticMarkdownSplitter`, `src/splitter/TextDocumentSplitter`, `src/splitter/JsonDocumentSplitter`, `src/splitter/treesitter/TreesitterSourceCodeSplitter`
- Depends on: `src/splitter/errors.ts` (`MinimumChunkSizeError`), `@langchain/textsplitters` (word-level fallback)
