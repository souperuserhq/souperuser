import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

export interface Env {
  DB: D1Database;
  OAUTH_KV: KVNamespace;
  CACHE: KVNamespace;
  /** Injected by workers-oauth-provider on the default handler. */
  OAUTH_PROVIDER: OAuthHelpers;

  /** Optional canonical base URL, e.g. https://mcp.souperuser.com — set as a
   *  secret when serving a custom domain. Unset, each request's own origin is
   *  used, which is always correct for the default *.workers.dev setup. */
  PUBLIC_URL?: string;

  // GitHub App credentials (secrets — set via `wrangler secret put` or .dev.vars)
  GITHUB_APP_ID: string;
  /** App private key in PKCS8 PEM. GitHub hands out PKCS1; convert once with:
   *  openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in app.pem */
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_APP_CLIENT_ID: string;
  GITHUB_APP_CLIENT_SECRET: string;
  GITHUB_APP_SLUG: string;
  GITHUB_WEBHOOK_SECRET: string;

  /** Random secret for signing session cookies and invite payloads. */
  COOKIE_SECRET: string;
}

/** Canonical public origin: PUBLIC_URL when set, else the request's own origin. */
export function publicUrl(env: Env, request: Request): string {
  return env.PUBLIC_URL ? env.PUBLIC_URL.replace(/\/+$/, "") : new URL(request.url).origin;
}

/** Props stored in the OAuth grant and delivered to the MCP handler. */
export interface TasterProps extends Record<string, unknown> {
  tasterId: string;
  installationId: number;
  label: string;
}
