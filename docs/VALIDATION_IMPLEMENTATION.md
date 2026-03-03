# HTML5 Max Length Validation Implementation

## Overview

This document describes the implementation of HTML5 max length validation constraints for form inputs as described in Issue #58.

## Changes Made

### 1. Validation Constants (`src/web/utils/validation.ts`)

Created a new file containing validation limits and helper functions:

```typescript
export const VALIDATION_LIMITS = {
  URL: 2048,           // Standard browser limit
  LIBRARY: 100,        // Reasonable identifier length
  VERSION: 50,         // Semver format with metadata
  PATTERNS: 2000,      // Include/exclude patterns
  HEADER_NAME: 100,    // HTTP header name
  HEADER_VALUE: 500,   // HTTP header value
} as const;
```

### 2. Backend Validation (`src/web/routes/jobs/new.tsx`)

Updated the POST handler to validate field lengths before processing:

- Added `validateFormFields` import from `../utils/validation`
- Added length validation before calling `scrapeTool.execute`
- Returns 400 status with specific error message if limits exceeded
- Added `parseHeadersFromForm` helper for header validation

### 3. Frontend Validation (TODO: Manual Update Required)

The following changes need to be made to `src/web/components/ScrapeFormContent.tsx`:

#### Step 1: Add Import

```typescript
import { VALIDATION_LIMITS } from "../utils/validation";
```

#### Step 2: Update AlpineJS x-data

Add these helper functions to the x-data object:

```javascript
x-data="{
  url: '',
  library: '',
  version: '',
  includePatterns: '',
  excludePatterns: '',
  // ... existing properties ...

  getCharColor(current, max) {
    const ratio = current / max;
    if (ratio >= 1) return 'text-red-500 dark:text-red-400';
    if (ratio >= 0.9) return 'text-amber-500 dark:text-amber-400';
    return 'text-stone-500 dark:text-stone-400';
  },
  getBorderClass(current, max) {
    const ratio = current / max;
    if (ratio >= 1) return 'border-red-500 dark:border-red-400';
    if (ratio >= 0.9) return 'border-amber-500 dark:border-amber-400';
    return 'border-stone-300 dark:border-stone-600';
  }
}"
```

#### Step 3: Add maxlength to URL Input

```tsx
<input
  type="url"
  name="url"
  id="url"
  maxlength={String(VALIDATION_LIMITS.URL)}  // ADD THIS
  required
  x-model="url"
  // ... rest of props
/>
```

#### Step 4: Add URL Character Count

Add after the URL input:

```tsx
<div class="mt-1 flex justify-between items-center">
  <p
    class="text-xs"
    x-bind:class="getCharColor(url.length, VALIDATION_LIMITS.URL)"
    x-text="`${url.length} / ${VALIDATION_LIMITS.URL} characters`"
  ></p>
  <p
    x-show="url.length >= 1843"
    x-cloak
    class="text-xs text-amber-500 dark:text-amber-400"
  >
    <span x-show="url.length >= VALIDATION_LIMITS.URL">Limit reached!</span>
    <span x-show="url.length < VALIDATION_LIMITS.URL && url.length >= 1948">Approaching limit!</span>
  </p>
</div>
```

#### Step 5: Update Library Name Input

```tsx
<input
  type="text"
  name="library"
  id="library"
  maxlength={String(VALIDATION_LIMITS.LIBRARY)}  // ADD THIS
  required
  x-model="library"  // ADD THIS
  // ... rest of props
/>

<!-- ADD CHARACTER COUNT -->
<div class="mt-1 flex justify-between items-center">
  <p
    class="text-xs"
    x-bind:class="getCharColor(library.length, VALIDATION_LIMITS.LIBRARY)"
    x-text="`${library.length} / ${VALIDATION_LIMITS.LIBRARY} characters`"
  ></p>
</div>
```

#### Step 6: Update Version Input

```tsx
<input
  type="text"
  name="version"
  id="version"
  maxlength={String(VALIDATION_LIMITS.VERSION)}  // ADD THIS
  x-model="version"  // ADD THIS
  // ... rest of props
/>

<!-- ADD CHARACTER COUNT -->
<div class="mt-1">
  <p
    class="text-xs"
    x-bind:class="getCharColor(version.length, VALIDATION_LIMITS.VERSION)"
    x-text="`${version.length} / ${VALIDATION_LIMITS.VERSION} characters`"
  ></p>
</div>
```

#### Step 7: Update Include Patterns Textarea

