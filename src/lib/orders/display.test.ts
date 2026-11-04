import assert from "node:assert/strict";
import { test } from "node:test";
import { menuPlacement, shortOrderId } from "./display";

const groups = [
  { id: "plates", items: [{ id: "fried-rice" }] },
  { id: "promo", items: [{ id: "snack-duo" }] },
  { id: "combos", items: [{ id: "playboy" }] },
];

test("order ids show the first five characters and an ellipsis", () => {
  assert.equal(shortOrderId("PML-2001"), "PML-2...");
  assert.equal(shortOrderId("ab"), "ab...");
});

test("the first dish picks regular, promotion, or combo from its menu group", () => {
  assert.equal(menuPlacement("fried-rice", groups), "regular");
  assert.equal(menuPlacement("snack-duo", groups), "promotion");
  assert.equal(menuPlacement("playboy", groups), "combo");
  assert.equal(menuPlacement("missing", groups), "regular");
  assert.equal(menuPlacement(undefined, groups), "regular");
});
