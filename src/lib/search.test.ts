import assert from "node:assert/strict";
import { test } from "node:test";
import { menuGroups } from "./content";
import { matchesSearch, searchMenuGroups } from "./search";

test("menu text search is case-insensitive, trimmed, and treats operators as literal text", () => {
  assert.equal(matchesSearch("  CHICKEN ", "Chicken shawarma"), true);
  assert.equal(matchesSearch("", "Chicken"), true);
  assert.equal(matchesSearch("a+b", "A+B combo"), true);
  assert.equal(matchesSearch("%", "Chicken"), false);
});

test("menu search finds dishes, descriptions, and entire groups in original order", () => {
  const group = menuGroups.find((entry) => entry.items.length > 1)!;
  const first = group.items[0];
  assert.ok(searchMenuGroups(menuGroups, first.name).some((entry) => entry.items.some((item) => item.id === first.id)));
  assert.ok(searchMenuGroups(menuGroups, first.description).some((entry) => entry.items.some((item) => item.id === first.id)));
  assert.deepEqual(searchMenuGroups(menuGroups, group.title).find((entry) => entry.id === group.id)?.items, group.items);
  assert.deepEqual(searchMenuGroups(menuGroups, ""), menuGroups.filter((entry) => entry.items.length));
  assert.deepEqual(searchMenuGroups(menuGroups, "nothing-matches-this-query-123"), []);
});

test("menu search preserves promotion and combo placement and never mutates the catalog", () => {
  const before = JSON.stringify(menuGroups);
  const filtered = searchMenuGroups(menuGroups, "Coke");
  assert.deepEqual(filtered.map((group) => group.id),
    menuGroups.filter((group) => group.items.some((item) => matchesSearch("Coke", item.name, item.description, group.title, group.blurb))).map((group) => group.id));
  assert.equal(JSON.stringify(menuGroups), before);
});
