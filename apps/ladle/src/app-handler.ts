/**
 * Everything that is not the MCP endpoint: landing page, Cook dashboard,
 * invite links, the OAuth consent screen, and GitHub webhooks.
 */
import { AuthorizationError, type AuthRequest } from "@cloudflare/workers-oauth-provider";
import {
  consumeInvite,
  createMenuWithInvite,
  getInvite,
  getTasterAccess,
  listInstallations,
  listKitchenLog,
  listRepos,
  listTasters,
  replaceRepos,
  revokeTaster,
} from "./db.js";
import { publicUrl, type Env } from "./env.js";
import { exchangeUserCode, getUserLogin, listInstallationRepos, listUserInstallationIds } from "./github.js";
import { esc, page } from "./html.js";
import { COOK_COOKIE, cookieHeader, getCookie, signValue, TASTER_COOKIE, verifyValue } from "./session.js";
import { handleWebhook } from "./webhooks.js";

interface CookSession {
  login: string;
  installationIds: number[];
}

function randomToken(bytes = 24): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getCookSession(request: Request, env: Env): Promise<CookSession | null> {
  const id = getCookie(request, COOK_COOKIE);
  if (!id) return null;
  const raw = await env.OAUTH_KV.get(`cooksess:${id}`);
  return raw ? (JSON.parse(raw) as CookSession) : null;
}

async function getTasterId(request: Request, env: Env): Promise<string | null> {
  const cookie = getCookie(request, TASTER_COOKIE);
  if (!cookie) return null;
  return verifyValue(cookie, env.COOKIE_SECRET);
}

/**
 * Dashboard tenancy: GitHub's /user/installations lists every installation
 * covering repos the user can access — that includes ALL repo collaborators.
 * Managing tasters/invites/logs is reserved for the Cook who installed the app.
 */
async function ownedInstallations(env: Env, session: CookSession) {
  const installations = await listInstallations(env, session.installationIds);
  return installations.filter((inst) => inst.installed_by === session.login);
}

async function ownsInstallation(env: Env, session: CookSession, installationId: number): Promise<boolean> {
  if (!session.installationIds.includes(installationId)) return false;
  const [inst] = await listInstallations(env, [installationId]);
  return inst?.installed_by === session.login;
}

export const appHandler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/webhooks/github" && request.method === "POST") return handleWebhook(request, env);
    if (path === "/") return landing(env);
    if (path === "/dash/login") return cookLogin(request, env);
    if (path === "/dash/logout" && request.method === "POST") return cookLogout(request, env);
    if (path === "/dash/whoami") return whoami(request, env);
    if (path === "/dash/callback") return cookCallback(request, env, url);
    if (path === "/dash" && request.method === "GET") return dashboard(request, env);
    if (path === "/dash/invites" && request.method === "POST") return createInvite(request, env);
    if (path === "/dash/revoke" && request.method === "POST") return revoke(request, env);
    if (path === "/dash/sync" && request.method === "POST") return syncRepos(request, env);
    if (path.startsWith("/invite/")) return acceptInvite(request, env, path.slice("/invite/".length));
    if (path === "/connect") return connectPage(request, env);
    if (path === "/authorize" && request.method === "GET") return authorizeScreen(request, env);
    if (path === "/authorize/approve" && request.method === "POST") return authorizeApprove(request, env);

    return new Response("Not found", { status: 404 });
  },
};

function landing(env: Env): Response {
  return page(
    "Souperuser",
    `<div class="logo"><img src="/logo.svg" alt="souperuser" width="74" height="74"></div>
     <p><strong>All the flavor. None of the root.</strong></p>
     <p>Read-only GitHub access for AI assistants. Engineers install a GitHub App;
        everyone else connects Claude or ChatGPT and gets answers grounded in the real code.</p>
     <div class="card">
       <p><strong>Engineer?</strong> Install the GitHub App, then manage access here.</p>
       <a class="btn" href="https://github.com/apps/${esc(env.GITHUB_APP_SLUG)}/installations/new">Install GitHub App</a>
       &nbsp; <a class="btn" href="/dash">Open dashboard</a>
     </div>
     <p class="muted">Open source: <a href="https://github.com/souperuserhq/souperuser">github.com/souperuserhq/souperuser</a></p>`,
  );
}

