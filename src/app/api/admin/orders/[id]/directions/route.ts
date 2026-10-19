import {
  assertKitchenOrderAccess,
  checked,
  endpoint,
  rateLimit,
  requireAdmin,
} from "@/lib/admin/server";
import { ApiFailure } from "@/lib/admin/validation";
import { db } from "@/lib/db/server";
import { computeDrivingRoute } from "@/lib/maps/google-routes";

type Context = { params: Promise<{ id: string }> };
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validCoordinates(latitude: unknown, longitude: unknown) {
  return (
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    typeof longitude === "number" &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export async function GET(request: Request, context: Context) {
  return endpoint(async () => {
    const admin = await requireAdmin();
    const { id } = await context.params;
    if (!uuidPattern.test(id)) throw new ApiFailure(404, "Order not found.");
    await rateLimit(request, "admin-order-directions", 30, 60, admin.id);

    const { data, error } = await db()
      .from("orders")
      .select("kitchen_id,fulfilment,delivery_latitude,delivery_longitude")
      .eq("id", id)
      .maybeSingle();
    if (!data && !error) throw new ApiFailure(404, "Order not found.");
    const order = checked(data, error);
    assertKitchenOrderAccess(order, admin);
    if (
      order.fulfilment !== "delivery" ||
      !validCoordinates(order.delivery_latitude, order.delivery_longitude) ||
      !order.kitchen_id
    ) {
      throw new ApiFailure(409, "This order is missing route coordinates.");
    }

    const kitchenResult = await db()
      .from("kitchens")
      .select("latitude,longitude")
      .eq("id", order.kitchen_id)
      .maybeSingle();
    const kitchen = checked(kitchenResult.data, kitchenResult.error);
    if (
      !validCoordinates(kitchen.latitude, kitchen.longitude)
    ) {
      throw new ApiFailure(409, "This kitchen is missing GPS coordinates.");
    }
    const apiKey = process.env.GOOGLE_ROUTES_API_KEY;
    if (!apiKey) throw new ApiFailure(503, "Google Routes is not configured.");

    const route = await computeDrivingRoute(apiKey, kitchen, {
      latitude: order.delivery_latitude,
      longitude: order.delivery_longitude,
    });
    return {
      ok: true,
      route,
    };
  })(request);
}
