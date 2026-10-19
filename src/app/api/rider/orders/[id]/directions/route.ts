import { endpoint } from "@/lib/admin/server";
import { ApiFailure } from "@/lib/admin/validation";
import { computeDrivingRoute } from "@/lib/maps/google-routes";
import { getRiderOrder } from "@/lib/riders/orders";
import { requireRider } from "@/lib/riders/server";

type Context = { params: Promise<{ id: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const GET = endpoint(async (request: Request, context: Context) => {
  const rider = await requireRider(request);
  const { id } = await context.params;
  if (!uuidPattern.test(id)) throw new ApiFailure(404, "Delivery not found.");

  const order = await getRiderOrder(id, rider);
  const deliveryLatitude = order.deliveryLatitude;
  const deliveryLongitude = order.deliveryLongitude;
  const kitchen = order.kitchen;
  if (
    typeof deliveryLatitude !== "number" ||
    typeof deliveryLongitude !== "number" ||
    !kitchen
  ) {
    throw new ApiFailure(409, "Kitchen or delivery GPS coordinates are missing.");
  }
  const destination = { latitude: deliveryLatitude, longitude: deliveryLongitude };
  const apiKey = process.env.GOOGLE_ROUTES_API_KEY;
  if (!apiKey) throw new ApiFailure(503, "Google Routes is not configured.");

  const pickedUp = order.riderDeliveryStatus === "picked_up";
  const location = order.riderLocation;
  const [kitchenRoute, customerRoute] = await Promise.all([
    !pickedUp && location
      ? computeDrivingRoute(apiKey, location, {
          latitude: kitchen.latitude,
          longitude: kitchen.longitude,
        })
      : Promise.resolve(null),
    computeDrivingRoute(
      apiKey,
      pickedUp && location
        ? location
        : { latitude: kitchen.latitude, longitude: kitchen.longitude },
      destination,
    ),
  ]);
  return {
    ok: true,
    item: { pickedUp, location, kitchenRoute, customerRoute },
  };
});
