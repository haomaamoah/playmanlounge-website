import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiFailure } from "../admin/validation.ts";
import { MobileFailure, describeFailure, notFound, unauthorized, unavailable, validationFailure } from "./errors.ts";

test("a validation failure is a 400 with per-field messages", () => {
  const view = describeFailure(validationFailure({ email: "Enter your email.", password: "Use at least 4 characters." }));
  assert.equal(view.status, 400);
  assert.deepEqual(view.body, {
    ok: false,
    error: "Enter your email.",
    code: "validation",
    fieldErrors: { email: "Enter your email.", password: "Use at least 4 characters." },
  });
  assert.equal(view.headers["Cache-Control"], "no-store");
});

test("an empty fieldErrors map is left out of the body", () => {
  const view = describeFailure(validationFailure({}, "Send a name or a phone number to update."));
  assert.deepEqual(view.body, { ok: false, error: "Send a name or a phone number to update.", code: "validation" });
});

test("extra keys ride along but can never override ok, error or code", () => {
  const view = describeFailure(new MobileFailure(409, "Prices have changed.", { code: "price_changed", extra: { total: 55, ok: true, code: "x" } }));
  assert.equal(view.status, 409);
  assert.deepEqual(view.body, { ok: false, error: "Prices have changed.", code: "price_changed", total: 55 });
});

test("rate limits carry Retry-After", () => {
  const view = describeFailure(new MobileFailure(429, "Too many attempts.", { code: "rate_limited", retryAfter: 899.2 }));
  assert.equal(view.status, 429);
  assert.equal(view.headers["Retry-After"], "900");
  assert.equal(view.body.code, "rate_limited");
});

test("failures from the shared helpers are mapped to the contract's codes", () => {
  const limited = describeFailure(new ApiFailure(429, "Too many requests. Try again later."));
  assert.equal(limited.status, 429);
  assert.equal(limited.body.code, "rate_limited");
  assert.equal(limited.headers["Retry-After"], "60");
  assert.equal(describeFailure(new ApiFailure(400, "Send valid JSON.")).body.code, "validation");
  assert.equal(describeFailure(new ApiFailure(413, "Request is too large.")).status, 413);
  assert.equal(describeFailure(new ApiFailure(413, "Request is too large.")).body.code, "validation");
  assert.equal(describeFailure(unauthorized()).body.code, "unauthorized");
  assert.equal(describeFailure(notFound()).status, 404);
  assert.equal(describeFailure(notFound()).body.code, "not_found");
});

test("server-side problems say 'unavailable' and never leak internals", () => {
  for (const error of [
    new ApiFailure(503, "Database operation failed."),
    new ApiFailure(503, "Abuse protection is unavailable."),
    new Error('relation "public.orders" does not exist'),
    { code: "42P01", message: "secret detail" },
    "boom",
    null,
  ]) {
    const view = describeFailure(error);
    assert.equal(view.status, 503);
    assert.equal(view.body.code, "unavailable");
    assert.equal(view.body.ok, false);
    assert.ok(!JSON.stringify(view.body).match(/relation|42P01|secret|Database operation|Abuse protection/));
  }
  assert.equal(describeFailure(unavailable()).status, 503);
});

test("a MobileFailure may carry its own 5xx wording", () => {
  const view = describeFailure(new MobileFailure(503, "Sign-in is not available right now. Try again later.", { code: "unavailable" }));
  assert.equal(view.body.error, "Sign-in is not available right now. Try again later.");
});
