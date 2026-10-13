import { checked, endpoint, requireAdmin } from "@/lib/admin/server";
import { ApiFailure } from "@/lib/admin/validation";
import { db } from "@/lib/db/server";

export const GET = endpoint(async (request) => {
  await requireAdmin();
  const url = new URL(request.url);
  const search = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const parsedLimit = Number(url.searchParams.get("limit") ?? 50);
  const parsedOffset = Number(url.searchParams.get("offset") ?? 0);
  const limit = Number.isInteger(parsedLimit) ? Math.min(100, Math.max(1, parsedLimit)) : 50;
  const offset = Number.isInteger(parsedOffset) ? Math.max(0, parsedOffset) : 0;
  if (/[(),%"_*\\]/u.test(search)) throw new ApiFailure(400, "Remove search operators from the query.");

  let query = db().from("customer_profiles")
    .select("id,name,email,phone,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (search) {
    const pattern = `%${search}%`;
    query = query.or(`name.ilike."${pattern}",email.ilike."${pattern}",phone.ilike."${pattern}"`);
  }
  const { data, error, count } = await query;
  if (error?.code === "PGRST205") {
    throw new ApiFailure(503, "Customer records are not configured yet. Apply the customer portal database migration and try again.");
  }
  return { ok: true, items: checked(data, error), total: count ?? 0 };
});
