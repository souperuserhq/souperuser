# Souperuser 🍲

[![CI](https://github.com/souperuserhq/souperuser/actions/workflows/ci.yml/badge.svg)](https://github.com/souperuserhq/souperuser/actions/workflows/ci.yml)

> **All the flavor. None of the root.**

Souperuser gives non-engineers' AI assistants **read-only** access to your GitHub repos via [MCP](https://modelcontextprotocol.io). Your PM connects Claude or ChatGPT, asks "how does the checkout discount actually work?", and gets an answer grounded in the real code — while you keep the pot.

- **Engineers** install a GitHub App and pick exactly which repos are shared
- **Non-engineers** get an invite link — no GitHub account needed
- Their AI connects to one MCP endpoint with OAuth and can list, search, and read allowed code
- Every access lands in an audit log

## Why engineers can say yes to this

1. **Read-only by construction.** The GitHub App requests only `contents: read` + `metadata: read`. It *cannot* write — GitHub enforces this, not us.
2. **GitHub is the outer wall.** Installation tokens physically cannot reach repos outside the installation. A bug in Souperuser cannot widen access.
3. **Per-person menus.** Each invite is bound to a repo subset. Every tool call re-checks it.
4. **Your code is never stored.** Files are fetched from GitHub at request time. Nothing is indexed, embedded, or persisted.
5. **Sensitive files are never served.** `.env`, keys, credentials — see the [secrets filter](apps/ladle/src/core/secrets-filter.ts) (one screen of readable regexes, fully tested).
6. **It's all open source.** Audit everything, or self-host it so your code never touches our infrastructure at all.

## Architecture

One Cloudflare Worker does everything:

```
AI client (Claude/ChatGPT) ──OAuth 2.1──▶ Worker ──installation token──▶ GitHub API
                                            │
                                   D1 (users, repo allowlists,   KV (OAuth grants,
                                    audit log)                    token cache ~55min)
```

- MCP server: official [TypeScript SDK v2](https://github.com/modelcontextprotocol/typescript-sdk) (`@modelcontextprotocol/server`), spec 2026-07-28, Streamable HTTP
- OAuth: [`workers-oauth-provider`](https://github.com/cloudflare/workers-oauth-provider) — Client ID Metadata Documents + DCR fallback
- Tools: `list_pots`, `repo_overview`, `search_code`, `read_file`

## Self-hosting

One click — Cloudflare clones the Worker into your GitHub account, provisions the D1 database and KV namespaces, and prompts for your GitHub App secrets:

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/souperuserhq/souperuser/tree/main/apps/ladle)

You register your own GitHub App first, so *your* instance holds *your* keys. The [Worker README](apps/ladle/README.md) walks through the full flow — including custom domains and the manual `wrangler` path if you'd rather not click buttons.

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
| `apps/ladle/src/core` | Domain types and the secrets filter (start auditing here) |
| `apps/web` | Marketing site (Next.js) |

## License

[MIT](LICENSE) — self-host it, fork it, ladle it out. Security reports: see [SECURITY.md](SECURITY.md).
