import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PromotionsSection } from "./promotions-section";
import { OrderProvider } from "../lib/order-context";
import { menuGroups, type MenuGroup } from "../lib/content";
import { dealKind, getPromotions } from "../lib/promotions";

const combos = menuGroups.find((group) => group.id === "combos")!;
const promo = menuGroups.find((group) => group.id === "promo")!;
const plates = menuGroups.find((group) => group.id === "plates")!;

function renderDeals(groups: MenuGroup[], unavailable = false) {
  return renderToStaticMarkup(
    createElement(
      OrderProvider,
      { items: groups.flatMap((group) => group.items) },
      createElement(PromotionsSection, { groups, unavailable }),
    ),
  );
}

test("both promotions and combos are selected, but regular dishes are not", () => {
  const deals = getPromotions([promo, plates, combos]);
  assert.equal(deals.length, promo.items.length + combos.items.length);
  assert.deepEqual(deals.map((deal) => deal.kind), [
    ...promo.items.map(() => "promotion"), ...combos.items.map(() => "combo"),
  ]);
  for (const id of ["promo", "promos", "promotions"]) assert.equal(dealKind(id), "promotion");
  for (const id of ["combo", "combos"]) assert.equal(dealKind(id), "combo");
  assert.equal(dealKind("plates"), null);
});

test("the promotion section disappears when no deals are available", () => {
  for (const groups of [[], [plates], [{ ...promo, items: [] }, { ...combos, items: [] }]]) {
    assert.equal(renderDeals(groups), "");
  }
  assert.equal(renderDeals([promo, combos], true), "");
});

test("the carousel has the exact heading, both deal types and live prices", () => {
  const html = renderDeals([promo, combos, plates]);
  assert.match(html, /Promotions \+ Combo deals/);
  assert.match(html, /aria-roledescription="carousel"/);
  assert.match(html, />Promotion<\/p>/);
  assert.match(html, />Combo deal<\/p>/);
  assert.match(html, /Snack Duo/);
  assert.match(html, /Big Boy/);
  assert.match(html, /GH₵ 20/);
  assert.doesNotMatch(html, />Plates</);
  assert.equal((html.match(/aria-roledescription="slide"/g) ?? []).length, 7);
  const changed = renderDeals([{ ...promo, items: [{ ...promo.items[0], price: 22 }] }]);
  assert.match(changed, /GH₵ 22/);
});

test("a single promotion works on its own without unused arrow controls", () => {
  const html = renderDeals([{ ...promo, items: [promo.items[0]] }]);
  assert.match(html, /Add Snack Duo to order/);
  assert.match(html, /Show deal 1: Snack Duo/);
  assert.doesNotMatch(html, /Previous deal|Next deal/);
});

test("combo-only catalogs still show the promotion section", () => {
  const html = renderDeals([combos]);
  assert.match(html, /Promotions \+ Combo deals/);
  assert.match(html, /Previous deal|Next deal/);
  assert.match(html, /aria-label="Choose a deal"/);
});
