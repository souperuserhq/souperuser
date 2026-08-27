/** Signed-value helpers for cookies and form payloads (HMAC-SHA256, WebCrypto). */

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

function toBase64url(buf: ArrayBuffer): string {
  let binary = "";
  for (const b of new Uint8Array(buf)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function signValue(value: string, secret: string): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(value));
  return `${btoa(value).replace(/=+$/, "")}.${toBase64url(sig)}`;
}

export async function verifyValue(signed: string, secret: string): Promise<string | null> {
  const dot = signed.lastIndexOf(".");
  if (dot < 0) return null;
  const [encoded, sig] = [signed.slice(0, dot), signed.slice(dot + 1)];
  if (!encoded || !sig) return null;
  let value: string;
  try {
    value = atob(encoded);
  } catch {
    return null;
  }
  const expected = await signValue(value, secret);
  // Constant-time comparison
  const a = new TextEncoder().encode(expected);
  const b = new TextEncoder().encode(`${encoded}.${sig}`);
  if (a.length !== b.length) return null;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0 ? value : null;
}

export function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

export function cookieHeader(name: string, value: string, maxAgeSeconds: number): string {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export const TASTER_COOKIE = "su_taster";
export const COOK_COOKIE = "su_cook";
/** Short-lived CSRF nonce for the GitHub OAuth round-trip (SameSite=Lax rides the top-level redirect). */
export const STATE_COOKIE = "su_oauth_state";
