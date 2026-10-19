import { endpoint, requireManager } from "@/lib/admin/server";
import { ApiFailure } from "@/lib/admin/validation";
import { db } from "@/lib/db/server";
import { getRiderOr404 } from "@/lib/riders/server";

type Context = { params: Promise<{ id: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const GET = endpoint(async (_request: Request, context: Context) => {
  await requireManager();
  const { id } = await context.params;
  if (!uuidPattern.test(id)) throw new ApiFailure(404, "Rider not found.");
  const rider = await getRiderOr404(id);
  const [locationResult, orderResult] = await Promise.all([
    db().from("rider_locations").select("rider_id,latitude,longitude,updated_at").eq("rider_id", id).maybeSingle(),
    db().from("orders").select("id,order_ref,status,rider_delivery_status,delivery_address,delivery_latitude,delivery_longitude,kitchen_id")
      .eq("rider_id", id).in("rider_delivery_status", ["assigned", "picked_up"]).maybeSingle(),
  ]);
  if (locationResult.error || orderResult.error) throw new ApiFailure(503, "Could not load rider tracking data.");
  let kitchen = null;
  if (orderResult.data?.kitchen_id) {
    const result = await db().from("kitchens").select("name,latitude,longitude").eq("id", orderResult.data.kitchen_id).maybeSingle();
    if (result.error) throw new ApiFailure(503, "Could not load delivery kitchen.");
    kitchen = result.data;
  }
  return { ok: true, rider: { id: rider.id, name: rider.name }, location: locationResult.data, activeOrder: orderResult.data ? {
    id: orderResult.data.id,
    ref: orderResult.data.order_ref,
    status: orderResult.data.status,
    deliveryStatus: orderResult.data.rider_delivery_status,
    destination: {
      address: orderResult.data.delivery_address,
      latitude: orderResult.data.delivery_latitude,
      longitude: orderResult.data.delivery_longitude,
    },
    kitchen,
  } : null };
});
