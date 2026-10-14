import { endpoint } from "@/lib/admin/server";
import { requireCustomer } from "@/lib/customer/server";
import { checked } from "@/lib/admin/server";
import { db } from "@/lib/db/server";
import { orderDTO } from "@/lib/db/orders";
import { orderSearchFilter, searchQuery } from "@/lib/admin/search";

export const GET = endpoint(async (request) => {
  const { profile } = await requireCustomer();
  const search = searchQuery(new URL(request.url));
  let query = db()
    .from("orders")
    .select("*")
    .eq("customer_email", profile.email)
    .order("created_at", { ascending: false })
    .limit(100);
  if (search) query = query.or(orderSearchFilter(search, false));
  const { data, error } = await query;
  return { ok: true, orders: checked(data, error).map(orderDTO) };
});
