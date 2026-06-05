import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { registerLibrariesRoutes } from "./list";

describe("library routes", () => {
  it("deletes the literal latest version instead of treating it as unversioned", async () => {
    const server = Fastify({ logger: false });
    const listLibrariesTool = {
      execute: vi.fn().mockResolvedValue({ libraries: [] }),
    };
    const removeTool = {
      execute: vi.fn().mockResolvedValue({ message: "removed" }),
    };
    const refreshVersionTool = {
      execute: vi.fn(),
    };

    registerLibrariesRoutes(
      server,
      listLibrariesTool as never,
      removeTool as never,
      refreshVersionTool as never,
    );

    const response = await server.inject({
      method: "DELETE",
      url: "/web/libraries/warhammer/versions/latest",
    });

    expect(response.statusCode).toBe(204);
    expect(removeTool.execute).toHaveBeenCalledWith({
      library: "warhammer",
      version: "latest",
    });

    await server.close();
  });
});
