import { checked, endpoint, requireAdmin } from "@/lib/admin/server";
import { orderDTO } from "@/lib/db/orders";
import { db } from "@/lib/db/server";
export const GET = endpoint(async () => {
  await requireAdmin();
  const client = db();
  const count = async (table:string,field?:string,value?:string,demo=false) => {
    let q = client.from(table).select("id",{count:"exact",head:true}).eq("is_demo",demo);
    if (field) q = q.eq(field,value);
    const {count,error} = await q;
    if (error) throw error;
    return count ?? 0;
  };
  const [totalOrders,paidOrders,pendingOrders,failedPayments,codOrders,openSupport,closedSupport,menu,recent,revenue,demoOrders,demoSupport] = await Promise.all([
    count("orders"),count("orders","payment_status","paid"),count("orders","payment_status","pending"),
    count("orders","payment_status","failed"),count("orders","payment_status","cod"),
    count("support_requests","status","open"),count("support_requests","status","closed"),
    client.from("menu_items").select("id",{count:"exact",head:true}).eq("is_active",true),
    client.from("orders").select("*").eq("is_demo",false).order("created_at",{ascending:false}).limit(8),
    client.rpc("dashboard_revenue"),
    count("orders",undefined,undefined,true),count("support_requests",undefined,undefined,true),
  ]);
  if (menu.error || revenue.error) throw menu.error ?? revenue.error;
  return {ok:true,dashboard:{totalOrders,paidOrders,pendingOrders,failedPayments,codOrders,openSupport,closedSupport,
    menuItems:menu.count ?? 0,demoOrders,demoSupport,revenue:Number(revenue.data ?? 0),recentOrders:checked(recent.data,recent.error).map(orderDTO)}};
});
