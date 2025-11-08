# Step-by-Step Implementation Guide - Phase 1.2

## Overview

This guide provides detailed, step-by-step instructions for implementing the TypeScript integration with the Crawl4AI Python service.

## Prerequisites

- Phase 1.1 completed (Python FastAPI service running)
- Python service accessible at http://localhost:8001
- TypeScript development environment set up
- Familiarity with existing fetcher architecture

---

## Step 1: Add Configuration Constants

**File**: `/home/mp/Workspace/scrapegoat/src/utils/config.ts`

**Action**: Add Crawl4AI configuration constants at the end of the file.

**Code to Add**:

```typescript
/**
 * Crawl4AI service base URL.
 * Set via CRAWL4AI_SERVICE_URL environment variable.
 */
export const CRAWL4AI_SERVICE_URL =
  process.env.CRAWL4AI_SERVICE_URL || "http://localhost:8001";

/**
 * Crawl4AI request timeout in milliseconds.
 * Set via CRAWL4AI_TIMEOUT environment variable.
 */
export const CRAWL4AI_TIMEOUT = parseInt(
  process.env.CRAWL4AI_TIMEOUT || "30000",
  10,
);

/**
 * Crawl4AI maximum retry attempts.
 * Set via CRAWL4AI_MAX_RETRIES environment variable.
 */
export const CRAWL4AI_MAX_RETRIES = parseInt(
  process.env.CRAWL4AI_MAX_RETRIES || "3",
  10,
);
```

**Validation**:
- Run `npm run build` to ensure no TypeScript errors
- Verify constants are exported and accessible

---

## Step 2: Create Crawl4AIFetcher

**File**: `/home/mp/Workspace/scrapegoat/src/scraper/fetcher/crawl4ai/Crawl4AIFetcher.ts`

**Action**: Create new file implementing ContentFetcher interface.

**Full Implementation**:

