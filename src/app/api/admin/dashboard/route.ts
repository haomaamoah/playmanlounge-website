import { checked, endpoint, requireAdmin } from "@/lib/admin/server";
import { ApiFailure } from "@/lib/admin/validation";
import { orderDTO } from "@/lib/db/orders";
import { db } from "@/lib/db/server";
export const GET = endpoint(async () => {
  const admin = await requireAdmin();
  const client = db();
  if (admin.role === "admin" && !admin.kitchenId) throw new ApiFailure(403,"This administrator is not assigned to a kitchen.");
  const count = async (table:string,field?:string,value?:string) => {
    let q = client.from(table).select("id",{count:"exact",head:true}).eq("is_demo",false);
    if (field) q = q.eq(field,value);
    if (table === "orders" && admin.role === "admin") q = q.eq("kitchen_id",admin.kitchenId!);
    const {count,error} = await q;
    if (error) throw error;
    return count ?? 0;
  };
  const countCustomers = async () => {
    const {count,error} = await client.from("customer_profiles").select("id",{count:"exact"}).limit(1);
    if (error?.code === "PGRST205") return null;
    if (error) throw error;
    return count ?? 0;
  };
  const adminCountQuery = admin.role === "manager"
    ? client.from("admin_profiles").select("id",{count:"exact",head:true}).eq("role","admin")
    : Promise.resolve({count:null,error:null});
  let recentQuery = client.from("orders").select("*").eq("is_demo",false).order("created_at",{ascending:false}).limit(8);
  if (admin.role === "admin") recentQuery = recentQuery.eq("kitchen_id",admin.kitchenId!);
  const revenueQuery = admin.role === "manager"
    ? client.rpc("dashboard_revenue")
    : client.from("orders").select("total").eq("is_demo",false).eq("payment_status","paid").eq("kitchen_id",admin.kitchenId!);
  const [totalOrders,paidOrders,pendingOrders,failedPayments,codOrders,openSupport,closedSupport,menu,recent,revenue,customerCount,adminCount] = await Promise.all([
    count("orders"),count("orders","payment_status","paid"),count("orders","payment_status","pending"),
    count("orders","payment_status","failed"),count("orders","payment_status","cod"),
    count("support_requests","status","open"),count("support_requests","status","closed"),
    client.from("menu_items").select("id",{count:"exact",head:true}).eq("is_active",true),
    recentQuery,
    revenueQuery,
    countCustomers(),adminCountQuery,
  ]);
  if (menu.error || revenue.error || adminCount.error) throw menu.error ?? revenue.error ?? adminCount.error;
  const revenueTotal = admin.role === "manager"
    ? Number((revenue as {data:unknown}).data ?? 0)
    : ((revenue as {data:{total:number|string}[] | null}).data ?? []).reduce((sum,row) => sum + Number(row.total),0);
  return {ok:true,dashboard:{totalOrders,paidOrders,pendingOrders,failedPayments,codOrders,openSupport,closedSupport,
    menuItems:menu.count ?? 0,customerCount,adminCount:admin.role === "manager" ? adminCount.count ?? 0 : null,
    revenue:revenueTotal,recentOrders:checked(recent.data,recent.error).map(orderDTO)}};
});
