/**
 * Guard against GitHub search-qualifier injection.
 *
 * search_code interpolates the user's terms into a GitHub code-search query
 * that Souperuser scopes with `repo:<menu repo>`. A scope qualifier smuggled
 * into the terms (repo:, org:, user:) could try to widen the search to repos
 * that are not on the Taster's menu, so those are rejected outright.
 *
 * This is the fail-fast half of the defense. The authoritative half is in
 * mcp.ts, which drops every search result whose repository is not the exact
 * repo that was requested.
 */
export function hasScopeQualifier(query: string): boolean {
  return /(^|[^a-z0-9_])(repo|org|user):/i.test(query);
}
