import { checkOrigin, checked, endpoint, jsonBody, rateLimit } from "@/lib/admin/server";
import { pagination } from "@/lib/admin/pagination";
import { searchQuery, textSearchFilter } from "@/lib/admin/search";
import { object, supportInput } from "@/lib/admin/validation";
import { requireCustomer } from "@/lib/customer/server";
import { supportDTO } from "@/lib/db/orders";
import { db } from "@/lib/db/server";
import { scheduleNotificationDispatch } from "@/lib/notifications/schedule";

export const GET = endpoint(async (request) => {
  const { user } = await requireCustomer();
  const { url, limit, offset } = pagination(request);
  const search = searchQuery(url);
  let query = db().from("support_requests").select("*", { count: "exact" })
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  if (search) query = query.or(textSearchFilter(search, ["subject", "message", "status"]));
  const { data, error, count } = await query;
  return { ok: true, items: checked(data, error).map(supportDTO), total: count ?? 0 };
});

export const POST = endpoint(async (request) => {
  checkOrigin(request);
  const { user, profile } = await requireCustomer();
  await rateLimit(request, "customer-support", 5, 3600, user.id);
  const body = object(await jsonBody(request), ["subject", "message"]);
  const input = supportInput({
    ...body, customerName: profile.name, customerEmail: profile.email, phone: profile.phone,
  });
  const { data, error } = await db().from("support_requests").insert({
    customer_id: user.id, customer_name: input.customerName, customer_email: input.customerEmail,
    phone: input.phone, subject: input.subject, message: input.message,
  }).select("id").single();
  const item = checked(data, error);
  scheduleNotificationDispatch();
  return { ok: true, id: item.id };
});
