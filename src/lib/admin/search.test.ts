import assert from "node:assert/strict";
import { test } from "node:test";
import { orderSearchFilter, searchQuery, textSearchFilter } from "./search";
import { ApiFailure } from "./validation";

test("database search trims, bounds, and accepts ordinary names and phone numbers", () => {
  const query = (value: string) => searchQuery(new URL(`https://example.test/?q=${encodeURIComponent(value)}`));
  assert.equal(query("  Ama Mensah  "), "Ama Mensah");
  assert.equal(query("o'brien@example.com"), "o'brien@example.com");
  assert.equal(query("+233241234567"), "+233241234567");
  assert.equal(query("x".repeat(81)).length, 80);
  assert.equal(searchQuery(new URL("https://example.test/")), "");
});

test("database search rejects PostgREST operators and wildcards explicitly", () => {
  for (const character of ['(', ')', ',', '%', '"', '_', '*', '\\']) {
    assert.throws(() => searchQuery(new URL(`https://example.test/?q=${encodeURIComponent(`a${character}b`)}`)),
      (error: unknown) => error instanceof ApiFailure && error.status === 400);
  }
});

test("support text search combines only the supplied fields", () => {
  assert.equal(textSearchFilter("late delivery", ["subject", "message"]),
    'subject.ilike."%late delivery%",message.ilike."%late delivery%"');
});

test("order search supports full UUIDs and the displayed short IDs without UUID casts", () => {
  const id = "a66d1ccf-d1e7-47e3-9f69-54c3cc896cc1";
  assert.ok(orderSearchFilter(id).endsWith(`,id.eq.${id}`));
  assert.ok(orderSearchFilter("A66D1CCF").endsWith(
    ",and(id.gte.a66d1ccf-0000-0000-0000-000000000000,id.lte.a66d1ccf-ffff-ffff-ffff-ffffffffffff)"));
  assert.ok(orderSearchFilter("a66d1ccf-d1e7").endsWith(
    ",and(id.gte.a66d1ccf-d1e7-0000-0000-000000000000,id.lte.a66d1ccf-d1e7-ffff-ffff-ffffffffffff)"));
  assert.doesNotMatch(orderSearchFilter("Ama"), /id\.(eq|gte|lte)/);
  assert.doesNotMatch(orderSearchFilter("a66d1ccfd1e7"), /id\.(eq|gte|lte)/);
});

test("customer order search excludes contact fields while admin search includes them", () => {
  assert.match(orderSearchFilter("Ama"), /customer_name\.ilike/);
  assert.match(orderSearchFilter("Ama"), /customer_email\.ilike/);
  assert.match(orderSearchFilter("024"), /customer_phone\.ilike/);
  const customerFilter = orderSearchFilter("TX-1", false);
  assert.doesNotMatch(customerFilter, /customer_/);
  assert.match(customerFilter, /order_ref\.ilike/);
  assert.match(customerFilter, /transaction_id\.ilike/);
});
