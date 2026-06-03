import { describe, expect, it } from "vitest";
import { isUrlAllowed } from "./urlValidation";

describe("isUrlAllowed", () => {
  describe("localhost and loopback", () => {
    it("should block 127.0.0.1", () => {
      expect(isUrlAllowed("http://127.0.0.1/admin")).toBe(false);
    });

    it("should block localhost hostname", () => {
      expect(isUrlAllowed("http://localhost/anything")).toBe(false);
    });

    it("should block loopback with port", () => {
      expect(isUrlAllowed("http://127.0.0.1:8080/admin")).toBe(false);
    });

    it("should block localhost with port", () => {
      expect(isUrlAllowed("http://localhost:3000/api")).toBe(false);
    });
  });

  describe("cloud metadata", () => {
    it("should block AWS metadata endpoint", () => {
      expect(isUrlAllowed("http://169.254.169.254/latest/meta-data/")).toBe(false);
    });
  });

  describe("private IP ranges", () => {
    it("should block private class A (10.x.x.x)", () => {
      expect(isUrlAllowed("http://10.0.0.1/internal")).toBe(false);
    });

    it("should block private class B (172.16.x.x)", () => {
      expect(isUrlAllowed("http://172.16.0.1/internal")).toBe(false);
    });

    it("should block private class C (192.168.x.x)", () => {
      expect(isUrlAllowed("http://192.168.1.1/internal")).toBe(false);
    });

    it("should block 10.255.255.255 (end of class A range)", () => {
      expect(isUrlAllowed("http://10.255.255.255/internal")).toBe(false);
    });

    it("should block 172.31.255.255 (end of class B range)", () => {
      expect(isUrlAllowed("http://172.31.255.255/internal")).toBe(false);
    });

    it("should allow 172.32.0.1 (just outside class B range)", () => {
      expect(isUrlAllowed("http://172.32.0.1/page")).toBe(true);
    });
  });

  describe("link-local addresses", () => {
    it("should block link-local 169.254.x.x", () => {
      expect(isUrlAllowed("http://169.254.0.1/test")).toBe(false);
    });
  });

  describe("public URLs", () => {
    it("should allow https://react.dev", () => {
      expect(isUrlAllowed("https://react.dev")).toBe(true);
    });

    it("should allow https://example.com/path", () => {
      expect(isUrlAllowed("https://example.com/path")).toBe(true);
    });

    it("should allow public IP addresses", () => {
      expect(isUrlAllowed("http://93.184.216.34/index.html")).toBe(true);
    });
  });

  describe("invalid URLs", () => {
    it("should reject invalid URLs", () => {
      expect(isUrlAllowed("not-a-url")).toBe(false);
    });

    it("should reject empty strings", () => {
      expect(isUrlAllowed("")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should block [::1] (IPv6 loopback)", () => {
      expect(isUrlAllowed("http://[::1]/path")).toBe(false);
    });

    it("should block [fe80::1] (IPv6 link-local)", () => {
      expect(isUrlAllowed("http://[fe80::1]/path")).toBe(false);
    });

    it("should block 0.0.0.0", () => {
      expect(isUrlAllowed("http://0.0.0.0/health")).toBe(false);
    });
  });
});
