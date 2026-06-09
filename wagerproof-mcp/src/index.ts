import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { authApp } from "./auth-app";
import { mcpApiHandler } from "./mcp-handler";

/**
 * Entry point. @cloudflare/workers-oauth-provider is BOTH the MCP server's OAuth
 * 2.1 authorization server AND the gatekeeper for the protected `/mcp` API:
 *  - it serves /.well-known/oauth-authorization-server, /token, and /register
 *    (Dynamic Client Registration + PKCE),
 *  - it returns 401 + WWW-Authenticate on unauthenticated /mcp,
 *  - on a valid bearer token it calls `mcpApiHandler` with the user's grant on
 *    ctx.props,
 *  - everything else (the /authorize consent page, /oauth-return, /callback,
 *    icon, docs/privacy/terms, /.well-known/oauth-protected-resource) falls
 *    through to `authApp`.
 *
 * `offline_access` is advertised so refresh tokens are issued without a later
 * server change.
 */
export default new OAuthProvider({
  apiRoute: "/mcp",
  apiHandler: mcpApiHandler as never,
  defaultHandler: authApp as never,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
  scopesSupported: ["wagerproof:read", "offline_access"],
});
