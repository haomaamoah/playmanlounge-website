import { assertKitchenOrderAccess, endpoint, rateLimit, requireAdmin } from "@/lib/admin/server";
import { ApiFailure } from "@/lib/admin/validation";
import { db } from "@/lib/db/server";
import { computeDrivingRoute } from "@/lib/maps/google-routes";

type Context = { params: Promise<{ id: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const GET = endpoint(async (request: Request, context: Context) => {
  const admin = await requireAdmin();
  const { id } = await context.params;
  if (!uuidPattern.test(id)) throw new ApiFailure(404, "Rider not found.");
  await rateLimit(request, "admin-rider-directions", 30, 60, admin.id);
  const [profile, location, activeOrder] = await Promise.all([
    db().from("rider_profiles").select("id").eq("id", id).maybeSingle(),
    db().from("rider_locations").select("latitude,longitude").eq("rider_id", id).maybeSingle(),
    db().from("orders").select("kitchen_id,delivery_latitude,delivery_longitude")
      .eq("rider_id", id).in("rider_delivery_status", ["assigned", "picked_up"]).maybeSingle(),
  ]);
  if (profile.error || location.error || activeOrder.error) throw new ApiFailure(503, "Could not load route coordinates.");
  if (!profile.data) throw new ApiFailure(404, "Rider not found.");
  if (!location.data || !activeOrder.data) throw new ApiFailure(409, "This rider has no active delivery location to route.");
  assertKitchenOrderAccess(activeOrder.data, admin);
  const latitude = activeOrder.data.delivery_latitude;
  const longitude = activeOrder.data.delivery_longitude;
  if (typeof latitude !== "number" || typeof longitude !== "number") throw new ApiFailure(409, "Delivery GPS coordinates are missing.");
  const apiKey = process.env.GOOGLE_ROUTES_API_KEY;
  if (!apiKey) throw new ApiFailure(503, "Google Routes is not configured.");
  const route = await computeDrivingRoute(apiKey, {
    latitude: Number(location.data.latitude), longitude: Number(location.data.longitude),
  }, { latitude, longitude });
  return { ok: true, route };
});
