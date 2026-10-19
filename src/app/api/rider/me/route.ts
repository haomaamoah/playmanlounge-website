import { audit, checkOrigin, endpoint, jsonBody } from "@/lib/admin/server";
import { ApiFailure, object, text } from "@/lib/admin/validation";
import { db } from "@/lib/db/server";
import { publicRider, requireRider } from "@/lib/riders/server";

export const GET = endpoint(async (request) => ({
  ok: true,
  rider: publicRider(await requireRider(request)),
}));

export const PATCH = endpoint(async (request) => {
  if (!request.headers.has("authorization")) checkOrigin(request);
  const rider = await requireRider(request);
  const body = object(await jsonBody(request), ["phone", "bikeModel", "bikeColor", "licensePlate"]);
  if (!Object.keys(body).length) throw new ApiFailure(400, "Choose a detail to update.");
  const updates: Record<string, string> = {};
  if ("phone" in body) updates.phone = text(body.phone, 5, 30);
  if ("bikeModel" in body) updates.bike_model = text(body.bikeModel, 0, 100);
  if ("bikeColor" in body) updates.bike_color = text(body.bikeColor, 0, 60);
  if ("licensePlate" in body) updates.license_plate = text(body.licensePlate, 0, 30);
  await audit(rider.id, "rider_self_update", rider.id);
  const { data, error } = await db().from("rider_profiles").update(updates).eq("id", rider.id)
    .select("id,email,name,phone,bike_model,bike_color,license_plate,is_blocked,created_at,updated_at").single();
  if (error || !data) {
    if (error?.code === "23505") throw new ApiFailure(409, "That phone number is already in use.");
    throw new ApiFailure(503, "Could not save your settings.");
  }
  return { ok: true, rider: publicRider(data) };
});
