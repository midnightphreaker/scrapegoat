# src/store/assembly/strategies/

## Responsibility
Concrete content assembly strategies that determine which chunks to include in search results and how to join them, optimized for different content types.

## Design
Two strategies implementing `ContentAssemblyStrategy`:

**`HierarchicalAssemblyStrategy`** — for source code and JSON:
- Handles: source code MIME types, JSON MIME types
- Single match: finds nearest structural ancestor (class/interface/enum), walks to root, includes full subtree
- Multiple matches: finds common ancestor path, reconstructs minimal subtree containing all matches
- Gap-aware ancestor search: progressively shortens path when direct parent lookup fails
- Assembly: simple concatenation (relies on splitter concatenation guarantees)
- Fallback: parent + direct children when hierarchy walking fails

**`MarkdownAssemblyStrategy`** — for markdown, HTML, plain text (and unknown types):
- Handles: all non-structured MIME types; acts as default fallback
- Expands context broadly: parent chunk, preceding siblings, subsequent siblings, child chunks
- Assembly: chunks joined with `\n\n` separator

## Flow
1. `canHandle(mimeType)` — determines if strategy applies
2. `selectChunks(library, version, initialChunks, store)` — queries related chunks from store
3. `assembleContent(chunks)` — produces final content string

## Integration
- Consumed by: `src/store/assembly/ContentAssemblyStrategyFactory`
- Depends on: `src/store/DocumentStore` (parent/sibling/child/URL chunk queries), `src/utils/mimeTypeUtils.ts` (MIME type classification), `src/utils/config.ts`
