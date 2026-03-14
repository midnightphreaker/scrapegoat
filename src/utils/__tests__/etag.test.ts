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
});
