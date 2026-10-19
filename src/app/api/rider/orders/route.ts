import { endpoint } from "@/lib/admin/server";
import { ApiFailure } from "@/lib/admin/validation";
import { db } from "@/lib/db/server";
import { publicRider, requireRider } from "@/lib/riders/server";

export const GET = endpoint(async (request) => {
  const rider = await requireRider(request);
  const url = new URL(request.url);
  const limitValue = Number(url.searchParams.get("limit") ?? 50);
  const limit = Number.isInteger(limitValue) ? Math.min(100, Math.max(1, limitValue)) : 50;
  const { data, error } = await db().from("orders").select("*")
    .eq("fulfilment", "delivery")
    .or(`rider_id.eq.${rider.id},and(rider_id.is.null,status.in.(pending,cooking,ready))`)
    .in("payment_status", ["paid", "cod"])
    .not("status", "eq", "cancelled")
    .order("created_at", { ascending: false }).limit(limit);
  if (error) throw new ApiFailure(503, "Could not load deliveries.");
  const kitchenIds = [...new Set((data ?? []).map((row) => row.kitchen_id).filter(Boolean))];
  const [kitchensResult, locationResult] = await Promise.all([
    kitchenIds.length ? db().from("kitchens").select("id,name,latitude,longitude").in("id", kitchenIds) : Promise.resolve({ data: [], error: null }),
    db().from("rider_locations").select("rider_id,latitude,longitude,updated_at").eq("rider_id", rider.id).maybeSingle(),
  ]);
  if (kitchensResult.error || locationResult.error) throw new ApiFailure(503, "Could not load delivery map details.");
  const kitchens = new Map((kitchensResult.data ?? []).map((kitchen) => [kitchen.id, kitchen]));
  const ownLocation = locationResult.data;
  const riderIds = [...new Set((data ?? []).map((row) => row.rider_id).filter((id): id is string => typeof id === "string"))];
  const riderResult = riderIds.length
    ? await db().from("rider_profiles").select("id,name,phone,bike_model,bike_color,license_plate").in("id", riderIds)
    : { data: [], error: null };
  if (riderResult.error) throw new ApiFailure(503, "Could not load assigned riders.");
  const riders = new Map((riderResult.data ?? []).map((profile) => [profile.id, profile]));
  return {
    ok: true,
    rider: publicRider(rider),
    items: (data ?? []).map((row) => ({
      id: row.id,
      ref: row.order_ref,
      createdAt: row.created_at,
      status: row.status,
      paymentStatus: row.payment_status,
      riderDeliveryStatus: row.rider_delivery_status,
      riderId: row.rider_id,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      deliveryAddress: row.delivery_address ?? "",
      deliveryLatitude: row.delivery_latitude,
      deliveryLongitude: row.delivery_longitude,
      kitchen: kitchens.get(row.kitchen_id) ?? null,
      rider: row.rider_id ? riders.get(row.rider_id) ?? null : null,
      riderLocation: row.rider_id === rider.id ? ownLocation : null,
    })),
  };
});
