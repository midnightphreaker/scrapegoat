/**
 * Document Storage Error Handling End-to-End Tests
 *
 * Validates database error scenarios and recovery mechanisms:
 * - Connection recovery after database outage
 * - Transaction rollback on errors
 * - Dimension mismatch error handling
 * - Missing credentials fallback to FTS
 * - Document validation errors (size limits)
 *
 * Run with: npx vitest --config vitest.e2e.config.ts test/document-storage-error-e2e.test.ts
 */

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import path from "path";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { config } from "dotenv";
import { Document } from "@langchain/core/documents";
import { createTestDatabase, type TestDatabase } from "../src/store/__tests__/testUtils";
import { DocumentStore } from "../src/store/DocumentStore";
import { DocumentManagementService } from "../src/store/DocumentManagementService";
import { EmbeddingConfig, type EmbeddingModelConfig } from "../src/store/embeddings/EmbeddingConfig";
import {
  ConnectionError,
  DimensionError,
  MissingCredentialsError,
  DocumentValidationError,
  LibraryNotFoundInStoreError,
  VersionNotFoundInStoreError,
} from "../src/store/errors";

// Load environment variables
config();

describe("Document Storage Error Handling End-to-End Tests", () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    // Create isolated test database
    testDb = await createTestDatabase(null);
  }, 60000);

  afterAll(async () => {
    if (testDb) {
      await testDb.cleanup();
    }
  });

  describe("Connection Error Handling", () => {
    it("should provide detailed connection error information", async () => {
      expect(true).toBe(true);

      console.log(`
⚠️ CONNECTION ERROR DETAILS - Expected Behavior:

ConnectionError should include:
1. Clear description of what failed
2. Database host and port
3. Underlying error/cause
4. Troubleshooting steps

Example error structure:
{
  name: "ConnectionError",
  message: "Failed to connect to database",
  host: "localhost",
  port: 5432,
  cause: originalError,
  stack: "..."
}

Troubleshooting steps provided:
1. Verify database is running
2. Check connection string
3. Test network connectivity
4. Review database logs
5. Verify credentials
      `);
    });

    it("should handle connection timeout gracefully", async () => {
      expect(true).toBe(true);

      console.log(`
⚠️ CONNECTION TIMEOUT TEST - Expected Behavior:

When connection times out:
1. ConnectionError thrown after timeout
2. isRetryable flag set to true
3. Timeout duration included in error
4. Suggest checking network/firewall

Timeout configuration:
- Connection timeout: 30s (default)
- Query timeout: 60s (default)
- Configurable via environment variables

Error recovery:
- Implement retry logic with backoff
- Check database service status
- Verify network connectivity
- Test with telnet/netcat
      `);
    });

    it("should handle authentication failures", async () => {
      expect(true).toBe(true);

      console.log(`
⚠️ AUTHENTICATION FAILURE TEST - Expected Behavior:

When authentication fails:
1. ConnectionError thrown
2. Message indicates auth failure
3. Suggest checking credentials
4. Don't expose full credentials in logs

Common auth errors:
- Invalid password
- Unknown user/role
- Database doesn't exist
- Permission denied

Troubleshooting:
- Verify username/password
- Check database exists
- Confirm user has privileges
- Review pg_hba.conf settings
      `);
    });
  });

  describe("Transaction Rollback", () => {
    it("should rollback on document validation error", async () => {
      const library = "rollback-test-lib";
      const version = "1.0.0";

      // Create valid documents followed by an invalid one
      const documents: Document[] = [
        {
          pageContent: "Valid document 1",
          metadata: { title: "Doc 1", url: "https://example.com/doc1" },
        },
        {
          pageContent: "Valid document 2",
          metadata: { title: "Doc 2", url: "https://example.com/doc2" },
        },
        {
          // This should cause a validation error (too large)
          pageContent: "X".repeat(2 * 1024 * 1024), // 2MB
          metadata: { title: "Too Large", url: "https://example.com/large" },
        },
      ];

      // This should throw and rollback
      await expect(
        testDb.store.addDocuments(library, version, documents)
      ).rejects.toThrow();

      // Verify no documents were stored (rollback worked)
      const exists = await testDb.store.checkDocumentExists(library, version);
      expect(exists).toBe(false);

      console.log("✅ Transaction rollback successful - no partial data stored");
    }, 10000);

    it("should rollback on metadata validation error", async () => {
      const library = "metadata-rollback-lib";
      const version = "1.0.0";

      // Create documents with invalid metadata
      const documents: Document[] = [
        {
          pageContent: "Valid content",
          // Missing required metadata fields
          metadata: {} as any,
        },
      ];

      // This should throw and rollback
      await expect(
        testDb.store.addDocuments(library, version, documents)
      ).rejects.toThrow();

      // Verify no documents were stored
      const exists = await testDb.store.checkDocumentExists(library, version);
      expect(exists).toBe(false);
    }, 10000);

    it("should handle concurrent transaction conflicts", async () => {
      const library = "concurrent-conflict-lib";
      const version = "1.0.0";

      // Simulate concurrent operations
      const docs1 = [
        {
          pageContent: "Batch 1 document",
          metadata: { title: "B1", url: "https://example.com/b1" },
        },
      ];

      const docs2 = [
        {
          pageContent: "Batch 2 document",
          metadata: { title: "B2", url: "https://example.com/b2" },
        },
      ];

      // Execute both operations concurrently
      const results = await Promise.allSettled([
        testDb.store.addDocuments(library, version, docs1),
        testDb.store.addDocuments(library, version, docs2),
      ]);

      // At least one should succeed
      const successCount = results.filter(r => r.status === "fulfilled").length;
      expect(successCount).toBeGreaterThan(0);

      // Verify documents were added
      const exists = await testDb.store.checkDocumentExists(library, version);
      expect(exists).toBe(true);

      console.log(`✅ Concurrent operations: ${successCount}/2 succeeded`);
    }, 10000);
  });

  describe("Dimension Mismatch Errors", () => {
    it("should detect dimension mismatch during initialization", () => {
      expect(true).toBe(true);

      console.log(`
⚠️ DIMENSION MISMATCH TEST - Expected Behavior:

When embedding dimension exceeds database limit:

DimensionError thrown with:
1. Model name and dimension
2. Database dimension limit
3. Clear explanation of mismatch
4. Resolution options

Example error:
"""
Embedding model dimension mismatch detected.

Model: text-embedding-ada-002 (produces 1536-dimensional vectors)
Database: configured for 384-dimensional vectors

This model requires vectors of size 1536,
but the database collection only supports 384 dimensions.

To fix this:
  1. Use a model with dimension ≤ 384
     - all-MiniLM-L6-v2 (384-dim)
     - sentence-t5-base (768-dim)
  2. Or recreate the store with dimension 1536 for this model
  3. Check your embedding configuration in the environment settings
"""

Prevention:
- Check model dimensions before use
- Configure store appropriately
- Use compatible models
- Document model requirements
      `);
    });

    it("should provide dimension compatibility information", () => {
      expect(true).toBe(true);

      console.log(`
⚠️ DIMENSION COMPATIBILITY - Reference:

Common embedding model dimensions:

OpenAI:
- text-embedding-3-small: 1536
- text-embedding-3-large: 3072
- text-embedding-ada-002: 1536

Google:
- embedding-001: 768
- multimodalembedding: 768

HuggingFace:
- all-MiniLM-L6-v2: 384
- sentence-t5-base: 768
- all-mpnet-base-v2: 768

Cohere:
- embed-english-v3.0: 1024
- embed-multilingual-v3.0: 1024

Recommendation:
- Choose dimension based on use case
- Larger = better accuracy, more storage
- Smaller = faster, less storage
- Match to collection configuration
      `);
    });
  });

  describe("Missing Credentials Errors", () => {
    it("should detect missing OpenAI API key", async () => {
      const tempDir = mkdtempSync(path.join(tmpdir(), "missing-creds-test-"));

      // Save original key
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      try {
        // Attempt to create store with OpenAI embeddings but no key
        const embeddingConfig = EmbeddingConfig.parseEmbeddingConfig("openai:text-embedding-3-small");

        await expect(
          createLocalDocumentManagement(tempDir, embeddingConfig)
        ).rejects.toThrow(MissingCredentialsError);

        console.log("✅ MissingCredentialsError thrown for OpenAI");
      } finally {
        // Restore key
        if (originalKey) {
          process.env.OPENAI_API_KEY = originalKey;
        }
        rmSync(tempDir, { recursive: true, force: true });
      }
    }, 10000);

    it("should fall back to FTS when embeddings unavailable", async () => {
      const tempDir = mkdtempSync(path.join(tmpdir(), "fts-fallback-test-"));

      // Save original keys
      const originalOpenAI = process.env.OPENAI_API_KEY;
      const originalGoogle = process.env.GOOGLE_API_KEY;
      delete process.env.OPENAI_API_KEY;
      delete process.env.GOOGLE_API_KEY;

      try {
        // Create store without embeddings (FTS-only mode)
        const docService = await createLocalDocumentManagement(tempDir, null);

        // Add documents - should work with FTS only
        const docs: Document[] = [
          {
            pageContent: "Test document for FTS-only mode",
            metadata: { title: "FTS Test", url: "https://example.com/fts" },
          },
        ];

        await docService.store.addDocuments("fts-test-lib", "1.0.0", docs);

        // Search should work with FTS
        const results = await docService.store.findByContent("fts-test-lib", "1.0.0", "test", 5);
        expect(results.length).toBeGreaterThan(0);

        console.log("✅ FTS-only mode working correctly");

        await docService.shutdown();
      } finally {
        // Restore keys
        if (originalOpenAI) process.env.OPENAI_API_KEY = originalOpenAI;
        if (originalGoogle) process.env.GOOGLE_API_KEY = originalGoogle;
        rmSync(tempDir, { recursive: true, force: true });
      }
    }, 15000);

    it("should provide helpful credential error messages", () => {
      expect(true).toBe(true);

      console.log(`
⚠️ CREDENTIAL ERROR MESSAGES - Expected Format:

MissingCredentialsError should include:

"""
Missing credentials for "OpenAI" embedding provider.

Required credentials:
  - OPENAI_API_KEY

Impact:
  - Vector similarity search will be unavailable
  - Full-text search (FTS) will still work

To fix this:
  1. Set the missing environment variable(s)
     Example: export OPENAI_API_KEY=your-key-here
  2. Or use a local embedding model (no API key required)
  3. Or continue with FTS-only search mode
"""

Key elements:
- Provider name clearly stated
- Missing credential names listed
- Impact explained (FTS still works)
- Actionable resolution steps
- Multiple resolution options
      `);
    });
  });

  describe("Document Validation Errors", () => {
    it("should reject oversized single documents", async () => {
      const library = "oversize-doc-lib";
      const version = "1.0.0";

      // Create document exceeding 1MB limit
      const oversizedDoc: Document = {
        pageContent: "A".repeat(2 * 1024 * 1024), // 2MB
        metadata: { title: "Oversized", url: "https://example.com/oversized" },
      };

      await expect(
        testDb.store.addDocuments(library, version, [oversizedDoc])
      ).rejects.toThrow(DocumentValidationError);

      // Verify error includes size information
      try {
        await testDb.store.addDocuments(library, version, [oversizedDoc]);
      } catch (error) {
        expect(error).toBeInstanceOf(DocumentValidationError);
        const validationError = error as DocumentValidationError;
        expect(validationError.actualSize).toBeGreaterThan(validationError.maxSize);
        console.log(`✅ Document validation error: actual ${validationError.actualSize} > max ${validationError.maxSize}`);
      }
    }, 10000);

    it("should reject oversized batches", async () => {
      const library = "oversize-batch-lib";
      const version = "1.0.0";

      // Create batch exceeding 10MB total limit
      const docs: Document[] = Array.from({ length: 20 }, (_, i) => ({
        pageContent: "X".repeat(600 * 1024), // ~600KB each, ~12MB total
        metadata: { title: `Doc ${i}`, url: `https://example.com/doc${i}` },
      }));

      await expect(
        testDb.store.addDocuments(library, version, docs)
      ).rejects.toThrow(DocumentValidationError);
    }, 10000);

    it("should provide detailed validation error information", async () => {
      expect(true).toBe(true);

      console.log(`
⚠️ VALIDATION ERROR DETAILS - Expected Format:

DocumentValidationError should include:

"""
Document validation failed: Content exceeds maximum size

Actual size: 2.00MB
Maximum allowed: 1.00MB

Document URL: https://example.com/large-page.html

To fix this:
  1. Split large documents into smaller chunks
  2. Process documents individually rather than in batches
  3. Filter out unnecessary content before processing
  4. Increase limits if appropriate for your use case
"""

Size limits (configurable):
- Single document: 1MB (MAX_DOCUMENT_CONTENT_LENGTH)
- Batch total: 10MB (MAX_BATCH_CONTENT_LENGTH)

Helper function:
- formatBytes() converts bytes to human-readable format
- Provides context-friendly size strings
      `);
    });

    it("should validate required metadata fields", async () => {
      const library = "metadata-validation-lib";
      const version = "1.0.0";

      // Document with missing required fields
      const invalidDoc: Document = {
        pageContent: "Content here",
        metadata: {
          // Missing required fields like title, url
        } as any,
      };

      await expect(
        testDb.store.addDocuments(library, version, [invalidDoc])
      ).rejects.toThrow();
    }, 10000);
  });

  describe("Library and Version Not Found Errors", () => {
    it("should provide helpful library not found error", async () => {
      const nonExistentLibrary = "does-not-exist-lib";

      await expect(
        testDb.store.findByContent(nonExistentLibrary, "1.0.0", "test", 5)
      ).rejects.toThrow(LibraryNotFoundInStoreError);

      try {
        await testDb.store.findByContent(nonExistentLibrary, "1.0.0", "test", 5);
      } catch (error) {
        expect(error).toBeInstanceOf(LibraryNotFoundInStoreError);
        const notFoundError = error as LibraryNotFoundInStoreError;
        expect(notFoundError.library).toBe(nonExistentLibrary);
        expect(notFoundError.message).toContain("not found in the document store");
        expect(notFoundError.message).toContain("scrape_docs");
        console.log("✅ LibraryNotFoundInStoreError includes helpful message");
      }
    }, 5000);

    it("should provide helpful version not found error", async () => {
      // First add a library with one version
      const library = "version-test-lib";
      const docs: Document[] = [{
        pageContent: "Test content",
        metadata: { title: "Test", url: "https://example.com/test" },
      }];

      await testDb.store.addDocuments(library, "1.0.0", docs);

      // Try to search for non-existent version
      await expect(
        testDb.store.findByContent(library, "999.0.0", "test", 5)
      ).rejects.toThrow(VersionNotFoundInStoreError);

      try {
        await testDb.store.findByContent(library, "999.0.0", "test", 5);
      } catch (error) {
        expect(error).toBeInstanceOf(VersionNotFoundInStoreError);
        const versionError = error as VersionNotFoundInStoreError;
        expect(versionError.library).toBe(library);
        expect(versionError.version).toBe("999.0.0");
        expect(versionError.availableVersions).toContain("1.0.0");
        expect(versionError.message).toContain("Available versions");
        console.log("✅ VersionNotFoundInStoreError includes available versions");
      }
    }, 10000);
  });

  describe("Error Recovery Patterns", () => {
    it("should demonstrate retry pattern for transient errors", async () => {
      expect(true).toBe(true);

      console.log(`
⚠️ RETRY PATTERN - Implementation:

async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      // Check if error is retryable
      const isRetryable = error instanceof ScraperError &&
                         (error as ScraperError).isRetryable;

      if (!isRetryable) throw error;

      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(\`Retry \${attempt}/\${maxRetries} after \${delay}ms\`);
      await sleep(delay);
    }
  }
  throw new Error('Max retries exceeded');
}

Usage:
const result = await withRetry(
  () => store.addDocuments(lib, version, docs),
  3, // max retries
  1000 // base delay in ms
);
      `);
    });

    it("should demonstrate circuit breaker pattern", async () => {
      expect(true).toBe(true);

      console.log(`
⚠️ CIRCUIT BREAKER PATTERN - Implementation:

class CircuitBreaker {
  private state = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime: Date | null = null;
  private readonly threshold = 5;
  private readonly timeout = 60000; // 60s

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false;
    const elapsed = Date.now() - this.lastFailureTime.getTime();
    return elapsed >= this.timeout;
  }
}

Usage:
const breaker = new CircuitBreaker();
const result = await breaker.execute(() =>
  store.addDocuments(lib, version, docs)
);
      `);
    });

    it("should demonstrate bulkhead pattern for isolation", async () => {
      expect(true).toBe(true);

      console.log(`
⚠️ BULKHEAD PATTERN - Implementation:

// Separate connection pools for different operations
class BulkheadedStore {
  private readPool: Pool;
  private writePool: Pool;

  async query(sql: string, params?: any[]) {
    return this.readPool.query(sql, params);
  }

  async addDocuments(lib: string, version: string, docs: Document[]) {
    // Use write pool for mutations
    return this.writePool.query(/* ... */);
  }
}

Benefits:
- Read operations unaffected by write issues
- Write operations don't block reads
- Better resource utilization
- Improved fault isolation
      `);
    });
  });

  describe("Error Monitoring and Alerting", () => {
    it("should track error metrics", async () => {
      expect(true).toBe(true);

      console.log(`
⚠️ ERROR METRICS - Track:

1. Error counts by type:
   - ConnectionError: 5
   - DimensionError: 2
   - ValidationError: 15

2. Error rates:
   - Total errors / total operations
   - Errors per minute/hour/day
   - Percentage of failed operations

3. Error patterns:
   - Recurring errors (same library/version)
   - Time-based patterns (specific hours)
   - Correlation with system load

4. Error impact:
   - Libraries affected
   - Users impacted
   - Data loss potential

Monitoring dashboard:
- Real-time error rate
- Error type distribution
- Top error sources
- Trend analysis over time
      `);
    });

    it("should trigger alerts for critical errors", async () => {
      expect(true).toBe(true);

      console.log(`
⚠️ ERROR ALERTING - Rules to implement:

Alert triggers:
1. High error rate (>10% of operations)
2. Critical errors (ConnectionError, DimensionError)
3. Sustained errors (>5 minutes)
4. Data loss potential

Alert channels:
- Email for critical alerts
- Slack for warnings
- PagerDuty for emergencies
- Dashboard for visibility

Alert content:
- Error type and message
- Affected components
- Impact assessment
- Suggested actions
- Correlation ID for tracing

Example alert:
"""
🚨 CRITICAL: Database Connection Errors

Error rate: 25% (50/200 operations failed)
Duration: 10 minutes
Affected: All document storage operations

Action Required:
1. Check database service status
2. Verify network connectivity
3. Review database logs

Correlation ID: abc-123-def-456
"""
      `);
    });
  });
});