```typescript
import { logger } from "../../../utils/logger";
import { ScraperError } from "../../../utils/errors";
import { CRAWL4AI_SERVICE_URL, CRAWL4AI_TIMEOUT, CRAWL4AI_MAX_RETRIES } from "../../../utils/config";
import type { ContentFetcher, FetchOptions, RawContent } from "../types";
import { Crawl4AIClient } from "./Crawl4AIClient";
import type { Crawl4AIRequest, Crawl4AIConfig } from "./types";

/**
 * Fetches content using the Crawl4AI Python service.
 *
 * This fetcher communicates with a separate Python service that uses Crawl4AI
 * for advanced web scraping with JavaScript rendering and anti-bot bypass.
 *
 * Features:
 * - JavaScript rendering via Playwright
 * - Anti-bot detection bypass
 * - BM25-filtered markdown (removes boilerplate/ads)
 * - Screenshot capture
 * - Media extraction
 *
 * Usage:
 * ```typescript
 * const fetcher = new Crawl4AIFetcher();
 * const content = await fetcher.fetch('https://example.com');
 * ```
 */
export class Crawl4AIFetcher implements ContentFetcher {
  private readonly client: Crawl4AIClient;

  constructor(baseUrl?: string) {
    this.client = new Crawl4AIClient({
      baseUrl: baseUrl || CRAWL4AI_SERVICE_URL,
      timeout: CRAWL4AI_TIMEOUT,
      maxRetries: CRAWL4AI_MAX_RETRIES,
    });
  }

  /**
   * Check if this fetcher can handle the given source.
   * Crawl4AIFetcher supports HTTP and HTTPS URLs.
   */
  canFetch(source: string): boolean {
    return source.startsWith("http://") || source.startsWith("https://");
  }

  /**
   * Fetch content from the source using Crawl4AI service.
   *
   * @param source - The URL to fetch
   * @param options - Fetch options (timeout, signal, etc.)
   * @returns RawContent with markdown content
   */
  async fetch(source: string, options?: FetchOptions): Promise<RawContent> {
    try {
      // Check if service is available first
      const isAvailable = await this.client.isAvailable();
      if (!isAvailable) {
        const circuitState = this.client.getCircuitState();
        if (circuitState.state === "open") {
          throw new ScraperError(
            `Crawl4AI service circuit breaker is open. Service appears to be unavailable. Try again later.`,
            false,
          );
        }
        throw new ScraperError(
          `Crawl4AI service is not available at ${CRAWL4AI_SERVICE_URL}. Ensure the Python service is running.`,
          false,
        );
      }

      // Build Crawl4AI request
      const crawl4aiConfig: Crawl4AIConfig = {
        cacheMode: "enabled",
        useFitMarkdown: true, // Use BM25-filtered markdown for better quality
        removeOverlays: true,
        screenshot: false,
        extractMedia: false,
        waitForTimeout: options?.timeout || CRAWL4AI_TIMEOUT,
      };

      const request: Crawl4AIRequest = {
        url: source,
        config: crawl4aiConfig,
      };

      logger.debug(`Fetching ${source} via Crawl4AI service...`);

      // Make request to Crawl4AI service
      const response = await this.client.crawl(request, {
        signal: options?.signal,
        timeout: options?.timeout || CRAWL4AI_TIMEOUT,
      });

      // Handle unsuccessful response
      if (!response.success || !response.data) {
        const errorMsg = response.error
          ? `${response.error.code}: ${response.error.message}`
          : "Unknown error";
        throw new ScraperError(
          `Crawl4AI service returned error for ${source}: ${errorMsg}`,
          false,
        );
      }

      const data = response.data;

      // Select the best markdown variant
      // Priority: fitMarkdown (BM25-filtered) > rawMarkdown > markdown
      const markdown = data.fitMarkdown || data.rawMarkdown || data.markdown;

      if (!markdown || markdown.trim().length === 0) {
        throw new ScraperError(
          `Crawl4AI returned empty content for ${source}`,
          false,
        );
      }

      // Use the final URL from metadata (handles redirects)
      const finalUrl = data.metadata.url || source;

      logger.debug(
        `Crawl4AI fetch successful: ${source} -> ${finalUrl} (${markdown.length} chars, ${data.metadata.crawlTime.toFixed(2)}s)`,
      );

      // Return as RawContent with markdown mime type
      return {
        content: Buffer.from(markdown, "utf-8"),
        mimeType: "text/markdown",
        charset: "utf-8",
        encoding: undefined,
        source: finalUrl,
      };
    } catch (error) {
      // Handle cancellation
      if (options?.signal?.aborted) {
        throw new ScraperError("Crawl4AI fetch cancelled", false);
      }

      // Re-throw ScraperErrors as-is
      if (error instanceof ScraperError) {
        throw error;
      }

      // Wrap other errors
      logger.error(`Crawl4AI fetch failed for ${source}: ${error}`);
      throw new ScraperError(
        `Crawl4AI fetch failed for ${source}: ${error instanceof Error ? error.message : String(error)}`,
        false,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Check if the Crawl4AI service is available.
   * Useful for health checks and graceful degradation.
   */
  async isAvailable(): Promise<boolean> {
    return this.client.isAvailable();
  }

  /**
   * Get current circuit breaker state (for monitoring/debugging).
   */
  getCircuitState() {
    return this.client.getCircuitState();
  }

  /**
   * No cleanup needed for HTTP client.
   */
  async close(): Promise<void> {
    // No-op: HTTP client doesn't need cleanup
  }
}
```

**Key Points**:
- Implements `ContentFetcher` interface exactly
- Uses `Crawl4AIClient` for HTTP communication
- Returns markdown as `RawContent` with `mimeType: "text/markdown"`
- Handles errors gracefully with ScraperError
- Checks service availability before making requests
- Uses fitMarkdown (BM25-filtered) for best quality
- Respects AbortSignal for cancellation

**Validation**:
- Run `npm run build` to check for TypeScript errors
- Verify imports resolve correctly

---

## Step 3: Export Crawl4AIFetcher

