import { requireCustomer } from "@/lib/mobile/auth";
import { mobileEndpoint } from "@/lib/mobile/http";
import { listOrders, placeOrder } from "@/lib/mobile/orders";
import { scheduleNotificationDispatch } from "@/lib/notifications/schedule";

export const runtime = "nodejs";
export const GET = mobileEndpoint(async (request) => listOrders(request, await requireCustomer(request)));
export const POST = mobileEndpoint(async (request) => {
  const result = await placeOrder(request, await requireCustomer(request));
  scheduleNotificationDispatch();
  return result;
});