// ---------- Cook (engineer) auth ----------

function cookLogin(request: Request, env: Env): Response {
  const redirect = new URL("https://github.com/login/oauth/authorize");
  redirect.searchParams.set("client_id", env.GITHUB_APP_CLIENT_ID);
  redirect.searchParams.set("redirect_uri", `${publicUrl(env, request)}/dash/callback`);
  return Response.redirect(redirect.toString(), 302);
}

async function cookCallback(request: Request, env: Env, url: URL): Promise<Response> {
  const code = url.searchParams.get("code");
  if (!code) return new Response("Missing code", { status: 400 });
  const userToken = await exchangeUserCode(env, code);
  const [login, installationIds] = await Promise.all([getUserLogin(userToken), listUserInstallationIds(userToken)]);
  const sessionId = randomToken();
  const session: CookSession = { login, installationIds };
  await env.OAUTH_KV.put(`cooksess:${sessionId}`, JSON.stringify(session), { expirationTtl: 8 * 3600 });
  return new Response(null, {
    status: 302,
    headers: { location: "/dash", "set-cookie": cookieHeader(COOK_COOKIE, sessionId, 8 * 3600) },
  });
}

async function cookLogout(request: Request, env: Env): Promise<Response> {
  const id = getCookie(request, COOK_COOKIE);
  if (id) await env.OAUTH_KV.delete(`cooksess:${id}`);
  return new Response(null, {
    status: 302,
    headers: { location: "/", "set-cookie": cookieHeader(COOK_COOKIE, "", 0) },
  });
}

/**
 * Auth probe for the marketing site's nav. Site and Worker live on sibling
 * hostnames of the same registrable domain, so the SameSite=Lax session cookie
 * rides along on the fetch; CORS still applies because the origins differ.
 * Only same-parent-domain origins (plus localhost for dev) may read the reply.
 */
async function whoami(request: Request, env: Env): Promise<Response> {
  const headers = new Headers({ "content-type": "application/json", "cache-control": "no-store" });
  const origin = request.headers.get("origin");
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).hostname;
    } catch {
      return new Response(null, { status: 403 });
    }
    const workerHost = new URL(request.url).hostname;
    const parent = workerHost.split(".").slice(1).join(".");
    const allowed =
      originHost === workerHost ||
      originHost === parent ||
      originHost.endsWith(`.${parent}`) ||
      originHost === "localhost" ||
      originHost === "127.0.0.1";
    if (!allowed) return new Response(null, { status: 403 });
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-credentials", "true");
    headers.set("vary", "origin");
  }
  const session = await getCookSession(request, env);
  if (!session) return new Response("{}", { status: 401, headers });
  return new Response(JSON.stringify({ login: session.login }), { headers });
}

// ---------- Cook dashboard ----------