**File**: `/home/mp/Workspace/scrapegoat/src/scraper/fetcher/crawl4ai/index.ts`

**Action**: Create barrel export file for crawl4ai module.

**Code**:

```typescript
export * from "./Crawl4AIClient";
export * from "./Crawl4AIFetcher";
export * from "./types";
```

**Then Update**: `/home/mp/Workspace/scrapegoat/src/scraper/fetcher/index.ts`

**Add Export**:

```typescript
export * from "./AutoDetectFetcher";
export * from "./BrowserFetcher";
export * from "./FileFetcher";
export * from "./HttpFetcher";
export * from "./crawl4ai"; // Add this line
export * from "./types";
```

**Validation**:
- Verify exports work: `import { Crawl4AIFetcher } from '../fetcher';`
- Run `npm run build`

---

## Step 4: Create Unit Tests

**File**: `/home/mp/Workspace/scrapegoat/src/scraper/fetcher/crawl4ai/Crawl4AIFetcher.test.ts`

**Action**: Create comprehensive unit tests.

**Test Implementation**:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Crawl4AIFetcher } from "./Crawl4AIFetcher";
import { Crawl4AIClient } from "./Crawl4AIClient";
import { ScraperError } from "../../../utils/errors";
import type { Crawl4AIResponse } from "./types";

// Mock Crawl4AIClient
vi.mock("./Crawl4AIClient");

