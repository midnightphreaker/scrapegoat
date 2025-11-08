/**
 * Web service that registers all web interface routes for human interaction.
 * Extracted from src/web/web.ts to enable modular server composition.
 */

import type { FastifyInstance } from "fastify";
import type { IPipeline } from "../pipeline/trpc/interfaces";
import type { IDocumentManagement } from "../store/trpc/interfaces";
import { SearchTool } from "../tools";
import { CancelJobTool } from "../tools/CancelJobTool";
import { ClearCompletedJobsTool } from "../tools/ClearCompletedJobsTool";
import { ListJobsTool } from "../tools/ListJobsTool";
import { ListLibrariesTool } from "../tools/ListLibrariesTool";
import { RemoveTool } from "../tools/RemoveTool";
import { ScrapeTool } from "../tools/ScrapeTool";
import { appConfig, DEFAULT_HTTP_PORT, validateConfig } from "../utils/config";
import { logger } from "../utils/logger";
import { registerIndexRoute } from "../web/routes/index";
import { registerCancelJobRoute } from "../web/routes/jobs/cancel";
import { registerClearCompletedJobsRoute } from "../web/routes/jobs/clear-completed";
import { registerJobListRoutes } from "../web/routes/jobs/list";
import { registerNewJobRoutes } from "../web/routes/jobs/new";
import { registerLibraryDetailRoutes } from "../web/routes/libraries/detail";
import { registerLibrariesRoutes } from "../web/routes/libraries/list";

/**
 * Register web interface routes on a Fastify server instance.
 * This includes all human-facing UI routes.
 * Note: Static file serving and form body parsing are handled by AppServer.
 */
export async function registerWebService(
  server: FastifyInstance,
  docService: IDocumentManagement,
  pipeline: IPipeline,
): Promise<void> {
  // Note: Web interface uses direct event tracking without session management
  // This approach provides meaningful analytics without the complexity of per-request sessions
  // Future enhancements could add browser-based session correlation if needed

  // Instantiate tools for web routes
  const listLibrariesTool = new ListLibrariesTool(docService);
  const listJobsTool = new ListJobsTool(pipeline);
  const scrapeTool = new ScrapeTool(pipeline);
  const removeTool = new RemoveTool(docService, pipeline);
  const searchTool = new SearchTool(docService);
  const cancelJobTool = new CancelJobTool(pipeline);
  const clearCompletedJobsTool = new ClearCompletedJobsTool(pipeline);

  // Register all web routes
  registerIndexRoute(server);
  registerLibrariesRoutes(server, listLibrariesTool, removeTool);
  registerLibraryDetailRoutes(server, listLibrariesTool, searchTool);
  registerJobListRoutes(server, listJobsTool);
  registerNewJobRoutes(server, scrapeTool);
  registerCancelJobRoute(server, cancelJobTool);
  registerClearCompletedJobsRoute(server, clearCompletedJobsTool);

  /**
   * GET /api/health/mcp
   * Check MCP server health
   */
  server.get("/api/health/mcp", async (request, reply) => {
    try {
      const mcpHost = "localhost";
      const mcpPort = DEFAULT_HTTP_PORT;
      const mcpUrl = `http://${mcpHost}:${mcpPort}`;

      // Simple reachability check
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        await fetch(mcpUrl, {
          method: "HEAD",
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        reply.send({
          status: "ok",
          connected: true,
          url: mcpUrl,
          port: mcpPort,
        });
      } catch (error) {
        reply.status(503).send({
          status: "down",
          connected: false,
          error: "MCP server not reachable",
        });
      }
    } catch (error) {
      logger.error(`MCP health check failed: ${error}`);
      reply.status(503).send({
        status: "down",
        connected: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * GET /api/config
   * Get application configuration (read-only, sanitized)
   */
  server.get("/api/config", async (request, reply) => {
    try {
      const validation = validateConfig(appConfig);

      reply.send({
        config: {
          fetcher: {
            defaultFetcher: appConfig.fetcher.defaultFetcher,
            http: {
              timeout: appConfig.fetcher.http.timeout,
              maxRetries: appConfig.fetcher.http.maxRetries,
            },
            crawl4ai: {
              serviceUrl: appConfig.fetcher.crawl4ai.serviceUrl,
              enabled: appConfig.fetcher.crawl4ai.enabled,
              timeout: appConfig.fetcher.crawl4ai.timeout,
              features: appConfig.fetcher.crawl4ai.features,
              defaultScreenshotMode: appConfig.fetcher.crawl4ai.defaultScreenshotMode,
            },
          },
          storage: appConfig.storage,
          monitoring: {
            enabled: appConfig.monitoring.enabled,
            exportInterval: appConfig.monitoring.exportInterval,
          },
        },
        mcp: {
          enabled: true, // MCP server runs as a separate service
          host: "localhost",
          port: DEFAULT_HTTP_PORT,
          url: `http://localhost:${DEFAULT_HTTP_PORT}`,
        },
        validation,
      });
    } catch (error) {
      logger.error(`Error retrieving config: ${error}`);
      reply.status(500).send({ error: "Failed to retrieve configuration" });
    }
  });
}
