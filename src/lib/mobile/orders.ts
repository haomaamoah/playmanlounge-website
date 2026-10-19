import "server-only";
import { formatGhs, pesewas, site } from "../content";
import { getCatalog } from "../db/catalog";
import { getNearestKitchenId, notificationStore } from "../db/orders";
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
import { chargeOrder, checkPayment, newTransactionId, paymentView, requireMobileMoney, supersedePayment, updatePayment, type MobilePaymentView } from "./payments";
import { Reply, ok } from "./reply";
import { db, failed, userClient } from "./supabase";
import { computeDrivingRoute } from "../maps/google-routes";
import { hasActiveRiderTracking } from "../riders/privacy";
import { UUID_PATTERN, parseIdempotencyKey, parseMobileOrder, parseOrdersQuery, parsePaymentRetry, type MobileOrderInput, type MobilePayment } from "./validation";

type Row = Record<string, unknown>;

// Exactly the columns the customer role may read (see the migration's column grants).
const ORDER_COLUMNS = "id,order_ref,status,payment_status,fulfilment,preferred_time,notes,total,customer_name,customer_phone,lines,delivery_address,delivery_latitude,delivery_longitude,rider_id,rider_delivery_status,created_at,updated_at";
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
    deliveryAddress: String(row.delivery_address ?? ""),
    deliveryLatitude: typeof row.delivery_latitude === "number" ? row.delivery_latitude : null,
    deliveryLongitude: typeof row.delivery_longitude === "number" ? row.delivery_longitude : null,
    lines,
    total: Number(row.total),
    payment:
      row.payment_status === "cod" || !row.transaction_id
        ? { method: "delivery" }
        : { method: "momo", state: row.payment_status === "paid" ? "paid" : "pending", reference: String(row.transaction_id) },
  };
}

/** Receipts go out once the kitchen should cook: pay on delivery straight away, mobile money once it is paid. */
const receiptDue = (row: Row) => row.payment_status === "cod" || row.payment_status === "paid";

/**
 * Receipts are best effort: the order is already saved, so an unconfigured or failing mail provider (or a slow one)
 * only turns `receiptSent` false. The delivery ledger makes a retry resend just the missing receipts.
 */
async function deliverReceipts(row: Row): Promise<boolean> {
  if (!receiptDue(row)) return false;
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
  // A replay never opens a second wallet prompt; the app polls the payment endpoint instead.
  return new Reply(200, { ok: true, order: mobileOrder(saved), payment: paymentView(saved), receiptSent: await deliverReceipts(saved) });
}

