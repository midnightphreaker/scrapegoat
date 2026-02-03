/**
 * Unit tests for error classes
 */

import { describe, expect, it } from "vitest";
import {
  ChallengeError,
  InvalidUrlError,
  NetworkError,
  ParsingError,
  RateLimitError,
  RedirectError,
  ScraperError,
  ServiceUnavailableError,
  TimeoutError,
  ValidationError,
} from "./errors";

describe("ScraperError", () => {
  it("should create error with message", () => {
    const error = new ScraperError("Test error");
    expect(error.message).toBe("Test error");
    expect(error.name).toBe("ScraperError");
    expect(error.isRetryable).toBe(false);
  });

  it("should create retryable error", () => {
    const error = new ScraperError("Retryable error", true);
    expect(error.isRetryable).toBe(true);
  });

  it("should be instance of Error", () => {
    const error = new ScraperError("Test");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ScraperError);
  });

  it("should handle cause error", () => {
    const cause = new Error("Original error");
    const error = new ScraperError("Wrapper error", false, cause);
    expect(error.cause).toBe(cause);
  });

  it("should include cause stack in stack trace", () => {
    const cause = new Error("Cause");
    const error = new ScraperError("Error", false, cause);
    expect(error.stack).toContain("Caused by:");
    expect(error.stack).toContain(cause.stack!);
  });
});

describe("NetworkError", () => {
  it("should create error with message and status code", () => {
    const error = new NetworkError("Network failed", 404);
    expect(error.message).toBe("Network failed");
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe("NetworkError");
  });

  it("should be retryable by default", () => {
    const error = new NetworkError("Network failed");
    expect(error.isRetryable).toBe(true);
  });

  it("should be instance of ScraperError", () => {
    const error = new NetworkError("Network failed");
    expect(error).toBeInstanceOf(ScraperError);
    expect(error).toBeInstanceOf(NetworkError);
  });

  it("should handle cause error", () => {
    const cause = new Error("Connection refused");
    const error = new NetworkError("Network error", 503, cause);
    expect(error.cause).toBe(cause);
  });
});

describe("RateLimitError", () => {
  it("should create error with message", () => {
    const error = new RateLimitError("Rate limited");
    expect(error.message).toBe("Rate limited");
    expect(error.name).toBe("RateLimitError");
  });

  it("should be retryable by default", () => {
    const error = new RateLimitError("Rate limited");
    expect(error.isRetryable).toBe(true);
  });

  it("should include retryAfter property", () => {
    const error = new RateLimitError("Rate limited", 60);
    expect(error.retryAfter).toBe(60);
  });

  it("should not require retryAfter", () => {
    const error = new RateLimitError("Rate limited");
    expect(error.retryAfter).toBeUndefined();
  });

  it("should be instance of ScraperError", () => {
    const error = new RateLimitError("Rate limited");
    expect(error).toBeInstanceOf(ScraperError);
    expect(error).toBeInstanceOf(RateLimitError);
  });
});

describe("InvalidUrlError", () => {
  it("should create error with URL in message", () => {
    const error = new InvalidUrlError("not-a-url");
    expect(error.message).toBe("Invalid URL: not-a-url");
    expect(error.name).toBe("InvalidUrlError");
  });

  it("should not be retryable", () => {
    const error = new InvalidUrlError("bad-url");
    expect(error.isRetryable).toBe(false);
  });

  it("should be instance of ScraperError", () => {
    const error = new InvalidUrlError("bad-url");
    expect(error).toBeInstanceOf(ScraperError);
    expect(error).toBeInstanceOf(InvalidUrlError);
  });

  it("should handle cause error", () => {
    const cause = new Error("Malformed URL");
    const error = new InvalidUrlError("bad-url", cause);
    expect(error.cause).toBe(cause);
  });
});

describe("ParsingError", () => {
  it("should create error with descriptive message", () => {
    const error = new ParsingError("Failed to parse JSON");
    expect(error.message).toBe("Failed to parse content: Failed to parse JSON");
    expect(error.name).toBe("ParsingError");
  });

  it("should not be retryable", () => {
    const error = new ParsingError("Parse error");
    expect(error.isRetryable).toBe(false);
  });

  it("should be instance of ScraperError", () => {
    const error = new ParsingError("Parse error");
    expect(error).toBeInstanceOf(ScraperError);
    expect(error).toBeInstanceOf(ParsingError);
  });

  it("should handle cause error", () => {
    const cause = new SyntaxError("Unexpected token");
    const error = new ParsingError("JSON parse failed", cause);
    expect(error.cause).toBe(cause);
  });
});

