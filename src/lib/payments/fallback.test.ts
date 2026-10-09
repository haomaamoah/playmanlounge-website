import assert from "node:assert/strict";
import { test } from "node:test";
import { nextAfterCharge } from "./fallback";
import type { PaymentResult } from "./theteller";

const result = (r: Partial<PaymentResult>): { result: PaymentResult } =>
  ({ result: { transactionId: "1", state: "failed", code: "999", message: "", retryable: false, gatewayIssue: true, ...r } });
const timeout = Object.assign(new Error("timed out"), { name: "TimeoutError" });

test("a timed-out direct charge waits on the same reference, never a second charge", () => {
  assert.equal(nextAfterCharge("auto", { error: timeout }), "await");
  assert.equal(nextAfterCharge("prompt", { error: timeout }), "await");
});
test("an unreachable gateway is unresolved, not a refusal", () => {
  assert.equal(nextAfterCharge("auto", { error: new TypeError("fetch failed") }), "unreachable");
});
test("only a definitive merchant refusal in auto mode falls back to checkout", () => {
  assert.equal(nextAfterCharge("auto", result({})), "checkout");
  assert.equal(nextAfterCharge("prompt", result({})), "result");
  assert.equal(nextAfterCharge("auto", result({ state: "pending" })), "result");
  assert.equal(nextAfterCharge("auto", result({ gatewayIssue: false })), "result");
});
