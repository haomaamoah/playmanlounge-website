import { checked, endpoint } from "@/lib/admin/server";
import { ApiFailure } from "@/lib/admin/validation";
import { requireCustomer } from "@/lib/customer/server";
import { orderDTO } from "@/lib/db/orders";
import { db } from "@/lib/db/server";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  return endpoint(async () => {
    const { profile } = await requireCustomer();
    const { id } = await context.params;
    const { data, error } = await db()
      .from("orders")
      .select("*")
      .eq("id", id)
      .eq("customer_email", profile.email)
      .maybeSingle();
    if (!data && !error) throw new ApiFailure(404, "Order not found.");
    return { ok: true, item: orderDTO(checked(data, error)) };
  })(request);
}
