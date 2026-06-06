# src/splitter/treesitter/parsers/

## Responsibility
Language-specific tree-sitter parsers that extract semantic code boundaries (functions, classes, interfaces, imports) from source code ASTs.

## Design
- **`LanguageParser` interface** — uniform contract: `parse()`, `extractStructuralNodes()`, `extractBoundaries()`, `getNodeText()`, `getNodeLines()`
- **Two extraction modes**: legacy `extractStructuralNodes()` (flat `StructuralNode[]` for tests) and canonical `extractBoundaries()` (`CodeBoundary[]` with hierarchical parent links)
- **Boundary types**: `structural` (class, interface, enum, namespace, import/export) vs `content` (function, method, arrow function, variable declarator)
- **Size limit**: both parsers truncate input at `treeSitterSizeLimit` (~30K chars) to stay under tree-sitter's internal limits

**Parsers:**
- `TypeScriptParser` — unified parser for .ts/.tsx/.js/.jsx/.mjs/.cjs. Auto-detects TSX mode. Handles classes, interfaces, type aliases, enums, namespaces, functions, methods, constructors, arrow functions, variable declarators. Includes JSDoc/preceding comment documentation extraction
- `PythonParser` — handles .py/.pyi/.pyw. Supports `class_definition`, `function_definition`, `async_function_definition`, imports. Handles Python docstrings and `#` comment blocks

**Shared types:**
- `CodeBoundary` — start/end line+byte, type classification, hierarchical path, parent reference
- `StructuralNode` — legacy flat representation with type enum, modifiers, documentation
- `languageTypes.ts` — type-safe tree-sitter language object interface

## Flow
1. `parse(source)` → `ParseResult` (tree + error nodes)
2. `extractBoundaries(tree, source)` → `CodeBoundary[]` with deduplication
3. Caller builds hierarchy from parent references and converts to chunks

## Integration
- Consumed by: `src/splitter/treesitter/LanguageParserRegistry`, `src/splitter/treesitter/TreesitterSourceCodeSplitter`
- Depends on: `tree-sitter`, `tree-sitter-typescript`, `tree-sitter-python`, `src/utils/config`