describe("RedirectError", () => {
  it("should create error with redirect information", () => {
    const error = new RedirectError("http://old.com", "http://new.com", 301);
    expect(error.originalUrl).toBe("http://old.com");
    expect(error.redirectUrl).toBe("http://new.com");
    expect(error.statusCode).toBe(301);
    expect(error.name).toBe("RedirectError");
  });

  it("should generate descriptive message", () => {
    const error = new RedirectError("http://old.com", "http://new.com", 302);
    expect(error.message).toBe(
      "Redirect detected from http://old.com to http://new.com (status: 302)",
    );
  });

  it("should not be retryable", () => {
    const error = new RedirectError("http://old.com", "http://new.com", 301);
    expect(error.isRetryable).toBe(false);
  });

  it("should be instance of ScraperError", () => {
    const error = new RedirectError("http://old.com", "http://new.com", 301);
    expect(error).toBeInstanceOf(ScraperError);
    expect(error).toBeInstanceOf(RedirectError);
  });

  it("should handle various redirect status codes", () => {
    const error301 = new RedirectError("a", "b", 301);
    const error302 = new RedirectError("a", "b", 302);
    const error303 = new RedirectError("a", "b", 303);
    const error307 = new RedirectError("a", "b", 307);
    const error308 = new RedirectError("a", "b", 308);

    expect(error301.statusCode).toBe(301);
    expect(error302.statusCode).toBe(302);
    expect(error303.statusCode).toBe(303);
    expect(error307.statusCode).toBe(307);
    expect(error308.statusCode).toBe(308);
  });
});

describe("ChallengeError", () => {
  it("should create error with challenge details", () => {
    const error = new ChallengeError("http://example.com", 403, "captcha");
    expect(error.url).toBe("http://example.com");
    expect(error.statusCode).toBe(403);
    expect(error.challengeType).toBe("captcha");
    expect(error.name).toBe("ChallengeError");
  });

  it("should generate descriptive message", () => {
    const error = new ChallengeError("http://example.com", 429, "rate-limit");
    expect(error.message).toBe(
      "Challenge detected for http://example.com (status: 429, type: rate-limit)",
    );
  });

  it("should not be retryable", () => {
    const error = new ChallengeError("http://example.com", 403, "captcha");
    expect(error.isRetryable).toBe(false);
  });

  it("should be instance of ScraperError", () => {
    const error = new ChallengeError("http://example.com", 403, "captcha");
    expect(error).toBeInstanceOf(ScraperError);
    expect(error).toBeInstanceOf(ChallengeError);
  });

  it("should handle different challenge types", () => {
    const captchaError = new ChallengeError("http://example.com", 403, "captcha");
    const cfError = new ChallengeError("http://example.com", 403, "cloudflare");
    const ipError = new ChallengeError("http://example.com", 429, "ip-block");

    expect(captchaError.challengeType).toBe("captcha");
    expect(cfError.challengeType).toBe("cloudflare");
    expect(ipError.challengeType).toBe("ip-block");
  });
});

describe("TimeoutError", () => {
  it("should create error with message", () => {
    const error = new TimeoutError("Request timed out");
    expect(error.message).toBe("Request timed out");
    expect(error.name).toBe("TimeoutError");
  });

  it("should be retryable by default", () => {
    const error = new TimeoutError("Timeout");
    expect(error.isRetryable).toBe(true);
  });

  it("should include timeout property", () => {
    const error = new TimeoutError("Timeout", 5000);
    expect(error.timeout).toBe(5000);
  });

  it("should not require timeout", () => {
    const error = new TimeoutError("Timeout");
    expect(error.timeout).toBeUndefined();
  });

  it("should be instance of ScraperError", () => {
    const error = new TimeoutError("Timeout");
    expect(error).toBeInstanceOf(ScraperError);
    expect(error).toBeInstanceOf(TimeoutError);
  });

  it("should handle cause error", () => {
    const cause = new Error("Connection timed out");
    const error = new TimeoutError("Request timeout", 30000, cause);
    expect(error.cause).toBe(cause);
    expect(error.timeout).toBe(30000);
  });
});

