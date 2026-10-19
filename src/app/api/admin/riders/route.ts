import { audit, checkOrigin, endpoint, jsonBody, rateLimit, requireManager } from "@/lib/admin/server";
import { ApiFailure, email, object, password, text } from "@/lib/admin/validation";
import { db } from "@/lib/db/server";
import { publicRider } from "@/lib/riders/server";
import { searchQuery, textSearchFilter } from "@/lib/admin/search";

export const GET = endpoint(async (request) => {
  await requireManager();
  const url = new URL(request.url);
  const search = searchQuery(url);
  const limitValue = Number(url.searchParams.get("limit") ?? 50);
  const offsetValue = Number(url.searchParams.get("offset") ?? 0);
  const limit = Number.isInteger(limitValue) ? Math.min(100, Math.max(1, limitValue)) : 50;
  const offset = Number.isInteger(offsetValue) ? Math.max(0, offsetValue) : 0;
  let query = db().from("rider_profiles")
    .select("id,email,name,phone,bike_model,bike_color,license_plate,is_blocked,created_at,updated_at", { count: "exact" })
    .order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  if (search) query = query.or(textSearchFilter(search, ["name", "email", "phone"]));
  const { data, error, count } = await query;
  if (error) throw new ApiFailure(503, "Could not load riders.");
  const riders = data ?? [];
  const ids = riders.map((rider) => rider.id);
  const [locations, activeOrders] = ids.length ? await Promise.all([
    db().from("rider_locations").select("rider_id,updated_at").in("rider_id", ids),
    db().from("orders").select("rider_id").in("rider_id", ids).in("rider_delivery_status", ["assigned", "picked_up"]),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  if (locations.error || activeOrders.error) throw new ApiFailure(503, "Could not load rider activity.");
  const onlineIds = new Set((locations.data ?? []).filter((row) =>
    Date.now() - new Date(row.updated_at).getTime() <= 60_000).map((row) => row.rider_id));
  const activeIds = new Set((activeOrders.data ?? []).map((row) => row.rider_id));
  return {
    ok: true,
    items: riders.map((row) => ({
      ...publicRider(row),
      status: row.is_blocked ? "blocked" : activeIds.has(row.id) ? "on_delivery" : onlineIds.has(row.id) ? "available" : "offline",
    })),
    total: count ?? 0,
  };
});

export const POST = endpoint(async (request) => {
  checkOrigin(request);
  const manager = await requireManager();
  await rateLimit(request, "manager-create-rider", 20, 900, manager.id);
  const body = object(await jsonBody(request), ["email", "password", "name", "phone", "bikeModel", "bikeColor", "licensePlate"]);
  const address = email(body.email);
  const initialPassword = password(body.password, 12);
  const name = text(body.name, 2, 100);
  const phone = text(body.phone, 5, 30);
  const bikeModel = text(body.bikeModel ?? "", 0, 100);
  const bikeColor = text(body.bikeColor ?? "", 0, 60);
  const licensePlate = text(body.licensePlate ?? "", 0, 30);
  const client = db();
  const { data, error } = await client.auth.admin.createUser({
    email: address,
    password: initialPassword,
    email_confirm: true,
  });
  if (error) {
    if (error.code === "email_exists" || error.code === "user_already_exists") throw new ApiFailure(409, "An account with this email already exists.");
    throw new ApiFailure(503, "Could not create the rider account.");
  }
  const user = data.user;
  const { data: profile, error: profileError } = await client.from("rider_profiles")
    .insert({ id: user.id, email: address, name, phone, bike_model: bikeModel, bike_color: bikeColor, license_plate: licensePlate })
    .select("id,email,name,phone,bike_model,bike_color,license_plate,is_blocked,created_at,updated_at").single();
  if (profileError || !profile) {
    const { error: cleanupError } = await client.auth.admin.deleteUser(user.id);
    if (cleanupError) console.error("[manager-api] could not remove rider auth user after profile creation failed");
    if (profileError?.code === "23505") throw new ApiFailure(409, "A rider with that email or phone already exists.");
    throw new ApiFailure(503, "Could not save the rider profile.");
  }
  try {
    await audit(manager.id, "rider_create", user.id);
  } catch (failure) {
    const { error: cleanupError } = await client.auth.admin.deleteUser(user.id);
    if (cleanupError) console.error("[manager-api] could not remove rider after audit creation failed");
    throw failure;
  }
  return { ok: true, item: publicRider(profile) };
});
