import assert from "node:assert/strict";
import { test } from "node:test";
import prices from "../prices.json" with { type: "json" };
import { menu } from "../../src/lib/content.ts";

/**
 * The service prices orders from prices.json so the browser cannot decide what
 * an order costs. That only holds while the file matches the site menu, so this
 * test fails the build if someone edits the menu without running
 * `npm run sync:prices`.
 */
test("prices.json matches the site menu", () => {
  const fromMenu = Object.fromEntries(
    menu.map((item) => [item.id, { name: item.name, price: item.price }])
  );
  assert.deepEqual(prices, fromMenu);
});

test("every menu item has a sane price", () => {
  for (const item of menu) {
    assert.ok(item.price > 0, `${item.id} needs a price`);
    assert.equal(item.price, Math.round(item.price), `${item.id} should be whole cedis`);
  }
});
