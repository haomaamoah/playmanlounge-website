import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MenuSection } from "./menu-section";
import { OrderProvider } from "../lib/order-context";
import { menuGroups, type MenuGroup } from "../lib/content";

const combos = menuGroups.find((group) => group.id === "combos")!;
const plates = menuGroups.find((group) => group.id === "plates")!;
const promo: MenuGroup = {
  id: "promo",
  title: "Promo",
  blurb: "Current deals from the kitchen.",
  items: [combos.items[0]],
};

function renderMenu(groups: MenuGroup[], unavailable = false) {
  return renderToStaticMarkup(
    createElement(
      OrderProvider,
      { items: groups.flatMap((group) => group.items) },
      createElement(MenuSection, { groups, unavailable }),
    ),
  );
}

test("the homepage hides empty promo and combo groups but keeps regular dishes", () => {
  const html = renderMenu([
    { ...promo, items: [] },
    { ...combos, items: [] },
    plates,
  ]);

  assert.doesNotMatch(html, />Promo<\/h3>|>Combos<\/h3>/);
  assert.doesNotMatch(html, /Current deals from the kitchen|Combos come with a Coke/);
  assert.match(html, />Plates<\/h3>/);
  assert.match(html, /Add.*Fried rice.*to order/);
});

test("the regular menu does not duplicate carousel promotions and combos", () => {
  for (const group of [promo, combos]) {
    const html = renderMenu([group, plates]);
    assert.ok(!html.includes(`>${group.title}</h3>`));
    assert.ok(!html.includes(group.items[0].name));
    assert.match(html, />Plates<\/h3>/);
  }
  assert.match(renderMenu([combos]), /href="#promotions"/);
  assert.doesNotMatch(renderMenu([promo]), /Combos come with a Coke/);
});

test("the homepage has no promo heading when the catalog contains only regular dishes", () => {
  const html = renderMenu([plates]);
  assert.doesNotMatch(html, />Promo<\/h3>|>Combos<\/h3>/);
  assert.doesNotMatch(html, /Combos come with a Coke/);
  assert.match(html, />Plates<\/h3>/);
});

test("empty groups use the existing empty-menu message", () => {
  for (const groups of [[], [{ ...promo, items: [] }]]) {
    const html = renderMenu(groups);
    assert.match(html, /No dishes are available to order right now/);
    assert.doesNotMatch(html, /<h3/);
  }
});

test("an unavailable menu still shows its error instead of deals", () => {
  const html = renderMenu([promo, combos], true);
  assert.match(html, /role="alert"/);
  assert.match(html, /The menu is temporarily unavailable/);
  assert.doesNotMatch(html, /<h3|Combos come with a Coke/);
});
