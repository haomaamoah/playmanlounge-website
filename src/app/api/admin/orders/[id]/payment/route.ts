import { audit, checkOrigin, checked, endpoint, rateLimit, requireAdmin } from "@/lib/admin/server";
import { ApiFailure } from "@/lib/admin/validation";
import { orderDTO, updatePayment } from "@/lib/db/orders";
import { db } from "@/lib/db/server";
import { fetchStatus, gatewayConfig, isConfigured, isTransactionId } from "@/lib/payments/theteller";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  return endpoint(async (req) => {
    checkOrigin(req);
    const admin = await requireAdmin();
    await rateLimit(req, "admin-payment-check", 60, 60, admin.id);
    const { id } = await context.params;
    const current = await db().from("orders").select("*").eq("id", id).maybeSingle();
    if (!current.data && !current.error) throw new ApiFailure(404, "Order not found.");
    const row = checked(current.data, current.error);
    if (row.payment_status !== "pending") return { ok: true, item: orderDTO(row), message: "This payment is no longer pending." };
    const reference = row.transaction_id ? String(row.transaction_id) : "";
    if (!isTransactionId(reference)) throw new ApiFailure(409, "This order has no PaySwitch reference to check.");
    const config = gatewayConfig();
    if (!isConfigured(config)) throw new ApiFailure(503, "PaySwitch is not configured on this server.");

    let result;
    try { result = await fetchStatus(config, reference); }
    catch { throw new ApiFailure(502, "Could not reach PaySwitch. Try again in a moment."); }
    await audit(admin.id, "payment_check", id);
    await updatePayment(reference, result.state, result.gatewayIssue);

    const updated = await db().from("orders").select("*").eq("id", id).single();
    const item = orderDTO(checked(updated.data, updated.error));
    const message = result.gatewayIssue
      ? `PaySwitch could not confirm (code ${result.code || "unknown"}).`
      : item.paymentStatus === "paid" ? "PaySwitch: Success."
      : item.paymentStatus === "failed" ? `PaySwitch: Failed (code ${result.code || "unknown"}).`
      : "PaySwitch: still pending.";
    return { ok: true, item, message };
  })(request);
}