```tsx
<textarea
  name="includePatterns"
  id="includePatterns"
  maxlength={String(VALIDATION_LIMITS.PATTERNS)}  // ADD THIS
  x-model="includePatterns"  // ADD THIS
  // ... rest of props
></textarea>

<!-- ADD CHARACTER COUNT -->
<div class="mt-1 flex justify-between items-center">
  <p
    class="text-xs"
    x-bind:class="getCharColor(includePatterns.length, VALIDATION_LIMITS.PATTERNS)"
    x-text="`${includePatterns.length} / ${VALIDATION_LIMITS.PATTERNS} characters`"
  ></p>
  <p
    x-show="includePatterns.length >= 1800"
    x-cloak
    class="text-xs"
    x-bind:class="includePatterns.length >= VALIDATION_LIMITS.PATTERNS ? 'text-red-500 dark:text-red-400' : 'text-amber-500 dark:text-amber-400'"
  >
    <span x-show="includePatterns.length >= VALIDATION_LIMITS.PATTERNS">Limit reached!</span>
    <span x-show="includePatterns.length < VALIDATION_LIMITS.PATTERNS && includePatterns.length >= 1900">Approaching limit!</span>
  </p>
</div>
```

#### Step 8: Update Exclude Patterns Textarea

```tsx
<textarea
  name="excludePatterns"
  id="excludePatterns"
  maxlength={String(VALIDATION_LIMITS.PATTERNS)}  // ADD THIS
  x-model="excludePatterns"  // ADD THIS
  // ... rest of props
>
  {defaultExcludePatternsText}
</textarea>

<!-- ADD CHARACTER COUNT -->
<div class="mt-1 flex justify-between items-center">
  <p
    class="text-xs"
    x-bind:class="getCharColor(excludePatterns.length, VALIDATION_LIMITS.PATTERNS)"
    x-text="`${excludePatterns.length} / ${VALIDATION_LIMITS.PATTERNS} characters`"
  ></p>
  <p
    x-show="excludePatterns.length >= 1800"
    x-cloak
    class="text-xs"
    x-bind:class="excludePatterns.length >= VALIDATION_LIMITS.PATTERNS ? 'text-red-500 dark:text-red-400' : 'text-amber-500 dark:text-amber-400'"
  >
    <span x-show="excludePatterns.length >= VALIDATION_LIMITS.PATTERNS">Limit reached!</span>
    <span x-show="excludePatterns.length < VALIDATION_LIMITS.PATTERNS && excludePatterns.length >= 1900">Approaching limit!</span>
  </p>
</div>
```

#### Step 9: Update Custom Header Inputs

Update the header name and value inputs in the template:

```tsx
<input
  type="text"
  maxlength={String(VALIDATION_LIMITS.HEADER_NAME)}  // ADD THIS
  class="w-full px-3 py-2 border rounded-xl bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm transition-colors duration-150"
  placeholder="Header Name"
  x-model="header.name"
  x-bind:disabled="submitting"
  required
/>
<!-- ADD CHARACTER COUNT -->
<p
  class="text-xs mt-1"
  x-bind:class="getCharColor(header.name.length, VALIDATION_LIMITS.HEADER_NAME)"
  x-text="header.name.length + ' / ' + VALIDATION_LIMITS.HEADER_NAME"
></p>
```

And for the value input:

```tsx
<input
  type="text"
  maxlength={String(VALIDATION_LIMITS.HEADER_VALUE)}  // ADD THIS
  class="w-full px-3 py-2 border rounded-xl bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm transition-colors duration-150"
  placeholder="Header Value"
  x-model="header.value"
  x-bind:disabled="submitting"
  required
/>
<!-- ADD CHARACTER COUNT -->
<p
  class="text-xs mt-1"
  x-bind:class="getCharColor(header.value.length, VALIDATION_LIMITS.HEADER_VALUE)"
  x-text="header.value.length + ' / ' + VALIDATION_LIMITS.HEADER_VALUE"
></p>
```

## Validation Flow

1. **Frontend (Alpine.js)**:
   - `maxlength` attributes prevent typing beyond limit
   - Character count shows current usage
   - Color changes when approaching/exceeding limit
   - Visual feedback (amber at 90%, red at 100%)

2. **Backend (Fastify)**:
   - `validateFormFields()` checks all lengths before processing
   - Returns 400 error with specific message if exceeded
   - Includes current length vs limit in error message

## Testing

To test the validation:

1. Try entering text beyond limits (should be blocked by maxlength)
2. Check character counts update in real-time
3. Submit with values at or near limits
4. Try to bypass frontend validation (curl, Postman, etc.)
5. Verify backend validation catches and rejects oversized values

## Summary

This implementation provides:
- HTML5 native validation via `maxlength` attributes
- Real-time character count display
- Visual feedback when approaching limits
- Backend validation as defense-in-depth
- Clear error messages indicating which field exceeded limits

All validation limits are centralized in `VALIDATION_LIMITS` constant for easy maintenance.
