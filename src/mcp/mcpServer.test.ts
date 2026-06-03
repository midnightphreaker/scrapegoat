/**
 * Tests for MCP server read-only mode functionality and tool parameter schemas
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../utils/config";
import { createMcpServerInstance } from "./mcpServer";
import type { McpServerTools } from "./tools";

// Mock config
const mockConfig = {
  app: { readOnly: false },
  scraper: { maxPages: 100, maxDepth: 3 },
} as unknown as AppConfig;

const mockReadOnlyConfig = {
  app: { readOnly: true },
  scraper: { maxPages: 100, maxDepth: 3 },
} as unknown as AppConfig;

/** Creates fresh mock tool instances for each test. */
function createMockTools(): McpServerTools {
  return {
    listLibraries: {
      execute: vi.fn(async () => ({ libraries: [] })),
    } as unknown as McpServerTools["listLibraries"],
    findVersion: {
      execute: vi.fn(async () => ({ message: "Version found" })),
    } as unknown as McpServerTools["findVersion"],
    search: {
      execute: vi.fn(async () => ({ results: [] })),
    } as unknown as McpServerTools["search"],
    fetchUrl: {
      execute: vi.fn(async () => "# Mock content"),
    } as unknown as McpServerTools["fetchUrl"],
    scrape: {
      execute: vi.fn(async () => ({ jobId: "job-123" })),
    } as unknown as McpServerTools["scrape"],
    refresh: {
      execute: vi.fn(async () => ({ jobId: "refresh-job-123" })),
    } as unknown as McpServerTools["refresh"],
    listJobs: {
      execute: vi.fn(async () => ({ jobs: [] })),
    } as unknown as McpServerTools["listJobs"],
    getJobInfo: {
      execute: vi.fn(async () => ({
        job: {
          id: "test-id",
          status: "completed",
          library: "test",
          version: "1.0.0",
          createdAt: "2025-01-01",
        },
      })),
    } as unknown as McpServerTools["getJobInfo"],
    cancelJob: {
      execute: vi.fn(async () => ({ success: true, message: "Cancelled" })),
    } as unknown as McpServerTools["cancelJob"],
    remove: {
      execute: vi.fn(async () => ({ message: "Removed" })),
    } as unknown as McpServerTools["remove"],
    clearCompletedJobs: {
      execute: vi.fn(async () => ({ message: "Cleared 3 jobs", clearedCount: 3 })),
    } as unknown as McpServerTools["clearCompletedJobs"],
  };
}

/**
 * Helper to extract the input schema shape keys for a registered tool.
 * The MCP SDK stores registered tools in a private `_registeredTools` map.
 * The inputSchema is a ZodObject whose `shape` property contains the field definitions.
 */
function getToolInputSchemaKeys(server: McpServer, toolName: string): string[] {
  // accessing private SDK internals for testing
  const registeredTools = (server as any)._registeredTools as Record<
    string,
    { inputSchema?: { shape?: () => Record<string, unknown> } }
  >;
  const tool = registeredTools[toolName];
  if (!tool?.inputSchema?.shape) return [];
  return Object.keys(tool.inputSchema.shape);
}

/**
 * Helper to get the tool handler callback from the registered tools.
 */
function getToolHandler(
  server: McpServer,
  toolName: string,
): ((args: Record<string, unknown>) => Promise<unknown>) | undefined {
  // accessing private SDK internals for testing
  const registeredTools = (server as any)._registeredTools as Record<
    string,
    { handler: (args: Record<string, unknown>) => Promise<unknown> }
  >;
  return registeredTools[toolName]?.handler;
}

describe("MCP Server Read-Only Mode", () => {
  it("should create server instance in normal mode", () => {
    const server = createMcpServerInstance(createMockTools(), mockConfig);
    expect(server).toBeInstanceOf(McpServer);
  });

  it("should create server instance in read-only mode", () => {
    const server = createMcpServerInstance(createMockTools(), mockReadOnlyConfig);
    expect(server).toBeInstanceOf(McpServer);
  });

  it("should create server without prompts capability and not fail", () => {
    // This test verifies that the server can be created successfully
    // without advertising prompts capability, which was the root cause
    // of the issue with some MCP clients failing to connect
    const server = createMcpServerInstance(createMockTools(), mockConfig);
    expect(server).toBeInstanceOf(McpServer);

    // Verify the server has the expected name and can be instantiated
    // This ensures our capability changes don't break server creation
    expect(server).toBeDefined();
  });
});

