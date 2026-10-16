import { audit, checkOrigin, checked, endpoint, jsonBody, rateLimit, requireManager } from "@/lib/admin/server";
import { administratorCreateInput, ApiFailure } from "@/lib/admin/validation";
import { searchQuery, textSearchFilter } from "@/lib/admin/search";
import { db } from "@/lib/db/server";

export const GET = endpoint(async (request) => {
  await requireManager();
  const url = new URL(request.url);
  const search = searchQuery(url);
  const parsedLimit = Number(url.searchParams.get("limit") ?? 50);
  const parsedOffset = Number(url.searchParams.get("offset") ?? 0);
  const limit = Number.isInteger(parsedLimit) ? Math.min(100, Math.max(1, parsedLimit)) : 50;
  const offset = Number.isInteger(parsedOffset) ? Math.max(0, parsedOffset) : 0;
  let query = db().from("admin_profiles").select("id,email,created_at,is_blocked", { count: "exact" })
    .eq("role", "admin").order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  if (search) query = query.or(textSearchFilter(search, ["email"]));
  const { data, error, count } = await query;
  return { ok: true, items: checked(data, error), total: count ?? 0 };
});

export const POST = endpoint(async (request) => {
  checkOrigin(request);
  const manager = await requireManager();
  await rateLimit(request, "manager-create-admin", 20, 900, manager.id);
  const { email: address, password: initialPassword } = administratorCreateInput(await jsonBody(request));
  const client = db();
  const { data, error } = await client.auth.admin.createUser({
    email: address,
    password: initialPassword,
    email_confirm: true,
  });
  if (error) {
    if (error.code === "email_exists" || error.code === "user_already_exists") {
      throw new ApiFailure(409, "An account with this email already exists.");
    }
    throw new ApiFailure(503, "Could not create the administrator account.");
  }
  const { user } = data;
  const { error: profileError } = await client.from("admin_profiles").insert({
    id: user.id,
    email: address,
    role: "admin",
  });
  if (profileError) {
    const { error: cleanupError } = await client.auth.admin.deleteUser(user.id);
    if (cleanupError) console.error("[manager-api] failed to remove auth user after administrator profile creation failed");
    if (profileError.code === "23505") throw new ApiFailure(409, "An account with this email already exists.");
    throw new ApiFailure(503, "Could not save the administrator profile.");
  }
  try {
    await audit(manager.id, "admin_create", user.id);
  } catch (error) {
    const { error: cleanupError } = await client.auth.admin.deleteUser(user.id);
    if (cleanupError) console.error("[manager-api] failed to remove administrator after its audit record could not be written");
    throw error;
  }
  return { ok: true, item: { id: user.id, email: address, created_at: user.created_at, is_blocked: false } };
});
