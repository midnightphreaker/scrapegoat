# src/store/assembly/

## Responsibility
Content-type-aware assembly of search result chunks into coherent result strings, using strategy selection based on MIME type.

## Design
- **Strategy pattern**: `ContentAssemblyStrategy` interface with `canHandle()`, `selectChunks()`, `assembleContent()` methods
- **Factory**: `ContentAssemblyStrategyFactory` selects strategy by MIME type — `HierarchicalAssemblyStrategy` for source code/JSON, `MarkdownAssemblyStrategy` for everything else
- **Two-phase assembly**: chunk selection (which chunks to include) → content assembly (how to join them)

**Types:**
- `ContentAssemblyStrategy` — interface for strategy implementations
- `ContentAssemblyContext` — input context (initial chunks, MIME type, URL, score)
- `ChunkSelectionResult` — selection phase output with metadata

## Flow
1. `DocumentRetrieverService.search()` gets initial ranked chunks
2. Groups results by URL, clusters nearby chunks by sort_order distance
3. `createContentAssemblyStrategy(mimeType)` selects appropriate strategy
4. `strategy.selectChunks()` — expands context (parents, siblings, children, or structural subtrees)
5. `strategy.assembleContent()` — joins selected chunks (concatenation for code, `\n\n` join for markdown)

## Integration
- Consumed by: `src/store/DocumentRetrieverService`
- Depends on: `src/store/assembly/strategies/` (concrete strategies), `src/store/DocumentStore` (chunk queries), `src/store/types.ts`
