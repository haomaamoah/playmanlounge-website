import assert from "node:assert/strict";
import { test } from "node:test";
import { MobileFailure } from "./errors.ts";
import { PEPPER_MIN_LENGTH, checkPepper, derivePassword } from "./password.ts";

const PEPPER = "test-pepper-0123456789-abcdefghijklmnop";

// Golden vectors computed independently with `openssl dgst -sha256 -hmac` over "pml-customer-v1\0<email>\0<password>".
// If one of these changes, every stored customer secret stops matching: that is a lock-out, never a refactor.
test("derivation matches independently computed HMAC-SHA256 vectors", () => {
  assert.equal(derivePassword("kofi@example.com", "abcd", PEPPER), "f8e7d6ebb25e3de4da8d25627bf7530071560dc0349d8880a2510d45631a3607");
  assert.equal(
    derivePassword("kofi@example.com", "abcd", "another-pepper-0123456789-abcdefghijk"),
    "498a41b0b6fc6a158b58e48ff4e629d0a22338dd6aa6e59623eab97db4497f6d",
  );
  assert.equal(derivePassword("ama@example.com", "p@ss w0rd ", PEPPER), "9e582ffff9cf21a9def42dcfc302116cb9dd652ce553a90d586c3c479546a2a4");
});

test("derivation is deterministic, 64 hex characters and never the raw password", () => {
  const a = derivePassword("kofi@example.com", "abcd", PEPPER);
  assert.equal(a, derivePassword("kofi@example.com", "abcd", PEPPER));
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.ok(!a.includes("abcd"));
  assert.ok(a.length >= 6, "long enough for Supabase's own 6-character floor");
});

test("the e-mail is case-insensitive and trimmed; the password is neither", () => {
  const base = derivePassword("kofi@example.com", "abcd", PEPPER);
  assert.equal(derivePassword("KOFI@Example.COM", "abcd", PEPPER), base);
  assert.equal(derivePassword("  kofi@example.com ", "abcd", PEPPER), base);
  assert.notEqual(derivePassword("kofi@example.com", "ABCD", PEPPER), base);
  assert.notEqual(derivePassword("kofi@example.com", "abcd ", PEPPER), base, "trailing space is significant");
  assert.notEqual(derivePassword("kofi@example.com", " abcd", PEPPER), base, "leading space is significant");
});

test("different accounts, passwords and peppers never share a secret", () => {
  const secrets = new Set([
    derivePassword("kofi@example.com", "abcd", PEPPER),
    derivePassword("ama@example.com", "abcd", PEPPER),
    derivePassword("kofi@example.com", "abce", PEPPER),
    derivePassword("kofi@example.com", "abcd", `${PEPPER}x`),
  ]);
  assert.equal(secrets.size, 4);
});

test("the e-mail and password cannot be shifted across the separator", () => {
  assert.notEqual(derivePassword("a@b.cd", "ef", PEPPER), derivePassword("a@b.cde", "f", PEPPER));
  assert.notEqual(derivePassword("a@b.cd", "x\0ef", PEPPER), derivePassword("a@b.cd", "xef", PEPPER));
  // An address with a NUL could be re-split into another (address, password) pair, so it is refused outright.
  assert.throws(() => derivePassword("a@b.cd\0x", "ef", PEPPER), (error: unknown) => error instanceof MobileFailure && error.status === 400);
});

test("a missing or short pepper fails closed with 503 unavailable", () => {
  for (const pepper of [undefined, "", "x".repeat(PEPPER_MIN_LENGTH - 1)]) {
    assert.throws(
      () => derivePassword("kofi@example.com", "abcd", pepper),
      (error: unknown) => error instanceof MobileFailure && error.status === 503 && error.code === "unavailable",
    );
    assert.throws(() => checkPepper(pepper), MobileFailure);
  }
  assert.equal(PEPPER_MIN_LENGTH, 32);
  assert.equal(checkPepper("x".repeat(32)), "x".repeat(32));
});

test("the pepper comes from CUSTOMER_AUTH_PEPPER by default", () => {
  const saved = process.env.CUSTOMER_AUTH_PEPPER;
  try {
    process.env.CUSTOMER_AUTH_PEPPER = PEPPER;
    assert.equal(derivePassword("kofi@example.com", "abcd"), derivePassword("kofi@example.com", "abcd", PEPPER));
    delete process.env.CUSTOMER_AUTH_PEPPER;
    assert.throws(() => derivePassword("kofi@example.com", "abcd"), MobileFailure);
  } finally {
    if (saved === undefined) delete process.env.CUSTOMER_AUTH_PEPPER;
    else process.env.CUSTOMER_AUTH_PEPPER = saved;
  }
});
