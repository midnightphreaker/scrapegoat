# DESIGN: Local Upload UI Fixes

## Status: DRAFT

## Architecture

### Script Loading Strategy

**Decision: Add `<script>` tag to Layout.tsx (before main.js module)**

```
Layout.tsx loading order:
1. <script src="/js/localUpload.js"></script>     ← NEW: registers alpine:init listener
2. <script type="module" src="/assets/main.js">    ← EXISTING: Alpine.start() fires alpine:init
```

**Why this works:**
- Regular `<script>` executes synchronously before `<script type="module">` (modules are deferred)
- `localUpload.js` registers `alpine:init` listener synchronously
- When `main.js` module executes, `Alpine.start()` fires `alpine:init`
- The `localUpload` data component is registered before any DOM processing
- When HTMX swaps in the upload panel, `Alpine.initTree()` (main.client.ts:263) processes it

**Why not bundle into Vite:**
- `localUpload.js` is plain JS, not TypeScript
- Would require converting 379 lines to TS or configuring Vite to allow JS imports
- Simpler to add a script tag; refactoring into the bundle is a separate cleanup task

### Close Button Design

Add a close/back button in the upload panel header that:
- Always shows (not conditional on Alpine state)
- Uses HTMX to navigate back: `hx-get="/web/jobs/source-selection"` with `hx-target="#modal-container"`
- Styled as a secondary "X" or "Close" button in the header

### Submit Button Fix

Add static fallback text between the button tags:
```html
<button x-text="committing ? 'Importing...' : 'Accept & Submit'">Accept & Submit</button>
```
- Alpine's `x-text` replaces content when active
- Static text shows as fallback when Alpine isn't running
- Serves as progressive enhancement

## Component Changes

### Layout.tsx
- Add `<script src="/js/localUpload.js"></script>` BEFORE the main.js module script tag
- Position: just before the closing `</body>` tag, right above the existing main.js script

### LocalUploadPanel.tsx
- Add close button to the panel header (right-aligned, "X" icon or "Close" text)
- Add fallback text "Accept & Submit" between submit button tags
- The cancel button already exists but is hidden when no files staged — keep as-is

## Risks

| Risk | Mitigation |
|------|-----------|
| Script loads on every page (unnecessary) | The registration is lightweight; only fires `alpine:init` listener. Acceptable until Vite migration |
| HTMX script execution | HTMX doesn't execute `<script>` tags in swapped content — but we're loading in Layout, not in the fragment |
| Timing: `alpine:init` already fired | Not possible: regular scripts execute before modules, and `Alpine.start()` is in the module |

## Affected Files

| File | Change |
|------|--------|
| `src/web/components/Layout.tsx` | Add 1 line: `<script>` tag for localUpload.js |
| `src/web/components/upload/LocalUploadPanel.tsx` | Add close button, add fallback text to submit button |
