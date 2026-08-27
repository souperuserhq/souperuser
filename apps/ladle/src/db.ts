import type { Env } from "./env.js";

export interface InstallationRow {
  id: number;
  account_login: string;
  account_type: string;
  /** GitHub login of the Cook who installed the app; null only for legacy org rows awaiting backfill. */
  installed_by: string | null;
}

export interface RepoRow {
  repo_id: number;
  installation_id: number;
  full_name: string;
  private: number;
}

export interface TasterRow {
  id: string;
  installation_id: number;
  menu_id: string;
  label: string;
  revoked_at: string | null;
}

export interface InviteRow {
  token: string;
  installation_id: number;
  menu_id: string;
  label: string;
  expires_at: string;
  used_at: string | null;
}

export interface KitchenLogRow {
  taster_id: string;
  tool: string;
  repo: string | null;
  detail: string | null;
  created_at: string;
  taster_label: string | null;
}

// ---------- Installations & repos (synced from GitHub webhooks) ----------

export async function upsertInstallation(
  env: Env,
  id: number,
  accountLogin: string,
  accountType: string,
  installedBy: string | null = null,
): Promise<void> {
  // COALESCE keeps the original installer when later webhooks (repo changes) upsert without one.
  await env.DB.prepare(
    `INSERT INTO installations (id, account_login, account_type, installed_by) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET account_login = excluded.account_login, account_type = excluded.account_type,
       installed_by = COALESCE(excluded.installed_by, installations.installed_by)`,
  )
    .bind(id, accountLogin, accountType, installedBy)
    .run();
}

export async function deleteInstallation(env: Env, id: number): Promise<void> {
  await env.DB.prepare(`DELETE FROM installations WHERE id = ?`).bind(id).run();
}

export async function addRepos(env: Env, installationId: number, repos: { id: number; full_name: string; private: boolean }[]): Promise<void> {
  const stmt = env.DB.prepare(
    `INSERT INTO repos (repo_id, installation_id, full_name, private) VALUES (?, ?, ?, ?)
     ON CONFLICT(repo_id) DO UPDATE SET full_name = excluded.full_name, private = excluded.private`,
  );
  await env.DB.batch(repos.map((r) => stmt.bind(r.id, installationId, r.full_name, r.private ? 1 : 0)));
}

export async function removeRepos(env: Env, installationId: number, repoIds: number[]): Promise<void> {
  const stmt = env.DB.prepare(`DELETE FROM repos WHERE installation_id = ? AND repo_id = ?`);
  await env.DB.batch(repoIds.map((id) => stmt.bind(installationId, id)));
}

/** Full reconcile against GitHub's repo list — one atomic batch so the dashboard never sees a half-synced state. */
export async function replaceRepos(env: Env, installationId: number, repos: { id: number; full_name: string; private: boolean }[]): Promise<void> {
  const insert = env.DB.prepare(`INSERT INTO repos (repo_id, installation_id, full_name, private) VALUES (?, ?, ?, ?)`);
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM repos WHERE installation_id = ?`).bind(installationId),
    ...repos.map((r) => insert.bind(r.id, installationId, r.full_name, r.private ? 1 : 0)),
  ]);
}

export async function listInstallations(env: Env, ids: number[]): Promise<InstallationRow[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  const { results } = await env.DB.prepare(`SELECT * FROM installations WHERE id IN (${placeholders})`)
    .bind(...ids)
    .all<InstallationRow>();
  return results;
}

export async function listRepos(env: Env, installationId: number): Promise<RepoRow[]> {
  const { results } = await env.DB.prepare(`SELECT * FROM repos WHERE installation_id = ? ORDER BY full_name`)
    .bind(installationId)
    .all<RepoRow>();
  return results;
}

// ---------- Menus & invites ----------

export async function createMenuWithInvite(
  env: Env,
  opts: {
    installationId: number;
    menuName: string;
    repoFullNames: string[];
    label: string;
    createdBy: string;
    inviteToken: string;
    expiresAt: string;
  },
): Promise<void> {
  const menuId = crypto.randomUUID();
  const statements = [
    env.DB.prepare(`INSERT INTO menus (id, installation_id, name, created_by) VALUES (?, ?, ?, ?)`).bind(
      menuId,
      opts.installationId,
      opts.menuName,
      opts.createdBy,
    ),
    ...opts.repoFullNames.map((name) =>
      env.DB.prepare(`INSERT INTO menu_repos (menu_id, repo_full_name) VALUES (?, ?)`).bind(menuId, name),
    ),
    env.DB.prepare(
      `INSERT INTO invites (token, installation_id, menu_id, label, created_by, expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(opts.inviteToken, opts.installationId, menuId, opts.label, opts.createdBy, opts.expiresAt),
  ];
  await env.DB.batch(statements);
}

