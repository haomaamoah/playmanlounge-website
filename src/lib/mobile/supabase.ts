import "server-only";
import { createClient } from "@supabase/supabase-js";
import { MobileFailure, unavailable } from "./errors";

export { db } from "../db/server";

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } } as const;

type Cause = { code?: string; status?: number; message?: string } | null | undefined;

/**
 * Every swallowed backend problem still leaves one diagnostic line in the server log: where it happened plus the
 * Postgres / GoTrue code and message (never request bodies, tokens, passwords or row data), so a missing migration or a
 * wrong key shows up in the logs. The customer only ever gets the generic 503.
 */
export function failed(context: string, cause?: Cause) {
  const detail = cause ? `${cause.code ?? cause.status ?? "error"} ${String(cause.message ?? "").slice(0, 200)}` : "no data returned";
  console.error(`[mobile-api] ${context}: ${detail}`);
  return unavailable();
}

function publicEnv() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw failed("SUPABASE_URL or the publishable/anon key is not configured");
  return { url, key };
}

/**
 * Anon/publishable-key client for sign-in, refresh and token checks. A fresh instance per use: with
 * persistSession off it still remembers the session it just created, so sharing one across requests would mix
 * customers up.
 */
export function publicClient() {
  const { url, key } = publicEnv();
  return createClient(url, key, clientOptions);
}

/**
 * A client that acts AS the customer: the anon key plus the caller's own JWT, so Postgres evaluates Row Level
 * Security with `auth.uid()` set to them. Read routes use it so a forgotten filter can still never return another
 * customer's rows. Writes use the service role (`db()`) with a server-derived customer id instead.
 */
export function userClient(jwt: string) {
  const { url, key } = publicEnv();
  return createClient(url, key, { ...clientOptions, global: { headers: { Authorization: `Bearer ${jwt}` } } });
}

type AuthLikeError = { status?: number; code?: string; message?: string };

/**
 * GoTrue answers a bad token, a wrong password or a revoked session with a 4xx. Anything else (network, 5xx, no
 * status) means the auth service is down, which must never be reported to the customer as "wrong password".
 */
export function authErrorKind(error: AuthLikeError): "rejected" | "rate_limited" | "down" {
  const status = error.status;
  if (status === 429) return "rate_limited";
  if (typeof status === "number" && status >= 400 && status < 500) return "rejected";
  return "down";
}

export function throwIfAuthDown(error: AuthLikeError) {
  const kind = authErrorKind(error);
  if (kind === "rate_limited") {
    throw new MobileFailure(429, "Too many requests. Try again in a minute.", { code: "rate_limited", retryAfter: 60 });
  }
  if (kind === "down") throw failed("Supabase Auth is unreachable", error);
}
