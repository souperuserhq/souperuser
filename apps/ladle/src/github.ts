/**
 * GitHub App client, dependency-free by design so the whole integration
 * is auditable in one file. Uses WebCrypto (available on Workers) for the
 * app JWT and plain fetch for the REST API.
 */
import type { Env } from "./env.js";

const API = "https://api.github.com";
const UA = "souperuser (https://github.com/souperuserhq/souperuser)";

function base64url(data: ArrayBuffer | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/\\n/g, "\n")
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** Short-lived JWT that authenticates as the GitHub App itself. */
async function appJwt(env: Env): Promise<string> {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(env.GITHUB_APP_PRIVATE_KEY),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: env.GITHUB_APP_ID }));
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${base64url(signature)}`;
}

/**
 * Installation access token: the credential that can actually read repos.
 * Issued by GitHub for ~1 hour; cached in KV for 55 minutes.
 */
export async function getInstallationToken(env: Env, installationId: number): Promise<string> {
  const cacheKey = `ghtok:${installationId}`;
  const cached = await env.CACHE.get(cacheKey);
  if (cached) return cached;

  const res = await fetch(`${API}/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${await appJwt(env)}`,
      accept: "application/vnd.github+json",
      "user-agent": UA,
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!res.ok) throw new Error(`GitHub token exchange failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { token: string };
  await env.CACHE.put(cacheKey, data.token, { expirationTtl: 55 * 60 });
  return data.token;
}

async function ghFetch<T>(token: string, path: string, accept = "application/vnd.github+json"): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept,
      "user-agent": UA,
      "x-github-api-version": "2022-11-28",
    },
  });
  if (res.status === 404) throw new NotFoundError(path);
  if (!res.ok) throw new Error(`GitHub API ${path} failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export class NotFoundError extends Error {
  constructor(path: string) {
    super(`Not found on GitHub: ${path}`);
  }
}

// ---------- Repo content (used by MCP tools) ----------

export interface RepoInfo {
  full_name: string;
  description: string | null;
  default_branch: string;
  language: string | null;
  size: number;
  updated_at: string;
}

export function getRepo(token: string, fullName: string): Promise<RepoInfo> {
  return ghFetch<RepoInfo>(token, `/repos/${fullName}`);
}

export async function getReadme(token: string, fullName: string): Promise<string | null> {
  try {
    const data = await ghFetch<{ content: string }>(token, `/repos/${fullName}/readme`);
    return decodeBase64Content(data.content);
  } catch (err) {
    if (err instanceof NotFoundError) return null;
    throw err;
  }
}

export async function getTreePaths(token: string, fullName: string, branch: string): Promise<{ paths: string[]; truncated: boolean }> {
  const data = await ghFetch<{ tree: { path: string; type: string }[]; truncated: boolean }>(
    token,
    `/repos/${fullName}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
  );
  return { paths: data.tree.filter((t) => t.type === "blob").map((t) => t.path), truncated: data.truncated };
}

export interface ContentFile {
  type: "file";
  path: string;
  size: number;
  content: string;
  encoding: string;
}
export interface ContentDirEntry {
  type: string;
  path: string;
  name: string;
  size: number;
}

export function getContents(token: string, fullName: string, path: string): Promise<ContentFile | ContentDirEntry[]> {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return ghFetch<ContentFile | ContentDirEntry[]>(token, `/repos/${fullName}/contents/${encoded}`);
}

export interface SearchMatch {
  path: string;
  /** Repository the match came from — callers must check it against the menu. */
  repoFullName: string;
  fragments: string[];
}

export async function searchCode(token: string, fullName: string, query: string): Promise<SearchMatch[]> {
  const q = encodeURIComponent(`${query} repo:${fullName}`);
  const data = await ghFetch<{
    items: { path: string; repository: { full_name: string }; text_matches?: { fragment: string }[] }[];
  }>(token, `/search/code?q=${q}&per_page=10`, "application/vnd.github.text-match+json");
  return data.items.map((item) => ({
    path: item.path,
    repoFullName: item.repository.full_name,
    fragments: (item.text_matches ?? []).map((m) => m.fragment),
  }));
}

export function decodeBase64Content(content: string): string {
  const binary = atob(content.replace(/\n/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

// ---------- Cook (engineer) user OAuth ----------

export async function exchangeUserCode(env: Env, code: string): Promise<string> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "user-agent": UA },
    body: JSON.stringify({
      client_id: env.GITHUB_APP_CLIENT_ID,
      client_secret: env.GITHUB_APP_CLIENT_SECRET,
      code,
    }),
  });
  const data = (await res.json()) as { access_token?: string; error_description?: string };
  if (!data.access_token) throw new Error(`GitHub OAuth failed: ${data.error_description ?? "no token"}`);
  return data.access_token;
}

export async function getUserLogin(userToken: string): Promise<string> {
  const user = await ghFetch<{ login: string }>(userToken, "/user");
  return user.login;
}

/** Installations of THIS app that the signed-in user can access — the tenancy boundary for Cooks. */
export async function listUserInstallationIds(userToken: string): Promise<number[]> {
  const data = await ghFetch<{ installations: { id: number }[] }>(userToken, "/user/installations?per_page=100");
  return data.installations.map((i) => i.id);
}

export interface InstallationRepo {
  id: number;
  full_name: string;
  private: boolean;
}

/** Source of truth for an installation's repo list — used to re-sync when a webhook was missed. */
export async function listInstallationRepos(env: Env, installationId: number): Promise<InstallationRepo[]> {
  const token = await getInstallationToken(env, installationId);
  const repos: InstallationRepo[] = [];
  for (let page = 1; page <= 10; page++) {
    const data = await ghFetch<{ repositories: InstallationRepo[] }>(
      token,
      `/installation/repositories?per_page=100&page=${page}`,
    );
    repos.push(...data.repositories.map((r) => ({ id: r.id, full_name: r.full_name, private: r.private })));
    if (data.repositories.length < 100) break;
  }
  return repos;
}
