import type { PaymentResult } from "./theteller";

/**
 * What to do after a direct mobile-money charge. Hosted checkout is only a
 * safe second attempt when PaySwitch definitively refused the first one; a
 * timeout or dropped connection may still debit the wallet, so the customer
 * waits on the original reference instead.
 */
export type ChargeNext = "checkout" | "await" | "unreachable" | "result";

export function nextAfterCharge(flow: string, outcome: { result: PaymentResult } | { error: unknown }): ChargeNext {
  if ("error" in outcome) {
    const timedOut = outcome.error instanceof Error && (outcome.error.name === "TimeoutError" || outcome.error.name === "AbortError");
    return timedOut ? "await" : "unreachable";
  }
  const { result } = outcome;
  if (flow === "auto" && result.gatewayIssue && result.state === "failed") return "checkout";
  return "result";
}
