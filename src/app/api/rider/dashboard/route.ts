import { endpoint } from "@/lib/admin/server";
import { ApiFailure } from "@/lib/admin/validation";
import { db } from "@/lib/db/server";
import { requireRider } from "@/lib/riders/server";

export const GET = endpoint(async (request) => {
  const rider = await requireRider(request);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [active, completedToday, allTime, openSupport] = await Promise.all([
    db().from("orders").select("id", { count: "exact", head: true })
      .eq("rider_id", rider.id).in("rider_delivery_status", ["assigned", "picked_up"]),
    db().from("orders").select("id", { count: "exact", head: true })
      .eq("rider_id", rider.id).eq("rider_delivery_status", "delivered").gte("updated_at", today.toISOString()),
    db().from("orders").select("id", { count: "exact", head: true })
      .eq("rider_id", rider.id).eq("rider_delivery_status", "delivered"),
    db().from("rider_support_requests").select("id", { count: "exact", head: true })
      .eq("rider_id", rider.id).eq("status", "open"),
  ]);
  if ([active, completedToday, allTime, openSupport].some((result) => result.error)) {
    throw new ApiFailure(503, "Could not load rider dashboard statistics.");
  }
  return { ok: true, stats: {
    activeDeliveries: active.count ?? 0,
    completedToday: completedToday.count ?? 0,
    completedDeliveries: allTime.count ?? 0,
    openSupportRequests: openSupport.count ?? 0,
  } };
});
