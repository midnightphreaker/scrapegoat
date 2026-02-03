/**
 * Base error class for all store-related errors.
 *
 * @description
 * Provides consistent error handling across the document store with automatic cause tracking.
 * All store-specific errors should extend this class to maintain error handling consistency.
 *
 * @remarks
 * The `cause` parameter allows for error chaining, making it easier to debug
 * complex failures by preserving the full error stack trace.
 *
 * @example
 * ```typescript
 * throw new StoreError("Failed to save document", underlyingError);
 * ```
 *
 * @throws
 * This base class is typically not thrown directly but is extended by specific error types.
 */
export class StoreError extends Error {
  /**
   * Creates a new store error with optional cause tracking.
   *
   * @param message - Human-readable description of what went wrong
   * @param cause - The underlying error or reason that caused this error
   */
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(cause ? `${message} caused by ${cause}` : message);
    this.name = this.constructor.name;

    // Preserve stack trace from cause if available
    const causeError =
      cause instanceof Error ? cause : cause ? new Error(String(cause)) : undefined;
    if (causeError?.stack) {
      this.stack = causeError.stack;
    }
  }
}

/**
 * Error thrown when a requested library cannot be found in the store.
 *
 * @description
 * This error occurs when attempting to search or retrieve documentation for a library
 * that has not been indexed in the document store.
 *
 * @remarks
 * **To resolve this issue:**
 * - Use the `scrape_docs` tool to index the library documentation first
 * - Check if the library name is spelled correctly (case-sensitive)
 * - Verify the library exists in the configured documentation source
 *
 * @example
 * ```typescript
 * // This will throw LibraryNotFoundInStoreError if 'react-query' is not indexed
 * await searchDocs('react-query', 'useQuery');
 * ```
 *
 * @throws
 * When calling {@link searchDocs} or similar methods with a library name that
 * has not been previously indexed via `scrape_docs`.
 */
export class LibraryNotFoundInStoreError extends StoreError {
  /**
   * Creates an error for a missing library with optional suggestions.
   *
   * @param library - The library name that was requested but not found
   * @param similarLibraries - Array of similar library names available in the store (for suggestions)
   */
  constructor(
    public readonly library: string,
    public readonly similarLibraries: string[] = [],
  ) {
    let text = `Library "${library}" not found in the document store.`;
    if (similarLibraries.length > 0) {
      text += `\n\nDid you mean one of these libraries?\n  - ${similarLibraries.join("\n  - ")}`;
    }
    text += `\n\nTo fix this:\n  1. Scrape the library docs first using scrape_docs\n  2. Check the library name spelling (case-sensitive)\n  3. Verify the library exists in your documentation source`;
    super(text);
  }
}

/**
 * Error thrown when a specific version of a library cannot be found in the store.
 *
 * @description
 * This error occurs when requesting a specific library version that is not available,
 * or when no version matches a version range pattern (e.g., "5.x").
 *
 * @remarks
 * **To resolve this issue:**
 * - Check available versions using `list_libraries` or the library info endpoint
 * - Use a version range pattern (e.g., "5.x" for any 5.x.x version)
 * - Scrape the required version using `scrape_docs` with the version parameter
 * - Use the latest available version if your requested version is not critical
 *
 * @example
 * ```typescript
 * // This will throw if version 5.3.0 is not indexed
 * await searchDocs('react', 'hooks', '5.3.0');
 *
 * // Instead, use a version range to find any compatible version
 * await searchDocs('react', 'hooks', '5.x');
 * ```
 *
 * @throws
 * When requesting a specific library version that has not been indexed.
 */
export class VersionNotFoundInStoreError extends StoreError {
  /**
   * Creates an error for a missing library version with available alternatives.
   *
   * @param library - The library name
   * @param version - The version that was requested (or version range pattern)
   * @param availableVersions - Array of version strings that are available in the store
   */
  constructor(
    public readonly library: string,
    public readonly version: string,
    public readonly availableVersions: string[],
  ) {
    const versionText = version ? `Version "${version}"` : "Requested version";
    let text = `${versionText} for library "${library}" not found in the store.`;

    if (availableVersions.length > 0) {
      text += `\n\nAvailable versions for ${library}:\n  - ${availableVersions.join("\n  - ")}`;
    } else {
      text += `\n\nNo versions of "${library}" are currently indexed.`;
    }

    text += `\n\nTo fix this:\n  1. Use a version range (e.g., "5.x" for any 5.x.x version)\n  2. Scrape the required version with: scrape_docs(url, "${library}", "${version}")\n  3. Use the latest available version from the list above`;

    super(text);
  }
}

