import assert from "node:assert/strict";
import { test } from "node:test";
import { isoUtc, mobileCustomer, mobileOrder, mobileSession, mobileTicket, supportContactName } from "./dto.ts";

test("timestamps become UTC ISO strings and keep their microseconds", () => {
  assert.equal(isoUtc("2026-10-12T09:53:26.12345+00:00"), "2026-10-12T09:53:26.12345Z");
  assert.equal(isoUtc("2026-10-12T09:53:26.123456+00:00"), "2026-10-12T09:53:26.123456Z");
  assert.equal(isoUtc("2026-10-12 09:53:26+00"), "2026-10-12T09:53:26Z");
  assert.equal(isoUtc("2026-10-12T09:53:26Z"), "2026-10-12T09:53:26Z");
  assert.equal(isoUtc("2026-10-12T11:53:26.5+02:00"), "2026-10-12T09:53:26.500Z", "other offsets are converted");
  assert.equal(isoUtc(null), "");
  assert.equal(isoUtc("not a date"), "not a date");
});

const row = {
  id: "4c048592-0956-451b-8a58-70024a019182",
  order_ref: "PML-MB3FX900",
  status: "cooking",
  payment_status: "cod",
  fulfilment: "delivery",
  preferred_time: "13:00",
  notes: "Delivery address: Nikoi Olai St\n\nhot",
  total: "50.00",
  customer_name: "Kofi",
  customer_phone: "0200000000",
  lines: [{ itemId: "chairman", name: "Chairman", qty: 2, unitPrice: 25, image: "https://example.com/c.webp" }],
  created_at: "2026-10-12T10:45:52.686314+00:00",
  updated_at: "2026-10-12T10:46:00+00:00",
  // Columns the app must never see.
  customer_email: "kofi@example.com",
  request_key: "mobile:abc:key",
  transaction_id: null,
  customer_id: "abc",
  is_demo: false,
  source: "mobile",
};

test("an order carries the reference and only the fields the app shows", () => {
  const dto = mobileOrder(row);
  assert.deepEqual(dto, {
    id: row.id,
    ref: "PML-MB3FX900",
    status: "cooking",
    paymentStatus: "cod",
    fulfilment: "delivery",
    preferredTime: "13:00",
    notes: "Delivery address: Nikoi Olai St\n\nhot",
    total: 50,
    customerName: "Kofi",
    customerPhone: "0200000000",
    lines: [{ itemId: "chairman", name: "Chairman", qty: 2, unitPrice: 25, image: "https://example.com/c.webp" }],
    createdAt: "2026-10-12T10:45:52.686314Z",
    updatedAt: "2026-10-12T10:46:00Z",
  });
  const text = JSON.stringify(dto);
  for (const secret of ["kofi@example.com", "mobile:abc", "request_key", "transaction", "customer_id", "is_demo", "source"]) assert.ok(!text.includes(secret), secret);
});

test("a malformed lines column never breaks the DTO", () => {
  assert.deepEqual(mobileOrder({ ...row, lines: null }).lines, []);
  assert.deepEqual(mobileOrder({ ...row, lines: [{ itemId: "x" }] }).lines, [{ itemId: "x", name: "", qty: 0, unitPrice: 0, image: "" }]);
});

test("prices come out as numbers, including fractions of a cedi", () => {
  assert.equal(mobileOrder({ ...row, total: 0.1 }).total, 0.1);
  assert.equal(mobileOrder({ ...row, total: "0.10" }).total, 0.1);
});

test("a customer exposes id, e-mail, name, phone and creation time only", () => {
  const dto = mobileCustomer({ id: "u1", email: "kofi@example.com", name: "Kofi", phone: "", created_at: "2026-10-12T09:00:00.5+00:00", updated_at: "x" });
  assert.deepEqual(dto, { id: "u1", email: "kofi@example.com", name: "Kofi", phone: "", createdAt: "2026-10-12T09:00:00.5Z" });
});

test("a session carries tokens and the expiry as an ISO instant", () => {
  const dto = mobileSession({ access_token: "a.b.c", refresh_token: "r", expires_at: 1791803651, expires_in: 3600 });
  assert.deepEqual(dto, { accessToken: "a.b.c", refreshToken: "r", expiresAt: "2026-10-12T11:14:11.000Z" });
  const relative = mobileSession({ access_token: "a", refresh_token: "r", expires_in: 60 });
  assert.ok(Math.abs(Date.parse(relative.expiresAt) - (Date.now() + 60_000)) < 5_000);
});

test("a ticket never exposes the customer's e-mail or id", () => {
  const dto = mobileTicket({
    id: "t1", subject: "Late order", message: "Please check", status: "open", phone: "",
    customer_email: "kofi@example.com", customer_id: "u1", customer_name: "Kofi", created_at: "2026-10-12T09:00:00+00:00", updated_at: "2026-10-12T09:00:00+00:00",
  });
  assert.deepEqual(Object.keys(dto).sort(), ["createdAt", "id", "message", "phone", "status", "subject", "updatedAt"]);
});

test("a ticket's contact name is the profile name, else the e-mail's local part, never shorter than 2", () => {
  assert.equal(supportContactName("  Kofi Mensah ", "kofi@example.com"), "Kofi Mensah");
  assert.equal(supportContactName("", "kofi.mensah@example.com"), "kofi.mensah");
  assert.equal(supportContactName("", "k@example.com"), "Customer");
  assert.equal(supportContactName("n".repeat(100), "k@example.com").length, 100);
  assert.equal(supportContactName("", `${"l".repeat(150)}@example.com`).length, 100);
});
