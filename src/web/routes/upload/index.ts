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
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ArchiveExtractor, UploadStagingService } from "../../../upload/index";
import type { UploadConfig } from "../../../upload/types";
import { DEFAULT_UPLOAD_CONFIG } from "../../../upload/types";
import { registerUploadPageRoute } from "./page";

let stagingService: UploadStagingService | null = null;

function getStagingService(): UploadStagingService {
  if (!stagingService) {
    const config: Partial<UploadConfig> = {
      stagingMode:
        (process.env.SCRAPEGOAT_WEBUI_IMPORT_STAGING_MODE as "memory" | "filesystem") ??
        "memory",
      stagingPath: process.env.SCRAPEGOAT_WEBUI_IMPORT_STAGING_INTERNAL_PATH,
      maxTotalSizeBytes: process.env.SCRAPEGOAT_WEBUI_IMPORT_MAX_TOTAL_SIZE_BYTES
        ? Number.parseInt(process.env.SCRAPEGOAT_WEBUI_IMPORT_MAX_TOTAL_SIZE_BYTES, 10)
        : undefined,
      maxFileSizeBytes: process.env.SCRAPEGOAT_WEBUI_IMPORT_MAX_FILE_SIZE_BYTES
        ? Number.parseInt(process.env.SCRAPEGOAT_WEBUI_IMPORT_MAX_FILE_SIZE_BYTES, 10)
        : undefined,
      maxFiles: process.env.SCRAPEGOAT_WEBUI_IMPORT_MAX_FILES
        ? Number.parseInt(process.env.SCRAPEGOAT_WEBUI_IMPORT_MAX_FILES, 10)
        : undefined,
      sessionTtlSeconds: process.env.SCRAPEGOAT_WEBUI_IMPORT_SESSION_TTL_SECONDS
        ? Number.parseInt(process.env.SCRAPEGOAT_WEBUI_IMPORT_SESSION_TTL_SECONDS, 10)
        : undefined,
    };
    stagingService = new UploadStagingService(config);
  }
  return stagingService;
}

export async function registerUploadRoutes(server: FastifyInstance): Promise<void> {
  await server.register(multipart, {
    limits: {
      fileSize: DEFAULT_UPLOAD_CONFIG.maxFileSizeBytes,
      files: 50,
    },
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
                const content = await fs.readFile(
                  `${extractDir}/${extracted.relativePath}`,
                );
                const staged = await service.stageFile(
                  sessionId,
                  extracted.relativePath,
                  content,
                  true,
                  fileName,
                );
                stagedFiles.push({
                  id: staged.id,
                  name: staged.displayName,
                  path: staged.relativePath,
                  size: staged.size,
                });
                await fs
                  .unlink(`${extractDir}/${extracted.relativePath}`)
                  .catch(() => {});
              }
              await fs.rm(extractDir, { recursive: true, force: true }).catch(() => {});
            } else {
              const staged = await service.stageFile(sessionId, fileName, buffer);
              stagedFiles.push({
                id: staged.id,
                name: staged.displayName,
                path: staged.relativePath,
                size: staged.size,
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
    "/web/upload/commit",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sessionId } = request.body as Record<string, string>;
      if (!sessionId) return reply.code(400).send({ error: "sessionId is required" });
      const service = getStagingService();
      const session = service.getSession(sessionId);
      if (!session) return reply.code(404).send({ error: "Session not found" });
      try {
        await service.commitSession(sessionId);
        return {
          success: true,
          sessionId,
          library: session.library,
          version: session.version,
          stats: service.getSessionStats(sessionId),
          stagingPath: session.stagingPath,
        };
      } catch (err) {
        return reply
          .code(400)
          .send({ error: err instanceof Error ? err.message : String(err) });
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