async function dashboard(request: Request, env: Env): Promise<Response> {
  const session = await getCookSession(request, env);
  if (!session) {
    return page(
      "Sign in",
      `<h1>Souperuser dashboard</h1>
       <div class="card"><p>Sign in with GitHub to manage who can taste your repos.</p>
       <a class="btn" href="/dash/login">Sign in with GitHub</a></div>`,
    );
  }

  const installations = await ownedInstallations(env, session);
  if (installations.length === 0) {
    return page(
      "Dashboard",
      `<h1>Hi @${esc(session.login)}</h1>
       <div class="card"><p>No Souperuser installation of yours found yet. Only the person who installed the app manages its sharing.</p>
       <a class="btn" href="https://github.com/apps/${esc(env.GITHUB_APP_SLUG)}/installations/new">Install the GitHub App</a></div>`,
      { login: session.login },
    );
  }

  const sections = await Promise.all(
    installations.map(async (inst) => {
      const [repos, tasters, log] = await Promise.all([
        listRepos(env, inst.id),
        listTasters(env, inst.id),
        listKitchenLog(env, inst.id, 30),
      ]);
      const repoChecks = repos
        .map(
          (r) =>
            `<label style="font-weight:400"><input type="checkbox" name="repo" value="${esc(r.full_name)}"> ${esc(r.full_name)}</label>`,
        )
        .join("");
      const tasterRows = tasters
        .map(
          (t) => `<tr>
            <td>${esc(t.label)}</td>
            <td>${t.revoked_at ? "revoked" : "active"}</td>
            <td>${t.revoked_at ? "" : `<form method="post" action="/dash/revoke" style="margin:0">
              <input type="hidden" name="taster_id" value="${esc(t.id)}">
              <input type="hidden" name="installation_id" value="${inst.id}">
              <button class="btn" style="padding:0.2rem 0.6rem;font-size:0.8rem">Revoke</button></form>`}</td>
          </tr>`,
        )
        .join("");
      const logRows = log
        .map(
          (l) =>
            `<tr><td>${esc(l.created_at)}</td><td>${esc(l.taster_label ?? l.taster_id)}</td><td>${esc(l.tool)}</td><td>${esc(l.repo ?? "")} ${esc(l.detail ?? "")}</td></tr>`,
        )
        .join("");
      // GitHub's installation settings page is where repo access is granted;
      // orgs and personal accounts have different URLs.
      const manageUrl =
        inst.account_type === "Organization"
          ? `https://github.com/organizations/${esc(inst.account_login)}/settings/installations/${inst.id}`
          : `https://github.com/settings/installations/${inst.id}`;
      return `<h2>${esc(inst.account_login)}</h2>
        <div class="muted" style="margin:0 0 1.5rem">${repos.length} ${repos.length === 1 ? "pot" : "pots"} on the stove ·
          <a href="${manageUrl}">Add or remove repos on GitHub</a> ·
          <form method="post" action="/dash/sync" style="display:inline;margin:0">
            <input type="hidden" name="installation_id" value="${inst.id}">
            <button class="btn" style="padding:0.1rem 0.6rem;font-size:12px">↻ re-sync</button>
          </form></div>
        <div class="card">
          <h3>Invite a Taster</h3>
          <form method="post" action="/dash/invites">
            <input type="hidden" name="installation_id" value="${inst.id}">
            <label for="label">Who is this for?</label>
            <input type="text" name="label" id="label" placeholder="Anna (Product)" required>
            <label>Repos on their menu</label>
            ${repoChecks || `<p class="muted">No repos synced yet — <a href="${manageUrl}">grant the app access to repos on GitHub</a>, then refresh this page.</p>`}
            <p><button class="btn">Create invite link</button></p>
          </form>
        </div>
        <div class="card"><h3>Tasters</h3>
          <table><tr><th>Label</th><th>Status</th><th></th></tr>${tasterRows || "<tr><td colspan=3 class=muted>None yet</td></tr>"}</table>
        </div>
        <div class="card"><h3>Kitchen Log</h3>
          <table><tr><th>When (UTC)</th><th>Taster</th><th>Tool</th><th>Target</th></tr>${logRows || "<tr><td colspan=4 class=muted>No activity yet</td></tr>"}</table>
        </div>`;
    }),
  );

  return page(
    "Dashboard",
    `<h1>Souperuser dashboard</h1>${sections.join("")}
     <p class="muted"><a href="https://github.com/apps/${esc(env.GITHUB_APP_SLUG)}/installations/new">Install Souperuser on another account or org</a></p>`,
    { login: session.login },
  );
}

/** Manual reconcile against GitHub — covers missed webhooks right after install or repo changes. */
async function syncRepos(request: Request, env: Env): Promise<Response> {
  const session = await getCookSession(request, env);
  if (!session) return new Response("Not signed in", { status: 401 });

  const form = await request.formData();
  const installationId = Number(form.get("installation_id"));
  if (!(await ownsInstallation(env, session, installationId))) return new Response("Forbidden", { status: 403 });

  const repos = await listInstallationRepos(env, installationId);
  await replaceRepos(env, installationId, repos);
  return Response.redirect(new URL("/dash", request.url).toString(), 303);
}

