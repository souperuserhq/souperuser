import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";

export interface Env {
  DB: D1Database;
  OAUTH_KV: KVNamespace;
  CACHE: KVNamespace;
  /** Injected by workers-oauth-provider on the default handler. */
  OAUTH_PROVIDER: OAuthHelpers;

  /** Public base URL of this Worker, e.g. https://mcp.souperuser.com */
  PUBLIC_URL: string;

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

/** Props stored in the OAuth grant and delivered to the MCP handler. */
export interface TasterProps extends Record<string, unknown> {
  tasterId: string;
  installationId: number;
  label: string;
}
