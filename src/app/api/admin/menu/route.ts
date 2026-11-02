import { audit, checkOrigin, checked, endpoint, jsonBody, requireAdmin } from "@/lib/admin/server";
import { pagination } from "@/lib/admin/pagination";
import { searchQuery, textSearchFilter } from "@/lib/admin/search";
import { menuInput } from "@/lib/admin/validation";
import { menuDTO, menuRow } from "@/lib/db/catalog";
import { db } from "@/lib/db/server";
export const GET = endpoint(async (request) => {
  await requireAdmin();
  const url = new URL(request.url);
  if (url.searchParams.get("groups") === "1") {
    const { data, error } = await db().from("menu_items").select("group_id").order("group_id");
    const groups = [...new Set(checked(data, error).map((row) => String(row.group_id)).filter(Boolean))];
    return { ok: true, groups };
  }
  if (!url.searchParams.has("limit")) {
    const {data,error,count} = await db().from("menu_items").select("*",{count:"exact"}).order("sort_order").order("id");
    return {ok:true,items:checked(data,error).map(menuDTO),total:count};
  }
  const { limit, offset } = pagination(request);
  const search = searchQuery(url);
  let query = db().from("menu_items").select("*", { count: "exact" }).order("sort_order").order("id").range(offset, offset + limit - 1);
  if (url.searchParams.get("inactive") !== "1") query = query.eq("is_active", true);
  if (search) query = query.or(textSearchFilter(search, ["name", "description", "group_title", "id", "category"]));
  const { data, error, count } = await query;
  return { ok: true, items: checked(data, error).map(menuDTO), total: count ?? 0 };
});
export const POST = endpoint(async request => {
  checkOrigin(request); const admin = await requireAdmin();
  const input = menuInput(await jsonBody(request));
  await audit(admin.id,"menu_create",input.id);
  const {data,error} = await db().from("menu_items").insert(menuRow(input)).select("*").single();
  return {ok:true,item:menuDTO(checked(data,error))};
});
