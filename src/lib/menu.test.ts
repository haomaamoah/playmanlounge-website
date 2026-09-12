import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { menu, menuGroups } from "./content.ts";

test("every menu item has a unique id and a price the kitchen charges", () => {
  const ids = new Set<string>();
  for (const item of menu) {
    assert.equal(ids.has(item.id), false, `duplicate menu id ${item.id}`);
    ids.add(item.id);
    assert.ok(Number.isInteger(item.price) && item.price > 0, `${item.id} has no price`);
  }
  assert.equal(menu.length, menuGroups.reduce((count, group) => count + group.items.length, 0));
});

test("every menu photo has a receipt thumbnail", () => {
  for (const item of menu) {
    const thumb = `public/email/${item.image.split("/").pop()!.replace(/\.webp$/, ".jpg")}`;
    assert.ok(existsSync(thumb), `${item.id} is missing ${thumb}`);
    assert.ok(existsSync(`public${item.image}`), `${item.id} is missing public${item.image}`);
  }
});