describe("ValidationError", () => {
  it("should create error with field and reason", () => {
    const error = new ValidationError("library", "", "Required field");
    expect(error.field).toBe("library");
    expect(error.value).toBe("");
    expect(error.reason).toBe("Required field");
    expect(error.name).toBe("ValidationError");
  });

  it("should generate descriptive message", () => {
    const error = new ValidationError("url", "invalid", "Invalid URL format");
    expect(error.message).toBe("Validation failed for url: Invalid URL format");
  });

  it("should not be retryable", () => {
    const error = new ValidationError("field", null, "Invalid");
    expect(error.isRetryable).toBe(false);
  });

  it("should be instance of ScraperError", () => {
    const error = new ValidationError("field", "value", "reason");
    expect(error).toBeInstanceOf(ScraperError);
    expect(error).toBeInstanceOf(ValidationError);
  });

  it("should handle various value types", () => {
    const stringError = new ValidationError("field", "value", "reason");
    const numberError = new ValidationError("count", 0, "must be positive");
    const nullError = new ValidationError("field", null, "required");
    const undefinedError = new ValidationError("field", undefined, "required");
    const objectError = new ValidationError("config", {}, "invalid");

    expect(stringError.value).toBe("value");
    expect(numberError.value).toBe(0);
    expect(nullError.value).toBe(null);
    expect(undefinedError.value).toBe(undefined);
    expect(objectError.value).toEqual({});
  });
});

describe("ServiceUnavailableError", () => {
  it("should create error with service name", () => {
    const error = new ServiceUnavailableError("Crawl4AI");
    expect(error.service).toBe("Crawl4AI");
    expect(error.message).toBe("Service Crawl4AI is unavailable");
    expect(error.name).toBe("ServiceUnavailableError");
  });

  it("should be retryable by default", () => {
    const error = new ServiceUnavailableError("Crawl4AI");
    expect(error.isRetryable).toBe(true);
  });

  it("should be instance of ScraperError", () => {
    const error = new ServiceUnavailableError("Crawl4AI");
    expect(error).toBeInstanceOf(ScraperError);
    expect(error).toBeInstanceOf(ServiceUnavailableError);
  });

  it("should handle cause error", () => {
    const cause = new Error("ECONNREFUSED");
    const error = new ServiceUnavailableError("Crawl4AI", cause);
    expect(error.cause).toBe(cause);
  });

  it("should handle various service names", () => {
    const qdrantError = new ServiceUnavailableError("Qdrant");
    const embeddingError = new ServiceUnavailableError("Embedding service");
    const dbError = new ServiceUnavailableError("Database");

    expect(qdrantError.service).toBe("Qdrant");
    expect(embeddingError.service).toBe("Embedding service");
    expect(dbError.service).toBe("Database");
  });
});

describe("Error inheritance and type checking", () => {
  it("should allow type narrowing with instanceof", () => {
    const errors: ScraperError[] = [
      new NetworkError("Network error", 500),
      new ValidationError("field", "value", "reason"),
      new TimeoutError("Timeout"),
    ];

    const networkErrors = errors.filter((e) => e instanceof NetworkError);
    const validationErrors = errors.filter((e) => e instanceof ValidationError);

    expect(networkErrors).toHaveLength(1);
    expect(validationErrors).toHaveLength(1);
  });

  it("should distinguish retryable from non-retryable errors", () => {
    const retryable = [
      new NetworkError("Network error"),
      new RateLimitError("Rate limit"),
      new TimeoutError("Timeout"),
      new ServiceUnavailableError("Service down"),
    ];

    const nonRetryable = [
      new InvalidUrlError("bad url"),
      new ParsingError("Parse error"),
      new RedirectError("a", "b", 301),
      new ChallengeError("url", 403, "captcha"),
      new ValidationError("f", "v", "r"),
    ];

    retryable.forEach((error) => {
      expect(error.isRetryable).toBe(true);
    });

    nonRetryable.forEach((error) => {
      expect(error.isRetryable).toBe(false);
    });
  });

  it("should preserve error names for debugging", () => {
    const errors: ScraperError[] = [
      new ScraperError("Base"),
      new NetworkError("Network", 500),
      new RateLimitError("Rate"),
      new InvalidUrlError("url"),
      new ParsingError("Parse"),
      new RedirectError("a", "b", 301),
      new ChallengeError("url", 403, "type"),
      new TimeoutError("Timeout"),
      new ValidationError("f", "v", "r"),
      new ServiceUnavailableError("Service"),
    ];

    const names = [
      "ScraperError",
      "NetworkError",
      "RateLimitError",
      "InvalidUrlError",
      "ParsingError",
      "RedirectError",
      "ChallengeError",
      "TimeoutError",
      "ValidationError",
      "ServiceUnavailableError",
    ];

    errors.forEach((error, index) => {
      expect(error.name).toBe(names[index]);
    });
  });
});
