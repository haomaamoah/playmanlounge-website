import { endpoint } from "@/lib/admin/server";
import { pagination } from "@/lib/admin/pagination";
import { requireCustomer } from "@/lib/customer/server";
import { checked } from "@/lib/admin/server";
import { db } from "@/lib/db/server";
import { orderDTO } from "@/lib/db/orders";
import { orderSearchFilter, searchQuery } from "@/lib/admin/search";

export const GET = endpoint(async (request) => {
  const { profile } = await requireCustomer();
  const { limit, offset } = pagination(request);
  const search = searchQuery(new URL(request.url));
  let query = db()
    .from("orders")
    .select("*", { count: "exact" })
    .eq("customer_email", profile.email)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (search) query = query.or(orderSearchFilter(search, false));
  const { data, error, count } = await query;
  return { ok: true, orders: checked(data, error).map(orderDTO), total: count ?? 0 };
});
