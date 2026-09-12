/**
 * Talks to the Play Man Lounge payment service (see `payments/`), which holds
 * the PaySwitch credentials. Nothing secret lives in the browser: the page only
 * ever sends the bag and the wallet details, and reads back a state.
 */
export type MomoNetwork = "MTN" | "VDF" | "ATL";

export const momoNetworks: {
  code: MomoNetwork;
  label: string;
  prefixes: string[];
}[] = [
  { code: "MTN", label: "MTN MoMo", prefixes: ["024", "025", "053", "054", "055", "059"] },
  { code: "VDF", label: "Telecel Cash", prefixes: ["020", "050"] },
  { code: "ATL", label: "AirtelTigo Money", prefixes: ["026", "027", "056", "057"] },
];

export type PaymentState = "paid" | "pending" | "failed";

export type PaymentUpdate = {
  transactionId: string;
  state: PaymentState;
  code: string;
  message: string;
  retryable: boolean;
  gatewayIssue: boolean;
};

export type StartedPayment =
  | ({ mode: "prompt"; total: number } & PaymentUpdate)
  | { mode: "checkout"; total: number; transactionId: string; checkoutUrl: string };

export class PaymentError extends Error {
  readonly gatewayIssue: boolean;
  readonly retryable: boolean;
  constructor(message: string, options?: { gatewayIssue?: boolean; retryable?: boolean }) {
    super(message);
    this.name = "PaymentError";
    this.gatewayIssue = options?.gatewayIssue ?? false;
    this.retryable = options?.retryable ?? true;
  }
}

function tidyBase(value: string) {
  return value.trim().replace(/\/+$/, "");
}

/**
 * Where the payment service lives. The build-time variable wins for local work;
 * otherwise `public/payments.json` is read at runtime so the deployed site can
 * be pointed at a payment service by editing one file, with no rebuild secret.
 */
let runtimeBase: string | null = null;

export function paymentApiBase() {
  const fromEnv = tidyBase(process.env.NEXT_PUBLIC_PAYMENT_API_URL ?? "");
  return fromEnv || (runtimeBase ?? "");
}

export function paymentsConfigured() {
  return paymentApiBase().length > 0;
}

/** Reads `public/payments.json`. Safe to call more than once. */
export async function loadPaymentConfig(configUrl: string) {
  if (runtimeBase !== null) return paymentsConfigured();
  try {
    const response = await fetch(configUrl, { cache: "no-store" });
    if (!response.ok) {
      runtimeBase = "";
      return paymentsConfigured();
    }
    const data = (await response.json()) as { apiUrl?: string };
    runtimeBase = tidyBase(data.apiUrl ?? "");
  } catch {
    runtimeBase = "";
  }
  return paymentsConfigured();
}

export function digitsOnly(value: string) {
  return value.replace(/[^0-9]/g, "");
}

export function isValidMomoNumber(value: string) {
  const digits = digitsOnly(value);
  return /^0[0-9]{9}$/.test(digits) || /^233[0-9]{9}$/.test(digits);
}

/** Ghanaian prefixes identify the wallet, so the network can be preselected. */
export function guessNetwork(value: string): MomoNetwork | null {
  const digits = digitsOnly(value);
  const local = digits.startsWith("233") ? `0${digits.slice(3)}` : digits;
  if (local.length < 3) return null;
  const prefix = local.slice(0, 3);
  return momoNetworks.find((network) => network.prefixes.includes(prefix))?.code ?? null;
}

export function networkLabel(code: MomoNetwork) {
  return momoNetworks.find((network) => network.code === code)?.label ?? code;
}

async function readError(response: Response) {
  try {
    const data = (await response.json()) as {
      error?: string;
      gatewayIssue?: boolean;
      retryable?: boolean;
    };
    return new PaymentError(data.error ?? "The payment could not be started.", {
      gatewayIssue: data.gatewayIssue,
      retryable: data.retryable,
    });
  } catch {
    return new PaymentError("The payment could not be started.");
  }
}

export type StartPaymentInput = {
  lines: { id: string; qty: number }[];
  expectedTotal: number;
  network: MomoNetwork;
  momoNumber: string;
  voucherCode?: string;
  customer: { name: string; phone: string; email: string };
  returnUrl: string;
};

export async function startPayment(input: StartPaymentInput): Promise<StartedPayment> {
  const base = paymentApiBase();
  if (!base) {
    throw new PaymentError("Online payment is not switched on yet.", {
      gatewayIssue: true,
      retryable: false,
    });
  }

  let response: Response;
  try {
    response = await fetch(`${base}/pay/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new PaymentError("We could not reach the payment service. Check your connection.");
  }

  if (!response.ok) throw await readError(response);
  return (await response.json()) as StartedPayment;
}

export async function fetchPaymentStatus(transactionId: string): Promise<PaymentUpdate> {
  const base = paymentApiBase();
  if (!base) throw new PaymentError("Online payment is not switched on yet.", { retryable: false });

  let response: Response;
  try {
    response = await fetch(`${base}/pay/status/${encodeURIComponent(transactionId)}`);
  } catch {
    throw new PaymentError("We could not reach the payment service. Check your connection.");
  }
  if (!response.ok) throw await readError(response);
  return (await response.json()) as PaymentUpdate;
}

/**
 * A mobile money prompt is answered on the customer's phone, so the result only
 * arrives by polling. Gives up after `timeoutMs` and leaves the last state for
 * the caller to explain.
 */
export async function waitForPayment(
  transactionId: string,
  options: {
    signal?: AbortSignal;
    onUpdate?: (update: PaymentUpdate) => void;
    intervalMs?: number;
    timeoutMs?: number;
  } = {}
): Promise<PaymentUpdate> {
  const interval = options.intervalMs ?? 5000;
  const deadline = Date.now() + (options.timeoutMs ?? 180_000);
  let last: PaymentUpdate = {
    transactionId,
    state: "pending",
    code: "111",
    message: "Waiting for the mobile money prompt to be approved.",
    retryable: true,
    gatewayIssue: false,
  };

  while (Date.now() < deadline) {
    if (options.signal?.aborted) return last;
    await new Promise((resolve) => setTimeout(resolve, interval));
    if (options.signal?.aborted) return last;
    try {
      const update = await fetchPaymentStatus(transactionId);
      // Until the gateway has seen the debit it answers "transaction not
      // found", which is not a refusal — keep waiting for the customer.
      if (update.state === "failed" && update.code === "999") continue;
      last = update;
      options.onUpdate?.(update);
      if (update.state !== "pending") return update;
    } catch {
      // Network blips during polling are not a payment failure.
    }
  }

  return {
    ...last,
    state: "pending",
    message:
      "We have not seen the payment yet. If your phone shows it went through, call the kitchen and we will confirm.",
  };
}

/** PaySwitch appends code, status and transaction_id to the return URL. */
export function readCheckoutReturn(search: string) {
  const params = new URLSearchParams(search);
  const transactionId = params.get("transaction_id");
  if (!transactionId) return null;
  return {
    transactionId,
    code: params.get("code") ?? "",
    status: params.get("status") ?? "",
  };
}

/** Drops the payment parameters so a refresh does not replay the return. */
export function stripCheckoutParams() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  for (const key of ["transaction_id", "code", "status", "reason", "payment"]) {
    url.searchParams.delete(key);
  }
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}
