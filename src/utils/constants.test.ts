/**
 * Unit tests for constants
 */

import { describe, expect, it } from "vitest";
import {
  Crawl4AIBrowserType,
  Crawl4AICacheMode,
  Crawl4AIScreenshotMode,
  Crawl4AIStealthMode,
  Crawl4AIVirtualScroll,
  Defaults,
  EnvVar,
  ErrorMessages,
  FetcherType,
  FileExtensions,
  HttpHeader,
  JobStatus,
  MimeType,
  ScraperScope,
  VersionStatus,
} from "./constants";

describe("FetcherType", () => {
  it("should have correct fetcher type values", () => {
    expect(FetcherType.AUTO).toBe("auto");
    expect(FetcherType.HTTP).toBe("http");
    expect(FetcherType.CRAWL4AI).toBe("crawl4ai");
    expect(FetcherType.FILE).toBe("file");
  });

  it("should have type-level immutability with 'as const'", () => {
    // TypeScript's 'as const' makes the properties readonly at compile time
    // At runtime, JavaScript doesn't enforce true immutability on object properties
    // but we can verify the types are as expected
    const autoValue: "auto" = FetcherType.AUTO;
    expect(autoValue).toBe("auto");
  });
});

describe("MimeType", () => {
  it("should have correct text MIME types", () => {
    expect(MimeType.HTML).toBe("text/html");
    expect(MimeType.XHTML).toBe("application/xhtml+xml");
    expect(MimeType.MARKDOWN).toBe("text/markdown");
    expect(MimeType.MARKDOWN_ALT).toBe("text/x-markdown");
    expect(MimeType.PLAIN).toBe("text/plain");
    expect(MimeType.CSS).toBe("text/css");
    expect(MimeType.JAVASCRIPT).toBe("text/javascript");
  });

  it("should have correct application MIME types", () => {
    expect(MimeType.JSON).toBe("application/json");
    expect(MimeType.XML).toBe("application/xml");
    expect(MimeType.PDF).toBe("application/pdf");
  });

  it("should have correct image MIME types", () => {
    expect(MimeType.PNG).toBe("image/png");
    expect(MimeType.JPEG).toBe("image/jpeg");
    expect(MimeType.JPG).toBe("image/jpg");
    expect(MimeType.GIF).toBe("image/gif");
    expect(MimeType.SVG).toBe("image/svg+xml");
    expect(MimeType.WEBP).toBe("image/webp");
  });

  it("should have correct video MIME types", () => {
    expect(MimeType.MP4).toBe("video/mp4");
    expect(MimeType.WEBM).toBe("video/webm");
  });

  it("should have correct audio MIME types", () => {
    expect(MimeType.MP3).toBe("audio/mpeg");
    expect(MimeType.WAV).toBe("audio/wav");
    expect(MimeType.OGG).toBe("audio/ogg");
  });
});

describe("HttpHeader", () => {
  it("should have correct header names", () => {
    expect(HttpHeader.ACCEPT).toBe("Accept");
    expect(HttpHeader.CONTENT_TYPE).toBe("Content-Type");
    expect(HttpHeader.USER_AGENT).toBe("User-Agent");
    expect(HttpHeader.AUTHORIZATION).toBe("Authorization");
    expect(HttpHeader.LOCATION).toBe("Location");
    expect(HttpHeader.ETAG).toBe("ETag");
    expect(HttpHeader.LAST_MODIFIED).toBe("Last-Modified");
  });
});

describe("VersionStatus", () => {
  it("should have correct status values", () => {
    expect(VersionStatus.NOT_INDEXED).toBe("not_indexed");
    expect(VersionStatus.QUEUED).toBe("queued");
    expect(VersionStatus.RUNNING).toBe("running");
    expect(VersionStatus.UPDATING).toBe("updating");
    expect(VersionStatus.COMPLETED).toBe("completed");
    expect(VersionStatus.FAILED).toBe("failed");
    expect(VersionStatus.CANCELLED).toBe("cancelled");
  });
});

