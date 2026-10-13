import { requireCustomer } from "@/lib/mobile/auth";
import { mobileEndpoint } from "@/lib/mobile/http";
import { getOrder } from "@/lib/mobile/orders";

export const runtime = "nodejs";
export const GET = mobileEndpoint(async (request, context: { params: Promise<{ id: string }> }) => {
  const customer = await requireCustomer(request);
  const { id } = await context.params;
  return getOrder(customer, id);
});
