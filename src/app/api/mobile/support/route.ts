import { requireCustomer } from "@/lib/mobile/auth";
import { mobileEndpoint } from "@/lib/mobile/http";
import { createTicket, listTickets } from "@/lib/mobile/support";

export const runtime = "nodejs";
export const GET = mobileEndpoint(async (request) => listTickets(await requireCustomer(request)));
export const POST = mobileEndpoint(async (request) => createTicket(request, await requireCustomer(request)));
