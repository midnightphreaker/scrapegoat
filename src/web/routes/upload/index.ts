/**
 * Upload routes — registers all WebUI upload/import API endpoints with Fastify.
 *
 * Routes:
 *  POST /web/upload/start     — create upload session
 *  POST /web/upload/files     — upload files (multipart)
 *  GET  /web/upload/tree      — get import tree
 *  POST /web/upload/tree/rename — rename a node
 *  POST /web/upload/tree/delete — delete a node
 *  POST /web/upload/tree/move   — move a node
 *  POST /web/upload/commit    — commit session and start ingestion
 *  POST /web/upload/cancel    — cancel and cleanup session
 *  GET  /web/upload/report/failed  — download failed files report
 *  GET  /web/upload/report/renamed — download renamed files report
 *  GET  /web/upload/stats     — session stats
 *  GET  /web/upload           — upload page UI
 */

import fs from "node:fs/promises";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { IPipeline } from "../../../pipeline/trpc/interfaces";
import type { IDocumentManagement } from "../../../store/trpc/interfaces";
import { ArchiveExtractor, UploadStagingService } from "../../../upload/index";
import type { UploadConfig } from "../../../upload/types";
import { DEFAULT_UPLOAD_CONFIG } from "../../../upload/types";
import { loadConfig } from "../../../utils/config";
import { logger } from "../../../utils/logger";
import { registerUploadPageRoute } from "./page";

let stagingService: UploadStagingService | null = null;
let pipelineManager: IPipeline | null = null;
let docService: IDocumentManagement | null = null;

function getStagingService(): UploadStagingService {
  if (!stagingService) {
    const config = loadConfig();
    const webImport = config.webImport;
    const stagingConfig: Partial<UploadConfig> = {
      stagingMode: webImport.stagingMode,
      stagingPath: webImport.stagingInternalPath || undefined,
      maxTotalSizeBytes: webImport.maxTotalSizeBytes,
      maxFileSizeBytes: webImport.maxFileSizeBytes,
      maxFiles: webImport.maxFiles,
      sessionTtlSeconds: webImport.sessionTtlSeconds,
      maxArchiveCompressedBytes: webImport.maxArchiveCompressedBytes,
      maxDepth: webImport.maxDepth,
      maxFilenameLength: webImport.maxFilenameLength,
      maxPathLength: webImport.maxPathLength,
    };
    stagingService = new UploadStagingService(stagingConfig);
  }
  return stagingService;
}