/**
 * Error thrown when an embedding model's vector dimension exceeds the database's fixed dimension.
 *
 * @description
 * This error occurs when attempting to use an embedding model that produces vectors
 * with more dimensions than the Qdrant database collection is configured to accept.
 *
 * @remarks
 * **Technical Context:**
 * - Qdrant collections have a fixed vector dimension set at creation time
 * - Different embedding models produce different dimensional vectors (e.g., 384, 768, 1536)
 * - You must either: (a) use a compatible model, or (b) recreate the collection with the correct dimension
 *
 * **To resolve this issue:**
 * - Switch to an embedding model with dimension ≤ dbDimension
 * - Recreate the document store collection with the correct dimension for your model
 * - Common model dimensions: all-MiniLM-L6-v2 (384), BERT-base (768), text-embedding-ada-002 (1536)
 *
 * @example
 * ```typescript
 * // This will throw DimensionError if the collection is configured for 384-dim vectors
 * // but the model produces 1536-dimensional vectors
 * const embedding = new OpenAIEmbeddings(); // 1536 dimensions
 * await store.addDocument(embedding); // Throws if store is 384-dim
 * ```
 *
 * @throws
 * When initializing an embedding service or adding documents with a model whose
 * vector dimensions exceed the collection's configured dimension.
 */
export class DimensionError extends StoreError {
  /**
   * Creates an error for dimension mismatch between model and database.
   *
   * @param modelName - Name of the embedding model being used
   * @param modelDimension - The vector dimension produced by this model
   * @param dbDimension - The maximum vector dimension the database collection can accept
   */
  constructor(
    public readonly modelName: string,
    public readonly modelDimension: number,
    public readonly dbDimension: number,
  ) {
    super(
      `Embedding model dimension mismatch detected.\n\n` +
        `Model: ${modelName} (produces ${modelDimension}-dimensional vectors)\n` +
        `Database: configured for ${dbDimension}-dimensional vectors\n\n` +
        `This model requires vectors of size ${modelDimension}, ` +
        `but the database collection only supports ${dbDimension} dimensions.\n\n` +
        `To fix this:\n` +
        `  1. Use a model with dimension ≤ ${dbDimension}\n` +
        `     - all-MiniLM-L6-v2 (384-dim)\n` +
        `     - sentence-t5-base (768-dim)\n` +
        `  2. Or recreate the store with dimension ${modelDimension} for this model\n` +
        `  3. Check your embedding configuration in the environment settings`,
    );
  }
}

/**
 * Error thrown when there's a problem with database connectivity or operations.
 *
 * @description
 * This error occurs when the document store cannot connect to the underlying database
 * (typically Qdrant) or when a database operation fails after connection.
 *
 * @remarks
 * **Common causes:**
 * - Qdrant service is not running or not accessible
 * - Network connectivity issues
 * - Invalid connection credentials or endpoint
 * - Database operation timeout
 * - Collection does not exist or is corrupted
 *
 * **To resolve this issue:**
 * - Verify Qdrant is running: check the service status or Docker container
 * - Check the QDRANT_URL environment variable is correct
 * - Ensure network connectivity to the Qdrant host/port
 * - Review Qdrant logs for specific error details
 * - Verify the collection exists and is properly initialized
 *
 * @example
 * ```typescript
 * try {
 *   await store.initialize();
 * } catch (error) {
 *   if (error instanceof ConnectionError) {
 *     console.error("Cannot connect to Qdrant:", error.message);
 *     // Implement retry logic or fallback to FTS-only mode
 *   }
 * }
 * ```
 *
 * @throws
 * When attempting to initialize the store or perform database operations
 * and the connection fails or times out.
 */
export class ConnectionError extends StoreError {
  /**
   * Creates an error for database connectivity or operation failures.
   *
   * @param message - Description of what operation failed
   * @param cause - The underlying error (e.g., network error, timeout)
   * @param host - Optional: The database host that was being connected to
   * @param port - Optional: The port that was being connected to
   */
  constructor(
    message: string,
    cause?: unknown,
    public readonly host?: string,
    public readonly port?: number,
  ) {
    let text = `Database connection error: ${message}`;

    if (host && port) {
      text += `\n\nConnection details:\n  - Host: ${host}\n  - Port: ${port}`;
    }

    text +=
      `\n\nTo fix this:\n` +
      `  1. Verify Qdrant is running (check: docker ps or service status)\n` +
      `  2. Check QDRANT_URL environment variable is correct\n` +
      `  3. Test connectivity: curl http://${host || "localhost"}:${port || 6333}\n` +
      `  4. Review Qdrant logs for specific errors\n` +
      `  5. Ensure the collection exists: list_collections`;

    super(text, cause);
  }
}

