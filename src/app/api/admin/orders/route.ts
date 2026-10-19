import { checked, endpoint, requireAdmin } from "@/lib/admin/server";
import { pagination } from "@/lib/admin/pagination";
import { ApiFailure, orderStatuses } from "@/lib/admin/validation";
import { orderDTO } from "@/lib/db/orders";
import { db } from "@/lib/db/server";
import { orderSearchFilter, searchQuery } from "@/lib/admin/search";
export const GET = endpoint(async request => {
  const admin = await requireAdmin(); const {url,limit,offset} = pagination(request);
  if (admin.role === "admin" && !admin.kitchenId) throw new ApiFailure(403,"This administrator is not assigned to a kitchen.");
  const search = searchQuery(url);
  let q = db().from("orders").select("*",{count:"exact"}).order("created_at",{ascending:false}).range(offset,offset+limit-1);
  if (admin.role === "admin") q = q.eq("kitchen_id",admin.kitchenId!);
  const status = url.searchParams.get("status"), payment = url.searchParams.get("paymentStatus");
  if (search) q = q.or(orderSearchFilter(search));
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
