import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { dispatchNotifications } from "@/lib/notifications/dispatch";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const supplied = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Notification cron is not configured." }, { status: 503, headers });
  }
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401, headers });
  }
  try {
    const result = await dispatchNotifications(50);
    return NextResponse.json({ ok: true, ...result }, { headers });
  } catch (error) {
    console.error(`[notifications] scheduled dispatch failed: ${error instanceof Error ? error.message : "unknown error"}`);
    return NextResponse.json({ ok: false, error: "Notification dispatch failed." }, { status: 503, headers });
  }
}