export async function getInvite(env: Env, token: string): Promise<InviteRow | null> {
  return env.DB.prepare(`SELECT * FROM invites WHERE token = ?`).bind(token).first<InviteRow>();
}

/** Burns the invite and creates the Taster in one atomic batch. */
export async function consumeInvite(env: Env, invite: InviteRow): Promise<string> {
  const tasterId = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(`UPDATE invites SET used_at = datetime('now') WHERE token = ? AND used_at IS NULL`).bind(invite.token),
    env.DB.prepare(`INSERT INTO tasters (id, installation_id, menu_id, label) VALUES (?, ?, ?, ?)`).bind(
      tasterId,
      invite.installation_id,
      invite.menu_id,
      invite.label,
    ),
  ]);
  return tasterId;
}

// ---------- Tasters & access checks ----------

/**
 * The access check every MCP tool call goes through:
 * taster exists, not revoked, and we resolve their Menu's repo list.
 */
export async function getTasterAccess(
  env: Env,
  tasterId: string,
): Promise<{ taster: TasterRow; repoFullNames: string[] } | null> {
  const taster = await env.DB.prepare(`SELECT * FROM tasters WHERE id = ? AND revoked_at IS NULL`)
    .bind(tasterId)
    .first<TasterRow>();
  if (!taster) return null;
  const { results } = await env.DB.prepare(`SELECT repo_full_name FROM menu_repos WHERE menu_id = ?`)
    .bind(taster.menu_id)
    .all<{ repo_full_name: string }>();
  // A menu repo must also still be part of the installation (webhook-synced).
  const { results: installed } = await env.DB.prepare(`SELECT full_name FROM repos WHERE installation_id = ?`)
    .bind(taster.installation_id)
    .all<{ full_name: string }>();
  const installedSet = new Set(installed.map((r) => r.full_name));
  const repoFullNames = results.map((r) => r.repo_full_name).filter((name) => installedSet.has(name));
  return { taster, repoFullNames };
}

export async function listTasters(env: Env, installationId: number): Promise<TasterRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT * FROM tasters WHERE installation_id = ? ORDER BY created_at DESC`,
  )
    .bind(installationId)
    .all<TasterRow>();
  return results;
}

export async function revokeTaster(env: Env, tasterId: string, installationId: number): Promise<void> {
  await env.DB.prepare(`UPDATE tasters SET revoked_at = datetime('now') WHERE id = ? AND installation_id = ?`)
    .bind(tasterId, installationId)
    .run();
}

// ---------- Kitchen Log ----------

export async function logKitchen(
  env: Env,
  entry: { tasterId: string; installationId: number; tool: string; repo?: string; detail?: string },
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO kitchen_log (taster_id, installation_id, tool, repo, detail) VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(entry.tasterId, entry.installationId, entry.tool, entry.repo ?? null, entry.detail ?? null)
    .run();
}

export async function listKitchenLog(env: Env, installationId: number, limit = 50): Promise<KitchenLogRow[]> {
  const { results } = await env.DB.prepare(
    `SELECT k.taster_id, k.tool, k.repo, k.detail, k.created_at, t.label AS taster_label
     FROM kitchen_log k LEFT JOIN tasters t ON t.id = k.taster_id
     WHERE k.installation_id = ? ORDER BY k.id DESC LIMIT ?`,
  )
    .bind(installationId, limit)
    .all<KitchenLogRow>();
  return results;
}
