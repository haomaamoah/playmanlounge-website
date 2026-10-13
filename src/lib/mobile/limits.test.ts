import assert from "node:assert/strict";
import { test } from "node:test";
import { LIMITS, SHARED_IP_BUCKET_FACTOR, ipBucketCeiling } from "./constants.ts";

test("the documented limits (docs/API_CONTRACT.md)", () => {
  assert.deepEqual(LIMITS.signupPerIp, [10, 3600]);
  assert.deepEqual(LIMITS.loginPerEmail, [10, 900]);
  assert.deepEqual(LIMITS.ordersPerCustomer, [20, 3600]);
  assert.deepEqual(LIMITS.supportPerCustomer, [5, 3600]);
  assert.deepEqual(LIMITS.passwordPerCustomer, [5, 900]);
  assert.deepEqual(LIMITS.deletePerCustomer, [5, 900]);
  assert.deepEqual(LIMITS.loginPerIp, [100, 900]);
});

test("behind a trusted proxy the per-address ceiling is exactly the documented one", () => {
  assert.equal(ipBucketCeiling(10, true), 10);
  assert.equal(ipBucketCeiling(100, true), 100);
});

test("without a trusted proxy the single shared bucket is sized for everybody, not for one address", () => {
  assert.equal(SHARED_IP_BUCKET_FACTOR, 20);
  assert.equal(ipBucketCeiling(10, false), 200, "sign-ups: 200 an hour for the whole customer base, not 10");
  assert.equal(ipBucketCeiling(100, false), 2000);
});