describe("Crawl4AIFetcher", () => {
  let fetcher: Crawl4AIFetcher;
  let mockClient: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock client
    mockClient = {
      isAvailable: vi.fn(),
      crawl: vi.fn(),
      getCircuitState: vi.fn(),
    };

    // Mock constructor to return our mock client
    vi.mocked(Crawl4AIClient).mockImplementation(() => mockClient);

    fetcher = new Crawl4AIFetcher();
  });

  afterEach(async () => {
    await fetcher.close();
  });

  describe("canFetch", () => {
    it("should return true for HTTP URLs", () => {
      expect(fetcher.canFetch("http://example.com")).toBe(true);
    });

    it("should return true for HTTPS URLs", () => {
      expect(fetcher.canFetch("https://example.com")).toBe(true);
    });

    it("should return false for file URLs", () => {
      expect(fetcher.canFetch("file:///path/to/file")).toBe(false);
    });

    it("should return false for other protocols", () => {
      expect(fetcher.canFetch("ftp://example.com")).toBe(false);
    });
  });

  describe("fetch", () => {
    it("should fetch content successfully", async () => {
      // Setup mocks
      mockClient.isAvailable.mockResolvedValue(true);
      mockClient.crawl.mockResolvedValue({
        success: true,
        data: {
          markdown: "# Test Content",
          fitMarkdown: "# Test Content (filtered)",
          metadata: {
            url: "https://example.com",
            statusCode: 200,
            title: "Test Page",
            crawlTime: 1.5,
          },
        },
      } as Crawl4AIResponse);

      const result = await fetcher.fetch("https://example.com");

      expect(result).toEqual({
        content: Buffer.from("# Test Content (filtered)", "utf-8"),
        mimeType: "text/markdown",
        charset: "utf-8",
        encoding: undefined,
        source: "https://example.com",
      });

      expect(mockClient.isAvailable).toHaveBeenCalled();
      expect(mockClient.crawl).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://example.com",
        }),
        expect.any(Object),
      );
    });

    it("should throw error when service is unavailable", async () => {
      mockClient.isAvailable.mockResolvedValue(false);
      mockClient.getCircuitState.mockReturnValue({
        state: "closed",
        failureCount: 0,
        lastFailureTime: 0,
      });

      await expect(fetcher.fetch("https://example.com")).rejects.toThrow(
        ScraperError,
      );
      await expect(fetcher.fetch("https://example.com")).rejects.toThrow(
        /service is not available/i,
      );
    });

    it("should throw error when circuit breaker is open", async () => {
      mockClient.isAvailable.mockResolvedValue(false);
      mockClient.getCircuitState.mockReturnValue({
        state: "open",
        failureCount: 5,
        lastFailureTime: Date.now(),
      });

      await expect(fetcher.fetch("https://example.com")).rejects.toThrow(
        ScraperError,
      );
      await expect(fetcher.fetch("https://example.com")).rejects.toThrow(
        /circuit breaker is open/i,
      );
    });

    it("should throw error when Crawl4AI returns error", async () => {
      mockClient.isAvailable.mockResolvedValue(true);
      mockClient.crawl.mockResolvedValue({
        success: false,
        error: {
          code: "CRAWL_ERROR",
          message: "Failed to crawl page",
        },
      } as Crawl4AIResponse);

      await expect(fetcher.fetch("https://example.com")).rejects.toThrow(
        ScraperError,
      );
      await expect(fetcher.fetch("https://example.com")).rejects.toThrow(
        /CRAWL_ERROR/,
      );
    });

    it("should throw error when content is empty", async () => {
      mockClient.isAvailable.mockResolvedValue(true);
      mockClient.crawl.mockResolvedValue({
        success: true,
        data: {
          markdown: "",
          metadata: {
            url: "https://example.com",
            statusCode: 200,
            crawlTime: 1.0,
          },
        },
      } as Crawl4AIResponse);

      await expect(fetcher.fetch("https://example.com")).rejects.toThrow(
        ScraperError,
      );
      await expect(fetcher.fetch("https://example.com")).rejects.toThrow(
        /empty content/i,
      );
    });

    it("should handle cancellation via AbortSignal", async () => {
      const controller = new AbortController();
      controller.abort();

      mockClient.isAvailable.mockResolvedValue(true);

      await expect(
        fetcher.fetch("https://example.com", { signal: controller.signal }),
      ).rejects.toThrow(ScraperError);
      await expect(
        fetcher.fetch("https://example.com", { signal: controller.signal }),
      ).rejects.toThrow(/cancelled/i);
    });

    it("should prefer fitMarkdown over rawMarkdown", async () => {
      mockClient.isAvailable.mockResolvedValue(true);
      mockClient.crawl.mockResolvedValue({
        success: true,
        data: {
          markdown: "# Regular",
          rawMarkdown: "# Raw",
          fitMarkdown: "# Fit",
          metadata: {
            url: "https://example.com",
            statusCode: 200,
            crawlTime: 1.0,
          },
        },
      } as Crawl4AIResponse);

      const result = await fetcher.fetch("https://example.com");

      expect(result.content.toString("utf-8")).toBe("# Fit");
    });

    it("should use finalUrl from metadata", async () => {
      mockClient.isAvailable.mockResolvedValue(true);
      mockClient.crawl.mockResolvedValue({
        success: true,
        data: {
          markdown: "# Content",
          metadata: {
            url: "https://example.com/final",
            statusCode: 200,
            crawlTime: 1.0,
          },
        },
      } as Crawl4AIResponse);

      const result = await fetcher.fetch("https://example.com/initial");

      expect(result.source).toBe("https://example.com/final");
    });
  });

  describe("isAvailable", () => {
    it("should return true when service is available", async () => {
      mockClient.isAvailable.mockResolvedValue(true);

      expect(await fetcher.isAvailable()).toBe(true);
    });

    it("should return false when service is unavailable", async () => {
      mockClient.isAvailable.mockResolvedValue(false);

      expect(await fetcher.isAvailable()).toBe(false);
    });
  });

  describe("getCircuitState", () => {
    it("should return circuit state from client", () => {
      const expectedState = {
        state: "closed" as const,
        failureCount: 0,
        lastFailureTime: 0,
      };
      mockClient.getCircuitState.mockReturnValue(expectedState);

      expect(fetcher.getCircuitState()).toEqual(expectedState);
    });
  });
});
```

**Validation**:
- Run tests: `npm test Crawl4AIFetcher.test.ts`
- All tests should pass
- Code coverage should be >90%

---

## Step 5: Create Integration Test

**File**: `/home/mp/Workspace/scrapegoat/src/scraper/fetcher/crawl4ai/Crawl4AIFetcher.integration.test.ts`

**Action**: Create integration test that requires running Python service.

**Code**:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Crawl4AIFetcher } from "./Crawl4AIFetcher";
import { Crawl4AIClient } from "./Crawl4AIClient";

/**
 * Integration tests for Crawl4AIFetcher.
 *
 * These tests require the Crawl4AI Python service to be running.
 * Run with: npm test -- Crawl4AIFetcher.integration.test.ts
 *
 * Prerequisites:
 * - Python service running at http://localhost:8001
 * - Service health endpoint responding
 */
describe("Crawl4AIFetcher Integration Tests", () => {
  let fetcher: Crawl4AIFetcher;
  let isServiceAvailable = false;

  beforeAll(async () => {
    fetcher = new Crawl4AIFetcher();

    // Check if service is available
    isServiceAvailable = await fetcher.isAvailable();

    if (!isServiceAvailable) {
      console.warn(
        "⚠️  Crawl4AI service not available. Integration tests will be skipped.",
      );
      console.warn(
        "   Start the service with: cd services/crawl4ai && docker-compose up",
      );
    }
  });

  afterAll(async () => {
    await fetcher.close();
  });

  it("should skip tests if service is not available", () => {
    if (!isServiceAvailable) {
      expect(isServiceAvailable).toBe(false);
    }
  });

  it("should fetch real webpage content", async () => {
    if (!isServiceAvailable) {
      console.log("Skipping - service not available");
      return;
    }

    // Use a simple, reliable test URL
    const url = "https://example.com";
    const result = await fetcher.fetch(url);

    expect(result).toBeDefined();
    expect(result.mimeType).toBe("text/markdown");
    expect(result.content).toBeInstanceOf(Buffer);
    expect(result.content.length).toBeGreaterThan(0);

    const markdown = result.content.toString("utf-8");
    expect(markdown).toContain("Example Domain");
  }, 30000); // 30s timeout for real network request

  it("should handle redirects correctly", async () => {
    if (!isServiceAvailable) {
      console.log("Skipping - service not available");
      return;
    }

    const url = "http://example.com"; // Should redirect to https
    const result = await fetcher.fetch(url);

    expect(result.source).toMatch(/^https:\/\//);
  }, 30000);

  it("should return circuit breaker state", () => {
    const state = fetcher.getCircuitState();

    expect(state).toHaveProperty("state");
    expect(state).toHaveProperty("failureCount");
    expect(state).toHaveProperty("lastFailureTime");
  });
});
```

