import { audit, checkOrigin, checked, endpoint, jsonBody, requireAdmin } from "@/lib/admin/server";
import { menuInput } from "@/lib/admin/validation";
import { menuDTO, menuRow } from "@/lib/db/catalog";
import { db } from "@/lib/db/server";
export const GET = endpoint(async () => {
  await requireAdmin();
  const {data,error,count} = await db().from("menu_items").select("*",{count:"exact"}).order("sort_order").order("id");
  return {ok:true,items:checked(data,error).map(menuDTO),total:count};
});
export const POST = endpoint(async request => {
  checkOrigin(request); const admin = await requireAdmin();
  const input = menuInput(await jsonBody(request));
  await audit(admin.id,"menu_create",input.id);
  const {data,error} = await db().from("menu_items").insert(menuRow(input)).select("*").single();
  return {ok:true,item:menuDTO(checked(data,error))};
});
