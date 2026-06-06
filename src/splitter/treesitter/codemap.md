# src/splitter/treesitter/

## Responsibility
Semantic source code splitting using tree-sitter AST parsing to produce structurally meaningful chunks from TypeScript, JavaScript, and Python files.

## Design
- **Registry pattern**: `LanguageParserRegistry` maps file extensions and MIME types to `LanguageParser` instances
- **Boundary extraction**: Parsers produce `CodeBoundary[]` (functions, classes, interfaces, enums, imports/exports) with hierarchical parent relationships
- **Chunk generation**: `TreesitterSourceCodeSplitter` converts boundaries into `Chunk[]` via line-segment decomposition — each line appears in exactly one chunk, preserving reconstructability

**Key classes:**
- `LanguageParserRegistry` — singleton registry with extension→parser and MIME→parser lookups. Creates a JavaScript alias pointing to the unified TypeScript parser
- `TreesitterSourceCodeSplitter` — `DocumentSplitter` implementation. Falls back to `TextContentSplitter` for unsupported languages or parse errors

**Suppression rules** (prevent noise):
- Local helper functions nested inside method bodies are suppressed
- `export_statement` wrappers are transparent — only their children emit boundaries
- Arrow functions inside `variable_declarator` are deduplicated
- Methods inside classes are emitted; deeper nesting is suppressed

## Flow
1. `splitText(content, contentType)` resolves parser from registry
2. Parser produces `CodeBoundary[]` via AST walk with suppression rules
3. Boundaries are linked into a hierarchy (parent→child)
4. Line segments between boundary points become chunks with path/level metadata
5. Oversized segments are further split via `TextContentSplitter`

## Integration
- Consumed by: `src/scraper/pipelines/` (source code content pipelines)
- Depends on: `src/splitter/treesitter/parsers/` (TypeScript, Python), `src/splitter/splitters/TextContentSplitter`, `src/splitter/types.ts`, `tree-sitter` + `tree-sitter-typescript` + `tree-sitter-python`
