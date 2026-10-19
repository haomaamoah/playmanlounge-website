import "server-only";
import { ApiFailure } from "../admin/validation";
import { db } from "../db/server";
import type { RiderProfile } from "./server";

type Row = Record<string, unknown>;

export function riderOrderDTO(row: Row, kitchen: Row | null, rider: Row | null, location: Row | null) {
  return {
    id: String(row.id),
    ref: String(row.order_ref),
    createdAt: String(row.created_at),
    status: String(row.status),
    paymentStatus: String(row.payment_status),
    riderDeliveryStatus: typeof row.rider_delivery_status === "string" ? row.rider_delivery_status : null,
    riderId: typeof row.rider_id === "string" ? row.rider_id : null,
    fulfilment: String(row.fulfilment),
    customerName: String(row.customer_name),
    customerPhone: String(row.customer_phone),
    deliveryAddress: String(row.delivery_address ?? ""),
    deliveryLatitude: typeof row.delivery_latitude === "number" ? row.delivery_latitude : null,
    deliveryLongitude: typeof row.delivery_longitude === "number" ? row.delivery_longitude : null,
    kitchen: kitchen ? {
      name: String(kitchen.name),
      latitude: Number(kitchen.latitude),
      longitude: Number(kitchen.longitude),
    } : null,
    rider: rider ? {
      id: String(rider.id),
      name: String(rider.name),
      phone: String(rider.phone),
      bikeModel: String(rider.bike_model ?? ""),
      bikeColor: String(rider.bike_color ?? ""),
      licensePlate: String(rider.license_plate ?? ""),
    } : null,
    riderLocation: location ? {
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
      updatedAt: String(location.updated_at),
    } : null,
  };
}

export async function getRiderOrder(id: string, rider: RiderProfile) {
  const { data, error } = await db().from("orders").select("*").eq("id", id).maybeSingle();
  if (error) throw new ApiFailure(503, "Could not load this delivery.");
  if (!data || data.fulfilment !== "delivery") throw new ApiFailure(404, "Delivery not found.");
  if (data.rider_id && data.rider_id !== rider.id) throw new ApiFailure(409, "Someone else has taken this order.");
  if (!data.rider_id && (data.status === "cancelled" || !["paid", "cod"].includes(data.payment_status))) {
    throw new ApiFailure(409, "This order is not available for delivery.");
  }
  const [kitchenResult, profileResult, locationResult] = await Promise.all([
    data.kitchen_id
      ? db().from("kitchens").select("name,latitude,longitude").eq("id", data.kitchen_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    data.rider_id
      ? db().from("rider_profiles").select("id,name,phone,bike_model,bike_color,license_plate").eq("id", data.rider_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    db().from("rider_locations").select("latitude,longitude,updated_at").eq("rider_id", rider.id).maybeSingle(),
  ]);
  if (kitchenResult.error || profileResult.error || locationResult.error) throw new ApiFailure(503, "Could not load delivery map details.");
  const kitchen = kitchenResult.data;
  if (!kitchen || typeof kitchen.latitude !== "number" || typeof kitchen.longitude !== "number") {
    throw new ApiFailure(409, "The kitchen is missing map coordinates.");
  }
  return riderOrderDTO(data, kitchen, profileResult.data, locationResult.data);
}

export function canClaimOrder(row: Row) {
  return row.fulfilment === "delivery" &&
    ["pending", "cooking", "ready"].includes(String(row.status)) &&
    ["paid", "cod"].includes(String(row.payment_status)) &&
    !row.rider_id;
}