**Note**: These tests require the Python service to be running. They will be skipped if the service is unavailable.

**Validation**:
- Start Python service: `cd services/crawl4ai && docker-compose up`
- Run integration tests: `npm test Crawl4AIFetcher.integration.test.ts`
- Tests should pass if service is running, skip gracefully if not

---

## Step 6: Update Documentation

**File**: `/home/mp/Workspace/scrapegoat/README.md` or relevant docs

**Action**: Document how to use Crawl4AIFetcher.

**Documentation to Add**:

```markdown
### Using Crawl4AI Fetcher

Crawl4AI is an advanced web scraping service that provides:
- JavaScript rendering via Playwright
- Anti-bot detection bypass
- BM25-filtered markdown (removes boilerplate/ads)
- Screenshot capture
- Media extraction

#### Prerequisites

Start the Crawl4AI Python service:

```bash
cd services/crawl4ai
docker-compose up -d
```

Verify service is running:

```bash
curl http://localhost:8001/health
```

#### Configuration

Set environment variables:

```bash
export CRAWL4AI_SERVICE_URL="http://localhost:8001"
export CRAWL4AI_TIMEOUT="30000"
export CRAWL4AI_MAX_RETRIES="3"
```

#### Usage Example

```typescript
import { Crawl4AIFetcher } from "./scraper/fetcher";

const fetcher = new Crawl4AIFetcher();

