import { createClient, type RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { authClient } from "@/lib/admin/server";
import type { AuthPortal } from "@/lib/admin/session-scope";
import { db } from "@/lib/db/server";
import { liveChangeVisible, liveTables, type LivePortal, type LiveViewer } from "@/lib/live/changes";
import { findRider } from "@/lib/riders/server";

export const dynamic = "force-dynamic";

const portals: LivePortal[] = ["customer", "admin", "manager", "rider"];

async function viewerFor(portal: AuthPortal): Promise<LiveViewer | null> {
  const auth = await authClient(portal);
  const { data, error } = await auth.auth.getUser();
  if (error || !data.user) return null;
  if (portal === "customer") {
    const profile = await db().from("customer_profiles").select("id").eq("id", data.user.id).maybeSingle();
    return profile.data ? { portal, id: data.user.id } : null;
  }
  if (portal === "rider") {
    const rider = await findRider(data.user.id);
    return rider && !rider.is_blocked ? { portal, id: rider.id } : null;
  }
  const profile = await db().from("admin_profiles").select("id,role,is_blocked,kitchen_id").eq("id", data.user.id).maybeSingle();
  const row = profile.data;
  if (!row || row.is_blocked) return null;
  if (portal === "manager") return row.role === "manager" ? { portal, id: row.id } : null;
  if (row.role !== "admin" && row.role !== "manager") return null;
  return { portal: "admin", id: row.id, kitchenId: row.kitchen_id ? String(row.kitchen_id) : null };
}

export async function GET(request: Request) {
  const portal = new URL(request.url).searchParams.get("portal");
  if (!portals.includes(portal as LivePortal)) return new Response("Unknown portal.", { status: 400 });
  const viewer = await viewerFor(portal as AuthPortal);
  if (!viewer) return new Response("Sign in to continue.", { status: 401 });

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return new Response("Live updates are not configured.", { status: 503 });

  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(chunk)); } catch { closed = true; }
      };
      const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const channel = client.channel(`pml-${viewer.portal}-${viewer.id}-${crypto.randomUUID()}`);
      const onChange = (table: string) => (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        const next = payload.new && Object.keys(payload.new).length > 0 ? payload.new : null;
        const previous = payload.old && Object.keys(payload.old).length > 0 ? payload.old : null;
        if (liveChangeVisible(viewer, table, next ?? previous)) send(`data: ${JSON.stringify({ table })}\n\n`);
      };
      for (const table of liveTables[viewer.portal]) {
        channel.on("postgres_changes", { event: "*", schema: "public", table }, onChange(table));
      }
      void channel.subscribe();
      send(": connected\n\n");
      const heartbeat = setInterval(() => send(": ping\n\n"), 25000);
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        void client.removeChannel(channel);
        try { controller.close(); } catch { /* already closed */ }
      };
      request.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
