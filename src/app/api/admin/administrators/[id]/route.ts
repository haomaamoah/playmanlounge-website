import { audit, checkOrigin, endpoint, jsonBody, requireManager, setAuthBlocked } from "@/lib/admin/server";
import { ApiFailure, email, object } from "@/lib/admin/validation";
import { db } from "@/lib/db/server";

type Context = { params: Promise<{ id: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function findAdmin(id: string) {
  if (!uuidPattern.test(id)) throw new ApiFailure(404, "Administrator not found.");
  const { data, error } = await db().from("admin_profiles").select("id,email,created_at,is_blocked,role")
    .eq("id", id).eq("role", "admin").maybeSingle();
  if (error) throw new ApiFailure(503, "Could not load the administrator account.");
  if (!data) throw new ApiFailure(404, "Administrator not found.");
  return data;
}

export async function PATCH(request: Request, context: Context) {
  return endpoint(async (req) => {
    checkOrigin(req);
    const manager = await requireManager();
    const { id } = await context.params;
    if (id === manager.id) throw new ApiFailure(403, "You cannot manage your own account.");
    const body = object(await jsonBody(req), ["email", "isBlocked"]);
    if (Object.keys(body).length !== 1) throw new ApiFailure(400, "Change one account setting at a time.");
    const client = db();
    const current = await findAdmin(id);

    if ("email" in body) {
      const address = email(body.email);
      const { data: duplicate, error: duplicateError } = await client.from("admin_profiles")
        .select("id").eq("email", address).neq("id", id).maybeSingle();
      if (duplicateError) throw new ApiFailure(503, "Could not verify the email address.");
      if (duplicate) throw new ApiFailure(409, "An account with this email already exists.");
      await audit(manager.id, "admin_email_update", id);
      const { error: authError } = await client.auth.admin.updateUserById(id, { email: address, email_confirm: true });
      if (authError) throw new ApiFailure(503, "Could not update the administrator's sign-in email.");
      const { data, error } = await client.from("admin_profiles").update({ email: address })
        .eq("id", id).select("id,email,created_at,is_blocked").single();
      if (error || !data) {
        const { error: rollbackError } = await client.auth.admin.updateUserById(id, {
          email: current.email,
          email_confirm: true,
        });
        if (rollbackError) console.error("[manager-api] failed to roll back administrator auth email after profile update failed");
        throw new ApiFailure(503, "Could not save the administrator's email.");
      }
      return { ok: true, item: data };
    }

    if (typeof body.isBlocked !== "boolean") throw new ApiFailure(400, "Choose whether the account should be blocked.");
    const blocked = body.isBlocked;
    if (blocked) {
      await audit(manager.id, "admin_block", id);
      const { error } = await client.from("admin_profiles").update({ is_blocked: true }).eq("id", id);
      if (error) throw new ApiFailure(503, "Could not block the administrator account.");
      await setAuthBlocked(id, true);
    } else {
      await audit(manager.id, "admin_unblock", id);
      await setAuthBlocked(id, false);
      const { error } = await client.from("admin_profiles").update({ is_blocked: false }).eq("id", id);
      if (error) throw new ApiFailure(503, "Could not save the administrator's unblocked status.");
    }
    return { ok: true, item: { id, email: current.email, created_at: current.created_at, is_blocked: blocked } };
  })(request);
}

export async function DELETE(request: Request, context: Context) {
  return endpoint(async (req) => {
    checkOrigin(req);
    const manager = await requireManager();
    const { id } = await context.params;
    if (id === manager.id) throw new ApiFailure(403, "You cannot delete your own account.");
    const current = await findAdmin(id);
    await audit(manager.id, "admin_delete", id);
    const { error } = await db().auth.admin.deleteUser(id);
    if (error) throw new ApiFailure(503, "Could not delete the administrator account.");
    return { ok: true, item: { id: current.id } };
  })(request);
}
