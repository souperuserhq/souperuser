/**
 * Fixed-window rate limiting on KV — approximate by design (KV is eventually
 * consistent, so brief overshoot under concurrency is possible), which is fine
 * for abuse throttling and works on any Cloudflare account with zero setup.
 */
import type { Env } from "./env.js";

export async function rateLimit(
  env: Env,
  bucket: string,
  id: string,
  limit: number,
  windowSec = 60,
): Promise<boolean> {
  const window = Math.floor(Date.now() / 1000 / windowSec);
  const key = `rl:${bucket}:${id}:${window}`;
  const count = Number((await env.CACHE.get(key)) ?? 0);
  if (count >= limit) return false;
  await env.CACHE.put(key, String(count + 1), { expirationTtl: Math.max(120, windowSec * 2) });
  return true;
}

export function rateLimited(retryAfterSec: number): Response {
  return new Response("Rate limit exceeded. Try again shortly.", {
    status: 429,
    headers: { "retry-after": String(retryAfterSec), "cache-control": "no-store" },
  });
}
