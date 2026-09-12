/**
 * PaySwitch (theTeller) mobile money collection.
 *
 * Docs: https://theteller.net/documentation
 * Charge:   POST {base}/v1.1/transaction/process   processing_code 000200
 * Status:   GET  {base}/v1.1/users/transactions/{transaction_id}/status
 * Checkout: POST {checkoutBase}/initiate
 *
 * The status endpoint needs a `Merchant-Id` header in addition to basic auth;
 * the charge endpoint takes the merchant in the body instead.
 *
 * Server only: the credentials in `gatewayConfig()` must never reach the
 * browser. Nothing here imports a runtime value, so the pure helpers can be
 * unit tested with `npm test`.
 */
import type { MomoNetwork } from "./networks";

export type PaymentState = "paid" | "pending" | "failed";

export type PaymentResult = {
  transactionId: string;
  state: PaymentState;
  code: string;
  message: string;
  /** True when trying again with the same details could still work. */
  retryable: boolean;
  /** True when the failure is our configuration, not the customer's wallet. */
  gatewayIssue: boolean;
};

/**
 * "auto" asks for the in-page mobile money prompt and falls back to hosted
 * checkout when PaySwitch refuses direct debit for this merchant; "prompt" and
 * "checkout" pin one path.
 */
export type PaymentFlow = "auto" | "prompt" | "checkout";

export type GatewayConfig = {
  apiUser: string;
  apiKey: string;
  merchantId: string;
  live: boolean;
  flow: PaymentFlow;
  maxTotal: number;
};

const DEFAULT_MAX_TOTAL = 5000;

export function gatewayConfig(): GatewayConfig {
  const flow = process.env.THETELLER_FLOW?.trim().toLowerCase();
  const maxTotal = Number(process.env.MAX_ORDER_TOTAL);
  return {
    apiUser: process.env.THETELLER_API_USER?.trim() ?? "",
    apiKey: process.env.THETELLER_API_KEY?.trim() ?? "",
    merchantId: process.env.THETELLER_MERCHANT_ID?.trim() ?? "",
    live: process.env.THETELLER_MODE?.trim().toLowerCase() === "live",
    flow: flow === "prompt" || flow === "checkout" ? flow : "auto",
    maxTotal: Number.isFinite(maxTotal) && maxTotal > 0 ? maxTotal : DEFAULT_MAX_TOTAL,
  };
}

export function isConfigured(config: GatewayConfig) {
  return Boolean(config.apiUser && config.apiKey && config.merchantId);
}

export function gatewayBase(config: GatewayConfig) {
  return config.live ? "https://prod.theteller.net" : "https://test.theteller.net";
}

export function checkoutBase(config: GatewayConfig) {
  return config.live
    ? "https://checkout.theteller.net"
    : "https://checkout-test.theteller.net";
}

/** theTeller wants the amount in pesewas, zero padded to twelve digits. */
export function formatAmount(cedis: number) {
  const pesewas = Math.round(cedis * 100);
  if (!Number.isFinite(pesewas) || pesewas <= 0) {
    throw new Error(`Cannot charge ${cedis}`);
  }
  return String(pesewas).padStart(12, "0");
}

/** Unique twelve digit reference. theTeller rejects a reused one with code 909. */
export function newTransactionId(now = Date.now(), random = Math.random) {
  const tail = String(now).slice(-8);
  const head = String(Math.floor(random() * 9000) + 1000);
  return `${head}${tail}`;
}

export function isTransactionId(value: string) {
  return /^[0-9]{6,20}$/.test(value);
}

const codeMap: Record<
  string,
  { state: PaymentState; message: string; retryable?: boolean; gatewayIssue?: boolean }
> = {
  "000": { state: "paid", message: "Payment received." },
  "111": {
    state: "pending",
    message: "Approve the mobile money prompt on your phone.",
  },
  "100": { state: "failed", message: "The wallet declined the payment.", retryable: true },
  "101": { state: "failed", message: "Not enough money in the wallet.", retryable: true },
  "102": {
    state: "failed",
    message: "That number is not registered for mobile money.",
    retryable: true,
  },
  "103": {
    state: "failed",
    message: "Wrong PIN, or the prompt timed out.",
    retryable: true,
  },
  "104": {
    state: "failed",
    message: "The payment was declined or cancelled.",
    retryable: true,
  },
  "105": {
    state: "failed",
    message: "The wallet could not be charged. Try again.",
    retryable: true,
  },
  "107": {
    state: "failed",
    message: "Mobile money is busy right now. Try again in a moment.",
    retryable: true,
  },
  "114": {
    state: "failed",
    message: "That Telecel Cash approval code is not valid.",
    retryable: true,
  },
  "909": {
    state: "failed",
    message: "That payment reference was already used. Try again.",
    retryable: true,
  },
  "600": { state: "failed", message: "Payment access denied.", gatewayIssue: true },
  "979": {
    state: "failed",
    message: "Payment credentials were rejected.",
    gatewayIssue: true,
  },
  "999": {
    state: "failed",
    message: "The payment account is not set up for mobile money yet.",
    gatewayIssue: true,
  },
};

