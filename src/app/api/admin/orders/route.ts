import { checked, endpoint, requireAdmin } from "@/lib/admin/server";
import { pagination } from "@/lib/admin/pagination";
import { ApiFailure, orderStatuses } from "@/lib/admin/validation";
import { orderDTO } from "@/lib/db/orders";
import { db } from "@/lib/db/server";
export const GET = endpoint(async request => {
  await requireAdmin(); const {url,limit,offset} = pagination(request);
  let q = db().from("orders").select("*",{count:"exact"}).order("created_at",{ascending:false}).range(offset,offset+limit-1);
  const status = url.searchParams.get("status"), payment = url.searchParams.get("paymentStatus");
  if (status) {
    if (!orderStatuses.includes(status as never)) throw new ApiFailure(400,"Invalid order status.");
    q = q.eq("status",status);
  }
  if (payment) {
    if (!["pending","paid","cod","failed"].includes(payment)) throw new ApiFailure(400,"Invalid payment status.");
    q = q.eq("payment_status",payment);
  }
  const {data,error,count} = await q;
  return {ok:true,items:checked(data,error).map(orderDTO),total:count};
});
