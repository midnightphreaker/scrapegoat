# Content Length Validation Implementation (Issue #41)

## Summary

Added validation for document content length before processing to prevent expensive operations (embedding generation, database writes) on oversized content.

## Changes Made

### 1. New Error Class and Constants (`src/store/errors.ts`)

Added three new exports:

- **`MAX_DOCUMENT_CONTENT_LENGTH`** (1MB): Maximum allowed size for a single document
- **`MAX_BATCH_CONTENT_LENGTH`** (10MB): Maximum allowed total size for a batch of documents
- **`DocumentValidationError`**: New error class for content size violations
- **`formatBytes()`**: Helper function to format byte counts into human-readable strings (e.g., "1.5MB")

#### `DocumentValidationError` Class

```typescript
export class DocumentValidationError extends StoreError {
  constructor(
    message: string,
    public readonly actualSize: number,
    public readonly maxSize: number,
    public readonly documentUrl?: string,
    public readonly documentCount?: number,
  )
}
```

**Error Message Includes:**
- Actual size and maximum allowed size (formatted)
- Document URL (if applicable)
- Batch size (for batch errors)
- Helpful fix suggestions:
  1. Split large documents into smaller chunks
  2. Process documents individually rather than in batches
  3. Filter out unnecessary content before processing
  4. Increase limits if appropriate for use case

### 2. Validation in DocumentManagementService (`src/store/DocumentManagementService.ts`)

Added validation in `addDocument()` method **before** expensive pipeline processing:

```typescript
// Validate document content length before expensive processing
const contentLength = document.pageContent.length;
if (contentLength > MAX_DOCUMENT_CONTENT_LENGTH) {
  throw new DocumentValidationError(
    "Document content exceeds maximum allowed size",
    contentLength,
    MAX_DOCUMENT_CONTENT_LENGTH,
    url,
  );
}
```

**Location:** After empty content check, before pipeline processing
**Benefit:** Catches oversized content early, preventing unnecessary processing

### 3. Validation in DocumentStore (`src/store/DocumentStore.ts`)

Added validation in `addDocuments()` method **before** expensive embedding generation:

```typescript
// Validate total batch content size before expensive processing
const totalBatchSize = documents.reduce(
  (sum, doc) => sum + doc.pageContent.length,
  0,
);
if (totalBatchSize > MAX_BATCH_CONTENT_LENGTH) {
  throw new DocumentValidationError(
    "Batch content exceeds maximum allowed size",
    totalBatchSize,
    MAX_BATCH_CONTENT_LENGTH,
    undefined,
    documents.length,
  );
}

// Validate individual documents (defense in depth)
for (const doc of documents) {
  const docSize = doc.pageContent.length;
  if (docSize > MAX_DOCUMENT_CONTENT_LENGTH) {
    const url = (doc.metadata as DocumentMetadata).url || "unknown";
    throw new DocumentValidationError(
      "Document content exceeds maximum allowed size",
      docSize,
      MAX_DOCUMENT_CONTENT_LENGTH,
      url,
    );
  }
}
```

**Location:** After empty check, before version resolution and embedding generation
**Benefit:** Prevents expensive embedding API calls and database operations on oversized content

### 4. Test Coverage (`src/store/DocumentValidation.test.ts`)

Added comprehensive test suite with 10 tests:

- **formatBytes** - Correctly formats bytes (B, KB, MB)
- **MAX_DOCUMENT_CONTENT_LENGTH** - Verified to be 1MB
- **MAX_BATCH_CONTENT_LENGTH** - Verified to be 10MB
- **DocumentValidationError** - Creates errors with proper properties and helpful messages
- **Practical scenarios**:
  - Rejects single document exceeding 1MB
  - Accepts single document within 1MB limit
  - Rejects batch exceeding 10MB total
  - Accepts batch within 10MB total

**All tests pass:**
```
✓ src/store/DocumentValidation.test.ts (10 tests) 31ms
```

## Design Decisions

### Limit Values

- **Single document: 1MB**
  - Reasonable for text documentation
  - Prevents excessive memory usage during processing
  - Aligns with common web content sizes

- **Batch: 10MB**
  - Allows ~10 average documents per batch
  - Prevents overwhelming system resources
  - Balances throughput with stability

### Validation Strategy

Following Issue #7's pattern for image buffer limits:
1. **Early validation** - Check before expensive operations
2. **Defense in depth** - Validate at multiple choke points
3. **Descriptive errors** - Include actual size, max limit, and helpful fixes
4. **Batch + individual checks** - Catch both oversized batches and individual documents

### Error Messages

Error messages provide actionable guidance:
- Clear indication of the problem (size exceeded)
- Exact sizes (actual vs. maximum)
- Context (URL, document count)
- Fix suggestions (split, filter, process individually)

## Impact

### Prevents Issues

1. **Memory exhaustion** from processing extremely large documents
2. **Wasted API calls** for embedding oversized content
3. **Database overload** from storing massive content
4. **Slow processing** from unnecessary operations

### Preserves Functionality

- Existing valid documents (< 1MB) work unchanged
- Normal batches (< 10MB) work unchanged
- No performance impact for valid content
- No breaking changes to API

## Testing

### Unit Tests
- New test file: `src/store/DocumentValidation.test.ts`
- 10 tests, all passing
- Covers error creation, formatting, and validation scenarios

### Integration Tests
- Existing test suite still passes (1180 tests)
- DocumentManagementService tests: 52 passing
- No regression in existing functionality

## Usage Example

### Before (No Validation)
```typescript
// Would process 5MB document, waste API calls, then fail
await docService.addDocument("library", "version", hugeDocument);
```

### After (Early Validation)
```typescript
try {
  await docService.addDocument("library", "version", hugeDocument);
} catch (error) {
  if (error instanceof DocumentValidationError) {
    console.error(error.message);
    // "Document validation failed: Document content exceeds maximum allowed size
    //  Actual size: 5.00MB
    //  Maximum allowed: 1.00MB
    //  Document URL: https://example.com/huge
    //  To fix this:
    //    1. Split large documents into smaller chunks..."
  }
}
```

## Files Modified

1. `src/store/errors.ts` - Added error class, constants, helper
2. `src/store/DocumentManagementService.ts` - Added validation in addDocument()
3. `src/store/DocumentStore.ts` - Added validation in addDocuments()

## Files Added

1. `src/store/DocumentValidation.test.ts` - Comprehensive test coverage

## Related Issues

- Follows pattern from Issue #7 (Image buffer size limits)
- Prevents issues similar to Issue #30 (embedding cache inefficiency)
- Improves system stability and resource management

## Future Enhancements

Potential improvements for consideration:
1. Configurable limits via environment variables
2. Per-library or per-version limit overrides
3. Metrics tracking for rejected oversized content
4. Automatic document splitting for oversized content
