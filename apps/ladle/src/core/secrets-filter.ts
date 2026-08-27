/**
 * Secrets filter: the safety layer between a repo and a Taster's AI.
 *
 * Souperuser never serves files that commonly contain credentials, even
 * though such files should not be committed in the first place. The filter
 * is deliberately path-based and conservative: false positives (blocking a
 * harmless file) are acceptable, false negatives are not.
 */

/** Hard cap on served file size. Large files are truncated, not blocked. */
export const MAX_FILE_BYTES = 400_000;

/**
 * Case-insensitive patterns matched against every path segment and filename.
 * Kept as plain regexes so anyone auditing the project can read the entire
 * policy in one screen.
 */
export const BLOCKED_PATH_PATTERNS: RegExp[] = [
  // Environment files: .env, .env.local, .env.production — but not .env.example
  /(^|\/)\.env(?!\.(example|sample|template|dist)$)(\.[^/]*)?$/i,
  // Private keys and certificates
  /\.(pem|key|p12|pfx|jks|keystore|asc|gpg|pgp)$/i,
  // SSH keys and config
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)(\.[^/]*)?$/i,
  /(^|\/)\.ssh(\/|$)/i,
  // Credential stores
  /(^|\/)(\.netrc|\.npmrc|\.pypirc|\.git-credentials)$/i,
  /(^|\/)credentials?(\.(json|ya?ml|xml|ini|txt))?$/i,
  /(^|\/)secrets?(\.(json|ya?ml|xml|ini|txt))?$/i,
  // Cloud provider credentials
  /(^|\/)\.aws(\/|$)/i,
  /(^|\/)service[-_]?account.*\.json$/i,
  // Terraform state and variable files (frequently contain secrets)
  /\.tfstate(\.[^/]*)?$/i,
  /\.tfvars$/i,
  // Keychains and password databases
  /\.(kdbx?|agilekeychain|keychain)$/i,
];

/** Returns true when a repo path may be served to a Taster. */
export function isPathAllowed(path: string): boolean {
  const normalized = path.replace(/^\/+/, "");
  return !BLOCKED_PATH_PATTERNS.some((pattern) => pattern.test(normalized));
}

/** Filters a list of repo paths (e.g. a git tree) down to servable ones. */
export function filterTree(paths: string[]): string[] {
  return paths.filter(isPathAllowed);
}
