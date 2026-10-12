import assert from "node:assert/strict";
import { test } from "node:test";
import { MobileFailure } from "./errors.ts";
import {
  parseChangePassword,
  parseDeleteAccount,
  parseIdempotencyKey,
  parseLogin,
  parseMobileOrder,
  parseOrdersQuery,
  parseProfilePatch,
  parseRefresh,
  parseSignup,
  parseSupport,
} from "./validation.ts";

/** The failure a parser threw, so tests can read its status, code and per-field messages. */
function failure(fn: () => unknown): MobileFailure {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof MobileFailure, `expected a MobileFailure, got ${String(error)}`);
    return error;
  }
  assert.fail("expected the input to be rejected");
}
const fields = (fn: () => unknown) => Object.keys(failure(fn).fieldErrors ?? {}).sort();

test("sign-up: the password floor is 4 characters and the ceiling 128", () => {
  const f3 = failure(() => parseSignup({ email: "kofi@example.com", password: "abc" }));
  assert.equal(f3.status, 400);
  assert.equal(f3.code, "validation");
  assert.equal(f3.fieldErrors?.password, "Use at least 4 characters.");
  assert.equal(parseSignup({ email: "kofi@example.com", password: "abcd" }).password, "abcd");
  assert.equal(parseSignup({ email: "kofi@example.com", password: "x".repeat(128) }).password.length, 128);
  assert.equal(failure(() => parseSignup({ email: "kofi@example.com", password: "x".repeat(129) })).fieldErrors?.password, "Use at most 128 characters.");
  assert.deepEqual(fields(() => parseSignup({ email: "kofi@example.com" })), ["password"]);
  assert.deepEqual(fields(() => parseSignup({ email: "kofi@example.com", password: 1234 })), ["password"]);
});

test("passwords are never trimmed: spaces are legitimate characters", () => {
  assert.equal(parseSignup({ email: "kofi@example.com", password: " a b " }).password, " a b ");
  assert.deepEqual(fields(() => parseSignup({ email: "kofi@example.com", password: "   " })), ["password"], "3 spaces is 3 characters");
  assert.equal(parseSignup({ email: "kofi@example.com", password: "    " }).password, "    ", "4 spaces is a valid 4-character password");
});

test("sign-up: e-mail is trimmed, lower-cased and checked; every problem is reported at once", () => {
  assert.equal(parseSignup({ email: "  Kofi.Mensah@Example.COM ", password: "abcd" }).email, "kofi.mensah@example.com");
  assert.deepEqual(fields(() => parseSignup({ email: "nope", password: "abcd" })), ["email"]);
  assert.deepEqual(fields(() => parseSignup({ email: "a b@example.com", password: "abcd" })), ["email"]);
  assert.deepEqual(fields(() => parseSignup({ email: "", password: "abc" })), ["email", "password"]);
  assert.deepEqual(fields(() => parseSignup({ password: "abcd" })), ["email"]);
  assert.equal(failure(() => parseSignup({ email: "", password: "abcd" })).fieldErrors?.email, "Enter your email.");
  assert.equal(failure(() => parseSignup({ email: "nope", password: "abcd" })).fieldErrors?.email, "Enter a valid email address.");
  const long = `${"a".repeat(250)}@example.com`;
  assert.deepEqual(fields(() => parseSignup({ email: long, password: "abcd" })), ["email"]);
  assert.deepEqual(fields(() => parseSignup({ email: "a\u0000@example.com", password: "abcd" })), ["email"]);
});

