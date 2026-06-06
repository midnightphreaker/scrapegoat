# auth/

## Responsibility
OAuth2/OIDC proxy authentication for MCP endpoints — provides binary auth (authenticated vs anonymous) using Bearer token validation.

## Design
- **`types.ts`** — `AuthConfig` (enabled, issuerUrl, audience, scopes) and `AuthContext` (authenticated flag, scopes as `Set<"*">`, optional subject). Binary model: valid token → full access (`scopes: {"*"}`).
- **`ProxyAuthManager`** — initializes via OAuth2 Authorization Server Metadata discovery (RFC 8414) with OIDC fallback. Builds a `ProxyOAuthServerProvider` from the MCP SDK. Supports hybrid token validation: JWT via JWKS (primary) → userinfo endpoint (opaque token fallback). Registers full OAuth2 route set on Fastify: metadata, authorize redirect, token proxy, revocation, dynamic client registration.
- **`createAuthMiddleware`** — returns a Fastify `onRequest` hook. Extracts Bearer token, calls `authManager.createAuthContext()`, attaches `AuthContext` to the request. Returns 401 with `WWW-Authenticate` header on failure.

## Flow
1. `ProxyAuthManager.initialize()` discovers endpoints from `issuerUrl`, sets up JWKS, creates SDK provider.
2. `registerRoutes()` mounts OAuth2 endpoints on Fastify — authorize redirects upstream, token/revocation/registration proxy to upstream.
3. On each request, `createAuthMiddleware` calls `createAuthContext()` → `verifyAccessToken()` → tries JWT verification, falls back to userinfo endpoint.
4. Result: `AuthContext` attached to request; downstream handlers check `authenticated` flag.

## Integration
- Consumed by: `app/AppServer` (initialization + route registration), `services/mcpService` (auth middleware), `services/trpcService` (auth middleware).
- Depends on: `@modelcontextprotocol/sdk` (ProxyOAuthServerProvider), `jose` (JWT/JWKS verification), `utils/logger`.
