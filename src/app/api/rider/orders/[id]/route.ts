import { endpoint } from "@/lib/admin/server";
import { ApiFailure } from "@/lib/admin/validation";
import { getRiderOrder } from "@/lib/riders/orders";
import { requireRider } from "@/lib/riders/server";

type Context = { params: Promise<{ id: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const GET = endpoint(async (request: Request, context: Context) => {
  const rider = await requireRider(request);
  const { id } = await context.params;
  if (!uuidPattern.test(id)) throw new ApiFailure(404, "Delivery not found.");
  return { ok: true, item: await getRiderOrder(id, rider) };
});
