import { requireCustomer } from "@/lib/mobile/auth";
import { mobileEndpoint } from "@/lib/mobile/http";
import { createTicket, listTickets } from "@/lib/mobile/support";
import { scheduleNotificationDispatch } from "@/lib/notifications/schedule";

export const runtime = "nodejs";
export const GET = mobileEndpoint(async (request) => listTickets(await requireCustomer(request)));
export const POST = mobileEndpoint(async (request) => {
  const result = await createTicket(request, await requireCustomer(request));
  scheduleNotificationDispatch();
  return result;
});
