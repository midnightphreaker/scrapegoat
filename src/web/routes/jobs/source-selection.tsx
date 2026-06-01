import type { FastifyInstance } from "fastify";
import SourceSelectionModal from "../../components/SourceSelectionModal";

/**
 * Registers the route for the source selection modal.
 * @param server - The Fastify instance.
 */
export function registerSourceSelectionRoute(server: FastifyInstance): void {
  server.get(
    "/web/jobs/source-selection",
    async (_request, reply) => {
      reply.type("text/html");
      return <SourceSelectionModal />;
    },
  );
}