/**
 * Error thrown when attempting to retrieve a document that doesn't exist.
 *
 * @description
 * This error occurs when trying to access, update, or delete a document by ID
 * that is not present in the document store.
 *
 * @remarks
 * **Common causes:**
 * - The document was deleted or never existed
 * - An incorrect document ID was provided
 * - The document belongs to a different library/version
 * - Case sensitivity issues in the document ID
 *
 * **To resolve this issue:**
 * - Verify the document ID is correct (check spelling and case)
 * - Search for the document to find its correct ID
 * - Check if the document exists in the expected library/version
 * - Use list_documents to browse available documents
 *
 * @example
 * ```typescript
 * try {
 *   const doc = await store.getDocument("doc-123");
 * } catch (error) {
 *   if (error instanceof DocumentNotFoundError) {
 *     console.log("Document not found, available IDs:", await store.listDocuments());
 *   }
 * }
 * ```
 *
 * @throws
 * When calling getDocument, updateDocument, or deleteDocument with an ID
 * that does not exist in the store.
 */
export class DocumentNotFoundError extends StoreError {
  /**
   * Creates an error for a missing document ID.
   *
   * @param id - The document ID that was requested but not found
   * @param library - Optional: The library where the document was expected
   * @param version - Optional: The library version where the document was expected
   */
  constructor(
    public readonly id: string,
    public readonly library?: string,
    public readonly version?: string,
  ) {
    let text = `Document with ID "${id}" not found in the store.`;

    if (library) {
      text += `\n\nExpected in library: ${library}`;
      if (version) {
        text += ` (version: ${version})`;
      }
    }

    text +=
      `\n\nTo fix this:\n` +
      `  1. Verify the document ID is correct (check spelling and case)\n` +
      `  2. Search for the document to find the correct ID\n` +
      `  3. List available documents in the library to browse options\n` +
      `  4. Check if the document was deleted or moved`;

    super(text);
  }
}

/**
 * Error thrown when required credentials for an embedding provider are missing.
 *
 * @description
 * This error occurs when attempting to use an embedding service that requires
 * API keys or other credentials, but those credentials are not configured.
 *
 * @remarks
 * **This is not a fatal error** - the system is designed to gracefully degrade
 * to full-text search (FTS) mode when vector embeddings are unavailable.
 *
 * **Supported providers and their credentials:**
 * - **OpenAI**: `OPENAI_API_KEY`
 * - **Cohere**: `COHERE_API_KEY`
 * - **HuggingFace**: `HUGGINGFACE_API_KEY`
 * - **Local models**: No credentials required
 *
 * **To resolve this issue:**
 * - Add the required API key to your environment variables
 * - Use a local embedding model that doesn't require API keys
 * - Continue in FTS-only mode (search will still work, just without vector similarity)
 *
 * @example
 * ```typescript
 * // Set environment variable before running:
 * // export OPENAI_API_KEY=sk-...
 *
 * // Or in code:
 * process.env.OPENAI_API_KEY = "your-key-here";
 * ```
 *
 * @throws
 * When initializing an embedding service provider without the required credentials.
 */
export class MissingCredentialsError extends StoreError {
  /**
   * Creates an error for missing embedding provider credentials.
   *
   * @param provider - Name of the embedding provider (e.g., "OpenAI", "Cohere")
   * @param missingCredentials - Array of credential names that are missing (e.g., env var names)
   * @param ftsAvailable - Whether full-text search is available as fallback
   */
  constructor(
    public readonly provider: string,
    missingCredentials: string[],
    public readonly ftsAvailable: boolean = true,
  ) {
    let text =
      `Missing credentials for "${provider}" embedding provider.\n\n` +
      `Required credentials:\n  - ${missingCredentials.join("\n  - ")}\n\n` +
      `Impact:\n` +
      `  - Vector similarity search will be unavailable\n` +
      `  - Full-text search (FTS) will still work${ftsAvailable ? "" : " (FTS also unavailable)"}`;

    text +=
      `\n\nTo fix this:\n` +
      `  1. Set the missing environment variable(s)\n` +
      `     Example: export ${missingCredentials[0]}=your-key-here\n` +
      `  2. Or use a local embedding model (no API key required)\n` +
      `  3. Or continue with FTS-only search mode`;

    super(text);
  }
}

