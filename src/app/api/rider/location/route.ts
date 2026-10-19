import { checkOrigin, endpoint, jsonBody, rateLimit, requireManager } from "@/lib/admin/server";
import { ApiFailure, object } from "@/lib/admin/validation";
import { db } from "@/lib/db/server";
import { requireRider } from "@/lib/riders/server";

export const GET = endpoint(async (request) => {
  await requireManager();
  const riderId = new URL(request.url).searchParams.get("riderId");
  if (!riderId) throw new ApiFailure(400, "Choose a rider.");
  const { data, error } = await db().from("rider_locations").select("rider_id,latitude,longitude,updated_at").eq("rider_id", riderId).maybeSingle();
  if (error) throw new ApiFailure(503, "Could not load rider location.");
  return { ok: true, item: data };
});

export const POST = endpoint(async (request) => {
  if (!request.headers.has("authorization")) checkOrigin(request);
  const rider = await requireRider(request);
  await rateLimit(request, "rider-location", 180, 60, rider.id);
  const body = object(await jsonBody(request), ["latitude", "longitude"]);
  const latitude = body.latitude;
  const longitude = body.longitude;
  if (typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new ApiFailure(400, "Send valid GPS coordinates.");
  }
  const { data, error } = await db().from("rider_locations").upsert({
    rider_id: rider.id, latitude, longitude, updated_at: new Date().toISOString(),
  }).select("rider_id,latitude,longitude,updated_at").single();
  if (error || !data) throw new ApiFailure(503, "Could not update rider location.");
  return { ok: true, item: data };
});