export async function registerUploadRoutes(
  server: FastifyInstance,
  pipeline: IPipeline,
  docs: IDocumentManagement,
): Promise<void> {
  pipelineManager = pipeline;
  docService = docs;

  await server.register(multipart, {
    limits: {
      fileSize: DEFAULT_UPLOAD_CONFIG.maxFileSizeBytes,
      files: 50,
    },
  });

  /**
   * Rate limit all upload routes to prevent abuse.
   * Allows up to 10 requests per minute per originating IP address.
   * Exceeding the limit returns HTTP 429 (Too Many Requests).
   */
  await server.register(rateLimit, {
    max: 10,
    timeWindow: "1 minute",
  });

  // Register the upload page UI route
  registerUploadPageRoute(server);

  server.post(
    "/web/upload/start",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as Record<string, string> | undefined;
      const library = body?.library?.trim();
      const version = body?.version?.trim();
      if (!library) return reply.code(400).send({ error: "library is required" });
      const session = await getStagingService().createSession(
        library,
        version || "latest",
      );
      return {
        sessionId: session.id,
        library: session.library,
        version: session.version,
      };
    },
  );

  server.post(
    "/web/upload/files",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const sessionId = (request.query as Record<string, string>).sessionId;
      if (!sessionId)
        return reply.code(400).send({ error: "sessionId query parameter is required" });
      const service = getStagingService();
      const session = service.getSession(sessionId);
      if (!session) return reply.code(404).send({ error: "Session not found" });
      const stagedFiles = [];
      const errors = [];
      const extractor = new ArchiveExtractor(
        DEFAULT_UPLOAD_CONFIG.maxArchiveEntries,
        DEFAULT_UPLOAD_CONFIG.maxArchiveUncompressedBytes,
      );
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === "file") {
          const buffer = await part.toBuffer();
          const fileName = part.filename;
          try {
            if (extractor.isArchiveBuffer(buffer)) {
              const extractDir = `${session.stagingPath}/__extract_${Date.now()}`;
              const result = await extractor.extract(buffer, extractDir);
              for (const e of result.errors) {
                errors.push(e);
                service.recordFailedFile(sessionId, {
                  originalName: e.path,
                  relativePath: e.path,
                  error: e.error,
                });
              }
              for (const extracted of result.files) {
                const staged = await service.stageFile(
                  sessionId,
                  extracted.relativePath,
                  extracted.content,
                  true,
                  fileName,
                );
                stagedFiles.push({
                  id: staged.id,
                  name: staged.displayName,
                  path: staged.relativePath,
                  size: staged.size,
                  ingestible: staged.ingestible,
                  fromArchive: staged.fromArchive,
                  mimeType: staged.mimeType,
                });
              }
              // Clean up extraction temp dir (TAR archives write to disk; ZIP does not)
              await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {});
            } else {
              const staged = await service.stageFile(sessionId, fileName, buffer);
              stagedFiles.push({
                id: staged.id,
                name: staged.displayName,
                path: staged.relativePath,
                size: staged.size,
                ingestible: staged.ingestible,
                fromArchive: staged.fromArchive,
                mimeType: staged.mimeType,
              });
            }
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            errors.push({ path: fileName, error: errorMsg });
            service.recordFailedFile(sessionId, {
              originalName: fileName,
              relativePath: fileName,
              error: errorMsg,
            });
          }
        }
      }
      return { stagedFiles, errors };
    },
  );

  server.get("/web/upload/tree", async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionId = (request.query as Record<string, string>).sessionId;
    if (!sessionId) return reply.code(400).send({ error: "sessionId is required" });
    const service = getStagingService();
    if (!service.getSession(sessionId))
      return reply.code(404).send({ error: "Session not found" });
    return {
      sessionId,
      tree: service.getImportTree(sessionId),
      stats: service.getSessionStats(sessionId),
    };
  });

  server.post(
    "/web/upload/tree/rename",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sessionId, fileId, newName } = request.body as Record<string, string>;
      if (!sessionId || !fileId || !newName)
        return reply
          .code(400)
          .send({ error: "sessionId, fileId, and newName are required" });
      try {
        await getStagingService().renameFile(sessionId, fileId, newName);
        return { success: true };
      } catch (err) {
        return reply
          .code(400)
          .send({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  );

  server.post(
    "/web/upload/tree/delete",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sessionId, fileId } = request.body as Record<string, string>;
      if (!sessionId || !fileId)
        return reply.code(400).send({ error: "sessionId and fileId are required" });
      try {
        await getStagingService().removeFile(sessionId, fileId);
        return { success: true };
      } catch (err) {
        return reply
          .code(400)
          .send({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  );

  server.post(
    "/web/upload/tree/move",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sessionId, fileId, newRelativePath } = request.body as Record<
        string,
        string
      >;
      if (!sessionId || !fileId || !newRelativePath)
        return reply
          .code(400)
          .send({ error: "sessionId, fileId, and newRelativePath are required" });
      try {
        await getStagingService().moveFile(sessionId, fileId, newRelativePath);
        return { success: true };
      } catch (err) {
        return reply
          .code(400)
          .send({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  );

  server.post(
    "/web/upload/tree/virtual-folder",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sessionId, folderPath } = request.body as Record<string, string>;
      if (!sessionId || !folderPath)
        return reply.code(400).send({ error: "sessionId and folderPath are required" });
      try {
        await getStagingService().createVirtualFolder(sessionId, folderPath);
        return { success: true };
      } catch (err) {
        return reply
          .code(400)
          .send({ error: err instanceof Error ? err.message : String(err) });
      }
    },
  );

  server.post(
    "/web/upload/commit",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sessionId } = request.body as Record<string, string>;
      if (!sessionId) return reply.code(400).send({ error: "sessionId is required" });

      if (!pipelineManager || !docService) {
        return reply.code(500).send({ error: "Server not fully initialized" });
      }

      const service = getStagingService();
      const session = service.getSession(sessionId);
      if (!session) return reply.code(404).send({ error: "Session not found" });

      if (session.status !== "active") {
        return reply
          .code(400)
          .send({ error: `Session is not active (status: ${session.status})` });
      }

      try {
        // Check for duplicate library/version
        const duplicateExists = await docService.versionExists(
          session.library,
          session.version,
        );
        if (duplicateExists) {
          return reply.code(409).send({
            error: `Library "${session.library}" version "${session.version}" already exists. Please use a different version.`,
          });
        }

        // Mark session as committed
        await service.commitSession(sessionId);

        // Generate source URL for the import strategy
        const sourceUrl = `file:///import/${encodeURIComponent(session.library)}/${encodeURIComponent(session.version)}/`;

        // Enqueue the pipeline job
        const jobId = await pipelineManager.enqueueScrapeJob(
          session.library,
          session.version,
          {
            url: sourceUrl,
            library: session.library,
            version: session.version,
            localImportStagingPath: session.stagingPath,
          },
        );

        logger.info(
          `📦 Import job enqueued: ${jobId} for ${session.library}@${session.version}`,
        );

        // Set up cleanup listener for staging directory
        registerStagingCleanup(pipelineManager, jobId, session.stagingPath, sessionId);

        const stats = service.getSessionStats(sessionId);

        return {
          success: true,
          sessionId,
          library: session.library,
          version: session.version,
          stats,
          jobId,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`✗ Commit failed for session ${sessionId}: ${message}`);
        return reply.code(500).send({ error: message });
      }
    },
  );

  server.post(
    "/web/upload/cancel",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sessionId } = request.body as Record<string, string>;
      if (!sessionId) return reply.code(400).send({ error: "sessionId is required" });
      await getStagingService().cancelSession(sessionId);
      return { success: true };
    },
  );

  server.get(
    "/web/upload/report/failed",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const sessionId = (request.query as Record<string, string>).sessionId;
      if (!sessionId) return reply.code(400).send({ error: "sessionId is required" });
      const session = getStagingService().getSession(sessionId);
      if (!session) return reply.code(404).send({ error: "Session not found" });
      const lines = [
        "# ScrapeGoat — Files that failed to upload",
        `# Session: ${sessionId}`,
        `# Library: ${session.library} v${session.version}`,
        `# Generated: ${new Date().toISOString()}`,
        "",
      ];
      for (const e of session.failedFiles) lines.push(`${e.relativePath}\t${e.error}`);
      if (session.failedFiles.length === 0) lines.push("# No files failed to upload.");
      reply.header("Content-Type", "text/plain; charset=utf-8");
      reply.header(
        "Content-Disposition",
        'attachment; filename="Scrapegoat-FailedToUpload.txt"',
      );
      return lines.join("\n");
    },
  );

  server.get(
    "/web/upload/report/renamed",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const sessionId = (request.query as Record<string, string>).sessionId;
      if (!sessionId) return reply.code(400).send({ error: "sessionId is required" });
      const session = getStagingService().getSession(sessionId);
      if (!session) return reply.code(404).send({ error: "Session not found" });
      const lines = [
        "# ScrapeGoat — Files that were renamed during upload",
        `# Session: ${sessionId}`,
        `# Library: ${session.library} v${session.version}`,
        `# Generated: ${new Date().toISOString()}`,
        "",
      ];
      for (const e of session.renamedFiles)
        lines.push(`${e.originalName}\t→\t${e.newName}\t(${e.reason})`);
      if (session.renamedFiles.length === 0)
        lines.push("# No files were renamed during upload.");
      reply.header("Content-Type", "text/plain; charset=utf-8");
      reply.header(
        "Content-Disposition",
        'attachment; filename="Scrapegoat-RenamedFiles.txt"',
      );
      return lines.join("\n");
    },
  );

  server.get(
    "/web/upload/stats",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const sessionId = (request.query as Record<string, string>).sessionId;
      if (!sessionId) return reply.code(400).send({ error: "sessionId is required" });
      const service = getStagingService();
      const session = service.getSession(sessionId);
      if (!session) return reply.code(404).send({ error: "Session not found" });
      return {
        sessionId,
        status: session.status,
        library: session.library,
        version: session.version,
        stats: service.getSessionStats(sessionId),
      };
    },
  );
}

