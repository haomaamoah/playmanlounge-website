import { requireCustomer } from "@/lib/mobile/auth";
import { mobileEndpoint } from "@/lib/mobile/http";
import { getPayment, retryPayment } from "@/lib/mobile/orders";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export const GET = mobileEndpoint(async (request, context: Context) => {
  const customer = await requireCustomer(request);
  return getPayment(request, customer, (await context.params).id);
});
export const POST = mobileEndpoint(async (request, context: Context) => {
  const customer = await requireCustomer(request);
  return retryPayment(request, customer, (await context.params).id);
});
