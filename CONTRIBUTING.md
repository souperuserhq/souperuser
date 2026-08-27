# Contributing to Souperuser

Thanks for your interest! Souperuser is a small, focused project — contributions that keep it simple and auditable are the most valuable.

## Development setup

```sh
pnpm install
pnpm -r typecheck
pnpm -r test

# Run the Worker locally (see apps/ladle/.dev.vars.example for required secrets)
cd apps/ladle
cp .dev.vars.example .dev.vars   # fill in your dev GitHub App credentials
pnpm migrate:local
pnpm dev
```

## Ground rules

- **Security-relevant code stays boring.** The secrets filter, access checks, and GitHub client are intentionally dependency-free and readable in one sitting. Cleverness there is a bug.
- **New tools need a Kitchen Log entry** and a Menu check.
- **Tests for the secrets filter are mandatory** for any pattern change.
- Open an issue before large changes so we can discuss direction first.

## Releasing (maintainers)

GitHub Releases are the changelog — there is no CHANGELOG file to maintain.

1. Bump `version` in the root `package.json` and commit.
2. Tag and push:

   ```sh
   git tag v0.2.0
   git push origin v0.2.0
   ```

3. The release workflow creates the GitHub Release with auto-generated notes.

## Reporting security issues

Never via public issues — see [SECURITY.md](SECURITY.md).
