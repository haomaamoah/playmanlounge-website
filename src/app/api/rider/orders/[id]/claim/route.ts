import { checkOrigin, endpoint } from "@/lib/admin/server";
import { ApiFailure } from "@/lib/admin/validation";
import { db } from "@/lib/db/server";
import { getRiderOrder } from "@/lib/riders/orders";
import { requireRider } from "@/lib/riders/server";

type Context = { params: Promise<{ id: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const POST = endpoint(async (request: Request, context: Context) => {
  if (!request.headers.has("authorization")) checkOrigin(request);
  const rider = await requireRider(request);
  const { id } = await context.params;
  if (!uuidPattern.test(id)) throw new ApiFailure(404, "Delivery not found.");
  const { data, error } = await db().rpc("claim_delivery_order", { p_order: id, p_rider: rider.id });
  if (error) throw new ApiFailure(503, "Could not claim this delivery.");
  if (!data) {
    const { data: current, error: readError } = await db().from("orders").select("rider_id").eq("id", id).maybeSingle();
    if (readError) throw new ApiFailure(503, "Could not check this delivery.");
    if (current?.rider_id && current.rider_id !== rider.id) throw new ApiFailure(409, "Someone else has taken this order.");
    throw new ApiFailure(409, "This order is no longer available.");
  }
  return { ok: true, item: await getRiderOrder(id, rider) };
});
