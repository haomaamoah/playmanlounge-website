/**
 * Play Man Lounge payment service.
 *
 * The website is a static export on GitHub Pages, so it cannot hold the
 * PaySwitch credentials or call the gateway directly (the keys would be public
 * and the browser would be blocked by CORS). This small service is the only
 * place the credentials live. It exposes:
 *
 *   GET  /health             is the service configured, in which mode and flow
 *   POST /pay/start          price the bag, then start a mobile money payment
 *   GET  /pay/status/{id}    poll one transaction until it settles
 *
 * `/pay/start` prefers the in-page mobile money prompt
 * (`/v1.1/transaction/process`). PaySwitch enables that per merchant, so when
 * it answers "merchant not found" the same request falls back to hosted
 * checkout and returns a payment link instead.
 */
import {
  chargeMomo,
  fetchStatus,
  initiateCheckout,
  isConfigured,
  isLive,
  isMomoNetwork,
  newTransactionId,
  normaliseSubscriberNumber,
  paymentFlow,
  priceOrder,
  type Env,
  type MomoNetwork,
  type OrderLine,
  type PaymentResult,
} from "./theteller.ts";

const DEFAULT_MAX_TOTAL = 5000;

function allowedOrigins(env: Env) {
  return (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function corsHeaders(env: Env, request: Request) {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = allowedOrigins(env);
  const headers: Record<string, string> = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
  // With no allowlist the service is open, which keeps local development
  // simple; a deployment should always set ALLOWED_ORIGINS.
  if (allowed.length === 0) headers["Access-Control-Allow-Origin"] = origin || "*";
  else if (allowed.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(env: Env, request: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(env, request),
    },
  });
}

function originRejected(env: Env, request: Request) {
  const allowed = allowedOrigins(env);
  if (allowed.length === 0) return false;
  const origin = request.headers.get("Origin");
  // Same-origin and server-side callers send no Origin header at all.
  return Boolean(origin) && !allowed.includes(origin!);
}

/**
 * PaySwitch sends the customer back to this URL after hosted checkout, so it is
 * checked against the allowlist: an open redirect here would let someone point
 * our merchant account at their own page.
 */
function safeReturnUrl(env: Env, candidate: unknown) {
  if (typeof candidate !== "string" || !candidate) return null;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const allowed = allowedOrigins(env);
  if (allowed.length > 0 && !allowed.includes(url.origin)) return null;
  return url.toString();
}

/**
 * Best effort throttle so one visitor cannot spray mobile money prompts at
 * other people's phones. It only covers a single isolate; put a Cloudflare rate
 * limiting rule in front of the worker for the real ceiling.
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

type StartBody = {
  lines?: OrderLine[];
  expectedTotal?: number;
  network?: string;
  momoNumber?: string;
  voucherCode?: string;
  returnUrl?: string;
  customer?: { name?: string; phone?: string; email?: string };
};

type StartedPayment =
  | ({ mode: "prompt"; total: number } & PaymentResult)
  | { mode: "checkout"; total: number; transactionId: string; checkoutUrl: string };

async function startCheckout(
  env: Env,
  request: Request,
  args: {
    transactionId: string;
    total: number;
    name: string;
    email: string;
    returnUrl: string | null;
    /** Set when the prompt was tried first and PaySwitch turned it down. */
    promptRefusal?: PaymentResult;
  }
) {
  if (!args.returnUrl) {
    return json(env, request, 400, {
      error: "This site is not allowed to send customers to the payment page.",
      gatewayIssue: true,
    });
  }

  const started = await initiateCheckout(env, {
    transactionId: args.transactionId,
    total: args.total,
    description: `Play Man Lounge order for ${args.name}`,
    email: args.email,
    redirectUrl: args.returnUrl,
  });

  if ("error" in started) {
    // Report the earlier refusal when there was one: it is the real cause.
    const refusal = args.promptRefusal;
    return json(env, request, 502, {
      error: refusal?.gatewayIssue
        ? "Mobile money is not switched on for this business yet. Choose pay on delivery, or call the kitchen."
        : started.error,
      code: refusal?.code ?? started.code,
      gatewayIssue: true,
    });
  }

  const body: StartedPayment = {
    mode: "checkout",
    total: args.total,
    transactionId: args.transactionId,
    checkoutUrl: started.checkoutUrl,
  };
  return json(env, request, 200, body);
}

