/**
 * Tests for tRPC service authentication.
 * Validates that tRPC routes enforce authentication when auth is enabled,
 * and allow unauthenticated access when auth is disabled.
 */

import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProxyAuthManager } from "../auth/ProxyAuthManager";
import type { AuthContext } from "../auth/types";
import type { EventBusService } from "../events";
import type { IPipeline } from "../pipeline/trpc/interfaces";
import type { IDocumentManagement } from "../store/trpc/interfaces";
import { registerTrpcService } from "./trpcService";

// Mock logger
vi.mock("../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

function createMockAuthManager(
  overrides: Partial<{ enabled: boolean; authenticated: boolean; subject: string }> = {},
): ProxyAuthManager {
  const { enabled = true, subject = "test-user" } = overrides;

  return {
    authConfig: {
      enabled,
      issuerUrl: enabled ? "https://example.com" : undefined,
      audience: enabled ? "https://api.example.com" : undefined,
      scopes: ["openid", "profile"],
    },
    createAuthContext: vi
      .fn()
      .mockImplementation(async (authorization: string): Promise<AuthContext> => {
        if (!enabled) {
          return { authenticated: false, scopes: new Set() };
        }
        const match = authorization.match(/^Bearer\s+(.+)$/i);
        if (match && match[1] === "valid-token") {
          return {
            authenticated: true,
            scopes: new Set(["*"] as unknown as Set<"*">),
            subject,
          };
        }
        return { authenticated: false, scopes: new Set() };
      }),
  } as unknown as ProxyAuthManager;
}

describe("tRPC Service Authentication", () => {
  let server: ReturnType<typeof Fastify>;
  let mockPipeline: IPipeline;
  let mockDocService: IDocumentManagement;
  let mockEventBus: EventBusService;

  beforeEach(() => {
    server = Fastify({ logger: false });
    mockPipeline = {
      getJob: vi.fn().mockResolvedValue(null),
      getJobs: vi.fn().mockResolvedValue([]),
    } as unknown as IPipeline;
    mockDocService = {
      listLibraries: vi.fn().mockResolvedValue([]),
    } as unknown as IDocumentManagement;
    mockEventBus = {
      on: vi.fn().mockReturnValue(vi.fn()),
    } as unknown as EventBusService;
  });

  afterEach(async () => {
    await server.close();
    vi.clearAllMocks();
  });

  describe("when auth is disabled", () => {
    it("should allow requests without authentication", async () => {
      const authManager = createMockAuthManager({ enabled: false });

      await registerTrpcService(
        server,
        mockPipeline,
        mockDocService,
        mockEventBus,
        authManager,
      );

      // tRPC uses POST for queries and mutations; use batch endpoint
      const response = await server.inject({
        method: "GET",
        url: "/api/ping",
      });

      // Should not be 401 — may be 200 or another non-auth error
      expect(response.statusCode).not.toBe(401);
    });
  });

  describe("when auth is enabled", () => {
    it("should reject requests without Authorization header with 401", async () => {
      const authManager = createMockAuthManager({
        enabled: true,
        authenticated: false,
      });

      await registerTrpcService(
        server,
        mockPipeline,
        mockDocService,
        mockEventBus,
        authManager,
      );

      const response = await server.inject({
        method: "GET",
        url: "/api/ping",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should reject requests with an invalid token with 401", async () => {
      const authManager = createMockAuthManager({
        enabled: true,
        authenticated: false,
      });

      await registerTrpcService(
        server,
        mockPipeline,
        mockDocService,
        mockEventBus,
        authManager,
      );

      const response = await server.inject({
        method: "GET",
        url: "/api/ping",
        headers: {
          Authorization: "Bearer invalid-token",
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should allow requests with a valid token", async () => {
      const authManager = createMockAuthManager({
        enabled: true,
        authenticated: true,
      });

      await registerTrpcService(
        server,
        mockPipeline,
        mockDocService,
        mockEventBus,
        authManager,
      );

      const response = await server.inject({
        method: "GET",
        url: "/api/ping",
        headers: {
          Authorization: "Bearer valid-token",
        },
      });

      // Should not be 401 — expected to be 200 (successful tRPC response)
      expect(response.statusCode).not.toBe(401);
      expect(response.statusCode).toBe(200);
    });

    it("should call authManager.createAuthContext with the Authorization header", async () => {
      const authManager = createMockAuthManager({
        enabled: true,
        authenticated: true,
      });

      await registerTrpcService(
        server,
        mockPipeline,
        mockDocService,
        mockEventBus,
        authManager,
      );

      await server.inject({
        method: "GET",
        url: "/api/ping",
        headers: {
          Authorization: "Bearer valid-token",
        },
      });

      expect(authManager.createAuthContext).toHaveBeenCalledWith(
        "Bearer valid-token",
        expect.anything(),
      );
    });
  });

  describe("when no authManager is provided (backward compatible)", () => {
    it("should allow all requests without authentication", async () => {
      // No authManager passed — backward compatible behavior
      await registerTrpcService(server, mockPipeline, mockDocService, mockEventBus);

      const response = await server.inject({
        method: "GET",
        url: "/api/ping",
      });

      // Should not be 401 — backward compatible, no auth check
      expect(response.statusCode).not.toBe(401);
      expect(response.statusCode).toBe(200);
    });
  });
});
