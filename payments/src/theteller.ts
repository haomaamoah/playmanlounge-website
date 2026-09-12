/**
 * PaySwitch (theTeller) mobile money collection.
 *
 * Docs: https://theteller.net/documentation
 * Charge:  POST {base}/v1.1/transaction/process   processing_code 000200
 * Status:  GET  {base}/v1.1/users/transactions/{transaction_id}/status
 *
 * The status endpoint needs a `Merchant-Id` header in addition to basic auth;
 * the charge endpoint takes the merchant in the body instead.
 */
import prices from "../prices.json" with { type: "json" };

export type MomoNetwork = "MTN" | "VDF" | "ATL";

export const momoNetworks: { code: MomoNetwork; label: string }[] = [
  { code: "MTN", label: "MTN MoMo" },
  { code: "VDF", label: "Telecel Cash" },
  { code: "ATL", label: "AirtelTigo Money" },
];

export function isMomoNetwork(value: unknown): value is MomoNetwork {
  return momoNetworks.some((network) => network.code === value);
}

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

export type Env = {
  THETELLER_API_USER?: string;
  THETELLER_API_KEY?: string;
  THETELLER_MERCHANT_ID?: string;
  /** "test" (default) hits test.theteller.net, "live" hits prod.theteller.net. */
  THETELLER_MODE?: string;
  /**
   * "auto" (default) asks for the in-page mobile money prompt and falls back to
   * hosted checkout when PaySwitch refuses direct debit for this merchant;
   * "prompt" and "checkout" pin one path.
   */
  THETELLER_FLOW?: string;
  ALLOWED_ORIGINS?: string;
  MAX_ORDER_TOTAL?: string;
};

export type PaymentFlow = "auto" | "prompt" | "checkout";

export function paymentFlow(env: Env): PaymentFlow {
  const value = env.THETELLER_FLOW?.trim().toLowerCase();
  return value === "prompt" || value === "checkout" ? value : "auto";
}

export function isLive(env: Env) {
  return env.THETELLER_MODE?.trim().toLowerCase() === "live";
}

export function gatewayBase(env: Env) {
  return isLive(env) ? "https://prod.theteller.net" : "https://test.theteller.net";
}

export function checkoutBase(env: Env) {
  return isLive(env)
    ? "https://checkout.theteller.net"
    : "https://checkout-test.theteller.net";
}

export function isConfigured(env: Env) {
  return Boolean(
    env.THETELLER_API_USER?.trim() &&
      env.THETELLER_API_KEY?.trim() &&
      env.THETELLER_MERCHANT_ID?.trim()
  );
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

/**
 * Ghanaian wallets are entered as 0XXXXXXXXX but the gateway samples use the
 * international form, so everything is normalised to 233XXXXXXXXX.
 */
export function normaliseSubscriberNumber(input: string) {
  const digits = input.replace(/[^0-9]/g, "");
  if (/^0[0-9]{9}$/.test(digits)) return `233${digits.slice(1)}`;
  if (/^233[0-9]{9}$/.test(digits)) return digits;
  if (/^[0-9]{9}$/.test(digits)) return `233${digits}`;
  return null;
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

export type OrderLine = { id: string; qty: number };

export type PricedOrder = {
  total: number;
  lines: { id: string; name: string; qty: number; price: number }[];
};

/**
 * Totals are recomputed here from `prices.json` so a tampered page cannot
 * decide what an order costs. Keep the file in step with the site menu by
 * running `npm run sync:prices` in this directory.
 */
export function priceOrder(lines: OrderLine[], maxTotal: number): PricedOrder | { error: string } {
  if (!Array.isArray(lines) || lines.length === 0) return { error: "The order is empty." };
  if (lines.length > 40) return { error: "That is too many different items for one order." };

  const priced: PricedOrder["lines"] = [];
  for (const line of lines) {
    const entry = (prices as Record<string, { name: string; price: number }>)[line.id];
    if (!entry) return { error: `We no longer sell "${line.id}".` };
    if (!Number.isInteger(line.qty) || line.qty < 1 || line.qty > 50) {
      return { error: `Choose between 1 and 50 of ${entry.name}.` };
    }
    priced.push({ id: line.id, name: entry.name, qty: line.qty, price: entry.price });
  }

  const total = priced.reduce((sum, line) => sum + line.qty * line.price, 0);
  if (total <= 0) return { error: "The order total is empty." };
  if (total > maxTotal) {
    return { error: `Orders over GHS ${maxTotal} are arranged by phone.` };
  }
  return { total, lines: priced };
}

function authHeader(env: Env) {
  const raw = `${env.THETELLER_API_USER?.trim()}:${env.THETELLER_API_KEY?.trim()}`;
  return `Basic ${btoa(raw)}`;
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

export async function chargeMomo(env: Env, input: ChargeInput): Promise<PaymentResult> {
  const body: Record<string, string> = {
    amount: formatAmount(input.total),
    processing_code: "000200",
    transaction_id: input.transactionId,
    desc: input.description.slice(0, 100),
    merchant_id: env.THETELLER_MERCHANT_ID!.trim(),
    subscriber_number: input.subscriberNumber,
    "r-switch": input.network,
  };
  if (input.voucherCode) body.voucher_code = input.voucherCode;

  const response = await fetch(`${gatewayBase(env)}/v1.1/transaction/process`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      Authorization: authHeader(env),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });

  const data = await readJson(response);
  const code = String(data.code ?? "");
  const reason = String(data.reason ?? data.description ?? "");
  const described = describeCode(code, reason);
  return {
    transactionId: String(data.transaction_id ?? input.transactionId),
    code,
    ...described,
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
  env: Env,
  input: CheckoutInput
): Promise<{ checkoutUrl: string } | { error: string; code: string }> {
  const apiUser = env.THETELLER_API_USER!.trim();
  const apiKey = env.THETELLER_API_KEY!.trim();

  const response = await fetch(`${checkoutBase(env)}/initiate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      Authorization: authHeader(env),
    },
    body: JSON.stringify({
      merchant_id: env.THETELLER_MERCHANT_ID!.trim(),
      transaction_id: input.transactionId,
      desc: input.description.slice(0, 100),
      amount: formatAmount(input.total),
      redirect_url: input.redirectUrl,
      email: input.email,
      API_Key: apiKey,
      apiuser: apiUser,
    }),
    signal: AbortSignal.timeout(25_000),
  });

  const data = await readJson(response);
  const checkoutUrl = typeof data.checkout_url === "string" ? data.checkout_url : "";
  if (checkoutUrl) return { checkoutUrl };
  return {
    error: String(data.reason ?? data.description ?? "Could not open a payment page."),
    code: String(data.code ?? ""),
  };
}

export async function fetchStatus(env: Env, transactionId: string): Promise<PaymentResult> {
  const response = await fetch(
    `${gatewayBase(env)}/v1.1/users/transactions/${encodeURIComponent(transactionId)}/status`,
    {
      headers: {
        "Cache-Control": "no-cache",
        Authorization: authHeader(env),
        "Merchant-Id": env.THETELLER_MERCHANT_ID!.trim(),
      },
      signal: AbortSignal.timeout(20_000),
    }
  );

  const data = await readJson(response);
  const code = String(data.code ?? "");
  const status = String(data.status ?? "");
  const reason = String(data.reason ?? data.description ?? "");
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
