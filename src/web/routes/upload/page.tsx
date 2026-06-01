/**
 * Upload page route — renders the local upload panel as an HTMX fragment.
 *
 * GET /web/upload?library=<name>&version=<ver> — returns the upload panel fragment
 *
 * The library and version parameters are optional. When omitted the panel renders
 * with empty defaults so the user can fill them in directly on the form.
 * All callers (SourceSelectionModal, UploadVersionButton) use HTMX innerHTML
 * swap, so this route returns a bare fragment — no Layout wrapper.
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import LocalUploadPanel from "../../components/upload/LocalUploadPanel";

export function registerUploadPageRoute(server: FastifyInstance) {
  server.get(
    "/web/upload",
    async (
      request: FastifyRequest<{
        Querystring: { library?: string; version?: string };
      }>,
      reply,
    ) => {
      reply.type("text/html");
      const library = request.query.library?.trim() ?? "";
      const version = request.query.version?.trim();
      return (
        <LocalUploadPanel library={library} version={version} />
      );
    },
  );
}
