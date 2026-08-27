/** GitHub App webhook receiver: keeps installations and repos in sync in D1. */
import { addRepos, deleteInstallation, removeRepos, upsertInstallation } from "./db.js";
import type { Env } from "./env.js";

async function verifySignature(env: Env, body: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.GITHUB_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expected = "sha256=" + [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const a = new TextEncoder().encode(expected);
  const b = new TextEncoder().encode(signatureHeader);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

interface WebhookRepo {
  id: number;
  full_name: string;
  private: boolean;
}

interface InstallationEvent {
  action: string;
  installation: {
    id: number;
    account: { login: string; type: string };
  };
  /** The user who triggered the event — on "created" this is the installer. */
  sender?: { login: string };
  repositories?: WebhookRepo[];
  repositories_added?: WebhookRepo[];
  repositories_removed?: { id: number }[];
}

export async function handleWebhook(request: Request, env: Env): Promise<Response> {
  const body = await request.text();
  if (!(await verifySignature(env, body, request.headers.get("x-hub-signature-256")))) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = request.headers.get("x-github-event");
  const payload = JSON.parse(body) as InstallationEvent;

  if (event === "installation") {
    const inst = payload.installation;
    if (payload.action === "created") {
      await upsertInstallation(env, inst.id, inst.account.login, inst.account.type, payload.sender?.login ?? null);
      if (payload.repositories?.length) await addRepos(env, inst.id, payload.repositories);
    } else if (payload.action === "deleted") {
      await deleteInstallation(env, inst.id);
    }
  } else if (event === "installation_repositories") {
    const inst = payload.installation;
    await upsertInstallation(env, inst.id, inst.account.login, inst.account.type);
    if (payload.repositories_added?.length) await addRepos(env, inst.id, payload.repositories_added);
    if (payload.repositories_removed?.length) {
      await removeRepos(env, inst.id, payload.repositories_removed.map((r) => r.id));
    }
  }

  return new Response("ok");
}
