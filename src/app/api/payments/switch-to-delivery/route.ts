import { ApiFailure } from "@/lib/admin/validation";
import { checkOrigin, endpoint, rateLimit } from "@/lib/admin/server";
import { requireCustomer } from "@/lib/customer/server";
import { notificationStore } from "@/lib/db/orders";
import { db } from "@/lib/db/server";
import { sendOrderReceipts } from "@/lib/mail/send";
import type { HydratedOrder } from "@/lib/mail/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return endpoint(async (req) => {
    checkOrigin(req);
    const { profile } = await requireCustomer();
    await rateLimit(req, "payment-switch-delivery", 5, 60, profile.id);
    const body = await req.json().catch(() => null) as { transactionId?: unknown } | null;
    const transactionId = typeof body?.transactionId === "string" ? body.transactionId : "";
    if (!/^\d{12}$/.test(transactionId)) throw new ApiFailure(400, "Payment reference is invalid.");

    const { data: row, error } = await db().from("orders").select("*")
      .eq("transaction_id", transactionId).eq("customer_email", profile.email).maybeSingle();
    if (error) throw error;
    if (!row) throw new ApiFailure(404, "Order not found.");

    const { data: saved, error: switchError } = await db().rpc("switch_payment_to_delivery", {
      p_transaction: transactionId,
    });
    if (switchError?.code === "P0001") {
      throw new ApiFailure(409, "This payment can no longer be switched. Check its status or contact the kitchen.");
    }
    if (switchError) throw switchError;
    if (!saved || typeof saved !== "object") throw new ApiFailure(503, "The order could not be updated. Please try again.");
    const order = saved as Record<string, unknown>;
    const lines = Array.isArray(order.lines) ? order.lines as Record<string, unknown>[] : [];
    const hydrated: HydratedOrder = {
      orderRef: String(order.order_ref),
      placedAt: new Intl.DateTimeFormat("en-GB", {
        timeZone: "Africa/Accra", weekday: "short", day: "numeric", month: "short",
        year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true,
      }).format(new Date(String(order.created_at))),
      name: String(order.customer_name),
      phone: String(order.customer_phone),
      email: String(order.customer_email),
      fulfilment: order.fulfilment as HydratedOrder["fulfilment"],
      preferredTime: String(order.preferred_time),
      notes: String(order.notes),
      lines: lines.map((line) => ({
        item: {
          id: String(line.itemId), name: String(line.name), description: "",
          price: Number(line.unitPrice), category: "food", image: String(line.image || ""),
          width: 1100, height: 733,
        },
        qty: Number(line.qty),
        lineTotal: Number(line.unitPrice) * Number(line.qty),
      })),
      total: Number(order.total),
      payment: { method: "delivery" },
    };
    const receipt = await sendOrderReceipts(hydrated, {
      orderId: String(order.id),
      store: notificationStore(String(order.id)),
    });
    return {
      ok: true,
      orderRef: String(order.order_ref),
      receiptSent: receipt.ok,
      receiptError: receipt.ok ? undefined : "Your order is saved, but its receipt could not be sent.",
    };
  })(request);
}