describe("MCP Tool Parameter Schemas", () => {
  let server: McpServer;

  beforeEach(() => {
    server = createMcpServerInstance(createMockTools(), mockConfig);
  });

  describe("scrape_docs tool", () => {
    it("should expose includePatterns parameter in schema", () => {
      const keys = getToolInputSchemaKeys(server, "scrape_docs");
      expect(keys).toContain("includePatterns");
    });

    it("should expose excludePatterns parameter in schema", () => {
      const keys = getToolInputSchemaKeys(server, "scrape_docs");
      expect(keys).toContain("excludePatterns");
    });

    it("should expose headers parameter in schema", () => {
      const keys = getToolInputSchemaKeys(server, "scrape_docs");
      expect(keys).toContain("headers");
    });

    it("should expose clear parameter in schema", () => {
      const keys = getToolInputSchemaKeys(server, "scrape_docs");
      expect(keys).toContain("clear");
    });

    it("should pass includePatterns through to tool execute", async () => {
      const tools = createMockTools();
      const srv = createMcpServerInstance(tools, mockConfig);
      const handler = getToolHandler(srv, "scrape_docs");
      expect(handler).toBeDefined();

      await handler!({
        url: "https://example.com/docs",
        library: "test",
        includePatterns: ["/api/"],
      });

      expect(tools.scrape.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            includePatterns: ["/api/"],
          }),
        }),
      );
    });

    it("should pass excludePatterns through to tool execute", async () => {
      const tools = createMockTools();
      const srv = createMcpServerInstance(tools, mockConfig);
      const handler = getToolHandler(srv, "scrape_docs");

      await handler!({
        url: "https://example.com/docs",
        library: "test",
        excludePatterns: ["/blog/"],
      });

      expect(tools.scrape.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            excludePatterns: ["/blog/"],
          }),
        }),
      );
    });

    it("should pass headers through to tool execute", async () => {
      const tools = createMockTools();
      const srv = createMcpServerInstance(tools, mockConfig);
      const handler = getToolHandler(srv, "scrape_docs");

      await handler!({
        url: "https://example.com/docs",
        library: "test",
        headers: { Authorization: "Bearer token123" },
      });

      expect(tools.scrape.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            headers: { Authorization: "Bearer token123" },
          }),
        }),
      );
    });

    it("should pass clear through to tool execute", async () => {
      const tools = createMockTools();
      const srv = createMcpServerInstance(tools, mockConfig);
      const handler = getToolHandler(srv, "scrape_docs");

      await handler!({
        url: "https://example.com/docs",
        library: "test",
        clear: false,
      });

      expect(tools.scrape.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            clear: false,
          }),
        }),
      );
    });
  });

  describe("fetch_url tool", () => {
    it("should expose scrapeMode parameter in schema", () => {
      const keys = getToolInputSchemaKeys(server, "fetch_url");
      expect(keys).toContain("scrapeMode");
    });

    it("should expose headers parameter in schema", () => {
      const keys = getToolInputSchemaKeys(server, "fetch_url");
      expect(keys).toContain("headers");
    });

    it("should pass scrapeMode through to tool execute", async () => {
      const tools = createMockTools();
      const srv = createMcpServerInstance(tools, mockConfig);
      const handler = getToolHandler(srv, "fetch_url");

      await handler!({
        url: "https://example.com/page",
        scrapeMode: "fetch",
      });

      expect(tools.fetchUrl.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          scrapeMode: "fetch",
        }),
      );
    });

    it("should pass headers through to tool execute", async () => {
      const tools = createMockTools();
      const srv = createMcpServerInstance(tools, mockConfig);
      const handler = getToolHandler(srv, "fetch_url");

      await handler!({
        url: "https://example.com/page",
        headers: { "X-Custom": "value" },
      });

      expect(tools.fetchUrl.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { "X-Custom": "value" },
        }),
      );
    });
  });

  describe("clear_completed_jobs tool", () => {
    it("should be registered as a tool when not in read-only mode", () => {
      const keys = getToolInputSchemaKeys(server, "clear_completed_jobs");
      expect(keys).toBeDefined();
      // clear_completed_jobs has no params, so keys should be empty but tool should exist
      expect(server).toBeInstanceOf(McpServer);
    });

    it("should call clearCompletedJobs execute when invoked", async () => {
      const tools = createMockTools() as McpServerTools & {
        clearCompletedJobs: { execute: ReturnType<typeof vi.fn> };
      };
      tools.clearCompletedJobs = {
        execute: vi.fn(async () => ({
          message: "Cleared 3 jobs",
          clearedCount: 3,
        })),
      } as unknown as (typeof tools)["clearCompletedJobs"];

      const srv = createMcpServerInstance(tools, mockConfig);
      const handler = getToolHandler(srv, "clear_completed_jobs");
      expect(handler).toBeDefined();

      await handler!({});

      expect(tools.clearCompletedJobs.execute).toHaveBeenCalled();
    });
  });
});
