import fs from "node:fs/promises";
import path from "node:path";
import formBody from "@fastify/formbody";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { metricsCollector } from "../monitoring/metrics";
import { performanceMetrics } from "../monitoring/PerformanceMetrics";
import type { PipelineManager } from "../pipeline/PipelineManager";
import { Crawl4AIClient } from "../scraper/fetcher/crawl4ai/Crawl4AIClient";
import type { DocumentManagementService } from "../store/DocumentManagementService";
import { SearchTool } from "../tools";
import { CancelJobTool } from "../tools/CancelJobTool";
import { ClearCompletedJobsTool } from "../tools/ClearCompletedJobsTool";
import { ListJobsTool } from "../tools/ListJobsTool";
import { ListLibrariesTool } from "../tools/ListLibrariesTool";
import { RemoveTool } from "../tools/RemoveTool";
import { ScrapeTool } from "../tools/ScrapeTool";
import { appConfig, DEFAULT_HTTP_PORT, validateConfig } from "../utils/config";
import { logger } from "../utils/logger";
import { getProjectRoot } from "../utils/paths";
import { registerIndexRoute } from "./routes/index";
import { registerCancelJobRoute } from "./routes/jobs/cancel";
import { registerClearCompletedJobsRoute } from "./routes/jobs/clear-completed";
import { registerJobListRoutes } from "./routes/jobs/list";
import { registerNewJobRoutes } from "./routes/jobs/new";
import { registerLibraryDetailRoutes } from "./routes/libraries/detail";
import { registerLibrariesRoutes } from "./routes/libraries/list";

/**
 * Initializes the Fastify web server instance.
 *
 * @param port The port number for the web server.
 * @param docService The document management service instance.
 * @param pipelineManager The pipeline manager instance.
 * @returns The initialized Fastify server instance.
 */
