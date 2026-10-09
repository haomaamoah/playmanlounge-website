import { audit, checkOrigin, checked, endpoint, jsonBody, requireAdmin } from "@/lib/admin/server";
import { ApiFailure, object } from "@/lib/admin/validation";
import { supportDTO } from "@/lib/db/orders";
import { db } from "@/lib/db/server";
export async function PATCH(request: Request, context: {params:Promise<{id:string}>}) {
  return endpoint(async req => {
    checkOrigin(req); const admin = await requireAdmin(); const {id} = await context.params;
    const b = object(await jsonBody(req),["status"]);
    if (b.status !== "open" && b.status !== "closed") throw new ApiFailure(400,"Invalid support status.");
    await audit(admin.id,"support_status",id);
    const {data,error} = await db().from("support_requests").update({status:b.status}).eq("id",id).select("*").single();
    return {ok:true,item:supportDTO(checked(data,error))};
  })(request);
}
