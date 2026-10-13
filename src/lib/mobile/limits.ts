import "server-only";
import { createHash } from "node:crypto";
import { ApiFailure } from "../admin/validation";
import { rateLimit } from "../admin/server";
import { db } from "../db/server";
import { MobileFailure } from "./errors";
import { ipBucketCeiling } from "./constants";

function wait(seconds: number) {
  if (seconds >= 3600) return "an hour";
  if (seconds < 90) return "a minute";
  return `${Math.round(seconds / 60)} minutes`;
}

/**
 * How long until the blocked bucket resets, from the same `rate_limits` row the shared helper writes (its key is the
 * SHA-256 of scope and identity, see rateLimit() in src/lib/admin/server.ts). Falls back to the whole window.
 */
async function secondsUntilReset(request: Request, scope: string, identity: string, window: number) {
  try {
    const ip = process.env.TRUST_PROXY_IP === "1" ? request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown" : "shared";
    const key = createHash("sha256").update(`${scope}:${identity || ip}`).digest("hex");
    const { data } = await db().from("rate_limits").select("reset_at").eq("key", key).maybeSingle();
    const seconds = data ? Math.ceil((Date.parse(String(data.reset_at)) - Date.now()) / 1000) : window;
    return Math.min(window, Math.max(1, seconds));
  } catch {
    return window;
  }
}

/**
 * The shared `rateLimit()` (atomic, database-backed, spans every instance), answering with the mobile contract's
 * `429 rate_limited` + `Retry-After`. Omit `identity` for an IP bucket; pass an e-mail or customer id for
 * per-account limits (the shared helper only stores a SHA-256 of scope + identity).
 */
export async function limit(request: Request, scope: string, [max, seconds]: readonly [number, number], identity = "") {
  const ceiling = identity ? max : ipBucketCeiling(max, process.env.TRUST_PROXY_IP === "1");
  try {
    await rateLimit(request, scope, ceiling, seconds, identity);
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 429) {
      const retryAfter = await secondsUntilReset(request, scope, identity, seconds);
      throw new MobileFailure(429, `Too many attempts. Try again in ${wait(retryAfter)}.`, { code: "rate_limited", retryAfter });
    }
    throw error;
  }
}