export async function startWebServer(
  port: number,
  docService: DocumentManagementService,
  pipelineManager: PipelineManager,
): Promise<FastifyInstance> {
  const server = Fastify({
    logger: false, // Use our own logger instead
  });

  // Register plugins
  await server.register(formBody); // Register formbody to parse form data

  // Instantiate tools using provided services
  const listLibrariesTool = new ListLibrariesTool(docService);
  const listJobsTool = new ListJobsTool(pipelineManager);
  const scrapeTool = new ScrapeTool(pipelineManager);
  const removeTool = new RemoveTool(docService, pipelineManager);
  const searchTool = new SearchTool(docService);
  const cancelJobTool = new CancelJobTool(pipelineManager);
  const clearCompletedJobsTool = new ClearCompletedJobsTool(pipelineManager);

  // Register static file serving
  await server.register(fastifyStatic, {
    // Use project root to construct absolute path to public directory
    root: path.join(getProjectRoot(), "public"),
    prefix: "/",
    index: false, // Disable automatic index.html serving
  });

  // Register routes
  registerIndexRoute(server); // Register the root route first
  registerJobListRoutes(server, listJobsTool);
  registerNewJobRoutes(server, scrapeTool);
  registerCancelJobRoute(server, cancelJobTool);
  registerClearCompletedJobsRoute(server, clearCompletedJobsTool);
  registerLibrariesRoutes(server, listLibrariesTool, removeTool);
  registerLibraryDetailRoutes(server, listLibrariesTool, searchTool);

  // ============================================================================
  // Phase 4 & 5: Enhanced API Routes
  // ============================================================================

  /**
   * GET /api/health/crawl4ai
   * Check Crawl4AI service health
   */
  server.get("/api/health/crawl4ai", async (_request, reply) => {
    try {
      const client = new Crawl4AIClient();
      const health = await client.health();

      if (health) {
        reply.send(health);
      } else {
        reply.status(503).send({
          status: "down",
          version: "unknown",
          uptime: 0,
        });
      }
    } catch (error) {
      logger.error(`Crawl4AI health check failed: ${error}`);
      reply.status(503).send({
        status: "down",
        version: "unknown",
        uptime: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * GET /api/health/all
   * Get health status of all services
   */
  server.get("/api/health/all", async (_request, reply) => {
    const crawl4aiClient = new Crawl4AIClient();

    try {
      const crawl4aiHealth = await crawl4aiClient.health();

      reply.send({
        http: { status: "ok" }, // Always available
        browser: { status: "ok" }, // Always available (lazy init)
        crawl4ai: crawl4aiHealth || {
          status: "down",
          version: "unknown",
          uptime: 0,
        },
      });
    } catch (error) {
      logger.error(`Health check failed: ${error}`);
      reply.send({
        http: { status: "ok" },
        browser: { status: "ok" },
        crawl4ai: {
          status: "down",
          version: "unknown",
          uptime: 0,
        },
      });
    }
  });

  /**
   * GET /api/health/mcp
   * Check MCP server health
   */
  server.get("/api/health/mcp", async (_request, reply) => {
    try {
      // Read MCP configuration from environment variables
      // MCP_PORT is set by the container/orchestration and indicates where MCP server is running
      const mcpPort = process.env.MCP_PORT
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
   * GET /api/pages/:pageId/screenshot
   * Serve screenshot for a page
   */
  server.get(
    "/api/pages/:pageId/screenshot",
    async (
      request: FastifyRequest<{
        Params: { pageId: string };
      }>,
      reply,
    ) => {
      try {
        const pageId = Number.parseInt(request.params.pageId, 10);
        if (Number.isNaN(pageId)) {
          reply.status(400).send({ error: "Invalid page ID" });
          return;
        }

        // Query the database for the page
        const screenshotPath = await docService.getScreenshotPath(pageId);

        if (!screenshotPath) {
          reply.status(404).send({ error: "Screenshot not found" });
          return;
        }
        const fullPath = path.isAbsolute(screenshotPath)
          ? screenshotPath
          : path.join(getProjectRoot(), screenshotPath);

        // Read and serve the screenshot
        const screenshot = await fs.readFile(fullPath);
        reply.type("image/png").send(screenshot);
      } catch (error) {
        logger.error(`Error serving screenshot: ${error}`);
        reply.status(500).send({ error: "Failed to load screenshot" });
      }
    },
  );

  /**
   * GET /api/pages/:pageId/metadata
   * Get enhanced metadata for a page (media, links)
   */
  server.get(
    "/api/pages/:pageId/metadata",
    async (
      request: FastifyRequest<{
        Params: { pageId: string };
      }>,
      reply,
    ) => {
      try {
        const pageId = Number.parseInt(request.params.pageId, 10);
        if (Number.isNaN(pageId)) {
          reply.status(400).send({ error: "Invalid page ID" });
          return;
        }

        // Query the database for the page metadata
        const pageData = await docService.getPageMetadata(pageId);

        if (!pageData) {
          reply.status(404).send({ error: "Page not found" });
          return;
        }

        reply.send({
          metadata: pageData.metadata,
          fetcherType: pageData.fetcherType,
          hasScreenshot: pageData.hasScreenshot,
          screenshotPath: pageData.screenshotPath,
        });
      } catch (error) {
        logger.error(`Error retrieving page metadata: ${error}`);
        reply.status(500).send({ error: "Failed to load metadata" });
      }
    },
  );

  /**
   * GET /api/metrics
   * Get metrics in JSON format
   */
  server.get("/api/metrics", async (_request, reply) => {
    try {
      const metrics = metricsCollector.getAllMetrics();

      // Convert Maps to objects for JSON serialization
      const serialized: Record<string, unknown> = {};
      for (const [fetcher, data] of Object.entries(metrics)) {
        serialized[fetcher] = {
          ...data,
          errorsByType: Object.fromEntries(data.errorsByType),
        };
      }

      // Add summary
      const summary = metricsCollector.getSummary();

      reply.send({
        metrics: serialized,
        summary,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Error retrieving metrics: ${error}`);
      reply.status(500).send({ error: "Failed to retrieve metrics" });
    }
  });

  /**
   * GET /metrics
   * Prometheus metrics endpoint
   */
  server.get("/metrics", async (_request, reply) => {
    try {
      // Combine fetcher metrics and performance metrics
      const fetcherMetrics = metricsCollector.export();
      const performanceMetricsText = performanceMetrics.exportPrometheus();
      reply.type("text/plain").send(`${fetcherMetrics}\n\n${performanceMetricsText}`);
    } catch (error) {
      logger.error(`Error exporting Prometheus metrics: ${error}`);
      reply.status(500).send("# Error exporting metrics\n");
    }
  });

  /**
   * GET /api/performance
   * Get performance metrics in JSON format
   */
  server.get("/api/performance", async (_request, reply) => {
    try {
      const allMetrics = performanceMetrics.getAllMetrics();

      // Convert nested Maps to objects for JSON serialization
      const serialized: Record<string, Record<string, unknown>> = {};
      for (const [category, operations] of Object.entries(allMetrics)) {
        serialized[category] = {};
        for (const [operation, metrics] of Object.entries(operations)) {
          serialized[category][operation] = {
            ...metrics,
            errorsByType: Object.fromEntries(metrics.errorsByType),
          };
        }
      }

      // Add category summaries
      const summaries: Record<string, unknown> = {};
      for (const category of [
        "database",
        "embedding",
        "search",
        "processing",
        "fetcher",
      ] as const) {
        summaries[category] = performanceMetrics.getCategorySummary(category);
      }

      reply.send({
        metrics: serialized,
        summaries,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Error retrieving performance metrics: ${error}`);
      reply.status(500).send({ error: "Failed to retrieve performance metrics" });
    }
  });

  /**
   * GET /api/performance/:category
   * Get performance metrics for a specific category
   */
  server.get<{ Params: { category: string } }>(
    "/api/performance/:category",
    async (request, reply) => {
      try {
        const { category } = request.params;
        const validCategories = [
          "database",
          "embedding",
          "search",
          "processing",
          "fetcher",
        ];

        if (!validCategories.includes(category)) {
          reply.status(400).send({ error: `Invalid category: ${category}` });
          return;
        }

        const categoryMetrics = performanceMetrics.getCategoryMetrics(category as any);
        const summary = performanceMetrics.getCategorySummary(category as any);

        // Convert Maps to objects for JSON serialization
        const serialized: Record<string, unknown> = {};
        for (const [operation, metrics] of Object.entries(categoryMetrics)) {
          serialized[operation] = {
            ...metrics,
            errorsByType: Object.fromEntries(metrics.errorsByType),
          };
        }

        reply.send({
          category,
          metrics: serialized,
          summary,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error(`Error retrieving category performance metrics: ${error}`);
        reply.status(500).send({ error: "Failed to retrieve category metrics" });
      }
    },
  );

  /**
   * GET /api/config
   * Get application configuration (read-only, sanitized)
   */
  server.get("/api/config", async (_request, reply) => {
    try {
      const validation = validateConfig(appConfig);

      // Read MCP configuration from environment variables
      const mcpPort = process.env.MCP_PORT
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
          enabled: true, // MCP is enabled when running in web mode
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

  // Graceful shutdown of services will be handled by the caller (src/index.ts)

  try {
    const address = await server.listen({ port, host: "0.0.0.0" });
    logger.info(`🚀 Web UI available at ${address}`);
    return server; // Return the server instance
  } catch (error) {
    logger.error(`❌ Failed to start web UI: ${error}`);
    // Ensure server is closed if listen fails but initialization succeeded partially
    await server.close();
    throw error;
  }
}

/**
 * Stops the provided Fastify web server instance.
 *
 * @param server - The Fastify server instance to stop.
 */
export async function stopWebServer(server: FastifyInstance): Promise<void> {
  try {
    await server.close();
    logger.info("🛑 Web UI stopped.");
  } catch (error) {
    logger.error(`❌ Failed to stop web server gracefully: ${error}`);
    // Rethrow or handle as needed, but ensure the process doesn't hang
    throw error;
  }
}
