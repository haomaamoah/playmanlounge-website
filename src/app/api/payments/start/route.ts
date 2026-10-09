import { NextResponse } from "next/server";
import { pesewas, site } from "@/lib/content";
import { siteUrl } from "@/lib/mail/config";
import { hydrateOrder, parseOrderRequest } from "@/lib/mail/order";
import { isMomoNetwork, normaliseSubscriberNumber } from "@/lib/payments/networks";
import { getCatalog } from "@/lib/db/catalog";
import { persistOrder, supersedePayment, updatePayment } from "@/lib/db/orders";
import { nextAfterCharge } from "@/lib/payments/fallback";
import type { HydratedOrder } from "@/lib/mail/types";
import { checkOrigin, jsonBody, rateLimit } from "@/lib/admin/server";
import { ApiFailure } from "@/lib/admin/validation";
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

function fail(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Hosted checkout sends the customer back to the order page, which reads the
 * reference out of the query string. The URL is built here rather than taken
 * from the request so the merchant account cannot be pointed at another site.
 * PaySwitch refuses a return address it cannot reach, so a localhost `SITE_URL`
 * is rejected before the gateway is called.
 */
function publicReturnUrl() {
  let url: URL;
  try {
    url = new URL(siteUrl());
  } catch {
    return null;
  }
  const local =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname.endsWith(".local");
  if (url.protocol !== "https:" || local) return null;
  return `${url.origin}/`;
}

async function startCheckout(
  config: GatewayConfig,
  args: {
    transactionId: string;
    total: number;
    name: string;
    email: string;
    /** Set when the prompt was tried first and PaySwitch turned it down. */
    promptRefusal?: PaymentResult;
    /** The refused direct-charge attempt this checkout replaces on the same order. */
    supersedes?: string;
    order: HydratedOrder;
  }
) {
  const redirectUrl = publicReturnUrl();
  if (!redirectUrl) {
    // The direct refusal was definitive and no checkout can replace it.
    if (args.supersedes) await updatePayment(args.supersedes,"failed");
    return fail(503, {
      error:
        "Paying online is not available on this address. Choose pay on delivery, or call the kitchen.",
      gatewayIssue: true,
    });
  }

  if (args.supersedes) await supersedePayment(args.supersedes,args.transactionId);
  else await persistOrder(args.order,args.transactionId);
  const started = await initiateCheckout(config, {
    transactionId: args.transactionId,
    total: args.total,
    description: `${site.name} order for ${args.name}`,
    email: args.email,
    redirectUrl,
  });

  if ("error" in started) {
    // No payment page exists for this reference, so it can never be paid.
    await updatePayment(args.transactionId,"failed");
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
  try {
    checkOrigin(request);
    await rateLimit(request,"payment-start",5,60);
    return await start(request);
  } catch (error) {
    return fail(error instanceof ApiFailure ? error.status : 503,{
      error:error instanceof ApiFailure ? error.message : "Payment storage is unavailable. Do not retry a charge without checking your phone.",
    });
  }
}

async function start(request: Request) {
  const config = gatewayConfig();
  if (!isConfigured(config)) {
    return fail(503, {
      error: "Mobile money payment is not configured on this server.",
      gatewayIssue: true,
    });
  }

  let raw: unknown;
  try {
    raw = await jsonBody(request);
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
  const hydrated = hydrateOrder(parsed.data,undefined,await getCatalog());
  if (hydrated.errors || !hydrated.order) {
    return fail(400, {
      error: Object.values(hydrated.errors ?? {})[0] ?? "Check the bag and try again.",
    });
  }

  const order = hydrated.order;
  if (order.total > config.maxTotal) {
    return fail(400, {
      error: `Orders over GH₵ ${config.maxTotal} are arranged by phone.`,
    });
  }

  const body = raw as Record<string, unknown>;
  const expectedTotal = Number(body.expectedTotal);
  if (
    Number.isFinite(expectedTotal) &&
    pesewas(expectedTotal) !== pesewas(order.total)
  ) {
    return fail(409, {
      error: "Prices changed while you were ordering. Check the new total.",
      total: order.total,
    });
  }

  const transactionId = newTransactionId();
  const subscriberNumber = normaliseSubscriberNumber(
    typeof body.momoNumber === "string" ? body.momoNumber : ""
  );
  const network = body.network;
  const hasWallet = isMomoNetwork(network) && Boolean(subscriberNumber);
  if (config.flow === "prompt" && !hasWallet) {
    return fail(400, { error: "Enter a valid mobile money number and network." });
  }
  if (subscriberNumber) await rateLimit(request,"payment-wallet",5,900,subscriberNumber);
  // Hosted checkout collects the wallet itself; "auto" also uses it for older
  // pages that do not send wallet details.
  if (config.flow === "checkout" || !isMomoNetwork(network) || !subscriberNumber) {
    return startCheckout(config, {
      transactionId,
      total: order.total,
      name: order.name,
      email: order.email,
      order,
    });
  }
  const voucherCode = (typeof body.voucherCode === "string" ? body.voucherCode : "")
    .replace(/[^0-9a-zA-Z]/g, "")
    .slice(0, 20);

  await persistOrder(order,transactionId);
  let outcome: { result: PaymentResult } | { error: unknown };
  try {
    outcome = { result: await chargeMomo(config, {
      transactionId,
      total: order.total,
      network,
      subscriberNumber,
      description: `${site.name} order for ${order.name}`,
      voucherCode: voucherCode || undefined,
    }) };
  } catch (error) {
    outcome = { error };
  }

  const next = nextAfterCharge(config.flow, outcome);
  if (next === "await") {
    // The prompt may still reach the phone; never open a second charge. The
    // client polls the status endpoint, which asks PaySwitch for the outcome.
    return NextResponse.json(
      { mode: "prompt", total: order.total, transactionId, state: "pending", code: "",
        message: "Mobile money did not answer in time. Check your phone to approve the payment.",
        retryable: false, gatewayIssue: false },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
  if (next === "unreachable" || !("result" in outcome)) {
    return fail(502, {
      error: "Mobile money could not be reached. Check your phone before trying again, or call the kitchen.",
      transactionId,
      retryable: false,
    });
  }
  const result = outcome.result;

  // Direct debit is a per-merchant permission at PaySwitch. When it is not
  // granted the gateway refuses outright, so the same order moves to hosted
  // checkout rather than being told the order failed.
  if (next === "checkout") {
    return startCheckout(config, {
      transactionId: newTransactionId(),
      total: order.total,
      name: order.name,
      email: order.email,
      promptRefusal: result,
      supersedes: transactionId,
      order,
    });
  }

  await updatePayment(transactionId,result.state,result.gatewayIssue);
  return NextResponse.json(
    { mode: "prompt", total: order.total, ...result },
    { headers: { "Cache-Control": "no-store" } }
  );
}
