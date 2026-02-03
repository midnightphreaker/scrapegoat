/**
 * MCP tool initialization and management.
 *
 * @module mcp/tools
 *
 * @remarks
 * This module provides the factory function for initializing all MCP tools
 * used by the Scrapegoat server. It creates tool instances with their required
 * dependencies and provides a unified interface for tool access.
 *
 * Main Exports:
 * - {@link McpServerTools} - Interface defining all available tools
 * - {@link initializeTools} - Factory function for tool initialization
 *
 * Related Modules:
 * - {@link ../tools} - Individual tool implementations
 * - {@link ../mcpServer} - MCP server that uses these tools
 *
 * @packageDocumentation
 *
 * @example
 * ```typescript
 * import { initializeTools } from './mcp/tools';
 * import { DocumentManagementService } from './store';
 * import { PipelineManager } from './pipeline';
 *
 * // Initialize services
 * const docService = new DocumentManagementService(config);
 * await docService.initialize();
 *
 * const pipeline = new PipelineManager(options);
 * await pipeline.start();
 *
 * // Initialize tools
 * const tools = await initializeTools(docService, pipeline);
 *
 * // Tools are now available
 * await tools.search.execute({ library: 'react', query: 'hooks' });
 * ```
 */

import type { IPipeline } from "../pipeline/trpc/interfaces";
import { AutoDetectFetcher } from "../scraper/fetcher";
import type { IDocumentManagement } from "../store/trpc/interfaces";
import {
  CancelJobTool,
  FetchUrlTool,
  FindVersionTool,
  GetJobInfoTool,
  ListJobsTool,
  ListLibrariesTool,
  RemoveTool,
  ScrapeTool,
  SearchTool,
} from "../tools";

/**
 * Interface for the shared tool instances.
 *
 * @remarks
 * This interface defines the collection of MCP tools exposed by the server.
 * Each tool provides specific functionality for documentation management
 * and scraping operations.
 *
 * @example
 * ```typescript
 * const tools = await initializeTools(docService, pipeline);
 *
 * // Use tools via MCP server
 * await tools.scrape.execute({ library: 'react', url: 'https://react.dev' });
 * const results = await tools.search.execute({ library: 'react', query: 'hooks' });
 * ```
 */
export interface McpServerTools {
  /** Tool for listing all indexed libraries and versions */
  listLibraries: ListLibrariesTool;
  /** Tool for finding the best matching version of a library */
  findVersion: FindVersionTool;
  /** Tool for scraping and indexing documentation */
  scrape: ScrapeTool;
  /** Tool for searching indexed documentation */
  search: SearchTool;
  /** Tool for listing scraping jobs */
  listJobs: ListJobsTool;
  /** Tool for getting detailed job information */
  getJobInfo: GetJobInfoTool;
  /** Tool for cancelling running jobs */
  cancelJob: CancelJobTool;
  /** Tool for removing indexed documentation */
  remove: RemoveTool;
  /** Tool for fetching single URLs without indexing */
  fetchUrl: FetchUrlTool;
}

/**
 * Initializes and returns the shared tool instances.
 *
 * @remarks
 * This factory function creates all MCP tool instances with their required
 * dependencies. It should be called after services have been initialized.
 *
 * @param docService - The initialized DocumentManagementService instance
 * @param pipeline - The initialized pipeline instance
 *
 * @returns Object containing all instantiated tool instances
 *
 * @example
 * ```typescript
 * // Initialize services first
 * const docService = new DocumentManagementService(config);
 * await docService.initialize();
 *
 * const pipeline = new PipelineManager(options);
 * await pipeline.start();
 *
 * // Then initialize tools
 * const tools = await initializeTools(docService, pipeline);
 *
 * // Tools are now ready to use via MCP server
 * const server = new McpServer(tools);
 * ```
 */
export async function initializeTools(
  docService: IDocumentManagement,
  pipeline: IPipeline,
): Promise<McpServerTools> {
  const tools: McpServerTools = {
    listLibraries: new ListLibrariesTool(docService),
    findVersion: new FindVersionTool(docService),
    scrape: new ScrapeTool(pipeline),
    search: new SearchTool(docService),
    listJobs: new ListJobsTool(pipeline),
    getJobInfo: new GetJobInfoTool(pipeline),
    cancelJob: new CancelJobTool(pipeline),
    // clearCompletedJobs: new ClearCompletedJobsTool(pipeline),
    remove: new RemoveTool(docService, pipeline),
    fetchUrl: new FetchUrlTool(new AutoDetectFetcher()),
  };

  return tools;
}
