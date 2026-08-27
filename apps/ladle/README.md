# Souperuser — the Worker

One Cloudflare Worker that gives AI assistants **read-only** access to exactly the GitHub repos you pick, over [MCP](https://modelcontextprotocol.io). Nothing is stored — files are proxied live from GitHub, secrets are filtered, every read is logged.

Full project, docs, and issues: [souperuserhq/souperuser](https://github.com/souperuserhq/souperuser).

## Deploy your own

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/souperuserhq/souperuser/tree/main/apps/ladle)

The button clones this Worker into your GitHub account, provisions the D1 database and KV namespaces, and prompts for the secrets below. Your instance holds your keys — you register your own GitHub App:

1. **Register a GitHub App** ([Settings → Developer settings → GitHub Apps → New](https://github.com/settings/apps/new)):
   - Permissions: Repository → **Contents: Read-only**, **Metadata: Read-only**. Nothing else.
   - Callback URL: any placeholder — you will set the real one after deploy.
   - Webhook: leave **inactive** for now (same reason), but note down a webhook secret.
   - Generate a private key, then convert it for WebCrypto:
     `openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in downloaded.pem`
2. **Click the deploy button** and paste the App's values when prompted.
3. **Point the App at your Worker.** Your deploy gets a URL like `https://<worker>.<account>.workers.dev`. In your GitHub App settings, set:
   - Callback URL: `https://<your-url>/dash/callback`
   - Webhook URL: `https://<your-url>/webhooks/github`, then activate the webhook.
4. **Install the App** on your account or org, open `https://<your-url>/dash`, and create your first invite.

## Custom domain (optional)

Uncomment `routes` in [`wrangler.jsonc`](wrangler.jsonc) and set your hostname — Cloudflare provisions DNS and certs on the next deploy. Then pin canonical links to it:

```sh
npx wrangler secret put PUBLIC_URL   # e.g. https://mcp.example.com
```

Without it, the Worker uses each request's own origin, which is always correct for the default `*.workers.dev` setup.

## Manual deploy

No button, no repo clone — from your checkout of this directory:

```sh
npx wrangler kv namespace create OAUTH_KV   # put the IDs in wrangler.jsonc
npx wrangler kv namespace create CACHE
npx wrangler d1 create souperuser
npx wrangler secret put GITHUB_APP_ID       # repeat for every secret in .dev.vars.example
npm run deploy                              # applies D1 migrations, then deploys
```

## Local development

```sh
cp .dev.vars.example .dev.vars   # fill in a dev GitHub App
npm run migrate:local
npm run dev                      # http://localhost:8787
```

Test the MCP endpoint with [MCP Inspector](https://github.com/modelcontextprotocol/inspector): `npx @modelcontextprotocol/inspector@latest`, connect to `http://localhost:8787/mcp`.

## Auditing

Start at [`src/core/secrets-filter.ts`](src/core/secrets-filter.ts) — one screen of tested regexes deciding which paths are never served. The rest: `src/mcp.ts` (the four read-only tools), `src/github.ts` (the live GitHub proxy), `src/app-handler.ts` (dashboard, invites, consent).
