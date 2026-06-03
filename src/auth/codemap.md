## Responsibility

Provides optional OAuth2/OIDC authentication for MCP and API endpoints using a reverse-proxy pattern. `ProxyAuthManager` discovers upstream OAuth endpoints, validates Bearer tokens (hybrid JWT + opaque via userinfo), and registers OAuth2 routes on Fastify. `createAuthMiddleware` produces a Fastify request hook that enforces binary authentication (authenticated or not) on protected routes.

## Design

- **Proxy pattern**: `ProxyAuthManager` wraps the MCP SDK's `ProxyOAuthServerProvider` to proxy authorization, token, revocation, and registration requests to an upstream IdP.
- **Hybrid token validation**: `verifyAccessToken()` first attempts JWT validation via `jose` JWKS; falls back to opaque token validation via the OIDC userinfo endpoint.
- **Discovery**: `discoverEndpoints()` tries RFC 8414 OAuth2 Authorization Server Metadata first, then falls back to OIDC discovery (`/.well-known/openid-configuration`).
- **Binary auth**: `AuthContext` uses a single scope `"*"` — any valid token grants full access. No role/permission granularity.
- **RFC compliance**: Registers `/.well-known/oauth-authorization-server` (RFC 8414) and `/.well-known/oauth-protected-resource` (RFC 9728) metadata endpoints.
- **Middleware factory**: `createAuthMiddleware()` returns a Fastify `onRequest` hook that extracts Bearer tokens, calls `createAuthContext()`, and returns 401 with `WWW-Authenticate` headers on failure.

## Flow

1. `AppServer` constructs `ProxyAuthManager` with `AuthConfig` (issuerUrl, audience, scopes) and calls `initialize()`.
2. `initialize()` discovers endpoints, sets up JWKS, creates the `ProxyOAuthServerProvider`.
3. `registerRoutes()` registers OAuth2 endpoints: authorize (redirect), token (proxy POST), revoke, dynamic registration, and both well-known metadata endpoints.
4. Per-request: `createAuthMiddleware` extracts the `Authorization` header → `createAuthContext()` → `verifyAccessToken()` → returns `AuthContext` on the request object.
5. If auth is disabled (`config.enabled = false`), all requests pass through.

## Integration

- **Consumers**: `AppServer` (initializes auth, registers routes, passes to services), tRPC/web service registration functions.
- **Dependencies**: `@modelcontextprotocol/sdk` (`ProxyOAuthServerProvider`), `jose` (JWT/JWKS), `fastify`, `AuthConfig` from `AppConfig.auth`.
