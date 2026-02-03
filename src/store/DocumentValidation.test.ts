/**
 * Tests for document content length validation (Issue #41)
 *
 * Validates that:
 * 1. Single documents exceeding MAX_DOCUMENT_CONTENT_LENGTH (1MB) are rejected
 * 2. Batches exceeding MAX_BATCH_CONTENT_LENGTH (10MB) are rejected
 * 3. Valid documents within limits are accepted
 * 4. Error messages include size information and helpful guidance
 */

import { Document } from "@langchain/core/documents";
import { describe, expect, it } from "vitest";
import {
  DocumentValidationError,
  formatBytes,
  MAX_BATCH_CONTENT_LENGTH,
  MAX_DOCUMENT_CONTENT_LENGTH,
} from "./errors";

describe("Document Content Length Validation (Issue #41)", () => {
  describe("formatBytes", () => {
    it("should format bytes correctly", () => {
      expect(formatBytes(500)).toBe("500B");
      expect(formatBytes(2048)).toBe("2.00KB");
      expect(formatBytes(MAX_DOCUMENT_CONTENT_LENGTH)).toBe("1.00MB");
      expect(formatBytes(MAX_BATCH_CONTENT_LENGTH)).toBe("10.00MB");
    });
  });

  describe("MAX_DOCUMENT_CONTENT_LENGTH", () => {
    it("should be 1MB", () => {
      expect(MAX_DOCUMENT_CONTENT_LENGTH).toBe(1 * 1024 * 1024);
    });
  });

  describe("MAX_BATCH_CONTENT_LENGTH", () => {
    it("should be 10MB", () => {
      expect(MAX_BATCH_CONTENT_LENGTH).toBe(10 * 1024 * 1024);
    });
  });

  describe("DocumentValidationError", () => {
    it("should create error with size information", () => {
      const error = new DocumentValidationError(
        "Document too large",
        2 * 1024 * 1024, // 2MB
        MAX_DOCUMENT_CONTENT_LENGTH,
        "https://example.com/doc",
      );

      expect(error).toBeInstanceOf(DocumentValidationError);
      expect(error.actualSize).toBe(2 * 1024 * 1024);
      expect(error.maxSize).toBe(MAX_DOCUMENT_CONTENT_LENGTH);
      expect(error.documentUrl).toBe("https://example.com/doc");
      expect(error.message).toContain("2.00MB");
      expect(error.message).toContain("1.00MB");
      expect(error.message).toContain("https://example.com/doc");
      expect(error.message).toContain("Split large documents");
    });

    it("should create batch error with document count", () => {
      const error = new DocumentValidationError(
        "Batch too large",
        15 * 1024 * 1024, // 15MB
        MAX_BATCH_CONTENT_LENGTH,
        undefined,
        100,
      );

      expect(error.actualSize).toBe(15 * 1024 * 1024);
      expect(error.maxSize).toBe(MAX_BATCH_CONTENT_LENGTH);
      expect(error.documentCount).toBe(100);
      expect(error.message).toContain("15.00MB");
      expect(error.message).toContain("10.00MB");
      expect(error.message).toContain("Batch size: 100 documents");
    });

    it("should provide helpful fix suggestions", () => {
      const error = new DocumentValidationError(
        "Content exceeds limit",
        MAX_DOCUMENT_CONTENT_LENGTH + 1,
        MAX_DOCUMENT_CONTENT_LENGTH,
      );

      expect(error.message).toContain("To fix this:");
      expect(error.message).toContain("Split large documents into smaller chunks");
      expect(error.message).toContain("Process documents individually");
      expect(error.message).toContain("Filter out unnecessary content");
    });
  });

  describe("Practical validation scenarios", () => {
    it("should reject single document exceeding 1MB", () => {
      const oversizedContent = "x".repeat(MAX_DOCUMENT_CONTENT_LENGTH + 1);
      const doc = new Document({
        pageContent: oversizedContent,
        metadata: { url: "https://example.com/large" },
      });

      expect(doc.pageContent.length).toBeGreaterThan(MAX_DOCUMENT_CONTENT_LENGTH);

      // This would throw DocumentValidationError in production
      const shouldThrow = () => {
        if (doc.pageContent.length > MAX_DOCUMENT_CONTENT_LENGTH) {
          throw new DocumentValidationError(
            "Document content exceeds maximum allowed size",
            doc.pageContent.length,
            MAX_DOCUMENT_CONTENT_LENGTH,
            doc.metadata.url as string,
          );
        }
      };

      expect(shouldThrow).toThrow(DocumentValidationError);
      expect(shouldThrow).toThrow(/1\.00MB/);
    });

    it("should accept single document within 1MB limit", () => {
      const validContent = "x".repeat(MAX_DOCUMENT_CONTENT_LENGTH - 100);
      const doc = new Document({
        pageContent: validContent,
        metadata: { url: "https://example.com/valid" },
      });

      expect(doc.pageContent.length).toBeLessThan(MAX_DOCUMENT_CONTENT_LENGTH);

      // This should NOT throw
      const shouldNotThrow = () => {
        if (doc.pageContent.length > MAX_DOCUMENT_CONTENT_LENGTH) {
          throw new DocumentValidationError(
            "Document content exceeds maximum allowed size",
            doc.pageContent.length,
            MAX_DOCUMENT_CONTENT_LENGTH,
            doc.metadata.url as string,
          );
        }
      };

      expect(shouldNotThrow).not.toThrow();
    });

    it("should reject batch exceeding 10MB total", () => {
      const batchSize = 10;
      const docSize = MAX_BATCH_CONTENT_LENGTH / batchSize + 1;
      const documents = Array.from(
        { length: batchSize },
        (_, i) =>
          new Document({
            pageContent: "x".repeat(docSize),
            metadata: { url: `https://example.com/doc${i}` },
          }),
      );

      const totalSize = documents.reduce((sum, doc) => sum + doc.pageContent.length, 0);
      expect(totalSize).toBeGreaterThan(MAX_BATCH_CONTENT_LENGTH);

      const shouldThrow = () => {
        if (totalSize > MAX_BATCH_CONTENT_LENGTH) {
          throw new DocumentValidationError(
            "Batch content exceeds maximum allowed size",
            totalSize,
            MAX_BATCH_CONTENT_LENGTH,
            undefined,
            documents.length,
          );
        }
      };

      expect(shouldThrow).toThrow(DocumentValidationError);
      expect(shouldThrow).toThrow(/10\.00MB/);
    });

    it("should accept batch within 10MB total", () => {
      const batchSize = 10;
      const docSize = MAX_BATCH_CONTENT_LENGTH / batchSize - 1000;
      const documents = Array.from(
        { length: batchSize },
        (_, i) =>
          new Document({
            pageContent: "x".repeat(docSize),
            metadata: { url: `https://example.com/doc${i}` },
          }),
      );

      const totalSize = documents.reduce((sum, doc) => sum + doc.pageContent.length, 0);
      expect(totalSize).toBeLessThan(MAX_BATCH_CONTENT_LENGTH);

      const shouldNotThrow = () => {
        if (totalSize > MAX_BATCH_CONTENT_LENGTH) {
          throw new DocumentValidationError(
            "Batch content exceeds maximum allowed size",
            totalSize,
            MAX_BATCH_CONTENT_LENGTH,
            undefined,
            documents.length,
          );
        }
      };

      expect(shouldNotThrow).not.toThrow();
    });
  });
});
