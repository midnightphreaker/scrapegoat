# Agent05 Review — Fix 6 UI Spec Gaps in ScrapeGoat Local Documentation Feature

**Date**: 2026-06-03  
**Agent**: agent05  
**Scope**: Source Selection Modal, Local Upload Panel, client-side upload logic  
**Verification**: All fixes passed `npm run lint && npm run typecheck && npm run build && npx vitest run src/web/`

---

## Gap #1: Source Selection Must Be a True Centered Modal

**Problem**: `SourceSelectionModal.tsx` rendered an inline card that HTMX-swapped into `#addJobForm`. It was NOT a modal — just a card replacing content, with no backdrop, no centering, no keyboard escape, and no click-outside dismissal.

**Files modified**:
- `src/web/components/Layout.tsx` — Added `#modal-container` div after `<main>` to serve as the HTMX swap target for modals
- `src/web/components/AddJobButton.tsx` — Changed `hx-target` from `#addJobForm` to `#modal-container`
- `src/web/components/SourceSelectionModal.tsx` — Complete overhaul:
  - Outer wrapper: `fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm`
  - `role="dialog"`, `aria-modal="true"`, `aria-labelledby="modal-title"`, `tabindex="-1"` for keyboard accessibility
  - `x-on:keydown.escape` and `x-on:click.self` (via spread props) to close on Escape or clicking outside
  - Close button changed from `float-right` to `absolute top-3 right-3`
  - Cards clear the modal on selection via `htmx:afterSwap: document.getElementById('modal-container').innerHTML = '';`

**Verification**: ✅ Build passes, lint clean, typecheck clean, tests pass.

---

## Gap #2: File Picker Must Not Restrict by Extension

**Problem**: The file input had `accept=".md,.markdown,.txt,.zip,.tar,.tar.gz,.tgz,.tar.bz2"`, which excluded PDF, Word, Excel, HTML, source code, JSON, YAML, and other ingestible formats.

**Fix**: In `src/web/components/upload/LocalUploadPanel.tsx`, removed the `accept` attribute entirely from the file input. The backend parser system validates files regardless of extension.

**Verification**: ✅ Build passes, lint clean.

---

## Gap #3: Add Explicit "Add File" Button

**Problem**: Only "Add Folder" and "Add Virtual Folder" buttons existed. No explicit "Add File" button.

**Fix**: In `src/web/components/upload/LocalUploadPanel.tsx`, added an "Add File" button before the "Add Folder" button in the button row. It triggers `$refs.fileInput.click()` to open the hidden file input.

**Verification**: ✅ Build passes, lint clean.

---

## Gap #4: Confirmation Dialog Must Match Spec Copy

**Problem**: Confirmation in `commitImport()` was: "Submit this import tree? The current file/folder structure will define the retrieval source paths for all imported documents."

**Fix**: In `public/js/localUpload.js`, updated `commitImport()` to use the spec-mandated text:

```
This will ingest the selected files into a documentation library.

The file and folder layout currently shown in this window will be used as the source path layout for retrieval results.

Uploaded source files are temporary and will be removed after ingestion completes.

Continue?
```

**Verification**: ✅ Build passes, lint clean.

---

## Gap #5: Version Field Should Be Required

**Problem**: The version input had no `required` attribute and the Alpine.js component defaulted to `"latest"`, making it optional in practice.

**Fix**:
- In `src/web/components/upload/LocalUploadPanel.tsx`:
  - Added `required` attribute to version input
  - Added `placeholder="e.g., 1.0.0"`
  - Changed `x-data` default from `'${version || "latest"}'` to `'${version || ""}'`
- In `public/js/localUpload.js`:
  - Changed `version: version || "latest"` to `version: version || ""`

**Verification**: ✅ Build passes, lint clean.

---

## Gap #6: Drop Zone Hint Text Too Narrow

**Problem**: Hint text said `Markdown files, ZIP/TAR archives, or folders`, misleading users about parser support.

**Fix**: In `src/web/components/upload/LocalUploadPanel.tsx`, changed dropzone hint text to `Documents, archives, code files, or folders`.

**Verification**: ✅ Build passes, lint clean.

---

## Additional Fix: Close Panel Context Awareness

**Problem**: After the upload panel was closed on a library detail page (via `closePanel()`), it HTMX-swapped `AddJobButton` into `#addJobForm`, which doesn't exist on that page.

**Fix**: In `public/js/localUpload.js`, updated `closePanel()` to detect if the panel is inside `#add-version-form-container` and, if so, swap the `UploadVersionButton` back instead.

**Verification**: ✅ Build passes, lint clean.

---

## Final Verification

```
npm run lint        → 313 files checked, no fixes needed
npm run typecheck   → No errors
npm run build       → Client + SSR built successfully
npx vitest run src/web/ → 4 test files passed, 13 tests passed
```

**Result**: All 6 gaps addressed. Ready for merge.
