import type { FastifyInstance, FastifyReply } from "fastify";

/**
 * Registers the health check endpoint.
 * @param server - The Fastify instance.
 */
export function registerHealthRoute(server: FastifyInstance): void {
  server.get("/api/health", async (_request, reply: FastifyReply) => {
    reply.status(200).send({ status: "ok" });
  });
}
