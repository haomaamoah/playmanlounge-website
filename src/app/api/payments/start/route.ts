import { NextResponse } from "next/server";
import { site } from "@/lib/content";
import { siteUrl } from "@/lib/mail/config";
import { hydrateOrder, parseOrderRequest } from "@/lib/mail/order";
import { isMomoNetwork, normaliseSubscriberNumber } from "@/lib/payments/networks";
import {
  chargeMomo,
  gatewayConfig,
  initiateCheckout,
  isConfigured,
  newTransactionId,
  type GatewayConfig,
  type PaymentResult,
} from "@/lib/payments/theteller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Best effort throttle so one visitor cannot spray mobile money prompts at
 * other people's phones. It only covers a single server instance, so a hosting
 * rate limit is still the real ceiling.
 */
const recentStarts = new Map<string, number[]>();
const RATE_LIMIT = { windowMs: 60_000, max: 5 };

function throttled(key: string, now = Date.now()) {
  const hits = (recentStarts.get(key) ?? []).filter((at) => now - at < RATE_LIMIT.windowMs);
  hits.push(now);
  recentStarts.set(key, hits);
  if (recentStarts.size > 500) recentStarts.clear();
  return hits.length > RATE_LIMIT.max;
}

function callerKey(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

function fail(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Hosted checkout sends the customer back to the order page, which reads the
 * reference out of the query string. The URL is built here rather than taken
 * from the request so the merchant account cannot be pointed at another site.
 */
async function startCheckout(
  config: GatewayConfig,
  args: {
    transactionId: string;
    total: number;
    name: string;
    email: string;
    /** Set when the prompt was tried first and PaySwitch turned it down. */
    promptRefusal?: PaymentResult;
  }
) {
  const started = await initiateCheckout(config, {
    transactionId: args.transactionId,
    total: args.total,
    description: `${site.name} order for ${args.name}`,
    email: args.email,
    redirectUrl: `${siteUrl()}/`,
  });

  if ("error" in started) {
    // Report the earlier refusal when there was one: it is the real cause.
    const refusal = args.promptRefusal;
    return fail(502, {
      error: refusal?.gatewayIssue
        ? "Mobile money is not switched on for this business yet. Choose pay on delivery, or call the kitchen."
        : started.error,
      code: refusal?.code ?? started.code,
      gatewayIssue: true,
    });
  }

  return NextResponse.json(
    {
      mode: "checkout",
      total: args.total,
      transactionId: args.transactionId,
      checkoutUrl: started.checkoutUrl,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  const config = gatewayConfig();
  if (!isConfigured(config)) {
    return fail(503, {
      error: "Mobile money payment is not configured on this server.",
      gatewayIssue: true,
    });
  }

  if (throttled(callerKey(request))) {
    return fail(429, {
      error: "Too many payment attempts. Wait a minute, or call the kitchen.",
    });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail(400, { error: "Send the order as JSON." });
  }

  // Prices come back off the menu here, so a tampered page cannot decide what
  // an order costs.
  const parsed = parseOrderRequest(raw);
  if (parsed.spam) return fail(400, { error: "Send the order as JSON." });
  if (parsed.errors || !parsed.data) {
    return fail(400, {
      error: Object.values(parsed.errors ?? {})[0] ?? "Fill in the order first.",
    });
  }
  const hydrated = hydrateOrder(parsed.data);
  if (hydrated.errors || !hydrated.order) {
    return fail(400, {
      error: Object.values(hydrated.errors ?? {})[0] ?? "Check the bag and try again.",
    });
  }

  const order = hydrated.order;
  if (order.total > config.maxTotal) {
    return fail(400, {
      error: `Orders over GHS ${config.maxTotal} are arranged by phone.`,
    });
  }

  const body = raw as Record<string, unknown>;
  const expectedTotal = Number(body.expectedTotal);
  if (Number.isFinite(expectedTotal) && Math.round(expectedTotal) !== order.total) {
    return fail(409, {
      error: "Prices changed while you were ordering. Check the new total.",
      total: order.total,
    });
  }

  const transactionId = newTransactionId();

  if (config.flow === "checkout") {
    return startCheckout(config, {
      transactionId,
      total: order.total,
      name: order.name,
      email: order.email,
    });
  }

  if (!isMomoNetwork(body.network)) {
    return fail(400, { error: "Choose a mobile money network." });
  }
  const subscriberNumber = normaliseSubscriberNumber(
    typeof body.momoNumber === "string" ? body.momoNumber : ""
  );
  if (!subscriberNumber) {
    return fail(400, {
      error: "Enter the mobile money number as ten digits, like 0205786433.",
    });
  }
  const voucherCode = (typeof body.voucherCode === "string" ? body.voucherCode : "")
    .replace(/[^0-9a-zA-Z]/g, "")
    .slice(0, 20);

  let result: PaymentResult;
  try {
    result = await chargeMomo(config, {
      transactionId,
      total: order.total,
      network: body.network,
      subscriberNumber,
      description: `${site.name} order for ${order.name}`,
      voucherCode: voucherCode || undefined,
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return fail(502, {
      error: timedOut
        ? "Mobile money did not answer in time. Check your phone before trying again."
        : "Mobile money could not be reached. Try again, or call the kitchen.",
      transactionId,
      retryable: true,
    });
  }

  // Direct debit is a per-merchant permission at PaySwitch. When it is not
  // granted the gateway answers "merchant not found", so the customer is moved
  // to hosted checkout rather than being told the order failed.
  if (result.gatewayIssue && config.flow === "auto") {
    return startCheckout(config, {
      transactionId: newTransactionId(),
      total: order.total,
      name: order.name,
      email: order.email,
      promptRefusal: result,
    });
  }

  return NextResponse.json(
    { mode: "prompt", total: order.total, ...result },
    { headers: { "Cache-Control": "no-store" } }
  );
}