async function createInvite(request: Request, env: Env): Promise<Response> {
  const session = await getCookSession(request, env);
  if (!session) return new Response("Not signed in", { status: 401 });

  const form = await request.formData();
  const installationId = Number(form.get("installation_id"));
  const label = String(form.get("label") ?? "").trim();
  const repos = form.getAll("repo").map(String);

  if (!(await ownsInstallation(env, session, installationId))) return new Response("Forbidden", { status: 403 });
  if (!label || repos.length === 0) return new Response("Label and at least one repo are required", { status: 400 });

  // The menu may only contain repos that actually belong to this installation.
  const installed = new Set((await listRepos(env, installationId)).map((r) => r.full_name));
  const menuRepos = repos.filter((r) => installed.has(r));
  if (menuRepos.length === 0) return new Response("No valid repos selected", { status: 400 });

  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  await createMenuWithInvite(env, {
    installationId,
    menuName: `Menu for ${label}`,
    repoFullNames: menuRepos,
    label,
    createdBy: session.login,
    inviteToken: token,
    expiresAt,
  });

  const link = `${publicUrl(env, request)}/invite/${token}`;
  return page(
    "Invite created",
    `<h1>Invite created</h1>
     <div class="card">
       <p>Send this link to <strong>${esc(label)}</strong>. It works once and expires in 7 days.</p>
       <pre>${esc(link)}</pre>
       <p class="muted">Menu: ${menuRepos.map(esc).join(", ")}</p>
     </div>
     <p><a href="/dash">Back to dashboard</a></p>`,
    { login: session.login },
  );
}

async function revoke(request: Request, env: Env): Promise<Response> {
  const session = await getCookSession(request, env);
  if (!session) return new Response("Not signed in", { status: 401 });
  const form = await request.formData();
  const installationId = Number(form.get("installation_id"));
  if (!(await ownsInstallation(env, session, installationId))) return new Response("Forbidden", { status: 403 });
  await revokeTaster(env, String(form.get("taster_id")), installationId);
  return Response.redirect(new URL("/dash", request.url).toString(), 303);
}

// ---------- Taster invite & connect ----------

async function acceptInvite(request: Request, env: Env, token: string): Promise<Response> {
  const invite = await getInvite(env, token);
  if (!invite) return page("Invalid invite", `<h1>Invalid invite</h1><p>This invite link does not exist.</p>`);
  if (invite.used_at) {
    return page("Invite used", `<h1>Already used</h1><p>This invite was already used. Ask your engineer for a new one.</p>`);
  }
  if (new Date(invite.expires_at) < new Date()) {
    return page("Invite expired", `<h1>Invite expired</h1><p>Ask your engineer for a fresh link.</p>`);
  }

  const tasterId = await consumeInvite(env, invite);
  const cookie = await signValue(tasterId, env.COOKIE_SECRET);
  return new Response(null, {
    status: 302,
    headers: { location: "/connect", "set-cookie": cookieHeader(TASTER_COOKIE, cookie, 90 * 24 * 3600) },
  });
}

