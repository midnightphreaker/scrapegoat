import { describe, expect, it } from "vitest";
import { generateETag } from "../etag.js";

describe("generateETag", () => {
  it("should generate consistent hash for same data", () => {
    const data = { id: 1, name: "test" };
    const hash1 = generateETag(data);
    const hash2 = generateETag(data);
    expect(hash1).toBe(hash2);
  });

  it("should generate different hash for different data", () => {
    const data1 = { id: 1, name: "test" };
    const data2 = { id: 2, name: "test" };
    expect(generateETag(data1)).not.toBe(generateETag(data2));
  });

  it("should ignore key order", () => {
    const data1 = { a: 1, b: 2 };
    const data2 = { b: 2, a: 1 };
    expect(generateETag(data1)).toBe(generateETag(data2));
  });

  it("should return quoted string per HTTP spec", () => {
    const hash = generateETag({ test: true });
    expect(hash.startsWith('"')).toBe(true);
    expect(hash.endsWith('"')).toBe(true);
  });

  describe("edge cases", () => {
    it("should handle null input", () => {
      const hash = generateETag(null);
      expect(typeof hash).toBe("string");
      expect(hash.startsWith('"')).toBe(true);
      expect(hash.endsWith('"')).toBe(true);
      expect(hash).toBe(generateETag(null));
    });

    it("should handle undefined input", () => {
      const hash = generateETag(undefined);
      expect(typeof hash).toBe("string");
      expect(hash.startsWith('"')).toBe(true);
      expect(hash.endsWith('"')).toBe(true);
      expect(hash).toBe(generateETag(undefined));
    });

    it("should handle number primitives", () => {
      const hash = generateETag(42);
      expect(typeof hash).toBe("string");
      expect(hash).toBe(generateETag(42));
      expect(hash).not.toBe(generateETag(43));
    });

    it("should handle string primitives", () => {
      const hash = generateETag("hello");
      expect(typeof hash).toBe("string");
      expect(hash).toBe(generateETag("hello"));
      expect(hash).not.toBe(generateETag("world"));
    });

    it("should handle boolean primitives", () => {
      const hashTrue = generateETag(true);
      const hashFalse = generateETag(false);
      expect(typeof hashTrue).toBe("string");
      expect(hashTrue).toBe(generateETag(true));
      expect(hashTrue).not.toBe(hashFalse);
    });

    it("should handle arrays", () => {
      const hash = generateETag([1, 2, 3]);
      expect(typeof hash).toBe("string");
      expect(hash).toBe(generateETag([1, 2, 3]));
      expect(hash).not.toBe(generateETag([3, 2, 1]));
    });

    it("should handle empty objects", () => {
      const hash = generateETag({});
      expect(typeof hash).toBe("string");
      expect(hash).toBe(generateETag({}));
    });

    it("should handle nested objects", () => {
      const data = { outer: { inner: { value: 123 } } };
      const hash = generateETag(data);
      expect(typeof hash).toBe("string");
      expect(hash).toBe(generateETag(data));
    });
  });
});