export async function placeOrder(request: Request, customer: Customer): Promise<Reply> {
  await limit(request, "mobile-orders", LIMITS.ordersPerCustomer, customer.id);
  const idempotencyKey = parseIdempotencyKey(request.headers.get("idempotency-key"));
  const input = parseMobileOrder(await jsonBody(request), customer.email);
  if (input.payment.method === "momo") requireMobileMoney();
  const requestKey = requestKeyFor(customer.id, idempotencyKey);

  // A retried request is answered from what was saved, before anything is re-priced against a menu that may have moved.
  const earlier = await findByRequestKey(requestKey);
  if (earlier) return replay(earlier, input);

  const priced = hydrateOrder(
    { name: input.name, phone: input.phone, email: customer.email, fulfilment: input.fulfilment,
      preferredTime: input.preferredTime, notes: input.storedNotes, deliveryAddress:input.deliveryAddress,
      deliveryLatitude:input.deliveryLatitude ?? undefined,deliveryLongitude:input.deliveryLongitude ?? undefined,lines: input.lines },
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
      delivery_address:input.deliveryAddress,
      delivery_latitude:input.deliveryLatitude,
      delivery_longitude:input.deliveryLongitude,
      kitchen_id:await getNearestKitchenId(input.deliveryLatitude,input.deliveryLongitude),
      total: order.total,
      lines,
      payment_status: input.payment.method === "momo" ? "pending" : "cod",
      transaction_id: input.payment.method === "momo" ? newTransactionId() : null,
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
  let saved = data as Row;
  let payment = paymentView(saved);
  if (input.payment.method === "momo") {
    // The order is already saved, so a gateway problem from here on is reported on the payment, never as a failed order.
    payment = await chargeSaved(request, customer, saved, input.payment);
    saved = await ownedOrder(customer, String(saved.id));
  }
  return new Reply(201, { ok: true, order: mobileOrder(saved), payment, receiptSent: await deliverReceipts(saved) });
}

async function chargeSaved(request: Request, customer: Customer, row: Row, wallet: Extract<MobilePayment, { method: "momo" }>): Promise<MobilePaymentView> {
  try {
    await limit(request, "mobile-payment-wallet", LIMITS.paymentPerWallet, wallet.momoNumber);
    return await chargeOrder(row, wallet);
  } catch (error) {
    if (error instanceof MobileFailure && error.code === "rate_limited") {
      // No prompt was sent, so the attempt is definitively over and the order can be retried or switched later.
      await updatePayment(String(row.transaction_id), "failed").catch(() => undefined);
      return { state: "failed", message: "Too many payment attempts on this number. Try again later, or pay on delivery." };
    }
    return { state: "pending", message: "Mobile money could not be reached. Check your phone before trying again, or call the kitchen." };
  }
}

/** Service-role read scoped to the caller: another customer's order is indistinguishable from a missing one. */
async function ownedOrder(customer: Customer, id: string): Promise<Row> {
  if (!UUID_PATTERN.test(id)) throw notFound("We could not find that order.");
  const { data, error } = await db().from("orders").select("*").eq("id", id).eq("customer_id", customer.id).maybeSingle();
  if (error) throw failed("read order", error);
  if (!data) throw notFound("We could not find that order.");
  return data;
}

/** `GET /api/mobile/orders/{id}/payment`: re-checks a pending mobile money attempt with PaySwitch. */
export async function getPayment(request: Request, customer: Customer, id: string) {
  await limit(request, "mobile-payment-status", LIMITS.paymentStatusPerCustomer, customer.id);
  let row = await ownedOrder(customer, id);
  const wasPending = row.payment_status === "pending";
  const message = await checkPayment(row);
  if (wasPending) row = await ownedOrder(customer, id);
  const receiptSent = wasPending && row.payment_status === "paid" ? await deliverReceipts(row) : false;
  return ok({ order: mobileOrder(row), payment: paymentView(row, row.payment_status === "pending" ? message : ""), receiptSent });
}

/**
 * `POST /api/mobile/orders/{id}/payment`: after a failed attempt only, either a fresh wallet prompt on the same
 * order or a switch to pay on delivery. A pending attempt may still debit the wallet, so it is never replaced here.
 */
export async function retryPayment(request: Request, customer: Customer, id: string) {
  await limit(request, "mobile-payment", LIMITS.paymentPerCustomer, customer.id);
  const payment = parsePaymentRetry(await jsonBody(request));
  const row = await ownedOrder(customer, id);
  if (row.payment_status !== "failed") {
    throw new MobileFailure(409, row.payment_status === "pending"
      ? "This payment is still waiting for approval. Check your phone."
      : "This order no longer needs a payment.", { code: "payment_conflict", extra: { order: mobileOrder(row), payment: paymentView(row) } });
  }

  if (payment.method === "delivery") {
    const { data, error } = await db().from("orders").update({ payment_status: "cod" })
      .eq("id", id).eq("customer_id", customer.id).eq("payment_status", "failed").select("*").maybeSingle();
    if (error) throw failed("switch to pay on delivery", error);
    if (!data) throw new MobileFailure(409, "This order changed. Pull to refresh.", { code: "payment_conflict" });
    return ok({ order: mobileOrder(data), payment: paymentView(data), receiptSent: await deliverReceipts(data) });
  }

  requireMobileMoney();
  const attemptId = newTransactionId();
  let fresh: Row;
  try {
    await supersedePayment(String(row.transaction_id), attemptId);
    fresh = await ownedOrder(customer, id);
  } catch {
    throw new MobileFailure(409, "This order changed. Pull to refresh.", { code: "payment_conflict" });
  }
  const view = await chargeSaved(request, customer, fresh, payment);
  const saved = await ownedOrder(customer, id);
  return ok({ order: mobileOrder(saved), payment: view, receiptSent: await deliverReceipts(saved) });
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
  const page = await customerOrdersRiders(data.slice(0, pageSize));
  const orders = page.map((row) => mobileOrder(row));
  return ok({ orders, nextBefore: data.length > pageSize ? orders[orders.length - 1].createdAt : null });
}

export async function getOrder(customer: Customer, id: string) {
  // Another customer's order, an unknown id and a malformed id are all the same 404: ownership is never revealed.
  if (!UUID_PATTERN.test(id)) throw notFound("We could not find that order.");
  const { data, error } = await userClient(customer.jwt).from("orders").select(ORDER_COLUMNS).eq("id", id).eq("customer_id", customer.id).maybeSingle();
  if (error) throw failed("read order", error);
  if (!data) throw notFound("We could not find that order.");
  const [row] = await customerOrdersRiders([data]);
  return ok({ order: mobileOrder(row) });
}

async function customerOrdersRiders(rows: Row[]): Promise<Row[]> {
  const riderIds = [...new Set(rows.flatMap((row) =>
    typeof row.rider_id === "string" ? [row.rider_id] : [],
  ))];
  const activeRiderIds = [...new Set(rows.flatMap((row) =>
    typeof row.rider_id === "string" &&
      hasActiveRiderTracking(row.rider_delivery_status)
      ? [row.rider_id]
      : [],
  ))];
  if (riderIds.length === 0) {
    return rows.map((row) => ({ ...row, rider: null, rider_location: null }));
  }
  const [profiles, locations] = await Promise.all([
    db().from("rider_profiles").select("id,name,phone,bike_model,bike_color,license_plate").in("id", riderIds),
    activeRiderIds.length
      ? db().from("rider_locations").select("rider_id,latitude,longitude,updated_at").in("rider_id", activeRiderIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profiles.error) throw failed("read assigned riders", profiles.error);
  if (locations.error) throw failed("read assigned rider locations", locations.error);
  const profilesById = new Map((profiles.data ?? []).map((profile) => [String(profile.id), profile]));
  const locationsById = new Map((locations.data ?? []).map((location) => [String(location.rider_id), location]));
  return rows.map((row) => {
    const riderId = typeof row.rider_id === "string" ? row.rider_id : null;
    const profile = riderId ? profilesById.get(riderId) : null;
    const isActiveDelivery = hasActiveRiderTracking(row.rider_delivery_status);
    const location = riderId && isActiveDelivery ? locationsById.get(riderId) : null;
    return {
      ...row,
      rider: profile ? {
        id: String(profile.id),
        name: String(profile.name),
        phone: String(profile.phone),
        bikeModel: String(profile.bike_model ?? ""),
        bikeColor: String(profile.bike_color ?? ""),
        licensePlate: String(profile.license_plate ?? ""),
      } : null,
      rider_location: location ? {
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        updatedAt: isoLocationTime(location.updated_at),
      } : null,
    };
  });
}

function isoLocationTime(value: unknown) {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw failed("parse assigned rider location timestamp");
  return date.toISOString();
}

export async function customerRiderRoute(customer: Customer, id: string) {
  if (!UUID_PATTERN.test(id)) throw notFound("We could not find that order.");
  const { data, error } = await userClient(customer.jwt).from("orders")
    .select("id,rider_id,rider_delivery_status,fulfilment,delivery_latitude,delivery_longitude")
    .eq("id", id).eq("customer_id", customer.id).maybeSingle();
  if (error) throw failed("read customer rider route", error);
  if (!data) throw notFound("We could not find that order.");
  if (data.fulfilment !== "delivery" || !data.rider_id ||
      !hasActiveRiderTracking(data.rider_delivery_status)) {
    throw new MobileFailure(409, "This order does not have an active rider to track.", { code: "rider_unavailable" });
  }
  if (typeof data.delivery_latitude !== "number" || typeof data.delivery_longitude !== "number") {
    throw new MobileFailure(409, "Delivery GPS coordinates are missing.", { code: "missing_delivery_location" });
  }
  const { data: location, error: locationError } = await db().from("rider_locations")
    .select("latitude,longitude").eq("rider_id", data.rider_id).maybeSingle();
  if (locationError) throw failed("read customer-visible rider location", locationError);
  if (!location) throw new MobileFailure(409, "The rider location is not available yet.", { code: "rider_location_unavailable" });
  const apiKey = process.env.GOOGLE_ROUTES_API_KEY;
  if (!apiKey) throw new MobileFailure(503, "Google Routes is not configured.", { code: "route_unavailable" });
  const route = await computeDrivingRoute(apiKey, {
    latitude: Number(location.latitude), longitude: Number(location.longitude),
  }, {
    latitude: data.delivery_latitude, longitude: data.delivery_longitude,
  });
  return ok({ route });
}
