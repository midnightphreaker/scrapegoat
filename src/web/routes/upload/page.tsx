/**
 * Upload page route — renders the local upload panel for importing documentation.
 *
 * GET /web/upload?library=<name>&version=<ver> — shows the upload UI
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import LocalUploadPanel from "../../components/upload/LocalUploadPanel";
import Layout from "../../components/Layout";

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
      const library = request.query.library?.trim();
      if (!library) {
        reply.status(400);
        return (
          "<!DOCTYPE html>" +
          (
            <Layout title="Upload Error">
              <div class="p-6 text-center text-red-600 dark:text-red-400">
                Library name is required. Use ?library=Name
              </div>
            </Layout>
          )
        );
      }
      return (
        "<!DOCTYPE html>" +
        (
          <Layout title={`Upload — ${library}`}>
            <LocalUploadPanel
              library={library}
              version={request.query.version}
            />
            {/* Alpine.js component for upload page state */}
            <script src="/js/localUpload.js"></script>
          </Layout>
        )
      );
    },
  );
}
