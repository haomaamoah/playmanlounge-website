import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { ApiFailure } from "@/lib/admin/validation";
import { deriveCustomerPassword } from "./password.ts";

test("customer password derivation matches the shared mobile auth format", () => {
  const previous = process.env.CUSTOMER_AUTH_PEPPER;
  const pepper = "p".repeat(32);
  process.env.CUSTOMER_AUTH_PEPPER = pepper;
  try {
    const expected = createHmac("sha256", pepper)
      .update("pml-customer-v1\0kofi@example.com\0secret")
      .digest("hex");
    assert.equal(deriveCustomerPassword(" Kofi@Example.com ", "secret"), expected);
    assert.match(deriveCustomerPassword("kofi@example.com", "secret"), /^[a-f0-9]{64}$/);
  } finally {
    if (previous === undefined) delete process.env.CUSTOMER_AUTH_PEPPER;
    else process.env.CUSTOMER_AUTH_PEPPER = previous;
  }
});

test("customer password derivation refuses a missing or short pepper", () => {
  const previous = process.env.CUSTOMER_AUTH_PEPPER;
  delete process.env.CUSTOMER_AUTH_PEPPER;
  try {
    assert.throws(
      () => deriveCustomerPassword("kofi@example.com", "secret"),
      (error: unknown) => error instanceof ApiFailure && error.status === 503,
    );
    process.env.CUSTOMER_AUTH_PEPPER = "too-short";
    assert.throws(() => deriveCustomerPassword("kofi@example.com", "secret"));
  } finally {
    if (previous === undefined) delete process.env.CUSTOMER_AUTH_PEPPER;
    else process.env.CUSTOMER_AUTH_PEPPER = previous;
  }
});
