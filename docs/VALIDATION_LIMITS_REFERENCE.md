# Validation Limits Quick Reference

## Form Field Length Limits

| Field | Limit | HTML Attribute | Constant |
|-------|-------|----------------|----------|
| URL | 2048 | `maxlength="2048"` | `VALIDATION_LIMITS.URL` |
| Library Name | 100 | `maxlength="100"` | `VALIDATION_LIMITS.LIBRARY` |
| Version | 50 | `maxlength="50"` | `VALIDATION_LIMITS.VERSION` |
| Include Patterns | 2000 | `maxlength="2000"` | `VALIDATION_LIMITS.PATTERNS` |
| Exclude Patterns | 2000 | `maxlength="2000"` | `VALIDATION_LIMITS.PATTERNS` |
| Header Name | 100 | `maxlength="100"` | `VALIDATION_LIMITS.HEADER_NAME` |
| Header Value | 500 | `maxlength="500"` | `VALIDATION_LIMITS.HEADER_VALUE` |

## Character Count Color Thresholds

| Usage | Color | Tailwind Class |
|-------|-------|----------------|
| < 90% | Gray | `text-stone-500 dark:text-stone-400` |
| 90-99% | Amber | `text-amber-500 dark:text-amber-400` |
| 100%+ | Red | `text-red-500 dark:text-red-400` |

## Warning Messages

| Threshold | Message |
|-----------|---------|
| 95% | "Approaching limit!" |
| 100% | "Limit reached!" |

## Implementation Checklist

### Frontend (ScrapeFormContent.tsx)
- [ ] Add `import { VALIDATION_LIMITS } from "../utils/validation"`
- [ ] Add `x-model` to url, library, version fields
- [ ] Add `maxlength` attributes to all text inputs
- [ ] Add `getCharColor()` and `getBorderClass()` to x-data
- [ ] Add character count displays
- [ ] Add warning messages at thresholds
- [ ] Add color changes based on usage

### Backend (Already Complete ✓)
- [x] Import validation utilities
- [x] Validate all fields before processing
- [x] Return 400 errors with specific messages
- [x] Add parseHeadersFromForm helper

### Testing
- [x] Unit tests for validation utilities
- [ ] Manual testing of form inputs
- [ ] Test backend validation with curl/Postman
- [ ] Verify error messages are clear

## Common Patterns

### Character Count Display
```tsx
<p
  class="text-xs"
  x-bind:class="getCharColor(fieldName.length, VALIDATION_LIMITS.FIELD)"
  x-text="`${fieldName.length} / ${VALIDATION_LIMITS.FIELD} characters`"
></p>
```

### Warning Message
```tsx
<p
  x-show="fieldName.length >= threshold"
  x-cloak
  class="text-xs text-amber-500 dark:text-amber-400"
>
  <span x-show="fieldName.length >= VALIDATION_LIMITS.FIELD">Limit reached!</span>
  <span x-show="fieldName.length < VALIDATION_LIMITS.FIELD && fieldName.length >= warningThreshold">Approaching limit!</span>
</p>
```

### Input with maxlength
```tsx
<input
  type="text"
  name="fieldName"
  id="fieldName"
  maxlength={String(VALIDATION_LIMITS.FIELD)}
  x-model="fieldName"
  // ... other props
/>
```

## Files Reference

- **Validation Utilities**: `/src/web/utils/validation.ts`
- **Validation Tests**: `/src/web/utils/validation.test.ts`
- **Backend Route**: `/src/web/routes/jobs/new.tsx`
- **Frontend Form**: `/src/web/components/ScrapeFormContent.tsx`
- **Implementation Guide**: `/docs/VALIDATION_IMPLEMENTATION.md`
- **This Summary**: `/docs/IMPLEMENTATION_SUMMARY_ISSUE_58.md`