async function connectPage(request: Request, env: Env): Promise<Response> {
  const tasterId = await getTasterId(request, env);
  if (!tasterId) {
    return page("Connect", `<h1>Almost there</h1><p>Open your invite link first (ask your engineer if you don't have one).</p>`);
  }
  const mcpUrl = `${publicUrl(env, request)}/mcp`;
  // One-click install links (both officially documented formats)
  const claudeLink = `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=Souperuser&connectorUrl=${encodeURIComponent(mcpUrl)}`;
  const cursorConfig = encodeURIComponent(btoa(JSON.stringify({ type: "http", url: mcpUrl })));
  const cursorLink = `cursor://anysphere.cursor-deeplink/mcp/install?name=souperuser&config=${cursorConfig}`;
  return page(
    "Connect your AI",
    `<h1>You're in</h1>
     <p>Connect your AI assistant to Souperuser. It gets <strong>read-only</strong> access to exactly the repos on your menu.</p>
     <div class="card">
       <h3>Claude</h3>
       <p><a class="btn" href="${esc(claudeLink)}">Add to Claude</a></p>
       <p class="muted">Opens claude.ai with the connector pre-filled — review and click Add.
       Or manually: Settings → Connectors → <em>Add custom connector</em> → paste the URL below.</p>
     </div>
     <div class="card">
       <h3>ChatGPT</h3>
       <p>Settings → Connectors → <em>Add custom connector / MCP server</em> → paste the URL below.</p>
     </div>
     <div class="card">
       <h3>Cursor</h3>
       <p><a class="btn" href="${esc(cursorLink)}">Add to Cursor</a></p>
       <p class="muted">Opens Cursor with the server pre-configured — review and install.</p>
     </div>
     <div class="card">
       <h3>Any other MCP client</h3>
       <p>Point it at this Streamable HTTP endpoint (OAuth handled automatically):</p>
       <pre>${esc(mcpUrl)}</pre>
     </div>
     <p>Your AI will send you back here once to approve access. After that, just ask it questions about the code.</p>`,
  );
}

// ---------- OAuth consent (Taster authorizes their AI client) ----------

async function authorizeScreen(request: Request, env: Env): Promise<Response> {
  let oauthRequest: AuthRequest;
  try {
    oauthRequest = await env.OAUTH_PROVIDER.parseAuthRequest(request);
  } catch (error) {
    if (!(error instanceof AuthorizationError)) throw error;
    if (!error.redirectUri) return new Response(error.description, { status: 400 });
    const redirect = new URL(error.redirectUri);
    redirect.searchParams.set("error", error.code);
    redirect.searchParams.set("error_description", error.description);
    if (error.state) redirect.searchParams.set("state", error.state);
    return Response.redirect(redirect.toString(), 302);
  }

  const tasterId = await getTasterId(request, env);
  if (!tasterId) {
    return page(
      "Who are you?",
      `<h1>One step missing</h1>
       <p>Your AI assistant wants to connect, but this browser has no Souperuser identity yet.</p>
       <p><strong>Open your invite link first</strong> (in this same browser), then retry the connection from your AI.</p>`,
    );
  }
  const access = await getTasterAccess(env, tasterId);
  if (!access) return page("Access revoked", `<h1>Access revoked</h1><p>Ask your engineer for a new invite.</p>`);

  const client = await env.OAUTH_PROVIDER.lookupClient(oauthRequest.clientId);
  const clientName = client?.clientName ?? oauthRequest.clientId;
  const payload = await signValue(JSON.stringify(oauthRequest), env.COOKIE_SECRET);

  return page(
    "Approve connection",
    `<h1>Approve this connection?</h1>
     <div class="card">
       <p><strong>${esc(clientName)}</strong> wants to read code on your behalf as <strong>${esc(access.taster.label)}</strong>.</p>
       <p>It will get <strong>read-only</strong> access to:</p>
       <ul>${access.repoFullNames.map((r) => `<li><code>${esc(r)}</code></li>`).join("")}</ul>
       <form method="post" action="/authorize/approve">
         <input type="hidden" name="payload" value="${esc(payload)}">
         <button class="btn">Approve</button>
       </form>
     </div>`,
  );
}

async function authorizeApprove(request: Request, env: Env): Promise<Response> {
  const tasterId = await getTasterId(request, env);
  if (!tasterId) return new Response("No taster session", { status: 401 });
  const access = await getTasterAccess(env, tasterId);
  if (!access) return new Response("Access revoked", { status: 403 });

  const form = await request.formData();
  const raw = await verifyValue(String(form.get("payload") ?? ""), env.COOKIE_SECRET);
  if (!raw) return new Response("Invalid or tampered payload", { status: 400 });
  const oauthRequest = JSON.parse(raw) as AuthRequest;

  const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
    request: oauthRequest,
    userId: tasterId,
    metadata: { label: access.taster.label },
    scope: ["mcp:read"],
    props: {
      tasterId,
      installationId: access.taster.installation_id,
      label: access.taster.label,
    },
  });

  return Response.redirect(redirectTo, 302);
}
