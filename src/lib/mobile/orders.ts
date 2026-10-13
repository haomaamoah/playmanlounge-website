import "server-only";
import { formatGhs, pesewas, site } from "../content";
import { getCatalog } from "../db/catalog";
import { notificationStore } from "../db/orders";
import { jsonBody } from "../admin/server";
import { hydrateOrder, formatPlacedAt } from "../mail/order";
import { sendOrderReceipts } from "../mail/send";
import type { HydratedOrder } from "../mail/types";
import { gatewayConfig } from "../payments/theteller";
import type { Customer } from "./auth";
import { LIMITS } from "./constants";
import { mobileOrder } from "./dto";
import { MobileFailure, notFound, validationFailure } from "./errors";
import { requestKeyFor, sameSubmission } from "./idempotency";
import { limit } from "./limits";
import { Reply, ok } from "./reply";
import { db, failed, userClient } from "./supabase";
import { UUID_PATTERN, parseIdempotencyKey, parseMobileOrder, parseOrdersQuery, type MobileOrderInput } from "./validation";

type Row = Record<string, unknown>;

// Exactly the columns the customer role may read (see the migration's column grants).
const ORDER_COLUMNS = "id,order_ref,status,payment_status,fulfilment,preferred_time,notes,total,customer_name,customer_phone,lines,created_at,updated_at";
// The app waits for this response (20 s receive timeout) and serverless functions are billed and limited by it.
const RECEIPT_TIMEOUT_MS = 5000;

/** Receipts always describe the stored order, so a replay carries the original ticket. */
export function receiptOrder(row: Row): HydratedOrder {
  const lines = (Array.isArray(row.lines) ? (row.lines as Row[]) : []).map((line) => {
    const qty = Number(line.qty);
    const price = Number(line.unitPrice);
    return {
      item: {
        id: String(line.itemId),
        name: String(line.name),
        description: "",
        price,
        category: "food" as const,
        image: String(line.image ?? ""),
        width: 1100,
        height: 733,
      },
      qty,
      lineTotal: pesewas(qty * price) / 100,
    };
  });
  return {
    orderRef: String(row.order_ref),
    placedAt: formatPlacedAt(new Date(String(row.created_at))),
    name: String(row.customer_name),
    phone: String(row.customer_phone),
    email: String(row.customer_email),
    fulfilment: row.fulfilment as HydratedOrder["fulfilment"],
    preferredTime: String(row.preferred_time),
    notes: String(row.notes),
    lines,
    total: Number(row.total),
    payment: { method: "delivery" },
  };
}

/**
 * Receipts are best effort: the order is already saved, so an unconfigured or failing mail provider (or a slow one)
 * only turns `receiptSent` false. The delivery ledger makes a retry resend just the missing receipts.
 */
async function deliverReceipts(row: Row): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const orderId = String(row.id);
    const result = await Promise.race([
      sendOrderReceipts(receiptOrder(row), { orderId, store: notificationStore(orderId) }),
      new Promise<{ ok: false }>((resolve) => {
        timer = setTimeout(() => resolve({ ok: false }), RECEIPT_TIMEOUT_MS);
      }),
    ]);
    return result.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function findByRequestKey(requestKey: string): Promise<Row | null> {
  const { data, error } = await db().from("orders").select("*").eq("request_key", requestKey).maybeSingle();
  if (error) throw failed("read order by request key", error);
  return data;
}

async function replay(saved: Row, input: MobileOrderInput) {
  if (!sameSubmission(saved, input)) {
    throw new MobileFailure(409, "That Idempotency-Key was already used for a different order.", { code: "idempotency_conflict" });
  }
  return new Reply(200, { ok: true, order: mobileOrder(saved), receiptSent: await deliverReceipts(saved) });
}

export async function placeOrder(request: Request, customer: Customer): Promise<Reply> {
  await limit(request, "mobile-orders", LIMITS.ordersPerCustomer, customer.id);
  const idempotencyKey = parseIdempotencyKey(request.headers.get("idempotency-key"));
  const input = parseMobileOrder(await jsonBody(request), customer.email);
  const requestKey = requestKeyFor(customer.id, idempotencyKey);

  // A retried request is answered from what was saved, before anything is re-priced against a menu that may have moved.
  const earlier = await findByRequestKey(requestKey);
  if (earlier) return replay(earlier, input);

  const priced = hydrateOrder(
    { name: input.name, phone: input.phone, email: customer.email, fulfilment: input.fulfilment, preferredTime: input.preferredTime, notes: input.storedNotes, lines: input.lines },
    { method: "delivery" },
    await getCatalog(),
  );
  if (priced.errors || !priced.order) throw validationFailure({ lines: priced.errors?.cart ?? "Check the items in your order." });
  const order = priced.order;

  const maxTotal = gatewayConfig().maxTotal;
  if (order.total > maxTotal) {
    throw validationFailure({ lines: `Orders above ${formatGhs(maxTotal)} are taken by phone. Call ${site.phoneDisplay}.` });
  }
  if (input.expectedTotal !== undefined && pesewas(input.expectedTotal) !== pesewas(order.total)) {
    throw new MobileFailure(409, "Prices have changed since you built this order. Review the new total and try again.", {
      code: "price_changed",
      extra: { total: order.total },
    });
  }

  const lines = order.lines.map((line) => ({ itemId: line.item.id, name: line.item.name, qty: line.qty, unitPrice: line.item.price, image: line.item.image }));
  const { data, error } = await db().rpc("create_order", {
    p_order: {
      order_ref: order.orderRef,
      customer_name: order.name,
      customer_email: order.email,
      customer_phone: order.phone,
      fulfilment: order.fulfilment,
      preferred_time: order.preferredTime,
      notes: order.notes,
      total: order.total,
      lines,
      payment_status: "cod",
      transaction_id: null,
      request_key: requestKey,
      // Both come from the verified session on the server, never from the request body.
      customer_id: customer.id,
      source: "mobile",
    },
  });
  if (error || !data) {
    // Two identical requests racing past the lookup: the loser meets the unique request_key and is answered as a replay.
    if (error?.code === "23505") {
      const winner = await findByRequestKey(requestKey);
      if (winner) return replay(winner, input);
    }
    throw failed("create_order (is migration 202610120001 applied?)", error);
  }
  const saved = data as Row;
  return new Reply(201, { ok: true, order: mobileOrder(saved), receiptSent: await deliverReceipts(saved) });
}

export async function listOrders(request: Request, customer: Customer) {
  const { limit: pageSize, before } = parseOrdersQuery(new URL(request.url));
  // The caller's own JWT: Row Level Security re-checks the ownership filter below.
  let query = userClient(customer.jwt)
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false })
    .limit(pageSize + 1);
  if (before) query = query.lt("created_at", before);
  const { data, error } = await query;
  if (error) throw failed("list orders", error);
  const orders = data.slice(0, pageSize).map((row) => mobileOrder(row));
  return ok({ orders, nextBefore: data.length > pageSize ? orders[orders.length - 1].createdAt : null });
}

export async function getOrder(customer: Customer, id: string) {
  // Another customer's order, an unknown id and a malformed id are all the same 404: ownership is never revealed.
  if (!UUID_PATTERN.test(id)) throw notFound("We could not find that order.");
  const { data, error } = await userClient(customer.jwt).from("orders").select(ORDER_COLUMNS).eq("id", id).eq("customer_id", customer.id).maybeSingle();
  if (error) throw failed("read order", error);
  if (!data) throw notFound("We could not find that order.");
  return ok({ order: mobileOrder(data) });
}