describe("JobStatus", () => {
  it("should have correct status values", () => {
    expect(JobStatus.QUEUED).toBe("queued");
    expect(JobStatus.RUNNING).toBe("running");
    expect(JobStatus.COMPLETED).toBe("completed");
    expect(JobStatus.FAILED).toBe("failed");
    expect(JobStatus.CANCELLING).toBe("cancelling");
    expect(JobStatus.CANCELLED).toBe("cancelled");
  });
});

describe("Crawl4AICacheMode", () => {
  it("should have correct cache mode values", () => {
    expect(Crawl4AICacheMode.ENABLED).toBe("enabled");
    expect(Crawl4AICacheMode.DISABLED).toBe("disabled");
    expect(Crawl4AICacheMode.BYPASS).toBe("bypass");
    expect(Crawl4AICacheMode.WRITE_ONLY).toBe("write_only");
    expect(Crawl4AICacheMode.READ_ONLY).toBe("read_only");
    expect(Crawl4AICacheMode.FRESH).toBe("fresh");
  });
});

describe("Crawl4AIBrowserType", () => {
  it("should have correct browser type values", () => {
    expect(Crawl4AIBrowserType.CHROMIUM).toBe("chromium");
    expect(Crawl4AIBrowserType.FIREFOX).toBe("firefox");
    expect(Crawl4AIBrowserType.WEBKIT).toBe("webkit");
  });
});

describe("Crawl4AIStealthMode", () => {
  it("should have correct stealth mode values", () => {
    expect(Crawl4AIStealthMode.DISABLED).toBe("disabled");
    expect(Crawl4AIStealthMode.BASIC).toBe("basic");
    expect(Crawl4AIStealthMode.ADVANCED).toBe("advanced");
  });
});

describe("Crawl4AIScreenshotMode", () => {
  it("should have correct screenshot mode values", () => {
    expect(Crawl4AIScreenshotMode.VIEWPORT).toBe("viewport");
    expect(Crawl4AIScreenshotMode.FULL).toBe("full");
  });
});

describe("Crawl4AIVirtualScroll", () => {
  it("should have correct virtual scroll values", () => {
    expect(Crawl4AIVirtualScroll.CONTAINER_HEIGHT).toBe("container_height");
    expect(Crawl4AIVirtualScroll.PAGE_HEIGHT).toBe("page_height");
  });
});

describe("ScraperScope", () => {
  it("should have correct scope values", () => {
    expect(ScraperScope.SUBPAGES).toBe("subpages");
    expect(ScraperScope.HOSTNAME).toBe("hostname");
    expect(ScraperScope.DOMAIN).toBe("domain");
  });
});

describe("ErrorMessages", () => {
  it("should return formatted fetcher not available message", () => {
    expect(ErrorMessages.FETCHER_NOT_AVAILABLE("http")).toBe(
      'Fetcher "http" is not available',
    );
  });

  it("should return formatted service not available message", () => {
    expect(ErrorMessages.SERVICE_NOT_AVAILABLE("Crawl4AI", "http://localhost:8001")).toBe(
      "Crawl4AI service is not available at http://localhost:8001. Ensure the service is running.",
    );
  });

  it("should return formatted circuit breaker open message", () => {
    expect(ErrorMessages.CIRCUIT_BREAKER_OPEN("Crawl4AI", 60000)).toBe(
      "Crawl4AI service circuit breaker is open. Service appears to be unavailable. Try again in 60s",
    );
  });

  it("should return formatted empty content message", () => {
    expect(ErrorMessages.EMPTY_CONTENT("https://example.com")).toBe(
      "No content retrieved from https://example.com",
    );
  });

  it("should return formatted timeout message", () => {
    expect(ErrorMessages.TIMEOUT("https://example.com", 30000)).toBe(
      "Request to https://example.com timed out after 30000ms",
    );
  });

  it("should return formatted network error message", () => {
    expect(ErrorMessages.NETWORK_ERROR("https://example.com", "ECONNREFUSED")).toBe(
      "Network error fetching https://example.com: ECONNREFUSED",
    );
  });
});

