import { createClient, type RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { authClient } from "@/lib/admin/server";
import type { AuthPortal } from "@/lib/admin/session-scope";
import { menuDTO } from "@/lib/db/catalog";
import { orderDTO, supportDTO } from "@/lib/db/orders";
import { db } from "@/lib/db/server";
import type { StreamChange, StreamEventName } from "@/lib/live/apply";
import { liveChangeVisible, liveTables, type LivePortal, type LiveViewer } from "@/lib/live/changes";
import { findRider } from "@/lib/riders/server";

export const dynamic = "force-dynamic";

const portals: LivePortal[] = ["customer", "admin", "manager", "rider"];

function riderOrder(raw: Record<string, unknown>) {
  const lines = Array.isArray(raw.lines) ? raw.lines as { itemId?: string }[] : [];
  return {
    id: String(raw.id),
    ref: String(raw.order_ref ?? ""),
    status: String(raw.status ?? ""),
    paymentStatus: String(raw.payment_status ?? ""),
    riderDeliveryStatus: raw.rider_delivery_status ?? null,
    riderId: typeof raw.rider_id === "string" ? raw.rider_id : null,
    customerName: String(raw.customer_name ?? ""),
    deliveryAddress: String(raw.delivery_address ?? ""),
    deliveryLatitude: typeof raw.delivery_latitude === "number" ? raw.delivery_latitude : null,
    deliveryLongitude: typeof raw.delivery_longitude === "number" ? raw.delivery_longitude : null,
    firstItemId: typeof lines[0]?.itemId === "string" ? lines[0].itemId : "",
    updatedAt: String(raw.updated_at ?? ""),
  };
}

function streamRow(table: string, raw: Record<string, unknown>, portal: LivePortal) {
  if (table === "orders") return portal === "rider" ? riderOrder(raw) : { ...orderDTO(raw), ref: String(raw.order_ref ?? "") };
  if (table === "menu_items") return menuDTO(raw);
  if (table === "support_requests") return supportDTO(raw);
  if (table === "rider_support_requests") {
    return {
      id: String(raw.id ?? ""),
      subject: String(raw.subject ?? ""),
      message: String(raw.message ?? ""),
      status: String(raw.status ?? ""),
      created_at: String(raw.created_at ?? ""),
    };
  }
  if (table === "rider_locations") {
    return {
      id: String(raw.rider_id ?? ""),
      latitude: Number(raw.latitude),
      longitude: Number(raw.longitude),
      updatedAt: String(raw.updated_at ?? ""),
    };
  }
  if (table === "customer_profiles") {
    return { id: String(raw.id ?? ""), name: raw.name, email: raw.email, phone: raw.phone, created_at: raw.created_at, is_blocked: raw.is_blocked };
  }
  if (table === "admin_profiles") {
    return { id: String(raw.id ?? ""), email: raw.email, created_at: raw.created_at, is_blocked: raw.is_blocked, kitchen_id: raw.kitchen_id };
  }
  if (table === "rider_profiles") {
    return {
      id: String(raw.id ?? ""), email: raw.email, name: raw.name, phone: raw.phone,
      bikeModel: raw.bike_model, bikeColor: raw.bike_color, licensePlate: raw.license_plate,
      isBlocked: raw.is_blocked, createdAt: raw.created_at, updatedAt: raw.updated_at,
    };
  }
  if (table === "kitchens") {
    return {
      id: String(raw.id ?? ""), name: raw.name, address: raw.address,
      latitude: Number(raw.latitude), longitude: Number(raw.longitude), is_active: raw.is_active,
    };
  }
  return { id: String(raw.id ?? "") };
}

async function riderLocationVisible(viewer: LiveViewer, riderId: string) {
  if (!riderId) return false;
  if (viewer.portal === "customer") {
    const { data, error } = await db().from("orders").select("id")
      .eq("customer_id", viewer.id).eq("rider_id", riderId)
      .in("rider_delivery_status", ["assigned", "picked_up"]).limit(1);
    return !error && Boolean(data?.length);
  }
  if (viewer.portal === "admin" && viewer.kitchenId) {
    const { data, error } = await db().from("orders").select("id")
      .eq("kitchen_id", viewer.kitchenId).eq("rider_id", riderId)
      .in("rider_delivery_status", ["assigned", "picked_up"]).limit(1);
    return !error && Boolean(data?.length);
  }
  return false;
}

function streamId(table: string, raw: Record<string, unknown>) {
  if (table === "rider_locations") return String(raw.rider_id ?? "");
  return String(raw.id ?? "");
}

async function viewerFor(portal: AuthPortal): Promise<LiveViewer | null> {
  const auth = await authClient(portal);
  const { data, error } = await auth.auth.getUser();
  if (error || !data.user) return null;
  if (portal === "customer") {
    const profile = await db().from("customer_profiles").select("id").eq("id", data.user.id).maybeSingle();
    return profile.data ? { portal, id: data.user.id, email: data.user.email ?? undefined } : null;
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
      const onChange = (table: string) => async (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        const record = (value: unknown) => (
          value && typeof value === "object" && Object.keys(value).length > 0 ? value as Record<string, unknown> : null
        );
        const next = record(payload.new);
        const previous = record(payload.old);
        const raw = next ?? previous;
        if (!raw) return;
        const visible = table === "rider_locations" && (viewer.portal === "admin" || viewer.portal === "customer")
          ? await riderLocationVisible(viewer, String(raw.rider_id ?? ""))
          : liveChangeVisible(viewer, table, raw);
        if (!visible) return;
        const event = payload.eventType as StreamEventName;
        const row = event === "DELETE" ? null : streamRow(table, next ?? raw, viewer.portal);
        const change: StreamChange = {
          table,
          event,
          id: streamId(table, raw),
          row,
          previousPaymentStatus: typeof previous?.payment_status === "string" ? previous.payment_status : null,
        };
        send(`data: ${JSON.stringify(change)}\n\n`);
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
