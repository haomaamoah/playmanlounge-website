import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { db } from "../db/server";
import { ApiFailure } from "./validation";
import type { AdminProfile } from "./contracts";

export async function authClient() {
  const jar = await cookies();
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new ApiFailure(503,"Authentication is not configured.");
  return createServerClient(url,key,{
    cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" },
    cookies: { getAll: () => jar.getAll(), setAll: values => {
      for (const { name,value,options } of values) jar.set(name,value,{...options,httpOnly:true,secure:process.env.NODE_ENV === "production",sameSite:"lax",path:"/"});
    } },
  });
}
export async function requireAdmin(): Promise<AdminProfile> {
  const auth = await authClient();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) throw new ApiFailure(401,"Sign in to continue.");
  const { data, error: profileError } = await db().from("admin_profiles").select("id,email,role").eq("id",user.id).single();
  if (profileError || !data || data.role !== "admin") throw new ApiFailure(403,"Administrator access required.");
  return data as AdminProfile;
}
export function checkOrigin(request: Request) {
  const url = new URL(request.url);
  // Next can normalize request.url to localhost even when the browser uses
  // 127.0.0.1. Only a validated loopback Host is used for HTTP development.
  let localOrigin = url.origin;
  try {
    const hostUrl = new URL(`${url.protocol}//${request.headers.get("host")}`);
    if (["localhost","127.0.0.1","[::1]"].includes(hostUrl.hostname)) localOrigin = hostUrl.origin;
  } catch { /* Invalid Host never becomes an allowed origin. */ }
  const localDev = process.env.NODE_ENV !== "production" && ["localhost","127.0.0.1","[::1]"].includes(url.hostname);
  if (process.env.NODE_ENV === "production" && !process.env.SITE_URL) throw new ApiFailure(503,"The application origin is not configured.");
  const expected = localDev ? localOrigin : process.env.SITE_URL ? new URL(process.env.SITE_URL).origin : url.origin;
  if (request.headers.get("origin") !== expected || request.headers.get("sec-fetch-site") === "cross-site") throw new ApiFailure(403,"Cross-site request rejected.");
}
export async function rateLimit(request: Request, scope: string, max: number, seconds: number, identity = "") {
  // TRUST_PROXY_IP must only be enabled when the ingress overwrites this header.
  const ip = process.env.TRUST_PROXY_IP === "1" ? (request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown") : "shared";
  const key = createHash("sha256").update(`${scope}:${identity || ip}`).digest("hex");
  const { data,error } = await db().rpc("consume_rate_limit",{p_key:key,p_max:max,p_seconds:seconds});
  if (error) throw new ApiFailure(503,"Abuse protection is unavailable.");
  if (!data) throw new ApiFailure(429,"Too many requests. Try again later.");
}
export async function audit(actor: string | null, action: string, resource?: string) {
  const { error } = await db().from("audit_events").insert({actor_id:actor,action,resource_id:resource});
  if (error) throw new ApiFailure(503,"Could not record the operation.");
}
export async function jsonBody(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 32768) throw new ApiFailure(413,"Request is too large.");
  const raw = (await limitedBody(request,32768)).toString("utf8");
  try { return JSON.parse(raw) as unknown; } catch { throw new ApiFailure(400,"Send valid JSON."); }
}
export async function limitedBody(request: Request, max: number) {
  if (Number(request.headers.get("content-length") ?? 0) > max) throw new ApiFailure(413,"Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const {done,value} = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) { await reader.cancel(); throw new ApiFailure(413,"Request is too large."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
export function endpoint(handler: (request: Request) => Promise<unknown>) {
  return async (request: Request) => {
    try { return NextResponse.json(await handler(request),{headers:{"Cache-Control":"no-store"}}); }
    catch (error) {
      return NextResponse.json({ok:false,error:error instanceof ApiFailure ? error.message : "Service unavailable. Try again later."},
        {status:error instanceof ApiFailure ? error.status : 503,headers:{"Cache-Control":"no-store"}});
    }
  };
}
export function checked<T>(data: T, error: unknown): NonNullable<T> {
  if (error || data == null) throw new ApiFailure(503,"Database operation failed.");
  return data as NonNullable<T>;
}
