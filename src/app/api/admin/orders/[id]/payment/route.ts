import { audit, checkOrigin, checked, endpoint, rateLimit, requireAdmin } from "@/lib/admin/server";
import { ApiFailure } from "@/lib/admin/validation";
import { orderDTO, updatePayment } from "@/lib/db/orders";
import { db } from "@/lib/db/server";
import { fetchStatus, gatewayConfig, isConfigured, isTransactionId } from "@/lib/payments/theteller";

type Context = { params: Promise<{ id: string }> };

// A charge PaySwitch still cannot find after this long was never submitted.
const NOT_FOUND_GRACE_MS = 15 * 60 * 1000;

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
    const abandoned = Boolean(result.notFound) && Date.now() - new Date(row.created_at).getTime() > NOT_FOUND_GRACE_MS;
    if (abandoned) await updatePayment(reference, "failed");
    else await updatePayment(reference, result.state, result.gatewayIssue);

    const updated = await db().from("orders").select("*").eq("id", id).single();
    const item = orderDTO(checked(updated.data, updated.error));
    const message = abandoned ? "PaySwitch: Failed (transaction not found)."
      : result.notFound ? "PaySwitch has no record of this payment yet. Check again in a few minutes."
      : result.gatewayIssue
      ? `PaySwitch could not confirm (code ${result.code || "unknown"}).`
      : item.paymentStatus === "paid" ? "PaySwitch: Success."
      : item.paymentStatus === "failed" ? `PaySwitch: Failed (code ${result.code || "unknown"}).`
      : "PaySwitch: still pending.";
    return { ok: true, item, message };
  })(request);
}