test("unknown fields and non-objects are rejected everywhere", () => {
  for (const parse of [parseSignup, parseLogin]) {
    const unknown = failure(() => parse({ email: "kofi@example.com", password: "abcd", name: "Kofi" }));
    assert.equal(unknown.status, 400);
    assert.equal(unknown.code, "validation");
    assert.equal(unknown.fieldErrors?.name, "Unknown field.");
    for (const raw of [null, undefined, [], "text", 7]) assert.equal(failure(() => parse(raw)).code, "validation");
  }
  assert.equal(failure(() => parseSignup({ email: "kofi@example.com", password: "abcd", __proto__x: 1, role: "admin" })).code, "validation");
  assert.equal(failure(() => parseProfilePatch({ name: "Kofi", email: "x@y.zz" })).code, "validation");
  assert.equal(failure(() => parseChangePassword({ currentPassword: "abcd", newPassword: "wxyz", extra: true })).code, "validation");
  assert.equal(failure(() => parseDeleteAccount({ password: "abcd", confirm: true })).code, "validation");
  assert.equal(failure(() => parseRefresh({ refreshToken: "abc", extra: 1 })).code, "validation");
  assert.equal(failure(() => parseSupport({ subject: "Late order", message: "My order is very late.", status: "closed" })).code, "validation");
  assert.equal(failure(() => parseSignup(JSON.parse('{"email":"kofi@example.com","password":"abcd","__proto__":{"admin":true}}'))).code, "validation");
});

test("login only checks shape: a too-short password is a failed login later, not a policy leak", () => {
  assert.deepEqual(parseLogin({ email: "Kofi@Example.com", password: "x" }), { email: "kofi@example.com", password: "x" });
  assert.deepEqual(fields(() => parseLogin({ email: "kofi@example.com", password: "" })), ["password"]);
  assert.deepEqual(fields(() => parseLogin({ email: "kofi@example.com", password: "x".repeat(129) })), ["password"]);
});

test("refresh, change-password and delete bodies", () => {
  assert.equal(parseRefresh({ refreshToken: "abcdef123456" }).refreshToken, "abcdef123456");
  assert.deepEqual(fields(() => parseRefresh({})), ["refreshToken"]);
  assert.deepEqual(fields(() => parseRefresh({ refreshToken: "" })), ["refreshToken"]);
  assert.deepEqual(parseChangePassword({ currentPassword: "old", newPassword: "wxyz" }), { currentPassword: "old", newPassword: "wxyz" });
  assert.deepEqual(fields(() => parseChangePassword({ currentPassword: "old", newPassword: "abc" })), ["newPassword"]);
  assert.deepEqual(fields(() => parseChangePassword({ newPassword: "abcd" })), ["currentPassword"]);
  assert.deepEqual(fields(() => parseChangePassword({ currentPassword: "old", newPassword: "x".repeat(129) })), ["newPassword"]);
  assert.deepEqual(parseDeleteAccount({ password: "abcd" }), { password: "abcd" });
  assert.deepEqual(fields(() => parseDeleteAccount({})), ["password"]);
});

test("profile patch: at least one field, trimmed, 100 / 30 character limits", () => {
  assert.deepEqual(parseProfilePatch({ name: "  Kofi Mensah  " }), { name: "Kofi Mensah" });
  assert.deepEqual(parseProfilePatch({ phone: " +233 20 000 0000 " }), { phone: "+233 20 000 0000" });
  assert.deepEqual(parseProfilePatch({ name: "", phone: "" }), { name: "", phone: "" }, "clearing is allowed");
  assert.equal(failure(() => parseProfilePatch({})).fieldErrors, undefined);
  assert.equal(failure(() => parseProfilePatch({})).status, 400);
  assert.deepEqual(fields(() => parseProfilePatch({ name: "n".repeat(101) })), ["name"]);
  assert.equal(parseProfilePatch({ name: "n".repeat(100) }).name?.length, 100);
  assert.deepEqual(fields(() => parseProfilePatch({ phone: "9".repeat(31) })), ["phone"]);
  assert.deepEqual(fields(() => parseProfilePatch({ name: 5 })), ["name"]);
  assert.deepEqual(fields(() => parseProfilePatch({ name: "bad\nname" })), ["name"]);
});

