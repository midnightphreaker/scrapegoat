/**
 * MCP Tools for documentation management and scraping.
 *
 * @remarks
 * This module exports all tool classes used by the Scrapegoat MCP server.
 * Each tool encapsulates specific functionality for interacting with
 * the documentation system, including scraping, searching, and job management.
 *
 * Available Tools:
 * - {@link SearchTool} - Search indexed documentation with semantic queries
 * - {@link ScrapeTool} - Scrape and index documentation from web sources
 * - {@link ListLibrariesTool} - List all indexed libraries and versions
 * - {@link RemoveTool} - Remove indexed documentation
 * - {@link FetchUrlTool} - Fetch single URLs without indexing
 * - {@link FindVersionTool} - Find best matching library version
 * - {@link ListJobsTool} - List scraping jobs with status filtering
 * - {@link GetJobInfoTool} - Get detailed information about a specific job
 * - {@link CancelJobTool} - Cancel running or queued jobs
 * - {@link ClearCompletedJobsTool} - Clean up completed jobs
 *
 * Error Types:
 * - {@link ToolError} - Base error for tool operations
 * - {@link ValidationError} - Input validation errors
 *
 * @packageDocumentation
 *
 * @example
 * ```typescript
 * import { SearchTool, ScrapeTool, ListLibrariesTool } from './tools';
 *
 * // Create tool instances
 * const searchTool = new SearchTool(documentManagementService);
 * const scrapeTool = new ScrapeTool(pipeline);
 * const listLibrariesTool = new ListLibrariesTool(documentManagementService);
 *
 * // Use tools
 * const results = await searchTool.execute({
 *   library: 'react',
 *   query: 'useEffect hook'
 * });
 *
 * await scrapeTool.execute({
 *   library: 'typescript',
 *   url: 'https://www.typescriptlang.org/docs/'
 * });
 * ```
 */
export * from "./CancelJobTool";
export * from "./ClearCompletedJobsTool";
export * from "./errors";
export * from "./FetchUrlTool";
export * from "./FindVersionTool";
export * from "./GetJobInfoTool";
export * from "./ListJobsTool";
export * from "./ListLibrariesTool";
export * from "./RemoveTool";
export * from "./ScrapeTool";
export * from "./SearchTool";