/**
 * Error thrown when image embedding generation fails.
 *
 * @description
 * This error occurs when processing images for embedding vector generation fails,
 * typically due to unsupported image formats, size limits, or model errors.
 *
 * @remarks
 * **Common causes:**
 * - Unsupported image format (only PNG, JPG, JPEG supported)
 * - Image file size exceeds the model's limit
 * - Corrupted or invalid image data
 * - Model service unavailable or overloaded
 * - Insufficient memory for processing large images
 *
 * **Supported image formats:**
 * - PNG (.png)
 * - JPEG/JPG (.jpg, .jpeg)
 *
 * **To resolve this issue:**
 * - Verify the image is in PNG or JPEG format
 * - Check image file size is within limits (typically < 10MB)
 * - Ensure the image is not corrupted
 * - Try resizing or compressing the image
 * - Check the vision model service status
 *
 * @example
 * ```typescript
 * try {
 *   const embedding = await imageService.embedImage('/path/to/image.png');
 * } catch (error) {
 *   if (error instanceof ImageEmbeddingError) {
 *     console.error("Image processing failed:", error.message);
 *     // Fall back to text-only search or skip image
 *   }
 * }
 * ```
 *
 * @throws
 * When calling embedImage or processImage with an image that cannot be processed.
 */
export class ImageEmbeddingError extends StoreError {
  /**
   * Creates an error for image embedding processing failures.
   *
   * @param message - Description of what went wrong
   * @param cause - The underlying error from the embedding service
   * @param imagePath - Optional: Path or URL of the image that failed
   * @param imageFormat - Optional: Detected format of the image
   */
  constructor(
    message: string,
    cause?: unknown,
    public readonly imagePath?: string,
    public readonly imageFormat?: string,
  ) {
    let text = `Image embedding failed: ${message}`;

    if (imagePath) {
      text += `\n\nImage: ${imagePath}`;
    }
    if (imageFormat) {
      text += `\nFormat: ${imageFormat}`;
    }

    text +=
      `\n\nSupported formats: PNG, JPEG, JPG\n\n` +
      `To fix this:\n` +
      `  1. Verify the image is PNG or JPEG format\n` +
      `  2. Check the image is not corrupted\n` +
      `  3. Ensure image size is within limits (< 10MB recommended)\n` +
      `  4. Try resizing or compressing the image\n` +
      `  5. Check vision model service availability`;

    super(text, cause);
  }
}

/**
 * Maximum allowed content length for a single document (1MB).
 * Prevents excessive memory usage and processing time.
 */
export const MAX_DOCUMENT_CONTENT_LENGTH = 1 * 1024 * 1024; // 1MB

/**
 * Maximum allowed total content length for a batch of documents (10MB).
 * Prevents overwhelming the system with large batches.
 */
export const MAX_BATCH_CONTENT_LENGTH = 10 * 1024 * 1024; // 10MB

/**
 * Formats a byte count into a human-readable string (e.g., "1.5MB").
 *
 * @param bytes - Number of bytes to format
 * @returns Formatted string with appropriate unit
 */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)}KB`;
  }
  return `${bytes}B`;
}

/**
 * Error thrown when document content exceeds size limits.
 * Prevents expensive processing operations on oversized content.
 */
export class DocumentValidationError extends StoreError {
  /**
   * Creates an error for oversized document content.
   *
   * @param message - Description of what went wrong
   * @param actualSize - The actual content size in bytes
   * @param maxSize - The maximum allowed size in bytes
   * @param documentUrl - Optional: URL of the document that failed validation
   * @param documentCount - Optional: Number of documents in batch (for batch errors)
   */
  constructor(
    message: string,
    public readonly actualSize: number,
    public readonly maxSize: number,
    public readonly documentUrl?: string,
    public readonly documentCount?: number,
  ) {
    let text = `Document validation failed: ${message}`;
    text += `\n\nActual size: ${formatBytes(actualSize)}`;
    text += `\nMaximum allowed: ${formatBytes(maxSize)}`;

    if (documentUrl) {
      text += `\n\nDocument URL: ${documentUrl}`;
    }
    if (documentCount) {
      text += `\nBatch size: ${documentCount} documents`;
    }

    text += `\n\nTo fix this:
  1. Split large documents into smaller chunks
  2. Process documents individually rather than in batches
  3. Filter out unnecessary content before processing
  4. Increase limits if appropriate for your use case`;

    super(text);
  }
}
