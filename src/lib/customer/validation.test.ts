import assert from "node:assert/strict";
import { test } from "node:test";
import { customerLoginInput, customerSignupInput } from "./validation.ts";

test("customer sign-up accepts normalized fields and six-character passwords", () => {
  assert.deepEqual(customerSignupInput({
    name: " Ama Mensah ",
    email: "AMA@example.com",
    phone: "0241234567",
    password: "secret",
    confirmPassword: "secret",
  }), {
    name: "Ama Mensah",
    email: "ama@example.com",
    phone: "0241234567",
    password: "secret",
  });
});

test("customer sign-up rejects invalid phone numbers, short passwords and mismatches", () => {
  const base = {
    name: "Ama Mensah",
    email: "ama@example.com",
    phone: "0241234567",
    password: "secret",
    confirmPassword: "secret",
  };
  assert.throws(() => customerSignupInput({ ...base, phone: "241234567" }));
  assert.throws(() => customerSignupInput({ ...base, phone: "024123456a" }));
  assert.throws(() => customerSignupInput({ ...base, password: "short", confirmPassword: "short" }));
  assert.throws(() => customerSignupInput({ ...base, confirmPassword: "different" }));
});

test("customer login accepts an email address or exactly ten phone digits", () => {
  assert.equal(customerLoginInput({ identifier: "AMA@example.com", password: "secret" }).identifier, "AMA@example.com");
  assert.equal(customerLoginInput({ identifier: "0241234567", password: "secret" }).identifier, "0241234567");
  assert.throws(() => customerLoginInput({ identifier: "024 123 4567", password: "secret" }));
  assert.throws(() => customerLoginInput({ identifier: "not-an-email", password: "secret" }));
});
