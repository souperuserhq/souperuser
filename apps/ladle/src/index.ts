/**
 * Souperuser "Ladle" — Worker entry point.
 *
 * workers-oauth-provider owns the OAuth surface (/authorize, /oauth/token,
 * /oauth/register, /.well-known/*) and verifies bearer tokens on /mcp.
 * Verified requests reach mcpApiHandler with the grant props on ctx.props;
 * everything else goes to appHandler.
 */
import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { createMcpHandler, hostHeaderValidationResponse, originValidationResponse } from "@modelcontextprotocol/server";
import { appHandler } from "./app-handler.js";
import { getTasterAccess } from "./db.js";
import type { Env, TasterProps } from "./env.js";
import { buildServer } from "./mcp.js";
import { rateLimit, rateLimited } from "./ratelimit.js";

const mcpApiHandler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const requestHost = new URL(request.url).hostname;
    // When PUBLIC_URL is unset (the default self-host setup), the request's own
    // host is canonical — Cloudflare only routes hostnames configured for this
    // Worker. A *.workers.dev request can only reach this Worker via its own
    // route, so that hostname stays allowed alongside the custom domain
    // (keeps connectors installed against the old URL working).
    const publicHost = env.PUBLIC_URL ? new URL(env.PUBLIC_URL).hostname : requestHost;
    const allowedHosts = [publicHost, "localhost", "127.0.0.1"];
    if (requestHost.endsWith(".workers.dev")) allowedHosts.push(requestHost);
    const rejected =
      hostHeaderValidationResponse(request, allowedHosts) ??
      originValidationResponse(request, allowedHosts);
    if (rejected) return rejected;

    // Token already verified by workers-oauth-provider; grant props are on ctx.
    const props = (ctx as ExecutionContext & { props: TasterProps }).props;
    // Throttle before any DB or GitHub work — one noisy client must not
    // exhaust the installation's shared GitHub rate limit for everyone else.
    if (!(await rateLimit(env, "mcp", props.tasterId, 60))) return rateLimited(60);
    const access = await getTasterAccess(env, props.tasterId);
    if (!access) {
      return new Response("Access revoked. Ask the engineer who invited you for a new invite.", { status: 403 });
    }

    // Menu and installation token must derive from the same fresh Taster row,
    // so the grant's frozen installationId is overridden with the current one.
    const liveProps = { ...props, installationId: access.taster.installation_id };
    const handler = createMcpHandler(() =>
      buildServer(env, { props: liveProps, repoFullNames: access.repoFullNames }, (p) => ctx.waitUntil(p)),
    );
    return handler.fetch(request);
  },
};

export default new OAuthProvider<Env>({
  apiRoute: "/mcp",
  apiHandler: mcpApiHandler,
  defaultHandler: appHandler,

  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/oauth/token",

  scopesSupported: ["mcp:read"],

  // MCP 2026-07-28 prefers Client ID Metadata Documents; DCR kept as fallback.
  clientIdMetadataDocumentEnabled: true,
  clientRegistrationEndpoint: "/oauth/register",
});
