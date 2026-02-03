/**
 * Tests for type guard utilities
 */

import { describe, expect, it } from "vitest";
import {
  assertDbSuccess,
  assertFetcherType,
  assertScraperScope,
  assertSuccess,
  assertVersionStatus,
  type DbErrorResult,
  type DbSuccessResult,
  type ErrorResult,
  hasProperty,
  isArray,
  isDbErrorResult,
  isDbSuccessResult,
  isErrorLike,
  isErrorResult,
  isFetcherType,
  isNonEmptyString,
  isNotNull,
  isPipelineJobStatus,
  isPlainObject,
  isScraperErrorResult,
  isScraperScope,
  isScraperSuccessResult,
  isSuccessResult,
  isVersionRef,
  isVersionStatus,
  type Result,
  type SuccessResult,
} from "./typeGuards";

describe("typeGuards", () => {
  describe("isVersionStatus", () => {
    it("returns true for valid VersionStatus values", () => {
      expect(isVersionStatus("not_indexed")).toBe(true);
      expect(isVersionStatus("queued")).toBe(true);
      expect(isVersionStatus("running")).toBe(true);
      expect(isVersionStatus("completed")).toBe(true);
      expect(isVersionStatus("failed")).toBe(true);
      expect(isVersionStatus("cancelled")).toBe(true);
      expect(isVersionStatus("updating")).toBe(true);
    });

    it("returns false for invalid values", () => {
      expect(isVersionStatus("invalid")).toBe(false);
      expect(isVersionStatus("")).toBe(false);
      expect(isVersionStatus(null)).toBe(false);
      expect(isVersionStatus(undefined)).toBe(false);
      expect(isVersionStatus(123)).toBe(false);
      expect(isVersionStatus({})).toBe(false);
    });
  });

  describe("isPipelineJobStatus", () => {
    it("returns true for valid PipelineJobStatus values", () => {
      expect(isPipelineJobStatus("queued")).toBe(true);
      expect(isPipelineJobStatus("running")).toBe(true);
      expect(isPipelineJobStatus("completed")).toBe(true);
      expect(isPipelineJobStatus("failed")).toBe(true);
      expect(isPipelineJobStatus("cancelled")).toBe(true);
    });

    it("returns false for invalid values", () => {
      expect(isPipelineJobStatus("invalid")).toBe(false);
      expect(isPipelineJobStatus("updating")).toBe(false);
      expect(isPipelineJobStatus(null)).toBe(false);
      expect(isPipelineJobStatus(undefined)).toBe(false);
    });
  });

  describe("isFetcherType", () => {
    it("returns true for valid FetcherType values", () => {
      expect(isFetcherType("auto")).toBe(true);
      expect(isFetcherType("http")).toBe(true);
      expect(isFetcherType("crawl4ai")).toBe(true);
      expect(isFetcherType("file")).toBe(true);
    });

    it("returns false for invalid values", () => {
      expect(isFetcherType("invalid")).toBe(false);
      expect(isFetcherType("")).toBe(false);
      expect(isFetcherType(null)).toBe(false);
      expect(isFetcherType(undefined)).toBe(false);
    });
  });

  describe("isScraperScope", () => {
    it("returns true for valid ScraperScope values", () => {
      expect(isScraperScope("subpages")).toBe(true);
      expect(isScraperScope("hostname")).toBe(true);
      expect(isScraperScope("domain")).toBe(true);
    });

    it("returns false for invalid values", () => {
      expect(isScraperScope("invalid")).toBe(false);
      expect(isScraperScope("")).toBe(false);
      expect(isScraperScope(null)).toBe(false);
      expect(isScraperScope(undefined)).toBe(false);
    });
  });

  describe("isVersionRef", () => {
    it("returns true for valid VersionRef objects", () => {
      expect(isVersionRef({ library: "react", version: "18.0.0" })).toBe(true);
      expect(isVersionRef({ library: "vue", version: "" })).toBe(true);
      expect(isVersionRef({ library: "angular", version: "1.2.3" })).toBe(true);
    });

    it("returns false for invalid values", () => {
      expect(isVersionRef(null)).toBe(false);
      expect(isVersionRef(undefined)).toBe(false);
      expect(isVersionRef({})).toBe(false);
      expect(isVersionRef({ library: "test" })).toBe(false); // missing version
      expect(isVersionRef({ version: "1.0" })).toBe(false); // missing library
      expect(isVersionRef({ library: 123, version: "1.0" })).toBe(false); // wrong type
      expect(isVersionRef({ library: "test", version: 123 })).toBe(false); // wrong type
    });
  });

  describe("Result type guards", () => {
    const successResult: SuccessResult<string> = { success: true, data: "test" };
    const errorResult: ErrorResult = { success: false, error: new Error("test") };

    describe("isSuccessResult", () => {
      it("returns true for SuccessResult", () => {
        expect(isSuccessResult(successResult)).toBe(true);
        expect(isSuccessResult({ success: true, data: null })).toBe(true);
      });

      it("returns false for ErrorResult", () => {
        expect(isSuccessResult(errorResult)).toBe(false);
      });

      it("narrows type correctly", () => {
        const result: Result<string> = successResult;
        if (isSuccessResult(result)) {
          // Type should be narrowed to SuccessResult<string>
          expect(result.data).toBe("test");
        }
      });
    });

    describe("isErrorResult", () => {
      it("returns true for ErrorResult", () => {
        expect(isErrorResult(errorResult)).toBe(true);
      });

      it("returns false for SuccessResult", () => {
        expect(isErrorResult(successResult)).toBe(false);
      });
    });
  });

  describe("DbResult type guards", () => {
    const successResult: DbSuccessResult<number[]> = {
      ok: true,
      data: [1, 2, 3],
      rows: 3,
    };
    const errorResult: DbErrorResult = { ok: false, error: new Error("db error") };

    describe("isDbSuccessResult", () => {
      it("returns true for DbSuccessResult", () => {
        expect(isDbSuccessResult(successResult)).toBe(true);
        expect(isDbSuccessResult({ ok: true, data: [] })).toBe(true);
      });

      it("returns false for DbErrorResult", () => {
        expect(isDbSuccessResult(errorResult)).toBe(false);
      });
    });

    describe("isDbErrorResult", () => {
      it("returns true for DbErrorResult", () => {
        expect(isDbErrorResult(errorResult)).toBe(true);
      });

      it("returns false for DbSuccessResult", () => {
        expect(isDbErrorResult(successResult)).toBe(false);
      });
    });
  });

  describe("ScraperJobResult type guards", () => {
    const successResult = {
      status: "completed" as const,
      library: "test",
      version: "1.0.0",
      documentsProcessed: 100,
      uniqueUrls: 50,
    };

    const errorResult = {
      status: "failed" as const,
      library: "test",
      version: "1.0.0",
      error: "Scraping failed",
    };

    describe("isScraperSuccessResult", () => {
      it("returns true for success result", () => {
        expect(isScraperSuccessResult(successResult)).toBe(true);
      });

      it("returns false for error result", () => {
        expect(isScraperSuccessResult(errorResult)).toBe(false);
      });
    });

    describe("isScraperErrorResult", () => {
      it("returns true for error result", () => {
        expect(isScraperErrorResult(errorResult)).toBe(true);
      });

      it("returns false for success result", () => {
        expect(isScraperErrorResult(successResult)).toBe(false);
      });
    });
  });

  describe("hasProperty", () => {
    it("returns true for objects with the property", () => {
      expect(hasProperty({ name: "test" }, "name")).toBe(true);
      expect(hasProperty({ name: "test", value: 123 }, "value")).toBe(true);
      expect(hasProperty({ data: null }, "data")).toBe(true);
    });

    it("returns false for objects without the property", () => {
      expect(hasProperty({ name: "test" }, "value")).toBe(false);
      expect(hasProperty({}, "anything")).toBe(false);
    });

    it("returns false for non-objects", () => {
      expect(hasProperty(null, "prop")).toBe(false);
      expect(hasProperty(undefined, "prop")).toBe(false);
      expect(hasProperty("string", "length")).toBe(false);
      expect(hasProperty(123, "toString")).toBe(false);
    });
  });

  describe("isNotNull", () => {
    it("returns true for non-null values", () => {
      expect(isNotNull("test")).toBe(true);
      expect(isNotNull(0)).toBe(true);
      expect(isNotNull(false)).toBe(true);
      expect(isNotNull("")).toBe(true);
    });

    it("returns false for null/undefined", () => {
      expect(isNotNull(null)).toBe(false);
      expect(isNotNull(undefined)).toBe(false);
    });
  });

  describe("isNonEmptyString", () => {
    it("returns true for non-empty strings", () => {
      expect(isNonEmptyString("test")).toBe(true);
      expect(isNonEmptyString(" ")).toBe(true);
      expect(isNonEmptyString("a")).toBe(true);
    });

    it("returns false for non-strings or empty strings", () => {
      expect(isNonEmptyString("")).toBe(false);
      expect(isNonEmptyString(null)).toBe(false);
      expect(isNonEmptyString(undefined)).toBe(false);
      expect(isNonEmptyString(123)).toBe(false);
      expect(isNonEmptyString({})).toBe(false);
    });
  });

  describe("isArray", () => {
    it("returns true for arrays", () => {
      expect(isArray([])).toBe(true);
      expect(isArray([1, 2, 3])).toBe(true);
      expect(isArray(["a", "b"])).toBe(true);
    });

    it("returns false for non-arrays", () => {
      expect(isArray(null)).toBe(false);
      expect(isArray(undefined)).toBe(false);
      expect(isArray({})).toBe(false);
      expect(isArray({ length: 3 })).toBe(false);
    });
  });

  describe("isPlainObject", () => {
    it("returns true for plain objects", () => {
      expect(isPlainObject({})).toBe(true);
      expect(isPlainObject({ a: 1 })).toBe(true);
      expect(isPlainObject(Object.create(null))).toBe(true);
    });

    it("returns false for non-objects", () => {
      expect(isPlainObject(null)).toBe(false);
      expect(isPlainObject(undefined)).toBe(false);
      expect(isPlainObject([])).toBe(false);
      expect(isPlainObject("string")).toBe(false);
      expect(isPlainObject(123)).toBe(false);
    });
  });

  describe("isErrorLike", () => {
    it("returns true for error-like objects", () => {
      expect(isErrorLike({ message: "error" })).toBe(true);
      expect(isErrorLike({ message: "error", stack: "trace" })).toBe(true);
      expect(isErrorLike({ message: "error", code: "ERR001" })).toBe(true);
      expect(isErrorLike(new Error("test"))).toBe(true);
    });

    it("returns false for non-error-like objects", () => {
      expect(isErrorLike({})).toBe(false);
      expect(isErrorLike({ stack: "trace" })).toBe(false); // missing message
      expect(isErrorLike(null)).toBe(false);
      expect(isErrorLike(undefined)).toBe(false);
      expect(isErrorLike("error string")).toBe(false);
    });
  });

  describe("Assertion functions", () => {
    describe("assertVersionStatus", () => {
      it("does not throw for valid values", () => {
        expect(() => assertVersionStatus("completed")).not.toThrow();
        expect(() => assertVersionStatus("queued")).not.toThrow();
      });

      it("throws TypeError for invalid values", () => {
        expect(() => assertVersionStatus("invalid")).toThrow(TypeError);
        expect(() => assertVersionStatus(null)).toThrow(TypeError);
        expect(() => assertVersionStatus(undefined)).toThrow(TypeError);
      });
    });

    describe("assertFetcherType", () => {
      it("does not throw for valid values", () => {
        expect(() => assertFetcherType("auto")).not.toThrow();
        expect(() => assertFetcherType("http")).not.toThrow();
      });

      it("throws TypeError for invalid values", () => {
        expect(() => assertFetcherType("invalid")).toThrow(TypeError);
        expect(() => assertFetcherType(null)).toThrow(TypeError);
      });
    });

    describe("assertScraperScope", () => {
      it("does not throw for valid values", () => {
        expect(() => assertScraperScope("subpages")).not.toThrow();
        expect(() => assertScraperScope("hostname")).not.toThrow();
      });

      it("throws TypeError for invalid values", () => {
        expect(() => assertScraperScope("invalid")).toThrow(TypeError);
        expect(() => assertScraperScope(null)).toThrow(TypeError);
      });
    });

    describe("assertSuccess", () => {
      it("does not throw for success results", () => {
        const success = { success: true as const, data: "test" };
        expect(() => assertSuccess(success)).not.toThrow();
      });

      it("throws error for error results", () => {
        const error = new Error("test error");
        const fail = { success: false as const, error };
        expect(() => assertSuccess(fail)).toThrow("test error");
      });
    });

    describe("assertDbSuccess", () => {
      it("does not throw for success results", () => {
        const success = { ok: true as const, data: [] };
        expect(() => assertDbSuccess(success)).not.toThrow();
      });

      it("throws error for error results", () => {
        const error = new Error("db error");
        const fail = { ok: false as const, error };
        expect(() => assertDbSuccess(fail)).toThrow("db error");
      });
    });
  });
});
