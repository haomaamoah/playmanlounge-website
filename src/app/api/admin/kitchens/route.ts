import { audit, checkOrigin, checked, endpoint, jsonBody, requireManager } from "@/lib/admin/server";
import { kitchenInput } from "@/lib/admin/validation";
import { db } from "@/lib/db/server";

export const GET = endpoint(async () => {
  await requireManager();
  const { data,error } = await db().from("kitchens").select("id,name,address,latitude,longitude,is_active")
    .order("name",{ascending:true});
  return { ok:true,items:checked(data,error) };
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
