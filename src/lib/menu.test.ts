import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { formatGhs, menu, menuGroups, pesewas } from "./content.ts";

test("every menu item has a unique id and a price the kitchen charges", () => {
  const ids = new Set<string>();
  for (const item of menu) {
    assert.equal(ids.has(item.id), false, `duplicate menu id ${item.id}`);
    ids.add(item.id);
    assert.ok(item.price > 0 && Number.isFinite(item.price), `${item.id} has no price`);
    assert.equal(
      pesewas(item.price) / 100,
      Number(item.price.toFixed(2)),
      `${item.id} is not a whole number of pesewas`
    );
  }
  assert.equal(menu.length, menuGroups.reduce((count, group) => count + group.items.length, 0));
});

test("kitchen test is ten pesewas so pay-now can be checked without a real plate", () => {
  const item = menu.find((entry) => entry.id === "kitchen-test");
  assert.ok(item, "kitchen-test is missing from the menu");
  assert.equal(item.price, 0.1);
  assert.equal(formatGhs(item.price), "GHS 0.10");
  assert.equal(pesewas(item.price), 10);
});

test("cedis amounts print whole numbers without decimals", () => {
  assert.equal(formatGhs(40), "GHS 40");
  assert.equal(formatGhs(0.1), "GHS 0.10");
});

test("every menu photo has a receipt thumbnail", () => {
  for (const item of menu) {
    const thumb = `public/email/${item.image.split("/").pop()!.replace(/\.webp$/, ".jpg")}`;
    assert.ok(existsSync(thumb), `${item.id} is missing ${thumb}`);
    assert.ok(existsSync(`public${item.image}`), `${item.id} is missing public${item.image}`);
  }
});
