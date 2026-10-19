import { assertKitchenOrderAccess, audit, checkOrigin, checked, endpoint, jsonBody, requireAdmin } from "@/lib/admin/server";
import { ApiFailure, canTransition, object, orderStatuses } from "@/lib/admin/validation";
import type { OrderStatus } from "@/lib/admin/contracts";
import { orderDTO } from "@/lib/db/orders";
import { db } from "@/lib/db/server";
import { scheduleNotificationDispatch } from "@/lib/notifications/schedule";
type Context = {params:Promise<{id:string}>};
export async function GET(request: Request, context: Context) {
  return endpoint(async () => {
    const admin = await requireAdmin(); const {id} = await context.params;
    const {data,error} = await db().from("orders").select("*").eq("id",id).maybeSingle();
    if (!data && !error) throw new ApiFailure(404,"Order not found.");
    const row = checked(data,error);
    assertKitchenOrderAccess(row,admin);
    return {ok:true,item:orderDTO(row)};
  })(request);
}
export async function PATCH(request: Request, context: Context) {
  return endpoint(async req => {
    checkOrigin(req); const admin = await requireAdmin(); const {id} = await context.params;
    const b = object(await jsonBody(req),["status"]); const status = b.status as OrderStatus;
    if (!orderStatuses.includes(status)) throw new ApiFailure(400,"Invalid order status.");
    const current = await db().from("orders").select("*").eq("id",id).single();
    const row = checked(current.data,current.error);
    assertKitchenOrderAccess(row,admin);
    if (!canTransition(row.status,status)) throw new ApiFailure(409,"Invalid order status transition.");
    if (status !== "cancelled" && status !== "pending" && !["paid","cod"].includes(row.payment_status)) throw new ApiFailure(409,"Payment must be confirmed before preparing.");
    await audit(admin.id,"order_status",id);
    const {data,error} = await db().from("orders").update({status}).eq("id",id).eq("status",row.status).select("*").single();
    const item = orderDTO(checked(data,error));
    scheduleNotificationDispatch();
    return {ok:true,item};
  })(request);
}
