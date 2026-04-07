/**
 * Web service that registers API routes for the SvelteKit web interface.
 * The old JSX/Alpine.js/HTMX routes have been removed.
 */

import type { FastifyInstance } from "fastify";
import type { IPipeline } from "../pipeline/trpc/interfaces";
import type { IDocumentManagement } from "../store/trpc/interfaces";
import { appConfig, DEFAULT_HTTP_PORT, validateConfig } from "../utils/config";
import { logger } from "../utils/logger";

/**
 * Register API routes on a Fastify server instance.
 * Note: Static file serving and form body parsing are handled by AppServer.
 */
export async function registerWebService(
  server: FastifyInstance,
  _docService: IDocumentManagement,
  _pipeline: IPipeline,
): Promise<void> {
  /**
   * GET /api/health/mcp
   * Check MCP server health
   */
  server.get("/api/health/mcp", async (_request, reply) => {
    try {
      // Read MCP configuration from environment variables
      const mcpPort = process.env.SCRAPEGOAT_PORT
        ? Number.parseInt(process.env.SCRAPEGOAT_PORT, 10)
        : process.env.MCP_PORT
          ? Number.parseInt(process.env.MCP_PORT, 10)
          : DEFAULT_HTTP_PORT;
      const mcpHost = process.env.MCP_HOST || "localhost";
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
      } catch (_error) {
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
  server.get("/api/config", async (_request, reply) => {
    try {
      const validation = validateConfig(appConfig);

      // Read MCP configuration from environment variables
      const mcpPort = process.env.SCRAPEGOAT_PORT
        ? Number.parseInt(process.env.SCRAPEGOAT_PORT, 10)
        : process.env.MCP_PORT
          ? Number.parseInt(process.env.MCP_PORT, 10)
          : DEFAULT_HTTP_PORT;
      const mcpHost = process.env.MCP_HOST || "localhost";
      const mcpUrl = `http://${mcpHost}:${mcpPort}`;

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
          host: mcpHost,
          port: mcpPort,
          url: mcpUrl,
        },
        validation,
      });
    } catch (error) {
      logger.error(`Error retrieving config: ${error}`);
      reply.status(500).send({ error: "Failed to retrieve configuration" });
    }
  });
}
