import assert from "node:assert/strict";
import { test } from "node:test";
import {
  describeCode,
  describeStatus,
  formatAmount,
  isTransactionId,
  newTransactionId,
} from "./theteller.ts";
import { guessNetwork, isValidMomoNumber, normaliseSubscriberNumber } from "./networks.ts";

test("amounts are sent in pesewas, padded to twelve digits", () => {
  assert.equal(formatAmount(0.1), "000000000010");
  assert.equal(formatAmount(40), "000000004000");
  assert.equal(formatAmount(1234.5), "000000123450");
  assert.throws(() => formatAmount(0));
  assert.throws(() => formatAmount(-5));
});

test("transaction references are twelve digits and change every time", () => {
  const first = newTransactionId(1_757_680_000_000, () => 0.5);
  assert.match(first, /^[0-9]{12}$/);
  assert.ok(isTransactionId(first));
  assert.notEqual(newTransactionId(), newTransactionId(Date.now() + 1));
  assert.equal(isTransactionId("abc123"), false);
  assert.equal(isTransactionId("12345"), false);
});

test("wallet numbers are normalised to the international form", () => {
  assert.equal(normaliseSubscriberNumber("0205786433"), "233205786433");
  assert.equal(normaliseSubscriberNumber("020 578 6433"), "233205786433");
  assert.equal(normaliseSubscriberNumber("233205786433"), "233205786433");
  assert.equal(normaliseSubscriberNumber("205786433"), "233205786433");
  assert.equal(normaliseSubscriberNumber("0205"), null);
  assert.equal(isValidMomoNumber("0205786433"), true);
  assert.equal(isValidMomoNumber("205786433"), false);
});

test("the network is guessed from the Ghanaian prefix", () => {
  assert.equal(guessNetwork("0205786433"), "VDF");
  assert.equal(guessNetwork("0547539942"), "MTN");
  assert.equal(guessNetwork("0271234567"), "ATL");
  assert.equal(guessNetwork("233205786433"), "VDF");
  assert.equal(guessNetwork("0991234567"), null);
});

test("response codes become states the form can act on", () => {
  assert.equal(describeCode("000").state, "paid");
  assert.equal(describeCode("111").state, "pending");
  assert.equal(describeCode("101").state, "failed");
  assert.equal(describeCode("101").retryable, true);
  // 999 is "merchant not found": our setup, not the customer's wallet.
  assert.equal(describeCode("999").gatewayIssue, true);
  assert.equal(describeCode("101").gatewayIssue, false);
  assert.match(describeCode("742", "Wallet asleep").message, /Wallet asleep \(code 742\)/);
  assert.match(describeCode("742").message, /code 742/);
});

test("the status endpoint's words are read alongside the code", () => {
  assert.equal(describeStatus("approved", ""), "paid");
  assert.equal(describeStatus("", "000"), "paid");
  assert.equal(describeStatus("pending", "111"), "pending");
  assert.equal(describeStatus("processing", ""), "pending");
  assert.equal(describeStatus("declined", "101"), "failed");
});
