import { audit, checkOrigin, endpoint, jsonBody, requireManager, setAuthBlocked } from "@/lib/admin/server";
import { ApiFailure, object, text } from "@/lib/admin/validation";
import { db } from "@/lib/db/server";
import { getRiderOr404, publicRider } from "@/lib/riders/server";

type Context = { params: Promise<{ id: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, context: Context) {
  return endpoint(async (req) => {
    checkOrigin(req);
    const manager = await requireManager();
    const { id } = await context.params;
    if (!uuidPattern.test(id)) throw new ApiFailure(404, "Rider not found.");
    const body = object(await jsonBody(req), ["name", "phone", "bikeModel", "bikeColor", "licensePlate", "isBlocked"]);
    if (!Object.keys(body).length) throw new ApiFailure(400, "Choose a rider detail to update.");
    await getRiderOr404(id);
    const client = db();
    if (Object.keys(body).length === 1 && "isBlocked" in body) {
      if (typeof body.isBlocked !== "boolean") throw new ApiFailure(400, "Choose whether the rider should be blocked.");
      const blocked = body.isBlocked;
      await audit(manager.id, blocked ? "rider_block" : "rider_unblock", id);
      if (blocked) {
        const { error } = await client.from("rider_profiles").update({ is_blocked: true }).eq("id", id);
        if (error) throw new ApiFailure(503, "Could not block the rider.");
        await setAuthBlocked(id, true);
      } else {
        await setAuthBlocked(id, false);
        const { error } = await client.from("rider_profiles").update({ is_blocked: false }).eq("id", id);
        if (error) throw new ApiFailure(503, "Could not unblock the rider.");
      }
      return { ok: true, item: { id, isBlocked: blocked } };
    }
    if ("isBlocked" in body) throw new ApiFailure(400, "Change one rider setting at a time.");
    const update: Record<string, string> = {};
    if ("name" in body) update.name = text(body.name, 2, 100);
    if ("phone" in body) update.phone = text(body.phone, 5, 30);
    if ("bikeModel" in body) update.bike_model = text(body.bikeModel, 0, 100);
    if ("bikeColor" in body) update.bike_color = text(body.bikeColor, 0, 60);
    if ("licensePlate" in body) update.license_plate = text(body.licensePlate, 0, 30);
    await audit(manager.id, "rider_update", id);
    const { data, error } = await client.from("rider_profiles").update(update).eq("id", id)
      .select("id,email,name,phone,bike_model,bike_color,license_plate,is_blocked,created_at,updated_at").single();
    if (error || !data) {
      if (error?.code === "23505") throw new ApiFailure(409, "A rider with that phone already exists.");
      throw new ApiFailure(503, "Could not update the rider profile.");
    }
    return { ok: true, item: publicRider(data) };
  })(request);
}

export async function DELETE(request: Request, context: Context) {
  return endpoint(async (req) => {
    checkOrigin(req);
    const manager = await requireManager();
    const { id } = await context.params;
    if (!uuidPattern.test(id)) throw new ApiFailure(404, "Rider not found.");
    await getRiderOr404(id);
    const { count, error } = await db().from("orders").select("id", { count: "exact", head: true }).eq("rider_id", id);
    if (error) throw new ApiFailure(503, "Could not check this rider's delivery history.");
    if ((count ?? 0) > 0) throw new ApiFailure(409, "This rider has delivery history and cannot be deleted. Block the account instead.");
    await audit(manager.id, "rider_delete", id);
    const { error: deleteError } = await db().auth.admin.deleteUser(id);
    if (deleteError) throw new ApiFailure(503, "Could not delete the rider account.");
    return { ok: true, item: { id } };
  })(request);
}
