# Souperuser 🍲

[![CI](https://github.com/souperuserhq/souperuser/actions/workflows/ci.yml/badge.svg)](https://github.com/souperuserhq/souperuser/actions/workflows/ci.yml)

> **All the flavor. None of the root.**

Souperuser gives non-engineers' AI assistants **read-only** access to your GitHub repos via [MCP](https://modelcontextprotocol.io). Your PM connects Claude or ChatGPT, asks "how does the checkout discount actually work?", and gets an answer grounded in the real code — while you keep the pot.

- **Engineers (Cooks)** install a GitHub App and pick exactly which repos are shared
- **Non-engineers (Tasters)** get an invite link — no GitHub account needed
- Their AI connects to one MCP endpoint with OAuth and can list, search, and read allowed code
- Every access lands in an audit log (the **Kitchen Log**)

## Why engineers can say yes to this

1. **Read-only by construction.** The GitHub App requests only `contents: read` + `metadata: read`. It *cannot* write — GitHub enforces this, not us.
2. **GitHub is the outer wall.** Installation tokens physically cannot reach repos outside the installation. A bug in Souperuser cannot widen access.
3. **Per-person menus.** Each invite is bound to a repo subset. Every tool call re-checks it.
4. **Your code is never stored.** Files are fetched from GitHub at request time. Nothing is indexed, embedded, or persisted.
5. **Sensitive files are never served.** `.env`, keys, credentials — see the [secrets filter](packages/core/src/secrets-filter.ts) (one screen of readable regexes, fully tested).
6. **It's all open source.** Audit everything, or self-host it so your code never touches our infrastructure at all.

## Architecture

One Cloudflare Worker ("the Ladle") does everything:

```
AI client (Claude/ChatGPT) ──OAuth 2.1──▶ Worker ──installation token──▶ GitHub API
                                            │
                                   D1 (menus, tasters,          KV (OAuth grants,
                                    kitchen log)                 token cache ~55min)
```

- MCP server: official [TypeScript SDK v2](https://github.com/modelcontextprotocol/typescript-sdk) (`@modelcontextprotocol/server`), spec 2026-07-28, Streamable HTTP
- OAuth: [`workers-oauth-provider`](https://github.com/cloudflare/workers-oauth-provider) — Client ID Metadata Documents + DCR fallback
- Tools: `list_pots`, `repo_overview`, `search_code`, `read_file`

## Self-hosting (~15 minutes)

You need a free Cloudflare account and a GitHub App you register yourself (so *your* instance holds *your* keys).

1. **Register a GitHub App** (Settings → Developer settings → GitHub Apps → New):
   - Permissions: Repository → Contents: Read-only, Metadata: Read-only. Nothing else.
   - Webhook URL: `https://<your-worker-domain>/webhooks/github` + a webhook secret
   - Callback URL: `https://<your-worker-domain>/dash/callback`
   - Generate a private key, then convert it for WebCrypto:
     `openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in downloaded.pem`
2. **Create the Cloudflare resources** and put their IDs in [`apps/ladle/wrangler.jsonc`](apps/ladle/wrangler.jsonc):
   ```sh
   cd apps/ladle
   pnpm wrangler kv namespace create OAUTH_KV
   pnpm wrangler kv namespace create CACHE
   pnpm wrangler d1 create souperuser
   ```
3. **Set secrets** (`wrangler secret put` for each): `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_SLUG`, `GITHUB_WEBHOOK_SECRET`, `COOKIE_SECRET`. Set `PUBLIC_URL` in `wrangler.jsonc` vars.
4. **Migrate and deploy:**
   ```sh
   pnpm migrate:remote
   pnpm deploy
   ```
5. Install your GitHub App on your org, open `/dash`, create an invite, and connect an AI client to `https://<your-worker-domain>/mcp`.

## Local development

```sh
pnpm install && pnpm -r test
cd apps/ladle
cp .dev.vars.example .dev.vars   # fill in a dev GitHub App
pnpm migrate:local
pnpm dev                          # http://localhost:8787
```

Test the MCP endpoint with [MCP Inspector](https://github.com/modelcontextprotocol/inspector): `npx @modelcontextprotocol/inspector@latest`, connect to `http://localhost:8787/mcp`.

## Repo layout

| Path | What |
| --- | --- |
| `apps/ladle` | The Cloudflare Worker: MCP server, OAuth, dashboard, webhooks |
| `apps/web` | Marketing site (Next.js) |
| `packages/core` | Shared types and the secrets filter (start auditing here) |

## Vocabulary

Cooks (engineers) share Pots (repos) via Menus (repo subsets) with Tasters (read-only users). The Ladle (MCP server) serves it, and everything is written to the Kitchen Log. You get it.

## License

[MIT](LICENSE) — self-host it, fork it, ladle it out. Security reports: see [SECURITY.md](SECURITY.md).