async function handleStart(env: Env, request: Request) {
  if (!isConfigured(env)) {
    return json(env, request, 503, {
      error: "Mobile money payment is not configured on this server.",
      gatewayIssue: true,
    });
  }

  const ip = request.headers.get("CF-Connecting-IP") ?? "local";
  if (throttled(ip)) {
    return json(env, request, 429, {
      error: "Too many payment attempts. Wait a minute, or call the kitchen.",
    });
  }

  let body: StartBody;
  try {
    body = (await request.json()) as StartBody;
  } catch {
    return json(env, request, 400, { error: "Send the order as JSON." });
  }

  const maxTotal = Number(env.MAX_ORDER_TOTAL ?? DEFAULT_MAX_TOTAL) || DEFAULT_MAX_TOTAL;
  const priced = priceOrder(body.lines ?? [], maxTotal);
  if ("error" in priced) return json(env, request, 400, { error: priced.error });

  if (
    typeof body.expectedTotal === "number" &&
    Math.round(body.expectedTotal) !== priced.total
  ) {
    return json(env, request, 409, {
      error: "Prices changed while you were ordering. Check the new total.",
      total: priced.total,
    });
  }

  const name = (body.customer?.name ?? "").trim().slice(0, 60);
  if (!name) return json(env, request, 400, { error: "Enter the name on the order." });
  const email = (body.customer?.email ?? "").trim().slice(0, 120);
  if (!email) return json(env, request, 400, { error: "Enter an email for the receipt." });

  const transactionId = newTransactionId();
  const returnUrl = safeReturnUrl(env, body.returnUrl);
  const flow = paymentFlow(env);

  if (flow === "checkout") {
    return startCheckout(env, request, {
      transactionId,
      total: priced.total,
      name,
      email,
      returnUrl,
    });
  }

  if (!isMomoNetwork(body.network)) {
    return json(env, request, 400, { error: "Choose a mobile money network." });
  }
  const network: MomoNetwork = body.network;

  const subscriberNumber = normaliseSubscriberNumber(body.momoNumber ?? "");
  if (!subscriberNumber) {
    return json(env, request, 400, {
      error: "Enter the mobile money number as ten digits, like 0547539942.",
    });
  }

  const voucherCode = (body.voucherCode ?? "").replace(/[^0-9a-zA-Z]/g, "").slice(0, 20);

  let result: PaymentResult;
  try {
    result = await chargeMomo(env, {
      transactionId,
      total: priced.total,
      network,
      subscriberNumber,
      description: `Play Man Lounge order for ${name}`,
      voucherCode: voucherCode || undefined,
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return json(env, request, 502, {
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
  if (result.gatewayIssue && flow === "auto") {
    return startCheckout(env, request, {
      transactionId: newTransactionId(),
      total: priced.total,
      name,
      email,
      returnUrl,
      promptRefusal: result,
    });
  }

  const started: StartedPayment = { mode: "prompt", total: priced.total, ...result };
  return json(env, request, 200, started);
}

async function handleStatus(env: Env, request: Request, transactionId: string) {
  if (!isConfigured(env)) {
    return json(env, request, 503, {
      error: "Mobile money payment is not configured on this server.",
      gatewayIssue: true,
    });
  }
  if (!/^[0-9]{6,20}$/.test(transactionId)) {
    return json(env, request, 400, { error: "Unknown payment reference." });
  }
  try {
    return json(env, request, 200, await fetchStatus(env, transactionId));
  } catch {
    return json(env, request, 502, {
      error: "Could not read the payment status. Try again in a moment.",
      transactionId,
      retryable: true,
    });
  }
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(env, request) });
  }
  if (originRejected(env, request)) {
    return json(env, request, 403, { error: "This site cannot take payments here." });
  }

  if (request.method === "GET" && url.pathname === "/health") {
    return json(env, request, 200, {
      ok: true,
      configured: isConfigured(env),
      mode: isLive(env) ? "live" : "test",
      flow: paymentFlow(env),
    });
  }

  if (request.method === "POST" && url.pathname === "/pay/start") {
    return handleStart(env, request);
  }

  const status = url.pathname.match(/^\/pay\/status\/([^/]+)$/);
  if (request.method === "GET" && status) {
    return handleStatus(env, request, decodeURIComponent(status[1]));
  }

  return json(env, request, 404, { error: "Not found." });
}