export function describeCode(code: string, fallbackReason?: string) {
  const known = codeMap[code];
  if (known) {
    return {
      state: known.state,
      message: known.message,
      retryable: known.retryable ?? false,
      gatewayIssue: known.gatewayIssue ?? false,
    };
  }
  return {
    state: "failed" as PaymentState,
    message: fallbackReason?.trim()
      ? `${fallbackReason.trim()} (code ${code})`
      : `The payment failed (code ${code}).`,
    retryable: true,
    gatewayIssue: false,
  };
}

/**
 * The status endpoint answers with a word rather than a code once a request has
 * moved on, so both are consulted.
 */
export function describeStatus(status: string, code: string, reason?: string): PaymentState {
  const word = status.trim().toLowerCase();
  if (code === "000" || word === "approved" || word === "success" || word === "successful") {
    return "paid";
  }
  if (code === "111" || word === "pending" || word === "processing" || word === "submitted") {
    return "pending";
  }
  return describeCode(code, reason).state;
}

function authHeader(config: GatewayConfig) {
  return `Basic ${Buffer.from(`${config.apiUser}:${config.apiKey}`).toString("base64")}`;
}

/** theTeller answers with `reason` as a string on some routes, an object on others. */
function readReason(data: Record<string, unknown>) {
  const raw = data.reason ?? data.description ?? data.message;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object") {
    const parts = Object.values(raw as Record<string, unknown>)
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .filter((value): value is string => typeof value === "string");
    if (parts.length) return parts.join(" ");
  }
  return "";
}

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { status: "failed", code: "", reason: text.slice(0, 200) };
  }
}

export type ChargeInput = {
  transactionId: string;
  total: number;
  network: MomoNetwork;
  subscriberNumber: string;
  description: string;
  voucherCode?: string;
};

export async function chargeMomo(
  config: GatewayConfig,
  input: ChargeInput
): Promise<PaymentResult> {
  const body: Record<string, string> = {
    amount: formatAmount(input.total),
    processing_code: "000200",
    transaction_id: input.transactionId,
    desc: input.description.slice(0, 100),
    merchant_id: config.merchantId,
    subscriber_number: input.subscriberNumber,
    "r-switch": input.network,
  };
  if (input.voucherCode) body.voucher_code = input.voucherCode;

  const response = await fetch(`${gatewayBase(config)}/v1.1/transaction/process`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      Authorization: authHeader(config),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });

  const data = await readJson(response);
  const code = String(data.code ?? "");
  const reason = readReason(data);
  return {
    transactionId: String(data.transaction_id ?? input.transactionId),
    code,
    ...describeCode(code, reason),
  };
}

export type CheckoutInput = {
  transactionId: string;
  total: number;
  description: string;
  email: string;
  redirectUrl: string;
};

/**
 * Hosted checkout: PaySwitch returns a payment page we send the customer to,
 * then calls `redirectUrl` back with code, status and transaction_id.
 */
export async function initiateCheckout(
  config: GatewayConfig,
  input: CheckoutInput
): Promise<{ checkoutUrl: string } | { error: string; code: string }> {
  const response = await fetch(`${checkoutBase(config)}/initiate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      Authorization: authHeader(config),
    },
    body: JSON.stringify({
      merchant_id: config.merchantId,
      transaction_id: input.transactionId,
      desc: input.description.slice(0, 100),
      amount: formatAmount(input.total),
      redirect_url: input.redirectUrl,
      email: input.email,
      API_Key: config.apiKey,
      apiuser: config.apiUser,
    }),
    signal: AbortSignal.timeout(25_000),
  });

  const data = await readJson(response);
  const checkoutUrl = typeof data.checkout_url === "string" ? data.checkout_url : "";
  if (checkoutUrl) return { checkoutUrl };
  return {
    error: readReason(data) || "Could not open a payment page.",
    code: String(data.code ?? ""),
  };
}

export async function fetchStatus(
  config: GatewayConfig,
  transactionId: string
): Promise<PaymentResult> {
  const response = await fetch(
    `${gatewayBase(config)}/v1.1/users/transactions/${encodeURIComponent(transactionId)}/status`,
    {
      headers: {
        "Cache-Control": "no-cache",
        Authorization: authHeader(config),
        "Merchant-Id": config.merchantId,
      },
      signal: AbortSignal.timeout(20_000),
    }
  );

  const data = await readJson(response);
  const code = String(data.code ?? "");
  const status = String(data.status ?? "");
  const reason = readReason(data);
  const state = describeStatus(status, code, reason);
  const described = describeCode(code, reason);
  return {
    transactionId,
    code,
    state,
    message: state === "paid" ? "Payment received." : described.message,
    retryable: described.retryable,
    gatewayIssue: described.gatewayIssue,
  };
}
