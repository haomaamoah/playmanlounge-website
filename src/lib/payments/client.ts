/**
 * Browser side of mobile money payment. The PaySwitch credentials live on the
 * server, so the page only ever posts the bag plus the wallet details to our own
 * API routes and reads back a state.
 */
import type { MomoNetwork } from "./networks";
import type { PaymentState } from "./theteller";

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

/**
 * Whether the server holds PaySwitch credentials. Asked once per page load so
 * the form can hide "pay now" instead of offering a button that cannot work.
 */
let configured: boolean | null = null;

export async function loadPaymentConfig() {
  if (configured !== null) return configured;
  try {
    const response = await fetch("/api/payments/config", { cache: "no-store" });
    if (!response.ok) {
      configured = false;
      return configured;
    }
    const data = (await response.json()) as { enabled?: boolean };
    configured = data.enabled === true;
  } catch {
    configured = false;
  }
  return configured;
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
  name: string;
  phone: string;
  email: string;
  fulfilment: "pickup" | "delivery";
  preferredTime: string;
  notes: string;
  lines: { id: string; qty: number }[];
  expectedTotal: number;
  network: MomoNetwork;
  momoNumber: string;
  voucherCode?: string;
};

export async function startPayment(input: StartPaymentInput): Promise<StartedPayment> {
  let response: Response;
  try {
    response = await fetch("/api/payments/start", {
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
  let response: Response;
  try {
    response = await fetch(`/api/payments/status/${encodeURIComponent(transactionId)}`);
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
