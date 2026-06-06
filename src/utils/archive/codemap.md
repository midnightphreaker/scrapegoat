# src/utils/archive/

## Responsibility
Provides a unified adapter interface for reading ZIP and TAR archive entries, used by the scraper to extract content from archived documentation files.

## Design
**ArchiveAdapter** (interface in `types.ts`) — common contract with `listEntries()` (async generator), `getContent(path)` → Buffer, `getStream(path)` → Readable, and `close()`.

**ArchiveFactory** — factory function `getArchiveAdapter(filePath)` that returns the correct adapter based on file extension (`.zip` → `ZipAdapter`, `.tar`/`.gz`/`.tgz` → `TarAdapter`, else `null`). Uses extension-based detection intentionally — magic bytes would falsely classify DOCX/XLSX/EPUB/ODT as archives.

**ZipAdapter** — wraps `yauzl` with lazy entry reading, entry caching via `Map<string, yauzl.Entry>`, and stream-based content extraction.

**TarAdapter** — wraps the `tar` module's `Parser` with async generator entry listing and stream-based content extraction. Normalizes path prefixes (`./`, leading `/`).

## Flow
1. Caller gets adapter via `getArchiveAdapter(filePath)`
2. `listEntries()` yields `ArchiveEntry` objects (path, type, size)
3. `getContent(path)` or `getStream(path)` retrieves specific file content
4. `close()` releases resources

## Integration
- Consumed by: `src/scraper/` (document pipeline for archive-based content sources)
- Depends on: `yauzl` (ZIP), `tar` (TAR/GZ), Node.js streams
