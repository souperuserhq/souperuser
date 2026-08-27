# Security Policy

Souperuser's entire purpose is safe, read-only access to source code — security reports are taken seriously and are very welcome.

## Reporting a vulnerability

Please report vulnerabilities **privately** via [GitHub's private vulnerability reporting](https://github.com/souperuserhq/souperuser/security/advisories/new) on this repository. Do not open public issues for security problems.

You can expect an initial response within a few days. Please include reproduction steps and the potential impact.

## Security model (what Souperuser guarantees)

- **Read-only by construction**: the GitHub App requests only `contents: read` and `metadata: read`. It cannot write, even if fully compromised.
- **GitHub enforces the outer boundary**: installation tokens can only read repos the installing engineer selected. Application bugs cannot widen that boundary.
- **Per-user menus**: every access token is bound to one Taster, whose Menu is a subset of one installation's repos, checked on every tool call.
- **No code storage**: repo contents are fetched from GitHub at request time and never persisted. Only short-lived installation tokens are cached (KV, 55 minutes).
- **Sensitive-file filter**: paths matching key/credential patterns are never served — see [`apps/ladle/src/core/secrets-filter.ts`](apps/ladle/src/core/secrets-filter.ts).
- **Audit log**: every tool call is recorded in the Kitchen Log.

## Scope

The hosted instance and this codebase are in scope. Vulnerabilities in dependencies should also be reported upstream.
