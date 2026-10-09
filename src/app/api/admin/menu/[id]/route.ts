import { audit, checkOrigin, checked, endpoint, jsonBody, requireAdmin } from "@/lib/admin/server";
import { menuInput } from "@/lib/admin/validation";
import { menuDTO, menuRow } from "@/lib/db/catalog";
import { db } from "@/lib/db/server";
type Context = {params:Promise<{id:string}>};
export async function PATCH(request: Request, context: Context) {
  return endpoint(async req => {
    checkOrigin(req); const admin = await requireAdmin(); const {id} = await context.params;
    const input = menuInput(await jsonBody(req),true);
    await audit(admin.id,"menu_update",id);
    const {data,error} = await db().from("menu_items").update(menuRow(input)).eq("id",id).select("*").single();
    return {ok:true,item:menuDTO(checked(data,error))};
  })(request);
}
export async function DELETE(request: Request, context: Context) {
  return endpoint(async req => {
    checkOrigin(req); const admin = await requireAdmin(); const {id} = await context.params;
    await audit(admin.id,"menu_deactivate",id);
    const {data,error} = await db().from("menu_items").update({is_active:false}).eq("id",id).select("id").single();
    checked(data,error); return {ok:true};
  })(request);
}