test("support: subject 3-160, message 10-4000, phone <= 30, everything reported at once", () => {
  assert.deepEqual(parseSupport({ subject: " Late order ", message: " My order is very late. " }), { subject: "Late order", message: "My order is very late.", phone: "" });
  assert.deepEqual(parseSupport({ subject: "abc", message: "m".repeat(10), phone: "0200000000" }).phone, "0200000000");
  assert.deepEqual(fields(() => parseSupport({ subject: "ab", message: "short", phone: "9".repeat(31) })), ["message", "phone", "subject"]);
  assert.deepEqual(fields(() => parseSupport({ subject: "s".repeat(161), message: "m".repeat(4001) })), ["message", "subject"]);
  assert.equal(parseSupport({ subject: "s".repeat(160), message: "m".repeat(4000) }).subject.length, 160);
  assert.deepEqual(fields(() => parseSupport({ message: "My order is very late." })), ["subject"]);
  assert.equal(parseSupport({ subject: "Late order", message: "Line one\nLine two is here" }).message, "Line one\nLine two is here");
  assert.deepEqual(fields(() => parseSupport({ subject: "Late\norder", message: "My order is very late." })), ["subject"]);
  assert.deepEqual(fields(() => parseSupport({ subject: "Late order", message: "My order is\u0000 very late." })), ["message"]);
});

test("Idempotency-Key must be 16-100 letters, digits or dashes", () => {
  assert.equal(parseIdempotencyKey("123e4567-e89b-12d3-a456-426614174000"), "123e4567-e89b-12d3-a456-426614174000");
  assert.equal(parseIdempotencyKey("a".repeat(16)), "a".repeat(16));
  assert.equal(parseIdempotencyKey("a".repeat(100)), "a".repeat(100));
  for (const bad of [null, "", "a".repeat(15), "a".repeat(101), "has space 0123456789", "under_score_0123456789", "colon:0123456789012", "emoji-0123456789-🙂"]) {
    const rejected = failure(() => parseIdempotencyKey(bad));
    assert.equal(rejected.status, 400);
    assert.ok(rejected.fieldErrors?.idempotencyKey);
  }
});

const delivery = (extra: Record<string, unknown> = {}) => ({
  name: "Kofi Mensah",
  phone: "+233 20 000 0000",
  fulfilment: "delivery",
  preferredTime: "13:30",
  deliveryAddress: "Nikoi Olai St, blue gate",
  notes: "Extra pepper please",
  lines: [{ id: "chairman", qty: 2 }],
  expectedTotal: 50,
  ...extra,
});
const order = (raw: unknown) => parseMobileOrder(raw, "kofi@example.com");

test("order: a delivery order folds the address into the notes", () => {
  const parsed = order(delivery());
  assert.equal(parsed.storedNotes, "Delivery address: Nikoi Olai St, blue gate\n\nExtra pepper please");
  assert.equal(parsed.notes, "Extra pepper please");
  assert.equal(parsed.deliveryAddress, "Nikoi Olai St, blue gate");
  assert.equal(parsed.phone, "+233200000000", "whitespace is stripped from the phone");
  assert.equal(parsed.expectedTotal, 50);
  assert.deepEqual(parsed.lines, [{ id: "chairman", qty: 2 }]);
  assert.equal(order(delivery({ notes: "" })).storedNotes, "Delivery address: Nikoi Olai St, blue gate");
  assert.equal(order({ ...delivery({ notes: undefined }) }).storedNotes, "Delivery address: Nikoi Olai St, blue gate");
});

test("order: pickup keeps the notes as typed and rejects an address", () => {
  const pickup = delivery({ fulfilment: "pickup", deliveryAddress: undefined });
  assert.equal(order(pickup).storedNotes, "Extra pepper please");
  assert.equal(order({ ...pickup, deliveryAddress: "" }).storedNotes, "Extra pepper please", "a blank address is the same as none");
  assert.deepEqual(fields(() => order(delivery({ fulfilment: "pickup" }))), ["deliveryAddress"]);
});

