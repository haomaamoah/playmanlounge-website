import { checked, endpoint, requireAdmin } from "@/lib/admin/server";
import { ApiFailure } from "@/lib/admin/validation";
import { db } from "@/lib/db/server";
import { searchQuery, textSearchFilter } from "@/lib/admin/search";

export const GET = endpoint(async (request) => {
  await requireAdmin();
  const url = new URL(request.url);
  const search = searchQuery(url);
  const parsedLimit = Number(url.searchParams.get("limit") ?? 50);
  const parsedOffset = Number(url.searchParams.get("offset") ?? 0);
  const limit = Number.isInteger(parsedLimit) ? Math.min(100, Math.max(1, parsedLimit)) : 50;
  const offset = Number.isInteger(parsedOffset) ? Math.max(0, parsedOffset) : 0;

  let query = db().from("customer_profiles")
    .select("id,name,email,phone,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (search) {
    query = query.or(textSearchFilter(search, ["name", "email", "phone"]));
  }
  const { data, error, count } = await query;
  if (error?.code === "PGRST205") {
    throw new ApiFailure(503, "Customer records are not configured yet. Apply the customer portal database migration and try again.");
  }
  return { ok: true, items: checked(data, error), total: count ?? 0 };
});
