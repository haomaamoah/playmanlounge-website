import { audit, checkOrigin, endpoint, jsonBody, requireManager, setAuthBlocked } from "@/lib/admin/server";
import { accountBlockInput, ApiFailure } from "@/lib/admin/validation";
import { db } from "@/lib/db/server";

type Context = { params: Promise<{ id: string }> };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, context: Context) {
  return endpoint(async (req) => {
    checkOrigin(req);
    const manager = await requireManager();
    const { id } = await context.params;
    if (!uuidPattern.test(id)) throw new ApiFailure(404, "Customer not found.");
    const blocked = accountBlockInput(await jsonBody(req));
    const client = db();
    const { data: customer, error: lookupError } = await client.from("customer_profiles")
      .select("id,is_blocked").eq("id", id).maybeSingle();
    if (lookupError) throw new ApiFailure(503, "Could not load the customer account.");
    if (!customer) throw new ApiFailure(404, "Customer not found.");
    if (blocked) {
      await audit(manager.id, "customer_block", id);
      const { error } = await client.from("customer_profiles").update({ is_blocked: true }).eq("id", id);
      if (error) throw new ApiFailure(503, "Could not block the customer account.");
      await setAuthBlocked(id, true);
    } else {
      await audit(manager.id, "customer_unblock", id);
      await setAuthBlocked(id, false);
      const { error } = await client.from("customer_profiles").update({ is_blocked: false }).eq("id", id);
      if (error) throw new ApiFailure(503, "Could not save the customer's unblocked status.");
    }
    return { ok: true, item: { id, is_blocked: blocked } };
  })(request);
}