test("order: the delivery address is required for delivery, 3-300 characters", () => {
  assert.deepEqual(fields(() => order(delivery({ deliveryAddress: undefined }))), ["deliveryAddress"]);
  assert.deepEqual(fields(() => order(delivery({ deliveryAddress: "   " }))), ["deliveryAddress"]);
  assert.deepEqual(fields(() => order(delivery({ deliveryAddress: "ab" }))), ["deliveryAddress"]);
  assert.deepEqual(fields(() => order(delivery({ deliveryAddress: "a".repeat(301) }))), ["deliveryAddress"]);
  assert.equal(order(delivery({ deliveryAddress: "abc" })).deliveryAddress, "abc");
  assert.equal(order(delivery({ deliveryAddress: "a".repeat(300), notes: "" })).deliveryAddress.length, 300);
  assert.deepEqual(fields(() => order(delivery({ deliveryAddress: 12345 }))), ["deliveryAddress"]);
});

test("order: address + notes must fit the website's 800-character notes limit", () => {
  const address = "a".repeat(300);
  const room = 800 - "Delivery address: ".length - 2 - 300; // 480
  assert.equal(order(delivery({ deliveryAddress: address, notes: "n".repeat(room) })).storedNotes.length, 800);
  const tooLong = failure(() => order(delivery({ deliveryAddress: address, notes: "n".repeat(room + 1) })));
  assert.deepEqual(Object.keys(tooLong.fieldErrors ?? {}), ["notes"]);
  assert.match(tooLong.fieldErrors?.notes ?? "", /address and notes/);
  assert.equal(failure(() => order(delivery({ fulfilment: "pickup", deliveryAddress: undefined, notes: "n".repeat(801) }))).fieldErrors?.notes, "Keep notes under 800 characters.");
  assert.equal(order(delivery({ fulfilment: "pickup", deliveryAddress: undefined, notes: "n".repeat(800) })).storedNotes.length, 800);
});

test("order: the e-mail comes from the account, never the body", () => {
  assert.equal(failure(() => order(delivery({ email: "someone.else@example.com" }))).code, "validation");
  assert.equal(failure(() => order(delivery({ company: "bot" }))).code, "validation");
  assert.equal(failure(() => order(delivery({ payment: "momo" }))).code, "validation");
});

test("order: name, phone, fulfilment and the kitchen window follow the website's rules", () => {
  assert.deepEqual(fields(() => order(delivery({ name: "" }))), ["name"]);
  assert.deepEqual(fields(() => order(delivery({ name: "n".repeat(101) }))), ["name"]);
  assert.deepEqual(fields(() => order(delivery({ phone: "12ab" }))), ["phone"]);
  assert.deepEqual(fields(() => order(delivery({ phone: "12345678" }))), ["phone"]);
  assert.equal(order(delivery({ phone: "0547539942" })).phone, "0547539942");
  assert.deepEqual(fields(() => order(delivery({ fulfilment: "teleport" }))), ["fulfilment"]);
  assert.deepEqual(fields(() => order(delivery({ fulfilment: undefined }))), ["fulfilment"]);
  for (const time of ["11:59", "23:01", "noon", "", "9:00", "24:00"]) assert.deepEqual(fields(() => order(delivery({ preferredTime: time }))), ["preferredTime"], time);
  for (const time of ["12:00", "13:30", "23:00"]) assert.equal(order(delivery({ preferredTime: time })).preferredTime, time);
  assert.deepEqual(fields(() => order(delivery({ name: "", phone: "x", preferredTime: "", lines: [] }))), ["lines", "name", "phone", "preferredTime"]);
});

