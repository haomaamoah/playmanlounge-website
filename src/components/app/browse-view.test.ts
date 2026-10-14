import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { menuGroups } from "../../lib/content";
import { MockStoreProvider } from "../../lib/mocks/store";
import { BrowseView } from "./browse-view";
import { CatalogProvider } from "./catalog-context";

function render(groups: typeof menuGroups | null) {
  return renderToStaticMarkup(
    createElement(MockStoreProvider, null, createElement(CatalogProvider, { groups }, createElement(BrowseView))),
  );
}

test("portal menu lists only items in the live catalog", () => {
  const live = menuGroups.map((group) => ({ ...group, items: group.items.filter((item) => item.id !== "chairman") }));
  const html = render(live);
  assert.doesNotMatch(html, /Chairman/);
  assert.match(html, /Playboy/);
  assert.match(html, /Snack Duo/);
  assert.match(html, /role="search"/);
  assert.match(html, /type="search"/);
  assert.match(html, /Search dishes, drinks, or deals/);
});

test("portal menu shows an error instead of a stale menu when the catalog is unavailable", () => {
  const html = render(null);
  assert.match(html, /menu could not be loaded/);
  assert.doesNotMatch(html, /Playboy/);
});
