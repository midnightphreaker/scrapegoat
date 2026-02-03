/**
 * Unit tests for string utilities
 */

import { describe, expect, it } from "vitest";
import { fullTrim } from "./string";

describe("fullTrim", () => {
  describe("basic whitespace removal", () => {
    it("should remove leading spaces", () => {
      expect(fullTrim("   hello")).toBe("hello");
    });

    it("should remove trailing spaces", () => {
      expect(fullTrim("hello   ")).toBe("hello");
    });

    it("should remove both leading and trailing spaces", () => {
      expect(fullTrim("   hello   ")).toBe("hello");
    });

    it("should not remove internal spaces", () => {
      expect(fullTrim("hello world")).toBe("hello world");
      expect(fullTrim("  hello world  ")).toBe("hello world");
    });
  });

  describe("tab characters", () => {
    it("should remove leading tabs", () => {
      expect(fullTrim("\t\thello")).toBe("hello");
    });

    it("should remove trailing tabs", () => {
      expect(fullTrim("hello\t\t")).toBe("hello");
    });

    it("should remove mixed leading and trailing tabs", () => {
      expect(fullTrim("\t\thello\t\t")).toBe("hello");
    });

    it("should preserve internal tabs", () => {
      expect(fullTrim("hello\tworld")).toBe("hello\tworld");
    });
  });

  describe("newline characters", () => {
    it("should remove leading newlines", () => {
      expect(fullTrim("\n\nhello")).toBe("hello");
    });

    it("should remove trailing newlines", () => {
      expect(fullTrim("hello\n\n")).toBe("hello");
    });

    it("should remove mixed leading and trailing newlines", () => {
      expect(fullTrim("\n\nhello\n\n")).toBe("hello");
    });

    it("should preserve internal newlines", () => {
      expect(fullTrim("hello\nworld")).toBe("hello\nworld");
    });
  });

  describe("carriage return characters", () => {
    it("should remove leading carriage returns", () => {
      expect(fullTrim("\r\rhello")).toBe("hello");
    });

    it("should remove trailing carriage returns", () => {
      expect(fullTrim("hello\r\r")).toBe("hello");
    });

    it("should remove mixed leading and trailing carriage returns", () => {
      expect(fullTrim("\r\rhello\r\r")).toBe("hello");
    });

    it("should preserve internal carriage returns", () => {
      expect(fullTrim("hello\rworld")).toBe("hello\rworld");
    });
  });

  describe("mixed whitespace types", () => {
    it("should remove mixed leading whitespace (spaces, tabs, newlines, CR)", () => {
      expect(fullTrim("  \t\n\rhello")).toBe("hello");
      expect(fullTrim("\n \t\r  hello")).toBe("hello");
    });

    it("should remove mixed trailing whitespace", () => {
      expect(fullTrim("hello  \t\n\r")).toBe("hello");
      expect(fullTrim("hello\n \t\r  ")).toBe("hello");
    });

    it("should remove mixed leading and trailing whitespace", () => {
      expect(fullTrim("  \t\n\rhello  \t\n\r")).toBe("hello");
      expect(fullTrim("\n \t\r  hello\n \t\r  ")).toBe("hello");
    });

    it("should preserve internal mixed whitespace", () => {
      expect(fullTrim("hello  \t\n\rworld")).toBe("hello  \t\n\rworld");
    });
  });

  describe("edge cases", () => {
    it("should handle empty string", () => {
      expect(fullTrim("")).toBe("");
    });

    it("should handle whitespace-only string", () => {
      expect(fullTrim("   ")).toBe("");
      expect(fullTrim("\t\t\t")).toBe("");
      expect(fullTrim("\n\n\n")).toBe("");
      expect(fullTrim("\r\r\r")).toBe("");
      expect(fullTrim("  \t\n\r")).toBe("");
    });

    it("should handle string with only whitespace", () => {
      expect(fullTrim("     ")).toBe("");
      expect(fullTrim("\t\t\t\t\t")).toBe("");
      expect(fullTrim("\n\n\n\n\n")).toBe("");
    });

    it("should handle single character strings", () => {
      expect(fullTrim("a")).toBe("a");
      expect(fullTrim(" a")).toBe("a");
      expect(fullTrim("a ")).toBe("a");
      expect(fullTrim(" a ")).toBe("a");
    });

    it("should handle strings with multiple words and mixed whitespace", () => {
      expect(fullTrim("  \tthe quick brown fox\n\t  ")).toBe("the quick brown fox");
      expect(fullTrim("\n  \tmultiple\t\t  words  \n\t\r")).toBe("multiple\t\t  words");
    });
  });

  describe("real-world examples", () => {
    it("should handle typical text with leading/trailing whitespace", () => {
      expect(fullTrim("  \n  Example text  \t  ")).toBe("Example text");
    });

    it("should handle code indentation", () => {
      expect(fullTrim("    function test() {\n      return true;\n    }\n  ")).toBe(
        "function test() {\n      return true;\n    }",
      );
    });

    it("should handle CSV data", () => {
      expect(fullTrim("  value1,value2,value3  ")).toBe("value1,value2,value3");
      expect(fullTrim("\nfield1,field2,field3\n")).toBe("field1,field2,field3");
    });

    it("should handle JSON-like strings", () => {
      expect(fullTrim('  {"key": "value"}  ')).toBe('{"key": "value"}');
    });
  });

  describe("Unicode and special characters", () => {
    it("should preserve Unicode characters", () => {
      expect(fullTrim("  你好世界  ")).toBe("你好世界");
      expect(fullTrim("\n🎉🎊\n")).toBe("🎉🎊");
    });

    it("should preserve emoji", () => {
      expect(fullTrim("  😀 😃 😄 😁  ")).toBe("😀 😃 😄 😁");
    });

    it("should handle zero-width characters", () => {
      const str = "  \u200B\u200C\u200Dhello\u200B\u200C\u200D  ";
      expect(fullTrim(str)).toBe("\u200B\u200C\u200Dhello\u200B\u200C\u200D");
    });
  });

  describe("boundary conditions", () => {
    it("should handle very long strings", () => {
      const longString = `  ${"a".repeat(10000)}  `;
      expect(fullTrim(longString)).toBe("a".repeat(10000));
    });

    it("should handle strings with only one type of whitespace character", () => {
      expect(fullTrim("     ")).toBe("");
      expect(fullTrim("\t\t\t\t\t")).toBe("");
      expect(fullTrim("\n\n\n\n\n")).toBe("");
      expect(fullTrim("\r\r\r\r\r")).toBe("");
    });
  });
});
