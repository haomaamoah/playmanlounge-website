import { audit, checkOrigin, checked, endpoint, jsonBody, requireManager } from "@/lib/admin/server";
import { ApiFailure, kitchenInput } from "@/lib/admin/validation";
import { db } from "@/lib/db/server";

type Context = { params:Promise<{id:string}> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request:Request,context:Context) {
  return endpoint(async (req) => {
    checkOrigin(req);
    const manager = await requireManager();
    const {id} = await context.params;
    if (!uuidPattern.test(id)) throw new ApiFailure(404,"Kitchen not found.");
    const input = kitchenInput(await jsonBody(req),true);
    await audit(manager.id,"kitchen_update",id);
    const {data,error} = await db().from("kitchens").update(input).eq("id",id)
      .select("id,name,address,latitude,longitude,is_active").maybeSingle();
    if (!data && !error) throw new ApiFailure(404,"Kitchen not found.");
    return {ok:true,item:checked(data,error)};
  })(request);
}
