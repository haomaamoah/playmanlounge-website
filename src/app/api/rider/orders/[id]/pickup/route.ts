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
  const { data, error } = await db().rpc("pickup_delivery_order", { p_order: id, p_rider: rider.id });
  if (error) throw new ApiFailure(503, "Could not confirm pickup.");
  if (!data) throw new ApiFailure(409, "Pickup is available only when the kitchen marks the order ready.");
  return { ok: true, item: await getRiderOrder(id, rider) };
});
