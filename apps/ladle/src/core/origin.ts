/**
 * Which browser origins may read credentialed responses (/dash/whoami).
 *
 * Trust is anchored on the configured PUBLIC_URL: with a custom domain like
 * mcp.example.com, the parent domain and its subdomains (where the marketing
 * site lives) are allowed. Without a PUBLIC_URL — the default *.workers.dev
 * self-host — only the Worker's own origin is trusted, because workers.dev
 * is a public suffix shared with strangers' Workers.
 */

/** Shared-suffix domains that must never be treated as a trusted parent. */
const PUBLIC_SUFFIXES = new Set(["workers.dev", "pages.dev"]);

export function originAllowed(originHost: string, workerHost: string, publicHost: string | null): boolean {
  if (originHost === workerHost) return true;
  if (originHost === "localhost" || originHost === "127.0.0.1") return true;
  if (!publicHost) return false;
  if (originHost === publicHost) return true;
  const parent = publicHost.split(".").slice(1).join(".");
  // A trusted parent needs at least two labels (never a bare TLD) and must
  // not be a shared public suffix.
  if (!parent.includes(".") || PUBLIC_SUFFIXES.has(parent)) return false;
  return originHost === parent || originHost.endsWith(`.${parent}`);
}
