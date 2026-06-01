# SPEC: Local Upload UI Fixes

## Status: DRAFT

## Problem Statement

The local documentation upload panel (Issue #12) is completely non-functional in the browser. While all 14 backend API tests pass, the frontend Alpine.js component (`localUpload`) is never loaded, making the entire upload panel a dead, static HTML fragment.

## Root Cause

`public/js/localUpload.js` (379 lines) contains the `Alpine.data("localUpload", ...)` component registration via `document.addEventListener("alpine:init", ...)`. However, this file is **never loaded** by any page:

- `Layout.tsx` only includes `/assets/main.js` (Vite bundle)
- `vite.config.web.ts` only bundles `src/web/main.client.ts`
- The upload page is served as a bare HTMX fragment (no Layout)
- No `<script>` tag anywhere references `/js/localUpload.js`

## Reported Issues → Root Cause Mapping

| # | Reported Issue | Root Cause |
|---|---------------|------------|
| 1 | No Virtual folder display | `createVirtualFolder()` undefined — no Alpine handler |
| 2 | Cannot verify documents added | `stagedFiles`/`tree`/`stats` never update — no Alpine state |
| 3 | UI doesn't match issue example | Static HTML renders but dynamic elements invisible |
| 4 | Add virtual folder does nothing | `x-on:click="createVirtualFolder()"` — no handler registered |
| 5 | Files/folders don't appear after upload | `handleFiles()` undefined — no upload occurs |
| 6 | Unlabelled blue button, always disabled | `x-text` not rendered (empty text), `x-bind:disabled` stuck |
| 7 | No close button | Cancel button hidden by `x-show="stagedFiles.length > 0"`, no back button |

## Requirements

### FR-1: Load localUpload.js Script
- **FR-1.1**: The `localUpload.js` Alpine component must be loaded and registered before Alpine starts
- **FR-1.2**: The component must work after HTMX swaps (already handled by `Alpine.initTree()` in main.client.ts)
- **FR-1.3**: Must not break existing page load performance

### FR-2: Close/Back Button
- **FR-2.1**: A close/back button must always be visible on the upload panel
- **FR-2.2**: Clicking it returns the user to the previous view (source selection modal or library detail)
- **FR-2.3**: Must work even when no files are staged

### FR-3: Submit Button Accessibility
- **FR-3.1**: The submit button must have visible text even if Alpine fails to load
- **FR-3.2**: The button label must clearly indicate its purpose ("Accept & Submit")

## Non-Goals

- Refactoring localUpload.js into the Vite bundle (separate future task)
- Changing the upload API or backend logic
- Adding new features beyond fixing the broken UI

## Acceptance Criteria

1. The localUpload.js script loads on every page (via Layout.tsx)
2. Alpine `localUpload` component initializes when the upload panel is shown
3. File upload via drag-drop, click, and folder selection works
4. Virtual folder creation works and displays in the import tree
5. The import tree shows after file upload with correct file/folder structure
6. The submit button shows "Accept & Submit" text and enables when files are staged
7. A close/back button is always visible on the upload panel
8. Commit flow works end-to-end (submit → pipeline job → toast notification)
9. Cancel flow works (clears state, returns to previous view)

## Affected Files

- `src/web/components/Layout.tsx` — Add script tag for localUpload.js
- `src/web/components/upload/LocalUploadPanel.tsx` — Add close button, fallback button text
