# src/scraper/pipelines/

## Responsibility
Routes raw fetched content to type-specific processing pipelines that transform, split, and structure content into searchable chunks.

## Design
- **ContentPipeline interface** (`types.ts`): `canProcess(mimeType, content?)` / `process(rawContent, options, fetcher?)` → `PipelineResult` (title, contentType, textContent, links, errors, chunks). `close()` for cleanup.
- **BasePipeline**: Abstract base with `executeMiddlewareStack()` — recursive dispatch of middleware chain with error collection.
- **PipelineFactory**: Static factory `createStandardPipelines(appConfig)` returns ordered array: `[JsonPipeline, SourceCodePipeline, DocumentPipeline, HtmlPipeline, MarkdownPipeline, TextPipeline]`. First match wins; TextPipeline is the universal fallback.
- **HtmlPipeline**: Conditionally prepends `HtmlPlaywrightMiddleware` based on `scrapeMode`. Standard stack: Cheerio parse → metadata → links → sanitize → normalize → Turndown. Splits via `SemanticMarkdownSplitter` + `GreedySplitter`. Charset resolution from HTTP headers + HTML meta tags.
- **MarkdownPipeline**: Metadata + link extraction middleware. Splits via `SemanticMarkdownSplitter` + `GreedySplitter`.
- **JsonPipeline**: Validates JSON, extracts metadata (title/name fields). Splits via `JsonDocumentSplitter` (structure-preserving, no greedy merge).
- **SourceCodePipeline**: Splits via `TreesitterSourceCodeSplitter` (AST-aware, no greedy merge to preserve hierarchy).
- **DocumentPipeline**: Handles PDF, Office, OpenDocument, RTF, EPUB, Jupyter notebooks via `@kreuzberg/node` extraction to Markdown. Resolves MIME type from URL when server sends `application/octet-stream`. Spreadsheets prefer table Markdown output. Size-limited. Splits via `SemanticMarkdownSplitter` + `GreedySplitter`.
- **TextPipeline**: Fallback. Binary detection via null-byte check + MIME type safelist. Splits via `TextDocumentSplitter` + `GreedySplitter`. No middleware.
- **Splitting strategy**: Two-phase: semantic structure splitter → `GreedySplitter` for size optimization (min/preferred/max chunk sizes). JSON and source code skip greedy phase to preserve structural hierarchy.

## Flow
1. Strategy fetches `RawContent`, iterates pipelines: `pipeline.canProcess(mimeType)`.
2. First matching pipeline: `pipeline.process(rawContent, options, fetcher)`.
3. Pipeline: converts buffer to string (charset-aware) → creates `MiddlewareContext` → executes middleware stack → splits processed content → returns `PipelineResult`.

## Integration
- Consumed by: `WebScraperStrategy`, `LocalFileStrategy`, `LocalImportStrategy` (all create pipelines via `PipelineFactory`)
- Depends on: `BasePipeline`, middleware module, splitter module (`GreedySplitter`, `SemanticMarkdownSplitter`, `JsonDocumentSplitter`, `TreesitterSourceCodeSplitter`, `TextDocumentSplitter`), `@kreuzberg/node`, `AppConfig`
