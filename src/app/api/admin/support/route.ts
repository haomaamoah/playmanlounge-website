import { checked, endpoint, requireAdmin } from "@/lib/admin/server";
import { pagination } from "@/lib/admin/pagination";
import { ApiFailure } from "@/lib/admin/validation";
import { supportDTO } from "@/lib/db/orders";
import { db } from "@/lib/db/server";
import { searchQuery, textSearchFilter } from "@/lib/admin/search";
export const GET = endpoint(async request => {
  await requireAdmin(); const {url,limit,offset} = pagination(request);
  const search = searchQuery(url);
  let q = db().from("support_requests").select("*",{count:"exact"}).order("created_at",{ascending:false}).range(offset,offset+limit-1);
  const status = url.searchParams.get("status");
  if (search) q = q.or(textSearchFilter(search, ["subject", "message", "customer_name", "customer_email", "phone"]));
  if (status) {
    if (!["open","closed"].includes(status)) throw new ApiFailure(400,"Invalid support status.");
    q = q.eq("status",status);
  }
  const {data,error,count} = await q;
  return {ok:true,items:checked(data,error).map(supportDTO),total:count};
});