describe("EnvVar", () => {
  it("should have correct environment variable names", () => {
    expect(EnvVar.CRAWL4AI_SERVICE_URL).toBe("CRAWL4AI_SERVICE_URL");
    expect(EnvVar.QDRANT_URL).toBe("QDRANT_URL");
    expect(EnvVar.DATABASE_URL).toBe("DATABASE_URL");
    expect(EnvVar.OPENAI_API_KEY).toBe("OPENAI_API_KEY");
    expect(EnvVar.COHERE_API_KEY).toBe("COHERE_API_KEY");
    expect(EnvVar.HUGGINGFACE_API_KEY).toBe("HUGGINGFACE_API_KEY");
    expect(EnvVar.EMBEDDING_PROVIDER).toBe("EMBEDDING_PROVIDER");
    expect(EnvVar.EMBEDDING_MODEL).toBe("EMBEDDING_MODEL");
    expect(EnvVar.LOG_LEVEL).toBe("LOG_LEVEL");
    expect(EnvVar.MCP_PORT).toBe("MCP_PORT");
    expect(EnvVar.WEB_PORT).toBe("WEB_PORT");
    expect(EnvVar.ENABLE_SCREENSHOTS).toBe("ENABLE_SCREENSHOTS");
    expect(EnvVar.ENABLE_MEDIA).toBe("ENABLE_MEDIA");
    expect(EnvVar.ENABLE_LINKS).toBe("ENABLE_LINKS");
  });
});

describe("FileExtensions", () => {
  it("should map MIME types to correct file extensions", () => {
    expect(FileExtensions[MimeType.HTML]).toBe(".html");
    expect(FileExtensions[MimeType.MARKDOWN]).toBe(".md");
    expect(FileExtensions[MimeType.JSON]).toBe(".json");
    expect(FileExtensions[MimeType.XML]).toBe(".xml");
    expect(FileExtensions[MimeType.PDF]).toBe(".pdf");
    expect(FileExtensions[MimeType.PNG]).toBe(".png");
    expect(FileExtensions[MimeType.JPEG]).toBe(".jpg");
    expect(FileExtensions[MimeType.GIF]).toBe(".gif");
    expect(FileExtensions[MimeType.SVG]).toBe(".svg");
    expect(FileExtensions[MimeType.CSS]).toBe(".css");
    expect(FileExtensions[MimeType.JAVASCRIPT]).toBe(".js");
  });
});

describe("Defaults", () => {
  it("should have correct default timeout values", () => {
    expect(Defaults.HTTP_TIMEOUT).toBe(30000);
    expect(Defaults.CRAWL4AI_TIMEOUT).toBe(60000);
    expect(Defaults.WAIT_FOR_TIMEOUT).toBe(30000);
  });

  it("should have correct default retry values", () => {
    expect(Defaults.MAX_RETRIES).toBe(3);
    expect(Defaults.RETRY_DELAY).toBe(1000);
  });

  it("should have correct default concurrency values", () => {
    expect(Defaults.MAX_CONCURRENCY).toBe(5);
  });

  it("should have correct default scraping limits", () => {
    expect(Defaults.MAX_PAGES).toBe(100);
    expect(Defaults.MAX_DEPTH).toBe(3);
  });

  it("should have correct default virtual scroll values", () => {
    expect(Defaults.VIRTUAL_SCROLL_DELAY).toBe(0.5);
    expect(Defaults.VIRTUAL_SCROLL_MAX_PAGES).toBe(10);
  });
});

describe("constant type safety", () => {
  it("should provide type inference for values", () => {
    const fetcher: "auto" | "http" | "crawl4ai" | "file" = FetcherType.AUTO;
    expect(fetcher).toBe("auto");

    const status:
      | "queued"
      | "running"
      | "completed"
      | "failed"
      | "cancelling"
      | "cancelled" = JobStatus.QUEUED;
    expect(status).toBe("queued");
  });

  it("should have correct values that remain unchanged", () => {
    // These tests verify the constants have expected values
    expect(FetcherType.AUTO).toBe("auto");
    expect(FetcherType.HTTP).toBe("http");
    expect(FetcherType.CRAWL4AI).toBe("crawl4ai");
    expect(FetcherType.FILE).toBe("file");
  });
});
