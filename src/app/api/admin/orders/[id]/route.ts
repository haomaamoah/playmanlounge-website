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
    let kitchen = null;
    let rider = null;
    let riderLocation = null;
    if (row.kitchen_id) {
      const result = await db().from("kitchens").select("name,latitude,longitude").eq("id",row.kitchen_id).maybeSingle();
      kitchen = checked(result.data,result.error);
    }
    if (row.rider_id) {
      const [profile, location] = await Promise.all([
        db().from("rider_profiles").select("id,name,phone,bike_model,bike_color,license_plate").eq("id",row.rider_id).maybeSingle(),
        db().from("rider_locations").select("latitude,longitude,updated_at").eq("rider_id",row.rider_id).maybeSingle(),
      ]);
      rider = checked(profile.data,profile.error);
      if (location.error) throw new ApiFailure(503,"Could not load the rider's latest location.");
      if (location.data) {
        riderLocation = {
          latitude:Number(location.data.latitude),
          longitude:Number(location.data.longitude),
          updatedAt:String(location.data.updated_at),
        };
      }
      rider = {
        id:String(rider.id),name:String(rider.name),phone:String(rider.phone),
        bikeModel:String(rider.bike_model ?? ""),bikeColor:String(rider.bike_color ?? ""),
        licensePlate:String(rider.license_plate ?? ""),
      };
    }
    return {ok:true,item:{...orderDTO(row),kitchen,rider,riderLocation}};
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