test("order: lines are strict (1-30 distinct items, whole quantities 1-20)", () => {
  const lines = (value: unknown) => fields(() => order(delivery({ lines: value })));
  assert.deepEqual(lines([]), ["lines"]);
  assert.deepEqual(lines(undefined), ["lines"]);
  assert.deepEqual(lines("chairman"), ["lines"]);
  assert.deepEqual(lines([{ id: "chairman", qty: 0 }]), ["lines"]);
  assert.deepEqual(lines([{ id: "chairman", qty: 21 }]), ["lines"]);
  assert.deepEqual(lines([{ id: "chairman", qty: 1.5 }]), ["lines"]);
  assert.deepEqual(lines([{ id: "chairman", qty: "2" }]), ["lines"]);
  assert.deepEqual(lines([{ id: "chairman", qty: 1 }, { id: "chairman", qty: 1 }]), ["lines"]);
  assert.deepEqual(lines([{ id: "chairman", qty: 1, price: 0 }]), ["lines"], "a client-supplied price is an unknown field");
  assert.deepEqual(lines([{ id: "", qty: 1 }]), ["lines"]);
  assert.deepEqual(lines([{ id: 7, qty: 1 }]), ["lines"]);
  assert.deepEqual(lines([null]), ["lines"]);
  assert.deepEqual(lines(Array.from({ length: 31 }, (_, i) => ({ id: `item-${i}`, qty: 1 }))), ["lines"]);
  assert.equal(order(delivery({ lines: Array.from({ length: 30 }, (_, i) => ({ id: `item-${i}`, qty: 20 })) })).lines.length, 30);
});

test("order: expectedTotal is optional and must be a sane number", () => {
  assert.equal(order(delivery({ expectedTotal: undefined })).expectedTotal, undefined);
  assert.equal(order(delivery({ expectedTotal: null })).expectedTotal, undefined);
  assert.equal(order(delivery({ expectedTotal: 0.1 })).expectedTotal, 0.1);
  for (const bad of ["50", -1, Number.NaN, 2_000_000, {}]) assert.deepEqual(fields(() => order(delivery({ expectedTotal: bad }))), ["expectedTotal"]);
});

test("order: control characters never reach the database", () => {
  assert.deepEqual(fields(() => order(delivery({ name: "Kofi\u0000" }))), ["name"]);
  assert.deepEqual(fields(() => order(delivery({ notes: "hot\u0000pepper" }))), ["notes"]);
  assert.equal(order(delivery({ notes: "line one\nline two\tend" })).notes, "line one\nline two\tend");
  assert.deepEqual(fields(() => order(delivery({ deliveryAddress: "Nikoi\u0007 St" }))), ["deliveryAddress"]);
});

test("orders query: limit 1-50 (default 30) and an ISO `before` that keeps microseconds", () => {
  const query = (qs: string) => parseOrdersQuery(new URL(`http://x/api/mobile/orders${qs}`));
  assert.deepEqual(query(""), { limit: 30, before: undefined });
  assert.equal(query("?limit=1").limit, 1);
  assert.equal(query("?limit=50").limit, 50);
  for (const bad of ["0", "51", "abc", "-1", "1.5", "", "1000"]) assert.deepEqual(fields(() => query(`?limit=${bad}`)), ["limit"], bad);
  assert.equal(query("?before=2026-10-12T09:53:26.123456Z").before, "2026-10-12T09:53:26.123456Z");
  assert.equal(query("?before=2026-10-12T09:53:26Z").before, "2026-10-12T09:53:26Z");
  assert.equal(query("?before=2026-10-12T09:53:26.5%2B00:00").before, "2026-10-12T09:53:26.5Z");
  assert.equal(query("?before=2026-10-12T09:53:26.5+00:00").before, "2026-10-12T09:53:26.5Z", "an unencoded + still means +00:00");
  assert.equal(query("?before=2026-10-12T11:53:26.000%2B02:00").before, "2026-10-12T09:53:26.000Z");
  for (const bad of ["yesterday", "2026-10-12", "2026-10-12T09:53:26", "2026-13-45T00:00:00Z", "x".repeat(60)]) {
    assert.deepEqual(fields(() => query(`?before=${bad}`)), ["before"], bad);
  }
});
