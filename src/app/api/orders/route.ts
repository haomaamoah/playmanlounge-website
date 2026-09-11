import { NextResponse } from "next/server";
import { formatOrderBody } from "@/lib/email";
import { hydrateOrder, parseOrderRequest } from "@/lib/mail/order";
import { sendOrderReceipts } from "@/lib/mail/send";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
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

  const hydrated = hydrateOrder(parsed.data);
  if (hydrated.errors || !hydrated.order) {
    return NextResponse.json(
      { ok: false, errors: hydrated.errors },
      { status: 400 }
    );
  }

  const sent = await sendOrderReceipts(hydrated.order);
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
  });
}
