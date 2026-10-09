import { NextResponse } from "next/server";
import { formatOrderBody } from "@/lib/email";
import { hydrateOrder, parseOrderRequest } from "@/lib/mail/order";
import { sendOrderReceipts } from "@/lib/mail/send";
import { readPaymentRequest, verifyPayment } from "@/lib/payments/verify";
import { getCatalog } from "@/lib/db/catalog";
import { notificationStore, submitPersistedOrder } from "@/lib/db/orders";
import { checkOrigin, jsonBody, rateLimit } from "@/lib/admin/server";
import { ApiFailure } from "@/lib/admin/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    await rateLimit(request,"orders",20,3600);
    return await submit(request);
  } catch (error) {
    const status = error instanceof ApiFailure ? error.status : 503;
    // Database outages are never receipt failures: the order was not accepted.
    return NextResponse.json({ok:false,persisted:false,reason:status >= 500 ? "database" : "rejected",
      error:error instanceof ApiFailure && status < 500 ? error.message : "Order storage is unavailable. Your order was not placed; try again later or call the kitchen."},
      {status});
  }
}

async function submit(request: Request) {
  let raw: unknown;
  try {
    raw = await jsonBody(request);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Send the order as JSON." },
      { status: 400 }
    );
  }

  const parsed = parseOrderRequest(raw);
  if (parsed.spam) {
    return NextResponse.json({ ok: true, via: "ignored" });
  }
  if (parsed.errors || !parsed.data) {
    return NextResponse.json(
      { ok: false, errors: parsed.errors },
      { status: 400 }
    );
  }

  // The browser says which way the customer paid; PaySwitch says whether the
  // money actually arrived.
  const payment = await verifyPayment(readPaymentRequest(raw));

  const hydrated = hydrateOrder(parsed.data, payment, await getCatalog());
  if (hydrated.errors || !hydrated.order) {
    return NextResponse.json(
      { ok: false, errors: hydrated.errors },
      { status: 400 }
    );
  }

  const requestKey = request.headers.get("idempotency-key") ?? undefined;
  if (requestKey && !/^[a-zA-Z0-9-]{16,100}$/.test(requestKey)) throw new ApiFailure(400,"Invalid idempotency key.");
  const saved = await submitPersistedOrder(hydrated.order,payment,requestKey);
  const sent = await sendOrderReceipts(hydrated.order,{orderId:saved.id,store:notificationStore(saved.id)});
  if (!sent.ok) {
    const status = sent.reason === "no-provider" ? 503 : 502;
    return NextResponse.json(
      {
        ok: false,
        reason: sent.reason,
        error:
          sent.reason === "no-provider"
            ? "Order email is not configured on the server yet."
            : "The receipt emails did not send.",
        persisted: true,
        orderId: saved.id,
        fallbackBody: formatOrderBody({
          ...hydrated.order,
          lines: hydrated.order.lines,
        }),
      },
      { status }
    );
  }

  return NextResponse.json({
    ok: true,
    via: sent.via,
    orderRef: sent.orderRef,
    total: hydrated.order.total,
    orderId: saved.id,
    payment: {
      method: payment.method,
      state: payment.method === "momo" ? payment.state : undefined,
    },
  });
}
