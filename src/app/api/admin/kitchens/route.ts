import { audit, checkOrigin, checked, endpoint, jsonBody, requireManager } from "@/lib/admin/server";
import { pagination } from "@/lib/admin/pagination";
import { kitchenInput } from "@/lib/admin/validation";
import { db } from "@/lib/db/server";

export const GET = endpoint(async (request) => {
  await requireManager();
  const url = new URL(request.url);
  let query = db().from("kitchens").select("id,name,address,latitude,longitude,is_active", { count: "exact" })
    .order("name",{ascending:true});
  if (url.searchParams.has("limit")) {
    const { limit, offset } = pagination(request);
    query = query.range(offset, offset + limit - 1);
  }
  const { data, error, count } = await query;
  return { ok:true, items:checked(data,error), total: count ?? 0 };
});

export const POST = endpoint(async (request) => {
  checkOrigin(request);
  const manager = await requireManager();
  const input = kitchenInput(await jsonBody(request));
  const { data,error } = await db().from("kitchens").insert(input)
    .select("id,name,address,latitude,longitude,is_active").single();
  const kitchen = checked(data,error);
  await audit(manager.id,"kitchen_create",kitchen.id);
  return { ok:true,item:kitchen };
});