// Check if service is available
if (await fetcher.isAvailable()) {
  const content = await fetcher.fetch("https://example.com");
  console.log(content.content.toString("utf-8")); // Markdown content
} else {
  console.error("Crawl4AI service is not available");
}
```

#### Error Handling

The fetcher implements circuit breaker pattern:

```typescript
try {
  const content = await fetcher.fetch(url);
} catch (error) {
  if (error instanceof ScraperError) {
    // Check circuit state
    const state = fetcher.getCircuitState();
    if (state.state === "open") {
      console.log("Circuit breaker is open - service unavailable");
    }
  }
}
```
```

---

## Step 7: Environment Configuration

**File**: `.env.example` (create if doesn't exist)

**Action**: Document environment variables.

**Add**:

```bash
# Crawl4AI Service Configuration
CRAWL4AI_SERVICE_URL=http://localhost:8001
CRAWL4AI_TIMEOUT=30000
CRAWL4AI_MAX_RETRIES=3
```

---

## Step 8: Final Verification

**Checklist**:

1. **Build Check**
   ```bash
   npm run build
   ```
   Should complete without errors.

2. **Unit Tests**
   ```bash
   npm test Crawl4AIFetcher.test.ts
   ```
   All tests should pass.

3. **Integration Tests** (with service running)
   ```bash
   npm test Crawl4AIFetcher.integration.test.ts
   ```
   Tests should pass or skip gracefully.

4. **Type Checking**
   ```bash
   npm run type-check
   ```
   No TypeScript errors.

5. **Linting**
   ```bash
   npm run lint
   ```
   No linting errors.

6. **Service Health Check**
   ```bash
   curl http://localhost:8001/health
   ```
   Should return: `{"status":"ok","version":"1.0.0","uptime":...}`

7. **Manual Test**
   Create test script: `test-crawl4ai.ts`
   ```typescript
   import { Crawl4AIFetcher } from "./src/scraper/fetcher";

   async function test() {
     const fetcher = new Crawl4AIFetcher();

     console.log("Checking service availability...");
     const available = await fetcher.isAvailable();
     console.log("Service available:", available);

     if (available) {
       console.log("Fetching example.com...");
       const result = await fetcher.fetch("https://example.com");
       console.log("Success!");
       console.log("Content length:", result.content.length);
       console.log("MIME type:", result.mimeType);
       console.log("Source:", result.source);
     }
   }

   test().catch(console.error);
   ```

   Run: `npx tsx test-crawl4ai.ts`

---

## Troubleshooting

### Service Not Available

**Problem**: `Crawl4AI service is not available`

**Solutions**:
1. Check service is running: `docker ps | grep crawl4ai`
2. Check service health: `curl http://localhost:8001/health`
3. Check logs: `docker-compose logs -f` in services/crawl4ai
4. Verify URL matches: `echo $CRAWL4AI_SERVICE_URL`

### Circuit Breaker Open

**Problem**: `Circuit breaker is open`

**Solutions**:
1. Wait 60 seconds for auto-recovery
2. Restart the Python service
3. Check service logs for errors
4. Verify network connectivity

### TypeScript Errors

**Problem**: Import errors or type errors

**Solutions**:
1. Run `npm install` to ensure dependencies
2. Check tsconfig.json includes src directory
3. Verify barrel exports in index.ts files
4. Run `npm run build` for detailed errors

### Empty Content

**Problem**: Fetcher returns empty markdown

**Solutions**:
1. Check if URL is accessible
2. Verify Crawl4AI service is working: test with curl
3. Check service logs for errors
4. Try a simpler URL (like example.com)

---

## Next Steps

After completing this implementation:

1. **Optional**: Integrate into AutoDetectFetcher with feature flag
2. **Optional**: Add custom Crawl4AI config options (screenshots, media extraction)
3. **Optional**: Create strategy that specifically uses Crawl4AI for JS-heavy sites
4. **Monitor**: Set up monitoring for circuit breaker state
5. **Performance**: Profile and optimize if needed

---

Last Updated: 2025-11-08
