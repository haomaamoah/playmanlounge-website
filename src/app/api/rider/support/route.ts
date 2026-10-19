import { audit, checkOrigin, endpoint, jsonBody } from "@/lib/admin/server";
import { ApiFailure, object, text } from "@/lib/admin/validation";
import { db } from "@/lib/db/server";
import { requireRider } from "@/lib/riders/server";

export const GET = endpoint(async (request) => {
  const rider = await requireRider(request);
  const { data, error } = await db().from("rider_support_requests")
    .select("id,subject,message,status,created_at,updated_at")
    .eq("rider_id", rider.id).order("created_at", { ascending: false }).limit(50);
  if (error) throw new ApiFailure(503, "Could not load your support requests.");
  return { ok: true, items: data ?? [] };
});

export const POST = endpoint(async (request) => {
  if (!request.headers.has("authorization")) checkOrigin(request);
  const rider = await requireRider(request);
  const body = object(await jsonBody(request), ["subject", "message"]);
  const subject = text(body.subject, 3, 160);
  const message = text(body.message, 10, 4000);
  const { data, error } = await db().from("rider_support_requests")
    .insert({ rider_id: rider.id, subject, message }).select("id,subject,message,status,created_at,updated_at").single();
  if (error || !data) throw new ApiFailure(503, "Could not submit your support request.");
  await audit(rider.id, "rider_support_create", data.id);
  return { ok: true, item: data };
});