/**
 * Registers a one-time listener on the pipeline event bus to clean up the staging
 * directory after the import job finishes.
 *
 * - On success or cancellation: removes the staging directory.
 * - On failure: keeps the staging directory for debugging.
 */
function registerStagingCleanup(
  pipeline: IPipeline,
  jobId: string,
  stagingPath: string,
  sessionId: string,
): void {
  // We use the job's completion promise to trigger cleanup.
  // This is more reliable than listening to event bus events since we
  // have direct access to the job via PipelineManager.
  const job = pipeline.getJob(jobId);
  if (!job) {
    logger.warn(`Cannot register cleanup for unknown job: ${jobId}`);
    return;
  }

  // Use waitForJobCompletion which resolves on success/cancel and rejects on failure
  pipeline.waitForJobCompletion(jobId).then(
    () => {
      // Success or cancellation — remove staging dir
      logger.info(
        `🧹 Cleaning up staging directory for session ${sessionId}: ${stagingPath}`,
      );
      fs.rm(stagingPath, { recursive: true, force: true }).catch((err) => {
        logger.warn(`Failed to clean up staging directory ${stagingPath}: ${err}`);
      });
    },
    () => {
      // Failure — keep staging directory for debugging
      logger.info(
        `Keeping staging directory for failed import session ${sessionId}: ${stagingPath}`,
      );
    },
  );
}
