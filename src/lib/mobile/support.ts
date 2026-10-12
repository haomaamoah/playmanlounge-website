import "server-only";
import { jsonBody } from "../admin/server";
import type { Customer } from "./auth";
import { LIMITS, SUPPORT_LIST_MAX } from "./constants";
import { mobileTicket, supportContactName } from "./dto";
import { limit } from "./limits";
import { created, ok } from "./reply";
import { db, failed, userClient } from "./supabase";
import { parseSupport } from "./validation";

// Exactly the columns the customer role may read (see the migration's column grants).
const TICKET_COLUMNS = "id,subject,message,status,phone,created_at,updated_at";

export async function createTicket(request: Request, customer: Customer) {
  await limit(request, "mobile-support", LIMITS.supportPerCustomer, customer.id);
  const { subject, message, phone } = parseSupport(await jsonBody(request));
  // Name and e-mail come from the account, so staff can reply and the ticket shows up in the admin Support desk.
  const { data, error } = await db()
    .from("support_requests")
    .insert({
      customer_id: customer.id,
      customer_name: supportContactName(String(customer.profile.name ?? ""), customer.email),
      customer_email: customer.email,
      phone,
      subject,
      message,
    })
    .select(TICKET_COLUMNS)
    .single();
  if (error || !data) throw failed("create support ticket", error);
  return created({ ticket: mobileTicket(data) });
}

export async function listTickets(customer: Customer) {
  // The caller's own JWT: Row Level Security re-checks the ownership filter below.
  const { data, error } = await userClient(customer.jwt)
    .from("support_requests")
    .select(TICKET_COLUMNS)
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false })
    .limit(SUPPORT_LIST_MAX);
  if (error) throw failed("list support tickets", error);
  return ok({ tickets: data.map((row) => mobileTicket(row)) });
}
