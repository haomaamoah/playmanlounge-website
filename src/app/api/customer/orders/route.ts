import { endpoint } from "@/lib/admin/server";
import { requireCustomer } from "@/lib/customer/server";
import { checked } from "@/lib/admin/server";
import { db } from "@/lib/db/server";
import { orderDTO } from "@/lib/db/orders";

export const GET = endpoint(async () => {
  const { profile } = await requireCustomer();
  const { data, error } = await db()
    .from("orders")
    .select("*")
    .eq("customer_email", profile.email)
    .order("created_at", { ascending: false })
    .limit(100);
  return { ok: true, orders: checked(data, error).map(orderDTO) };
});
